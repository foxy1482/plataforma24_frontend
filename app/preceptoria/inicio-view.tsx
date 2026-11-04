"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowRightIcon,
    CheckCircleIcon,
    ChatBubbleLeftRightIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { alumnosDeCurso } from "@/app/lib/alumnos";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { coma, isoFecha, INASISTENCIAS_PERMITIDAS, ordinal } from "@/app/lib/format";
import { periodoActual } from "@/app/lib/periodos";
import { cursoLargo, nombreCurso } from "@/app/lib/sesion";
import type { Curso, EstadoAsistencia } from "@/app/lib/types";
import {
    Avatar,
    BTN_G,
    BTN_P,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    ROW,
    Vacio,
} from "@/app/components/ui";
import { datosPreceptoria, type DatosPreceptoria } from "./datos";

const CURSOS_EN_TABLERO = 3;

interface Hoy {
    curso: Curso;
    idAsistencia: number | null;
    cerrada: boolean;
    conteo: Record<EstadoAsistencia, number>;
    total: number;
}

interface Riesgo {
    idAlumno: number;
    nombre: string;
    curso: string;
    iniciales: string;
    total: number;
}

interface Avance {
    curso: Curso;
    cargadas: number;
    total: number;
}

export default function InicioPreceptoriaView() {
    const router = useRouter();
    const [datos, setDatos] = useState<DatosPreceptoria | null>(null);
    const [hoy, setHoy] = useState<Hoy[] | null>(null);
    const [riesgo, setRiesgo] = useState<Riesgo[] | null>(null);
    const [avance, setAvance] = useState<Avance[] | null>(null);
    const [reportes, setReportes] = useState<number | null>(null);
    const [error, setError] = useState(false);

    const cargar = useCallback(() => {
        datosPreceptoria()
            .then(async (d) => {
                setDatos(d);
                const cursos = d.cursos.slice(0, CURSOS_EN_TABLERO);
                const fecha = isoFecha(d.hoy);

                const planillas = await Promise.all(
                    cursos.map((c) => api.asistencias.delCurso(c.id, fecha).catch(() => null))
                );
                setHoy(
                    cursos.map((curso, i): Hoy => {
                        const hoja = planillas[i];
                        const detalle = hoja?.detalle ?? [];
                        const conteo: Record<EstadoAsistencia, number> = {
                            presente: 0,
                            ausente: 0,
                            tarde: 0,
                            justificado: 0,
                        };
                        for (const d2 of detalle) conteo[d2.estado] = (conteo[d2.estado] ?? 0) + 1;
                        return {
                            curso,
                            idAsistencia: hoja?.id ?? null,
                            cerrada: hoja?.cerrada ?? false,
                            conteo,
                            total: detalle.length,
                        };
                    })
                );

                const periodo = periodoActual(d.periodos, d.hoy);
                const boletines = await Promise.all(
                    cursos.map((c) =>
                        api.boletines.porCurso(c.id, d.ciclo, periodo?.bimestre).catch(() => null)
                    )
                );
                setAvance(
                    cursos.map((curso, i): Avance => {
                        const lista = boletines[i] ?? [];
                        return {
                            curso,
                            cargadas: lista.reduce((a, b) => a + b.notasCargadas, 0),
                            total: lista.reduce((a, b) => a + b.materiasDelCurso, 0),
                        };
                    })
                );

                // Las inasistencias del año se piden por alumno: se cargan al final.
                const alumnosPorCurso = await Promise.all(
                    cursos.map((c) => alumnosDeCurso(c.id).catch(() => null))
                );
                const todos = cursos.flatMap((curso, i) =>
                    (alumnosPorCurso[i] ?? []).map((a) => ({ curso, alumno: a }))
                );
                const resumenes = await Promise.all(
                    todos.map(({ alumno }) =>
                        api.asistencias.resumenAlumno(alumno.idUsuario, d.ciclo).catch(() => null)
                    )
                );
                setRiesgo(
                    todos
                        .map(({ curso, alumno }, i): Riesgo => {
                            const anual = resumenes[i]?.anuales?.find((x) => x.cicloLectivo === d.ciclo);
                            return {
                                idAlumno: alumno.idUsuario,
                                nombre: `${alumno.nombre} ${alumno.apellido}`,
                                curso: nombreCurso(curso),
                                iniciales: `${alumno.nombre?.[0] ?? ""}${alumno.apellido?.[0] ?? ""}`.toUpperCase(),
                                total: anual ? anual.totalInasistencias : 0,
                            };
                        })
                        .filter((r) => r.total >= INASISTENCIAS_PERMITIDAS / 2)
                        .sort((a, b) => b.total - a.total)
                        .slice(0, 6)
                );
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });

        api.foro
            .reportes(true)
            .then((l) => setReportes((l ?? []).filter((r) => !r.resuelto).length))
            .catch(() => setReportes(null));
    }, [router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar el panel de preceptoría."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }
    if (!datos) {
        return (
            <div className="space-y-4">
                <Cargando className="h-20" />
                <Cargando className="h-48" />
                <Cargando className="h-64" />
            </div>
        );
    }

    const nombrePila = datos.sesion.nombre.split(" ")[0];
    const fechaTexto = new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    }).format(datos.hoy);
    const periodo = periodoActual(datos.periodos, datos.hoy);

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header>
                <p className="text-sm capitalize text-neutral-500 dark:text-neutral-400">{fechaTexto}</p>
                <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Buen día, {nombrePila}
                </h1>
            </header>

            <section>
                <h2 className="mb-3 font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    Asistencia de hoy
                </h2>
                {!hoy ? (
                    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Cargando key={i} className="h-44" />
                        ))}
                    </div>
                ) : hoy.length === 0 ? (
                    <Vacio>No hay cursos cargados todavía.</Vacio>
                ) : (
                    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                        {hoy.map((h) => {
                            const tomada = h.total > 0;
                            return (
                                <div
                                    key={h.curso.id}
                                    className={`${CARD} p-4 ${!h.cerrada ? "border-teal-400 dark:border-teal-800" : ""}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                            {nombreCurso(h.curso)}
                                        </span>
                                        {h.cerrada ? (
                                            <Chip tono="verde">
                                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                                Cerrada
                                            </Chip>
                                        ) : (
                                            <Chip tono="ambar">Pendiente</Chip>
                                        )}
                                    </div>
                                    <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300">
                                        {tomada
                                            ? `${h.conteo.presente} presentes · ${h.conteo.ausente} ausentes · ${h.conteo.tarde} tarde`
                                            : cursoLargo(h.curso)}
                                    </p>
                                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                        {tomada && (
                                            <>
                                                <div
                                                    className="bg-teal-500"
                                                    style={{ width: `${(h.conteo.presente / h.total) * 100}%` }}
                                                />
                                                <div
                                                    className="bg-amber-400"
                                                    style={{ width: `${(h.conteo.tarde / h.total) * 100}%` }}
                                                />
                                                <div
                                                    className="bg-red-400"
                                                    style={{ width: `${(h.conteo.ausente / h.total) * 100}%` }}
                                                />
                                            </>
                                        )}
                                    </div>
                                    <Link
                                        href={`/preceptoria/lista?curso=${h.curso.id}`}
                                        className={`${h.cerrada ? BTN_G : BTN_P} mt-3.5 h-10 w-full`}
                                    >
                                        {h.cerrada ? "Ver planilla" : "Tomar lista"}
                                        {!h.cerrada && <ArrowRightIcon className="h-5 w-5" />}
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <div className="flex flex-wrap items-start gap-5">
                <section className={`${CARD} min-w-0 flex-[999_1_28rem] p-5`}>
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2 font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                            <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />
                            Cerca del límite de inasistencias
                        </h2>
                        <Link
                            href="/preceptoria/asistencia"
                            className="whitespace-nowrap text-sm text-primary hover:underline"
                        >
                            Ver todos
                        </Link>
                    </div>
                    <p className="mt-1 mb-3.5 text-xs text-neutral-500 dark:text-neutral-400">
                        Límite anual: {INASISTENCIAS_PERMITIDAS} inasistencias · llegada tarde = ½ falta
                    </p>

                    {!riesgo ? (
                        <Cargando className="h-40" />
                    ) : riesgo.length === 0 ? (
                        <Vacio>Ningún alumno de tus cursos está cerca del límite.</Vacio>
                    ) : (
                        <div className="space-y-2.5">
                            {riesgo.map((r) => {
                                const alto = r.total >= INASISTENCIAS_PERMITIDAS * 0.7;
                                return (
                                    <div
                                        key={r.idAlumno}
                                        className={`${ROW} flex flex-wrap items-center gap-3.5 p-3`}
                                    >
                                        <Avatar id={r.idAlumno} iniciales={r.iniciales} />
                                        <div className="min-w-0 flex-[1_1_11rem]">
                                            <Link
                                                href={`/preceptoria/legajos/${r.idAlumno}`}
                                                className="text-sm font-semibold text-neutral-900 hover:text-primary dark:text-neutral-100"
                                            >
                                                {r.nombre}
                                            </Link>
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                                {" "}
                                                · {r.curso}
                                            </span>
                                            <div className="mt-1.5 flex items-center gap-2.5">
                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                                    <div
                                                        className={alto ? "h-full bg-red-500" : "h-full bg-amber-500"}
                                                        style={{
                                                            width: `${Math.min(100, (r.total / INASISTENCIAS_PERMITIDAS) * 100)}%`,
                                                        }}
                                                    />
                                                </div>
                                                <span
                                                    className={`whitespace-nowrap text-xs font-semibold ${alto ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
                                                >
                                                    {coma(r.total)} / {INASISTENCIAS_PERMITIDAS}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <div className="min-w-0 flex-[1_1_18rem] space-y-5">
                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Boletines del {periodo ? ordinal(periodo.bimestre) : ""} bimestre
                        </h2>
                        <p className="mt-1 mb-3.5 text-xs text-neutral-500 dark:text-neutral-400">
                            Notas cargadas por los docentes
                        </p>
                        {!avance ? (
                            <Cargando className="h-28" />
                        ) : (
                            <div className="space-y-3">
                                {avance.map((a) => {
                                    const pct = a.total > 0 ? Math.round((a.cargadas / a.total) * 100) : 0;
                                    return (
                                        <div key={a.curso.id}>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-neutral-900 dark:text-neutral-100">
                                                    {nombreCurso(a.curso)}
                                                </span>
                                                <span className="text-neutral-500 dark:text-neutral-400">
                                                    {a.total === 0 ? "sin generar" : `${pct}%`}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                                <div className="h-full bg-teal-500" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <Link href="/preceptoria/boletines" className={`${BTN_G} mt-4 h-10 w-full`}>
                            Ir a boletines
                        </Link>
                    </section>

                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Foro:{" "}
                            {reportes === null
                                ? "reportes"
                                : `${reportes} ${reportes === 1 ? "reporte" : "reportes"}`}
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                            {reportes === 0
                                ? "No hay mensajes reportados esperando revisión."
                                : "Mensajes reportados por alumnos esperan tu revisión."}
                        </p>
                        <Link href="/preceptoria/moderacion" className={`${BTN_G} mt-3.5 h-10 w-full`}>
                            <ChatBubbleLeftRightIcon className="h-5 w-5" />
                            Revisar reportes
                        </Link>
                    </section>
                </div>
            </div>
        </div>
    );
}
