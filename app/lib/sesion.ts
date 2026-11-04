import * as api from "./apiClient";
import { normalizar } from "./format";
import type { Curso, Usuario } from "./types";

export type Papel = "alumno" | "docente" | "preceptor" | "directivo" | "otro";

export interface Sesion {
    usuario: Usuario;
    rol: string | null;
    papel: Papel;
    nombre: string; // "Gustavo Ferreyra"
    iniciales: string;
}

const PAPEL_POR_ROL: Record<number, Papel> = {
    1: "alumno",
    2: "docente",
    3: "directivo",
    4: "directivo",
    5: "directivo",
    6: "directivo",
    7: "preceptor",
};

function papelDe(idRol: number, nombreRol?: string): Papel {
    if (PAPEL_POR_ROL[idRol]) return PAPEL_POR_ROL[idRol];
    const n = normalizar(nombreRol ?? "");
    if (n.includes("alumn") || n.includes("estudiante")) return "alumno";
    if (n.includes("profesor") || n.includes("docente")) return "docente";
    if (n.includes("precept")) return "preceptor";
    if (n.includes("direct") || n.includes("admin") || n.includes("autoridad")) return "directivo";
    return "otro";
}

// Nombre para mostrar: datos personales si están, si no el nombre de usuario.
export async function nombreDe(idUsuario: number, usuario?: Usuario) {
    try {
        const d = await api.datos.porLegajo(idUsuario);
        const completo = [d?.nombre, d?.apellido].filter(Boolean).join(" ").trim();
        if (completo) return completo;
    } catch {
        // sin datos personales
    }
    const alias = usuario?.nombre ?? usuario?.nombreUsuario ?? "";
    return alias.replace(/[._]+/g, " ").trim() || "Sin nombre";
}

export function inicialesDeNombre(nombre: string) {
    const partes = nombre.split(/\s+/).filter(Boolean);
    const dos = [partes[0], partes[1] ?? ""].map((p) => p[0] ?? "");
    return dos.join("").toUpperCase() || "?";
}

export async function cargarSesion(): Promise<Sesion> {
    const usuario = await api.auth.getProfile();
    const nombre = await nombreDe(usuario.id, usuario);
    return {
        usuario,
        rol: usuario.rol ?? null,
        papel: papelDe(usuario.idRol, usuario.rol ?? undefined),
        nombre,
        iniciales: inicialesDeNombre(nombre),
    };
}

// Ruta del panel del usuario logueado, o "/login" si el token ya no sirve (401).
// Cualquier otro fallo (red, 5xx) se propaga: no es motivo para cerrar la sesión.
export async function rutaDeSesion() {
    try {
        const usuario = await api.auth.getProfile();
        return rutaDePapel(papelDe(usuario.idRol));
    } catch (error) {
        if (error instanceof api.ApiError && error.status === 401) return "/login";
        throw error;
    }
}

export function rutaDePapel(papel: Papel) {
    if (papel === "docente") return "/docente";
    if (papel === "preceptor" || papel === "directivo") return "/preceptoria";
    return "/dashboard";
}

// "5º 2ª"
export function nombreCurso(curso: Curso | null | undefined) {
    if (!curso) return "Sin curso";
    return `${curso.año}º ${curso.division}ª`;
}

const TURNOS = ["mañana", "tarde", "noche"];

export function turnoDe(curso: Curso | null | undefined) {
    if (!curso) return "";
    const t = curso.turno as unknown;
    if (typeof t === "number") return TURNOS[t] ?? "";
    const n = normalizar(String(t ?? ""));
    return TURNOS.find((x) => normalizar(x) === n) ?? String(t ?? "");
}

// "5º 2ª · Turno mañana"
export function cursoLargo(curso: Curso | null | undefined) {
    const turno = turnoDe(curso);
    return [nombreCurso(curso), turno && `Turno ${turno}`].filter(Boolean).join(" · ");
}

export function ordenarCursos(lista: Curso[]) {
    return [...lista].sort(
        (a, b) => Number(a.año) - Number(b.año) || Number(a.division) - Number(b.division)
    );
}
