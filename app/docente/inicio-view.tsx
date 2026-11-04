"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExclamationTriangleIcon, PlusIcon } from "@heroicons/react/24/outline";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import * as api from "@/app/lib/apiClient";
import { coma, fechaCorta, numero, ordinal } from "@/app/lib/format";
import { listarPeriodos, periodoActual } from "@/app/lib/periodos";
import type { BoletinResumen, PeriodoApi } from "@/app/lib/types";
import {
    Avatar,
    BTN_P,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    ROW,
    Stat,
    Vacio,
} from "@/app/components/ui";
import { datosDocente, type DatosDocente, type TareaDocente } from "./datos";
import SinMaterias from "@/app/components/sin-materias";

interface Extra {
    periodo: PeriodoApi | null;
    boletines: BoletinResumen[];
}

async function cargarExtra(datos: DatosDocente): Promise<Extra> {
    const periodos = await listarPeriodos(datos.ciclo);
    const periodo = periodoActual(periodos, datos.hoy);
    const cursos = [...new Set(datos.materias.map((m) => m.materia.idCurso))];

    const listas = await Promise.all(
        cursos.map((id) =>
            api.boletines.porCurso(id, datos.ciclo, periodo?.bimestre).catch(() => null)
        )
    );
    return { periodo, boletines: listas.flatMap((l) => l ?? []) };
}

function chipDe(tarea: TareaDocente) {
    if (tarea.sinCorregir === 0) return { tono: "verde" as const, texto: "Completa" };
    if (tarea.vence && tarea.vence.getTime() < Date.now())
        return { tono: "ambar" as const, texto: `${tarea.sinCorregir} sin corregir` };
    return { tono: "azul" as const, texto: `${tarea.sinCorregir} sin corregir` };
}

export default function InicioDocenteView() {
    const router = useRouter();
    const [datos, setDatos] = useState<DatosDocente | null>(null);
    const [extra, setExtra] = useState<Extra | null>(null);
    const [error, setError] = useState(false);

    const cargar = useCallback(() => {
        datosDocente()
            .then((d) => {
                setDatos(d);
                cargarExtra(d).then(setExtra).catch(() => setExtra({ periodo: null, boletines: [] }));
            })
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

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar tu panel. Revisá tu conexión e intentá de nuevo."
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
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Cargando key={i} className="h-24" />
                    ))}
                </div>
                <Cargando className="h-80" />
            </div>
        );
    }

    const porCorregir = datos.tareas
        .filter((t) => t.estado !== "programada" && t.entregadas > 0)
        .sort((a, b) => b.sinCorregir - a.sinCorregir)
        .slice(0, 5);

    const cargadas = extra ? extra.boletines.reduce((a, b) => a + b.notasCargadas, 0) : null;
    const total = extra ? extra.boletines.reduce((a, b) => a + b.materiasDelCurso, 0) : null;

    const enRiesgo = (extra?.boletines ?? [])
        .filter((b) => (b.promedio !== null && b.promedio !== undefined && b.promedio < 6) || b.materiasDesaprobadas > 0)
        .sort((a, b) => (a.promedio ?? 10) - (b.promedio ?? 10))
        .slice(0, 5);

    const nombrePila = datos.sesion.nombre.split(" ")[0];
    const hoyTexto = new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    }).format(datos.hoy);

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-sm capitalize text-neutral-500 dark:text-neutral-400">
                        {hoyTexto}
                        {extra?.periodo && ` · ${ordinal(extra.periodo.bimestre)} bimestre`}
                    </p>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Buen día, {nombrePila}
                    </h1>
                </div>
                <Link href="/docente/tareas/nueva" className={BTN_P}>
                    <PlusIcon className="h-5 w-5" />
                    Nueva tarea
                </Link>
            </header>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                    label="Entregas por corregir"
                    valor={datos.sinCorregir}
                    sub={`en ${datos.tareas.filter((t) => t.sinCorregir > 0).length} tareas`}
                />
                <Stat
                    label="Tareas activas"
                    valor={datos.activas}
                    sub={`${datos.tareas.filter((t) => t.estado === "programada").length} programadas`}
                />
                <Stat
                    label={extra?.periodo ? `Notas del ${ordinal(extra.periodo.bimestre)} bimestre` : "Notas del bimestre"}
                    valor={cargadas === null ? "…" : `${cargadas}/${total}`}
                    sub="cargadas en el boletín"
                    color="text-primary"
                />
                <Stat
                    label="Alumnos en riesgo"
                    valor={extra ? enRiesgo.length : "…"}
                    sub="promedio menor a 6"
                    color="text-amber-500"
                />
            </div>

            <div className="flex flex-wrap items-start gap-5">
                <section className={`${CARD} min-w-0 flex-[999_1_28rem] p-5`}>
                    <div className="mb-3.5 flex items-center justify-between gap-3">
                        <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                            Para corregir
                        </h2>
                        <Link href="/docente/tareas" className="text-sm text-primary hover:underline">
                            Ver todas
                        </Link>
                    </div>

                    {porCorregir.length === 0 ? (
                        <Vacio>Todavía no hay entregas para corregir.</Vacio>
                    ) : (
                        <div className="space-y-2.5">
                            {porCorregir.map((t) => {
                                const chip = chipDe(t);
                                return (
                                    <Link
                                        key={t.tarea.id}
                                        href={`/docente/tareas/${t.tarea.id}`}
                                        className={`${ROW} block p-3.5 transition-colors hover:border-primary/60`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                    {t.tarea.titulo}
                                                </p>
                                                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                                                    {t.materia} · {t.curso} ·{" "}
                                                    {t.vence ? `venció ${fechaCorta(t.vence)}` : "sin fecha"}
                                                </p>
                                            </div>
                                            <Chip tono={chip.tono}>{chip.texto}</Chip>
                                        </div>
                                        <div className="mt-3 flex items-center gap-3">
                                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                                <div
                                                    className="h-full bg-green-500"
                                                    style={{
                                                        width: `${t.entregadas ? Math.round((t.corregidas / t.entregadas) * 100) : 0}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className="whitespace-nowrap text-xs text-neutral-500 dark:text-neutral-400">
                                                {t.corregidas} de {t.entregadas} corregidas
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className={`${CARD} min-w-0 flex-[1_1_18rem] p-5`}>
                    <h2 className="mb-3.5 flex items-center gap-2 font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />
                        Necesitan atención
                    </h2>
                    <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
                        Según las notas del boletín y las inasistencias del bimestre
                    </p>
                    {!extra ? (
                        <Cargando className="h-40" />
                    ) : enRiesgo.length === 0 ? (
                        <Vacio>Ningún alumno de tus cursos está en riesgo.</Vacio>
                    ) : (
                        <ul className="space-y-2">
                            {enRiesgo.map((b) => (
                                <li key={b.idBoletin} className={`${ROW} flex items-center gap-3 p-3`}>
                                    <Avatar
                                        id={b.idAlumno}
                                        iniciales={`${b.nombre?.[0] ?? ""}${b.apellido?.[0] ?? ""}`.toUpperCase() || "?"}
                                    />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                            {b.apellido}, {b.nombre}
                                        </p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            Promedio {numero(b.promedio ?? null)}
                                            {b.materiasDesaprobadas > 0 &&
                                                ` · ${b.materiasDesaprobadas} desaprobadas`}
                                            {b.inasistenciasBimestre > 0 &&
                                                ` · ${coma(b.inasistenciasBimestre)} inasist.`}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className={`${CARD} p-5`}>
                <h2 className="mb-3.5 font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    Mis materias
                </h2>
                {datos.materias.length === 0 ? (
                    <SinMaterias />
                ) : (
                    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {datos.materias.map((m) => (
                            <Link
                                key={m.materia.id}
                                href={`/docente/materias?materia=${m.materia.id}`}
                                className={`${ROW} block p-3.5 transition-colors hover:border-primary/60`}
                            >
                                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                    {m.materia.nombre}
                                </p>
                                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                                    {m.cursoDetalle} · {m.alumnos.length} alumnos
                                </p>
                                <div className="mt-3 flex gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                                    <span>
                                        <strong className="text-sm text-neutral-900 dark:text-neutral-100">
                                            {m.promedio === null ? "—" : numero(m.promedio, 1)}
                                        </strong>{" "}
                                        promedio
                                    </span>
                                    <span>
                                        <strong className="text-sm text-neutral-900 dark:text-neutral-100">
                                            {m.activas}
                                        </strong>{" "}
                                        tareas activas
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
