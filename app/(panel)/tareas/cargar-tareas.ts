import * as api from "@/app/lib/apiClient";
import { seguro } from "@/app/lib/api-utils";
import { leer } from "@/app/lib/format";
import type { Entrega, Materia } from "@/app/lib/types";
import { parseFecha, tituloCorto, type TareaItem } from "./tarea-utils";

export interface TareasData {
    hoy: Date;
    idCurso: number | null;
    materias: Materia[];
    tareas: TareaItem[];
}

// Id de la tarea a la que pertenece una entrega
function tareaDeEntrega(entrega: Entrega) {
    const id = leer<number | string>(entrega, "idTarea", "tareaId");
    return id === undefined ? undefined : Number(id);
}

export async function cargarTareas(): Promise<TareasData> {
    const hoy = new Date();
    const perfil = await api.auth.getProfile();
    if (perfil.idCurso == null) return { hoy, idCurso: null, materias: [], tareas: [] };

    const materias = (await api.materias.porCurso(perfil.idCurso)) ?? [];

    const porMateria = await Promise.all(
        materias.map(async (materia) => {
            const [tareas, entregas] = await Promise.all([
                seguro("tareas", api.tareas.porMateria(materia.id)),
                seguro("entregas", api.materias.entregasDeAlumno(materia.id, perfil.id)),
            ]);
            return { materia, tareas, entregas };
        })
    );

    // Si fallaron las tareas de TODAS las materias es un error real, no "no hay tareas".
    if (materias.length > 0 && porMateria.every((m) => m.tareas === undefined)) {
        throw new Error("No se pudieron cargar las tareas");
    }

    // El backend lista también las tareas con publicación programada a futuro: el alumno no
    // debe verlas (ni contarlas como pendientes) hasta que llegue su fecha.
    const items: TareaItem[] = porMateria.flatMap(({ materia, tareas, entregas }) =>
        (tareas ?? [])
            .filter((tarea) => {
                const publicada = parseFecha(tarea.publicadaDesde);
                return !publicada || publicada.getTime() <= hoy.getTime();
            })
            .map((tarea): TareaItem => {
            const titulo = leer<string>(tarea, "titulo", "nombre") ?? "Tarea sin título";
            const entrega = (entregas ?? []).find((e) => tareaDeEntrega(e) === tarea.id);

            return {
                id: tarea.id,
                idMateria: materia.id,
                titulo,
                tituloCorto: tituloCorto(titulo),
                materia: materia.nombre,
                // Nombre del campo de la tarea sin confirmar: se prueban las variantes probables.
                fecha: parseFecha(
                    leer(tarea, "fechaEntrega", "fechaLimite", "fechaVencimiento", "fecha_entrega")
                ),
                entrega: entrega
                    ? {
                          fecha: parseFecha(leer(entrega, "fechaEntrega", "fecha_entrega")),
                          calificacion: leer<string>(entrega, "calificacion") ?? null,
                      }
                    : null,
            };
        })
    );

    return { hoy, idCurso: perfil.idCurso, materias, tareas: items };
}