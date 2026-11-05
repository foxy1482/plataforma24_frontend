import * as api from "@/app/lib/apiClient";
import { parseFecha } from "@/app/lib/format";
import { esAdminRol } from "@/app/lib/sesion";
import type { Archivo, Material, Materia } from "@/app/lib/types";
import { seguro } from "@/app/lib/api-utils";
import { buscarDocente, type Docente } from "../../materias/cargar-materias";

const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;

export interface OtroMaterial {
    id: number;
    titulo: string;
    publicado: Date | null;
}

export interface MaterialDetalle {
    material: Material;
    materia: Materia;
    docente: Docente;
    alumno: string;
    publicado: Date | null;
    nuevo: boolean;
    archivos: Archivo[];
    // false = no se pudieron traer los adjuntos (se avisa en vez de decir "sin archivos")
    archivosOk: boolean;
    otros: OtroMaterial[];
}

// Por qué no se muestra el material: mismo aspecto para el alumno en los tres casos (no se filtra si existe).
export class MaterialNoDisponible extends Error {}

// Un material de estudio con todo lo que hace falta para consultarlo. Lo que el docente dejó programado
// para más adelante, o que es de una materia de otro curso, no se muestra.
export async function cargarMaterialDetalle(id: number): Promise<MaterialDetalle> {
    const [perfil, material] = await Promise.all([api.auth.getProfile(), api.materiales.porNumero(id)]);
    const materia = await api.materias.porNumero(material.idMateria);

    if (!esAdminRol(perfil.idRol) && perfil.idCurso !== materia.idCurso) throw new MaterialNoDisponible();

    const publicado = parseFecha(material.publicadaDesde);
    const ahora = Date.now();
    if (!esAdminRol(perfil.idRol) && publicado && publicado.getTime() > ahora) throw new MaterialNoDisponible();

    const [docente, archivos, hermanos] = await Promise.all([
        buscarDocente(materia.idProfesor),
        seguro("adjuntos", api.materialArchivos.porMaterial(material.id)),
        seguro("material", api.materiales.porMateria(materia.id)),
    ]);

    const otros = (hermanos ?? [])
        .filter((m) => m.id !== material.id)
        .map((m) => ({ id: m.id, titulo: m.titulo, publicado: parseFecha(m.publicadaDesde) }))
        .filter((m) => !m.publicado || m.publicado.getTime() <= ahora)
        .sort((a, b) => (b.publicado?.getTime() ?? 0) - (a.publicado?.getTime() ?? 0));

    return {
        material,
        materia,
        docente,
        alumno: (perfil.nombre ?? perfil.nombreUsuario ?? "").replace(/[._]+/g, " ").trim(),
        publicado,
        nuevo: publicado !== null && ahora - publicado.getTime() < SIETE_DIAS,
        archivos: archivos ?? [],
        archivosOk: archivos !== undefined,
        otros,
    };
}
