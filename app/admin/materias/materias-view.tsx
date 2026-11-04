"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { cursoLargo, nombreCurso, ordenarCursos } from "@/app/lib/sesion";
import type { Curso, Materia, Usuario } from "@/app/lib/types";
import { notificar } from "@/app/components/avisos";
import MateriaForm, { type ProfesorOpcion } from "@/app/components/materia-form";
import { BTN_G, BTN_P, BTN_R, CARD, Cargando, Chip, ErrorPanel, Select, Vacio } from "@/app/components/ui";

const ROL_PROFESOR = 2;

interface Datos {
    materias: Materia[];
    cursos: Curso[];
    usuarios: Usuario[];
}

type Formulario = { modo: "nueva" } | { modo: "editar"; materia: Materia } | null;

const nombreDeUsuario = (u: Usuario) => u.nombreUsuario ?? u.nombre ?? u.email;

export default function MateriasView() {
    const [datos, setDatos] = useState<Datos | null>(null);
    const [error, setError] = useState(false);
    const [filtroCurso, setFiltroCurso] = useState("");
    const [formulario, setFormulario] = useState<Formulario>(null);
    const [eliminando, setEliminando] = useState<number | null>(null);

    const cargar = useCallback(() => {
        Promise.all([api.materias.listar(), api.cursos.listar(), api.usuarios.listar()])
            .then(([materias, cursos, usuarios]) =>
                setDatos({
                    materias: materias ?? [],
                    cursos: ordenarCursos(cursos ?? []),
                    usuarios: usuarios ?? [],
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

    const usuarioPorId = useMemo(
        () => new Map((datos?.usuarios ?? []).map((u) => [u.id, u])),
        [datos]
    );
    const cursoPorId = useMemo(() => new Map((datos?.cursos ?? []).map((c) => [c.id, c])), [datos]);

    const profesores = useMemo<ProfesorOpcion[]>(
        () =>
            (datos?.usuarios ?? [])
                .filter((u) => u.idRol === ROL_PROFESOR)
                .map((u) => ({ id: u.id, nombre: nombreDeUsuario(u) }))
                .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        [datos]
    );

    // Si el profesor actual de la materia ya no tiene rol de profesor, igual se lo ofrece para no perderlo.
    const opcionesProfesor = useMemo(() => {
        if (formulario?.modo !== "editar") return profesores;
        const actual = formulario.materia.idProfesor;
        if (profesores.some((p) => p.id === actual)) return profesores;
        const u = usuarioPorId.get(actual);
        return u ? [...profesores, { id: u.id, nombre: nombreDeUsuario(u) }] : profesores;
    }, [formulario, profesores, usuarioPorId]);

    const visibles = useMemo(() => {
        const lista = (datos?.materias ?? []).filter(
            (m) => !filtroCurso || String(m.idCurso) === filtroCurso
        );
        return [...lista].sort(
            (a, b) =>
                Number(cursoPorId.get(a.idCurso)?.año ?? 0) - Number(cursoPorId.get(b.idCurso)?.año ?? 0) ||
                Number(cursoPorId.get(a.idCurso)?.division ?? 0) -
                    Number(cursoPorId.get(b.idCurso)?.division ?? 0) ||
                a.nombre.localeCompare(b.nombre, "es")
        );
    }, [datos, filtroCurso, cursoPorId]);

    const eliminar = async (m: Materia) => {
        if (
            !window.confirm(
                `¿Eliminar la materia "${m.nombre}" (${nombreCurso(cursoPorId.get(m.idCurso))})? Esta acción no se puede deshacer.`
            )
        ) {
            return;
        }
        setEliminando(m.id);
        try {
            await api.materias.eliminar(m.id);
            setDatos((d) => d && { ...d, materias: d.materias.filter((x) => x.id !== m.id) });
            if (formulario?.modo === "editar" && formulario.materia.id === m.id) setFormulario(null);
        } catch (e) {
            registrarError(e);
            notificar(
                e instanceof ApiError && e.status === 403
                    ? "Tu usuario no tiene permiso para eliminar materias."
                    : mensajeDeError(e, "No se pudo eliminar la materia. Intentá de nuevo.")
            );
        } finally {
            setEliminando(null);
        }
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar las materias."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Materias
                    </h1>
                    <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                        Creá, editá o eliminá materias y asigná el curso y el profesor a cargo. Los
                        docentes también pueden crear las suyas.
                    </p>
                </div>
                {datos && (
                    <button
                        type="button"
                        onClick={() => setFormulario(formulario?.modo === "nueva" ? null : { modo: "nueva" })}
                        aria-expanded={formulario?.modo === "nueva"}
                        className={BTN_P}
                    >
                        <PlusIcon className="h-5 w-5" />
                        Nueva materia
                    </button>
                )}
            </header>

            {!datos ? (
                <Cargando className="h-96" />
            ) : (
                <>
                    {formulario && (
                        <section
                            aria-label={formulario.modo === "nueva" ? "Nueva materia" : "Editar materia"}
                            className={`${CARD} p-5`}
                        >
                            <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                                {formulario.modo === "nueva" ? "Nueva materia" : "Editar materia"}
                            </h2>
                            <div className="mt-4 max-w-xl">
                                {datos.cursos.length === 0 ? (
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                        Primero tiene que haber cursos cargados.
                                    </p>
                                ) : profesores.length === 0 && formulario.modo === "nueva" ? (
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                        No hay usuarios con rol de profesor. Asignale ese rol a alguien desde
                                        Usuarios.
                                    </p>
                                ) : (
                                    <MateriaForm
                                        key={formulario.modo === "editar" ? formulario.materia.id : "nueva"}
                                        materia={formulario.modo === "editar" ? formulario.materia : null}
                                        cursos={datos.cursos}
                                        profesores={opcionesProfesor}
                                        idCursoInicial={filtroCurso ? Number(filtroCurso) : undefined}
                                        onGuardado={() => {
                                            setFormulario(null);
                                            cargar();
                                        }}
                                        onCancelar={() => setFormulario(null)}
                                    />
                                )}
                            </div>
                        </section>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <Select label="Filtrar por curso" valor={filtroCurso} onChange={setFiltroCurso}>
                            <option value="">Todos los cursos</option>
                            {datos.cursos.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {cursoLargo(c)}
                                </option>
                            ))}
                        </Select>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {visibles.length} de {datos.materias.length}{" "}
                            {datos.materias.length === 1 ? "materia" : "materias"}
                        </p>
                    </div>

                    {visibles.length === 0 ? (
                        <Vacio>
                            {datos.materias.length === 0
                                ? "Todavía no hay materias cargadas."
                                : "No hay materias en ese curso."}
                        </Vacio>
                    ) : (
                        <ul className={`${CARD} divide-y divide-neutral-200 dark:divide-neutral-700`}>
                            {visibles.map((m) => {
                                const profesor = usuarioPorId.get(m.idProfesor);
                                const curso = cursoPorId.get(m.idCurso);
                                return (
                                    <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                                        <div className="min-w-0 flex-1 basis-56">
                                            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                {m.nombre}
                                            </p>
                                            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                                                {profesor ? nombreDeUsuario(profesor) : "Sin profesor asignado"}
                                            </p>
                                        </div>
                                        <Chip tono="azul">{curso ? cursoLargo(curso) : "Sin curso"}</Chip>
                                        <button
                                            type="button"
                                            onClick={() => setFormulario({ modo: "editar", materia: m })}
                                            aria-label={`Editar ${m.nombre}`}
                                            className={`${BTN_G} h-10 w-10 px-0`}
                                        >
                                            <PencilSquareIcon className="h-5 w-5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => eliminar(m)}
                                            disabled={eliminando === m.id}
                                            aria-label={`Eliminar ${m.nombre}`}
                                            className={`${BTN_R} h-10 w-10 px-0`}
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
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
