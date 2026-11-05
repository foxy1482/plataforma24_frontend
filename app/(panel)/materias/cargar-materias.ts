import * as api from "@/app/lib/apiClient";
import { seguro } from "@/app/lib/api-utils";
import { inicialesDe, leer, nombreDeAlias, parseFecha } from "@/app/lib/format";
import type { Curso, Entrega } from "@/app/lib/types";

export interface Docente {
    id: number;
    nombre: string;
    iniciales: string;
    email?: string; // para el botón "Enviar mail" (lo da /usuarios/{id}, visible para cualquier usuario)
}

export interface ProximaEntrega {
    titulo: string;
    fecha: Date | null;
    vencida: boolean;
}

export interface MateriaItem {
    id: number;
    nombre: string;
    horario?: string;
    aula?: string;
    docente: Docente;
    // null = no se pudo calcular (no se muestra el badge)
    pendientes: number | null;
    // Tareas ya publicadas, para mostrar "n de m entregadas"; null si no se pudo calcular
    totalTareas: number | null;
    // La tarea pendiente más urgente: la que vence primero entre las que aún no vencieron; si todas
    // vencieron, la más reciente. null = no hay pendientes (o no se pudo calcular).
    proxima: ProximaEntrega | null;
    // Cantidad de materiales de estudio ya publicados; null si no se pudo consultar
    materiales: number | null;
}

export interface MateriasData {
    curso: Curso | null;
    materias: MateriaItem[];
}

// El docente se identifica con idProfesor (id numérico de usuario).
export async function buscarDocente(idProfesor: number): Promise<Docente> {
    // Datos personales (nombre real) y cuenta (correo y alias) se piden juntos. Un alumno no puede leer
    // los datos personales de otro usuario (403), así que lo normal es quedarse con el alias.
    const [datos, usuario] = await Promise.allSettled([
        api.datos.porLegajo(idProfesor),
        api.usuarios.porLegajo(idProfesor),
    ]);

    for (const r of [datos, usuario]) {
        if (r.status === "rejected" && r.reason instanceof api.ApiError && r.reason.status === 401) {
            throw r.reason;
        }
    }

    const email = usuario.status === "fulfilled" ? usuario.value.email || undefined : undefined;

    if (datos.status === "fulfilled") {
        const nombre = leer<string>(datos.value, "nombre");
        const apellido = leer<string>(datos.value, "apellido");
        if (nombre || apellido) {
            return {
                id: idProfesor,
                nombre: `Prof. ${[nombre, apellido].filter(Boolean).join(" ")}`,
                iniciales: inicialesDe(nombre, apellido),
                email,
            };
        }
    }

    if (usuario.status === "fulfilled") {
        const username = usuario.value.nombreUsuario ?? usuario.value.nombre ?? "";
        if (username) {
            const [a, b] = username.split(/[._\s]+/);
            return {
                id: idProfesor,
                nombre: `Prof. ${nombreDeAlias(username)}`,
                iniciales: inicialesDe(a, b) || "?",
                email,
            };
        }
    }

    return { id: idProfesor, nombre: "Docente sin datos", iniciales: "?", email };
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
            const [docente, tareasTodas, entregas, listaMateriales] = await Promise.all([
                docenteDe(materia.idProfesor),
                seguro("tareas", api.tareas.porMateria(materia.id)),
                seguro("entregas", api.materias.entregasDeAlumno(materia.id, perfil.id)),
                seguro("material", api.materiales.porMateria(materia.id)),
            ]);

            const ahora = Date.now();
            const yaPublicado = (valor: string) => {
                const f = parseFecha(valor);
                return !f || f.getTime() <= ahora;
            };

            // Lo programado para más adelante (publicadaDesde en el futuro) todavía no cuenta.
            const tareas = tareasTodas?.filter((t) => yaPublicado(t.publicadaDesde));

            let pendientes: number | null = null;
            let proxima: ProximaEntrega | null = null;
            if (tareas && entregas) {
                const entregadas = new Set(entregas.map(tareaDeEntrega).filter((id) => id != null));
                if (entregas.length > 0 && entregadas.size === 0) {
                    console.warn("[materias] no reconozco el campo de tarea en las entregas:", entregas[0]);
                } else {
                    const sinEntregar = tareas.filter((t) => !entregadas.has(t.id));
                    pendientes = sinEntregar.length;

                    const conFecha = sinEntregar.map((t) => ({ t, fecha: parseFecha(t.fechaEntrega) }));
                    const porVenir = conFecha
                        .filter((x) => x.fecha && x.fecha.getTime() >= ahora)
                        .sort((a, b) => a.fecha!.getTime() - b.fecha!.getTime());
                    const vencidas = conFecha
                        .filter((x) => x.fecha && x.fecha.getTime() < ahora)
                        .sort((a, b) => b.fecha!.getTime() - a.fecha!.getTime());
                    const elegida = porVenir[0] ?? vencidas[0] ?? conFecha[0];
                    if (elegida) {
                        proxima = {
                            titulo: elegida.t.titulo,
                            fecha: elegida.fecha,
                            vencida: porVenir.length === 0 && vencidas.length > 0,
                        };
                    }
                }
            }

            return {
                id: materia.id,
                nombre: materia.nombre,
                horario: materia.horario,
                aula: materia.aula,
                docente,
                pendientes,
                totalTareas: tareas ? tareas.length : null,
                proxima,
                materiales: listaMateriales ? listaMateriales.filter((m) => yaPublicado(m.publicadaDesde)).length : null,
            };
        })
    );

    return { curso, materias: items };
}
