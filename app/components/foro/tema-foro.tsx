"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowPathIcon,
    ArrowUturnLeftIcon,
    BookmarkIcon,
    FlagIcon,
    LockClosedIcon,
    LockOpenIcon,
    PaperAirplaneIcon,
    PencilSquareIcon,
    TrashIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { notificar } from "@/app/components/avisos";
import { inicialesDeNombre } from "@/app/lib/sesion";
import type { ForoMensaje } from "@/app/lib/types";
import {
    Avatar,
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
} from "@/app/components/ui";
import { cargarDebate, type DebateData } from "./cargar-foro";
import { nombreMostrado, useNombresReales } from "./autores";
import {
    type ConfigForo,
    esPersonalRol,
    etiquetaRol,
    MENSAJE_MAX,
    MOTIVO_MAX,
    MOTIVO_MIN,
    resumen,
    TEXTAREA,
    textoDeFallo,
    tiempoRelativo,
} from "./foro-utils";

export default function TemaForo({ config }: { config: ConfigForo }) {
    const { base, personal } = config;
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const idTema = Number(id);
    const idInvalido = !Number.isInteger(idTema) || idTema <= 0;

    const [data, setData] = useState<DebateData | null>(null);
    // "fallo": error de red o servidor; "ausente": el debate no existe o no es de este curso.
    const [fallo, setFallo] = useState<"fallo" | "ausente" | null>(null);
    const [actualizando, setActualizando] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);

    const [respuesta, setRespuesta] = useState("");
    const [citando, setCitando] = useState<ForoMensaje | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [errorRespuesta, setErrorRespuesta] = useState<string | null>(null);
    const redaccion = useRef<HTMLTextAreaElement>(null);

    const [editando, setEditando] = useState<{ id: number; texto: string } | null>(null);
    const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [reportando, setReportando] = useState<{ id: number; motivo: string } | null>(null);
    const [errorReporte, setErrorReporte] = useState<string | null>(null);

    const cargar = useCallback(() => {
        if (idInvalido) return Promise.resolve();
        return cargarDebate(idTema)
            .then((d) => {
                setData(d);
                setFallo(null);
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setFallo(e instanceof ApiError && [403, 404].includes(e.status) ? "ausente" : "fallo");
            });
    }, [idTema, idInvalido, router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const actualizar = async () => {
        setActualizando(true);
        await cargar();
        setActualizando(false);
    };

    const porId = useMemo(() => new Map((data?.mensajes ?? []).map((m) => [m.id, m])), [data]);

    const idsAutores = useMemo(
        () => (data ? [data.tema.idAutor, ...data.mensajes.map((m) => m.idAutor)] : []),
        [data]
    );
    const nombres = useNombresReales(idsAutores, personal);
    const nombreDe = (idUsuario: number, alias?: string | null) => nombreMostrado(idUsuario, alias, nombres);
    const [moderando, setModerando] = useState(false);

    if (fallo === "ausente" || idInvalido) {
        return (
            <div className="mx-auto max-w-3xl space-y-4">
                <ErrorPanel
                    mensaje={
                        personal
                            ? "Este debate no existe o fue eliminado."
                            : "Este debate no existe, fue eliminado o no es de tu curso."
                    }
                />
                <p className="text-center">
                    <Link href={base} className="text-sm text-primary hover:underline">
                        Volver al foro
                    </Link>
                </p>
            </div>
        );
    }
    if (fallo === "fallo") {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar el debate. Revisá tu conexión e intentá de nuevo."
                onReintentar={() => {
                    setFallo(null);
                    cargar();
                }}
            />
        );
    }
    if (!data) {
        return (
            <div className="mx-auto max-w-3xl space-y-4">
                <Cargando className="h-24" />
                <Cargando className="h-40" />
                <Cargando className="h-40" />
            </div>
        );
    }

    const { yo, tema, mensajes, cursos } = data;
    const esModerador = esPersonalRol(yo.idRol);
    const alcance =
        tema.idCurso == null
            ? { texto: "General", tono: "violeta" as const }
            : !personal && tema.idCurso === yo.idCurso
              ? { texto: "Mi curso", tono: "teal" as const }
              : { texto: cursos[tema.idCurso] ?? `Curso ${tema.idCurso}`, tono: "gris" as const };

    const recargarMensajes = async () => {
        const nuevos = await api.foro.mensajes(idTema);
        setData((d) => (d ? { ...d, mensajes: nuevos ?? [] } : d));
    };

    const responder = (m: ForoMensaje) => {
        setCitando(m);
        redaccion.current?.focus();
        redaccion.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const enviarRespuesta = async (e: React.FormEvent) => {
        e.preventDefault();
        const texto = respuesta.trim();
        if (!texto) {
            setErrorRespuesta("Escribí tu respuesta antes de enviarla.");
            redaccion.current?.focus();
            return;
        }
        setErrorRespuesta(null);
        setEnviando(true);
        try {
            await api.foro.crearMensaje(idTema, { contenido: texto, idRespuestaA: citando?.id ?? null });
            setRespuesta("");
            setCitando(null);
            setAviso("Tu respuesta se publicó.");
            await recargarMensajes();
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                router.replace("/login");
                return;
            }
            registrarError(err);
            setErrorRespuesta(textoDeFallo(err, "No se pudo publicar tu respuesta. Intentá de nuevo."));
        } finally {
            setEnviando(false);
        }
    };

    const guardarEdicion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editando) return;
        const texto = editando.texto.trim();
        if (!texto) {
            setErrorEdicion("El mensaje no puede quedar vacío. Si querés sacarlo, eliminalo.");
            return;
        }
        setErrorEdicion(null);
        setGuardando(true);
        try {
            await api.foro.modificarMensaje(editando.id, texto);
            setEditando(null);
            setAviso("Cambios guardados.");
            await recargarMensajes();
        } catch (err) {
            registrarError(err);
            setErrorEdicion(textoDeFallo(err, "No se pudo guardar el cambio. Intentá de nuevo."));
        } finally {
            setGuardando(false);
        }
    };

    const eliminarMensaje = async (m: ForoMensaje) => {
        if (!window.confirm("¿Eliminar este mensaje? No se puede deshacer.")) return;
        try {
            await api.foro.eliminarMensaje(m.id);
            if (citando?.id === m.id) setCitando(null);
            setAviso("El mensaje se eliminó.");
            await recargarMensajes();
        } catch (err) {
            registrarError(err);
            notificar(mensajeDeError(err, "No se pudo eliminar el mensaje."));
        }
    };

    const eliminarDebate = async () => {
        if (!window.confirm("¿Eliminar todo el debate? Se pierden también las respuestas de los demás.")) return;
        try {
            await api.foro.eliminarTema(idTema);
            router.replace(base);
        } catch (err) {
            registrarError(err);
            notificar(mensajeDeError(err, "No se pudo eliminar el debate."));
        }
    };

    const moderar = async (cambios: { fijado?: boolean; cerrado?: boolean }, exito: string) => {
        setModerando(true);
        try {
            await api.foro.modificarTema(idTema, cambios);
            setAviso(exito);
            await cargar();
        } catch (err) {
            registrarError(err);
            notificar(mensajeDeError(err, "No se pudo actualizar el debate."));
        } finally {
            setModerando(false);
        }
    };

    const enviarReporte = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reportando) return;
        const motivo = reportando.motivo.trim();
        if (motivo.length < MOTIVO_MIN) {
            setErrorReporte(`Contanos el motivo (al menos ${MOTIVO_MIN} caracteres).`);
            return;
        }
        setErrorReporte(null);
        setGuardando(true);
        try {
            await api.foro.reportar(reportando.id, motivo);
            setReportando(null);
            setAviso("Gracias, avisamos a preceptoría para que revise el mensaje.");
            await recargarMensajes();
        } catch (err) {
            registrarError(err);
            setErrorReporte(mensajeDeError(err, "No se pudo enviar el reporte. Intentá de nuevo."));
        } finally {
            setGuardando(false);
        }
    };

    const autorDelDebate = nombreDe(tema.idAutor, tema.autor);
    const puedeEliminarDebate = tema.idAutor === yo.id || esModerador;

    return (
        <div className="mx-auto max-w-3xl space-y-5">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href={base} className="hover:underline">
                    Foro
                </Link>
                {" / "}
                <span className="break-words">{tema.titulo}</span>
            </nav>

            <header className={`${CARD} space-y-3 p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <h1 className="min-w-0 break-words font-libertinus text-3xl font-bold leading-tight text-neutral-900 dark:text-neutral-100">
                        {tema.titulo}
                    </h1>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={actualizar} disabled={actualizando} className={BTN_G}>
                            <ArrowPathIcon className={`h-5 w-5 ${actualizando ? "animate-spin" : ""}`} />
                            Actualizar
                        </button>
                        {esModerador && (
                            <>
                                <button
                                    type="button"
                                    disabled={moderando}
                                    onClick={() =>
                                        moderar(
                                            { fijado: !tema.fijado },
                                            tema.fijado ? "El debate ya no está fijado." : "El debate quedó fijado arriba."
                                        )
                                    }
                                    className={BTN_G}
                                >
                                    <BookmarkIcon className="h-5 w-5" />
                                    {tema.fijado ? "Quitar fijado" : "Fijar"}
                                </button>
                                <button
                                    type="button"
                                    disabled={moderando}
                                    onClick={() =>
                                        moderar(
                                            { cerrado: !tema.cerrado },
                                            tema.cerrado ? "El debate se reabrió." : "El debate se cerró: ya no admite respuestas."
                                        )
                                    }
                                    className={BTN_G}
                                >
                                    {tema.cerrado ? <LockOpenIcon className="h-5 w-5" /> : <LockClosedIcon className="h-5 w-5" />}
                                    {tema.cerrado ? "Reabrir" : "Cerrar"}
                                </button>
                            </>
                        )}
                        {puedeEliminarDebate && (
                            <button type="button" onClick={eliminarDebate} className={BTN_R}>
                                <TrashIcon className="h-5 w-5" />
                                Eliminar debate
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Chip tono={alcance.tono}>{alcance.texto}</Chip>
                    {tema.fijado && <Chip tono="ambar">Fijado</Chip>}
                    {tema.cerrado && (
                        <Chip tono="gris">
                            <LockClosedIcon className="h-3 w-3" />
                            Cerrado
                        </Chip>
                    )}
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        Abierto por {autorDelDebate}
                        {tema.idAutor === yo.id && " (vos)"} · {tiempoRelativo(tema.fechaCreacion)}
                    </span>
                </div>
            </header>

            <div role="status" aria-live="polite">
                {aviso && (
                    <p className="flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
                        <span>{aviso}</span>
                        <button
                            type="button"
                            aria-label="Cerrar aviso"
                            onClick={() => setAviso(null)}
                            className="shrink-0"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </p>
                )}
            </div>

            <section aria-label="Mensajes del debate">
                {mensajes.length === 0 ? (
                    <p className={`${CARD} p-8 text-center text-sm text-neutral-500 dark:text-neutral-400`}>
                        Todavía no hay mensajes. Sé el primero en escribir.
                    </p>
                ) : (
                    <ol className="space-y-3">
                        {mensajes.map((m) => {
                            const autor = nombreDe(m.idAutor, m.autor);
                            const propio = m.idAutor === yo.id;
                            const rol = etiquetaRol(m.rolAutor);
                            const original = m.idRespuestaA ? porId.get(m.idRespuestaA) : undefined;
                            const puedeBorrar = !m.eliminado && (propio || esModerador);
                            return (
                                <li
                                    key={m.id}
                                    id={`mensaje-${m.id}`}
                                    className={`${CARD} scroll-mt-24 p-4 ${propio ? "border-primary/40" : ""}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <Avatar iniciales={inicialesDeNombre(autor)} id={m.idAutor} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                    {autor}
                                                    {propio && " (vos)"}
                                                </span>
                                                {rol && <Chip tono={rol.tono}>{rol.texto}</Chip>}
                                                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                                    {tiempoRelativo(m.fechaPublicacion)}
                                                    {m.fechaEdicion && !m.eliminado && " · editado"}
                                                </span>
                                            </div>

                                            {m.idRespuestaA && (
                                                <a
                                                    href={`#mensaje-${m.idRespuestaA}`}
                                                    className={`${ROW} mt-2 block border-l-4 border-l-primary/50 px-3 py-2 text-xs text-neutral-600 hover:border-primary dark:text-neutral-300`}
                                                >
                                                    <span className="font-semibold">
                                                        En respuesta a {original ? nombreDe(original.idAutor, original.autor) : "otro mensaje"}
                                                    </span>
                                                    {original && (
                                                        <span className="block truncate">
                                                            {original.eliminado
                                                                ? "Mensaje eliminado"
                                                                : resumen(original.contenido)}
                                                        </span>
                                                    )}
                                                </a>
                                            )}

                                            {editando?.id === m.id ? (
                                                <form onSubmit={guardarEdicion} className="mt-3 space-y-3">
                                                    <div>
                                                        <label htmlFor={`editar-${m.id}`} className={LABEL}>
                                                            Editar mensaje
                                                        </label>
                                                        <textarea
                                                            id={`editar-${m.id}`}
                                                            autoFocus
                                                            value={editando.texto}
                                                            maxLength={MENSAJE_MAX}
                                                            onChange={(e) =>
                                                                setEditando({ id: m.id, texto: e.target.value })
                                                            }
                                                            className={`${TEXTAREA} mt-1`}
                                                        />
                                                    </div>
                                                    {errorEdicion && (
                                                        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                                                            {errorEdicion}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={guardando}
                                                            onClick={() => {
                                                                setEditando(null);
                                                                setErrorEdicion(null);
                                                            }}
                                                            className={BTN_G}
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button type="submit" disabled={guardando} className={BTN_P}>
                                                            {guardando ? "Guardando…" : "Guardar"}
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : m.eliminado ? (
                                                <p className="mt-2 text-sm italic text-neutral-500 dark:text-neutral-400">
                                                    Este mensaje fue eliminado.
                                                </p>
                                            ) : (
                                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                                                    {m.contenido}
                                                </p>
                                            )}

                                            {!m.eliminado && editando?.id !== m.id && (
                                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                                    {!tema.cerrado && (
                                                        <button
                                                            type="button"
                                                            onClick={() => responder(m)}
                                                            className="inline-flex items-center gap-1 hover:text-primary"
                                                        >
                                                            <ArrowUturnLeftIcon className="h-4 w-4" />
                                                            Responder
                                                        </button>
                                                    )}
                                                    {propio && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditando({ id: m.id, texto: m.contenido ?? "" });
                                                                setErrorEdicion(null);
                                                            }}
                                                            className="inline-flex items-center gap-1 hover:text-primary"
                                                        >
                                                            <PencilSquareIcon className="h-4 w-4" />
                                                            Editar
                                                        </button>
                                                    )}
                                                    {puedeBorrar && (
                                                        <button
                                                            type="button"
                                                            onClick={() => eliminarMensaje(m)}
                                                            className="inline-flex items-center gap-1 hover:text-red-600"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                            Eliminar
                                                        </button>
                                                    )}
                                                    {!propio && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setReportando({ id: m.id, motivo: "" });
                                                                setErrorReporte(null);
                                                            }}
                                                            className="inline-flex items-center gap-1 hover:text-red-600"
                                                        >
                                                            <FlagIcon className="h-4 w-4" />
                                                            Reportar
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {reportando?.id === m.id && (
                                                <form onSubmit={enviarReporte} className={`${ROW} mt-3 space-y-3 p-3`}>
                                                    <div>
                                                        <label htmlFor={`reporte-${m.id}`} className={LABEL}>
                                                            ¿Por qué reportás este mensaje?
                                                        </label>
                                                        <input
                                                            id={`reporte-${m.id}`}
                                                            type="text"
                                                            autoFocus
                                                            value={reportando.motivo}
                                                            maxLength={MOTIVO_MAX}
                                                            onChange={(e) =>
                                                                setReportando({ id: m.id, motivo: e.target.value })
                                                            }
                                                            placeholder="Ej: lenguaje ofensivo, spam…"
                                                            className={`${INPUT} mt-1`}
                                                        />
                                                    </div>
                                                    {errorReporte && (
                                                        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                                                            {errorReporte}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={guardando}
                                                            onClick={() => setReportando(null)}
                                                            className={BTN_G}
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button type="submit" disabled={guardando} className={BTN_R}>
                                                            {guardando ? "Enviando…" : "Enviar reporte"}
                                                        </button>
                                                    </div>
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </section>

            {tema.cerrado ? (
                <p className={`${CARD} flex items-center gap-2 p-4 text-sm text-neutral-600 dark:text-neutral-300`}>
                    <LockClosedIcon className="h-5 w-5 shrink-0" />
                    Este debate está cerrado y ya no admite respuestas nuevas.
                </p>
            ) : (
                <form onSubmit={enviarRespuesta} className={`${CARD} space-y-3 p-5`} aria-label="Responder">
                    <div className="flex items-baseline justify-between gap-2">
                        <label htmlFor="respuesta" className={LABEL}>
                            Tu respuesta
                        </label>
                        <span className="text-xs text-neutral-400">
                            {respuesta.length}/{MENSAJE_MAX}
                        </span>
                    </div>

                    {citando && (
                        <div className={`${ROW} flex items-start justify-between gap-3 border-l-4 border-l-primary/50 px-3 py-2 text-xs`}>
                            <span className="min-w-0 text-neutral-600 dark:text-neutral-300">
                                <span className="font-semibold">Respondiendo a {nombreDe(citando.idAutor, citando.autor)}</span>
                                <span className="block truncate">{resumen(citando.contenido)}</span>
                            </span>
                            <button
                                type="button"
                                aria-label="Dejar de citar"
                                onClick={() => setCitando(null)}
                                className="shrink-0 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    <textarea
                        ref={redaccion}
                        id="respuesta"
                        value={respuesta}
                        maxLength={MENSAJE_MAX}
                        onChange={(e) => setRespuesta(e.target.value)}
                        placeholder="Escribí tu respuesta con respeto: moderación revisa los reportes."
                        className={TEXTAREA}
                    />

                    {errorRespuesta && (
                        <p
                            role="alert"
                            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                        >
                            {errorRespuesta}
                        </p>
                    )}

                    <div className="flex justify-end">
                        <button type="submit" disabled={enviando} className={BTN_P}>
                            <PaperAirplaneIcon className="h-5 w-5" />
                            {enviando ? "Enviando…" : "Responder"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
