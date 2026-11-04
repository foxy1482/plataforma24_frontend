"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon, DocumentIcon } from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import {
    fechaHora,
    notaNumerica,
    notaTexto,
    numero,
    parseFecha,
    promedio,
} from "@/app/lib/format";
import type { Archivo, DatosPersonales, Entrega } from "@/app/lib/types";
import {
    Avatar,
    BTN_G,
    BTN_P,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    LABEL,
    ROW,
} from "@/app/components/ui";
import { datosDocente, invalidarDocente, type TareaDocente } from "../../../datos";
import { VisorContenido } from "@/app/components/visor-archivos";
import { notificar } from "@/app/components/avisos";

interface Contexto {
    tarea: TareaDocente;
    entrega: Entrega;
    alumno: DatosPersonales | null;
    archivos: Archivo[];
    pendientes: Entrega[];
    historia: { entregas: number; total: number; promedio: number | null };
}

export default function CorregirView() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const params = useSearchParams();
    const idTarea = Number(id);
    const idEntrega = Number(params.get("entrega"));

    const [ctx, setCtx] = useState<Contexto | null>(null);
    const [error, setError] = useState(false);
    const [nota, setNota] = useState<number | null>(null);
    const [activo, setActivo] = useState(0);
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(() => {
        datosDocente()
            .then(async (d) => {
                const tarea = d.tareas.find((t) => t.tarea.id === idTarea);
                const entrega = tarea?.entregas.find((e) => e.id === idEntrega);
                if (!tarea || !entrega) {
                    setError(true);
                    return;
                }
                const materia = d.materias.find((m) => m.materia.id === tarea.idMateria);
                const alumno = materia?.alumnos.find((a) => a.idUsuario === entrega.idUsuario) ?? null;

                const archivos = await api.entregaArchivos.porEntrega(entrega.id).then(
                    (l) => l ?? [],
                    () => []
                );

                const delAlumno = (materia?.tareas ?? []).flatMap((t) =>
                    t.entregas.filter((e) => e.idUsuario === entrega.idUsuario)
                );
                const publicadas = (materia?.tareas ?? []).filter((t) => t.estado !== "programada");

                setNota(notaNumerica(entrega.calificacion));
                setActivo(0);

                setCtx({
                    tarea,
                    entrega,
                    alumno,
                    archivos,
                    pendientes: tarea.entregas.filter(
                        (e) => e.id !== entrega.id && notaNumerica(e.calificacion) === null
                    ),
                    historia: {
                        entregas: delAlumno.length,
                        total: publicadas.length,
                        promedio: promedio(
                            delAlumno
                                .map((e) => notaNumerica(e.calificacion))
                                .filter((n): n is number => n !== null)
                        ),
                    },
                });
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [idTarea, idEntrega, router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const tarde = useMemo(() => {
        if (!ctx?.tarea.vence) return false;
        const hecha = parseFecha(ctx.entrega.fechaEntrega)?.getTime();
        return hecha !== undefined && hecha > ctx.tarea.vence.getTime();
    }, [ctx]);

    const guardar = async (siguiente: boolean) => {
        if (!ctx || nota === null) {
            notificar("Elegí una nota antes de guardar.");
            return;
        }
        setGuardando(true);
        try {
            await api.entregas.modificar(ctx.entrega.id, {
                calificacion: notaTexto(nota),
            });
            invalidarDocente();
            const proxima = ctx.pendientes[0];
            if (siguiente && proxima) {
                router.replace(`/docente/tareas/${idTarea}/corregir?entrega=${proxima.id}`);
                setCtx(null);
                cargar();
            } else {
                router.push(`/docente/tareas/${idTarea}`);
            }
        } catch (e) {
            registrarError(e);
            notificar("No se pudo guardar la corrección.");
        } finally {
            setGuardando(false);
        }
    };

    if (error) {
        return <ErrorPanel mensaje="No encontramos esa entrega." onReintentar={cargar} />;
    }
    if (!ctx) {
        return (
            <div className="flex flex-wrap gap-5">
                <Cargando className="h-96 flex-[999_1_30rem]" />
                <Cargando className="h-96 flex-[1_1_20rem]" />
            </div>
        );
    }

    const nombre = ctx.alumno
        ? `${ctx.alumno.nombre} ${ctx.alumno.apellido}`
        : `Alumno ${ctx.entrega.idUsuario}`;

    return (
        <div className="mx-auto max-w-6xl space-y-4">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href={`/docente/tareas/${idTarea}`} className="hover:underline">
                    {ctx.tarea.tarea.titulo}
                </Link>{" "}
                / Corregir
            </nav>

            <div className="flex flex-wrap items-start gap-5">
                <section className={`${CARD} min-w-0 flex-[999_1_30rem] overflow-hidden`}>
                    {ctx.archivos.length === 0 ? (
                        <p className="p-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
                            La entrega no tiene archivos adjuntos.
                        </p>
                    ) : (
                        <>
                            <div
                                role="tablist"
                                aria-label="Archivos de la entrega"
                                className="flex overflow-x-auto border-b border-neutral-200 dark:border-neutral-700"
                            >
                                {ctx.archivos.map((a, i) => (
                                    <button
                                        key={a.id}
                                        role="tab"
                                        aria-selected={i === activo}
                                        onClick={() => setActivo(i)}
                                        className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors ${
                                            i === activo
                                                ? "border-primary text-primary"
                                                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                                        }`}
                                    >
                                        <DocumentIcon className="h-4 w-4 shrink-0" />
                                        {a.nombreOriginal ?? `archivo-${a.id}`}
                                    </button>
                                ))}
                            </div>
                            <VisorContenido
                                key={(ctx.archivos[activo] ?? ctx.archivos[0]).id}
                                archivo={ctx.archivos[activo] ?? ctx.archivos[0]}
                                className="h-[36rem]"
                            />
                        </>
                    )}
                </section>

                <aside className="min-w-0 flex-[1_1_20rem] space-y-4">
                    <section className={`${CARD} p-4`}>
                        <div className="flex items-center gap-3">
                            <Avatar
                                id={ctx.entrega.idUsuario}
                                iniciales={
                                    ctx.alumno
                                        ? `${ctx.alumno.nombre?.[0] ?? ""}${ctx.alumno.apellido?.[0] ?? ""}`.toUpperCase()
                                        : "?"
                                }
                                size="h-12 w-12 text-base"
                            />
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
                                    {nombre}
                                </p>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    {ctx.tarea.curso}
                                    {ctx.alumno?.dni ? ` · DNI ${ctx.alumno.dni}` : ""}
                                </p>
                            </div>
                        </div>
                        <div className="mt-3.5 flex flex-wrap gap-2">
                            <Chip tono={tarde ? "ambar" : "verde"}>
                                {tarde ? "Fuera de término" : "A tiempo"} ·{" "}
                                {fechaHora(ctx.entrega.fechaEntrega)}
                            </Chip>
                            <Chip>
                                {ctx.archivos.length}{" "}
                                {ctx.archivos.length === 1 ? "archivo" : "archivos"}
                            </Chip>
                        </div>
                        <div className={`${ROW} mt-3.5 p-3 text-xs text-neutral-600 dark:text-neutral-300`}>
                            En esta materia:{" "}
                            <strong className="text-neutral-900 dark:text-neutral-100">
                                {ctx.historia.entregas} de {ctx.historia.total}
                            </strong>{" "}
                            entregas · promedio{" "}
                            <strong className="text-neutral-900 dark:text-neutral-100">
                                {numero(ctx.historia.promedio, 1)}
                            </strong>
                        </div>
                    </section>

                    <section className={`${CARD} p-4`}>
                        <h2 className={LABEL}>Calificación</h2>
                        <div
                            role="radiogroup"
                            aria-label="Nota de 1 a 10"
                            className="mt-2.5 grid grid-cols-5 gap-1.5"
                        >
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                                <button
                                    key={v}
                                    role="radio"
                                    aria-checked={nota === v}
                                    onClick={() => setNota(v)}
                                    className={`h-11 rounded-xl text-base font-bold transition-colors ${
                                        nota === v
                                            ? v >= 6
                                                ? "bg-primary text-white"
                                                : "bg-amber-500 text-white"
                                            : `border border-neutral-300 dark:border-neutral-600 ${v >= 6 ? "text-neutral-700 dark:text-neutral-200" : "text-amber-600 dark:text-amber-400"}`
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2.5 text-sm text-neutral-600 dark:text-neutral-300">
                            {nota === null ? (
                                "Todavía sin calificar"
                            ) : (
                                <>
                                    Se mostrará al alumno como{" "}
                                    <strong className="text-neutral-900 dark:text-neutral-100">
                                        {notaTexto(nota)}
                                    </strong>{" "}
                                    · {nota >= 6 ? "Aprobado" : "Desaprobado"}
                                </>
                            )}
                        </p>

                        <div className="mt-5 flex gap-2">
                            <button
                                onClick={() => guardar(false)}
                                disabled={guardando}
                                className={`${BTN_G} flex-1`}
                            >
                                Guardar
                            </button>
                            {ctx.pendientes.length > 0 && (
                                <button
                                    onClick={() => guardar(true)}
                                    disabled={guardando}
                                    className={`${BTN_P} flex-[2]`}
                                >
                                    Guardar y siguiente
                                    <ArrowRightIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        {ctx.pendientes.length > 0 && (
                            <p className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
                                Quedan {ctx.pendientes.length} entregas sin corregir en esta tarea.
                            </p>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    );
}
