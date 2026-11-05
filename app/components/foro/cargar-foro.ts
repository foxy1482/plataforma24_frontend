import * as api from "@/app/lib/apiClient";
import { cursosDelCicloActual, nombreCurso, ordenarCursos } from "@/app/lib/sesion";
import type { Curso, ForoMensaje, ForoTema, Usuario } from "@/app/lib/types";

export interface ForoData {
    yo: Usuario;
    temas: ForoTema[];
    cursos: Record<number, string>;
    listaCursos: Curso[];
}

async function listarCursos(): Promise<Curso[]> {
    return ordenarCursos((await api.cursos.listar().catch(() => null)) ?? []);
}

const nombres = (lista: Curso[]): Record<number, string> =>
    Object.fromEntries(lista.map((c) => [c.id, nombreCurso(c)]));

export async function cargarForo(): Promise<ForoData> {
    const [yo, temas, todosLosCursos] = await Promise.all([
        api.auth.getProfile(),
        api.foro.temas(),
        listarCursos(),
    ]);
    // Para elegir/filtrar: los cursos del ciclo vigente, más los de debates ya existentes y el propio (que pueden
    // ser de un ciclo anterior); `cursos` conserva el nombre de todos para etiquetar cualquier debate.
    const listaCursos = cursosDelCicloActual(todosLosCursos, [yo.idCurso, ...(temas ?? []).map((t) => t.idCurso)]);
    return { yo, temas: temas ?? [], cursos: nombres(todosLosCursos), listaCursos };
}

export interface DebateData {
    yo: Usuario;
    tema: ForoTema;
    mensajes: ForoMensaje[];
    cursos: Record<number, string>;
}

// No hay un endpoint para un solo tema: se toma de la lista de los que el usuario puede ver.
export async function cargarDebate(idTema: number): Promise<DebateData> {
    const [yo, temas, mensajes, listaCursos] = await Promise.all([
        api.auth.getProfile(),
        api.foro.temas(),
        api.foro.mensajes(idTema),
        listarCursos(),
    ]);
    const cursos = nombres(listaCursos);

    const tema = (temas ?? []).find((t) => t.id === idTema);
    if (!tema) {
        // El tema existe (los mensajes se pudieron leer) pero no figura en la lista.
        const primero = (mensajes ?? [])[0];
        if (!primero) throw new api.ApiError(404, "", "No se encontró el debate");
        return {
            yo,
            tema: {
                id: idTema,
                idCurso: primero.idCurso ?? null,
                titulo: primero.tema,
                idAutor: primero.idAutor,
                autor: primero.autor,
                fechaCreacion: primero.fechaPublicacion,
                fijado: false,
                cerrado: false,
                cantidadMensajes: (mensajes ?? []).length,
            },
            mensajes: mensajes ?? [],
            cursos,
        };
    }

    return { yo, tema, mensajes: mensajes ?? [], cursos };
}
