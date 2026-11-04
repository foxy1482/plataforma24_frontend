import * as api from "@/app/lib/apiClient";
import { ApiError } from "@/app/lib/apiClient";
import { ordenarCursos } from "@/app/lib/sesion";
import type { Curso, DatosPersonales, Rol, Usuario } from "@/app/lib/types";

export interface DetalleUsuario {
    yo: number;
    usuario: Usuario;
    // null = todavía no tiene datos personales cargados.
    datos: DatosPersonales | null;
    roles: Rol[];
    cursos: Curso[];
}

// Un 404 en los datos personales no es un error: simplemente todavía no se cargaron.
export function cargarDatosPersonales(idUsuario: number): Promise<DatosPersonales | null> {
    return api.datos.porLegajo(idUsuario).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
    });
}

export async function cargarUsuario(idUsuario: number): Promise<DetalleUsuario> {
    const [yo, usuario, datos, roles, cursos] = await Promise.all([
        api.auth.getProfile(),
        api.usuarios.porLegajo(idUsuario),
        cargarDatosPersonales(idUsuario),
        api.roles.listar(),
        api.cursos.listar(),
    ]);
    return {
        yo: yo.id,
        usuario,
        datos,
        roles: [...(roles ?? [])].sort((a, b) => a.id - b.id),
        cursos: ordenarCursos(cursos ?? []),
    };
}
