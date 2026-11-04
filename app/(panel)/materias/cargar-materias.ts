import * as api from "@/app/lib/apiClient";
import { inicialesDe, leer } from "@/app/lib/format";
import type { Curso, Entrega } from "@/app/lib/types";

export interface Docente {
    id: number;
    nombre: string; // "Prof. Analía Medina"
    iniciales: string;
}

export interface MateriaItem {
    id: number;
    nombre: string;
    horario?: string;
    aula?: string;
    docente: Docente;
    // null = no se pudo calcular (no se muestra el badge)
    pendientes: number | null;
}

export interface MateriasData {
    curso: Curso | null;
    materias: MateriaItem[];
}

// Una llamada secundaria que falla no debe romper toda la página,
// salvo que sea un 401 (sesión vencida), que se propaga.
export async function seguro<T>(etiqueta: string, promesa: Promise<T[] | null>): Promise<T[] | undefined> {
    try {
        return (await promesa) ?? [];
    } catch (error) {
        if (error instanceof api.ApiError && error.status === 401) throw error;
        console.warn(`[materias] falló ${etiqueta}:`, error);
        return undefined;
    }
}

// El docente se identifica con idProfesor (id numérico de usuario).
export async function buscarDocente(idProfesor: number): Promise<Docente> {
    try {
        const datos = await api.datos.porLegajo(idProfesor);
        const nombre = leer<string>(datos, "nombre");
        const apellido = leer<string>(datos, "apellido");
        if (nombre || apellido) {
            return {
                id: idProfesor,
                nombre: `Prof. ${[nombre, apellido].filter(Boolean).join(" ")}`,
                iniciales: inicialesDe(nombre, apellido),
            };
        }
    } catch (error) {
        if (error instanceof api.ApiError && error.status === 401) throw error;
        console.warn(`[materias] sin datos personales del docente ${idProfesor}:`, error);
    }

    // Plan B: el nombre de usuario ("maria.lopez") alcanza para mostrar a alguien.
    try {
        const usuario = await api.usuarios.porLegajo(idProfesor);
        const username = usuario.nombreUsuario ?? usuario.nombre ?? "";
        if (!username) throw new Error("usuario sin nombre");
        const [a, b] = username.split(/[._\s]+/);
        return {
            id: idProfesor,
            nombre: `Prof. ${username}`,
            iniciales: inicialesDe(a, b) || "?",
        };
    } catch (error) {
        if (error instanceof api.ApiError && error.status === 401) throw error;
        console.warn(`[materias] sin usuario del docente ${idProfesor}:`, error);
        return { id: idProfesor, nombre: "Docente sin datos", iniciales: "?" };
    }
}

// Id de la tarea a la que pertenece una entrega (el nombre del campo no está confirmado).
function tareaDeEntrega(entrega: Entrega) {
    return leer<number>(entrega, "idTarea", "tareaId", "numTarea", "num_tarea");
}

export async function cargarMaterias(): Promise<MateriasData> {
    const perfil = await api.auth.getProfile();
    if (perfil.idCurso == null) return { curso: null, materias: [] };

    const [curso, materias] = await Promise.all([
        api.cursos.porNumero(perfil.idCurso).catch((error) => {
            if (error instanceof api.ApiError && error.status === 401) throw error;
            console.warn("[materias] falló el curso:", error);
            return null;
        }),
        api.materias.porCurso(perfil.idCurso),
    ]);

    // Un docente puede dictar varias materias: se pide una sola vez.
    const docentes = new Map<number, Promise<Docente>>();
    const docenteDe = (idProfesor: number) => {
        if (!docentes.has(idProfesor)) docentes.set(idProfesor, buscarDocente(idProfesor));
        return docentes.get(idProfesor)!;
    };

    const items = await Promise.all(
        (materias ?? []).map(async (materia): Promise<MateriaItem> => {
            const [docente, tareas, entregas] = await Promise.all([
                docenteDe(materia.idProfesor),
                seguro("tareas", api.tareas.porMateria(materia.id)),
                seguro("entregas", api.materias.entregasDeAlumno(materia.id, perfil.id)),
            ]);

            // Pendiente = tarea de la materia sin entrega del alumno
            let pendientes: number | null = null;
            if (tareas && entregas) {
                const entregadas = new Set(entregas.map(tareaDeEntrega).filter((id) => id != null));
                if (entregas.length > 0 && entregadas.size === 0) {
                    console.warn("[materias] no reconozco el campo de tarea en las entregas:", entregas[0]);
                } else {
                    pendientes = tareas.filter((t) => !entregadas.has(t.id)).length;
                }
            }

            return {
                id: materia.id,
                nombre: materia.nombre,
                horario: materia.horario,
                aula: materia.aula,
                docente,
                pendientes,
            };
        })
    );

    return { curso, materias: items };
}
