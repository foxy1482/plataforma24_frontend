import * as api from "@/app/lib/apiClient";
import { normalizar } from "@/app/lib/format";
import { nombreDe, nombreCurso, ordenarCursos, turnoDe } from "@/app/lib/sesion";
import type { Curso, Materia } from "@/app/lib/types";

export interface DivisionItem {
    curso: Curso;
    nombre: string; // "5º 2ª división"
    turno: string;
    aula?: string;
    mia: boolean;
}

export interface AnioItem {
    anio: number;
    nombre: string; // "5to año"
    ciclo: string; // "Ciclo Superior · Informática"
    divisiones: DivisionItem[];
}

export interface CursosData {
    anios: AnioItem[];
    cicloLectivo: number;
    idCursoPropio: number | null;
    totalDivisiones: number;
}

export interface MateriaDeDivision {
    id: number;
    nombre: string;
    profesor: string;
}

export interface DetalleDivision {
    materias: MateriaDeDivision[];
    alumnos: number | null;
}

const NOMBRES = ["1er año", "2do año", "3er año", "4to año", "5to año", "6to año"];

export async function cargarCursos(): Promise<CursosData> {
    const [perfil, cursos] = await Promise.all([
        api.auth.getProfile(),
        api.cursos.listar(),
    ]);

    const lista = ordenarCursos(cursos ?? []);
    const anios = new Map<number, DivisionItem[]>();

    for (const curso of lista) {
        const anio = Number(curso.año);
        const divisiones = anios.get(anio) ?? [];
        divisiones.push({
            curso,
            nombre: `${nombreCurso(curso)} división`,
            turno: turnoDe(curso),
            aula: curso.aula,
            mia: curso.id === perfil.idCurso,
        });
        anios.set(anio, divisiones);
    }

    return {
        anios: [...anios.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([anio, divisiones]) => ({
                anio,
                nombre: NOMBRES[anio - 1] ?? `${anio}º año`,
                ciclo: anio <= 2 ? "Ciclo Básico" : "Ciclo Superior · Informática",
                divisiones,
            })),
        cicloLectivo: lista[0]?.cicloLectivo ?? new Date().getFullYear(),
        idCursoPropio: perfil.idCurso ?? null,
        totalDivisiones: lista.length,
    };
}

// Las materias y la cantidad de alumnos se piden solo al desplegar una división.
export async function cargarDivision(idCurso: number): Promise<DetalleDivision> {
    const [materias, alumnos] = await Promise.all([
        api.materias.porCurso(idCurso).catch(() => null),
        api.usuarios.porCurso(idCurso).catch(() => null),
    ]);

    const docentes = new Map<number, Promise<string>>();
    const docenteDe = (id: number) => {
        if (!docentes.has(id)) docentes.set(id, nombreDe(id).catch(() => "Sin asignar"));
        return docentes.get(id)!;
    };

    const items = await Promise.all(
        (materias ?? []).map(async (m: Materia): Promise<MateriaDeDivision> => ({
            id: m.id,
            nombre: m.nombre,
            profesor: m.idProfesor ? `Prof. ${await docenteDe(m.idProfesor)}` : "Sin asignar",
        }))
    );

    return {
        materias: items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        alumnos: alumnos ? alumnos.length : null,
    };
}

export function coincide(division: DivisionItem, anio: AnioItem, busqueda: string) {
    const q = normalizar(busqueda.trim());
    if (!q) return true;
    return (
        normalizar(division.nombre).includes(q) ||
        normalizar(anio.nombre).includes(q) ||
        normalizar(division.turno).includes(q) ||
        normalizar(`${anio.anio}º ${division.curso.division}ª`).includes(q)
    );
}
