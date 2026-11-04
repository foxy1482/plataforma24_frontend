"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExclamationTriangleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { leer, normalizar } from "@/app/lib/format";
import type { Curso } from "@/app/lib/types";
import { cargarMaterias, type MateriasData } from "./cargar-materias";
import MateriaCard from "./materia-card";

const TURNOS: Record<string, string> = { manana: "mañana", tarde: "tarde", noche: "noche" };

function describirCurso(curso: Curso | null) {
    if (!curso) return "Todavía no tenés un curso asignado";
    // Nombres de campo sin confirmar: se prueban las variantes más probables.
    const anio = leer(curso, "año", "anio", "ano", "year");
    const division = leer(curso, "division");
    const turnoCrudo = leer<string>(curso, "turno");
    const ciclo = leer(curso, "cicloLectivo", "ciclo_lectivo", "ciclo");
    const partes = [
        anio && `${anio}º año`,
        division && `${division}ª división`,
        turnoCrudo && `Turno ${TURNOS[normalizar(String(turnoCrudo))] ?? turnoCrudo}`,
        ciclo && `Ciclo lectivo ${ciclo}`,
    ].filter(Boolean);
    return partes.length ? partes.join(" · ") : "Tu curso";
}

function SkeletonCard() {
    return <div className="h-36 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />;
}

export default function MateriasView() {
    const router = useRouter();
    const [data, setData] = useState<MateriasData | null>(null);
    const [error, setError] = useState(false);
    const [busqueda, setBusqueda] = useState("");

    const cargar = useCallback(() => {
        cargarMaterias()
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

    const visibles = useMemo(() => {
        if (!data) return [];
        const q = normalizar(busqueda.trim());
        if (!q) return data.materias;
        return data.materias.filter(
            (m) => normalizar(m.nombre).includes(q) || normalizar(m.docente.nombre).includes(q)
        );
    }, [data, busqueda]);

    return (
        <div className="mx-auto max-w-4xl space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Mis Materias
                    </h1>
                    {data ? (
                        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                            {describirCurso(data.curso)}
                        </p>
                    ) : (
                        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                    )}
                </div>

                <label className="relative block w-full sm:w-64">
                    <span className="sr-only">Buscar materia o docente</span>
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar materia o docente"
                        className="h-10 w-full rounded-2xl border border-neutral-300 bg-white pl-10 pr-4 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                </label>
            </header>

            {error ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-800">
                    <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />
                    <p className="text-neutral-700 dark:text-neutral-300">
                        No pudimos cargar tus materias. Revisá tu conexión e intentá de nuevo.
                    </p>
                    <button
                        onClick={reintentar}
                        className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                    >
                        Reintentar
                    </button>
                </div>
            ) : !data ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            ) : data.materias.length === 0 ? (
                <p className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                    Todavía no tenés materias cargadas.
                </p>
            ) : visibles.length === 0 ? (
                <p className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                    Ninguna materia ni docente coincide con &quot;{busqueda}&quot;.
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibles.map((materia) => (
                        <MateriaCard key={materia.id} materia={materia} />
                    ))}
                </div>
            )}
        </div>
    );
}
