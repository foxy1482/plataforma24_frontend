"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckBadgeIcon,
    CheckCircleIcon,
    PrinterIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import {
    coma,
    fechaCorta,
    INASISTENCIAS_PERMITIDAS,
    INASISTENCIAS_POR_BIMESTRE,
    numero,
    ordinal,
} from "@/app/lib/format";
import type { BoletinDetalle, BoletinResumen, InasistenciaPeriodo } from "@/app/lib/types";
import {
    Avatar,
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
import { datosPreceptoria } from "../../datos";

interface Vecino {
    id: number;
    nombre: string;
}

export default function BoletinView() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const idBoletin = Number(id);

    // Los datos quedan atados al boletín pedido: al pasar al siguiente no se ven los del previo.
    const [cargado, setCargado] = useState<{ id: number; valor: BoletinDetalle } | null>(null);
    const detalle = cargado?.id === idBoletin ? cargado.valor : null;
    const [historial, setHistorial] = useState<BoletinResumen[]>([]);
    const [bimestres, setBimestres] = useState<InasistenciaPeriodo[]>([]);
    const [anual, setAnual] = useState<number | null>(null);
    const [vecinos, setVecinos] = useState<{ previo: Vecino | null; siguiente: Vecino | null; indice: number; total: number }>({
        previo: null,
        siguiente: null,
        indice: 0,
        total: 0,
    });
    const [observaciones, setObservaciones] = useState("");
    const [error, setError] = useState(false);
    const [trabajando, setTrabajando] = useState(false);
    const [aviso, setAviso] = useState("");

    const cargar = useCallback(() => {
        api.boletines
            .porNumero(idBoletin)
            .then(async (d) => {
                setCargado({ id: idBoletin, valor: d });
                setAviso("");
                const datos = await datosPreceptoria();
                const r = d.resumen;

                const [delCurso, delAlumno, resumen] = await Promise.all([
                    api.boletines.porCurso(r.idCurso, r.cicloLectivo, r.bimestre).catch(() => null),
                    api.boletines.porAlumno(r.idAlumno, r.cicloLectivo).catch(() => null),
                    api.asistencias.resumenAlumno(r.idAlumno, r.cicloLectivo).catch(() => null),
                ]);

                setHistorial(
                    [...(delAlumno ?? [])].sort((a, b) => a.bimestre - b.bimestre)
                );
                setBimestres([...(resumen?.porBimestre ?? [])].sort((a, b) => a.bimestre - b.bimestre));
                const totalAnual = resumen?.anuales?.find((a) => a.cicloLectivo === datos.ciclo);
                setAnual(totalAnual ? totalAnual.totalInasistencias : null);

                const orden = [...(delCurso ?? [])]
                    .map((b) => ({
                        id: b.idBoletin,
                        nombre: `${b.apellido ?? ""}, ${b.nombre ?? ""}`.replace(/^, |, $/, ""),
                    }))
                    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
                const i = orden.findIndex((b) => b.id === idBoletin);
                setVecinos({
                    previo: i > 0 ? orden[i - 1] : null,
                    siguiente: i >= 0 && i < orden.length - 1 ? orden[i + 1] : null,
                    indice: i + 1,
                    total: orden.length,
                });
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [idBoletin, router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const guardar = async (estado: "borrador" | "publicado") => {
        if (!detalle) return;
        if (estado === "publicado" && !window.confirm("¿Publicar el boletín? Lo verán el alumno y su familia.")) {
            return;
        }
        setTrabajando(true);
        try {
            await api.boletines.modificar(idBoletin, {
                observaciones: observaciones.trim() || null,
                estado,
            });
            setCargado({ id: idBoletin, valor: { ...detalle, resumen: { ...detalle.resumen, estado } } });
            setAviso(estado === "publicado" ? "Boletín publicado." : "Observaciones guardadas.");
        } catch (e) {
            registrarError(e);
            setAviso("No se pudo guardar el boletín.");
        } finally {
            setTrabajando(false);
        }
    };

    if (error) return <ErrorPanel mensaje="No encontramos ese boletín." onReintentar={cargar} />;
    if (!detalle) {
        return (
            <div className="flex flex-wrap gap-5">
                <Cargando className="h-96 flex-[999_1_30rem]" />
                <Cargando className="h-96 flex-[1_1_18rem]" />
            </div>
        );
    }

    const r = detalle.resumen;
    const notas = [...(detalle.notas ?? [])].sort((a, b) =>
        (a.materia ?? "").localeCompare(b.materia ?? "", "es")
    );
    const nombre = `${r.nombre ?? ""} ${r.apellido ?? ""}`.trim() || `Alumno ${r.idAlumno}`;
    const completo = r.materiasDelCurso > 0 && r.notasCargadas >= r.materiasDelCurso;
    const delBimestre = bimestres.find((b) => b.bimestre === r.bimestre);
    const maxPromedio = 10;

    return (
        <div className="mx-auto max-w-6xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                    <Link
                        href={`/preceptoria/boletines?curso=${r.idCurso}&bimestre=${r.bimestre}`}
                        className="hover:underline"
                    >
                        Boletines
                    </Link>{" "}
                    / {ordinal(r.bimestre)} bimestre / {r.apellido}, {r.nombre}
                </nav>
                <div className="flex items-center gap-1.5 print:hidden">
                    {vecinos.previo && (
                        <Link
                            href={`/preceptoria/boletines/${vecinos.previo.id}`}
                            className={`${BTN_G} h-9 text-xs`}
                        >
                            <ArrowLeftIcon className="h-4 w-4" />
                            {vecinos.previo.nombre}
                        </Link>
                    )}
                    {vecinos.total > 0 && (
                        <span className="px-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                            {vecinos.indice} de {vecinos.total}
                        </span>
                    )}
                    {vecinos.siguiente && (
                        <Link
                            href={`/preceptoria/boletines/${vecinos.siguiente.id}`}
                            className={`${BTN_G} h-9 text-xs`}
                        >
                            {vecinos.siguiente.nombre}
                            <ArrowRightIcon className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-start gap-5">
                <article className={`${CARD} min-w-0 flex-[999_1_32rem] overflow-hidden`}>
                    <div className="flex flex-wrap items-center gap-4 border-b border-neutral-200 p-5 dark:border-neutral-700">
                        <Avatar
                            id={r.idAlumno}
                            iniciales={`${r.nombre?.[0] ?? ""}${r.apellido?.[0] ?? ""}`.toUpperCase() || "?"}
                            size="h-14 w-14 text-lg"
                        />
                        <div className="min-w-0 flex-[1_1_12rem]">
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                Boletín · {ordinal(r.bimestre)} bimestre · Ciclo lectivo {r.cicloLectivo}
                            </p>
                            <h1 className="font-libertinus text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                                {nombre}
                            </h1>
                            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                                {[r.numeroLegajo && `Legajo ${r.numeroLegajo}`, notas[0]?.curso]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        </div>
                        <Chip tono={r.estado === "publicado" ? "verde" : "gris"}>
                            {r.estado === "publicado" ? "Publicado" : "Borrador"}
                        </Chip>
                    </div>

                    <div className="grid grid-cols-1 gap-px bg-neutral-200 sm:grid-cols-4 dark:bg-neutral-700">
                        {[
                            { label: "Promedio", valor: numero(r.promedio ?? null), color: "" },
                            {
                                label: "Desaprobadas",
                                valor: String(r.materiasDesaprobadas),
                                color:
                                    r.materiasDesaprobadas > 0
                                        ? "text-amber-700 dark:text-amber-400"
                                        : "text-teal-600 dark:text-teal-400",
                            },
                            {
                                label: "Inasistencias bim.",
                                valor: coma(r.inasistenciasBimestre),
                                color: "",
                            },
                            {
                                label: "Notas cargadas",
                                valor: `${r.notasCargadas}/${r.materiasDelCurso}`,
                                color: "",
                            },
                        ].map((s) => (
                            <div key={s.label} className="bg-white p-4 dark:bg-neutral-800">
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.label}</p>
                                <p
                                    className={`font-libertinus text-2xl font-bold ${s.color || "text-neutral-900 dark:text-neutral-100"}`}
                                >
                                    {s.valor}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[36rem] text-left text-sm">
                            <thead>
                                <tr className="bg-neutral-100 dark:bg-neutral-900">
                                    <th className={`${LABEL} px-4 py-3`}>Materia</th>
                                    <th className={`${LABEL} px-3 py-3 text-center`}>Nota</th>
                                    <th className={`${LABEL} px-4 py-3`}>Observación del docente</th>
                                    <th className={`${LABEL} px-4 py-3`}>Cargada</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                {notas.map((n) => (
                                    <tr key={n.idMateria}>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                                {n.materia}
                                            </p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                {n.profesor ?? "Sin docente"}
                                            </p>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <span
                                                className={`font-libertinus text-xl font-bold ${
                                                    n.nota === null || n.nota === undefined
                                                        ? "text-neutral-500 dark:text-neutral-600"
                                                        : n.nota < 6
                                                          ? "text-amber-700 dark:text-amber-400"
                                                          : "text-neutral-900 dark:text-neutral-100"
                                                }`}
                                            >
                                                {n.nota ?? "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                                            {n.observacion || "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                                            {n.fechaCarga ? fechaCorta(n.fechaCarga) : "—"}
                                        </td>
                                    </tr>
                                ))}
                                {notas.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="p-6 text-center text-sm text-neutral-500 dark:text-neutral-400"
                                        >
                                            El boletín todavía no tiene materias cargadas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-neutral-200 p-5 dark:border-neutral-700">
                        <label htmlFor="obs" className={`${LABEL} mb-2 block`}>
                            Observaciones de preceptoría (aparecen al pie del boletín)
                        </label>
                        <textarea
                            id="obs"
                            rows={3}
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            className={`${INPUT} h-auto resize-y py-2.5 leading-relaxed`}
                            placeholder="Desempeño general, entrevistas con la familia, acuerdos…"
                        />
                    </div>
                </article>

                <aside className="min-w-0 flex-[1_1_18rem] space-y-4 print:hidden">
                    <section className={`${CARD} space-y-2.5 p-4`}>
                        <div
                            className={`${ROW} flex items-center gap-2.5 p-3 ${completo ? "border-teal-400 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30" : ""}`}
                        >
                            <CheckCircleIcon
                                className={`h-5 w-5 shrink-0 ${completo ? "text-teal-600 dark:text-teal-400" : "text-neutral-400"}`}
                            />
                            <p className="text-xs text-neutral-700 dark:text-neutral-200">
                                {completo
                                    ? `Las ${r.materiasDelCurso} materias tienen nota. Está listo para publicar.`
                                    : `Faltan ${r.materiasDelCurso - r.notasCargadas} notas para completarlo.`}
                            </p>
                        </div>
                        <button
                            onClick={() => guardar(r.estado === "publicado" ? "publicado" : "borrador")}
                            disabled={trabajando}
                            className={`${BTN_G} w-full`}
                        >
                            Guardar observaciones
                        </button>
                        {r.estado === "borrador" ? (
                            <button
                                onClick={() => guardar("publicado")}
                                disabled={trabajando}
                                className={`${BTN_P} w-full`}
                            >
                                <CheckBadgeIcon className="h-5 w-5" />
                                Publicar boletín
                            </button>
                        ) : (
                            <button
                                onClick={() => guardar("borrador")}
                                disabled={trabajando}
                                className={`${BTN_G} w-full`}
                            >
                                Volver a borrador
                            </button>
                        )}
                        <button onClick={() => window.print()} className={`${BTN_G} w-full`}>
                            <PrinterIcon className="h-5 w-5" />
                            Imprimir o guardar PDF
                        </button>
                        {aviso && (
                            <p className="text-center text-xs text-neutral-600 dark:text-neutral-300">
                                {aviso}
                            </p>
                        )}
                    </section>

                    {historial.length > 0 && (
                        <section className={`${CARD} p-4`}>
                            <h2 className="font-libertinus text-lg font-bold text-neutral-900 dark:text-neutral-100">
                                Evolución del año
                            </h2>
                            <div className="mt-4 flex h-32 items-end gap-3 border-b border-neutral-200 px-1 dark:border-neutral-700">
                                {historial.map((b) => (
                                    <div
                                        key={b.idBoletin}
                                        className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                                    >
                                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                                            {numero(b.promedio ?? null, 1)}
                                        </span>
                                        <div
                                            className={`w-full max-w-10 rounded-t ${b.bimestre === r.bimestre ? "bg-teal-500" : "bg-neutral-300 dark:bg-neutral-600"}`}
                                            style={{
                                                height: `${Math.max(4, ((b.promedio ?? 0) / maxPromedio) * 100)}%`,
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 px-1 pt-1.5">
                                {historial.map((b) => (
                                    <span
                                        key={b.idBoletin}
                                        className="flex-1 text-center text-[11px] text-neutral-500 dark:text-neutral-400"
                                    >
                                        {b.bimestre}º
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className={`${CARD} p-4`}>
                        <h2 className="font-libertinus text-lg font-bold text-neutral-900 dark:text-neutral-100">
                            Asistencia del bimestre
                        </h2>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            {[
                                ["Presentes", delBimestre?.presentes],
                                ["Ausentes", delBimestre?.ausentes],
                                ["Tardes", delBimestre?.tardes],
                                ["Justificadas", delBimestre?.justificadas],
                            ].map(([label, valor]) => (
                                <div key={String(label)} className={`${ROW} p-2.5`}>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                        {label}
                                    </span>
                                    <br />
                                    <strong className="text-lg text-neutral-900 dark:text-neutral-100">
                                        {valor ?? "—"}
                                    </strong>
                                </div>
                            ))}
                        </div>
                        <p className="mt-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                            Este bimestre:{" "}
                            {delBimestre ? coma(delBimestre.totalInasistencias) : "—"} de{" "}
                            {INASISTENCIAS_POR_BIMESTRE} permitidas · Acumulado del año:{" "}
                            {anual === null ? "—" : coma(anual)} de {INASISTENCIAS_PERMITIDAS} permitidas
                        </p>
                        <Link
                            href={`/preceptoria/legajos/${r.idAlumno}`}
                            className="mt-3 inline-block text-sm text-primary hover:underline"
                        >
                            Ver el legajo completo
                        </Link>
                    </section>
                </aside>
            </div>
        </div>
    );
}
