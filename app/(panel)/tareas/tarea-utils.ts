// Tipos y helpers puros de la página de Tareas (sin React, fáciles de probar).

export interface EntregaItem {
    fecha: Date | null;
    calificacion: string | null;
}

export interface TareaItem {
    id: number;
    titulo: string;
    tituloCorto: string; // "TP N°3" (para las etiquetas del calendario)
    idMateria: number;
    materia: string;
    fecha: Date | null; // fecha límite
    entrega: EntregaItem | null;
}

export type Tono = "ambar" | "azul" | "verde" | "rojo";

// Fechas de la API: "2026-05-30T13:22:55.803255" (sin zona, hasta 6 decimales).
// Se recortan los decimales (Safari no acepta más de 3) y una fecha sin hora
// se toma al final del día, en hora local.
export function parseFecha(valor: unknown): Date | null {
    if (typeof valor !== "string" || !valor) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const [a, m, d] = valor.split("-").map(Number);
        return new Date(a, m - 1, d, 23, 59);
    }
    const fecha = new Date(valor.replace(/(\.\d{3})\d+/, "$1"));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function inicioDia(fecha: Date) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

export function mismoDia(a: Date, b: Date) {
    return inicioDia(a).getTime() === inicioDia(b).getTime();
}

// Días de calendario entre dos fechas (hasta - desde); negativo si ya pasó.
export function diasEntre(desde: Date, hasta: Date) {
    return Math.round((inicioDia(hasta).getTime() - inicioDia(desde).getTime()) / 86_400_000);
}

export function tonoDe(tarea: TareaItem, hoy: Date): Tono {
    if (tarea.entrega) return "verde";
    if (!tarea.fecha) return "azul";
    const dias = diasEntre(hoy, tarea.fecha);
    if (dias < 0) return "rojo";
    return dias <= 7 ? "ambar" : "azul"; // ámbar = vence esta semana
}

export function etiquetaVencimiento(tarea: TareaItem, hoy: Date) {
    if (!tarea.fecha) return "Sin fecha";
    const dias = diasEntre(hoy, tarea.fecha);
    if (dias < 0) return dias === -1 ? "Venció ayer" : `Venció hace ${-dias} días`;
    if (dias === 0) return "Vence hoy";
    if (dias === 1) return "Vence mañana";
    return dias <= 7 ? `Vence en ${dias} días` : `En ${dias} días`;
}

// "Miércoles 21/10 · 23:59"
export function formatoLimite(fecha: Date | null) {
    if (!fecha) return "Sin fecha límite";
    const dia = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(fecha);
    const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1);
    const dd = String(fecha.getDate()).padStart(2, "0");
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const hh = String(fecha.getHours()).padStart(2, "0");
    const min = String(fecha.getMinutes()).padStart(2, "0");
    return `${diaCap} ${dd}/${mm} · ${hh}:${min}`;
}

// "lunes 19 de octubre"
export function formatoHoy(hoy: Date) {
    const partes = new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    }).formatToParts(hoy);
    const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
    return `${valor("weekday")} ${valor("day")} de ${valor("month")}`;
}

// "Octubre 2026"
export function formatoMes(anio: number, mes: number) {
    const nombre = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(new Date(anio, mes, 1));
    return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

// "TP N°3 – Herencia y polimorfismo" -> "TP N°3"
export function tituloCorto(titulo: string) {
    const corto = titulo.split(/\s[–—-]\s|:\s/)[0].trim();
    return corto.length >= 3 ? corto : titulo;
}

// Semanas completas (lunes a domingo) que cubren el mes. mes = 0..11
export function celdasDelMes(anio: number, mes: number): Date[] {
    const offset = (new Date(anio, mes, 1).getDay() + 6) % 7; // lunes = 0
    const diasMes = new Date(anio, mes + 1, 0).getDate();
    const total = Math.ceil((offset + diasMes) / 7) * 7;
    return Array.from({ length: total }, (_, i) => new Date(anio, mes, i - offset + 1));
}

export const claveDia = (fecha: Date) =>
    `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;

// Colores compartidos por etiquetas del calendario, badges y leyenda.
export const TONO_CLASES: Record<Tono, string> = {
    ambar: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
    azul: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    verde: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    rojo: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

export const TONO_PUNTO: Record<Tono, string> = {
    ambar: "bg-amber-400",
    azul: "bg-blue-400",
    verde: "bg-green-400",
    rojo: "bg-red-400",
};