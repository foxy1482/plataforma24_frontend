    "use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowDownTrayIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import BimestreCard from "./bimestre-card";
import {
    cargarCalificaciones,
    cicloLectivo,
    describirCurso,
    type CalificacionesData,
} from "./cargar-calificaciones";
import {
    ESCALA_MAX,
    INASISTENCIAS_PERMITIDAS,
    NOTA_APROBACION,
    formatoNota,
    ordinal,
} from "./calificaciones-utils";

function Bloque({ className }: { className: string }) {
    return <div className={`animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800 ${className}`} />;
}

const TARJETA =
    "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800";
const ETIQUETA = "text-sm text-neutral-500 dark:text-neutral-400";
const NUMERO = "font-libertinus text-4xl font-bold";
const NUMERO_NEUTRO = "text-neutral-900 dark:text-neutral-100";
const NUMERO_VERDE = "text-green-500 dark:text-green-400";
const COMPLEMENTO = "ml-2 font-libertinus text-xl font-bold text-neutral-500 dark:text-neutral-400";

export default function CalificacionesView() {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [data, setData] = useState<CalificacionesData | null>(null);
    const [error, setError] = useState(false);
    const [imprimiendo, setImprimiendo] = useState(false);

    const cargar = useCallback(() => {
        cargarCalificaciones()
            .then(setData)
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login"); // sesión vencida o sin iniciar
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const reintentar = () => {
        setError(false);
        cargar();
    };

    // "Descargar boletín (PDF)": no hay endpoint ni librería de PDF, así que se abre el
    // diálogo de impresión del navegador (Guardar como PDF) con todo desplegado y en claro.
    const descargarPdf = () => {
        const temaPrevio = theme;
        setTheme("light");
        setImprimiendo(true);
        window.addEventListener(
            "afterprint",
            () => {
                setImprimiendo(false);
                if (temaPrevio) setTheme(temaPrevio);
            },
            { once: true }
        );
        setTimeout(() => window.print(), 250); // deja que React aplique el tema y expanda las tablas
    };

    const ciclo = data ? cicloLectivo(data.curso, data.hoy) : null;
    const cursoTexto = data ? describirCurso(data.curso) : "";

    // Por defecto quedan desplegados el último bimestre cerrado y los que siguen
    const ultimoCerrado = data ? data.bimestres.findLastIndex((b) => b.estado === "cerrado") : -1;

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Calificaciones
                    </h1>
                    {data ? (
                        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                            {[
                                `Boletín ${ciclo}`,
                                cursoTexto,
                                `Escala de 1 a ${ESCALA_MAX}, se aprueba con ${NOTA_APROBACION}`,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                    ) : (
                        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                    )}
                </div>
                <button
                    onClick={descargarPdf}
                    disabled={!data}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 print:hidden"
                >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Descargar boletín (PDF)
                </button>
            </header>

            {error ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-800">
                    <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />
                    <p className="text-neutral-700 dark:text-neutral-300">
                        No pudimos cargar tus calificaciones. Revisá tu conexión e intentá de nuevo.
                    </p>
                    <button
                        onClick={reintentar}
                        className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                    >
                        Reintentar
                    </button>
                </div>
            ) : !data ? (
                <>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Bloque className="h-28" />
                        <Bloque className="h-28" />
                        <Bloque className="h-28" />
                    </div>
                    <div className="grid items-start gap-4 lg:grid-cols-2">
                        <Bloque className="h-24" />
                        <Bloque className="h-24" />
                        <Bloque className="h-96" />
                        <Bloque className="h-96" />
                    </div>
                </>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className={TARJETA}>
                            <p className={ETIQUETA}>
                                Promedio anual
                                {data.bimestresCerrados > 0 &&
                                    ` (${data.bimestresCerrados === 1 ? "1º" : `1º a ${data.bimestresCerrados}º`} bimestre)`}
                            </p>
                            <p className={`mt-1 ${NUMERO} ${NUMERO_NEUTRO}`}>
                                {data.promedioAnual === null ? "—" : formatoNota(data.promedioAnual)}
                            </p>
                        </div>

                        <div className={TARJETA}>
                            <p className={ETIQUETA}>
                                Materias aprobadas
                                {data.aprobadas && ` · ${ordinal(data.aprobadas.bimestre)} bimestre`}
                            </p>
                            <p className="mt-1">
                                <span className={`${NUMERO} ${data.aprobadas ? NUMERO_VERDE : NUMERO_NEUTRO}`}>
                                    {data.aprobadas ? data.aprobadas.cantidad : "—"}
                                </span>
                                {data.aprobadas && <span className={COMPLEMENTO}>de {data.aprobadas.total}</span>}
                            </p>
                        </div>

                        <div className={TARJETA}>
                            <p className={ETIQUETA}>Inasistencias acumuladas</p>
                            <p className="mt-1">
                                <span className={`${NUMERO} ${NUMERO_NEUTRO}`}>{data.inasistencias ?? "—"}</span>
                                <span className={COMPLEMENTO}>de {INASISTENCIAS_PERMITIDAS} permitidas</span>
                            </p>
                        </div>
                    </div>

                    {data.bimestres.every((b) => b.filas.length === 0) ? (
                        <p className={`${TARJETA} text-center text-neutral-500 dark:text-neutral-400`}>
                            Todavía no tenés materias cargadas.
                        </p>
                    ) : (
                        <div className="grid items-start gap-4 lg:grid-cols-2">
                            {data.bimestres.map((bimestre, i) => (
                                <BimestreCard
                                    key={bimestre.numero}
                                    bimestre={bimestre}
                                    abiertoInicial={i >= Math.max(ultimoCerrado, 0) && bimestre.estado !== "proximo"}
                                    forzarAbierto={imprimiendo}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}