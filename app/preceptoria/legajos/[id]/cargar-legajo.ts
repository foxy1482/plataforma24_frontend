import * as api from "@/app/lib/apiClient";
import { ApiError } from "@/app/lib/apiClient";
import { seguro } from "@/app/lib/api-utils";
import { parseFecha } from "@/app/lib/format";
import { nombreDe } from "@/app/lib/sesion";
import type {
    BoletinResumen,
    Curso,
    DatosPersonales,
    InasistenciaPeriodo,
    Usuario,
} from "@/app/lib/types";

export interface Pendiente {
    idTarea: number;
    titulo: string;
    materia: string;
    vence: Date | null;
}

export interface Legajo {
    usuario: Usuario;
    datos: DatosPersonales | null;
    // El backend no deja al rol consultar los datos personales / las entregas del alumno.
    datosRestringidos: boolean;
    curso: Curso | null;
    nombre: string;
    ciclo: number;
    anuales: number | null;
    porBimestre: InasistenciaPeriodo[];
    boletines: BoletinResumen[];
    pendientes: Pendiente[] | null; // null = no se pudieron consultar las entregas
}

export async function cargarLegajo(idUsuario: number, ciclo: number): Promise<Legajo> {
    const usuario = await api.usuarios.porLegajo(idUsuario);

    const [personales, curso, alias, resumen, boletines, entregas] = await Promise.all([
        api.datos.porLegajo(idUsuario).then(
            (d) => ({ datos: d, restringido: false }),
            (e) => ({ datos: null, restringido: e instanceof ApiError && e.status === 403 })
        ),
        usuario.idCurso == null ? null : api.cursos.porNumero(usuario.idCurso).catch(() => null),
        nombreDe(idUsuario, usuario),
        api.asistencias.resumenAlumno(idUsuario, ciclo).catch(() => null),
        api.boletines.porAlumno(idUsuario, ciclo).catch(() => null),
        seguro("entregas", api.entregas.porAlumno(idUsuario)),
    ]);

    const { datos, restringido } = personales;

    // Sin datos personales, el nombre real se toma del boletín (apellido y nombre).
    const deBoletin = (boletines ?? []).find((b) => b.nombre || b.apellido);
    const nombre =
        datos || !deBoletin
            ? alias
            : [deBoletin.nombre, deBoletin.apellido].filter(Boolean).join(" ");

    // Si no se pudieron leer las entregas, no se puede afirmar qué falta entregar.
    const pendientes: Pendiente[] = [];
    if (entregas !== undefined && usuario.idCurso != null) {
        const materias = (await api.materias.porCurso(usuario.idCurso).catch(() => null)) ?? [];
        const hechas = new Set(entregas.map((e) => e.idTarea));
        const ahora = Date.now();

        const listas = await Promise.all(
            materias.map(async (m) => ({
                materia: m.nombre,
                tareas: (await seguro("tareas", api.tareas.porMateria(m.id))) ?? [],
            }))
        );

        for (const { materia, tareas } of listas) {
            for (const t of tareas) {
                const vence = parseFecha(t.fechaEntrega);
                const publicada = parseFecha(t.publicadaDesde);
                const yaVisible = !publicada || publicada.getTime() <= ahora;
                if (yaVisible && !hechas.has(t.id) && vence && vence.getTime() < ahora) {
                    pendientes.push({ idTarea: t.id, titulo: t.titulo, materia, vence });
                }
            }
        }
        pendientes.sort((a, b) => (b.vence?.getTime() ?? 0) - (a.vence?.getTime() ?? 0));
    }

    const anual = resumen?.anuales?.find((a) => a.cicloLectivo === ciclo);

    return {
        usuario,
        datos,
        datosRestringidos: restringido,
        curso,
        nombre,
        ciclo,
        anuales: anual ? anual.totalInasistencias : null,
        porBimestre: [...(resumen?.porBimestre ?? [])].sort((a, b) => a.bimestre - b.bimestre),
        boletines: [...(boletines ?? [])].sort((a, b) => a.bimestre - b.bimestre),
        pendientes: entregas === undefined ? null : pendientes,
    };
}
