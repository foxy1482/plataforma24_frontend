"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ClipboardDocumentListIcon,
    IdentificationIcon,
    PencilSquareIcon,
    PlusIcon,
    TrashIcon,
    UserPlusIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { cicloActual, cursoLargo, nombreCurso, ROLES_ALUMNO, turnoDe } from "@/app/lib/sesion";
import type { Curso } from "@/app/lib/types";
import { notificar } from "@/app/components/avisos";
import AsignarAlumnosModal from "@/app/components/asignar-alumnos-modal";
import CursoForm, { turnoDeCurso } from "@/app/components/curso-form";
import { BTN_G, BTN_P, BTN_R, CARD, Cargando, Chip, ErrorPanel, Select, Vacio } from "@/app/components/ui";
import { invalidarDocente } from "@/app/docente/datos";
import { datosPreceptoria, invalidarPreceptoria } from "../datos";

const ORDEN_TURNO = { manana: 0, tarde: 1, noche: 2 } as const;

interface Datos {
    cursos: Curso[];
    // null = no se pudo contar (se muestra "—" en vez de un 0 falso)
    alumnos: Map<number, number> | null;
    materias: Map<number, number> | null;
    // Solo las autoridades eliminan cursos; el preceptor crea y edita.
    puedeEliminar: boolean;
}

type Formulario = { modo: "nuevo" } | { modo: "editar"; curso: Curso } | null;

function contar<T>(lista: T[] | null | undefined, claveDe: (x: T) => number | null) {
    if (!lista) return null;
    const mapa = new Map<number, number>();
    for (const x of lista) {
        const k = claveDe(x);
        if (k != null) mapa.set(k, (mapa.get(k) ?? 0) + 1);
    }
    return mapa;
}

export default function CursosView() {
    const [datos, setDatos] = useState<Datos | null>(null);
    const [error, setError] = useState(false);
    const [ciclo, setCiclo] = useState("");
    const [formulario, setFormulario] = useState<Formulario>(null);
    const [eliminando, setEliminando] = useState<number | null>(null);
    const [asignando, setAsignando] = useState<{ curso: Curso; recienCreado: boolean } | null>(null);

    const cargar = useCallback(() => {
        // Los conteos son secundarios: si fallan, la lista se ve igual sin ellos.
        const opcional = <T,>(p: Promise<T>) => p.catch(() => null);

        Promise.all([
            api.cursos.listar(),
            opcional(api.usuarios.listar()),
            opcional(api.materias.listar()),
            opcional(datosPreceptoria()),
        ])
            .then(([cursos, usuarios, materias, panel]) =>
                setDatos({
                    cursos: cursos ?? [],
                    alumnos: contar(usuarios, (u) => (ROLES_ALUMNO.includes(u.idRol) ? u.idCurso : null)),
                    materias: contar(materias, (m) => m.idCurso),
                    puedeEliminar: panel?.sesion.papel === "directivo",
                })
            )
            .catch((e) => {
                registrarError(e);
                setError(true);
            });
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const ciclos = useMemo(
        () => [...new Set((datos?.cursos ?? []).map((c) => c.cicloLectivo))].sort((a, b) => b - a),
        [datos]
    );
    const cicloActivo = ciclos.includes(Number(ciclo))
        ? Number(ciclo)
        : ciclos.includes(cicloActual())
          ? cicloActual()
          : (ciclos[0] ?? null);

    const visibles = useMemo(
        () =>
            (datos?.cursos ?? [])
                .filter((c) => c.cicloLectivo === cicloActivo)
                .sort(
                    (a, b) =>
                        Number(a.año) - Number(b.año) ||
                        Number(a.division) - Number(b.division) ||
                        ORDEN_TURNO[turnoDeCurso(a)] - ORDEN_TURNO[turnoDeCurso(b)]
                ),
        [datos, cicloActivo]
    );

    // Lo que depende de la lista de cursos (selectores del resto del panel y del panel docente) se vuelve a pedir.
    const refrescar = () => {
        invalidarPreceptoria();
        invalidarDocente();
        cargar();
    };

    const eliminar = async (c: Curso) => {
        const alumnos = datos?.alumnos?.get(c.id) ?? 0;
        const materias = datos?.materias?.get(c.id) ?? 0;
        const asociado =
            alumnos || materias
                ? `\n\nTiene ${alumnos} ${alumnos === 1 ? "alumno" : "alumnos"} y ${materias} ${materias === 1 ? "materia" : "materias"}: el sistema no te va a dejar eliminarlo hasta que los muevas.`
                : "";
        if (!window.confirm(`¿Eliminar ${cursoLargo(c)}? Esta acción no se puede deshacer.${asociado}`)) {
            return;
        }
        setEliminando(c.id);
        try {
            await api.cursos.eliminar(c.id);
            if (formulario?.modo === "editar" && formulario.curso.id === c.id) setFormulario(null);
            refrescar();
        } catch (e) {
            registrarError(e);
            notificar(
                e instanceof ApiError && e.status === 403
                    ? "Tu usuario no tiene permiso para eliminar cursos. Pedíselo a una autoridad."
                    : mensajeDeError(e, "No se pudo eliminar el curso. Intentá de nuevo.")
            );
        } finally {
            setEliminando(null);
        }
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar los cursos."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }

    const mostrar = (n: number | undefined, mapa: Map<number, number> | null) => (mapa ? (n ?? 0) : "—");

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Cursos
                    </h1>
                    <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                        Creá y editá los cursos de cada ciclo lectivo: año, división, turno y aula.
                    </p>
                </div>
                {datos && (
                    <button
                        type="button"
                        onClick={() => setFormulario(formulario?.modo === "nuevo" ? null : { modo: "nuevo" })}
                        aria-expanded={formulario?.modo === "nuevo"}
                        className={BTN_P}
                    >
                        <PlusIcon className="h-5 w-5" />
                        Nuevo curso
                    </button>
                )}
            </header>

            {!datos ? (
                <Cargando className="h-96" />
            ) : (
                <>
                    {formulario && (
                        <section
                            aria-label={formulario.modo === "nuevo" ? "Nuevo curso" : "Editar curso"}
                            className={`${CARD} p-5`}
                        >
                            <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                {formulario.modo === "nuevo" ? "Nuevo curso" : `Editar ${nombreCurso(formulario.curso)}`}
                            </h2>
                            <div className="mt-4 max-w-2xl">
                                <CursoForm
                                    key={formulario.modo === "editar" ? formulario.curso.id : "nuevo"}
                                    curso={formulario.modo === "editar" ? formulario.curso : null}
                                    cursos={datos.cursos}
                                    onGuardado={(creado) => {
                                        setFormulario(null);
                                        refrescar();
                                        if (creado?.id) setAsignando({ curso: creado, recienCreado: true });
                                    }}
                                    onCancelar={() => setFormulario(null)}
                                />
                            </div>
                        </section>
                    )}

                    {ciclos.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3">
                            <Select label="Ciclo lectivo" valor={cicloActivo ?? ""} onChange={setCiclo}>
                                {ciclos.map((c) => (
                                    <option key={c} value={c}>
                                        Ciclo lectivo {c}
                                    </option>
                                ))}
                            </Select>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
                                {visibles.length} {visibles.length === 1 ? "curso" : "cursos"}
                            </p>
                        </div>
                    )}

                    {datos.cursos.length === 0 ? (
                        <Vacio>Todavía no hay cursos cargados. Creá el primero con “Nuevo curso”.</Vacio>
                    ) : (
                        <ul className="grid gap-4 sm:grid-cols-2">
                            {visibles.map((c) => {
                                const alumnos = datos.alumnos?.get(c.id);
                                return (
                                    <li key={c.id} className={`${CARD} flex flex-col gap-4 p-5`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h2 className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                                    {nombreCurso(c)}
                                                </h2>
                                                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                                                    {c.aula ? `Aula ${c.aula}` : "Aula sin asignar"}
                                                </p>
                                            </div>
                                            <Chip tono="teal">{turnoDe(c) ? `Turno ${turnoDe(c)}` : "Sin turno"}</Chip>
                                        </div>

                                        <dl className="grid grid-cols-2 gap-3 text-center">
                                            <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900/60">
                                                <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                                                    {alumnos === 1 ? "Alumno" : "Alumnos"}
                                                </dt>
                                                <dd className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                                    {mostrar(alumnos, datos.alumnos)}
                                                </dd>
                                            </div>
                                            <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900/60">
                                                <dt className="text-xs text-neutral-500 dark:text-neutral-400">Materias</dt>
                                                <dd className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                                    {mostrar(datos.materias?.get(c.id), datos.materias)}
                                                </dd>
                                            </div>
                                        </dl>

                                        <div className="mt-auto flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setAsignando({ curso: c, recienCreado: false })}
                                                className={`${BTN_G} h-10 w-full`}
                                            >
                                                <UserPlusIcon className="h-5 w-5" />
                                                Agregar alumnos
                                            </button>
                                            <Link href={`/preceptoria/legajos?curso=${c.id}`} className={`${BTN_G} h-10 flex-1`}>
                                                <IdentificationIcon className="h-5 w-5" />
                                                Ver legajos
                                            </Link>
                                            <Link href={`/preceptoria/lista?curso=${c.id}`} className={`${BTN_G} h-10 flex-1`}>
                                                <ClipboardDocumentListIcon className="h-5 w-5" />
                                                Tomar lista
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => setFormulario({ modo: "editar", curso: c })}
                                                aria-label={`Editar ${cursoLargo(c)}`}
                                                title="Editar"
                                                className={`${BTN_G} h-10 w-11 px-0`}
                                            >
                                                <PencilSquareIcon className="h-5 w-5" />
                                            </button>
                                            {datos.puedeEliminar && (
                                                <button
                                                    type="button"
                                                    onClick={() => eliminar(c)}
                                                    disabled={eliminando === c.id}
                                                    aria-label={`Eliminar ${cursoLargo(c)}`}
                                                    title="Eliminar"
                                                    className={`${BTN_R} h-10 w-11 px-0`}
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}

            {asignando && (
                <AsignarAlumnosModal
                    curso={asignando.curso}
                    recienCreado={asignando.recienCreado}
                    onCerrar={() => setAsignando(null)}
                    onAsignado={(cantidad) => {
                        const nombre = nombreCurso(asignando.curso);
                        setAsignando(null);
                        notificar(
                            `Se ${cantidad === 1 ? "agregó 1 alumno" : `agregaron ${cantidad} alumnos`} a ${nombre}.`,
                            "exito"
                        );
                        refrescar();
                    }}
                />
            )}
        </div>
    );
}
