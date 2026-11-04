"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { aUtc, diasEntre, fechaHora, isoFecha, numero } from "@/app/lib/format";
import type { Archivo } from "@/app/lib/types";
import {
    BTN_G,
    BTN_P,
    BTN_R,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    INPUT,
    LABEL,
    ROW,
    Stat,
    type Tono,
} from "@/app/components/ui";
import { ArchivoChip } from "@/app/components/visor-archivos";
import { ETIQUETA_ESTADO, datosDocente, invalidarDocente, type EstadoTarea, type TareaDocente } from "../../../datos";
import { notificar } from "@/app/components/avisos";

const TONO_ESTADO: Record<EstadoTarea, Tono> = {
    programada: "violeta",
    abierta: "azul",
    "para-corregir": "ambar",
    cerrada: "gris",
};

function horaDe(fecha: Date | null) {
    if (!fecha) return "23:59";
    return `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}

// Texto corto sobre el plazo: "Vence en 3 días", "Venció hace 2 días"
function textoPlazo(t: TareaDocente, hoy: Date) {
    if (!t.vence) return "Sin fecha de entrega";
    const dias = diasEntre(hoy, t.vence);
    if (t.estado === "programada") return "Todavía no está publicada";
    if (dias > 1) return `Vence en ${dias} días`;
    if (dias === 1) return "Vence mañana";
    if (dias === 0) return t.vence.getTime() >= hoy.getTime() ? "Vence hoy" : "Venció hoy";
    return `Venció hace ${-dias} ${dias === -1 ? "día" : "días"}`;
}

export default function DetalleView() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const idTarea = Number(id);

    const [tarea, setTarea] = useState<TareaDocente | null>(null);
    const [hoy, setHoy] = useState<Date | null>(null);
    const [adjuntos, setAdjuntos] = useState<Archivo[] | null>(null);
    const [error, setError] = useState(false);

    const [editando, setEditando] = useState(false);
    const [titulo, setTitulo] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [fecha, setFecha] = useState("");
    const [hora, setHora] = useState("23:59");
    const [guardando, setGuardando] = useState(false);
    const [aviso, setAviso] = useState("");

    const cargar = useCallback(() => {
        datosDocente()
            .then(async (d) => {
                const t = d.tareas.find((x) => x.tarea.id === idTarea);
                if (!t) {
                    setError(true);
                    return;
                }
                setTarea(t);
                setHoy(d.hoy);
                setTitulo(t.tarea.titulo);
                setDescripcion(t.tarea.descripcion ?? "");
                setFecha(t.vence ? isoFecha(t.vence) : "");
                setHora(horaDe(t.vence));
                setAdjuntos(
                    await api.tareaArchivos.porTarea(idTarea).then(
                        (l) => l ?? [],
                        () => []
                    )
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
    }, [idTarea, router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const guardar = async () => {
        if (!tarea) return;
        if (!titulo.trim()) {
            setAviso("Ponele un título a la tarea.");
            return;
        }
        if (!fecha) {
            setAviso("Elegí la fecha de entrega.");
            return;
        }
        setAviso("");
        setGuardando(true);
        try {
            await api.tareas.modificar(tarea.tarea.id, {
                titulo: titulo.trim(),
                descripcion: descripcion.trim(),
                fechaEntrega: aUtc(`${fecha}T${hora}:00`),
            });
            invalidarDocente();
            setEditando(false);
            setTarea(null);
            setAdjuntos(null);
            cargar();
        } catch (e) {
            registrarError(e);
            setAviso(mensajeDeError(e, "No se pudieron guardar los cambios."));
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async () => {
        if (!tarea) return;
        const pregunta =
            tarea.entregadas > 0
                ? `Esta tarea ya tiene ${tarea.entregadas} ${tarea.entregadas === 1 ? "entrega" : "entregas"}. ¿Eliminar "${tarea.tarea.titulo}" igual?`
                : `¿Eliminar "${tarea.tarea.titulo}"?`;
        if (!window.confirm(pregunta)) return;
        try {
            await api.tareas.eliminar(tarea.tarea.id);
            invalidarDocente();
            router.push(`/docente/materias?materia=${tarea.idMateria}`);
        } catch (e) {
            registrarError(e);
            notificar(
                e instanceof ApiError && e.status === 400
                    ? "No se pudo eliminar la tarea: probablemente ya tiene entregas o archivos asociados."
                    : "No se pudo eliminar la tarea."
            );
        }
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No encontramos esa tarea entre tus materias."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }

    if (!tarea || !hoy) {
        return (
            <div className="space-y-4">
                <Cargando className="h-24" />
                <Cargando className="h-96" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href={`/docente/materias?materia=${tarea.idMateria}`} className="hover:underline">
                    {tarea.materia} · {tarea.curso}
                </Link>{" "}
                / Detalle de la tarea
            </nav>

            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="font-libertinus text-3xl font-bold leading-tight text-neutral-900 dark:text-neutral-100">
                            {tarea.tarea.titulo}
                        </h1>
                        <Chip tono={TONO_ESTADO[tarea.estado]}>{ETIQUETA_ESTADO[tarea.estado]}</Chip>
                    </div>
                    <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                        {textoPlazo(tarea, hoy)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href={`/docente/tareas/${tarea.tarea.id}`} className={BTN_P}>
                        Ver entregas
                    </Link>
                    {!editando && (
                        <button onClick={() => setEditando(true)} className={BTN_G}>
                            <PencilSquareIcon className="h-5 w-5" />
                            Editar
                        </button>
                    )}
                    <button onClick={eliminar} className={BTN_R}>
                        <TrashIcon className="h-5 w-5" />
                        Eliminar
                    </button>
                </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                    label="Entregaron"
                    valor={
                        <>
                            {tarea.entregadas}
                            <span className="ml-1 text-lg text-neutral-500 dark:text-neutral-400">
                                / {tarea.alumnos}
                            </span>
                        </>
                    }
                    sub={`${tarea.alumnos > 0 ? Math.round((tarea.entregadas / tarea.alumnos) * 100) : 0}% del curso`}
                />
                <Stat label="Corregidas" valor={tarea.corregidas} color="text-green-500" />
                <Stat label="Sin corregir" valor={tarea.sinCorregir} color="text-amber-500" />
                <Stat label="Promedio" valor={numero(tarea.promedio, 1)} />
            </div>

            <div className="flex flex-wrap items-start gap-5">
                <section className="min-w-0 flex-[999_1_28rem] space-y-5">
                    {editando ? (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                guardar();
                            }}
                            className={`${CARD} space-y-4 p-5`}
                        >
                            <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                Editar tarea
                            </h2>

                            <div>
                                <label className={`${LABEL} mb-1.5 block`} htmlFor="d-tit">
                                    Título
                                </label>
                                <input
                                    id="d-tit"
                                    className={INPUT}
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className={`${LABEL} mb-1.5 block`} htmlFor="d-desc">
                                    Consigna
                                </label>
                                <textarea
                                    id="d-desc"
                                    rows={8}
                                    className={`${INPUT} h-auto resize-y py-2.5 leading-relaxed`}
                                    value={descripcion}
                                    onChange={(e) => setDescripcion(e.target.value)}
                                />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className={`${LABEL} mb-1.5 block`} htmlFor="d-fecha">
                                        Fecha de entrega
                                    </label>
                                    <input
                                        id="d-fecha"
                                        type="date"
                                        className={INPUT}
                                        value={fecha}
                                        onChange={(e) => setFecha(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={`${LABEL} mb-1.5 block`} htmlFor="d-hora">
                                        Hora límite
                                    </label>
                                    <input
                                        id="d-hora"
                                        type="time"
                                        className={INPUT}
                                        value={hora}
                                        onChange={(e) => setHora(e.target.value)}
                                    />
                                </div>
                            </div>

                            {aviso && <p className="text-sm text-red-600 dark:text-red-400">{aviso}</p>}

                            <div className="flex flex-wrap gap-2">
                                <button type="submit" disabled={guardando} className={BTN_P}>
                                    {guardando ? "Guardando…" : "Guardar cambios"}
                                </button>
                                <button
                                    type="button"
                                    disabled={guardando}
                                    onClick={() => {
                                        setEditando(false);
                                        setAviso("");
                                        cargar();
                                    }}
                                    className={BTN_G}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    ) : (
                        <article className={`${CARD} p-5`}>
                            <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                Consigna
                            </h2>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                                {tarea.tarea.descripcion || "Sin descripción."}
                            </p>
                        </article>
                    )}

                    <article className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Archivos adjuntos
                        </h2>
                        {!adjuntos ? (
                            <Cargando className="mt-3 h-12" />
                        ) : adjuntos.length === 0 ? (
                            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                                Esta tarea no tiene archivos adjuntos.
                            </p>
                        ) : (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {adjuntos.map((a) => (
                                    <ArchivoChip key={a.id} archivo={a} />
                                ))}
                            </div>
                        )}
                    </article>
                </section>

                <aside className="min-w-0 flex-[1_1_17rem]">
                    <div className={`${CARD} space-y-4 p-5`}>
                        <div>
                            <p className={LABEL}>Materia</p>
                            <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{tarea.materia}</p>
                        </div>
                        <div>
                            <p className={LABEL}>Curso</p>
                            <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{tarea.curso}</p>
                        </div>
                        <div>
                            <p className={LABEL}>Publicada desde</p>
                            <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                                {fechaHora(tarea.publicada)}
                            </p>
                        </div>
                        <div>
                            <p className={LABEL}>Fecha de entrega</p>
                            <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                                {fechaHora(tarea.vence)}
                            </p>
                        </div>
                        {tarea.sinCorregir > 0 && (
                            <div className={`${ROW} p-3`}>
                                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                                    Hay {tarea.sinCorregir}{" "}
                                    {tarea.sinCorregir === 1 ? "entrega" : "entregas"} esperando corrección.
                                </p>
                                <Link
                                    href={`/docente/tareas/${tarea.tarea.id}`}
                                    className="mt-1.5 inline-block text-xs font-semibold text-primary hover:underline"
                                >
                                    Ir a corregir
                                </Link>
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
