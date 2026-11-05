"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckBadgeIcon, PrinterIcon } from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { coma, INASISTENCIAS_POR_BIMESTRE, numero, ordinal } from "@/app/lib/format";
import { etiquetaCurso } from "@/app/lib/sesion";
import type { BoletinResumen } from "@/app/lib/types";
import {
    BTN_G,
    BTN_P,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    LABEL,
    ROW,
    Select,
    Vacio,
} from "@/app/components/ui";
import { cursoDe, datosPreceptoria, type DatosPreceptoria } from "../datos";
import { notificar } from "@/app/components/avisos";

interface Fila {
    resumen: BoletinResumen;
    nombre: string;
    completo: boolean;
}

interface PorMateria {
    idMateria: number;
    materia: string;
    profesor: string;
    cargadas: number;
    total: number;
}

export default function BoletinesView() {
    const router = useRouter();
    const params = useSearchParams();

    const [datos, setDatos] = useState<DatosPreceptoria | null>(null);
    const [bimestre, setBimestre] = useState<number | null>(null);
    const [filas, setFilas] = useState<Fila[] | null>(null);
    const [materias, setMaterias] = useState<PorMateria[]>([]);
    const [seleccion, setSeleccion] = useState<number[]>([]);
    const [error, setError] = useState(false);
    const [trabajando, setTrabajando] = useState(false);

    const idCurso = params.get("curso") ? Number(params.get("curso")) : null;

    useEffect(() => {
        datosPreceptoria()
            .then((d) => {
                setDatos(d);
                const pedido = params.get("bimestre");
                setBimestre(
                    (b) =>
                        b ??
                        (pedido ? Number(pedido) : null) ??
                        d.periodos.at(-1)?.bimestre ??
                        null
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
    }, [params, router]);

    const curso = useMemo(() => (datos ? cursoDe(datos, idCurso) : null), [datos, idCurso]);

    const cargar = useCallback(async (): Promise<{ filas: Fila[]; materias: PorMateria[] }> => {
        if (!curso || bimestre === null || !datos) return { filas: [], materias: [] };
        {
            const resumenes = (await api.boletines.porCurso(curso.id, datos.ciclo, bimestre)) ?? [];
            const detalles = await Promise.all(
                resumenes.map((r) => api.boletines.porNumero(r.idBoletin).catch(() => null))
            );

            const filas = (
                resumenes
                    .map((resumen): Fila => ({
                        resumen,
                        nombre: `${resumen.apellido ?? ""}, ${resumen.nombre ?? ""}`.replace(/^, |, $/, ""),
                        completo:
                            resumen.materiasDelCurso > 0 &&
                            resumen.notasCargadas >= resumen.materiasDelCurso,
                    }))
                    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
            );

            const porMateria = new Map<number, PorMateria>();
            for (const detalle of detalles) {
                for (const n of detalle?.notas ?? []) {
                    const actual =
                        porMateria.get(n.idMateria) ??
                        ({
                            idMateria: n.idMateria,
                            materia: n.materia ?? `Materia ${n.idMateria}`,
                            profesor: n.profesor ?? "Sin docente",
                            cargadas: 0,
                            total: 0,
                        } satisfies PorMateria);
                    actual.total++;
                    if (n.nota !== null && n.nota !== undefined) actual.cargadas++;
                    porMateria.set(n.idMateria, actual);
                }
            }
            return {
                filas,
                materias: [...porMateria.values()].sort((a, b) =>
                    a.materia.localeCompare(b.materia, "es")
                ),
            };
        }
    }, [curso, bimestre, datos]);

    const aplicar = useCallback((r: { filas: Fila[]; materias: PorMateria[] }) => {
        setFilas(r.filas);
        setMaterias(r.materias);
        setSeleccion([]);
    }, []);

    const refrescar = useCallback(() => {
        cargar()
            .then(aplicar)
            .catch((e) => {
                registrarError(e);
                setError(true);
            });
    }, [cargar, aplicar]);

    useEffect(() => {
        refrescar();
    }, [refrescar]);

    const publicar = async (ids: number[]) => {
        if (ids.length === 0) return;
        if (!window.confirm(`¿Publicar ${ids.length} boletines? Los verán alumnos y familias.`)) return;
        setTrabajando(true);
        try {
            for (const id of ids) {
                await api.boletines.modificar(id, { estado: "publicado" });
            }
            aplicar(await cargar());
        } catch (e) {
            registrarError(e);
            notificar("No se pudieron publicar todos los boletines.");
        } finally {
            setTrabajando(false);
        }
    };

    const generar = async () => {
        if (!curso || !datos || bimestre === null) return;
        const periodo = datos.periodos.find((p) => p.bimestre === bimestre);
        if (!periodo) {
            notificar("No hay un periodo cargado para ese bimestre.");
            return;
        }
        setTrabajando(true);
        try {
            await api.boletines.generarCurso(curso.id, periodo.id);
            aplicar(await cargar());
        } catch (e) {
            registrarError(e);
            notificar("No se pudieron generar los boletines.");
        } finally {
            setTrabajando(false);
        }
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar los boletines del curso."
                onReintentar={() => {
                    setError(false);
                    refrescar();
                }}
            />
        );
    }
    if (!datos) return <Cargando className="h-96" />;
    if (!curso) return <Vacio>No hay cursos cargados todavía.</Vacio>;

    const completos = (filas ?? []).filter((f) => f.completo && f.resumen.estado === "borrador");
    const publicados = (filas ?? []).filter((f) => f.resumen.estado === "publicado").length;
    const pendientesDocentes = materias.filter((m) => m.cargadas < m.total).length;

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Boletines del curso
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        Los boletines están en borrador hasta que los publiques; recién ahí los ven
                        alumnos y familias.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <Select
                        label="Curso"
                        valor={curso.id}
                        onChange={(v) => router.replace(`/preceptoria/boletines?curso=${v}&bimestre=${bimestre}`)}
                    >
                        {datos.cursos.map((c) => (
                            <option key={c.id} value={c.id}>
                                {etiquetaCurso(c, datos.cursos)}
                            </option>
                        ))}
                    </Select>
                    {bimestre !== null && (
                        <Select
                            label="Bimestre"
                            valor={bimestre}
                            onChange={(v) => setBimestre(Number(v))}
                        >
                            {(datos.periodos.length
                                ? datos.periodos.map((p) => p.bimestre)
                                : [1, 2, 3, 4]
                            ).map((b) => (
                                <option key={b} value={b}>
                                    {ordinal(b)} bimestre {datos.ciclo}
                                </option>
                            ))}
                        </Select>
                    )}
                </div>
            </header>

            {materias.length > 0 && (
                <section className={`${CARD} p-5`}>
                    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Carga de notas por materia
                        </h2>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {pendientesDocentes === 0
                                ? "Todas las materias tienen las notas completas"
                                : `${pendientesDocentes} ${pendientesDocentes === 1 ? "materia" : "materias"} con notas pendientes`}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {materias.map((m) => {
                            const completa = m.cargadas >= m.total && m.total > 0;
                            return (
                                <div key={m.idMateria} className={`${ROW} p-3`}>
                                    <div className="flex justify-between gap-2">
                                        <span className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                            {m.materia}
                                        </span>
                                        <span
                                            className={`whitespace-nowrap text-xs font-semibold ${
                                                completa
                                                    ? "text-teal-600 dark:text-teal-400"
                                                    : m.cargadas === 0
                                                      ? "text-red-500"
                                                      : "text-amber-500"
                                            }`}
                                        >
                                            {m.cargadas}/{m.total}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                                        {m.profesor}
                                    </p>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                        <div
                                            className={completa ? "h-full bg-teal-500" : "h-full bg-amber-500"}
                                            style={{
                                                width: `${m.total ? (m.cargadas / m.total) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {!filas ? (
                <Cargando className="h-96" />
            ) : filas.length === 0 ? (
                <div className={`${CARD} flex flex-col items-center gap-3 p-10 text-center`}>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                        Todavía no hay boletines generados para este curso en el{" "}
                        {bimestre ? ordinal(bimestre) : ""} bimestre.
                    </p>
                    <button onClick={generar} disabled={trabajando} className={BTN_P}>
                        {trabajando ? "Generando…" : "Generar boletines del bimestre"}
                    </button>
                </div>
            ) : (
                <section className={`${CARD} overflow-hidden`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 p-3.5 dark:border-neutral-700">
                        <p className="text-sm text-neutral-600 dark:text-neutral-300">
                            <strong className="text-neutral-900 dark:text-neutral-100">
                                {filas.length} boletines
                            </strong>{" "}
                            · {completos.length} completos para publicar · {publicados} publicados
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => window.print()} className={`${BTN_G} h-9 text-xs`}>
                                <PrinterIcon className="h-4 w-4" />
                                Imprimir
                            </button>
                            <button
                                onClick={() =>
                                    publicar(
                                        seleccion.length > 0
                                            ? seleccion
                                            : completos.map((f) => f.resumen.idBoletin)
                                    )
                                }
                                disabled={trabajando || (seleccion.length === 0 && completos.length === 0)}
                                className={`${BTN_P} h-9 text-xs`}
                            >
                                <CheckBadgeIcon className="h-4 w-4" />
                                {seleccion.length > 0
                                    ? `Publicar ${seleccion.length} seleccionados`
                                    : `Publicar los ${completos.length} completos`}
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[52rem] text-left text-sm">
                            <thead>
                                <tr className="bg-neutral-100 dark:bg-neutral-900">
                                    <th className="w-10 px-3 py-3">
                                        <label>
                                            <span className="sr-only">Seleccionar todos</span>
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 accent-primary"
                                                checked={seleccion.length === filas.length && filas.length > 0}
                                                onChange={(e) =>
                                                    setSeleccion(
                                                        e.target.checked
                                                            ? filas.map((f) => f.resumen.idBoletin)
                                                            : []
                                                    )
                                                }
                                            />
                                        </label>
                                    </th>
                                    <th className={`${LABEL} px-3 py-3`}>Alumno</th>
                                    <th className={`${LABEL} px-3 py-3`}>Notas cargadas</th>
                                    <th className={`${LABEL} px-3 py-3`}>Promedio</th>
                                    <th className={`${LABEL} px-3 py-3`}>Desaprobadas</th>
                                    <th className={`${LABEL} px-3 py-3`}>Inasist. bim.</th>
                                    <th className={`${LABEL} px-3 py-3`}>Estado</th>
                                    <th className="px-3 py-3">
                                        <span className="sr-only">Acción</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                {filas.map((f) => {
                                    const r = f.resumen;
                                    return (
                                        <tr key={r.idBoletin}>
                                            <td className="px-3 py-2.5">
                                                <label>
                                                    <span className="sr-only">
                                                        Seleccionar boletín de {f.nombre}
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 accent-primary"
                                                        checked={seleccion.includes(r.idBoletin)}
                                                        onChange={(e) =>
                                                            setSeleccion((prev) =>
                                                                e.target.checked
                                                                    ? [...prev, r.idBoletin]
                                                                    : prev.filter((x) => x !== r.idBoletin)
                                                            )
                                                        }
                                                    />
                                                </label>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                                    {f.nombre}
                                                </p>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                    {r.numeroLegajo}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                                                        <div
                                                            className={
                                                                f.completo
                                                                    ? "h-full bg-teal-500"
                                                                    : "h-full bg-amber-500"
                                                            }
                                                            style={{
                                                                width: `${r.materiasDelCurso ? (r.notasCargadas / r.materiasDelCurso) * 100 : 0}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                                        {r.notasCargadas}/{r.materiasDelCurso}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 font-semibold text-neutral-900 dark:text-neutral-100">
                                                {numero(r.promedio ?? null)}
                                            </td>
                                            <td
                                                className={`px-3 py-2.5 ${r.materiasDesaprobadas > 0 ? "font-semibold text-amber-700 dark:text-amber-400" : "text-neutral-500 dark:text-neutral-400"}`}
                                            >
                                                {r.materiasDesaprobadas}
                                            </td>
                                            <td
                                                className={`px-3 py-2.5 ${r.inasistenciasBimestre >= INASISTENCIAS_POR_BIMESTRE ? "font-semibold text-red-600 dark:text-red-400" : "text-neutral-600 dark:text-neutral-300"}`}
                                            >
                                                {coma(r.inasistenciasBimestre)}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <Chip
                                                    tono={
                                                        r.estado === "publicado"
                                                            ? "verde"
                                                            : f.completo
                                                              ? "teal"
                                                              : "gris"
                                                    }
                                                >
                                                    {r.estado === "publicado"
                                                        ? "Publicado"
                                                        : f.completo
                                                          ? "Listo para publicar"
                                                          : "Borrador"}
                                                </Chip>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <Link
                                                    href={`/preceptoria/boletines/${r.idBoletin}`}
                                                    className={`${BTN_G} h-8 text-xs`}
                                                >
                                                    Revisar
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}
