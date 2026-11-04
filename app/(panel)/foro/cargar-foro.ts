import * as api from "@/app/lib/apiClient";
import { nombreCurso } from "@/app/lib/sesion";
import type { Curso, ForoMensaje, ForoTema, Usuario } from "@/app/lib/types";

export interface ForoData {
    yo: Usuario;
    temas: ForoTema[];
    // Nombre corto de cada curso ("5º 6ª") para etiquetar los debates.
    cursos: Record<number, string>;
}

async function nombresDeCursos(): Promise<Record<number, string>> {
    const lista: Curso[] = (await api.cursos.listar().catch(() => null)) ?? [];
    return Object.fromEntries(lista.map((c) => [c.id, nombreCurso(c)]));
}

export async function cargarForo(): Promise<ForoData> {
    const [yo, temas, cursos] = await Promise.all([
        api.auth.getProfile(),
        api.foro.temas(),
        nombresDeCursos(),
    ]);
    return { yo, temas: temas ?? [], cursos };
}

export interface DebateData {
    yo: Usuario;
    tema: ForoTema;
    mensajes: ForoMensaje[];
    cursos: Record<number, string>;
}

// No hay un endpoint para un solo tema: se toma de la lista de los que el usuario puede ver.
export async function cargarDebate(idTema: number): Promise<DebateData> {
    const [yo, temas, mensajes, cursos] = await Promise.all([
        api.auth.getProfile(),
        api.foro.temas(),
        api.foro.mensajes(idTema),
        nombresDeCursos(),
    ]);

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
