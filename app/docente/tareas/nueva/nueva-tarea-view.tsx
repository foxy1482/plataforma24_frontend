"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ArrowUpTrayIcon,
    CalendarDaysIcon,
    ClockIcon,
    DocumentIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { aUtc, diasEntre, fechaHora, isoFecha, parseFecha } from "@/app/lib/format";
import {
    BTN_G,
    BTN_P,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    INPUT,
    LABEL,
    ROW,
} from "@/app/components/ui";
import { datosDocente, invalidarDocente, materiaDe, type DatosDocente } from "../../datos";
import SinMaterias from "@/app/components/sin-materias";

export default function NuevaTareaView() {
    const router = useRouter();
    const params = useSearchParams();

    const [datos, setDatos] = useState<DatosDocente | null>(null);
    const [error, setError] = useState(false);

    const [idMateria, setIdMateria] = useState<number | null>(null);
    const [titulo, setTitulo] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [fecha, setFecha] = useState("");
    const [hora, setHora] = useState("23:59");
    const [programar, setProgramar] = useState(false);
    const [fechaPub, setFechaPub] = useState("");
    const [horaPub, setHoraPub] = useState("07:45");
    const [tambien, setTambien] = useState<number[]>([]);
    const [archivos, setArchivos] = useState<File[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [aviso, setAviso] = useState("");

    useEffect(() => {
        datosDocente()
            .then((d) => {
                setDatos(d);
                const pedida = params.get("materia");
                setIdMateria(materiaDe(d, pedida ? Number(pedida) : null)?.materia.id ?? null);
                const hoy = new Date();
                const limite = new Date(hoy.getTime() + 7 * 86_400_000);
                setFecha(isoFecha(limite));
                setFechaPub(isoFecha(hoy));
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [params, router]);

    const materia = useMemo(
        () => (datos && idMateria !== null ? materiaDe(datos, idMateria) : null),
        [datos, idMateria]
    );

    // Una materia con el mismo nombre en otro curso: sirve para publicar la tarea en varios cursos.
    const hermanas = useMemo(() => {
        if (!datos || !materia) return [];
        return datos.materias.filter(
            (m) => m.materia.id !== materia.materia.id && m.materia.nombre === materia.materia.nombre
        );
    }, [datos, materia]);

    const limite = parseFecha(`${fecha}T${hora}:00`);
    const cursos = 1 + tambien.length;

    const guardar = async () => {
        if (!materia) return;
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
            const publicadaDesde = aUtc(programar ? `${fechaPub}T${horaPub}:00` : new Date());

            const subidos = [];
            for (const file of archivos) {
                subidos.push(await api.archivos.subir(file));
            }

            const destinos = [materia.materia.id, ...tambien];
            for (const destino of destinos) {
                const tarea = await api.tareas.crear({
                    titulo: titulo.trim(),
                    descripcion: descripcion.trim(),
                    fechaEntrega: aUtc(`${fecha}T${hora}:00`),
                    publicadaDesde,
                    idMateria: destino,
                });
                for (const archivo of subidos) {
                    await api.tareaArchivos
                        .vincular({ idTarea: tarea.id, idArchivo: archivo.id })
                        .catch((e) => console.warn("no se pudo adjuntar", e));
                }
            }

            invalidarDocente();
            router.push(`/docente/materias?materia=${materia.materia.id}`);
        } catch (e) {
            registrarError(e);
            setAviso(
                mensajeDeError(
                    e,
                    e instanceof ApiError
                        ? `No se pudo crear la tarea (${e.status}).`
                        : "No se pudo crear la tarea."
                )
            );
        } finally {
            setGuardando(false);
        }
    };

    if (error) return <ErrorPanel mensaje="No pudimos cargar tus materias." />;
    if (!datos) return <Cargando className="h-96" />;
    if (datos.materias.length === 0) return <SinMaterias />;

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href="/docente/materias" className="hover:underline">
                    Mis materias
                </Link>{" "}
                / Nueva tarea
            </nav>
            <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Nueva tarea
            </h1>

            <div className="flex flex-wrap items-start gap-5">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        guardar();
                    }}
                    className={`${CARD} min-w-0 flex-[999_1_30rem] space-y-5 p-6`}
                >
                    <div>
                        <label className={`${LABEL} mb-1.5 block`} htmlFor="f-mat">
                            Materia
                        </label>
                        <select
                            id="f-mat"
                            className={INPUT}
                            value={idMateria ?? ""}
                            onChange={(e) => {
                                setIdMateria(Number(e.target.value));
                                setTambien([]);
                            }}
                        >
                            {datos.materias.map((m) => (
                                <option key={m.materia.id} value={m.materia.id}>
                                    {m.materia.nombre} · {m.cursoNombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={`${LABEL} mb-1.5 block`} htmlFor="f-tit">
                            Título
                        </label>
                        <input
                            id="f-tit"
                            className={INPUT}
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder="TP Nº4 – Colecciones"
                        />
                    </div>

                    <div>
                        <label className={`${LABEL} mb-1.5 block`} htmlFor="f-desc">
                            Consigna
                        </label>
                        <textarea
                            id="f-desc"
                            rows={7}
                            className={`${INPUT} h-auto resize-y py-3 leading-relaxed`}
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            placeholder="Qué tienen que hacer, cómo se entrega, criterios de corrección…"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className={`${LABEL} mb-1.5 block`} htmlFor="f-fe">
                                Fecha de entrega
                            </label>
                            <input
                                id="f-fe"
                                type="date"
                                className={INPUT}
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={`${LABEL} mb-1.5 block`} htmlFor="f-he">
                                Hora límite
                            </label>
                            <input
                                id="f-he"
                                type="time"
                                className={INPUT}
                                value={hora}
                                onChange={(e) => setHora(e.target.value)}
                            />
                        </div>
                    </div>

                    <fieldset>
                        <legend className={`${LABEL} mb-1.5`}>Publicación</legend>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                aria-pressed={!programar}
                                onClick={() => setProgramar(false)}
                                className={!programar ? BTN_P : BTN_G}
                            >
                                Publicar ahora
                            </button>
                            <button
                                type="button"
                                aria-pressed={programar}
                                onClick={() => setProgramar(true)}
                                className={programar ? BTN_P : BTN_G}
                            >
                                <CalendarDaysIcon className="h-5 w-5" />
                                Programar
                            </button>
                        </div>
                        {programar && (
                            <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={`${LABEL} mb-1.5 block`} htmlFor="f-pd">
                                        Visible desde
                                    </label>
                                    <input
                                        id="f-pd"
                                        type="date"
                                        className={INPUT}
                                        value={fechaPub}
                                        onChange={(e) => setFechaPub(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={`${LABEL} mb-1.5 block`} htmlFor="f-ph">
                                        Hora
                                    </label>
                                    <input
                                        id="f-ph"
                                        type="time"
                                        className={INPUT}
                                        value={horaPub}
                                        onChange={(e) => setHoraPub(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </fieldset>

                    <div>
                        <span className={`${LABEL} mb-1.5 block`}>Archivos adjuntos</span>
                        <label
                            className={`${ROW} flex cursor-pointer flex-col items-center gap-1.5 border-dashed p-6 text-center`}
                        >
                            <ArrowUpTrayIcon className="h-6 w-6 text-neutral-400" />
                            <span className="text-sm text-neutral-700 dark:text-neutral-200">
                                Arrastrá archivos acá o{" "}
                                <span className="text-primary underline">elegilos de tu equipo</span>
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                PDF, DOCX, ZIP, imágenes
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
                        <div className="mt-2.5 space-y-2">
                            {archivos.map((f, i) => (
                                <div key={`${f.name}-${i}`} className={`${ROW} flex items-center gap-3 p-2.5`}>
                                    <DocumentIcon className="h-5 w-5 shrink-0 text-neutral-400" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-neutral-900 dark:text-neutral-100">
                                            {f.name}
                                        </p>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {Math.max(1, Math.round(f.size / 1024))} KB
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label={`Quitar ${f.name}`}
                                        onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-red-500"
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

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

                    <div className="flex flex-wrap justify-end gap-2.5 border-t border-neutral-200 pt-5 dark:border-neutral-700">
                        <Link href="/docente/materias" className={BTN_G}>
                            Cancelar
                        </Link>
                        <button type="submit" disabled={guardando} className={BTN_P}>
                            {guardando
                                ? "Guardando…"
                                : `${programar ? "Programar" : "Publicar"}${cursos > 1 ? ` en ${cursos} cursos` : ""}`}
                        </button>
                    </div>
                </form>

                <aside className="min-w-0 flex-[1_1_18rem]">
                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Así la verá el alumno
                        </h2>
                        <div className={`${ROW} mt-3 p-3.5`}>
                            <div className="flex justify-between gap-2.5">
                                <p className="text-sm font-semibold leading-snug text-neutral-900 dark:text-neutral-100">
                                    {titulo.trim() || "Título de la tarea"}
                                </p>
                                {limite && (
                                    <Chip tono="azul">
                                        {(() => {
                                            const dias = diasEntre(new Date(), limite);
                                            if (dias < 0) return "Vencida";
                                            if (dias === 0) return "Vence hoy";
                                            if (dias === 1) return "Mañana";
                                            return `En ${dias} días`;
                                        })()}
                                    </Chip>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {materia?.materia.nombre}
                            </p>
                            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                                <ClockIcon className="h-4 w-4 shrink-0" />
                                {fechaHora(limite)}
                                {archivos.length > 0 &&
                                    ` · ${archivos.length} ${archivos.length === 1 ? "adjunto" : "adjuntos"}`}
                            </p>
                        </div>
                        {programar && (
                            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                                Recién será visible el {fechaHora(`${fechaPub}T${horaPub}:00`)}.
                            </p>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    );
}
