"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { alumnosDeCurso } from "@/app/lib/alumnos";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { coma, isoFecha, INASISTENCIAS_PERMITIDAS } from "@/app/lib/format";
import { etiquetaCurso, nombreCurso } from "@/app/lib/sesion";
import type { EstadoAsistencia, Planilla } from "@/app/lib/types";
import {
    BTN_G,
    BTN_P,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    INPUT,
    ROW,
    Select,
    Vacio,
} from "@/app/components/ui";
import { cursoDe, datosPreceptoria, type DatosPreceptoria } from "../datos";
import { notificar } from "@/app/components/avisos";

const ESTADOS: { valor: EstadoAsistencia; letra: string; texto: string; clases: string }[] = [
    {
        valor: "presente",
        letra: "P",
        texto: "Presente",
        clases: "border-teal-500 bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300",
    },
    {
        valor: "ausente",
        letra: "A",
        texto: "Ausente",
        clases: "border-red-500 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    },
    {
        valor: "tarde",
        letra: "T",
        texto: "Tarde (½ falta)",
        clases: "border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    },
    {
        valor: "justificado",
        letra: "J",
        texto: "Justificado",
        clases: "border-violet-500 bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    },
];

// Sábado y domingo no se puede abrir planilla: se arranca en el último día hábil.
function ultimoDiaHabil(fecha: Date) {
    const d = new Date(fecha);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return d;
}

interface Fila {
    idAlumno: number;
    nombre: string;
    legajo: string;
    estado: EstadoAsistencia;
    observacion: string;
    anuales: number | null;
}

export default function ListaView() {
    const router = useRouter();
    const params = useSearchParams();

    const [datos, setDatos] = useState<DatosPreceptoria | null>(null);
    const [planilla, setPlanilla] = useState<Planilla | null>(null);
    const [filas, setFilas] = useState<Fila[] | null>(null);
    const [error, setError] = useState(false);
    const [fecha, setFecha] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [aviso, setAviso] = useState("");
    // El backend rechaza abrir planilla en días no hábiles (400): se explica en pantalla en vez de fallar.
    const [motivo, setMotivo] = useState("");

    const idCurso = params.get("curso") ? Number(params.get("curso")) : null;
    const fechaPedida = params.get("fecha");

    useEffect(() => {
        datosPreceptoria()
            .then((d) => {
                setDatos(d);
                setFecha((f) => fechaPedida || f || isoFecha(ultimoDiaHabil(d.hoy)));
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [router, fechaPedida]);

    const curso = useMemo(() => (datos ? cursoDe(datos, idCurso) : null), [datos, idCurso]);

    const cargarPlanilla = useCallback(async (): Promise<{ hoja: Planilla | null; filas: Fila[]; motivo?: string } | null> => {
        if (!curso || !fecha || !datos) return null;
        {
            const caido = {
                hoja: null,
                filas: [],
                motivo: "El servidor falló al leer la planilla de esa fecha (error 500), así que por ahora no se puede tomar ni corregir la lista de ese día. Probá con otra fecha.",
            };
            let hoja: Planilla | null = null;
            try {
                hoja = await api.asistencias.delCurso(curso.id, fecha);
            } catch (e) {
                if (e instanceof ApiError && e.status >= 500) return caido;
            }
            if (!hoja) {
                try {
                    await api.asistencias.abrir(curso.id, fecha);
                } catch (e) {
                    if (e instanceof ApiError && e.status === 400) {
                        return {
                            hoja: null,
                            filas: [],
                            motivo: "No se puede tomar lista en esa fecha: solo se admiten días hábiles (lunes a viernes). Elegí otra fecha.",
                        };
                    }
                    throw e;
                }
                try {
                    hoja = await api.asistencias.delCurso(curso.id, fecha);
                } catch (e) {
                    if (e instanceof ApiError && e.status >= 500) return caido;
                    throw e;
                }
            }
            let base = hoja?.detalle ?? [];
            if (base.length === 0) {
                const alumnos = await alumnosDeCurso(curso.id);
                base = alumnos.map((a) => ({
                    id: a.idUsuario,
                    idAlumno: a.idUsuario,
                    numeroLegajo: "",
                    apellido: a.apellido,
                    nombre: a.nombre,
                    estado: "presente" as EstadoAsistencia,
                    observacion: "",
                }));
            }

            const armadas = base
                .map(
                    (d): Fila => ({
                        idAlumno: d.idAlumno,
                        nombre: `${d.apellido ?? ""}, ${d.nombre ?? ""}`.replace(/^, |, $/, ""),
                        legajo: d.numeroLegajo ?? "",
                        estado: d.estado ?? "presente",
                        observacion: d.observacion ?? "",
                        anuales: null,
                    })
                )
                .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

            return { hoja, filas: armadas };
        }
    }, [curso, fecha, datos]);

    // Las inasistencias del año son un dato secundario: se agregan después de pintar la lista.
    const conAnuales = useCallback(
        async (lista: Fila[]) => {
            if (!datos) return lista;
            const resumenes = await Promise.all(
                lista.map((f) =>
                    api.asistencias.resumenAlumno(f.idAlumno, datos.ciclo).catch(() => null)
                )
            );
            return lista.map((f, i) => {
                const anual = resumenes[i]?.anuales?.find((a) => a.cicloLectivo === datos.ciclo);
                return { ...f, anuales: anual ? anual.totalInasistencias : null };
            });
        },
        [datos]
    );

    const refrescar = useCallback(() => {
        cargarPlanilla()
            .then((r) => {
                if (!r) return null;
                setPlanilla(r.hoja);
                setFilas(r.filas);
                setMotivo(r.motivo ?? "");
                return r.motivo ? null : conAnuales(r.filas);
            })
            .then((conDatos) => {
                if (conDatos) setFilas(conDatos);
            })
            .catch((e) => {
                registrarError(e);
                setError(true);
            });
    }, [cargarPlanilla, conAnuales]);

    useEffect(() => {
        refrescar();
    }, [refrescar]);

    const marcar = (idAlumno: number, estado: EstadoAsistencia) =>
        setFilas((prev) =>
            (prev ?? []).map((f) =>
                f.idAlumno === idAlumno
                    ? { ...f, estado, observacion: estado === "presente" ? "" : f.observacion }
                    : f
            )
        );

    const todosPresentes = () =>
        setFilas((prev) => (prev ?? []).map((f) => ({ ...f, estado: "presente", observacion: "" })));

    const guardar = async (cerrar: boolean) => {
        if (!planilla || !filas) return;
        setGuardando(true);
        setAviso("");
        try {
            await api.asistencias.guardarDetalle(
                planilla.id,
                filas.map((f) => ({
                    idAlumno: f.idAlumno,
                    estado: f.estado,
                    observacion: f.observacion.trim() || null,
                }))
            );
            if (cerrar) {
                await api.asistencias.modificar(planilla.id, { cerrada: true });
                setPlanilla({ ...planilla, cerrada: true });
            }
            setAviso(cerrar ? "Planilla guardada y cerrada." : "Cambios guardados.");
        } catch (e) {
            registrarError(e);
            setAviso("No se pudo guardar la planilla.");
        } finally {
            setGuardando(false);
        }
    };

    const reabrir = async () => {
        if (!planilla) return;
        try {
            await api.asistencias.modificar(planilla.id, { cerrada: false });
            setPlanilla({ ...planilla, cerrada: false });
        } catch (e) {
            registrarError(e);
            notificar("No se pudo reabrir la planilla.");
        }
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar la planilla de asistencia."
                onReintentar={() => {
                    setError(false);
                    refrescar();
                }}
            />
        );
    }
    if (!datos) return <Cargando className="h-96" />;
    if (!curso) return <Vacio>No hay cursos cargados todavía.</Vacio>;

    const contar = (e: EstadoAsistencia) => (filas ?? []).filter((f) => f.estado === e).length;
    const cerrada = planilla?.cerrada ?? false;

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Tomar lista
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        Todos empiezan como presentes: solo tocá a quien falta o llegó tarde.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <Select
                        label="Curso"
                        valor={curso.id}
                        onChange={(v) => router.replace(`/preceptoria/lista?curso=${v}`)}
                    >
                        {datos.cursos.map((c) => (
                            <option key={c.id} value={c.id}>
                                {etiquetaCurso(c, datos.cursos)}
                            </option>
                        ))}
                    </Select>
                    <label>
                        <span className="sr-only">Fecha</span>
                        <input
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                            className={`${INPUT} h-10 w-auto`}
                        />
                    </label>
                </div>
            </header>

            {!motivo && (
            <div className={`${CARD} flex flex-wrap items-center gap-4 p-4`}>
                <Chip tono={cerrada ? "verde" : "ambar"}>
                    {cerrada ? "Planilla cerrada" : "Planilla abierta · sin cerrar"}
                </Chip>
                <div className="flex flex-wrap gap-4 text-sm">
                    <span>
                        <strong className="text-xl text-teal-600 dark:text-teal-400">
                            {contar("presente")}
                        </strong>{" "}
                        <span className="text-neutral-500 dark:text-neutral-400">presentes</span>
                    </span>
                    <span>
                        <strong className="text-xl text-red-600 dark:text-red-400">
                            {contar("ausente")}
                        </strong>{" "}
                        <span className="text-neutral-500 dark:text-neutral-400">ausentes</span>
                    </span>
                    <span>
                        <strong className="text-xl text-amber-600 dark:text-amber-400">
                            {contar("tarde")}
                        </strong>{" "}
                        <span className="text-neutral-500 dark:text-neutral-400">tarde</span>
                    </span>
                    <span>
                        <strong className="text-xl text-violet-600 dark:text-violet-400">
                            {contar("justificado")}
                        </strong>{" "}
                        <span className="text-neutral-500 dark:text-neutral-400">justificados</span>
                    </span>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                    {cerrada ? (
                        <button onClick={reabrir} className={`${BTN_G} h-10`}>
                            Reabrir planilla
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={todosPresentes}
                                disabled={!filas}
                                className={`${BTN_G} h-10`}
                            >
                                <CheckIcon className="h-5 w-5" />
                                Todos presentes
                            </button>
                            <button
                                onClick={() => guardar(false)}
                                disabled={guardando || !filas}
                                className={`${BTN_G} h-10`}
                            >
                                Guardar
                            </button>
                            <button
                                onClick={() => guardar(true)}
                                disabled={guardando || !filas}
                                className={`${BTN_P} h-10`}
                            >
                                <LockClosedIcon className="h-5 w-5" />
                                Guardar y cerrar
                            </button>
                        </>
                    )}
                </div>
                {aviso && (
                    <p className="basis-full text-sm text-neutral-600 dark:text-neutral-300">{aviso}</p>
                )}
            </div>
            )}

            {!motivo && (
            <div className="flex flex-wrap gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                {ESTADOS.map((e) => (
                    <span key={e.valor}>
                        <strong className="text-neutral-700 dark:text-neutral-200">{e.letra}</strong>{" "}
                        {e.texto}
                    </span>
                ))}
                <span>· El número gris es el total de inasistencias del año</span>
            </div>
            )}

            {motivo ? (
                <Vacio>{motivo}</Vacio>
            ) : !filas ? (
                <Cargando className="h-96" />
            ) : filas.length === 0 ? (
                <Vacio>{nombreCurso(curso)} no tiene alumnos cargados.</Vacio>
            ) : (
                <section
                    aria-label={`Alumnos de ${nombreCurso(curso)}`}
                    className="grid gap-2.5 lg:grid-cols-2"
                >
                    {filas.map((f, i) => {
                        const actual = ESTADOS.find((e) => e.valor === f.estado)!;
                        return (
                            <div
                                key={f.idAlumno}
                                className={`${ROW} p-3 ${f.estado !== "presente" ? actual.clases.split(" ")[0] : ""}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-6 shrink-0 text-right text-xs text-neutral-400">
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                            {f.nombre}
                                        </p>
                                        <p className="mt-0.5 flex gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                                            {f.legajo && <span>{f.legajo}</span>}
                                            <span
                                                className={
                                                    f.anuales !== null && f.anuales >= INASISTENCIAS_PERMITIDAS * 0.7
                                                        ? "font-semibold text-red-500"
                                                        : f.anuales !== null && f.anuales >= INASISTENCIAS_PERMITIDAS * 0.5
                                                          ? "font-semibold text-amber-500"
                                                          : ""
                                                }
                                            >
                                                {f.anuales === null ? "—" : coma(f.anuales)} inasist.
                                            </span>
                                        </p>
                                    </div>
                                    <div
                                        role="radiogroup"
                                        aria-label={`Asistencia de ${f.nombre}`}
                                        className="flex shrink-0 gap-1"
                                    >
                                        {ESTADOS.map((e) => (
                                            <button
                                                key={e.valor}
                                                role="radio"
                                                aria-checked={f.estado === e.valor}
                                                aria-label={e.texto}
                                                disabled={cerrada}
                                                onClick={() => marcar(f.idAlumno, e.valor)}
                                                className={`h-9 w-9 rounded-lg border text-sm font-bold transition-colors disabled:opacity-50 ${
                                                    f.estado === e.valor
                                                        ? e.clases
                                                        : "border-neutral-300 text-neutral-400 hover:border-neutral-400 dark:border-neutral-600"
                                                }`}
                                            >
                                                {e.letra}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {f.estado !== "presente" && (
                                    <label className="mt-2.5 block pl-9">
                                        <span className="sr-only">Observación para {f.nombre}</span>
                                        <input
                                            value={f.observacion}
                                            disabled={cerrada}
                                            placeholder="Observación (opcional): motivo, hora de llegada…"
                                            onChange={(e) =>
                                                setFilas((prev) =>
                                                    (prev ?? []).map((x) =>
                                                        x.idAlumno === f.idAlumno
                                                            ? { ...x, observacion: e.target.value }
                                                            : x
                                                    )
                                                )
                                            }
                                            className={`${INPUT} h-9 text-xs`}
                                        />
                                    </label>
                                )}
                            </div>
                        );
                    })}
                </section>
            )}
        </div>
    );
}
