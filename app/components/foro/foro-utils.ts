import { ApiError, mensajeDeError } from "@/app/lib/apiClient";
import { fechaCorta, nombreDeAlias, parseFecha } from "@/app/lib/format";
import { INPUT, type Tono } from "@/app/components/ui";

export const TITULO_MIN = 5;
export const TITULO_MAX = 120;
export const MENSAJE_MAX = 2000;
export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 300;

export const TEXTAREA = INPUT.replace("h-11 ", "min-h-28 py-2.5 ");

export interface ConfigForo {
    base: string;
    // Personal de la escuela: ve los debates de todos los cursos, elige dónde publicar y modera.
    personal: boolean;
    moderacionHref?: string;
}

// Roles que el backend trata como personal (profesor, autoridad, administradores y preceptor):
// pueden fijar y cerrar debates y eliminar mensajes ajenos.
export function esPersonalRol(idRol: number) {
    return idRol >= 2 && idRol <= 7;
}

// La API devuelve el nombre de usuario ("tomas.palavecino"): se muestra como nombre propio.
export function nombreAutor(autor?: string | null) {
    return nombreDeAlias(autor) || "Usuario";
}

export function tiempoRelativo(valor: string | null | undefined, ahora: Date = new Date()) {
    const fecha = parseFecha(valor);
    if (!fecha) return "—";
    const seg = Math.round((ahora.getTime() - fecha.getTime()) / 1000);
    if (seg < 60) return "recién";
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias === 1) return "ayer";
    if (dias < 7) return `hace ${dias} días`;
    return fechaCorta(fecha);
}

// Rol del autor para destacar a quienes no son alumnos (la API lo manda en minúscula).
export function etiquetaRol(rolAutor?: string | null): { texto: string; tono: Tono } | null {
    const rol = (rolAutor ?? "").toLowerCase();
    if (!rol || rol.startsWith("alumn")) return null;
    if (rol.startsWith("prof") || rol.startsWith("docen")) return { texto: "Docente", tono: "azul" };
    if (rol.startsWith("precept")) return { texto: "Preceptoría", tono: "teal" };
    return { texto: "Autoridad", tono: "violeta" };
}

// El filtro de palabras responde 422 con { detail, sugerencia }: se muestra el mensaje y la sugerencia.
export function sugerenciaDeError(error: unknown): string {
    if (!(error instanceof ApiError) || !error.body) return "";
    try {
        const json: unknown = JSON.parse(error.body);
        if (json && typeof json === "object") {
            const { sugerencia } = json as Record<string, unknown>;
            if (typeof sugerencia === "string") return sugerencia;
        }
    } catch {
        // El cuerpo no es JSON: no hay sugerencia.
    }
    return "";
}

export function textoDeFallo(error: unknown, alternativo: string) {
    const base = mensajeDeError(error, alternativo);
    const extra = sugerenciaDeError(error);
    return extra && !base.includes(extra) ? `${base} ${extra}` : base;
}

export function resumen(texto: string | undefined, largo = 110) {
    const limpio = (texto ?? "").replace(/\s+/g, " ").trim();
    return limpio.length > largo ? `${limpio.slice(0, largo - 1)}…` : limpio;
}
