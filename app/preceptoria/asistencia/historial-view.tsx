"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { alumnosDeCurso } from "@/app/lib/alumnos";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { coma, isoFecha, INASISTENCIAS_PERMITIDAS, parseFecha, cantidad } from "@/app/lib/format";
import { estadoPeriodo } from "@/app/lib/periodos";
import { etiquetaCurso, nombreCurso } from "@/app/lib/sesion";
import type { EstadoAsistencia } from "@/app/lib/types";
import {
    BTN_G,
    CARD,
    Cargando,
    ErrorPanel,
    INPUT,
    LABEL,
    Select,
    Stat,
    Vacio,
} from "@/app/components/ui";
import { cursoDe, datosPreceptoria, type DatosPreceptoria } from "../datos";

// "sin-dato": la planilla existe pero el servidor no pudo devolver su detalle.
type Celda = EstadoAsistencia | "sin-dato";

const LETRA: Record<Celda, string> = {
    "sin-dato": "?",
    presente: "·",
    ausente: "A",
    tarde: "T",
    justificado: "J",
};

const CLASE: Record<Celda, string> = {
    "sin-dato": "bg-neutral-100 text-neutral-500 dark:bg-neutral-700/40 dark:text-neutral-500",
    presente: "text-neutral-500 dark:text-neutral-600",
    ausente: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    tarde: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    justificado: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
};

interface Dia {
    idAsistencia: number;
    fecha: Date;
    iso: string;
    cerrada: boolean;
}

interface FilaHist {
    idAlumno: number;
    nombre: string;
    celdas: Celda[];
    ausentes: number;
    tardes: number;
    justificadas: number;
    anuales: number | null;
}

export default function HistorialView() {
    const router = useRouter();
    const params = useSearchParams();

    const [datos, setDatos] = useState<DatosPreceptoria | null>(null);
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");
    const [dias, setDias] = useState<Dia[] | null>(null);
    const [filas, setFilas] = useState<FilaHist[] | null>(null);
    const [error, setError] = useState(false);
    const [sinDetalle, setSinDetalle] = useState(0);

    const idCurso = params.get("curso") ? Number(params.get("curso")) : null;

    useEffect(() => {
        datosPreceptoria()
            .then((d) => {
                setDatos(d);
                const inicioMes = new Date(d.hoy.getFullYear(), d.hoy.getMonth(), 1);
                setDesde((v) => v || isoFecha(inicioMes));
                setHasta((v) => v || isoFecha(d.hoy));
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

    const curso = useMemo(() => (datos ? cursoDe(datos, idCurso) : null), [datos, idCurso]);

    const cargar = useCallback(async (): Promise<{ dias: Dia[]; filas: FilaHist[]; sinDetalle: number } | null> => {
        if (!curso || !desde || !hasta || !datos) return null;
        {
            const planillas = (await api.asistencias.planillas(curso.id, desde, hasta)) ?? [];
            const ordenadas = planillas
                .map((p) => ({
                    idAsistencia: p.id,
                    fecha: parseFecha(p.fecha) ?? new Date(p.fecha),
                    iso: String(p.fecha).slice(0, 10),
                    cerrada: p.cerrada,
                }))
                .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

            const detalles = await Promise.all(
                ordenadas.map((d) => api.asistencias.delCurso(curso.id, d.iso).catch(() => null))
            );

            const alumnos = new Map<number, string>();
            for (const hoja of detalles) {
                for (const d of hoja?.detalle ?? []) {
                    alumnos.set(
                        d.idAlumno,
                        `${d.apellido ?? ""}, ${d.nombre ?? ""}`.replace(/^, |, $/, "")
                    );
                }
            }
            if (alumnos.size === 0) {
                const lista = await alumnosDeCurso(curso.id);
                for (const a of lista) alumnos.set(a.idUsuario, `${a.apellido}, ${a.nombre}`);
            }

            const base = [...alumnos.entries()]
                .map(([idAlumno, nombre]): FilaHist => {
                    const celdas = detalles.map((hoja): Celda =>
                        hoja
                            ? ((hoja.detalle ?? []).find((d) => d.idAlumno === idAlumno)?.estado ?? "presente")
                            : "sin-dato"
                    );
                    return {
                        idAlumno,
                        nombre,
                        celdas,
                        ausentes: celdas.filter((c) => c === "ausente").length,
                        tardes: celdas.filter((c) => c === "tarde").length,
                        justificadas: celdas.filter((c) => c === "justificado").length,
                        anuales: null,
                    };
                })
                .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

            return { dias: ordenadas, filas: base, sinDetalle: detalles.filter((h) => !h).length };
        }
    }, [curso, desde, hasta, datos]);

    // El total del año se pide por alumno: se agrega después de pintar la matriz.
    const conAnuales = useCallback(
        async (lista: FilaHist[]) => {
            if (!datos) return lista;
            const resumenes = await Promise.all(
                lista.map((f) => api.asistencias.resumenAlumno(f.idAlumno, datos.ciclo).catch(() => null))
            );
            return lista.map((f, i) => {
                const anual = resumenes[i]?.anuales?.find((a) => a.cicloLectivo === datos.ciclo);
                return { ...f, anuales: anual ? anual.totalInasistencias : null };
            });
        },
        [datos]
    );

    const refrescar = useCallback(() => {
        cargar()
            .then((r) => {
                if (!r) return null;
                setDias(r.dias);
                setFilas(r.filas);
                setSinDetalle(r.sinDetalle);
                return conAnuales(r.filas);
            })
            .then((conDatos) => {
                if (conDatos) setFilas(conDatos);
            })
            .catch((e) => {
                registrarError(e);
                setError(true);
            });
    }, [cargar, conAnuales]);

    useEffect(() => {
        refrescar();
    }, [refrescar]);

    const exportar = () => {
        if (!filas || !dias || !curso) return;
        const cabecera = ["Alumno", ...dias.map((d) => d.iso), "A", "T", "J", "Año"];
        const lineas = filas.map((f) => [
            f.nombre,
            ...f.celdas.map((c) => LETRA[c]),
            String(f.ausentes),
            String(f.tardes),
            String(f.justificadas),
            f.anuales === null ? "" : coma(f.anuales),
        ]);
        const csv = [cabecera, ...lineas]
            .map((fila) => fila.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
            .join("\n");
        const link = document.createElement("a");
        // El BOM hace que Excel interprete el CSV como UTF-8 (tildes y \u00F1).
        link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv" }));
        link.download = `asistencia-${nombreCurso(curso)}-${desde}-${hasta}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const rangoRapido = (tipo: "mes" | "bimestre" | "ciclo") => {
        if (!datos) return;
        if (tipo === "mes") {
            setDesde(isoFecha(new Date(datos.hoy.getFullYear(), datos.hoy.getMonth(), 1)));
            setHasta(isoFecha(datos.hoy));
            return;
        }
        if (tipo === "ciclo") {
            setDesde(`${datos.ciclo}-01-01`);
            setHasta(isoFecha(datos.hoy));
            return;
        }
        const actual =
            datos.periodos.find((p) => estadoPeriodo(p, datos.hoy) === "en-curso") ??
            datos.periodos.at(-1);
        if (actual) {
            setDesde(String(actual.fechaInicio).slice(0, 10));
            setHasta(isoFecha(datos.hoy));
        }
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar el historial de asistencia."
                onReintentar={() => {
                    setError(false);
                    refrescar();
                }}
            />
        );
    }
    if (!datos) return <Cargando className="h-96" />;
    if (!curso) return <Vacio>No hay cursos cargados todavía.</Vacio>;

    const totalCeldas = (filas ?? []).reduce(
        (a, f) => a + f.celdas.filter((c) => c !== "sin-dato").length,
        0
    );
    const ausencias = (filas ?? []).reduce((a, f) => a + f.ausentes + f.tardes + f.justificadas, 0);
    const presentismo = totalCeldas > 0 ? Math.round(((totalCeldas - ausencias) / totalCeldas) * 100) : null;
    const sinCerrar = (dias ?? []).filter((d) => !d.cerrada).length;

    const peorDia = (dias ?? []).reduce<{ iso: string; ausentes: number } | null>((peor, d, i) => {
        const ausentes = (filas ?? []).filter((f) => f.celdas[i] === "ausente").length;
        return !peor || ausentes > peor.ausentes ? { iso: d.iso, ausentes } : peor;
    }, null);

    const dow = ["D", "L", "M", "X", "J", "V", "S"];

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Historial de asistencia
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        Cada columna es una planilla diaria. Hacé clic en un día para abrirla o corregirla.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 print:hidden">
                    <button onClick={() => window.print()} className={`${BTN_G} h-10`}>
                        <PrinterIcon className="h-5 w-5" />
                        Imprimir
                    </button>
                    <button onClick={exportar} disabled={!filas} className={`${BTN_G} h-10`}>
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        Exportar CSV
                    </button>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                <Select
                    label="Curso"
                    valor={curso.id}
                    onChange={(v) => router.replace(`/preceptoria/asistencia?curso=${v}`)}
                >
                    {datos.cursos.map((c) => (
                        <option key={c.id} value={c.id}>
                            {etiquetaCurso(c, datos.cursos)}
                        </option>
                    ))}
                </Select>
                <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                    Desde
                    <input
                        type="date"
                        value={desde}
                        onChange={(e) => setDesde(e.target.value)}
                        className={`${INPUT} h-10 w-auto`}
                    />
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                    Hasta
                    <input
                        type="date"
                        value={hasta}
                        onChange={(e) => setHasta(e.target.value)}
                        className={`${INPUT} h-10 w-auto`}
                    />
                </label>
                <div className="flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
                    {(
                        [
                            ["mes", "Este mes"],
                            ["bimestre", "Bimestre"],
                            ["ciclo", `Ciclo ${datos.ciclo}`],
                        ] as const
                    ).map(([tipo, label]) => (
                        <button
                            key={tipo}
                            onClick={() => rangoRapido(tipo)}
                            className="h-8 rounded-lg px-3 text-xs font-semibold text-neutral-500 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                    label="Presentismo del curso"
                    valor={presentismo === null ? "—" : `${presentismo}%`}
                    color="text-teal-600 dark:text-teal-400"
                />
                <Stat label="Días registrados" valor={dias?.length ?? "…"} />
                <Stat
                    label="Día con más ausencias"
                    valor={peorDia && peorDia.ausentes > 0 ? peorDia.iso.slice(5) : "—"}
                />
                <Stat label="Planillas sin cerrar" valor={sinCerrar} color="text-amber-500" />
            </div>

            {sinDetalle > 0 && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    El servidor no pudo devolver el detalle de {sinDetalle}{" "}
                    {sinDetalle === 1 ? "planilla" : "planillas"} (marcadas con ?). El presentismo y los
                    totales de la tabla solo cuentan los días que sí se pudieron leer.
                </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600 dark:text-neutral-300">
                {(["ausente", "tarde", "justificado", "presente"] as EstadoAsistencia[]).map((e) => (
                    <span key={e} className="inline-flex items-center gap-1.5">
                        <span
                            className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${CLASE[e]}`}
                        >
                            {LETRA[e]}
                        </span>
                        {e === "presente" ? "Presente" : e.charAt(0).toUpperCase() + e.slice(1)}
                    </span>
                ))}
            </div>

            {!filas || !dias ? (
                <Cargando className="h-96" />
            ) : dias.length === 0 ? (
                <Vacio>No hay planillas registradas en ese rango.</Vacio>
            ) : (
                <section className={`${CARD} overflow-hidden`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-neutral-100 dark:bg-neutral-900">
                                    <th className={`${LABEL} sticky left-0 bg-neutral-100 px-3 py-2.5 dark:bg-neutral-900`}>
                                        Alumno
                                    </th>
                                    {dias.map((d) => (
                                        <th key={d.idAsistencia} className="px-1 py-2 text-center">
                                            <Link
                                                href={`/preceptoria/lista?curso=${curso.id}&fecha=${d.iso}`}
                                                aria-label={`Planilla del ${d.iso}${d.cerrada ? ", cerrada" : ", abierta"}`}
                                                className={`block rounded px-1 py-0.5 text-[11px] leading-tight ${
                                                    d.cerrada
                                                        ? "text-neutral-500 hover:text-primary dark:text-neutral-400"
                                                        : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                                                }`}
                                            >
                                                {dow[d.fecha.getDay()]}
                                                <br />
                                                {d.fecha.getDate()}
                                            </Link>
                                        </th>
                                    ))}
                                    <th className={`${LABEL} px-1.5 py-2 text-center`}>A</th>
                                    <th className={`${LABEL} px-1.5 py-2 text-center`}>T</th>
                                    <th className={`${LABEL} px-1.5 py-2 text-center`}>J</th>
                                    <th className={`${LABEL} px-2 py-2 text-center`}>Año</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                {filas.map((f) => (
                                    <tr key={f.idAlumno}>
                                        <td className="sticky left-0 bg-white px-3 py-1.5 dark:bg-neutral-800">
                                            <Link
                                                href={`/preceptoria/legajos/${f.idAlumno}`}
                                                className="whitespace-nowrap font-medium text-neutral-900 hover:text-primary dark:text-neutral-100"
                                            >
                                                {f.nombre}
                                            </Link>
                                        </td>
                                        {f.celdas.map((c, i) => (
                                            <td key={i} className="px-1 py-1.5 text-center">
                                                <span
                                                    className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${CLASE[c]}`}
                                                >
                                                    {LETRA[c]}
                                                </span>
                                            </td>
                                        ))}
                                        <td className="px-1.5 py-1.5 text-center text-red-600 dark:text-red-400">
                                            {f.ausentes}
                                        </td>
                                        <td className="px-1.5 py-1.5 text-center text-amber-700 dark:text-amber-400">
                                            {f.tardes}
                                        </td>
                                        <td className="px-1.5 py-1.5 text-center text-violet-600 dark:text-violet-400">
                                            {f.justificadas}
                                        </td>
                                        <td
                                            className={`px-2 py-1.5 text-center font-semibold ${
                                                f.anuales !== null && f.anuales >= INASISTENCIAS_PERMITIDAS * 0.7
                                                    ? "text-red-600 dark:text-red-400"
                                                    : f.anuales !== null && f.anuales >= INASISTENCIAS_PERMITIDAS * 0.5
                                                      ? "text-amber-700 dark:text-amber-400"
                                                      : "text-neutral-700 dark:text-neutral-200"
                                            }`}
                                        >
                                            {f.anuales === null ? "—" : coma(f.anuales)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-neutral-200 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                        {cantidad(filas.length, "alumno")} · {cantidad(dias.length, "planilla")} · límite anual{" "}
                        {INASISTENCIAS_PERMITIDAS} inasistencias (llegada tarde = ½ falta)
                    </div>
                </section>
            )}
        </div>
    );
}
