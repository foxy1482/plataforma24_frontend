"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    ArrowUpTrayIcon,
    CheckCircleIcon,
    ClockIcon,
    DocumentIcon,
    ExclamationTriangleIcon,
    PaperAirplaneIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { mensajeDeError, tareas, tareaArchivos, entregas, entregaArchivos, archivos, materias, auth, registrarError } from "@/app/lib/apiClient";
import { ArchivoChip } from "@/app/components/visor-archivos";
import { BTN_P, CARD, Cargando, Chip, ErrorPanel, LABEL, ROW } from "@/app/components/ui";
import { fechaHora, notaNumerica, notaTexto } from "@/app/lib/format";
import type { Tarea, Archivo, Entrega } from "@/app/lib/types";
import { etiquetaVencimiento, formatoLimite, parseFecha, tonoDe, type TareaItem } from "../tarea-utils";

function peso(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export default function TareaDetailPage() {
    const params = useParams();
    const tareaId = Number(params.id);
    const selector = useRef<HTMLInputElement>(null);

    const [tarea, setTarea] = useState<Tarea | null>(null);
    const [nombreMateria, setNombreMateria] = useState("");
    const [adjuntos, setAdjuntos] = useState<Archivo[]>([]);
    const [entrega, setEntrega] = useState<Entrega | null>(null);
    const [archivosEntrega, setArchivosEntrega] = useState<Archivo[]>([]);
    const [loading, setLoading] = useState(true);
    const [fallo, setFallo] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [archivoEntrega, setArchivoEntrega] = useState<File | null>(null);

    useEffect(() => {
        if (!tareaId) return;
        let activo = true;

        (async () => {
            try {
                setLoading(true);
                setFallo(false);
                const perfil = await auth.getProfile();
                const [tareaData, archivosData, misEntregas] = await Promise.all([
                    tareas.porNumero(tareaId),
                    tareaArchivos.porTarea(tareaId).catch(() => null),
                    entregas.porAlumno(perfil.id).catch(() => null),
                ]);
                const materia = await materias.porNumero(tareaData.idMateria).catch(() => null);
                const hecha = (misEntregas ?? []).find((e) => e.idTarea === tareaId) ?? null;
                const deEntrega = hecha
                    ? ((await entregaArchivos.porEntrega(hecha.id).catch(() => null)) ?? [])
                    : [];
                if (!activo) return;
                setTarea(tareaData);
                setNombreMateria(materia?.nombre ?? "");
                setAdjuntos(archivosData ?? []);
                setEntrega(hecha);
                setArchivosEntrega(deEntrega);
            } catch (err) {
                registrarError("Error al cargar la tarea:", err);
                if (activo) setFallo(true);
            } finally {
                if (activo) setLoading(false);
            }
        })();

        return () => {
            activo = false;
        };
    }, [tareaId]);

    const handleEntregaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // La entrega es única y no se puede modificar: se avisa antes de enviarla sin archivo.
        if (
            !archivoEntrega &&
            !window.confirm(
                "No adjuntaste ningún archivo. Después de entregar no vas a poder modificar la entrega. ¿Entregar igual?"
            )
        ) {
            return;
        }
        setSubmitting(true);
        setError(null);
        setAviso(null);

        try {
            // Primero se sube el archivo: el backend admite una sola entrega por tarea, así que si la
            // subida fallara después de crearla, el alumno no podría volver a entregar.
            const subido = archivoEntrega ? await archivos.subir(archivoEntrega) : null;
            const nueva = await entregas.crear({ idTarea: tareaId });
            setEntrega(nueva);
            setAviso("¡Entrega realizada con éxito!");
            setArchivoEntrega(null);

            if (subido) {
                try {
                    await entregaArchivos.vincular({ idEntrega: nueva.id, idArchivo: subido.id });
                    setArchivosEntrega([subido]);
                } catch (err) {
                    registrarError("Error al adjuntar el archivo a la entrega:", err);
                    setAviso(null);
                    setError(
                        "La entrega se registró, pero no se pudo adjuntar el archivo. Avisale a tu docente."
                    );
                }
            }
        } catch (err: unknown) {
            registrarError("Error al realizar la entrega:", err);
            setError(mensajeDeError(err, "Ocurrió un error al enviar la entrega. Intentá nuevamente."));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-6">
                <Cargando className="h-28" />
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <Cargando className="h-80" />
                    <Cargando className="h-80" />
                </div>
            </div>
        );
    }

    if (fallo || !tarea) {
        return (
            <div className="mx-auto max-w-5xl">
                <ErrorPanel mensaje="No se pudo cargar la información de la tarea." />
            </div>
        );
    }

    const limite = parseFecha(tarea.fechaEntrega);
    const hoy = new Date();
    const vencida = limite !== null && limite.getTime() < hoy.getTime();
    const item: TareaItem = {
        id: tarea.id,
        idMateria: tarea.idMateria,
        titulo: tarea.titulo,
        tituloCorto: tarea.titulo,
        materia: nombreMateria,
        fecha: limite,
        entrega: entrega
            ? { fecha: parseFecha(entrega.fechaEntrega), calificacion: entrega.calificacion ?? null }
            : null,
    };
    const hechaEn = entrega ? parseFecha(entrega.fechaEntrega) : null;
    const entregadaTarde = Boolean(limite && hechaEn && hechaEn.getTime() > limite.getTime());
    const nota = notaNumerica(entrega?.calificacion);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-5xl space-y-6"
        >
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href="/tareas" className="hover:underline">
                    Tareas
                </Link>
                {nombreMateria && (
                    <>
                        {" / "}
                        <Link href={`/materias/${tarea.idMateria}`} className="hover:underline">
                            {nombreMateria}
                        </Link>
                    </>
                )}
            </nav>

            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="font-libertinus text-4xl font-bold leading-tight tracking-tight text-neutral-900 dark:text-neutral-100">
                        {tarea.titulo}
                    </h1>
                    <p className="mt-2 flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                        <ClockIcon className="h-5 w-5 shrink-0" />
                        {limite ? `Vence ${formatoLimite(limite).toLowerCase()}` : "Sin fecha límite"}
                    </p>
                </div>
                {entrega ? (
                    <Chip tono={entregadaTarde ? "ambar" : "verde"}>
                        {entregadaTarde ? "Entregada fuera de término" : "Entregada"}
                    </Chip>
                ) : (
                    <Chip tono={tonoDe(item, hoy)}>{etiquetaVencimiento(item, hoy)}</Chip>
                )}
            </header>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <section className={`${CARD} p-5 sm:p-6`}>
                    <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        Consigna
                    </h2>
                    <p className="mt-3 whitespace-pre-wrap leading-relaxed text-neutral-700 dark:text-neutral-300">
                        {tarea.descripcion || "Sin descripción detallada."}
                    </p>

                    {adjuntos.length > 0 && (
                        <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-700">
                            <h3 className={`${LABEL} mb-3`}>Archivos de la tarea</h3>
                            <div className="space-y-2">
                                {adjuntos.map((archivo) => (
                                    <ArchivoChip key={archivo.id} archivo={archivo} bloque />
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <aside className={`${CARD} p-5 sm:p-6 lg:sticky lg:top-24`}>
                    <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        Tu entrega
                    </h2>

                    {aviso && (
                        <div
                            role="status"
                            className="mt-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
                        >
                            <CheckCircleIcon className="h-5 w-5 shrink-0" /> {aviso}
                        </div>
                    )}
                    {error && (
                        <div
                            role="alert"
                            className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                        >
                            <ExclamationTriangleIcon className="h-5 w-5 shrink-0" /> {error}
                        </div>
                    )}

                    {entrega ? (
                        <div className="mt-4 space-y-4">
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                Entregada el {fechaHora(entrega.fechaEntrega)}
                            </p>

                            {archivosEntrega.length > 0 && (
                                <div className="space-y-2">
                                    {archivosEntrega.map((archivo) => (
                                        <ArchivoChip key={archivo.id} archivo={archivo} bloque />
                                    ))}
                                </div>
                            )}

                            {entrega.calificacion ? (
                                <div className={`${ROW} p-4`}>
                                    <p className={LABEL}>Calificación</p>
                                    {nota !== null ? (
                                        <div className="mt-1 flex items-end justify-between gap-3">
                                            <p
                                                className={`font-libertinus text-5xl font-bold leading-none ${
                                                    nota >= 6
                                                        ? "text-neutral-900 dark:text-neutral-100"
                                                        : "text-amber-600 dark:text-amber-400"
                                                }`}
                                            >
                                                {nota}
                                                <span className="ml-1 text-lg font-semibold text-neutral-500 dark:text-neutral-400">
                                                    / 10
                                                </span>
                                            </p>
                                            <Chip tono={nota >= 6 ? "verde" : "ambar"}>
                                                {nota >= 6 ? "Aprobada" : "Desaprobada"}
                                            </Chip>
                                        </div>
                                    ) : (
                                        <p className="mt-1 font-semibold text-neutral-900 dark:text-neutral-100">
                                            {entrega.calificacion}
                                        </p>
                                    )}
                                    {nota !== null && (
                                        <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                                            {notaTexto(nota)}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className={`${ROW} flex items-center gap-2 p-4 text-sm text-neutral-600 dark:text-neutral-300`}>
                                    <ClockIcon className="h-5 w-5 shrink-0" />
                                    Esperando la corrección de tu docente.
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleEntregaSubmit} className="mt-4 space-y-4">
                            {vencida && (
                                <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                                    El plazo ya venció: tu entrega quedará marcada como fuera de término.
                                </div>
                            )}

                            <input
                                ref={selector}
                                id="archivo-entrega"
                                type="file"
                                className="sr-only"
                                onChange={(e) => setArchivoEntrega(e.target.files?.[0] ?? null)}
                            />

                            {archivoEntrega ? (
                                <div className={`${ROW} flex items-center gap-3 p-3`}>
                                    <DocumentIcon className="h-6 w-6 shrink-0 text-primary" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                            {archivoEntrega.name}
                                        </p>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {peso(archivoEntrega.size)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setArchivoEntrega(null);
                                            if (selector.current) selector.current.value = "";
                                        }}
                                        aria-label="Quitar archivo"
                                        className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ) : (
                                <label
                                    htmlFor="archivo-entrega"
                                    className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5 focus-within:border-primary dark:border-neutral-600"
                                >
                                    <ArrowUpTrayIcon className="h-8 w-8 text-neutral-400" />
                                    <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                                        Elegí el archivo de tu trabajo
                                    </span>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                        Es opcional, pero tu docente lo necesita para corregir.
                                    </span>
                                </label>
                            )}

                            <button type="submit" disabled={submitting} className={`${BTN_P} w-full`}>
                                <PaperAirplaneIcon className="h-5 w-5" />
                                {submitting ? "Enviando entrega…" : "Entregar tarea"}
                            </button>
                        </form>
                    )}
                </aside>
            </div>
        </motion.div>
    );
}
