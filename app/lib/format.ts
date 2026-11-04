export function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export function inicialesDe(nombre?: string, apellido?: string) {
    return `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase();
}

// Para búsquedas: sin tildes ni mayúsculas.
export function normalizar(texto: string) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

// Lee el primer campo que exista entre varias claves posibles (camelCase / snake_case),
// para tolerar contratos de API todavía no confirmados.
export function leer<T = string | number>(
    obj: object | null | undefined,
    ...claves: string[]
): T | undefined {
    if (!obj) return undefined;
    const fila = obj as Record<string, unknown>;
    for (const clave of claves) {
        const valor = fila[clave];
        if (valor !== undefined && valor !== null && valor !== "") return valor as T;
    }
    return undefined;
}

// Fecha-hora local ("2026-12-01T23:59:00" o Date) a UTC con "Z".
// El backend interpreta como UTC cualquier fecha sin zona; se manda siempre con "Z" para que
// no dependa de esa regla. Al leer, la API devuelve UTC con "Z" y parseFecha la pasa a hora local.
export function aUtc(local: string | Date) {
    const f = typeof local === "string" ? new Date(local) : local;
    return f.toISOString();
}

// "2026-10-28" en hora local, como lo esperan los endpoints con ?fecha=
export function isoFecha(fecha: Date) {
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const dd = String(fecha.getDate()).padStart(2, "0");
    return `${fecha.getFullYear()}-${mm}-${dd}`;
}

// "mié 28/10"
export function fechaCorta(valor: string | Date | null | undefined) {
    if (!valor) return "—";
    const f = typeof valor === "string" ? new Date(valor.replace(/(\.\d{3})\d+/, "$1")) : valor;
    if (Number.isNaN(f.getTime())) return "—";
    const dia = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(f).replace(".", "");
    return `${dia} ${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}`;
}

// "mié 28/10 · 18:31"
export function fechaHora(valor: string | Date | null | undefined) {
    if (!valor) return "—";
    const f = typeof valor === "string" ? new Date(valor.replace(/(\.\d{3})\d+/, "$1")) : valor;
    if (Number.isNaN(f.getTime())) return "—";
    const hh = String(f.getHours()).padStart(2, "0");
    const mm = String(f.getMinutes()).padStart(2, "0");
    return `${fechaCorta(f)} · ${hh}:${mm}`;
}

// 8.1666 -> "8,17" ; null -> "—"
export function numero(valor: number | null | undefined, decimales = 2) {
    if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
    return valor.toFixed(decimales).replace(".", ",");
}

// 22.5 -> "22,5"
export function coma(valor: number | null | undefined) {
    if (valor === null || valor === undefined) return "—";
    return String(Math.round(valor * 10) / 10).replace(".", ",");
}

export const ESCALA_MAX = 10;
export const NOTA_APROBACION = 6;
// Reglamento: 21 inasistencias por año (límite anual) y 5 por bimestre. La llegada tarde cuenta ½.
export const INASISTENCIAS_PERMITIDAS = 21;
export const INASISTENCIAS_POR_BIMESTRE = 5;

const PALABRAS = ["uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];

// "10 (diez)" -> 10 ; "8,5" -> 8.5 ; "Aprobado" -> null
export function notaNumerica(calificacion: string | number | null | undefined): number | null {
    if (calificacion === null || calificacion === undefined || calificacion === "") return null;
    if (typeof calificacion === "number") {
        return calificacion >= 1 && calificacion <= ESCALA_MAX ? calificacion : null;
    }
    const m = calificacion.match(/^\s*(\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const n = parseFloat(m[1].replace(",", "."));
    return n >= 1 && n <= ESCALA_MAX ? n : null;
}

// 8 -> "8 (ocho)", como se guarda la calificación de una entrega
export function notaTexto(nota: number) {
    return `${nota} (${PALABRAS[nota - 1] ?? nota})`;
}

export const promedio = (valores: number[]) =>
    valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;

const ORDINALES = ["1er", "2do", "3er", "4to", "5to", "6to"];

export function ordinal(numero: number) {
    return ORDINALES[numero - 1] ?? `${numero}º`;
}

// Fechas de la API: "2026-05-30T13:22:55.803Z". Una fecha sin hora
// se toma al final del día, en hora local.
export function parseFecha(valor: unknown): Date | null {
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
    if (typeof valor !== "string" || !valor) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const [a, m, d] = valor.split("-").map(Number);
        return new Date(a, m - 1, d, 23, 59);
    }
    const fecha = new Date(valor.replace(/(\.\d{3})\d+/, "$1"));
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function diasEntre(desde: Date, hasta: Date) {
    const dia = (f: Date) => new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
    return Math.round((dia(hasta) - dia(desde)) / 86_400_000);
}

export function edadDe(fechaNacimiento: string | undefined) {
    const f = parseFecha(fechaNacimiento);
    if (!f) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - f.getFullYear();
    const mes = hoy.getMonth() - f.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < f.getDate())) edad--;
    return edad;
}
