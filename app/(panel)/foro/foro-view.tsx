"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowPathIcon,
    ChatBubbleLeftRightIcon,
    LockClosedIcon,
    MagnifyingGlassIcon,
    PlusIcon,
} from "@heroicons/react/24/outline";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import * as api from "@/app/lib/apiClient";
import { normalizar } from "@/app/lib/format";
import { inicialesDeNombre } from "@/app/lib/sesion";
import type { ForoTema } from "@/app/lib/types";
import {
    Avatar,
    BTN_G,
    BTN_P,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    INPUT,
    LABEL,
    Tabs,
    Vacio,
} from "@/app/components/ui";
import { cargarForo, type ForoData } from "./cargar-foro";
import {
    MENSAJE_MAX,
    nombreAutor,
    textoDeFallo,
    tiempoRelativo,
    TEXTAREA,
    TITULO_MAX,
    TITULO_MIN,
} from "./foro-utils";

type Filtro = "todos" | "curso" | "generales";

function etiquetaDe(tema: ForoTema, data: ForoData) {
    if (tema.idCurso == null) return { texto: "General", tono: "violeta" as const };
    if (tema.idCurso === data.yo.idCurso) return { texto: "Mi curso", tono: "teal" as const };
    return { texto: data.cursos[tema.idCurso] ?? `Curso ${tema.idCurso}`, tono: "gris" as const };
}

function NuevoDebate({
    data,
    onCancelar,
    onCreado,
}: {
    data: ForoData;
    onCancelar: () => void;
    onCreado: (id: number) => void;
}) {
    const tituloRef = useRef<HTMLInputElement>(null);
    const mensajeRef = useRef<HTMLTextAreaElement>(null);
    const [titulo, setTitulo] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        tituloRef.current?.focus();
    }, []);

    const dondeSePublica =
        data.yo.idCurso == null
            ? "Se publica como debate general."
            : `Se publica en tu curso (${data.cursos[data.yo.idCurso] ?? `Curso ${data.yo.idCurso}`}).`;

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        const t = titulo.trim();
        const m = mensaje.trim();
        if (t.length < TITULO_MIN) {
            setError(`El título debe tener al menos ${TITULO_MIN} caracteres.`);
            tituloRef.current?.focus();
            return;
        }
        if (!m) {
            setError("Escribí el primer mensaje para abrir el debate.");
            mensajeRef.current?.focus();
            return;
        }
        setError(null);
        setEnviando(true);
        try {
            const creado = await api.foro.crearTema({
                idCurso: data.yo.idCurso ?? null,
                titulo: t,
                primerMensaje: m,
            });
            onCreado(creado.id);
        } catch (err) {
            registrarError(err);
            setError(textoDeFallo(err, "No se pudo abrir el debate. Intentá de nuevo en unos minutos."));
            setEnviando(false);
        }
    };

    return (
        <form onSubmit={enviar} className={`${CARD} space-y-4 p-5`} aria-label="Nuevo debate">
            <div>
                <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    Nuevo debate
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{dondeSePublica}</p>
            </div>

            <div>
                <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="debate-titulo" className={LABEL}>
                        Título
                    </label>
                    <span className="text-xs text-neutral-400">
                        {titulo.length}/{TITULO_MAX}
                    </span>
                </div>
                <input
                    ref={tituloRef}
                    id="debate-titulo"
                    type="text"
                    value={titulo}
                    maxLength={TITULO_MAX}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="¿Sobre qué querés debatir?"
                    className={`${INPUT} mt-1`}
                />
            </div>

            <div>
                <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="debate-mensaje" className={LABEL}>
                        Primer mensaje
                    </label>
                    <span className="text-xs text-neutral-400">
                        {mensaje.length}/{MENSAJE_MAX}
                    </span>
                </div>
                <textarea
                    ref={mensajeRef}
                    id="debate-mensaje"
                    value={mensaje}
                    maxLength={MENSAJE_MAX}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Contá tu idea o tu pregunta para que los demás puedan responder."
                    className={`${TEXTAREA} mt-1`}
                />
            </div>

            {error && (
                <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                >
                    {error}
                </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={onCancelar} disabled={enviando} className={BTN_G}>
                    Cancelar
                </button>
                <button type="submit" disabled={enviando} className={BTN_P}>
                    {enviando ? "Publicando…" : "Abrir debate"}
                </button>
            </div>
        </form>
    );
}

export default function ForoView() {
    const router = useRouter();
    const [data, setData] = useState<ForoData | null>(null);
    const [error, setError] = useState(false);
    const [actualizando, setActualizando] = useState(false);
    const [creando, setCreando] = useState(false);
    const [texto, setTexto] = useState("");
    const [filtro, setFiltro] = useState<Filtro>("todos");

    const cargar = useCallback(() => {
        return cargarForo()
            .then((d) => {
                setData(d);
                setError(false);
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

    const actualizar = async () => {
        setActualizando(true);
        await cargar();
        setActualizando(false);
    };

    const visibles = useMemo(() => {
        if (!data) return [];
        const q = normalizar(texto);
        return data.temas
            .filter((t) => {
                if (filtro === "curso") return t.idCurso != null && t.idCurso === data.yo.idCurso;
                if (filtro === "generales") return t.idCurso == null;
                return true;
            })
            .filter((t) => !q || normalizar(`${t.titulo ?? ""} ${nombreAutor(t.autor)}`).includes(q));
    }, [data, texto, filtro]);

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar el foro. Revisá tu conexión e intentá de nuevo."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Foro
                    </h1>
                    <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                        Abrí debates, respondé y compartí ideas con tu curso.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={actualizar}
                        disabled={!data || actualizando}
                        className={BTN_G}
                    >
                        <ArrowPathIcon className={`h-5 w-5 ${actualizando ? "animate-spin" : ""}`} />
                        Actualizar
                    </button>
                    <button
                        type="button"
                        onClick={() => setCreando(true)}
                        disabled={!data || creando}
                        className={BTN_P}
                    >
                        <PlusIcon className="h-5 w-5" />
                        Nuevo debate
                    </button>
                </div>
            </header>

            {!data ? (
                <div className="space-y-3">
                    <Cargando className="h-12" />
                    <Cargando className="h-24" />
                    <Cargando className="h-24" />
                    <Cargando className="h-24" />
                </div>
            ) : (
                <>
                    {creando && (
                        <NuevoDebate
                            data={data}
                            onCancelar={() => setCreando(false)}
                            onCreado={(id) => router.push(`/foro/${id}`)}
                        />
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex h-10 min-w-0 flex-1 basis-60 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 dark:border-neutral-600 dark:bg-neutral-900">
                            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-neutral-400" />
                            <span className="sr-only">Buscar debates</span>
                            <input
                                type="search"
                                value={texto}
                                onChange={(e) => setTexto(e.target.value)}
                                placeholder="Buscar por título o autor…"
                                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
                            />
                        </label>
                        <Tabs<Filtro>
                            valor={filtro}
                            onChange={setFiltro}
                            opciones={[
                                { valor: "todos", label: "Todos" },
                                { valor: "curso", label: "Mi curso" },
                                { valor: "generales", label: "Generales" },
                            ]}
                        />
                    </div>

                    <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
                        {visibles.length} {visibles.length === 1 ? "debate" : "debates"}
                    </p>

                    {visibles.length === 0 ? (
                        <Vacio>
                            {data.temas.length === 0
                                ? "Todavía no hay debates. Abrí el primero con “Nuevo debate”."
                                : "No hay debates que coincidan con tu búsqueda."}
                        </Vacio>
                    ) : (
                        <ul className="space-y-3">
                            {visibles.map((t) => {
                                const autor = nombreAutor(t.autor);
                                const etiqueta = etiquetaDe(t, data);
                                const actividad = t.ultimoMensaje ?? t.fechaCreacion;
                                return (
                                    <li key={t.id}>
                                        <Link
                                            href={`/foro/${t.id}`}
                                            className={`${CARD} flex flex-wrap items-center gap-4 p-4 transition-colors hover:border-primary/60`}
                                        >
                                            <Avatar iniciales={inicialesDeNombre(autor)} id={t.idAutor} />
                                            <div className="min-w-0 flex-[1_1_16rem]">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="min-w-0 break-words font-semibold text-neutral-900 dark:text-neutral-100">
                                                        {t.titulo}
                                                    </h2>
                                                    {t.fijado && <Chip tono="ambar">Fijado</Chip>}
                                                    {t.cerrado && (
                                                        <Chip tono="gris">
                                                            <LockClosedIcon className="h-3 w-3" />
                                                            Cerrado
                                                        </Chip>
                                                    )}
                                                    <Chip tono={etiqueta.tono}>{etiqueta.texto}</Chip>
                                                </div>
                                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                                    Por {autor}
                                                    {t.idAutor === data.yo.id && " (vos)"} ·{" "}
                                                    {tiempoRelativo(t.fechaCreacion)}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end text-xs text-neutral-500 dark:text-neutral-400">
                                                <span className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                                                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                                    {t.cantidadMensajes}
                                                    <span className="sr-only">
                                                        {t.cantidadMensajes === 1 ? " mensaje" : " mensajes"}
                                                    </span>
                                                </span>
                                                <span>Actividad {tiempoRelativo(actividad)}</span>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
