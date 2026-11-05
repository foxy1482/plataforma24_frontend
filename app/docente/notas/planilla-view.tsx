"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownTrayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { notaNumerica, numero, ordinal, parseFecha, promedio, cantidad } from "@/app/lib/format";
import { estadoPeriodo, listarPeriodos, periodoActual } from "@/app/lib/periodos";
import type { BoletinResumen, PeriodoApi } from "@/app/lib/types";
import {
    BTN_G,
    BTN_P,
    CARD,
    Cargando,
    ErrorPanel,
    INPUT,
    LABEL,
    ROW,
    Select,
    Tabs,
} from "@/app/components/ui";
import { datosDocente, materiaDe, type DatosDocente } from "../datos";
import { notificar } from "@/app/components/avisos";
import SinMaterias from "@/app/components/sin-materias";

interface FilaPlanilla {
    idBoletin: number;
    idAlumno: number;
    nombre: string;
    legajo: string;
    tareas: (number | null)[];
    sugerida: number | null;
    nota: number | null;
    observacion: string;
}

export default function PlanillaView() {
    const router = useRouter();
    const params = useSearchParams();

    const [datos, setDatos] = useState<DatosDocente | null>(null);
    const [periodos, setPeriodos] = useState<PeriodoApi[]>([]);
    const [bimestre, setBimestre] = useState<number | null>(null);
    const [filas, setFilas] = useState<FilaPlanilla[] | null>(null);
    const [error, setError] = useState(false);
    const [aviso, setAviso] = useState("");
    const [generando, setGenerando] = useState(false);

    const idMateria = params.get("materia") ? Number(params.get("materia")) : null;

    useEffect(() => {
        datosDocente()
            .then(async (d) => {
                setDatos(d);
                const lista = await listarPeriodos(d.ciclo);
                setPeriodos(lista);
                setBimestre((b) => b ?? periodoActual(lista, d.hoy)?.bimestre ?? null);
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
    const periodo = useMemo(
        () => periodos.find((p) => p.bimestre === bimestre) ?? null,
        [periodos, bimestre]
    );

    const tareasDelBimestre = useMemo(() => {
        if (!materia) return [];
        if (!periodo) return materia.tareas.filter((t) => t.estado !== "programada");
        const inicio = parseFecha(periodo.fechaInicio, false)?.getTime();
        const fin = parseFecha(periodo.fechaFin)?.getTime();
        if (inicio === undefined || fin === undefined) return [];
        return materia.tareas.filter(
            (t) =>
                t.estado !== "programada" &&
                t.vence !== null &&
                t.vence.getTime() >= inicio &&
                t.vence.getTime() <= fin
        );
    }, [materia, periodo]);

    const armar = useCallback(
        (resumenes: BoletinResumen[], notas: Map<number, { nota: number | null; obs: string }>) =>
            resumenes
                .map((r): FilaPlanilla => {
                    const deTareas = tareasDelBimestre.map((t) => {
                        const entrega = t.entregas.find((e) => e.idUsuario === r.idAlumno);
                        return notaNumerica(entrega?.calificacion);
                    });
                    const validas = deTareas.filter((n): n is number => n !== null);
                    const cargada = notas.get(r.idBoletin);
                    return {
                        idBoletin: r.idBoletin,
                        idAlumno: r.idAlumno,
                        nombre: `${r.apellido ?? ""}, ${r.nombre ?? ""}`.replace(/^, |, $/, ""),
                        legajo: r.numeroLegajo ?? "",
                        tareas: deTareas,
                        sugerida: promedio(validas),
                        nota: cargada?.nota ?? null,
                        observacion: cargada?.obs ?? "",
                    };
                })
                .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        [tareasDelBimestre]
    );

    const cargarPlanilla = useCallback(async (): Promise<FilaPlanilla[]> => {
        if (!materia || bimestre === null || !datos) return [];
        {
            const resumenes =
                (await api.boletines.porCurso(materia.materia.idCurso, datos.ciclo, bimestre)) ?? [];
            const detalles = await Promise.all(
                resumenes.map((r) => api.boletines.porNumero(r.idBoletin).catch(() => null))
            );
            const notas = new Map<number, { nota: number | null; obs: string }>();
            detalles.forEach((d, i) => {
                const fila = (d?.notas ?? []).find((n) => n.idMateria === materia.materia.id);
                notas.set(resumenes[i].idBoletin, {
                    nota: fila?.nota ?? null,
                    obs: fila?.observacion ?? "",
                });
            });
            return armar(resumenes, notas);
        }
    }, [materia, bimestre, datos, armar]);

    const refrescar = useCallback(() => {
        cargarPlanilla()
            .then(setFilas)
            .catch((e) => {
                registrarError(e);
                setError(true);
            });
    }, [cargarPlanilla]);

    useEffect(() => {
        refrescar();
    }, [refrescar]);

    const guardar = async (fila: FilaPlanilla, nota: number | null, observacion: string) => {
        if (!materia) return;
        try {
            await api.boletines.cargarNota(fila.idBoletin, materia.materia.id, { nota, observacion });
            setFilas((prev) =>
                (prev ?? []).map((f) => (f.idBoletin === fila.idBoletin ? { ...f, nota, observacion } : f))
            );
            setAviso(`Guardado ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`);
        } catch (e) {
            registrarError(e);
            notificar("No se pudo guardar la nota en el boletín.");
        }
    };

    const completarVacias = async () => {
        const pendientes = (filas ?? []).filter((f) => f.nota === null && f.sugerida !== null);
        for (const f of pendientes) {
            await guardar(f, Math.round(f.sugerida!), f.observacion);
        }
    };

    const generar = async () => {
        if (!materia || !periodo) return;
        setGenerando(true);
        try {
            await api.boletines.generarCurso(materia.materia.idCurso, periodo.id);
            setFilas(await cargarPlanilla());
        } catch (e) {
            registrarError(e);
            notificar("No se pudieron generar los boletines del bimestre.");
        } finally {
            setGenerando(false);
        }
    };

    const exportar = () => {
        if (!filas || !materia) return;
        const cabecera = [
            "Alumno",
            "Legajo",
            ...tareasDelBimestre.map((t) => t.tarea.titulo),
            "Sugerida",
            "Nota bimestre",
            "Observación",
        ];
        const lineas = filas.map((f) => [
            f.nombre,
            f.legajo,
            ...f.tareas.map((n) => (n === null ? "" : String(n))),
            f.sugerida === null ? "" : numero(f.sugerida, 2),
            f.nota === null ? "" : String(f.nota),
            f.observacion,
        ]);
        const csv = [cabecera, ...lineas]
            .map((fila) => fila.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
            .join("\n");
        const link = document.createElement("a");
        // El BOM hace que Excel interprete el CSV como UTF-8 (tildes y \u00F1).
        link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv" }));
        link.download = `notas-${materia.materia.nombre}-${materia.cursoNombre}-bim${bimestre}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar la planilla de notas."
                onReintentar={() => {
                    setError(false);
                    refrescar();
                }}
            />
        );
    }
    if (!datos) return <Cargando className="h-96" />;
    if (datos.materias.length === 0 || !materia) {
        return <SinMaterias />;
    }

    const cargadas = (filas ?? []).filter((f) => f.nota !== null).length;
    const bajas = (filas ?? []).filter((f) => f.nota !== null && f.nota < 6).length;
    const vacias = (filas ?? []).length - cargadas;

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Planilla de notas
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        La nota del bimestre que cargues acá es la que aparece en el boletín de cada alumno.
                    </p>
                </div>
                {aviso && (
                    <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <CheckCircleIcon className="h-4 w-4" />
                        {aviso}
                    </p>
                )}
            </header>

            <div className="flex flex-wrap items-center gap-2.5">
                <Select
                    label="Materia y curso"
                    valor={materia.materia.id}
                    onChange={(v) => router.replace(`/docente/notas?materia=${v}`)}
                >
                    {datos.materias.map((m) => (
                        <option key={m.materia.id} value={m.materia.id}>
                            {m.materia.nombre} · {m.cursoNombre}
                        </option>
                    ))}
                </Select>

                {periodos.length > 0 && bimestre !== null && (
                    <Tabs
                        valor={bimestre}
                        onChange={setBimestre}
                        opciones={periodos.map((p) => ({
                            valor: p.bimestre,
                            label:
                                estadoPeriodo(p, datos.hoy) === "en-curso"
                                    ? `${ordinal(p.bimestre)} bimestre`
                                    : `${p.bimestre}º`,
                        }))}
                    />
                )}

                <div className="ml-auto flex flex-wrap gap-2">
                    <button onClick={exportar} disabled={!filas} className={`${BTN_G} h-10`}>
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        Exportar
                    </button>
                </div>
            </div>

            {filas && filas.length > 0 && vacias > 0 && (
                <div className={`${ROW} flex flex-wrap items-center gap-3.5 border-primary/40 bg-primary/5 p-3.5`}>
                    <p className="flex-[1_1_20rem] text-sm text-neutral-700 dark:text-neutral-200">
                        La columna <strong>Sugerida</strong> sale del promedio de las tareas corregidas del
                        bimestre. Usala como base y ajustala a mano: tu nota siempre manda.
                    </p>
                    <button onClick={completarVacias} className={`${BTN_G} h-9`}>
                        Completar vacías con la sugerida ({vacias})
                    </button>
                </div>
            )}

            {!filas ? (
                <Cargando className="h-96" />
            ) : filas.length === 0 ? (
                <div className={`${CARD} flex flex-col items-center gap-3 p-10 text-center`}>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                        Todavía no hay boletines generados para {materia.cursoNombre} en el{" "}
                        {bimestre ? ordinal(bimestre) : ""} bimestre.
                    </p>
                    {periodo && (
                        <button onClick={generar} disabled={generando} className={BTN_P}>
                            {generando ? "Generando…" : "Generar boletines del bimestre"}
                        </button>
                    )}
                </div>
            ) : (
                <section className={`${CARD} overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[56rem] text-left text-sm">
                            <thead>
                                <tr className="bg-neutral-100 dark:bg-neutral-900">
                                    <th className={`${LABEL} px-4 py-3`}>Alumno</th>
                                    {tareasDelBimestre.map((t) => (
                                        <th
                                            key={t.tarea.id}
                                            title={t.tarea.titulo}
                                            className={`${LABEL} max-w-20 truncate px-2 py-3 text-center`}
                                        >
                                            {t.tarea.titulo}
                                        </th>
                                    ))}
                                    <th className={`${LABEL} px-2 py-3 text-center text-primary`}>Sugerida</th>
                                    <th className={`${LABEL} px-2 py-3 text-center`}>Nota bimestre</th>
                                    <th className={`${LABEL} px-4 py-3`}>Observación para el boletín</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                {filas.map((f) => (
                                    <tr key={f.idBoletin}>
                                        <td className="px-4 py-2.5">
                                            <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                                {f.nombre}
                                            </p>
                                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                                {f.legajo}
                                            </p>
                                        </td>
                                        {f.tareas.map((n, i) => (
                                            <td
                                                key={i}
                                                className={`px-2 py-2.5 text-center ${
                                                    n === null
                                                        ? "text-neutral-500 dark:text-neutral-600"
                                                        : n < 6
                                                          ? "font-semibold text-amber-700 dark:text-amber-400"
                                                          : "text-neutral-600 dark:text-neutral-300"
                                                }`}
                                            >
                                                {n ?? "—"}
                                            </td>
                                        ))}
                                        <td className="px-2 py-2.5 text-center font-semibold text-primary">
                                            {numero(f.sugerida, 1)}
                                        </td>
                                        <td className="px-2 py-2.5 text-center">
                                            <label>
                                                <span className="sr-only">Nota del bimestre de {f.nombre}</span>
                                                <input
                                                    defaultValue={f.nota ?? ""}
                                                    placeholder="—"
                                                    onBlur={(e) => {
                                                        const texto = e.target.value.trim();
                                                        const nota = texto === "" ? null : notaNumerica(texto);
                                                        if (texto !== "" && nota === null) {
                                                            notificar("La nota va de 1 a 10.");
                                                            e.target.value = f.nota === null ? "" : String(f.nota);
                                                            return;
                                                        }
                                                        if (nota !== f.nota) guardar(f, nota, f.observacion);
                                                    }}
                                                    className={`${INPUT} h-9 w-16 px-2 text-center ${
                                                        f.nota !== null && f.nota < 6
                                                            ? "border-amber-400 text-amber-700 dark:text-amber-400"
                                                            : ""
                                                    }`}
                                                />
                                            </label>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <label>
                                                <span className="sr-only">Observación de {f.nombre}</span>
                                                <input
                                                    defaultValue={f.observacion}
                                                    placeholder="Opcional"
                                                    onBlur={(e) => {
                                                        if (e.target.value !== f.observacion) {
                                                            guardar(f, f.nota, e.target.value);
                                                        }
                                                    }}
                                                    className={`${INPUT} h-9 min-w-48`}
                                                />
                                            </label>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-neutral-200 p-3.5 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                        {cantidad(filas.length, "alumno")} ·{" "}
                        <strong className="text-neutral-900 dark:text-neutral-100">
                            {cargadas} notas cargadas
                        </strong>{" "}
                        · {vacias} vacías · {bajas} por debajo de 6
                    </div>
                </section>
            )}
        </div>
    );
}
