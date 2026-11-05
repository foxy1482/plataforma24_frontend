"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRightIcon, FolderOpenIcon } from "@heroicons/react/24/outline";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { fechaCorta } from "@/app/lib/format";
import { ArchivoChip } from "@/app/components/visor-archivos";
import ContactoDocente from "@/app/components/contacto-docente";
import { CARD, Cargando, Chip, ErrorPanel, ROW } from "@/app/components/ui";
import { cargarMaterialDetalle, MaterialNoDisponible, type MaterialDetalle } from "./cargar-material";

type Resultado =
    | { id: number; estado: "listo"; valor: MaterialDetalle }
    | { id: number; estado: "no-disponible" | "error" };

export default function MaterialView() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const idMaterial = Number(id);

    // Atado al id pedido: al pasar de un material a otro no se ve el anterior (ni su error) mientras carga.
    const [resultado, setResultado] = useState<Resultado | null>(null);
    const actual = resultado?.id === idMaterial ? resultado : null;
    const estado = !idMaterial ? "no-disponible" : (actual?.estado ?? "cargando");
    const detalle = actual?.estado === "listo" ? actual.valor : null;

    const cargar = useCallback(() => {
        cargarMaterialDetalle(idMaterial)
            .then((valor) => setResultado({ id: idMaterial, estado: "listo", valor }))
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                if (e instanceof MaterialNoDisponible || (e instanceof ApiError && e.status === 404)) {
                    setResultado({ id: idMaterial, estado: "no-disponible" });
                    return;
                }
                registrarError(e);
                setResultado({ id: idMaterial, estado: "error" });
            });
    }, [idMaterial, router]);

    useEffect(() => {
        if (idMaterial) cargar();
    }, [idMaterial, cargar]);

    const reintentar = () => {
        setResultado(null);
        cargar();
    };
    if (estado === "no-disponible") {
        return (
            <div className="mx-auto max-w-4xl space-y-4">
                <ErrorPanel mensaje="No encontramos ese material, o todavía no está disponible." />
                <p className="text-center">
                    <Link href="/materias" className="text-sm text-primary hover:underline">
                        Volver a mis materias
                    </Link>
                </p>
            </div>
        );
    }

    if (estado === "error") {
        return (
            <div className="mx-auto max-w-4xl">
                <ErrorPanel mensaje="No pudimos cargar el material. Revisá tu conexión e intentá de nuevo." onReintentar={reintentar} />
            </div>
        );
    }

    if (!detalle) {
        return (
            <div className="mx-auto max-w-4xl space-y-4">
                <Cargando className="h-6 w-64" />
                <Cargando className="h-40" />
                <Cargando className="h-56" />
            </div>
        );
    }

    const { material, materia, docente } = detalle;

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href="/materias" className="hover:underline">
                    Materias
                </Link>
                {" / "}
                <Link href={`/materias/${materia.id}`} className="hover:underline">
                    {materia.nombre}
                </Link>
                {" / "}
                <span className="text-neutral-700 dark:text-neutral-300">Material</span>
            </nav>

            <header className="flex items-start gap-4">
                <div className="rounded-2xl bg-primary/10 p-3.5 text-primary">
                    <FolderOpenIcon className="h-8 w-8" />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="font-libertinus text-4xl font-bold leading-tight tracking-tight text-neutral-900 dark:text-neutral-100">
                        {material.titulo || "Sin título"}
                    </h1>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
                        <span>{materia.nombre}</span>
                        <span aria-hidden="true">·</span>
                        <span>{docente.nombre}</span>
                        {detalle.publicado && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span>Publicado el {fechaCorta(detalle.publicado)}</span>
                            </>
                        )}
                        {detalle.nuevo && <Chip tono="verde">Nuevo</Chip>}
                    </p>
                </div>
            </header>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="space-y-6">
                    {material.descripcion && (
                        <section className={`${CARD} p-5 sm:p-6`}>
                            <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                Descripción
                            </h2>
                            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-neutral-700 dark:text-neutral-300">
                                {material.descripcion}
                            </p>
                        </section>
                    )}

                    <section className={`${CARD} p-5 sm:p-6`}>
                        <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                            Archivos
                        </h2>
                        {!detalle.archivosOk ? (
                            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                                No pudimos cargar los archivos de este material.{" "}
                                <button type="button" onClick={reintentar} className="underline">
                                    Reintentar
                                </button>
                            </p>
                        ) : detalle.archivos.length === 0 ? (
                            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                                Este material no tiene archivos adjuntos.
                            </p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {detalle.archivos.map((a) => (
                                    <ArchivoChip key={a.id} archivo={a} bloque />
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            ¿Dudas sobre este material?
                        </h2>
                        <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                            Escribile a {docente.nombre}.
                        </p>
                        <div className="mt-3">
                            <ContactoDocente
                                email={docente.email}
                                docente={docente.nombre}
                                materia={`${materia.nombre} (${material.titulo || "material"})`}
                                alumno={detalle.alumno}
                            />
                            {!docente.email && (
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                    El docente no tiene un correo cargado.
                                </p>
                            )}
                        </div>
                    </section>

                    {detalle.otros.length > 0 && (
                        <section className={`${CARD} p-5`}>
                            <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                Más material de {materia.nombre}
                            </h2>
                            <ul className="mt-3 space-y-2">
                                {detalle.otros.map((o) => (
                                    <li key={o.id}>
                                        <Link
                                            href={`/material/${o.id}`}
                                            className={`${ROW} flex min-h-11 items-center justify-between gap-3 p-3 transition-colors hover:border-primary/60`}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                                    {o.titulo || "Sin título"}
                                                </span>
                                                {o.publicado && (
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                                        {fechaCorta(o.publicado)}
                                                    </span>
                                                )}
                                            </span>
                                            <ChevronRightIcon className="h-4 w-4 shrink-0 text-neutral-400" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </aside>
            </div>
        </div>
    );
}
