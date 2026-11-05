"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import {
    formatoNota,
    type BimestreVista,
    type EstadoBimestre,
    type EstadoMateria,
} from "./calificaciones-utils";

const ETIQUETA_BIMESTRE: Record<EstadoBimestre, { texto: string; clase: string }> = {
    cerrado: {
        texto: "Cerrado",
        clase: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300",
    },
    "en-curso": {
        texto: "En curso",
        clase: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    },
    proximo: {
        texto: "Próximo",
        clase: "bg-neutral-200 text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-400",
    },
};

const ETIQUETA_MATERIA: Record<EstadoMateria, { texto: string; clase: string }> = {
    aprobada: {
        texto: "Aprobada",
        clase: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    },
    desaprobada: {
        texto: "Desaprobada",
        clase: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    },
    "sin-cargar": {
        texto: "Sin cargar",
        clase: "bg-neutral-200 text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300",
    },
};

export default function BimestreCard({
    bimestre,
    abiertoInicial,
    forzarAbierto,
}: {
    bimestre: BimestreVista;
    abiertoInicial: boolean;
    forzarAbierto: boolean; // se usa al imprimir: el PDF lleva todo desplegado
}) {
    const [abierto, setAbierto] = useState(abiertoInicial);
    const visible = abierto || forzarAbierto;
    const etiqueta = ETIQUETA_BIMESTRE[bimestre.estado];
    const Chevron = visible ? ChevronUpIcon : ChevronDownIcon;
    const idTabla = `bimestre-${bimestre.numero}`;

    return (
        <section className="break-inside-avoid rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
            <button
                onClick={() => setAbierto(!abierto)}
                aria-expanded={visible}
                aria-controls={idTabla}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl p-5 text-left"
            >
                <div>
                    <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {bimestre.titulo}
                    </h2>
                    <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{bimestre.rango}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${etiqueta.clase}`}>
                        {etiqueta.texto}
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                        Prom.{" "}
                        <strong
                            className="text-lg font-bold text-neutral-900 dark:text-neutral-100"
                            title={bimestre.estado === "en-curso" ? "Promedio parcial" : undefined}
                        >
                            {bimestre.promedio === null ? "—" : formatoNota(bimestre.promedio)}
                            {bimestre.estado === "en-curso" && bimestre.promedio !== null && "*"}
                        </strong>
                    </span>
                    <Chevron className="h-5 w-5 text-neutral-500 dark:text-neutral-400 print:hidden" />
                </div>
            </button>

            {visible && (
                <div id={idTabla} className="px-5 pb-5">
                    {bimestre.filas.length === 0 ? (
                        <p className="rounded-xl bg-neutral-100 p-5 text-center text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                            {bimestre.estado === "proximo"
                                ? "Este bimestre todavía no empezó."
                                : "Todavía no hay notas cargadas en este bimestre."}
                        </p>
                    ) : (
                    <div className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-neutral-200/70 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:bg-neutral-800/70 dark:text-neutral-400">
                                    <th className="px-4 py-3">Materia</th>
                                    <th className="w-14 px-1 py-3 text-center sm:w-20">Nota</th>
                                    <th className="w-28 px-3 py-3 sm:w-36">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                                {bimestre.filas.map((fila) => {
                                    const estado = ETIQUETA_MATERIA[fila.estado];
                                    return (
                                        <tr key={fila.id}>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold leading-snug text-neutral-900 dark:text-neutral-100">
                                                    {fila.nombre}
                                                </p>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                    {fila.docente}
                                                </p>
                                            </td>
                                            <td className="px-1 py-3 text-center font-libertinus text-lg font-bold text-neutral-900 dark:text-neutral-100">
                                                {fila.nota ?? <span className="text-neutral-400 dark:text-neutral-600">—</span>}
                                            </td>
                                            <td className="px-3 py-3">
                                                <span
                                                    className={`inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium sm:text-sm ${estado.clase}`}
                                                >
                                                    {estado.texto}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>
            )}
        </section>
    );
}