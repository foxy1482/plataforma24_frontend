"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ArrowUpTrayIcon,
    BookOpenIcon,
    ClockIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { fechaCorta, fechaHora, numero, parseFecha, promedio, notaNumerica } from "@/app/lib/format";
import type { Curso, ForoTema } from "@/app/lib/types";
import MateriaForm from "@/app/components/materia-form";
import {
    BTN_G,
    BTN_P,
    BTN_R,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    LABEL,
    ROW,
    Select,
    Vacio,
    type Tono,
} from "@/app/components/ui";
import {
    datosDocente,
    ETIQUETA_ESTADO,
    invalidarDocente,
    materiaDe,
    type DatosDocente,
    type EstadoTarea,
    type MateriaDocente,
    type TareaDocente,
} from "../datos";
import { notificar } from "@/app/components/avisos";

const TONO_ESTADO: Record<EstadoTarea, Tono> = {
    programada: "violeta",
    abierta: "azul",
    "para-corregir": "ambar",
    cerrada: "gris",
};

type Filtro = "todas" | EstadoTarea;
type Pestana = "tareas" | "alumnos" | "foro";

function textoFecha(t: TareaDocente) {
    if (t.estado === "programada") {
        return `Se publica ${fechaHora(t.publicada)}${t.vence ? ` · vence ${fechaCorta(t.vence)}` : ""}`;
    }
    if (!t.vence) return "Sin fecha de entrega";
    return t.vence.getTime() >= Date.now()
        ? `Vence ${fechaHora(t.vence)}`
        : `Venció ${fechaHora(t.vence)}`;
}

function cumplimiento(m: MateriaDocente) {
    const publicadas = m.tareas.filter((t) => t.estado !== "programada");
    return m.alumnos
        .map((a) => {
            const entregadas = publicadas.filter((t) =>
                t.entregas.some((e) => e.idUsuario === a.idUsuario)
            );
            const notas = publicadas
                .flatMap((t) => t.entregas.filter((e) => e.idUsuario === a.idUsuario))
                .map((e) => notaNumerica(e.calificacion))
                .filter((n): n is number => n !== null);
            return {
                id: a.idUsuario,
                nombre: `${a.apellido}, ${a.nombre}`,
                entregadas: entregadas.length,
                total: publicadas.length,
                promedio: promedio(notas),
            };
        })
        .sort((a, b) => a.entregadas - b.entregadas || (a.promedio ?? 10) - (b.promedio ?? 10));
}

function aTiempo(m: MateriaDocente) {
    let total = 0;
    let puntuales = 0;
    for (const t of m.tareas) {
        const limite = t.vence?.getTime();
        for (const e of t.entregas) {
            total++;
            const hecha = parseFecha(e.fechaEntrega)?.getTime();
            if (!limite || (hecha !== undefined && hecha <= limite)) puntuales++;
        }
    }
    return total === 0 ? null : Math.round((puntuales / total) * 100);
}

export default function AulaView() {
    const router = useRouter();
    const params = useSearchParams();
    const seleccionada = params.get("materia");

    const [datos, setDatos] = useState<DatosDocente | null>(null);
    const [error, setError] = useState(false);
    const [filtro, setFiltro] = useState<Filtro>("todas");
    const [pestana, setPestana] = useState<Pestana>("tareas");
    const [temas, setTemas] = useState<ForoTema[] | null>(null);
    const [borrando, setBorrando] = useState<number | null>(null);
    const [editando, setEditando] = useState(false);
    const [cursos, setCursos] = useState<Curso[] | null>(null);
    const [eliminandoMateria, setEliminandoMateria] = useState(false);

    const cargar = useCallback(() => {
        datosDocente()
            .then(setDatos)
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

    const materia = useMemo(
        () => (datos ? materiaDe(datos, seleccionada ? Number(seleccionada) : null) : null),
        [datos, seleccionada]
    );

    useEffect(() => {
        if (!materia) return;
        api.foro
            .temas(materia.materia.idCurso)
            .then((l) => setTemas(l ?? []))
            .catch(() => setTemas([]));
    }, [materia]);

    const eliminar = async (t: TareaDocente) => {
        if (!window.confirm(`¿Eliminar "${t.tarea.titulo}"? También se borran sus entregas.`)) return;
        setBorrando(t.tarea.id);
        try {
            await api.tareas.eliminar(t.tarea.id);
            invalidarDocente();
            setDatos(null);
            cargar();
        } catch (e) {
            registrarError(e);
            notificar("No se pudo eliminar la tarea.");
        } finally {
            setBorrando(null);
        }
    };

    // Los cursos se piden recién cuando el docente abre la edición.
    const abrirEdicion = () => {
        setEditando(true);
        if (cursos) return;
        api.cursos
            .listar()
            .then((l) => setCursos(l ?? []))
            .catch((e) => {
                registrarError(e);
                notificar("No pudimos cargar los cursos. Intentá de nuevo.");
                setEditando(false);
            });
    };

    const recargar = () => {
        invalidarDocente();
        setDatos(null);
        cargar();
    };

    const eliminarMateria = async (m: MateriaDocente) => {
        const asociado =
            m.tareas.length > 0
                ? ` Tiene ${m.tareas.length} ${m.tareas.length === 1 ? "tarea" : "tareas"} cargadas.`
                : "";
        if (
            !window.confirm(
                `¿Eliminar la materia "${m.materia.nombre}" (${m.cursoNombre})?${asociado} Esta acción no se puede deshacer.`
            )
        ) {
            return;
        }
        setEliminandoMateria(true);
        try {
            await api.materias.eliminar(m.materia.id);
            setEditando(false);
            router.replace("/docente/materias");
            recargar();
        } catch (e) {
            registrarError(e);
            notificar(
                e instanceof ApiError && e.status === 403
                    ? "No podés eliminar una materia que no está a tu cargo."
                    : mensajeDeError(e, "No se pudo eliminar la materia. Intentá de nuevo.")
            );
        } finally {
            setEliminandoMateria(false);
        }
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar tus materias."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }

    if (!datos || !materia) {
        if (datos && datos.materias.length === 0) {
            return (
                <div className={`${CARD} flex flex-col items-center gap-3 p-10 text-center`}>
                    <BookOpenIcon className="h-10 w-10 text-neutral-400" />
                    <p className="text-neutral-700 dark:text-neutral-300">
                        Todavía no tenés materias. Creá la primera.
                    </p>
                    <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
                        Elegís el nombre y el curso en el que la dictás, sin pasar por la administración.
                    </p>
                    <Link href="/docente/materias/nueva" className={BTN_P}>
                        <PlusIcon className="h-5 w-5" />
                        Nueva materia
                    </Link>
                </div>
            );
        }
        return (
            <div className="space-y-4">
                <Cargando className="h-32" />
                <Cargando className="h-96" />
            </div>
        );
    }

    const tareas =
        filtro === "todas" ? materia.tareas : materia.tareas.filter((t) => t.estado === filtro);

    const contar = (e: EstadoTarea) => materia.tareas.filter((t) => t.estado === e).length;
    const filtros: { valor: Filtro; label: string }[] = [
        { valor: "todas", label: `Todas (${materia.tareas.length})` },
        { valor: "abierta", label: `Abiertas (${contar("abierta")})` },
        { valor: "para-corregir", label: `Para corregir (${contar("para-corregir")})` },
        { valor: "programada", label: `Programadas (${contar("programada")})` },
        { valor: "cerrada", label: `Cerradas (${contar("cerrada")})` },
    ];

    const incumplidores = cumplimiento(materia);
    const puntualidad = aTiempo(materia);

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href="/docente" className="hover:underline">
                    Panel docente
                </Link>{" "}
                / Mis materias
            </nav>

            <div className={`${CARD} flex flex-wrap items-center justify-between gap-5 p-5`}>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Select
                            label="Cambiar de materia"
                            valor={materia.materia.id}
                            onChange={(v) => router.replace(`/docente/materias?materia=${v}`)}
                        >
                            {datos.materias.map((m) => (
                                <option key={m.materia.id} value={m.materia.id}>
                                    {m.materia.nombre} · {m.cursoNombre}
                                </option>
                            ))}
                        </Select>
                        <Chip tono="verde">Ciclo {datos.ciclo} activo</Chip>
                    </div>
                    <h1 className="mt-2.5 font-libertinus text-3xl font-bold leading-tight text-neutral-900 dark:text-neutral-100">
                        {materia.materia.nombre}
                    </h1>
                    <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                        {[
                            materia.cursoDetalle,
                            materia.materia.horario,
                            materia.materia.aula ?? materia.curso?.aula,
                            `${materia.alumnos.length} alumnos`,
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <Link href={`/docente/materiales?materia=${materia.materia.id}`} className={BTN_G}>
                        <ArrowUpTrayIcon className="h-5 w-5" />
                        Subir material
                    </Link>
                    <Link href={`/docente/tareas/nueva?materia=${materia.materia.id}`} className={BTN_P}>
                        <PlusIcon className="h-5 w-5" />
                        Nueva tarea
                    </Link>
                </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
                <Link href="/docente/materias/nueva" className={BTN_G}>
                    <PlusIcon className="h-5 w-5" />
                    Nueva materia
                </Link>
                <button
                    type="button"
                    onClick={() => (editando ? setEditando(false) : abrirEdicion())}
                    aria-expanded={editando}
                    className={BTN_G}
                >
                    <PencilSquareIcon className="h-5 w-5" />
                    Editar materia
                </button>
                <button
                    type="button"
                    onClick={() => eliminarMateria(materia)}
                    disabled={eliminandoMateria}
                    className={BTN_R}
                >
                    <TrashIcon className="h-5 w-5" />
                    {eliminandoMateria ? "Eliminando…" : "Eliminar materia"}
                </button>
            </div>

            {editando && (
                <section aria-label="Editar materia" className={`${CARD} p-5`}>
                    <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                        Editar materia
                    </h2>
                    <div className="mt-4 max-w-xl">
                        {cursos ? (
                            <MateriaForm
                                key={materia.materia.id}
                                materia={materia.materia}
                                cursos={cursos}
                                onGuardado={() => {
                                    setEditando(false);
                                    recargar();
                                }}
                                onCancelar={() => setEditando(false)}
                            />
                        ) : (
                            <Cargando className="h-40" />
                        )}
                    </div>
                </section>
            )}

            <div
                role="tablist"
                aria-label="Secciones de la materia"
                className="flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-700"
            >
                {(
                    [
                        ["tareas", `Tareas (${materia.tareas.length})`],
                        ["alumnos", `Alumnos (${materia.alumnos.length})`],
                        ["foro", "Foro del curso"],
                    ] as [Pestana, string][]
                ).map(([valor, label]) => (
                    <button
                        key={valor}
                        role="tab"
                        aria-selected={pestana === valor}
                        onClick={() => setPestana(valor)}
                        className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                            pestana === valor
                                ? "border-primary text-primary"
                                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                        }`}
                    >
                        {label}
                    </button>
                ))}
                <Link
                    href={`/docente/notas?materia=${materia.materia.id}`}
                    className="whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                    Notas
                </Link>
                <Link
                    href={`/docente/materiales?materia=${materia.materia.id}`}
                    className="whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                    Materiales
                </Link>
            </div>

            <div className="flex flex-wrap items-start gap-5">
                <section className="min-w-0 flex-[999_1_30rem] space-y-2.5">
                    {pestana === "tareas" && (
                        <>
                            <div className="flex flex-wrap gap-2">
                                {filtros.map((f) => (
                                    <button
                                        key={f.valor}
                                        onClick={() => setFiltro(f.valor)}
                                        className={`h-9 rounded-xl px-3 text-xs font-semibold transition-colors ${
                                            filtro === f.valor
                                                ? "bg-primary text-white"
                                                : "border border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-600 dark:text-neutral-300"
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {tareas.length === 0 ? (
                                <Vacio>No hay tareas con ese filtro.</Vacio>
                            ) : (
                                tareas.map((t) => (
                                    <div
                                        key={t.tarea.id}
                                        className={`${ROW} flex flex-wrap items-center gap-4 p-4`}
                                    >
                                        <div className="min-w-0 flex-[1_1_16rem]">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Chip tono={TONO_ESTADO[t.estado]}>
                                                    {ETIQUETA_ESTADO[t.estado]}
                                                </Chip>
                                                <Link
                                                    href={`/docente/tareas/${t.tarea.id}`}
                                                    className="truncate text-[15px] font-semibold text-neutral-900 hover:underline dark:text-neutral-100"
                                                >
                                                    {t.tarea.titulo}
                                                </Link>
                                            </div>
                                            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                                                <ClockIcon className="h-4 w-4 shrink-0" />
                                                {textoFecha(t)}
                                            </p>
                                        </div>
                                        <div className="min-w-40 flex-[0_1_12rem]">
                                            <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                                                <span>
                                                    {t.entregadas}/{t.alumnos} entregaron
                                                </span>
                                                <span>
                                                    {t.estado === "programada"
                                                        ? "Sin publicar"
                                                        : `${t.corregidas} corregidas`}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                                <div
                                                    className="h-full bg-green-500"
                                                    style={{
                                                        width: `${t.alumnos ? (t.corregidas / t.alumnos) * 100 : 0}%`,
                                                    }}
                                                />
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{
                                                        width: `${t.alumnos ? ((t.entregadas - t.corregidas) / t.alumnos) * 100 : 0}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => eliminar(t)}
                                            disabled={borrando === t.tarea.id}
                                            aria-label={`Eliminar ${t.tarea.titulo}`}
                                            className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {pestana === "alumnos" && (
                        <div className={`${CARD} overflow-hidden`}>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[30rem] text-left text-sm">
                                    <thead>
                                        <tr className="bg-neutral-100 dark:bg-neutral-900">
                                            <th className={`${LABEL} px-4 py-3`}>Alumno</th>
                                            <th className={`${LABEL} px-4 py-3`}>Entregas</th>
                                            <th className={`${LABEL} px-4 py-3`}>Promedio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                        {incumplidores.map((a) => (
                                            <tr key={a.id}>
                                                <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-100">
                                                    {a.nombre}
                                                </td>
                                                <td
                                                    className={`px-4 py-2.5 ${a.entregadas < a.total ? "text-amber-600 dark:text-amber-400" : "text-neutral-600 dark:text-neutral-300"}`}
                                                >
                                                    {a.entregadas} de {a.total}
                                                </td>
                                                <td
                                                    className={`px-4 py-2.5 ${a.promedio !== null && a.promedio < 6 ? "text-amber-600 dark:text-amber-400" : "text-neutral-600 dark:text-neutral-300"}`}
                                                >
                                                    {numero(a.promedio, 1)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {materia.alumnos.length === 0 && (
                                <p className="p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                    El curso no tiene alumnos cargados.
                                </p>
                            )}
                        </div>
                    )}

                    {pestana === "foro" && (
                        <div className="space-y-2.5">
                            {temas === null ? (
                                <Cargando className="h-32" />
                            ) : temas.length === 0 ? (
                                <Vacio>El foro de este curso todavía no tiene temas.</Vacio>
                            ) : (
                                temas.map((t) => (
                                    <div key={t.id} className={`${ROW} p-3.5`}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                {t.titulo}
                                            </p>
                                            {t.fijado && <Chip tono="azul">Fijado</Chip>}
                                            {t.cerrado && <Chip tono="gris">Cerrado</Chip>}
                                        </div>
                                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                            {t.autor ?? "Anónimo"} · {fechaHora(t.fechaCreacion)} ·{" "}
                                            {t.cantidadMensajes}{" "}
                                            {t.cantidadMensajes === 1 ? "mensaje" : "mensajes"}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </section>

                <aside className="min-w-0 flex-[1_1_18rem] space-y-5">
                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Seguimiento del curso
                        </h2>
                        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                            <div className={`${ROW} p-3`}>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    Entregas a tiempo
                                </p>
                                <p className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                    {puntualidad === null ? "—" : `${puntualidad}%`}
                                </p>
                            </div>
                            <div className={`${ROW} p-3`}>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    Promedio tareas
                                </p>
                                <p className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                    {numero(materia.promedio, 1)}
                                </p>
                            </div>
                        </div>

                        <p className={`${LABEL} mb-1.5 mt-5`}>Menor cumplimiento</p>
                        {incumplidores.length === 0 ? (
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                Sin alumnos cargados.
                            </p>
                        ) : (
                            <ul className="space-y-1.5">
                                {incumplidores.slice(0, 3).map((a) => (
                                    <li key={a.id} className="flex justify-between gap-2 text-xs">
                                        <span className="truncate text-neutral-900 dark:text-neutral-100">
                                            {a.nombre}
                                        </span>
                                        <span className="whitespace-nowrap text-amber-600 dark:text-amber-400">
                                            {a.entregadas}/{a.total} · {numero(a.promedio, 1)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {materia.alumnos.length > 3 && (
                            <button
                                onClick={() => setPestana("alumnos")}
                                className="mt-3 text-sm text-primary hover:underline"
                            >
                                Ver los {materia.alumnos.length} alumnos
                            </button>
                        )}
                    </section>

                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Últimas consultas del foro
                        </h2>
                        <div className="mt-3 space-y-2.5">
                            {temas === null ? (
                                <Cargando className="h-20" />
                            ) : temas.length === 0 ? (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    Sin consultas todavía.
                                </p>
                            ) : (
                                temas.slice(0, 3).map((t) => (
                                    <div key={t.id} className={`${ROW} p-3`}>
                                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                            {t.titulo}
                                        </p>
                                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                                            {t.autor ?? "Anónimo"} · {fechaCorta(t.fechaCreacion)} ·{" "}
                                            {t.cantidadMensajes === 0
                                                ? "sin responder"
                                                : `${t.cantidadMensajes} mensajes`}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
