"use client";

import { useId, useRef, useState } from "react";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError, type CambiosCurso, type TurnoCurso } from "@/app/lib/apiClient";
import { normalizar } from "@/app/lib/format";
import { nombreCurso } from "@/app/lib/sesion";
import type { Curso } from "@/app/lib/types";
import { BTN_G, BTN_P, INPUT, LABEL } from "@/app/components/ui";

const AULA_MAX = 50;
const CICLO_MIN = 2000;

const TURNOS: { valor: TurnoCurso; etiqueta: string }[] = [
    { valor: "manana", etiqueta: "Mañana" },
    { valor: "tarde", etiqueta: "Tarde" },
    { valor: "noche", etiqueta: "Noche" },
];

const ANIOS = [1, 2, 3, 4, 5, 6];
const DIVISIONES = Array.from({ length: 12 }, (_, i) => i + 1);

type Campo = "anio" | "division" | "turno" | "aula" | "ciclo";
const ORDEN: Campo[] = ["anio", "division", "turno", "aula", "ciclo"];

// El turno puede llegar como texto ("manana") o como número (0, 1, 2) según el endpoint.
export function turnoDeCurso(curso: Pick<Curso, "turno">): TurnoCurso {
    const t = curso.turno as unknown;
    if (typeof t === "number") return TURNOS[t]?.valor ?? "manana";
    const n = normalizar(String(t ?? ""));
    return TURNOS.find((x) => x.valor === n)?.valor ?? "manana";
}

// Alta y edición de un curso. `cursos` es la lista ya cargada: sirve para avisar antes de enviar
// si ya existe la misma combinación de año, división, turno y ciclo lectivo.
export default function CursoForm({
    curso = null,
    cursos,
    onGuardado,
    onCancelar,
}: {
    curso?: Curso | null;
    cursos: Curso[];
    // Al crear, recibe el curso recién creado (con su id); al editar, nada.
    onGuardado: (creado?: Curso) => void;
    onCancelar?: () => void;
}) {
    const id = useId();
    const anioActual = new Date().getFullYear();
    const cicloMax = anioActual + 2;

    const refAnio = useRef<HTMLSelectElement>(null);
    const refDivision = useRef<HTMLSelectElement>(null);
    const refTurno = useRef<HTMLSelectElement>(null);
    const refAula = useRef<HTMLInputElement>(null);
    const refCiclo = useRef<HTMLInputElement>(null);

    const enfocar = (campo: Campo) => {
        const destino = { anio: refAnio, division: refDivision, turno: refTurno, aula: refAula, ciclo: refCiclo }[campo];
        destino.current?.focus();
    };
    const [anio, setAnio] = useState(String(curso?.año ?? ""));
    const [division, setDivision] = useState(String(curso?.division ?? ""));
    const [turno, setTurno] = useState<string>(curso ? turnoDeCurso(curso) : "");
    const [aula, setAula] = useState(curso?.aula ?? "");
    const [ciclo, setCiclo] = useState(String(curso?.cicloLectivo ?? anioActual));
    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorServidor, setErrorServidor] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const validar = () => {
        const e: Partial<Record<Campo, string>> = {};
        if (!anio) e.anio = "Elegí el año.";
        if (!division) e.division = "Elegí la división.";
        if (!turno) e.turno = "Elegí el turno.";
        if (aula.trim().length > AULA_MAX) e.aula = `El aula no puede superar los ${AULA_MAX} caracteres.`;

        const cicloNum = Number(ciclo);
        if (!/^\d{4}$/.test(ciclo.trim()) || cicloNum < CICLO_MIN || cicloNum > cicloMax) {
            e.ciclo = `El ciclo lectivo tiene que ser un año entre ${CICLO_MIN} y ${cicloMax}.`;
        }

        // Aviso antes de enviar: ya existe esa combinación (el backend también la rechaza).
        if (!e.anio && !e.division && !e.turno && !e.ciclo) {
            const repetido = cursos.find(
                (c) =>
                    c.id !== curso?.id &&
                    Number(c.año) === Number(anio) &&
                    Number(c.division) === Number(division) &&
                    turnoDeCurso(c) === turno &&
                    c.cicloLectivo === cicloNum
            );
            if (repetido) {
                e.division = `Ya existe ${nombreCurso(repetido)} de ese turno en el ciclo ${cicloNum}. Cambiá la división, el turno o el ciclo.`;
            }
        }
        return e;
    };

    const guardar = async () => {
        if (guardando) return;
        setErrorServidor(null);

        const e = validar();
        setErrores(e);
        const primero = ORDEN.find((c) => e[c]);
        if (primero) {
            enfocar(primero);
            return;
        }

        const nuevo = {
            año: Number(anio),
            division: Number(division),
            turno: turno as TurnoCurso,
            cicloLectivo: Number(ciclo),
        };
        const aulaLimpia = aula.trim();

        setGuardando(true);
        try {
            if (!curso) {
                const creado = await api.cursos.crear({ ...nuevo, ...(aulaLimpia ? { aula: aulaLimpia } : {}) });
                onGuardado(creado ?? undefined);
                return;
            }

            const cambios: CambiosCurso = {};
            if (nuevo.año !== Number(curso.año)) cambios.año = nuevo.año;
            if (nuevo.division !== Number(curso.division)) cambios.division = nuevo.division;
            if (nuevo.turno !== turnoDeCurso(curso)) cambios.turno = nuevo.turno;
            if (nuevo.cicloLectivo !== curso.cicloLectivo) cambios.cicloLectivo = nuevo.cicloLectivo;
            if (aulaLimpia !== (curso.aula ?? "")) cambios.aula = aulaLimpia;

            if (Object.keys(cambios).length === 0) {
                onCancelar?.();
                return;
            }
            await api.cursos.modificar(curso.id, cambios);
            onGuardado();
        } catch (err) {
            registrarError(err);
            if (err instanceof ApiError && err.status === 403) {
                setErrorServidor("Tu usuario no tiene permiso para hacer este cambio en el curso.");
            } else if (err instanceof ApiError && err.status === 404) {
                setErrorServidor("El curso ya no existe. Volvé a la lista y actualizala.");
            } else {
                setErrorServidor(
                    mensajeDeError(
                        err,
                        curso
                            ? "No se pudo guardar el curso. Intentá de nuevo."
                            : "No se pudo crear el curso. Intentá de nuevo."
                    )
                );
            }
        } finally {
            setGuardando(false);
        }
    };

    const marca = (c: Campo) => (errores[c] ? { "aria-invalid": true, "aria-describedby": `${id}-${c}-error` } : {});
    const claseError = "border-red-400 focus:border-red-500 focus:ring-red-500/20";
    const msg = (c: Campo) =>
        errores[c] && (
            <p id={`${id}-${c}-error`} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {errores[c]}
            </p>
        );

    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                void guardar();
            }}
            className="space-y-5"
        >
            <div className="grid gap-4 sm:grid-cols-3">
                <div>
                    <label htmlFor={`${id}-anio`} className={`${LABEL} mb-1.5 block`}>
                        Año
                    </label>
                    <select
                        ref={refAnio}
                        id={`${id}-anio`}
                        value={anio}
                        onChange={(e) => setAnio(e.target.value)}
                        className={`${INPUT} ${errores.anio ? claseError : ""}`}
                        {...marca("anio")}
                    >
                        <option value="" disabled>
                            Elegí…
                        </option>
                        {ANIOS.map((a) => (
                            <option key={a} value={a}>
                                {a}º año
                            </option>
                        ))}
                    </select>
                    {msg("anio")}
                </div>

                <div>
                    <label htmlFor={`${id}-division`} className={`${LABEL} mb-1.5 block`}>
                        División
                    </label>
                    <select
                        ref={refDivision}
                        id={`${id}-division`}
                        value={division}
                        onChange={(e) => setDivision(e.target.value)}
                        className={`${INPUT} ${errores.division ? claseError : ""}`}
                        {...marca("division")}
                    >
                        <option value="" disabled>
                            Elegí…
                        </option>
                        {DIVISIONES.map((d) => (
                            <option key={d} value={d}>
                                {d}ª división
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor={`${id}-turno`} className={`${LABEL} mb-1.5 block`}>
                        Turno
                    </label>
                    <select
                        ref={refTurno}
                        id={`${id}-turno`}
                        value={turno}
                        onChange={(e) => setTurno(e.target.value)}
                        className={`${INPUT} ${errores.turno ? claseError : ""}`}
                        {...marca("turno")}
                    >
                        <option value="" disabled>
                            Elegí…
                        </option>
                        {TURNOS.map((t) => (
                            <option key={t.valor} value={t.valor}>
                                {t.etiqueta}
                            </option>
                        ))}
                    </select>
                    {msg("turno")}
                </div>
            </div>
            {msg("division")}

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor={`${id}-aula`} className={`${LABEL} mb-1.5 block`}>
                        Aula <span className="font-normal normal-case text-neutral-400">(opcional)</span>
                    </label>
                    <input
                        ref={refAula}
                        id={`${id}-aula`}
                        type="text"
                        autoComplete="off"
                        maxLength={AULA_MAX + 10}
                        value={aula}
                        onChange={(e) => setAula(e.target.value)}
                        placeholder="Gabinete 4"
                        className={`${INPUT} ${errores.aula ? claseError : ""}`}
                        {...marca("aula")}
                    />
                    {msg("aula")}
                </div>

                <div>
                    <label htmlFor={`${id}-ciclo`} className={`${LABEL} mb-1.5 block`}>
                        Ciclo lectivo
                    </label>
                    <input
                        ref={refCiclo}
                        id={`${id}-ciclo`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={4}
                        value={ciclo}
                        onChange={(e) => setCiclo(e.target.value.replace(/\D/g, ""))}
                        className={`${INPUT} ${errores.ciclo ? claseError : ""}`}
                        {...marca("ciclo")}
                    />
                    {msg("ciclo")}
                </div>
            </div>

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
                    {guardando ? "Guardando…" : curso ? "Guardar cambios" : "Crear curso"}
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
