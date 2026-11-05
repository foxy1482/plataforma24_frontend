"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export const CARD =
    "rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800";
export const ROW =
    "rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/60";
export const LABEL =
    "text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400";
export const INPUT =
    "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100";
export const BTN =
    "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_P = `${BTN} bg-primary text-white hover:bg-primary/90`;
export const BTN_G = `${BTN} border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-500`;
export const BTN_R = `${BTN} border border-red-300 bg-white text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950/40`;

export type Tono = "azul" | "verde" | "ambar" | "rojo" | "violeta" | "gris" | "teal";

export const TONOS: Record<Tono, string> = {
    azul: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    verde: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    ambar: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
    rojo: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    violeta: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    gris: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
};

export function Chip({ tono = "gris", children }: { tono?: Tono; children: React.ReactNode }) {
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold ${TONOS[tono]}`}
        >
            {children}
        </span>
    );
}

export function Stat({
    label,
    valor,
    sub,
    color = "text-neutral-900 dark:text-neutral-100",
}: {
    label: string;
    valor: React.ReactNode;
    sub?: React.ReactNode;
    color?: string;
}) {
    return (
        <div className={`${CARD} p-4`}>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
            <p className={`font-libertinus text-3xl font-bold ${color}`}>{valor}</p>
            {sub && <p className="text-xs text-neutral-500 dark:text-neutral-400">{sub}</p>}
        </div>
    );
}

export function Barra({ valor, total, color = "bg-primary" }: { valor: number; total: number; color?: string }) {
    const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0;
    return (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

export function Avatar({
    iniciales,
    id = 0,
    size = "h-9 w-9 text-xs",
}: {
    iniciales: string;
    id?: number;
    size?: string;
}) {
    const colores = [
        "bg-blue-700",
        "bg-fuchsia-700",
        "bg-green-700",
        "bg-orange-700",
        "bg-indigo-700",
        "bg-cyan-700",
        "bg-amber-700",
        "bg-rose-700",
    ];
    return (
        <span
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${size} ${colores[Math.abs(id) % colores.length]}`}
        >
            {iniciales}
        </span>
    );
}

export function Cargando({ className = "h-40" }: { className?: string }) {
    return <div className={`animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800 ${className}`} />;
}

export function ErrorPanel({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
    return (
        <div role="alert" className={`${CARD} flex flex-col items-center gap-3 p-10 text-center`}>
            <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />
            <p className="text-neutral-700 dark:text-neutral-300">{mensaje}</p>
            {onReintentar && (
                <button onClick={onReintentar} className={BTN_P}>
                    Reintentar
                </button>
            )}
        </div>
    );
}

export function Vacio({ children }: { children: React.ReactNode }) {
    return (
        <p className={`${CARD} p-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>{children}</p>
    );
}

export function Tabs<T extends string | number>({
    opciones,
    valor,
    onChange,
}: {
    opciones: { valor: T; label: string }[];
    valor: T;
    onChange: (v: T) => void;
}) {
    return (
        <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
            {opciones.map((o) => (
                <button
                    key={String(o.valor)}
                    type="button"
                    role="tab"
                    aria-selected={o.valor === valor}
                    onClick={() => onChange(o.valor)}
                    className={`h-10 rounded-lg px-3 text-xs font-semibold transition-colors sm:h-8 ${
                        o.valor === valor
                            ? "bg-primary text-white"
                            : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function Select({
    label,
    valor,
    onChange,
    children,
}: {
    label: string;
    valor: string | number;
    onChange: (v: string) => void;
    children: React.ReactNode;
}) {
    return (
        <label className="inline-flex items-center">
            <span className="sr-only">{label}</span>
            <select
                value={valor}
                onChange={(e) => onChange(e.target.value)}
                className={`${INPUT} h-10 w-auto max-w-[18rem] pr-8 font-medium`}
            >
                {children}
            </select>
        </label>
    );
}
