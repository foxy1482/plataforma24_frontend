"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ArrowUpTrayIcon,
    DocumentIcon,
    MagnifyingGlassIcon,
    TrashIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { aUtc, fechaHora, normalizar, parseFecha } from "@/app/lib/format";
import { ArchivoChip } from "@/app/components/visor-archivos";
import type { Archivo, Material } from "@/app/lib/types";
import {
    BTN_P,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    INPUT,
    LABEL,
    ROW,
    Select,
    Vacio,
} from "@/app/components/ui";
import { datosDocente, materiaDe, type DatosDocente } from "../datos";
import { notificar } from "@/app/components/avisos";

interface Item {
    material: Material;
    archivos: Archivo[];
    publicada: Date | null;
    programado: boolean;
}

function mesDe(fecha: Date | null) {
    if (!fecha) return "Sin fecha";
    const texto = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(fecha);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function MaterialesView() {
    const router = useRouter();
    const params = useSearchParams();

    const [datos, setDatos] = useState<DatosDocente | null>(null);
    const [items, setItems] = useState<Item[] | null>(null);
    const [error, setError] = useState(false);
    const [busqueda, setBusqueda] = useState("");

    const [titulo, setTitulo] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [visible, setVisible] = useState("");
    const [archivos, setArchivos] = useState<File[]>([]);
    const [tambien, setTambien] = useState<number[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [aviso, setAviso] = useState("");

    const idMateria = params.get("materia") ? Number(params.get("materia")) : null;

    useEffect(() => {
        datosDocente()
            .then((d) => {
                setDatos(d);
                const ahora = new Date();
                setVisible(
                    `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}T${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`
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
    }, [router]);

    const materia = useMemo(() => (datos ? materiaDe(datos, idMateria) : null), [datos, idMateria]);

    const hermanas = useMemo(() => {
        if (!datos || !materia) return [];
        return datos.materias.filter(
            (m) => m.materia.id !== materia.materia.id && m.materia.nombre === materia.materia.nombre
        );
    }, [datos, materia]);

    const cargarLista = useCallback(async (): Promise<Item[]> => {
        if (!materia) return [];
        {
            const lista = (await api.materiales.porMateria(materia.materia.id)) ?? [];
            const adjuntos = await Promise.all(
                lista.map((m) =>
                    api.materialArchivos.porMaterial(m.id).then(
                        (l) => l ?? [],
                        () => []
                    )
                )
            );
            const ahora = Date.now();
            return (
                lista
                    .map((material, i): Item => {
                        const publicada = parseFecha(material.publicadaDesde);
                        return {
                            material,
                            archivos: adjuntos[i],
                            publicada,
                            programado: Boolean(publicada && publicada.getTime() > ahora),
                        };
                    })
                    .sort((a, b) => (b.publicada?.getTime() ?? 0) - (a.publicada?.getTime() ?? 0))
            );
        }
    }, [materia]);

    const refrescar = useCallback(() => {
        cargarLista()
            .then(setItems)
            .catch((e) => {
                registrarError(e);
                setError(true);
            });
    }, [cargarLista]);

    useEffect(() => {
        refrescar();
    }, [refrescar]);

    const publicar = async () => {
        if (!materia) return;
        if (!titulo.trim()) {
            setAviso("Ponele un título al material.");
            return;
        }
        setAviso("");
        setGuardando(true);
        let sinAdjuntar = 0;
        try {
            const subidos = [];
            for (const file of archivos) {
                subidos.push(await api.archivos.subir(file));
            }
            const destinos = [materia.materia.id, ...tambien];
            for (const destino of destinos) {
                const material = await api.materiales.crear({
                    titulo: titulo.trim(),
                    descripcion: descripcion.trim(),
                    publicadaDesde: aUtc(visible ? `${visible}:00` : new Date()),
                    idMateria: destino,
                });
                for (const archivo of subidos) {
                    await api.materialArchivos
                        .vincular({ idMaterial: material.id, idArchivo: archivo.id })
                        .catch((e) => {
                            sinAdjuntar++;
                            console.warn("no se pudo adjuntar", e);
                        });
                }
            }
            setTitulo("");
            setDescripcion("");
            setArchivos([]);
            setTambien([]);
            if (sinAdjuntar > 0) {
                setAviso(
                    `El material se publicó, pero no se pudo adjuntar ${sinAdjuntar} ${sinAdjuntar === 1 ? "archivo" : "archivos"}.`
                );
            }
            setItems(await cargarLista());
        } catch (e) {
            registrarError(e);
            setAviso(
                e instanceof ApiError && e.status === 403
                    ? "Tu usuario no tiene permiso para publicar materiales."
                    : mensajeDeError(
                          e,
                          e instanceof ApiError
                              ? `No se pudo publicar el material (${e.status}).`
                              : "No se pudo publicar el material."
                      )
            );
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async (item: Item) => {
        if (!window.confirm(`¿Eliminar "${item.material.titulo}"?`)) return;
        try {
            await api.materiales.eliminar(item.material.id);
            setItems(await cargarLista());
        } catch (e) {
            registrarError(e);
            notificar(
                e instanceof ApiError && e.status === 403
                    ? "Tu usuario no tiene permiso para eliminar materiales."
                    : "No se pudo eliminar el material."
            );
        }
    };


    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar los materiales."
                onReintentar={() => {
                    setError(false);
                    refrescar();
                }}
            />
        );
    }
    if (!datos) return <Cargando className="h-96" />;
    if (datos.materias.length === 0 || !materia) {
        return <Vacio>No tenés materias asignadas todavía.</Vacio>;
    }

    const q = normalizar(busqueda.trim());
    const visibles = (items ?? []).filter(
        (i) =>
            !q ||
            normalizar(i.material.titulo ?? "").includes(q) ||
            normalizar(i.material.descripcion ?? "").includes(q)
    );

    const grupos = new Map<string, Item[]>();
    for (const item of visibles) {
        const clave = mesDe(item.publicada);
        grupos.set(clave, [...(grupos.get(clave) ?? []), item]);
    }

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Materiales de clase
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        Apuntes, presentaciones y código de ejemplo para los alumnos
                    </p>
                </div>
                <label className="relative block w-full sm:w-60">
                    <span className="sr-only">Buscar material</span>
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar material"
                        className={`${INPUT} pl-10`}
                    />
                </label>
            </header>

            <Select
                label="Materia y curso"
                valor={materia.materia.id}
                onChange={(v) => router.replace(`/docente/materiales?materia=${v}`)}
            >
                {datos.materias.map((m) => (
                    <option key={m.materia.id} value={m.materia.id}>
                        {m.materia.nombre} · {m.cursoNombre}
                    </option>
                ))}
            </Select>

            <div className="flex flex-wrap items-start gap-5">
                <section className="min-w-0 flex-[999_1_28rem] space-y-5">
                    {!items ? (
                        <Cargando className="h-64" />
                    ) : visibles.length === 0 ? (
                        <Vacio>
                            {q
                                ? `Ningún material coincide con "${busqueda}".`
                                : "Todavía no publicaste materiales en esta materia."}
                        </Vacio>
                    ) : (
                        [...grupos.entries()].map(([mes, lista]) => (
                            <div key={mes}>
                                <div className="mb-2.5 flex items-baseline justify-between gap-2">
                                    <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                        {mes}
                                    </h2>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                        {lista.length} {lista.length === 1 ? "material" : "materiales"}
                                    </span>
                                </div>
                                <div className="space-y-2.5">
                                    {lista.map((item) => (
                                        <article key={item.material.id} className={`${CARD} p-4`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
                                                            {item.material.titulo}
                                                        </h3>
                                                        <Chip tono={item.programado ? "violeta" : "verde"}>
                                                            {item.programado ? "Programado" : "Publicado"}
                                                        </Chip>
                                                    </div>
                                                    {item.material.descripcion && (
                                                        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                                                            {item.material.descripcion}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => eliminar(item)}
                                                    aria-label={`Eliminar ${item.material.titulo}`}
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                            {item.archivos.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {item.archivos.map((a) => (
                                                        <ArchivoChip key={a.id} archivo={a} />
                                                    ))}
                                                </div>
                                            )}
                                            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                                                {item.programado ? "Visible desde" : "Publicado"}{" "}
                                                {fechaHora(item.publicada)}
                                            </p>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </section>

                <aside className="min-w-0 flex-[1_1_19rem]">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            publicar();
                        }}
                        className={`${CARD} space-y-4 p-5`}
                    >
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Publicar material
                        </h2>

                        <div>
                            <label className={`${LABEL} mb-1.5 block`} htmlFor="m-t">
                                Título
                            </label>
                            <input
                                id="m-t"
                                className={INPUT}
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                                placeholder="Apunte: herencia en Java"
                            />
                        </div>

                        <div>
                            <label className={`${LABEL} mb-1.5 block`} htmlFor="m-d">
                                Descripción
                            </label>
                            <textarea
                                id="m-d"
                                rows={3}
                                className={`${INPUT} h-auto resize-y py-2.5 leading-relaxed`}
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className={`${LABEL} mb-1.5 block`} htmlFor="m-v">
                                Visible desde
                            </label>
                            <input
                                id="m-v"
                                type="datetime-local"
                                className={INPUT}
                                value={visible}
                                onChange={(e) => setVisible(e.target.value)}
                            />
                        </div>

                        <label
                            className={`${ROW} flex cursor-pointer flex-col items-center gap-1.5 border-dashed p-5 text-center`}
                        >
                            <ArrowUpTrayIcon className="h-6 w-6 text-neutral-400" />
                            <span className="text-sm text-neutral-700 dark:text-neutral-200">
                                Arrastrá o <span className="text-primary underline">elegí archivos</span>
                            </span>
                            <input
                                type="file"
                                multiple
                                className="sr-only"
                                onChange={(e) =>
                                    setArchivos((prev) => [...prev, ...Array.from(e.target.files ?? [])])
                                }
                            />
                        </label>

                        {archivos.map((f, i) => (
                            <div key={`${f.name}-${i}`} className={`${ROW} flex items-center gap-2.5 p-2.5`}>
                                <DocumentIcon className="h-4 w-4 shrink-0 text-neutral-400" />
                                <span className="min-w-0 flex-1 truncate text-xs text-neutral-700 dark:text-neutral-200">
                                    {f.name}
                                </span>
                                <button
                                    type="button"
                                    aria-label={`Quitar ${f.name}`}
                                    onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                                    className="text-neutral-400 hover:text-red-500"
                                >
                                    <XMarkIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ))}

                        {hermanas.length > 0 && (
                            <fieldset>
                                <legend className={`${LABEL} mb-1.5`}>Publicar también en</legend>
                                {hermanas.map((m) => (
                                    <label
                                        key={m.materia.id}
                                        className="flex min-h-8 items-center gap-2.5 text-sm text-neutral-700 dark:text-neutral-200"
                                    >
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 accent-primary"
                                            checked={tambien.includes(m.materia.id)}
                                            onChange={(e) =>
                                                setTambien((prev) =>
                                                    e.target.checked
                                                        ? [...prev, m.materia.id]
                                                        : prev.filter((id) => id !== m.materia.id)
                                                )
                                            }
                                        />
                                        {m.materia.nombre} · {m.cursoNombre}
                                    </label>
                                ))}
                            </fieldset>
                        )}

                        {aviso && <p className="text-sm text-red-600 dark:text-red-400">{aviso}</p>}

                        <button type="submit" disabled={guardando} className={`${BTN_P} w-full`}>
                            {guardando ? "Publicando…" : "Publicar material"}
                        </button>
                    </form>
                </aside>
            </div>
        </div>
    );
}
