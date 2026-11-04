import * as api from "@/app/lib/apiClient";
import { listarPeriodos } from "@/app/lib/periodos";
import { cargarSesion, ordenarCursos, type Sesion } from "@/app/lib/sesion";
import type { Curso, PeriodoApi } from "@/app/lib/types";

export interface DatosPreceptoria {
    sesion: Sesion;
    hoy: Date;
    ciclo: number;
    cursos: Curso[];
    periodos: PeriodoApi[];
}

async function cargar(): Promise<DatosPreceptoria> {
    const hoy = new Date();
    const [sesion, lista] = await Promise.all([cargarSesion(), api.cursos.listar()]);
    const cursos = ordenarCursos(lista ?? []);
    const ciclo = cursos[0]?.cicloLectivo ?? hoy.getFullYear();

    // El curso del propio usuario queda primero: es el que más va a usar.
    const propio = cursos.findIndex((c) => c.id === sesion.usuario.idCurso);
    if (propio > 0) cursos.unshift(cursos.splice(propio, 1)[0]);

    return { sesion, hoy, ciclo, cursos, periodos: await listarPeriodos(ciclo) };
}

let cache: Promise<DatosPreceptoria> | null = null;

export function datosPreceptoria() {
    if (!cache) cache = cargar().catch((e) => ((cache = null), Promise.reject(e)));
    return cache;
}

export function invalidarPreceptoria() {
    cache = null;
}

// Al cambiar de cuenta no puede quedar el nombre ni los datos del usuario anterior.
api.alCambiarSesion(invalidarPreceptoria);

export function cursoDe(datos: DatosPreceptoria, id: number | null) {
    if (id === null) return datos.cursos[0] ?? null;
    return datos.cursos.find((c) => c.id === id) ?? datos.cursos[0] ?? null;
}
