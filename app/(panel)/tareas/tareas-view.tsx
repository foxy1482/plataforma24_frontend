"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { ErrorPanel } from "@/app/components/ui";
import { cargarTareas, type TareasData } from "./cargar-tareas";
import { formatoHoy } from "./tarea-utils";
import Calendario from "./calendario";
import ListaTareas from "./lista-tareas";

function Bloque({ className }: { className: string }) {
    return <div className={`animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800 ${className}`} />;
}

function describir({ hoy, tareas }: TareasData) {
    const delMes = tareas.filter(
        (t) =>
            !t.entrega &&
            t.fecha &&
            t.fecha.getMonth() === hoy.getMonth() &&
            t.fecha.getFullYear() === hoy.getFullYear()
    ).length;

    const vencidas = tareas.filter(
        (t) => !t.entrega && t.fecha && t.fecha.getTime() < hoy.getTime()
    ).length;

    const pendientes =
        delMes === 0
            ? "No tenés entregas pendientes este mes"
            : `Tenés ${delMes} ${delMes === 1 ? "entrega pendiente" : "entregas pendientes"} este mes`;
    const atrasadas =
        vencidas > 0 ? ` · ${vencidas} ${vencidas === 1 ? "vencida sin entregar" : "vencidas sin entregar"}` : "";
    return `${pendientes}${atrasadas} · Hoy es ${formatoHoy(hoy)}`;
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
                <ErrorPanel
                    mensaje="No pudimos cargar tus tareas. Revisá tu conexión e intentá de nuevo."
                    onReintentar={reintentar}
                />
            ) : !data ? (
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
                    <Bloque className="h-[34rem]" />
                    <Bloque className="h-[34rem]" />
                </div>
            ) : (
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
                    <div className="order-2 lg:order-1">
                        <Calendario tareas={data.tareas} hoy={data.hoy} />
                    </div>
                    <div className="order-1 lg:order-2">
                        <ListaTareas tareas={data.tareas} hoy={data.hoy} />
                    </div>
                </div>
            )}
        </div>
    );
}