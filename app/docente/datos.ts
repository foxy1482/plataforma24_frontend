import * as api from "@/app/lib/apiClient";
import { alumnosDeCurso } from "@/app/lib/alumnos";
import { seguro } from "@/app/lib/api-utils";
import { notaNumerica, parseFecha, promedio } from "@/app/lib/format";
import { cargarSesion, cursoLargo, nombreCurso, type Sesion } from "@/app/lib/sesion";
import type { Curso, DatosPersonales, Entrega, Materia, Tarea } from "@/app/lib/types";

export type EstadoTarea = "programada" | "abierta" | "para-corregir" | "cerrada";

export interface TareaDocente {
    tarea: Tarea;
    idMateria: number;
    materia: string;
    idCurso: number;
    curso: string;
    vence: Date | null;
    publicada: Date | null;
    estado: EstadoTarea;
    entregas: Entrega[];
    alumnos: number;
    entregadas: number;
    corregidas: number;
    sinCorregir: number;
    promedio: number | null;
}

export interface MateriaDocente {
    materia: Materia;
    curso: Curso | null;
    cursoNombre: string;
    cursoDetalle: string;
    alumnos: DatosPersonales[];
    tareas: TareaDocente[];
    promedio: number | null;
    activas: number;
    sinCorregir: number;
}

export interface DatosDocente {
    sesion: Sesion;
    hoy: Date;
    ciclo: number;
    materias: MateriaDocente[];
    tareas: TareaDocente[];
    sinCorregir: number;
    activas: number;
}

function estadoDe(tarea: TareaDocente, hoy: Date): EstadoTarea {
    if (tarea.publicada && tarea.publicada.getTime() > hoy.getTime()) return "programada";
    if (!tarea.vence || tarea.vence.getTime() >= hoy.getTime()) return "abierta";
    return tarea.sinCorregir > 0 ? "para-corregir" : "cerrada";
}

export const ETIQUETA_ESTADO: Record<EstadoTarea, string> = {
    programada: "Programada",
    abierta: "Abierta",
    "para-corregir": "Para corregir",
    cerrada: "Cerrada",
};

async function cargar(): Promise<DatosDocente> {
    const hoy = new Date();
    const sesion = await cargarSesion();
    const materias = (await api.materias.porProfesor(sesion.usuario.id)) ?? [];

    const cursos = new Map<number, Promise<Curso | null>>();
    const alumnos = new Map<number, Promise<DatosPersonales[]>>();
    const cursoDe = (id: number) => {
        if (!cursos.has(id)) cursos.set(id, api.cursos.porNumero(id).catch(() => null));
        return cursos.get(id)!;
    };
    const alumnosDe = (id: number) => {
        if (!alumnos.has(id)) {
            alumnos.set(id, alumnosDeCurso(id));
        }
        return alumnos.get(id)!;
    };

    const items = await Promise.all(
        materias.map(async (materia): Promise<MateriaDocente> => {
            const [curso, lista, tareas] = await Promise.all([
                cursoDe(materia.idCurso),
                alumnosDe(materia.idCurso),
                seguro("tareas", api.tareas.porMateria(materia.id)),
            ]);

            const conEntregas = await Promise.all(
                (tareas ?? []).map(async (t: Tarea): Promise<TareaDocente> => {
                    const entregas = (await seguro("entregas", api.entregas.porTarea(t.id))) ?? [];
                    const notas = entregas
                        .map((e) => notaNumerica(e.calificacion))
                        .filter((n): n is number => n !== null);
                    const item: TareaDocente = {
                        tarea: t,
                        idMateria: materia.id,
                        materia: materia.nombre,
                        idCurso: materia.idCurso,
                        curso: nombreCurso(curso),
                        vence: parseFecha(t.fechaEntrega),
                        publicada: parseFecha(t.publicadaDesde),
                        estado: "abierta",
                        entregas,
                        alumnos: lista.length,
                        entregadas: entregas.length,
                        corregidas: notas.length,
                        sinCorregir: entregas.length - notas.length,
                        promedio: promedio(notas),
                    };
                    item.estado = estadoDe(item, hoy);
                    return item;
                })
            );

            conEntregas.sort((a, b) => (b.vence?.getTime() ?? 0) - (a.vence?.getTime() ?? 0));

            return {
                materia,
                curso,
                cursoNombre: nombreCurso(curso),
                cursoDetalle: cursoLargo(curso),
                alumnos: lista,
                tareas: conEntregas,
                promedio: promedio(conEntregas.flatMap((t) => (t.promedio === null ? [] : [t.promedio]))),
                activas: conEntregas.filter((t) => t.estado === "abierta").length,
                sinCorregir: conEntregas.reduce((a, t) => a + t.sinCorregir, 0),
            };
        })
    );

    const todas = items.flatMap((m) => m.tareas);

    return {
        sesion,
        hoy,
        ciclo: items[0]?.curso?.cicloLectivo ?? hoy.getFullYear(),
        materias: items,
        tareas: todas,
        sinCorregir: todas.reduce((a, t) => a + t.sinCorregir, 0),
        activas: todas.filter((t) => t.estado === "abierta").length,
    };
}

// El panel y cada pantalla piden lo mismo: se comparte una sola carga.
let cache: Promise<DatosDocente> | null = null;

export function datosDocente() {
    if (!cache) cache = cargar().catch((e) => ((cache = null), Promise.reject(e)));
    return cache;
}

export function invalidarDocente() {
    cache = null;
}

export function materiaDe(datos: DatosDocente, id: number | null) {
    if (id === null) return datos.materias[0] ?? null;
    return datos.materias.find((m) => m.materia.id === id) ?? datos.materias[0] ?? null;
}

export function etiquetaMateria(m: MateriaDocente) {
    return `${m.materia.nombre} · ${m.cursoNombre}`;
}
