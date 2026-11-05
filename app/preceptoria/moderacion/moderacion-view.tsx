"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    CheckIcon,
    ExclamationTriangleIcon,
    LockClosedIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { fechaHora, normalizar } from "@/app/lib/format";
import { nombreDe } from "@/app/lib/sesion";
import type { ForoTema, ModoCoincidencia, Palabra, Reporte } from "@/app/lib/types";
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
    Tabs,
    Vacio,
    type Tono,
} from "@/app/components/ui";
import { notificar } from "@/app/components/avisos";

interface ReporteVista {
    reporte: Reporte;
    autor: string;
    reportante: string;
    tema: ForoTema | null;
}

function tonoMotivo(motivo: string | undefined): Tono {
    const m = normalizar(motivo ?? "");
    if (m.includes("agres") || m.includes("insult") || m.includes("acoso")) return "rojo";
    if (m.includes("spam") || m.includes("enlace") || m.includes("link")) return "violeta";
    return "ambar";
}

function coincidencias(texto: string, lista: Palabra[]) {
    const limpio = normalizar(texto);
    return lista
        .filter((p) => p.activa && p.palabra)
        .filter((p) => {
            const palabra = normalizar(p.palabra!);
            if (p.modo === "contiene") return limpio.includes(palabra);
            return new RegExp(`(^|[^\\p{L}\\p{N}])${palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "u").test(
                limpio
            );
        })
        .map((p) => p.palabra!);
}

export default function ModeracionView() {
    const router = useRouter();
    const [pestana, setPestana] = useState<"pendientes" | "resueltos">("pendientes");
    const [reportes, setReportes] = useState<ReporteVista[] | null>(null);
    const [palabras, setPalabras] = useState<Palabra[] | null>(null);
    const [errorPalabras, setErrorPalabras] = useState(false);
    const [error, setError] = useState(false);
    const [trabajando, setTrabajando] = useState<number | null>(null);

    const [nueva, setNueva] = useState("");
    const [modo, setModo] = useState<ModoCoincidencia>("palabra_completa");
    const [prueba, setPrueba] = useState("");

    const cargar = useCallback(async (): Promise<ReporteVista[]> => {
        {
            const [lista, temas] = await Promise.all([
                api.foro.reportes().then((l) => l ?? []),
                api.foro.temas().then(
                    (l) => l ?? [],
                    () => [] as ForoTema[]
                ),
            ]);

            // Para ubicar cada mensaje reportado en su tema hay que mirar los mensajes de cada tema.
            const mensajes = await Promise.all(
                temas.map((t) =>
                    api.foro.mensajes(t.id).then(
                        (l) => ({ tema: t, mensajes: l ?? [] }),
                        () => ({ tema: t, mensajes: [] })
                    )
                )
            );
            const temaDeMensaje = new Map<number, ForoTema>();
            for (const { tema, mensajes: ms } of mensajes) {
                for (const m of ms) temaDeMensaje.set(m.id, tema);
            }

            const nombres = new Map<number, Promise<string>>();
            const nombre = (id: number) => {
                if (!nombres.has(id)) nombres.set(id, nombreDe(id).catch(() => `Usuario ${id}`));
                return nombres.get(id)!;
            };

            return await Promise.all(
                    lista
                        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                        .map(async (reporte): Promise<ReporteVista> => ({
                            reporte,
                            autor: await nombre(reporte.idAutorMensaje),
                            reportante: await nombre(reporte.idReportante),
                            tema: temaDeMensaje.get(reporte.idMensaje) ?? null,
                        }))
            );
        }
    }, []);

    const refrescar = useCallback(() => {
        cargar()
            .then(setReportes)
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [cargar, router]);

    const cargarPalabras = useCallback(() => {
        api.palabras
            .listar()
            .then((l) => {
                setPalabras(l ?? []);
                setErrorPalabras(false);
            })
            .catch((e) => {
                registrarError(e);
                setErrorPalabras(true);
            });
    }, []);

    useEffect(() => {
        refrescar();
        cargarPalabras();
    }, [refrescar, cargarPalabras]);

    const resolver = async (r: ReporteVista, borrarMensaje: boolean) => {
        if (borrarMensaje && !window.confirm("¿Eliminar el mensaje del foro?")) return;
        setTrabajando(r.reporte.id);
        try {
            if (borrarMensaje) await api.foro.eliminarMensaje(r.reporte.idMensaje);
            await api.foro.resolverReporte(r.reporte.id);
            setReportes(await cargar());
        } catch (e) {
            registrarError(e);
            notificar("No se pudo resolver el reporte.");
        } finally {
            setTrabajando(null);
        }
    };

    const cerrarTema = async (r: ReporteVista) => {
        if (!r.tema) return;
        if (!window.confirm(`¿Cerrar el tema "${r.tema.titulo}"? Nadie podrá seguir respondiendo.`)) return;
        setTrabajando(r.reporte.id);
        try {
            await api.foro.modificarTema(r.tema.id, { cerrado: true });
            await api.foro.resolverReporte(r.reporte.id);
            setReportes(await cargar());
        } catch (e) {
            registrarError(e);
            notificar("No se pudo cerrar el tema.");
        } finally {
            setTrabajando(null);
        }
    };

    const agregar = async () => {
        const palabra = nueva.trim();
        if (!palabra) return;
        try {
            await api.palabras.crear(palabra, modo);
            setNueva("");
            cargarPalabras();
        } catch (e) {
            registrarError(e);
            notificar("No se pudo agregar la palabra.");
        }
    };

    const alternar = async (p: Palabra) => {
        try {
            await api.palabras.modificar(p.id, { activa: !p.activa, modo: p.modo });
            setPalabras((prev) =>
                (prev ?? []).map((x) => (x.id === p.id ? { ...x, activa: !x.activa } : x))
            );
        } catch (e) {
            registrarError(e);
            notificar("No se pudo cambiar el filtro.");
        }
    };

    const quitar = async (p: Palabra) => {
        if (!window.confirm(`¿Quitar "${p.palabra}" de la lista?`)) return;
        try {
            await api.palabras.eliminar(p.id);
            cargarPalabras();
        } catch (e) {
            registrarError(e);
            notificar(
                e instanceof ApiError && e.status === 403
                    ? "Solo un directivo puede quitar palabras de la lista. Podés desactivarla con el interruptor."
                    : "No se pudo quitar la palabra."
            );
        }
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar los reportes del foro."
                onReintentar={() => {
                    setError(false);
                    refrescar();
                }}
            />
        );
    }

    const pendientes = (reportes ?? []).filter((r) => !r.reporte.resuelto);
    const resueltos = (reportes ?? []).filter((r) => r.reporte.resuelto);
    const visibles = pestana === "pendientes" ? pendientes : resueltos;
    const golpes = coincidencias(prueba, palabras ?? []);

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            <header>
                <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Moderación del foro
                </h1>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Los alumnos reportan, vos decidís.
                </p>
            </header>

            <div className="flex flex-wrap items-start gap-5">
                <section className="min-w-0 flex-[999_1_30rem]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                            Reportes
                        </h2>
                        <Tabs
                            valor={pestana}
                            onChange={setPestana}
                            opciones={[
                                { valor: "pendientes", label: `Pendientes (${pendientes.length})` },
                                { valor: "resueltos", label: `Resueltos (${resueltos.length})` },
                            ]}
                        />
                    </div>

                    {!reportes ? (
                        <Cargando className="h-64" />
                    ) : visibles.length === 0 ? (
                        <Vacio>
                            {pestana === "pendientes"
                                ? "No hay reportes esperando revisión."
                                : "Todavía no resolviste ningún reporte."}
                        </Vacio>
                    ) : (
                        <div className="space-y-3">
                            {visibles.map((r) => (
                                <article key={r.reporte.id} className={`${CARD} p-4`}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Chip tono={tonoMotivo(r.reporte.motivo)}>
                                                {r.reporte.motivo || "Sin motivo"}
                                            </Chip>
                                            {r.tema && (
                                                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                                    «{r.tema.titulo}»
                                                    {r.tema.cerrado && " · tema cerrado"}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {fechaHora(r.reporte.fecha)}
                                        </span>
                                    </div>

                                    <blockquote className={`${ROW} mt-3 p-3`}>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                            <strong className="text-neutral-700 dark:text-neutral-200">
                                                {r.autor}
                                            </strong>{" "}
                                            escribió:
                                        </p>
                                        <p className="mt-1 text-sm leading-relaxed text-neutral-900 dark:text-neutral-100">
                                            {r.reporte.contenidoMensaje || "(mensaje sin contenido)"}
                                        </p>
                                    </blockquote>

                                    <p className="mt-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                                        Reportado por {r.reportante}
                                    </p>

                                    {!r.reporte.resuelto && (
                                        <div className="mt-3.5 flex flex-wrap gap-2">
                                            <button
                                                onClick={() => resolver(r, true)}
                                                disabled={trabajando === r.reporte.id}
                                                className={`${BTN_R} h-9 text-xs`}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                Eliminar mensaje
                                            </button>
                                            <button
                                                onClick={() => resolver(r, false)}
                                                disabled={trabajando === r.reporte.id}
                                                className={`${BTN_G} h-9 text-xs`}
                                            >
                                                <CheckIcon className="h-4 w-4" />
                                                Mantener y resolver
                                            </button>
                                            {r.tema && !r.tema.cerrado && (
                                                <button
                                                    onClick={() => cerrarTema(r)}
                                                    disabled={trabajando === r.reporte.id}
                                                    className={`${BTN_G} h-9 text-xs`}
                                                >
                                                    <LockClosedIcon className="h-4 w-4" />
                                                    Cerrar el tema
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <aside className="min-w-0 flex-[1_1_19rem] space-y-5">
                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Palabras filtradas
                        </h2>
                        <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                            Los mensajes que las contengan no se publican y el alumno ve un aviso.
                        </p>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                agregar();
                            }}
                            className="mt-3.5 flex flex-wrap gap-2"
                        >
                            <label className="flex-[1_1_8rem]">
                                <span className="sr-only">Nueva palabra o frase</span>
                                <input
                                    value={nueva}
                                    onChange={(e) => setNueva(e.target.value)}
                                    placeholder="Nueva palabra o frase"
                                    className={INPUT}
                                />
                            </label>
                            <label>
                                <span className="sr-only">Modo de coincidencia</span>
                                <select
                                    value={modo}
                                    onChange={(e) => setModo(e.target.value as ModoCoincidencia)}
                                    className={`${INPUT} w-auto`}
                                >
                                    <option value="palabra_completa">Palabra completa</option>
                                    <option value="contiene">Contiene</option>
                                </select>
                            </label>
                            <button type="submit" disabled={errorPalabras} className={BTN_P}>
                                Agregar
                            </button>
                        </form>

                        {errorPalabras ? (
                            <div className="mt-3.5 space-y-2.5">
                                <p className="text-xs leading-relaxed text-red-600 dark:text-red-400">
                                    No pudimos cargar la lista de palabras filtradas. El servidor respondió
                                    con un error, así que por ahora no se puede ver ni editar.
                                </p>
                                <button onClick={cargarPalabras} className={`${BTN_G} h-9 text-xs`}>
                                    Reintentar
                                </button>
                            </div>
                        ) : !palabras ? (
                            <Cargando className="mt-3.5 h-32" />
                        ) : palabras.length === 0 ? (
                            <p className="mt-3.5 text-xs text-neutral-500 dark:text-neutral-400">
                                Todavía no hay palabras filtradas.
                            </p>
                        ) : (
                            <ul className="mt-3.5 space-y-1.5">
                                {palabras.map((p) => (
                                    <li key={p.id} className={`${ROW} flex items-center gap-2.5 p-2.5`}>
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className={`truncate text-sm font-semibold ${p.activa ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400 line-through dark:text-neutral-500"}`}
                                            >
                                                {p.palabra}
                                            </p>
                                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                                {p.modo === "contiene" ? "Contiene" : "Palabra completa"}
                                            </p>
                                        </div>
                                        <button
                                            role="switch"
                                            aria-checked={p.activa}
                                            aria-label={`Filtro activo: ${p.palabra}`}
                                            onClick={() => alternar(p)}
                                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${p.activa ? "bg-teal-600" : "bg-neutral-300 dark:bg-neutral-600"}`}
                                        >
                                            <span
                                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${p.activa ? "left-[1.375rem]" : "left-0.5"}`}
                                            />
                                        </button>
                                        <button
                                            onClick={() => quitar(p)}
                                            aria-label={`Quitar ${p.palabra}`}
                                            className="shrink-0 text-neutral-500 hover:text-red-500"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-lg font-bold text-neutral-900 dark:text-neutral-100">
                            Probar un mensaje
                        </h2>
                        <label htmlFor="tx" className="sr-only">
                            Texto a verificar
                        </label>
                        <textarea
                            id="tx"
                            rows={3}
                            value={prueba}
                            onChange={(e) => setPrueba(e.target.value)}
                            placeholder="Pegá un mensaje para ver si el filtro lo bloquearía"
                            className={`${INPUT} mt-3 h-auto resize-y py-2.5 leading-relaxed`}
                        />
                        {prueba.trim() && (
                            <div
                                className={`${ROW} mt-2.5 flex items-start gap-2.5 p-2.5 ${
                                    golpes.length > 0
                                        ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                                        : "border-teal-300 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/30"
                                }`}
                            >
                                {golpes.length > 0 ? (
                                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-500" />
                                ) : (
                                    <CheckIcon className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
                                )}
                                <p className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-200">
                                    {golpes.length > 0 ? (
                                        <>
                                            Se bloquearía: coincide con{" "}
                                            <strong>{golpes.join(", ")}</strong>.
                                        </>
                                    ) : (
                                        "Este mensaje pasaría el filtro."
                                    )}
                                </p>
                            </div>
                        )}
                        <p className={`${LABEL} mt-3`}>
                            {palabras ? `${palabras.filter((p) => p.activa).length} filtros activos` : ""}
                        </p>
                    </section>
                </aside>
            </div>
        </div>
    );
}
