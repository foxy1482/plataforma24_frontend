"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    ArrowDownTrayIcon,
    ArrowsPointingInIcon,
    DocumentIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
    PhotoIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import type { Archivo } from "@/app/lib/types";
import { Cargando } from "@/app/components/ui";
import { notificar } from "@/app/components/avisos";

type ArchivoRef = Pick<Archivo, "id" | "nombreOriginal">;
type Tipo = "pdf" | "docx" | "imagen" | "texto" | "video" | "otro";

const TEXTO = /\.(txt|java|cs|js|ts|tsx|jsx|py|c|cpp|h|html|css|json|sql|md|xml|csv|php|rb|go|sh|log|yml|yaml)$/i;
const IMAGEN = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const VIDEO = /\.(mp4|webm|ogv)$/i;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5;
const PASOS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];
const ESCALA_RENDER_MAX = 5;

function tipoDe(nombre: string): Tipo {
    if (/\.pdf$/i.test(nombre)) return "pdf";
    if (/\.docx$/i.test(nombre)) return "docx";
    if (IMAGEN.test(nombre)) return "imagen";
    if (VIDEO.test(nombre)) return "video";
    if (TEXTO.test(nombre)) return "texto";
    return "otro";
}

const nombreDe = (a: ArchivoRef) => a.nombreOriginal || `archivo-${a.id}`;
const limitar = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
const masZoom = (z: number) => PASOS.find((p) => p > z + 0.001) ?? ZOOM_MAX;
const menosZoom = (z: number) => [...PASOS].reverse().find((p) => p < z - 0.001) ?? ZOOM_MIN;

export async function descargarArchivo(archivo: ArchivoRef) {
    try {
        const blob = await api.archivos.descargar(archivo.id);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = nombreDe(archivo);
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
        notificar(
            e instanceof ApiError && e.status === 403
                ? "No tenés permiso para descargar este archivo."
                : "No se pudo descargar el archivo."
        );
    }
}

interface Carga {
    id: number;
    blob?: Blob;
    url?: string; // solo imágenes y video
    error?: string;
}

function useContenido(id: number, tipo: Tipo): Carga | null {
    const [carga, setCarga] = useState<Carga | null>(null);

    useEffect(() => {
        if (tipo === "otro") return;
        let vivo = true;
        let url: string | undefined;
        api.archivos.ver(id).then(
            (blob) => {
                if (!vivo) return;
                if (tipo === "imagen" || tipo === "video") url = URL.createObjectURL(blob);
                setCarga({ id, blob, url });
            },
            (e) => {
                if (!vivo) return;
                setCarga({
                    id,
                    error:
                        e instanceof ApiError && e.status === 403
                            ? "No tenés permiso para ver este archivo."
                            : "No se pudo abrir el archivo. Probá descargarlo.",
                });
            }
        );
        return () => {
            vivo = false;
            if (url) URL.revokeObjectURL(url);
        };
    }, [id, tipo]);

    return carga?.id === id ? carga : null;
}

/* -------------------------------------------------------------------------- */
/*  Vistas por tipo                                                           */
/*  zoom 1 = ajustado al ancho; `ancho` = ancho útil del visor en px          */
/* -------------------------------------------------------------------------- */

const MARGEN = 16;

function VistaImagen({ url, nombre, zoom, ancho }: { url: string; nombre: string; zoom: number; ancho: number }) {
    const [natural, setNatural] = useState<number | null>(null);
    const base = natural ? Math.min(ancho - 2 * MARGEN, natural) : ancho - 2 * MARGEN;
    return (
        <div className="w-max min-w-full p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={url}
                alt={nombre}
                onLoad={(e) => setNatural(e.currentTarget.naturalWidth)}
                style={{
                    display: "block",
                    margin: "0 auto",
                    maxWidth: "none",
                    width: `${base * zoom}px`,
                    opacity: natural ? 1 : 0,
                }}
            />
        </div>
    );
}

function VistaPdf({ blob, zoom, ancho }: { blob: Blob; zoom: number; ancho: number }) {
    const host = useRef<HTMLDivElement>(null);
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [error, setError] = useState(false);
    const disponible = Math.max(200, ancho - 2 * MARGEN);

    useEffect(() => {
        let vivo = true;
        let tarea: PDFDocumentLoadingTask | null = null;
        (async () => {
            try {
                // Build "legacy": la principal usa APIs de navegadores muy nuevos (ej. Uint8Array.toHex, Chrome 140+)
                const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
                pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
                const data = new Uint8Array(await blob.arrayBuffer());
                tarea = pdfjs.getDocument({ data });
                const cargado = await tarea.promise;
                if (vivo) setDoc(cargado);
            } catch (e) {
                registrarError("[visor] no se pudo leer el PDF:", e instanceof Error ? `${e.name}: ${e.message}` : e);
                if (vivo) setError(true);
            }
        })();
        return () => {
            vivo = false;
            tarea?.destroy();
        };
    }, [blob]);

    useLayoutEffect(() => {
        const contenedor = host.current;
        if (!contenedor) return;
        for (const hijo of Array.from(contenedor.children)) {
            const canvas = hijo as HTMLCanvasElement;
            const proporcion = Number(canvas.dataset.proporcion);
            if (!proporcion) continue;
            canvas.style.width = `${Math.floor(disponible * zoom)}px`;
            canvas.style.height = `${Math.floor(disponible * zoom * proporcion)}px`;
        }
    }, [zoom, disponible]);

    useEffect(() => {
        const contenedor = host.current;
        if (!doc || !contenedor) return;

        let cancelado = false;
        const tareas: RenderTask[] = [];

        const dibujar = async () => {
            const dpr = window.devicePixelRatio || 1;
            const progresivo = contenedor.childElementCount === 0;
            const nuevas: HTMLCanvasElement[] = [];

            try {
                for (let n = 1; n <= doc.numPages; n++) {
                    const pagina = await doc.getPage(n);
                    if (cancelado) return;

                    const base = pagina.getViewport({ scale: 1 });
                    const escala = (disponible / base.width) * zoom;
                    const escalaRender = Math.min(escala * dpr, ESCALA_RENDER_MAX);
                    const viewport = pagina.getViewport({ scale: escalaRender });

                    const canvas = document.createElement("canvas");
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);
                    canvas.dataset.proporcion = String(base.height / base.width);
                    canvas.style.cssText = `display:block;margin:0 auto 16px;background:#fff;box-shadow:0 1px 4px rgb(0 0 0/.25);width:${Math.floor(disponible * zoom)}px;height:${Math.floor(disponible * zoom * (base.height / base.width))}px`;
                    canvas.setAttribute("aria-label", `Página ${n} de ${doc.numPages}`);

                    const tarea = pagina.render({ canvas, viewport });
                    tareas.push(tarea);
                    await tarea.promise;
                    if (cancelado) return;

                    if (progresivo) contenedor.appendChild(canvas);
                    else nuevas.push(canvas);
                }
                if (!progresivo) contenedor.replaceChildren(...nuevas);
            } catch (e) {
                // Un render cancelado por un cambio de zoom no es un error
                if (!cancelado) {
                    registrarError("[visor] falló el render del PDF:", e instanceof Error ? `${e.name}: ${e.message}` : e);
                    setError(true);
                }
            }
        };

        // Con zoom por rueda llegan muchos cambios seguidos: se redibuja recién cuando se frena
        const espera = contenedor.childElementCount === 0 ? 0 : 150;
        const temporizador = setTimeout(dibujar, espera);

        return () => {
            cancelado = true;
            clearTimeout(temporizador);
            tareas.forEach((t) => t.cancel());
        };
    }, [doc, zoom, disponible]);

    if (error) return <Mensaje>No se pudo mostrar el PDF. Probá descargarlo.</Mensaje>;
    return (
        <>
            {!doc && <Cargando className="m-4 h-64" />}
            <div ref={host} className="p-4" />
        </>
    );
}

function VistaDocx({ blob, zoom, ancho }: { blob: Blob; zoom: number; ancho: number }) {
    const host = useRef<HTMLDivElement>(null);
    const [ajuste, setAjuste] = useState(1);
    const [listo, setListo] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const contenedor = host.current;
        if (!contenedor) return;
        let vivo = true;
        (async () => {
            try {
                const { renderAsync } = await import("docx-preview");
                contenedor.replaceChildren();
                await renderAsync(blob, contenedor, undefined, {
                    className: "docx",
                    inWrapper: true,
                    breakPages: true,
                });
                if (!vivo) return;
                // Las páginas de Word tienen ancho fijo: a zoom 1 se achican para entrar en el visor
                const pagina = contenedor.firstElementChild?.scrollWidth ?? 0;
                const disponible = ancho - 2 * MARGEN;
                setAjuste(pagina > 0 && disponible > 0 && pagina > disponible ? disponible / pagina : 1);
                setListo(true);
            } catch (e) {
                registrarError("[visor] no se pudo leer el DOCX:", e instanceof Error ? `${e.name}: ${e.message}` : e);
                if (vivo) setError(true);
            }
        })();
        return () => {
            vivo = false;
        };
        // `ancho` solo se usa para el ajuste inicial: redibujar el documento al redimensionar no hace falta
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blob]);

    if (error) return <Mensaje>No se pudo mostrar el documento. Probá descargarlo.</Mensaje>;
    return (
        <>
            {!listo && <Cargando className="m-4 h-64" />}
            <div
                ref={host}
                className="p-4 [&_.docx-wrapper]:bg-transparent! [&_.docx-wrapper]:p-0!"
                style={{ zoom: ajuste * zoom }}
            />
        </>
    );
}

function VistaTexto({ blob, zoom, ancho }: { blob: Blob; zoom: number; ancho: number }) {
    const [texto, setTexto] = useState<string | null>(null);

    useEffect(() => {
        let vivo = true;
        blob.text().then((t) => vivo && setTexto(t.slice(0, 500_000)));
        return () => {
            vivo = false;
        };
    }, [blob]);

    if (texto === null) return <Cargando className="m-4 h-64" />;
    return (
        <pre
            className="p-4 leading-relaxed text-neutral-800 dark:text-neutral-200"
            style={{ fontSize: `${12 * zoom}px`, width: ancho }}
        >
            {texto.split("\n").map((linea, i) => (
                <span key={i} className="flex">
                    <span className="mr-4 w-8 shrink-0 select-none text-right text-neutral-400">{i + 1}</span>
                    <span className="whitespace-pre-wrap break-all">{linea}</span>
                </span>
            ))}
        </pre>
    );
}

function Mensaje({ children }: { children: React.ReactNode }) {
    return <p className="p-10 text-center text-sm text-neutral-500 dark:text-neutral-400">{children}</p>;
}

/* -------------------------------------------------------------------------- */
/*  Visor con barra de herramientas                                           */
/* -------------------------------------------------------------------------- */

const BTN_ICONO =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-700";

interface Punto {
    x: number;
    y: number;
}

// Punto del documento (en fracción de su tamaño) que debe quedar bajo `ancla` tras el zoom
interface Anclaje {
    ax: number;
    ay: number;
    fx: number;
    fy: number;
}

export function VisorContenido({
    archivo,
    className = "h-[32rem]",
    onCerrar,
}: {
    archivo: ArchivoRef;
    className?: string;
    // Si se pasa, el visor se comporta como diálogo: botón de cerrar y atajos de teclado
    onCerrar?: () => void;
}) {
    const nombre = nombreDe(archivo);
    const tipo = tipoDe(nombre);
    const conZoom = tipo === "pdf" || tipo === "docx" || tipo === "imagen" || tipo === "texto";

    const [zoom, setZoom] = useState(1);
    const [ancho, setAncho] = useState(0);
    const vista = useRef<HTMLDivElement>(null);
    const documento = useRef<HTMLDivElement>(null);
    const zoomActual = useRef(1);
    const anclaje = useRef<Anclaje | null>(null);
    const cursor = useRef<Punto | null>(null); // última posición del mouse sobre el visor
    const contenido = useContenido(archivo.id, tipo);

    // Cambia el zoom manteniendo fijo el punto `ancla` (coordenadas relativas al visor).
    // Sin ancla se usa el cursor si está sobre el visor, y si no el centro.
    const cambiarZoom = useCallback((pedido: number, ancla?: Punto | null) => {
        const el = vista.current;
        const doc = documento.current;
        const nuevo = limitar(pedido);
        if (Math.abs(nuevo - zoomActual.current) < 0.0005) return;

        if (el && doc) {
            const punto = ancla ?? cursor.current ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
            const s = el.getBoundingClientRect();
            const d = doc.getBoundingClientRect();
            const w = d.width - 2 * MARGEN;
            const h = d.height - 2 * MARGEN;
            if (w > 0 && h > 0) {
                anclaje.current = {
                    ax: punto.x,
                    ay: punto.y,
                    fx: (s.left + punto.x - d.left - MARGEN) / w,
                    fy: (s.top + punto.y - d.top - MARGEN) / h,
                };
            }
        }
        zoomActual.current = nuevo;
        setZoom(nuevo);
    }, []);

    // Ya con el nuevo tamaño en el DOM: se corrige el scroll para que el punto siga bajo el cursor
    useLayoutEffect(() => {
        const a = anclaje.current;
        anclaje.current = null;
        const el = vista.current;
        const doc = documento.current;
        if (!a || !el || !doc) return;
        const s = el.getBoundingClientRect();
        const d = doc.getBoundingClientRect();
        const w = d.width - 2 * MARGEN;
        const h = d.height - 2 * MARGEN;
        if (w <= 0 || h <= 0) return;
        el.scrollLeft += d.left + MARGEN + a.fx * w - (s.left + a.ax);
        el.scrollTop += d.top + MARGEN + a.fy * h - (s.top + a.ay);
    }, [zoom]);

    // Ancho útil del visor (sin la barra de scroll), para ajustar el contenido
    useEffect(() => {
        const el = vista.current;
        if (!el) return;
        const medir = () => setAncho(el.clientWidth);
        const observador = new ResizeObserver(medir);
        observador.observe(el);
        return () => observador.disconnect();
    }, []);

    // Ctrl + rueda (o pellizco en trackpad) hace zoom hacia el cursor. El listener no puede ser
    // pasivo para poder frenar el zoom de toda la página del navegador.
    useEffect(() => {
        const el = vista.current;
        if (!el || !conZoom) return;
        const alRodar = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const caja = el.getBoundingClientRect();
            cambiarZoom(zoomActual.current * (e.deltaY < 0 ? 1.1 : 0.9), {
                x: e.clientX - caja.left,
                y: e.clientY - caja.top,
            });
        };
        el.addEventListener("wheel", alRodar, { passive: false });
        return () => el.removeEventListener("wheel", alRodar);
    }, [conZoom, cambiarZoom]);

    useEffect(() => {
        if (!onCerrar) return;
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCerrar();
            else if (!conZoom) return;
            else if (e.key === "+" || e.key === "=") cambiarZoom(masZoom(zoomActual.current));
            else if (e.key === "-") cambiarZoom(menosZoom(zoomActual.current));
            else if (e.key === "0") cambiarZoom(1);
        };
        document.addEventListener("keydown", alTeclear);
        return () => document.removeEventListener("keydown", alTeclear);
    }, [onCerrar, conZoom, cambiarZoom]);

    // Los botones de la barra no tienen cursor sobre el documento: se hace zoom al centro de la vista
    const alCentro = (nuevo: number) => {
        const el = vista.current;
        cambiarZoom(nuevo, el ? { x: el.clientWidth / 2, y: el.clientHeight / 2 } : null);
    };

    let cuerpo: React.ReactNode;
    if (tipo === "otro") {
        cuerpo = <Mensaje>{nombre} no se puede previsualizar acá. Podés descargarlo.</Mensaje>;
    } else if (!contenido || ancho === 0) {
        cuerpo = <Cargando className="m-4 h-64" />;
    } else if (contenido.error || !contenido.blob) {
        cuerpo = <Mensaje>{contenido.error ?? "No se pudo abrir el archivo."}</Mensaje>;
    } else if (tipo === "imagen" && contenido.url) {
        cuerpo = <VistaImagen url={contenido.url} nombre={nombre} zoom={zoom} ancho={ancho} />;
    } else if (tipo === "video" && contenido.url) {
        cuerpo = (
            <div className="p-4">
                <video src={contenido.url} controls className="mx-auto max-h-full max-w-full" />
            </div>
        );
    } else if (tipo === "pdf") {
        cuerpo = <VistaPdf blob={contenido.blob} zoom={zoom} ancho={ancho} />;
    } else if (tipo === "docx") {
        cuerpo = <VistaDocx blob={contenido.blob} zoom={zoom} ancho={ancho} />;
    } else {
        cuerpo = <VistaTexto blob={contenido.blob} zoom={zoom} ancho={ancho} />;
    }

    return (
        <div className={`flex min-h-0 flex-col ${className}`}>
            <div className="flex items-center gap-1 border-b border-neutral-200 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                    {nombre}
                </p>
                {conZoom && (
                    <div className="flex items-center" role="group" aria-label="Zoom">
                        <button type="button" onClick={() => alCentro(menosZoom(zoom))} disabled={zoom <= ZOOM_MIN} aria-label="Alejar" title="Alejar (-)" className={BTN_ICONO}>
                            <MagnifyingGlassMinusIcon className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => alCentro(1)}
                            aria-label="Restablecer zoom"
                            title="Ajustar al ancho (0)"
                            className="w-12 rounded-lg text-center text-xs tabular-nums text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                        >
                            {Math.round(zoom * 100)}%
                        </button>
                        <button type="button" onClick={() => alCentro(masZoom(zoom))} disabled={zoom >= ZOOM_MAX} aria-label="Acercar" title="Acercar (+)" className={BTN_ICONO}>
                            <MagnifyingGlassPlusIcon className="h-5 w-5" />
                        </button>
                        <button type="button" onClick={() => alCentro(1)} aria-label="Ajustar al ancho" title="Ajustar al ancho" className={`${BTN_ICONO} hidden sm:flex`}>
                            <ArrowsPointingInIcon className="h-5 w-5" />
                        </button>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => descargarArchivo(archivo)}
                    aria-label={`Descargar ${nombre}`}
                    title="Descargar"
                    className={BTN_ICONO}
                >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                </button>
                {onCerrar && (
                    <button type="button" onClick={onCerrar} aria-label="Cerrar visor" title="Cerrar (Esc)" className={BTN_ICONO}>
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                )}
            </div>
            <div
                ref={vista}
                onPointerMove={(e) => {
                    const caja = e.currentTarget.getBoundingClientRect();
                    cursor.current = { x: e.clientX - caja.left, y: e.clientY - caja.top };
                }}
                onPointerLeave={() => (cursor.current = null)}
                className="min-h-0 flex-1 overflow-auto bg-neutral-200 dark:bg-neutral-950"
            >
                <div ref={documento} className="w-max min-w-full">
                    {cuerpo}
                </div>
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Ventana emergente + chip del archivo                                      */
/* -------------------------------------------------------------------------- */

function VisorModal({ archivo, onCerrar }: { archivo: ArchivoRef; onCerrar: () => void }) {
    const dialogo = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previo = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialogo.current?.focus();
        return () => {
            document.body.style.overflow = previo;
        };
    }, []);

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-6"
            onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
        >
            <div
                ref={dialogo}
                role="dialog"
                aria-modal="true"
                aria-label={`Vista previa de ${nombreDe(archivo)}`}
                tabIndex={-1}
                className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none dark:bg-neutral-900"
            >
                <VisorContenido archivo={archivo} className="h-full" onCerrar={onCerrar} />
            </div>
        </div>,
        document.body
    );
}

// Archivo adjunto: el botón principal abre el visor y el pequeño de la derecha lo descarga.
export function ArchivoChip({ archivo, bloque = false }: { archivo: ArchivoRef; bloque?: boolean }) {
    const [abierto, setAbierto] = useState(false);
    const nombre = nombreDe(archivo);
    const Icono = tipoDe(nombre) === "imagen" ? PhotoIcon : DocumentIcon;

    return (
        <>
            <span
                className={`items-stretch overflow-hidden border border-neutral-300 text-neutral-600 dark:border-neutral-600 dark:text-neutral-300 ${
                    bloque
                        ? "flex w-full rounded-xl bg-neutral-50 text-sm text-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-200"
                        : "inline-flex rounded-lg text-xs"
                }`}
            >
                <button
                    type="button"
                    onClick={() => setAbierto(true)}
                    title="Ver"
                    className={`flex min-w-0 flex-1 items-center gap-1.5 text-left hover:text-primary ${bloque ? "p-3" : "px-2 py-1"}`}
                >
                    <Icono className={`shrink-0 ${bloque ? "h-5 w-5 text-primary" : "h-4 w-4"}`} />
                    <span className="truncate">{nombre}</span>
                </button>
                <button
                    type="button"
                    onClick={() => descargarArchivo(archivo)}
                    aria-label={`Descargar ${nombre}`}
                    title="Descargar"
                    className="flex shrink-0 items-center border-l border-neutral-300 px-2 hover:bg-neutral-100 hover:text-primary dark:border-neutral-600 dark:hover:bg-neutral-800"
                >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                </button>
            </span>
            {abierto && <VisorModal archivo={archivo} onCerrar={() => setAbierto(false)} />}
        </>
    );
}
