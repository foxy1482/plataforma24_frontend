"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import {
    TONO_CLASES,
    TONO_PUNTO,
    celdasDelMes,
    claveDia,
    formatoMes,
    mismoDia,
    tonoDe,
    type TareaItem,
} from "./tarea-utils";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const BOTON =
    "flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-700";

export default function Calendario({ tareas, hoy }: { tareas: TareaItem[]; hoy: Date }) {
    const [{ anio, mes }, setMes] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() });

    const celdas = useMemo(() => celdasDelMes(anio, mes), [anio, mes]);

    const porDia = useMemo(() => {
        const mapa = new Map<string, TareaItem[]>();
        for (const tarea of tareas) {
            if (!tarea.fecha) continue;
            const clave = claveDia(tarea.fecha);
            mapa.set(clave, [...(mapa.get(clave) ?? []), tarea]);
        }
        return mapa;
    }, [tareas]);

    const hayVencidas = tareas.some((t) => tonoDe(t, hoy) === "rojo");

    // new Date(anio, mes ± 1) normaliza solo el cambio de año
    const irA = (delta: number) => {
        const fecha = new Date(anio, mes + delta, 1);
        setMes({ anio: fecha.getFullYear(), mes: fecha.getMonth() });
    };

    return (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-3 font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    <CalendarDaysIcon className="h-6 w-6 shrink-0 text-primary" />
                    {formatoMes(anio, mes)}
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => irA(-1)} aria-label="Mes anterior" className={`${BOTON} w-10`}>
                        <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setMes({ anio: hoy.getFullYear(), mes: hoy.getMonth() })}
                        className={`${BOTON} px-4`}
                    >
                        Hoy
                    </button>
                    <button onClick={() => irA(1)} aria-label="Mes siguiente" className={`${BOTON} w-10`}>
                        <ChevronRightIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-1 sm:gap-2">
                {DIAS.map((dia) => (
                    <div
                        key={dia}
                        className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500 sm:text-xs dark:text-neutral-400"
                    >
                        {dia}
                    </div>
                ))}

                {celdas.map((fecha) => {
                    const fueraDelMes = fecha.getMonth() !== mes;
                    const esHoy = mismoDia(fecha, hoy);
                    const delDia = porDia.get(claveDia(fecha)) ?? [];

                    return (
                        <div
                            key={fecha.getTime()}
                            className={`min-h-14 rounded-xl border-2 p-1 sm:min-h-[5.5rem] sm:p-2 ${
                                esHoy
                                    ? "border-primary bg-primary/10"
                                    : fueraDelMes
                                      ? "border-transparent bg-neutral-50 dark:bg-neutral-800/60"
                                      : "border-transparent bg-neutral-100 dark:bg-neutral-900"
                            }`}
                        >
                            <span
                                className={
                                    esHoy
                                        ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white sm:h-7 sm:w-7 sm:text-sm"
                                        : `text-xs font-semibold sm:text-sm ${
                                              fueraDelMes
                                                  ? "text-neutral-400 dark:text-neutral-600"
                                                  : "text-neutral-800 dark:text-neutral-100"
                                          }`
                                }
                            >
                                {fecha.getDate()}
                            </span>

                            {/* Celular: solo puntos de color. Desde sm: etiquetas con el título. */}
                            <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                                {delDia.map((t) => (
                                    <span
                                        key={t.id}
                                        className={`h-1.5 w-1.5 rounded-full ${TONO_PUNTO[tonoDe(t, hoy)]}`}
                                    />
                                ))}
                            </div>
                            <div className="mt-1 hidden space-y-1 sm:block">
                                {delDia.map((t) => (
                                    <Link
                                        key={t.id}
                                        href={`/tareas/${t.id}`}
                                        title={`${t.titulo} — ${t.materia}`}
                                        className={`block line-clamp-2 rounded-md px-1.5 py-1 text-xs font-medium leading-tight transition-opacity hover:opacity-80 ${TONO_CLASES[tonoDe(t, hoy)]}`}
                                    >
                                        {t.tituloCorto}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                <Leyenda tono="ambar" texto="Vence esta semana" />
                <Leyenda tono="azul" texto="Pendiente" />
                <Leyenda tono="verde" texto="Entregada" />
                {hayVencidas && <Leyenda tono="rojo" texto="Vencida" />}
            </ul>
        </section>
    );
}

function Leyenda({ tono, texto }: { tono: keyof typeof TONO_PUNTO; texto: string }) {
    return (
        <li className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-[4px] ${TONO_PUNTO[tono]}`} />
            {texto}
        </li>
    );
}