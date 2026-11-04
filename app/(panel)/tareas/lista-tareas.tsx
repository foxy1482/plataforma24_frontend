"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarIcon, CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import {
    TONO_CLASES,
    etiquetaVencimiento,
    formatoLimite,
    tonoDe,
    type TareaItem,
} from "./tarea-utils";

type Pestana = "pendientes" | "entregadas";

const TARJETA =
    "block rounded-xl bg-neutral-100 p-4 transition-colors hover:bg-neutral-200/70 dark:bg-neutral-900 dark:hover:bg-neutral-900/70";

const PORCION_VACIA = "rounded-xl bg-neutral-100 p-8 text-center text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400";

function porFechaAscendente(a: TareaItem, b: TareaItem) {
    return (a.fecha?.getTime() ?? Infinity) - (b.fecha?.getTime() ?? Infinity);
}

function porEntregaReciente(a: TareaItem, b: TareaItem) {
    return (b.entrega?.fecha?.getTime() ?? 0) - (a.entrega?.fecha?.getTime() ?? 0);
}

export default function ListaTareas({ tareas, hoy }: { tareas: TareaItem[]; hoy: Date }) {
    const [pestana, setPestana] = useState<Pestana>("pendientes");

    const pendientes = useMemo(
        () => tareas.filter((t) => !t.entrega).sort(porFechaAscendente),
        [tareas]
    );
    const entregadas = useMemo(
        () => tareas.filter((t) => t.entrega).sort(porEntregaReciente),
        [tareas]
    );

    const visibles = pestana === "pendientes" ? pendientes : entregadas;
    const ultimaEntrega = entregadas[0];

    return (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6 dark:border-neutral-700 dark:bg-neutral-800">
            <h2 className="flex items-center gap-3 font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                <ClockIcon className="h-6 w-6 shrink-0 text-primary" />
                Mis Tareas
            </h2>

            <div
                role="tablist"
                className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-900"
            >
                {(["pendientes", "entregadas"] as const).map((id) => {
                    const activa = pestana === id;
                    const cantidad = id === "pendientes" ? pendientes.length : entregadas.length;
                    return (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={activa}
                            onClick={() => setPestana(id)}
                            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                                activa
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                            }`}
                        >
                            {id === "pendientes" ? "Pendientes" : "Entregadas"} ({cantidad})
                        </button>
                    );
                })}
            </div>

            <div className="mt-5 space-y-3">
                {visibles.length === 0 ? (
                    <p className={PORCION_VACIA}>
                        {pestana === "pendientes"
                            ? "No tenés tareas pendientes. ¡Vas al día!"
                            : "Todavía no entregaste ninguna tarea."}
                    </p>
                ) : (
                    visibles.map((tarea) => (
                        <TarjetaTarea key={tarea.id} tarea={tarea} hoy={hoy} />
                    ))
                )}
            </div>

            {pestana === "pendientes" && ultimaEntrega && (
                <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-700">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Última entrega
                    </h3>
                    <div className="mt-3">
                        <TarjetaTarea tarea={ultimaEntrega} hoy={hoy} resumida />
                    </div>
                </div>
            )}
        </section>
    );
}

function TarjetaTarea({
    tarea,
    hoy,
    resumida = false,
}: {
    tarea: TareaItem;
    hoy: Date;
    resumida?: boolean; // la "última entrega" no muestra la fecha límite
}) {
    const tono = tonoDe(tarea, hoy);
    const entregada = tarea.entrega !== null;

    return (
        <Link href={`/tareas/${tarea.id}`} className={TARJETA}>
            <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-base font-bold leading-snug text-neutral-900 dark:text-neutral-100">
                    {tarea.titulo}
                </h3>
                <span
                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${TONO_CLASES[tono]}`}
                >
                    {entregada && <CheckCircleIcon className="h-4 w-4" />}
                    {entregada
                        ? tarea.entrega?.calificacion
                            ? `Nota: ${tarea.entrega.calificacion}`
                            : "Entregada"
                        : etiquetaVencimiento(tarea, hoy)}
                </span>
            </div>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{tarea.materia}</p>
            {!resumida && (
                <p className="mt-3 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    {formatoLimite(tarea.fecha)}
                </p>
            )}
        </Link>
    );
}