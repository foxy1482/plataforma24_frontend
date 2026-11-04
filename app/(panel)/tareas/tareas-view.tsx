"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { cargarTareas, type TareasData } from "./cargar-tareas";
import { formatoHoy } from "./tarea-utils";
import Calendario from "./calendario";
import ListaTareas from "./lista-tareas";

function Bloque({ className }: { className: string }) {
    return <div className={`animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800 ${className}`} />;
}

function describir({ hoy, tareas }: TareasData) {
    // Pendientes cuyo vencimiento cae en el mes actual
    const delMes = tareas.filter(
        (t) =>
            !t.entrega &&
            t.fecha &&
            t.fecha.getMonth() === hoy.getMonth() &&
            t.fecha.getFullYear() === hoy.getFullYear()
    ).length;

    const pendientes =
        delMes === 0
            ? "No tenés entregas pendientes este mes"
            : `Tenés ${delMes} ${delMes === 1 ? "entrega pendiente" : "entregas pendientes"} este mes`;
    return `${pendientes} · Hoy es ${formatoHoy(hoy)}`;
}

export default function TareasView() {
    const router = useRouter();
    const [data, setData] = useState<TareasData | null>(null);
    const [error, setError] = useState(false);

    const cargar = useCallback(() => {
        cargarTareas()
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

    return (
        <div className="mx-auto max-w-5xl space-y-8">
            <header>
                <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Tareas
                </h1>
                {data ? (
                    <p className="mt-2 text-neutral-500 dark:text-neutral-400">{describir(data)}</p>
                ) : (
                    <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                )}
            </header>

            {error ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-800">
                    <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />
                    <p className="text-neutral-700 dark:text-neutral-300">
                        No pudimos cargar tus tareas. Revisá tu conexión e intentá de nuevo.
                    </p>
                    <button
                        onClick={reintentar}
                        className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                    >
                        Reintentar
                    </button>
                </div>
            ) : !data ? (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
                    <Bloque className="h-[34rem]" />
                    <Bloque className="h-[34rem]" />
                </div>
            ) : (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
                    <Calendario tareas={data.tareas} hoy={data.hoy} />
                    <ListaTareas tareas={data.tareas} hoy={data.hoy} />
                </div>
            )}
        </div>
    );
}