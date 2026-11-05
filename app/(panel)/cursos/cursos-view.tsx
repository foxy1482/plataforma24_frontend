"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { CARD, Cargando, ErrorPanel, INPUT, Vacio } from "@/app/components/ui";
import { cargarCursos, coincide, type CursosData } from "./cargar-cursos";
import DivisionCard from "./division-card";

export default function CursosView() {
    const router = useRouter();
    const [data, setData] = useState<CursosData | null>(null);
    const [error, setError] = useState(false);
    const [busqueda, setBusqueda] = useState("");
    const [abiertos, setAbiertos] = useState<number[]>([]);

    const cargar = useCallback(() => {
        cargarCursos()
            .then((d) => {
                setData(d);
                const propio = d.anios.find((a) =>
                    a.divisiones.some((x) => x.curso.id === d.idCursoPropio)
                );
                setAbiertos(propio ? [propio.anio] : d.anios.slice(0, 1).map((a) => a.anio));
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

    const visibles = useMemo(() => {
        if (!data) return [];
        return data.anios
            .map((anio) => ({
                ...anio,
                divisiones: anio.divisiones.filter((d) => coincide(d, anio, busqueda)),
            }))
            .filter((anio) => anio.divisiones.length > 0);
    }, [data, busqueda]);

    const buscando = busqueda.trim().length > 0;
    const alternar = (anio: number) =>
        setAbiertos((prev) => (prev.includes(anio) ? prev.filter((a) => a !== anio) : [...prev, anio]));

    return (
        <div className="mx-auto max-w-4xl space-y-8">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Cursos
                    </h1>
                    {data ? (
                        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                            Ciclo lectivo {data.cicloLectivo} · {data.anios.length} años ·{" "}
                            {data.totalDivisiones} divisiones
                        </p>
                    ) : (
                        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                    )}
                </div>

                <label className="relative block w-full sm:w-64">
                    <span className="sr-only">Buscar división</span>
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar división (ej. 5º 2ª)"
                        className={`${INPUT} pl-10`}
                    />
                </label>
            </header>

            {error ? (
                <ErrorPanel
                    mensaje="No pudimos cargar los cursos. Revisá tu conexión e intentá de nuevo."
                    onReintentar={() => {
                        setError(false);
                        cargar();
                    }}
                />
            ) : !data ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Cargando key={i} className="h-20" />
                    ))}
                </div>
            ) : visibles.length === 0 ? (
                <Vacio>
                    {buscando
                        ? `Ninguna división coincide con "${busqueda}".`
                        : "Todavía no hay cursos cargados."}
                </Vacio>
            ) : (
                <div className="space-y-3.5">
                    {visibles.map((anio) => {
                        const abierto = buscando || abiertos.includes(anio.anio);
                        return (
                            <section key={anio.anio} className={`${CARD} overflow-hidden`}>
                                <button
                                    onClick={() => alternar(anio.anio)}
                                    aria-expanded={abierto}
                                    className="flex min-h-11 w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
                                >
                                    <span className="flex items-center gap-4">
                                        <span
                                            aria-hidden="true"
                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-libertinus text-xl font-bold text-primary dark:bg-primary/20"
                                        >
                                            {anio.anio}º
                                        </span>
                                        <span>
                                            <span className="block font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                                {anio.nombre}
                                            </span>
                                            <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                                                {anio.ciclo} · {anio.divisiones.length}{" "}
                                                {anio.divisiones.length === 1 ? "división" : "divisiones"}
                                            </span>
                                        </span>
                                    </span>
                                    <ChevronDownIcon
                                        className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${abierto ? "rotate-180" : ""}`}
                                    />
                                </button>

                                {abierto && (
                                    <div className="grid grid-cols-1 gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-5">
                                        {anio.divisiones.map((d) => (
                                            <DivisionCard key={d.curso.id} division={d} />
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
