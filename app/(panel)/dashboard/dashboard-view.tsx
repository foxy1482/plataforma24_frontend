"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowRightIcon,
    BookOpenIcon,
    CheckCircleIcon,
    ClockIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { notaNumerica, numero, promedio } from "@/app/lib/format";
import { nombreDe } from "@/app/lib/sesion";
import { CARD, Cargando, Chip, ErrorPanel, ROW, Stat, Vacio } from "@/app/components/ui";
import { cargarTareas, type TareasData } from "../tareas/cargar-tareas";
import {
    diasEntre,
    etiquetaVencimiento,
    formatoHoy,
    formatoLimite,
    tonoDe,
    type TareaItem,
} from "../tareas/tarea-utils";

const MAX_PROXIMAS = 5;
const MAX_NOTAS = 4;

function primerNombre(nombreCompleto: string) {
    const base = nombreCompleto.split(/[._@\s]+/)[0] ?? "";
    return base.charAt(0).toUpperCase() + base.slice(1);
}

const saludo = (hoy: Date) => {
    const h = hoy.getHours();
    return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
};

function Encabezado({ titulo, href, accion }: { titulo: string; href?: string; accion?: string }) {
    return (
        <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {titulo}
            </h2>
            {href && (
                <Link
                    href={href}
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                    {accion}
                    <ArrowRightIcon className="h-4 w-4" />
                </Link>
            )}
        </div>
    );
}

function FilaTarea({ tarea, hoy }: { tarea: TareaItem; hoy: Date }) {
    return (
        <Link
            href={`/tareas/${tarea.id}`}
            className={`${ROW} flex items-center justify-between gap-3 p-3.5 transition-colors hover:border-primary/60`}
        >
            <div className="min-w-0">
                <p className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
                    {tarea.titulo}
                </p>
                <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                    {tarea.materia} · {formatoLimite(tarea.fecha)}
                </p>
            </div>
            <Chip tono={tonoDe(tarea, hoy)}>{etiquetaVencimiento(tarea, hoy)}</Chip>
        </Link>
    );
}

export default function DashboardView() {
    const router = useRouter();
    const [data, setData] = useState<TareasData | null>(null);
    const [nombre, setNombre] = useState("");
    const [error, setError] = useState(false);

    const cargar = useCallback(() => {
        Promise.all([cargarTareas(), api.auth.getProfile().then((p) => nombreDe(p.id, p))])
            .then(([tareas, nombreCompleto]) => {
                setData(tareas);
                setNombre(primerNombre(nombreCompleto));
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

    const resumen = useMemo(() => {
        if (!data) return null;
        const { tareas, hoy } = data;
        const pendientes = tareas
            .filter((t) => !t.entrega)
            .sort((a, b) => (a.fecha?.getTime() ?? Infinity) - (b.fecha?.getTime() ?? Infinity));
        const vencidas = pendientes.filter((t) => t.fecha && diasEntre(hoy, t.fecha) < 0).length;
        const estaSemana = pendientes.filter((t) => {
            if (!t.fecha) return false;
            const d = diasEntre(hoy, t.fecha);
            return d >= 0 && d <= 7;
        }).length;
        const corregidas = tareas
            .filter((t) => notaNumerica(t.entrega?.calificacion) !== null)
            .sort((a, b) => (b.entrega?.fecha?.getTime() ?? 0) - (a.entrega?.fecha?.getTime() ?? 0));
        const notas = corregidas.map((t) => notaNumerica(t.entrega?.calificacion) as number);
        const pendientesPorMateria = new Map<number, number>();
        for (const t of pendientes) {
            pendientesPorMateria.set(t.idMateria, (pendientesPorMateria.get(t.idMateria) ?? 0) + 1);
        }
        return {
            pendientes,
            vencidas,
            estaSemana,
            entregadas: tareas.length - pendientes.length,
            corregidas,
            promedio: promedio(notas),
            pendientesPorMateria,
        };
    }, [data]);

    if (error) {
        return (
            <div className="mx-auto max-w-5xl">
                <ErrorPanel
                    mensaje="No pudimos cargar tu resumen. Revisá tu conexión e intentá de nuevo."
                    onReintentar={() => {
                        setError(false);
                        cargar();
                    }}
                />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-5xl space-y-8"
        >
            <header>
                <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    {data ? `${saludo(data.hoy)}, ${nombre}` : "Inicio"}
                </h1>
                {data ? (
                    <p className="mt-2 first-letter:uppercase text-neutral-500 dark:text-neutral-400">
                        {formatoHoy(data.hoy)}
                    </p>
                ) : (
                    <div className="mt-3 h-4 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                )}
            </header>

            {!data || !resumen ? (
                <>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => (
                            <Cargando key={i} className="h-24" />
                        ))}
                    </div>
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
                        <Cargando className="h-96" />
                        <Cargando className="h-96" />
                    </div>
                </>
            ) : data.idCurso === null ? (
                <Vacio>Todavía no tenés un curso asignado. Consultá en preceptoría.</Vacio>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <Stat
                            label="Tareas pendientes"
                            valor={resumen.pendientes.length}
                            sub={resumen.vencidas > 0 ? `${resumen.vencidas} vencida${resumen.vencidas === 1 ? "" : "s"}` : "Sin vencidas"}
                            color={resumen.vencidas > 0 ? "text-red-600 dark:text-red-400" : undefined}
                        />
                        <Stat
                            label="Vencen en 7 días"
                            valor={resumen.estaSemana}
                            color={resumen.estaSemana > 0 ? "text-amber-700 dark:text-amber-400" : undefined}
                        />
                        <Stat label="Entregadas" valor={resumen.entregadas} sub={`de ${data.tareas.length} tarea${data.tareas.length === 1 ? "" : "s"}`} />
                        <Stat
                            label="Promedio de tareas"
                            valor={numero(resumen.promedio, 1)}
                            sub={`${resumen.corregidas.length} corregida${resumen.corregidas.length === 1 ? "" : "s"}`}
                        />
                    </div>

                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
                        <div className="space-y-6">
                            <section className={`${CARD} p-5 sm:p-6`}>
                                <Encabezado titulo="Próximas entregas" href="/tareas" accion="Ver todas" />
                                {resumen.pendientes.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                                        <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                            No tenés tareas pendientes. ¡Vas al día!
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {resumen.pendientes.slice(0, MAX_PROXIMAS).map((t) => (
                                            <FilaTarea key={t.id} tarea={t} hoy={data.hoy} />
                                        ))}
                                        {resumen.pendientes.length > MAX_PROXIMAS && (
                                            <p className="pt-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
                                                y {resumen.pendientes.length - MAX_PROXIMAS} más en Tareas
                                            </p>
                                        )}
                                    </div>
                                )}
                            </section>

                            <section className={`${CARD} p-5 sm:p-6`}>
                                <Encabezado titulo="Últimas calificaciones" href="/calificaciones" accion="Boletín" />
                                {resumen.corregidas.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                        Todavía no tenés tareas corregidas.
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                        {resumen.corregidas.slice(0, MAX_NOTAS).map((t) => {
                                            const nota = notaNumerica(t.entrega?.calificacion) as number;
                                            return (
                                                <li key={t.id}>
                                                    <Link
                                                        href={`/tareas/${t.id}`}
                                                        className="flex items-center justify-between gap-4 py-3 hover:opacity-80"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
                                                                {t.titulo}
                                                            </p>
                                                            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                                                                {t.materia}
                                                            </p>
                                                        </div>
                                                        <span
                                                            className={`shrink-0 font-libertinus text-3xl font-bold ${
                                                                nota >= 6
                                                                    ? "text-neutral-900 dark:text-neutral-100"
                                                                    : "text-amber-700 dark:text-amber-400"
                                                            }`}
                                                        >
                                                            {nota}
                                                            <span className="ml-0.5 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                                                                /10
                                                            </span>
                                                        </span>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>
                        </div>

                        <section className={`${CARD} p-5 sm:p-6`}>
                            <Encabezado titulo="Mis materias" href="/materias" accion="Ver" />
                            {data.materias.length === 0 ? (
                                <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                    Tu curso todavía no tiene materias.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {data.materias.map((m) => {
                                        const n = resumen.pendientesPorMateria.get(m.id) ?? 0;
                                        return (
                                            <li key={m.id}>
                                                <Link
                                                    href={`/materias/${m.id}`}
                                                    className={`${ROW} flex min-h-12 items-center gap-3 p-3 transition-colors hover:border-primary/60`}
                                                >
                                                    <BookOpenIcon className="h-5 w-5 shrink-0 text-primary" />
                                                    <span className="min-w-0 flex-1 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                                                        {m.nombre}
                                                    </span>
                                                    {n > 0 && (
                                                        <Chip tono="azul">
                                                            <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                                            {n} {n === 1 ? "pendiente" : "pendientes"}
                                                        </Chip>
                                                    )}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </div>
                </>
            )}
        </motion.div>
    );
}
