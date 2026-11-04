"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    ExclamationTriangleIcon,
    PencilSquareIcon,
    PlusIcon,
    PrinterIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { notificar } from "@/app/components/avisos";
import {
    coma,
    edadDe,
    fechaCorta,
    INASISTENCIAS_PERMITIDAS,
    numero,
    ordinal,
} from "@/app/lib/format";
import { fechaNacimientoTexto, sexoTexto } from "@/app/lib/datos-personales";
import { cursoLargo, inicialesDeNombre } from "@/app/lib/sesion";
import DatosPersonalesForm from "@/app/components/datos-personales-form";
import {
    Avatar,
    BTN_G,
    BTN_R,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    LABEL,
    ROW,
} from "@/app/components/ui";
import { datosPreceptoria } from "../../datos";
import { cargarLegajo, type Legajo } from "./cargar-legajo";

export default function LegajoView() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const idAlumno = Number(id);

    // Igual que en el boletín: los datos quedan atados al alumno que se pidió.
    const [cargado, setCargado] = useState<{ id: number; valor: Legajo } | null>(null);
    const legajo = cargado?.id === idAlumno ? cargado.valor : null;
    const [error, setError] = useState(false);
    const [editandoDatos, setEditandoDatos] = useState(false);
    const [eliminando, setEliminando] = useState(false);

    const cargar = useCallback(() => {
        datosPreceptoria()
            .then((d) => cargarLegajo(idAlumno, d.ciclo))
            .then((valor) => setCargado({ id: idAlumno, valor }))
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [idAlumno, router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const eliminarDatos = async () => {
        if (
            !window.confirm(
                "¿Eliminar los datos personales de este alumno? Se pierden el DNI, la fecha de nacimiento, el celular y el domicilio. Esta acción no se puede deshacer."
            )
        ) {
            return;
        }
        setEliminando(true);
        try {
            await api.datos.eliminar(idAlumno);
            cargar();
        } catch (e) {
            registrarError(e);
            notificar(
                e instanceof ApiError && e.status === 403
                    ? "Tu usuario no tiene permiso para eliminar estos datos."
                    : mensajeDeError(e, "No se pudieron eliminar los datos personales.")
            );
        } finally {
            setEliminando(false);
        }
    };

    if (error) return <ErrorPanel mensaje="No encontramos ese legajo." onReintentar={cargar} />;
    if (!legajo) {
        return (
            <div className="space-y-4">
                <Cargando className="h-32" />
                <Cargando className="h-96" />
            </div>
        );
    }

    const { datos, curso } = legajo;
    const ultimo = legajo.boletines.at(-1);
    const desaprobadas = ultimo?.materiasDesaprobadas ?? 0;
    const restantes =
        legajo.anuales === null ? null : Math.max(0, INASISTENCIAS_PERMITIDAS - legajo.anuales);
    const enRiesgo = restantes !== null && restantes <= 8;
    const edad = edadDe(datos?.fechaNacimiento);
    const sinDatos = !datos;

    return (
        <div className="mx-auto max-w-5xl space-y-4">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link
                    href={`/preceptoria/legajos${curso ? `?curso=${curso.id}` : ""}`}
                    className="hover:underline"
                >
                    Legajos
                </Link>{" "}
                / {legajo.nombre}
            </nav>

            <div className={`${CARD} flex flex-wrap items-center gap-5 p-5`}>
                <Avatar
                    id={idAlumno}
                    iniciales={inicialesDeNombre(legajo.nombre)}
                    size="h-20 w-20 text-2xl"
                />
                <div className="min-w-0 flex-[1_1_16rem]">
                    <h1 className="font-libertinus text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                        {legajo.nombre}
                    </h1>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {[
                            legajo.usuario.numeroLegajo && `Legajo ${legajo.usuario.numeroLegajo}`,
                            curso && cursoLargo(curso),
                            curso?.aula,
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                        <Chip tono={enRiesgo ? "rojo" : "gris"}>
                            {legajo.anuales === null ? "Sin datos de" : coma(legajo.anuales)} de{" "}
                            {INASISTENCIAS_PERMITIDAS} inasistencias
                        </Chip>
                        {desaprobadas > 0 && (
                            <Chip tono="ambar">
                                {desaprobadas}{" "}
                                {desaprobadas === 1 ? "materia desaprobada" : "materias desaprobadas"}
                            </Chip>
                        )}
                        {legajo.pendientes && legajo.pendientes.length > 0 && (
                            <Chip tono="ambar">
                                {legajo.pendientes.length}{" "}
                                {legajo.pendientes.length === 1 ? "entrega" : "entregas"} sin hacer
                            </Chip>
                        )}
                    </div>
                </div>
                <button onClick={() => window.print()} className={`${BTN_G} print:hidden`}>
                    <PrinterIcon className="h-5 w-5" />
                    Imprimir legajo
                </button>
            </div>

            {enRiesgo && (
                <div
                    className={`${ROW} flex flex-wrap items-center gap-3 border-red-300 bg-red-50 p-3.5 dark:border-red-900 dark:bg-red-950/30`}
                >
                    <ExclamationTriangleIcon className="h-6 w-6 shrink-0 text-red-500" />
                    <p className="flex-[1_1_20rem] text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
                        <strong>Le quedan {coma(restantes)} inasistencias</strong> antes de quedar libre.
                        {legajo.porBimestre.at(-1) &&
                            ` En el ${ordinal(legajo.porBimestre.at(-1)!.bimestre)} bimestre ya acumula ${coma(legajo.porBimestre.at(-1)!.totalInasistencias)}.`}
                    </p>
                </div>
            )}

            <div className="flex flex-wrap items-start gap-5">
                {editandoDatos ? (
                    <div className="min-w-0 flex-[1_1_28rem]">
                        <DatosPersonalesForm
                            idUsuario={idAlumno}
                            datos={datos}
                            puedeEliminar
                            onCancelar={() => setEditandoDatos(false)}
                            onGuardado={() => {
                                setEditandoDatos(false);
                                cargar();
                            }}
                        />
                    </div>
                ) : (
                <section className={`${CARD} min-w-0 flex-[1_1_20rem] p-5`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Datos personales
                        </h2>
                        {!legajo.datosRestringidos && (
                            <div className="flex gap-2 print:hidden">
                                <button
                                    type="button"
                                    onClick={() => setEditandoDatos(true)}
                                    className={`${BTN_G} h-9 px-3`}
                                >
                                    {sinDatos ? (
                                        <PlusIcon className="h-4 w-4" />
                                    ) : (
                                        <PencilSquareIcon className="h-4 w-4" />
                                    )}
                                    {sinDatos ? "Cargar datos" : "Editar"}
                                </button>
                                {!sinDatos && (
                                    <button
                                        type="button"
                                        onClick={eliminarDatos}
                                        disabled={eliminando}
                                        aria-label="Eliminar datos personales"
                                        className={`${BTN_R} h-9 px-3`}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                        {eliminando ? "Eliminando…" : "Eliminar"}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {legajo.datosRestringidos && (
                        <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                            Tu usuario no tiene permiso para ver los datos personales completos (DNI, fecha de
                            nacimiento, celular, domicilio).
                        </p>
                    )}
                    {sinDatos && !legajo.datosRestringidos && (
                        <p className="mt-1.5 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                            Este alumno todavía no tiene datos personales cargados. El nombre que se muestra sale de su
                            usuario o de los boletines.
                        </p>
                    )}
                    <dl className="mt-3 space-y-2.5 text-sm">
                        {[
                            ["Apellido y nombre", datos ? `${datos.apellido}, ${datos.nombre}` : legajo.nombre],
                            ["DNI", datos?.dni ? String(datos.dni) : "—"],
                            [
                                "Fecha de nacimiento",
                                datos?.fechaNacimiento
                                    ? `${fechaNacimientoTexto(datos.fechaNacimiento)}${edad !== null ? ` (${edad} años)` : ""}`
                                    : "—",
                            ],
                            ["Sexo", datos ? sexoTexto(datos.sexo) : "—"],
                            ["Celular", datos?.telefonoCelular ? String(datos.telefonoCelular) : "—"],
                            ["Domicilio", datos?.direccion || "—"],
                            ["Correo", legajo.usuario.email || "—"],
                            [
                                "Usuario",
                                legajo.usuario.nombreUsuario ?? legajo.usuario.nombre ?? "—",
                            ],
                        ].map(([clave, valor]) => (
                            <div key={clave}>
                                <dt className={LABEL}>{clave}</dt>
                                <dd className="text-neutral-900 dark:text-neutral-100">{valor}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
                )}

                <div className="min-w-0 flex-[999_1_26rem] space-y-5">
                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Asistencia por bimestre
                        </h2>
                        {legajo.porBimestre.length === 0 ? (
                            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                                Todavía no hay asistencia registrada en el ciclo {legajo.ciclo}.
                            </p>
                        ) : (
                            <div className="mt-3 overflow-x-auto">
                                <table className="w-full min-w-[26rem] text-left text-sm">
                                    <thead>
                                        <tr>
                                            <th className={`${LABEL} py-2`}>Bimestre</th>
                                            <th className={`${LABEL} py-2`}>Días</th>
                                            <th className={`${LABEL} py-2`}>Ausentes</th>
                                            <th className={`${LABEL} py-2`}>Tardes</th>
                                            <th className={`${LABEL} py-2`}>Justif.</th>
                                            <th className={`${LABEL} py-2`}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                        {legajo.porBimestre.map((b) => (
                                            <tr key={b.idPeriodo}>
                                                <td className="py-2 font-medium text-neutral-900 dark:text-neutral-100">
                                                    {b.bimestre}º
                                                </td>
                                                <td className="py-2 text-neutral-600 dark:text-neutral-300">
                                                    {b.diasRegistrados}
                                                </td>
                                                <td
                                                    className={`py-2 ${b.ausentes >= 6 ? "font-semibold text-red-600 dark:text-red-400" : "text-neutral-600 dark:text-neutral-300"}`}
                                                >
                                                    {b.ausentes}
                                                </td>
                                                <td className="py-2 text-neutral-600 dark:text-neutral-300">
                                                    {b.tardes}
                                                </td>
                                                <td className="py-2 text-neutral-600 dark:text-neutral-300">
                                                    {b.justificadas}
                                                </td>
                                                <td className="py-2 font-semibold text-neutral-900 dark:text-neutral-100">
                                                    {coma(b.totalInasistencias)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Boletines {legajo.ciclo}
                        </h2>
                        {legajo.boletines.length === 0 ? (
                            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                                Todavía no hay boletines generados.
                            </p>
                        ) : (
                            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                                {legajo.boletines.map((b) => (
                                    <Link
                                        key={b.idBoletin}
                                        href={`/preceptoria/boletines/${b.idBoletin}`}
                                        className={`${ROW} block p-3 transition-colors hover:border-primary/60 ${b.estado === "borrador" ? "border-dashed" : ""}`}
                                    >
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {ordinal(b.bimestre)} bimestre
                                            {b.estado === "borrador" && " · borrador"}
                                        </p>
                                        <p className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                            {numero(b.promedio ?? null)}
                                        </p>
                                        <p
                                            className={`text-xs ${b.materiasDesaprobadas > 0 ? "text-amber-600 dark:text-amber-400" : "text-neutral-500 dark:text-neutral-400"}`}
                                        >
                                            {b.materiasDesaprobadas > 0
                                                ? `${b.materiasDesaprobadas} desaprobadas`
                                                : `${b.notasCargadas} de ${b.materiasDelCurso} notas`}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className={`${CARD} p-5`}>
                        <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            Entregas pendientes
                        </h2>
                        {legajo.pendientes === null ? (
                            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                                Tu rol no tiene acceso a las entregas de los alumnos, así que no se puede
                                saber qué le falta entregar.
                            </p>
                        ) : legajo.pendientes.length === 0 ? (
                            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                                No tiene entregas vencidas sin presentar.
                            </p>
                        ) : (
                            <ul className="mt-3 space-y-2">
                                {legajo.pendientes.slice(0, 10).map((p) => (
                                    <li
                                        key={p.idTarea}
                                        className={`${ROW} flex flex-wrap justify-between gap-2.5 p-2.5`}
                                    >
                                        <span className="text-sm text-neutral-900 dark:text-neutral-100">
                                            {p.titulo}
                                        </span>
                                        <span className="text-xs text-red-600 dark:text-red-400">
                                            {p.materia} · venció {fechaCorta(p.vence)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
