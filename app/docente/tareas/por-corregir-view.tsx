"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { fechaCorta } from "@/app/lib/format";
import { CARD, Cargando, Chip, ErrorPanel, ROW, Vacio } from "@/app/components/ui";
import { datosDocente, type DatosDocente } from "../datos";

export default function PorCorregirView() {
    const router = useRouter();
    const [datos, setDatos] = useState<DatosDocente | null>(null);
    const [error, setError] = useState(false);

    const cargar = useCallback(() => {
        datosDocente()
            .then(setDatos)
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
                mensaje="No pudimos cargar tus tareas."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }
    if (!datos) return <Cargando className="h-96" />;

    const pendientes = datos.tareas
        .filter((t) => t.sinCorregir > 0)
        .sort((a, b) => (a.vence?.getTime() ?? 0) - (b.vence?.getTime() ?? 0));

    return (
        <div className="mx-auto max-w-4xl space-y-5">
            <header>
                <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Por corregir
                </h1>
                <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                    {datos.sinCorregir === 0
                        ? "No tenés entregas esperando corrección."
                        : `${datos.sinCorregir} ${datos.sinCorregir === 1 ? "entrega" : "entregas"} en ${pendientes.length} ${pendientes.length === 1 ? "tarea" : "tareas"}`}
                </p>
            </header>

            {pendientes.length === 0 ? (
                <Vacio>Estás al día con las correcciones.</Vacio>
            ) : (
                <section className={`${CARD} space-y-2.5 p-5`}>
                    {pendientes.map((t) => (
                        <Link
                            key={t.tarea.id}
                            href={`/docente/tareas/${t.tarea.id}`}
                            className={`${ROW} block p-4 transition-colors hover:border-primary/60`}
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                        {t.tarea.titulo}
                                    </p>
                                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                                        {t.materia} · {t.curso} ·{" "}
                                        {t.vence
                                            ? `${t.estado === "abierta" ? "vence" : "venció"} ${fechaCorta(t.vence)}`
                                            : "sin fecha"}
                                    </p>
                                </div>
                                <Chip tono={t.estado === "abierta" ? "azul" : "ambar"}>
                                    {t.sinCorregir} sin corregir
                                </Chip>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                    <div
                                        className="h-full bg-green-500"
                                        style={{
                                            width: `${t.entregadas ? (t.corregidas / t.entregadas) * 100 : 0}%`,
                                        }}
                                    />
                                </div>
                                <span className="whitespace-nowrap text-xs text-neutral-500 dark:text-neutral-400">
                                    {t.corregidas} de {t.entregadas} corregidas
                                </span>
                            </div>
                        </Link>
                    ))}
                </section>
            )}
        </div>
    );
}
