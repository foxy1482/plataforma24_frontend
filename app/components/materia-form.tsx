"use client";

import { useId, useRef, useState } from "react";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { cursosDelCicloActual, etiquetaCurso } from "@/app/lib/sesion";
import type { Curso, Materia } from "@/app/lib/types";
import { BTN_G, BTN_P, INPUT, LABEL } from "@/app/components/ui";

export interface ProfesorOpcion {
    id: number;
    nombre: string;
}

const NOMBRE_MIN = 3;
const NOMBRE_MAX = 80;

type Campo = "nombre" | "curso" | "profesor";

// Alta y edición de una materia. El docente elige el curso él mismo; solo una autoridad
// administradora indica además el profesor (por eso `profesores` es opcional: si no viene,
// el backend asigna la materia al docente que la crea).
export default function MateriaForm({
    materia = null,
    cursos,
    profesores,
    idCursoInicial,
    onGuardado,
    onCancelar,
}: {
    materia?: Materia | null;
    cursos: Curso[];
    profesores?: ProfesorOpcion[];
    idCursoInicial?: number;
    onGuardado: (materia: Materia) => void;
    onCancelar?: () => void;
}) {
    const id = useId();
    const idNombre = `${id}-nombre`;
    const idCurso = `${id}-curso`;
    const idProfesor = `${id}-profesor`;
    const refNombre = useRef<HTMLInputElement>(null);
    const refCurso = useRef<HTMLSelectElement>(null);
    const refProfesor = useRef<HTMLSelectElement>(null);

    const [nombre, setNombre] = useState(materia?.nombre ?? "");
    const [curso, setCurso] = useState(String(materia?.idCurso ?? idCursoInicial ?? ""));
    const [profesor, setProfesor] = useState(String(materia?.idProfesor ?? ""));
    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorServidor, setErrorServidor] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const conProfesor = profesores !== undefined;
    // Solo el ciclo vigente, más el curso que ya tiene la materia (si se edita una de un ciclo anterior).
    const ordenados = cursosDelCicloActual(cursos, [materia?.idCurso, idCursoInicial, Number(curso) || null]);

    const validar = () => {
        const e: Partial<Record<Campo, string>> = {};
        const limpio = nombre.trim();
        if (limpio.length < NOMBRE_MIN) e.nombre = `El nombre debe tener al menos ${NOMBRE_MIN} caracteres.`;
        else if (limpio.length > NOMBRE_MAX) e.nombre = `El nombre no puede superar los ${NOMBRE_MAX} caracteres.`;
        if (!curso) e.curso = "Elegí el curso de la materia.";
        if (conProfesor && !profesor) e.profesor = "Elegí el profesor a cargo.";
        return e;
    };

    const guardar = async () => {
        if (guardando) return;
        setErrorServidor(null);

        const e = validar();
        setErrores(e);
        const primero = (["nombre", "curso", "profesor"] as Campo[]).find((c) => e[c]);
        if (primero) {
            const destino = { nombre: refNombre, curso: refCurso, profesor: refProfesor }[primero];
            destino.current?.focus();
            return;
        }

        const limpio = nombre.trim();
        const idCursoNum = Number(curso);
        const idProfesorNum = Number(profesor);

        setGuardando(true);
        try {
            if (!materia) {
                const creada = await api.materias.crear({
                    nombre: limpio,
                    idCurso: idCursoNum,
                    ...(conProfesor ? { idProfesor: idProfesorNum } : {}),
                });
                onGuardado(creada);
                return;
            }

            // Solo se envía lo que cambió: el backend rechaza (403) que un docente toque el profesor.
            const cambios: api.CambiosMateria = {};
            if (limpio !== materia.nombre) cambios.nombre = limpio;
            if (idCursoNum !== materia.idCurso) cambios.idCurso = idCursoNum;
            if (conProfesor && idProfesorNum !== materia.idProfesor) cambios.idProfesor = idProfesorNum;

            if (Object.keys(cambios).length === 0) {
                onCancelar?.();
                return;
            }
            await api.materias.modificar(materia.id, cambios);
            onGuardado({ ...materia, nombre: limpio, idCurso: idCursoNum, idProfesor: conProfesor ? idProfesorNum : materia.idProfesor });
        } catch (err) {
            registrarError(err);
            if (err instanceof ApiError && err.status === 403) {
                setErrorServidor("Tu usuario no tiene permiso para hacer este cambio en la materia.");
            } else if (err instanceof ApiError && err.status === 404) {
                setErrorServidor("La materia ya no existe. Volvé a la lista y actualizala.");
            } else {
                setErrorServidor(
                    mensajeDeError(
                        err,
                        materia
                            ? "No se pudo guardar la materia. Intentá de nuevo."
                            : "No se pudo crear la materia. Intentá de nuevo."
                    )
                );
            }
        } finally {
            setGuardando(false);
        }
    };

    const marca = (c: Campo) =>
        errores[c]
            ? { "aria-invalid": true, "aria-describedby": `${id}-${c}-error` }
            : {};
    const claseError = "border-red-400 focus:border-red-500 focus:ring-red-500/20";

    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                void guardar();
            }}
            className="space-y-5"
        >
            <div>
                <label htmlFor={idNombre} className={`${LABEL} mb-1.5 block`}>
                    Nombre de la materia
                </label>
                <input
                    ref={refNombre}
                    id={idNombre}
                    name="nombre"
                    type="text"
                    autoComplete="off"
                    maxLength={NOMBRE_MAX + 20}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Programación Orientada a Objetos"
                    className={`${INPUT} ${errores.nombre ? claseError : ""}`}
                    {...marca("nombre")}
                />
                {errores.nombre && (
                    <p id={`${id}-nombre-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                        {errores.nombre}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor={idCurso} className={`${LABEL} mb-1.5 block`}>
                    Curso
                </label>
                <select
                    ref={refCurso}
                    id={idCurso}
                    name="curso"
                    value={curso}
                    onChange={(e) => setCurso(e.target.value)}
                    className={`${INPUT} ${errores.curso ? claseError : ""}`}
                    {...marca("curso")}
                >
                    <option value="" disabled>
                        Elegí un curso…
                    </option>
                    {ordenados.map((c) => (
                        <option key={c.id} value={c.id}>
                            {etiquetaCurso(c, ordenados)}
                        </option>
                    ))}
                </select>
                {errores.curso && (
                    <p id={`${id}-curso-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                        {errores.curso}
                    </p>
                )}
            </div>

            {conProfesor && (
                <div>
                    <label htmlFor={idProfesor} className={`${LABEL} mb-1.5 block`}>
                        Profesor a cargo
                    </label>
                    <select
                        ref={refProfesor}
                        id={idProfesor}
                        name="profesor"
                        value={profesor}
                        onChange={(e) => setProfesor(e.target.value)}
                        className={`${INPUT} ${errores.profesor ? claseError : ""}`}
                        {...marca("profesor")}
                    >
                        <option value="" disabled>
                            Elegí un profesor…
                        </option>
                        {profesores.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.nombre}
                            </option>
                        ))}
                    </select>
                    {errores.profesor && (
                        <p id={`${id}-profesor-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                            {errores.profesor}
                        </p>
                    )}
                </div>
            )}

            {errorServidor && (
                <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                >
                    {errorServidor}
                </p>
            )}

            <div className="flex flex-wrap gap-2.5">
                <button type="submit" disabled={guardando} className={BTN_P}>
                    {guardando ? "Guardando…" : materia ? "Guardar cambios" : "Crear materia"}
                </button>
                {onCancelar && (
                    <button type="button" onClick={onCancelar} disabled={guardando} className={BTN_G}>
                        Cancelar
                    </button>
                )}
            </div>
        </form>
    );
}
