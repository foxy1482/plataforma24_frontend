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
    ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { normalizar } from "@/app/lib/format";
import { cursosDelCicloActual, etiquetaCurso, inicialesDeNombre } from "@/app/lib/sesion";
import type { Curso, ForoTema, Usuario } from "@/app/lib/types";
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
    Select,
    Tabs,
    Vacio,
} from "@/app/components/ui";
import { cargarForo, type ForoData } from "./cargar-foro";
import { nombreMostrado, useNombresReales } from "./autores";
import {
    type ConfigForo,
    MENSAJE_MAX,
    nombreAutor,
    textoDeFallo,
    tiempoRelativo,
    TEXTAREA,
    TITULO_MAX,
    TITULO_MIN,
} from "./foro-utils";

// "todos" | "generales" | "mi-curso" (alumno) | "curso-<id>" (personal)
type Filtro = string;

const GENERAL = "general";

function coincide(t: ForoTema, filtro: Filtro, yo: Usuario) {
    if (filtro === "generales") return t.idCurso == null;
    if (filtro === "mi-curso") return t.idCurso != null && t.idCurso === yo.idCurso;
    if (filtro.startsWith("curso-")) return t.idCurso === Number(filtro.slice(6));
    return true;
}

function etiquetaDe(tema: ForoTema, data: ForoData, personal: boolean) {
    if (tema.idCurso == null) return { texto: "General", tono: "violeta" as const };
    // El personal no pertenece a un curso concreto: siempre se nombra el curso del debate.
    if (!personal && tema.idCurso === data.yo.idCurso) return { texto: "Mi curso", tono: "teal" as const };
    return { texto: data.cursos[tema.idCurso] ?? `Curso ${tema.idCurso}`, tono: "gris" as const };
}

function NuevoDebate({
    data,
    personal,
    cursoInicial,
    onCancelar,
    onCreado,
}: {
    data: ForoData;
    personal: boolean;
    cursoInicial: string;
    onCancelar: () => void;
    onCreado: (id: number) => void;
}) {
    const tituloRef = useRef<HTMLInputElement>(null);
    const mensajeRef = useRef<HTMLTextAreaElement>(null);
    const [titulo, setTitulo] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [destino, setDestino] = useState(cursoInicial);
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        tituloRef.current?.focus();
    }, []);

    // Un debate nuevo se publica solo en cursos del ciclo vigente.
    const opcionesDestino = cursosDelCicloActual(data.listaCursos, [Number(destino) || null]);

    const dondeSePublica = personal
        ? destino === GENERAL
            ? "Se publica como debate general: lo ven todos los cursos."
            : `Se publica en ${data.cursos[Number(destino)] ?? `el curso ${destino}`}: lo ven ese curso y el personal.`
        : data.yo.idCurso == null
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
            const idCurso = personal ? (destino === GENERAL ? null : Number(destino)) : (data.yo.idCurso ?? null);
            const creado = await api.foro.crearTema({ idCurso, titulo: t, primerMensaje: m });
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

            {personal && (
                <div>
                    <label htmlFor="debate-destino" className={LABEL}>
                        ¿Dónde se publica?
                    </label>
                    <select
                        id="debate-destino"
                        value={destino}
                        onChange={(e) => setDestino(e.target.value)}
                        className={`${INPUT} mt-1`}
                    >
                        <option value={GENERAL}>General (todos los cursos)</option>
                        {opcionesDestino.map((c: Curso) => (
                            <option key={c.id} value={c.id}>
                                {etiquetaCurso(c, opcionesDestino)}
                            </option>
                        ))}
                    </select>
                </div>
            )}

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

export default function ListaForo({ config }: { config: ConfigForo }) {
    const { base, personal, moderacionHref } = config;
    const router = useRouter();
    const [data, setData] = useState<ForoData | null>(null);
    const [error, setError] = useState(false);
    const [actualizando, setActualizando] = useState(false);
    const [creando, setCreando] = useState(false);
    const [texto, setTexto] = useState("");
    const [filtro, setFiltro] = useState<Filtro>("todos");
    const [reportes, setReportes] = useState<number | null>(null);

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

    // Reportes pendientes: solo para el panel que tiene pantalla de moderación. Si falla, no se muestra el número.
    useEffect(() => {
        if (!moderacionHref) return;
        api.foro
            .reportes(true)
            .then((l) => setReportes((l ?? []).filter((r) => !r.resuelto).length))
            .catch(() => setReportes(null));
    }, [moderacionHref]);

    const actualizar = async () => {
        setActualizando(true);
        await cargar();
        setActualizando(false);
    };

    const nombres = useNombresReales(data?.temas.map((t) => t.idAutor) ?? [], personal);

    const visibles = useMemo(() => {
        if (!data) return [];
        const q = normalizar(texto);
        return data.temas
            .filter((t) => coincide(t, filtro, data.yo))
            .filter(
                (t) =>
                    !q ||
                    normalizar(`${t.titulo ?? ""} ${nombreMostrado(t.idAutor, t.autor, nombres)}`).includes(q)
            );
    }, [data, texto, filtro, nombres]);

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
                        {personal
                            ? "Los debates de todos los cursos: participá, abrí temas y cuidá la convivencia."
                            : "Abrí debates, respondé y compartí ideas con tu curso."}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {moderacionHref && (
                        <Link href={moderacionHref} className={BTN_G}>
                            <ShieldCheckIcon className="h-5 w-5" />
                            Moderar
                            {reportes !== null && reportes > 0 && (
                                <Chip tono="rojo">
                                    {reportes} {reportes === 1 ? "reporte" : "reportes"}
                                </Chip>
                            )}
                        </Link>
                    )}
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
                            personal={personal}
                            cursoInicial={filtro.startsWith("curso-") ? filtro.slice(6) : GENERAL}
                            onCancelar={() => setCreando(false)}
                            onCreado={(id) => router.push(`${base}/${id}`)}
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
                        {personal ? (
                            <Select label="Filtrar por curso" valor={filtro} onChange={setFiltro}>
                                <option value="todos">Todos los debates</option>
                                <option value="generales">Generales</option>
                                {data.listaCursos.map((c) => (
                                    <option key={c.id} value={`curso-${c.id}`}>
                                        {etiquetaCurso(c, data.listaCursos)}
                                    </option>
                                ))}
                            </Select>
                        ) : (
                            <Tabs<Filtro>
                                valor={filtro}
                                onChange={setFiltro}
                                opciones={[
                                    { valor: "todos", label: "Todos" },
                                    { valor: "mi-curso", label: "Mi curso" },
                                    { valor: "generales", label: "Generales" },
                                ]}
                            />
                        )}
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
                                const autor = nombreMostrado(t.idAutor, t.autor, nombres);
                                const etiqueta = etiquetaDe(t, data, personal);
                                const actividad = t.ultimoMensaje ?? t.fechaCreacion;
                                return (
                                    <li key={t.id}>
                                        <Link
                                            href={`${base}/${t.id}`}
                                            className={`${CARD} flex flex-wrap items-center gap-4 p-4 transition-colors hover:border-primary/60`}
                                        >
                                            <Avatar iniciales={inicialesDeNombre(autor || nombreAutor(t.autor))} id={t.idAutor} />
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
