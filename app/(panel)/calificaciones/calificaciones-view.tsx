    "use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { ErrorPanel } from "@/app/components/ui";
import { coma, INASISTENCIAS_POR_BIMESTRE } from "@/app/lib/format";
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
                    router.replace("/login");
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
                <ErrorPanel
                    mensaje="No pudimos cargar tus calificaciones. Revisá tu conexión e intentá de nuevo."
                    onReintentar={reintentar}
                />
            ) : !data ? (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Bloque className="h-28" />
                        <Bloque className="h-28" />
                        <Bloque className="h-28" />
                    </div>
                    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                        <Bloque className="h-24" />
                        <Bloque className="h-24" />
                        <Bloque className="h-96" />
                        <Bloque className="h-96" />
                    </div>
                </>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                                <span
                                    className={`${NUMERO} ${
                                        data.inasistencias !== null && data.inasistencias >= INASISTENCIAS_PERMITIDAS * 0.7
                                            ? "text-red-600 dark:text-red-400"
                                            : NUMERO_NEUTRO
                                    }`}
                                >
                                    {data.inasistencias === null ? "—" : coma(data.inasistencias)}
                                </span>
                                <span className={COMPLEMENTO}>de {INASISTENCIAS_PERMITIDAS} permitidas</span>
                            </p>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {data.inasistencias === null
                                    ? "Todavía no hay asistencia registrada."
                                    : `Te ${Math.max(0, INASISTENCIAS_PERMITIDAS - data.inasistencias) === 1 ? "queda" : "quedan"} ${coma(Math.max(0, INASISTENCIAS_PERMITIDAS - data.inasistencias))} · ${INASISTENCIAS_POR_BIMESTRE} por bimestre · la llegada tarde cuenta ½`}
                            </p>
                        </div>
                    </div>

                    {data.bimestres.every((b) => b.filas.length === 0) ? (
                        <p className={`${TARJETA} text-center text-neutral-500 dark:text-neutral-400`}>
                            Todavía no tenés materias cargadas.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
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
                    {data.bimestres.some((b) => b.estado === "en-curso" && b.promedio !== null) && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            * Promedio parcial: el bimestre en curso todavía puede cambiar.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}