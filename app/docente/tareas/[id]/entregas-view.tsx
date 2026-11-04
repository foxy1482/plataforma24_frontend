"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRightIcon, DocumentIcon } from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import {
    aUtc,
    fechaHora,
    isoFecha,
    notaNumerica,
    notaTexto,
    numero,
    parseFecha,
} from "@/app/lib/format";
import type { Archivo, DatosPersonales, Entrega } from "@/app/lib/types";
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
    Stat,
    Vacio,
    type Tono,
} from "@/app/components/ui";
import { datosDocente, invalidarDocente, type TareaDocente } from "../../datos";
import { notificar } from "@/app/components/avisos";

type Filtro = "todas" | "sin" | "corregidas" | "no";

interface Fila {
    alumno: DatosPersonales;
    entrega: Entrega | null;
    archivos: Archivo[];
    tarde: boolean;
    nota: number | null;
}

export default function EntregasView() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const idTarea = Number(id);

    const [tarea, setTarea] = useState<TareaDocente | null>(null);
    const [filas, setFilas] = useState<Fila[] | null>(null);
    const [error, setError] = useState(false);
    const [filtro, setFiltro] = useState<Filtro>("sin");
    const [guardando, setGuardando] = useState<number | null>(null);
    const [nuevoPlazo, setNuevoPlazo] = useState("");

    const cargar = useCallback(() => {
        datosDocente()
            .then(async (d) => {
                const t = d.tareas.find((x) => x.tarea.id === idTarea);
                if (!t) {
                    setError(true);
                    return;
                }
                setTarea(t);
                setNuevoPlazo(t.vence ? isoFecha(t.vence) : "");

                const materia = d.materias.find((m) => m.materia.id === t.idMateria);
                const alumnos = materia?.alumnos ?? [];

                const archivos = await Promise.all(
                    t.entregas.map((e) =>
                        api.entregaArchivos.porEntrega(e.id).then(
                            (l) => l ?? [],
                            () => []
                        )
                    )
                );
                const porEntrega = new Map(t.entregas.map((e, i) => [e.id, archivos[i]]));
                const limite = t.vence?.getTime();

                const fila = (alumno: DatosPersonales, entrega: Entrega | null): Fila => {
                    const hecha = entrega ? parseFecha(entrega.fechaEntrega)?.getTime() : undefined;
                    return {
                        alumno,
                        entrega,
                        archivos: entrega ? (porEntrega.get(entrega.id) ?? []) : [],
                        tarde: Boolean(limite && hecha !== undefined && hecha > limite),
                        nota: notaNumerica(entrega?.calificacion),
                    };
                };

                // Una fila por cada entrega (aunque su autor no figure en la lista del curso o haya
                // entregado más de una vez), así el listado coincide con el contador "sin corregir".
                const filasEntrega = t.entregas.map((e) => {
                    const alumno = alumnos.find((a) => a.idUsuario === e.idUsuario) ?? {
                        id: e.idUsuario,
                        idUsuario: e.idUsuario,
                        nombre: "Alumno",
                        apellido: `#${e.idUsuario}`,
                        dni: 0,
                        telefonoCelular: "",
                        direccion: "",
                        fechaNacimiento: "",
                    };
                    return fila(alumno, e);
                });
                const filasSinEntrega = alumnos
                    .filter((a) => !t.entregas.some((e) => e.idUsuario === a.idUsuario))
                    .map((a) => fila(a, null));

                setFilas(
                    [...filasEntrega, ...filasSinEntrega].sort((a, b) =>
                        `${a.alumno.apellido}${a.alumno.nombre}`.localeCompare(
                            `${b.alumno.apellido}${b.alumno.nombre}`,
                            "es"
                        )
                    )
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
    }, [idTarea, router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const guardarNota = async (fila: Fila, texto: string) => {
        if (!fila.entrega) return;
        const valor = texto.trim();
        const nota = valor === "" ? null : notaNumerica(valor);
        if (valor !== "" && nota === null) {
            notificar("La nota tiene que ser un número de 1 a 10.");
            return;
        }
        if (nota === fila.nota) return;

        setGuardando(fila.entrega.id);
        try {
            await api.entregas.modificar(fila.entrega.id, {
                calificacion: nota === null ? null : notaTexto(nota),
            });
            invalidarDocente();
            setFilas((prev) =>
                (prev ?? []).map((f) => (f.entrega?.id === fila.entrega?.id ? { ...f, nota } : f))
            );
        } catch (e) {
            registrarError(e);
            notificar("No se pudo guardar la nota.");
        } finally {
            setGuardando(null);
        }
    };

    const extender = async () => {
        if (!tarea || !nuevoPlazo) return;
        try {
            await api.tareas.modificar(tarea.tarea.id, { fechaEntrega: aUtc(`${nuevoPlazo}T23:59:00`) });
            invalidarDocente();
            setTarea(null);
            setFilas(null);
            cargar();
        } catch (e) {
            registrarError(e);
            notificar("No se pudo cambiar la fecha de entrega.");
        }
    };

    const visibles = useMemo(() => {
        if (!filas) return [];
        if (filtro === "todas") return filas;
        if (filtro === "no") return filas.filter((f) => !f.entrega);
        if (filtro === "corregidas") return filas.filter((f) => f.nota !== null);
        return filas.filter((f) => f.entrega && f.nota === null);
    }, [filas, filtro]);

    if (error) {
        return (
            <ErrorPanel
                mensaje="No encontramos esa tarea entre tus materias."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }

    if (!tarea || !filas) {
        return (
            <div className="space-y-4">
                <Cargando className="h-24" />
                <Cargando className="h-96" />
            </div>
        );
    }

    const sinEntregar = filas.filter((f) => !f.entrega);
    const tarde = filas.filter((f) => f.tarde).length;
    const corregidas = filas.filter((f) => f.nota !== null).length;
    const notas = filas.flatMap((f) => (f.nota === null ? [] : [f.nota]));
    const siguiente = filas.find((f) => f.entrega && f.nota === null);

    const filtros: { valor: Filtro; label: string }[] = [
        { valor: "todas", label: `Todas (${filas.length})` },
        { valor: "sin", label: `Sin corregir (${filas.filter((f) => f.entrega && f.nota === null).length})` },
        { valor: "corregidas", label: `Corregidas (${corregidas})` },
        { valor: "no", label: `No entregaron (${sinEntregar.length})` },
    ];

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href={`/docente/materias?materia=${tarea.idMateria}`} className="hover:underline">
                    {tarea.materia} · {tarea.curso}
                </Link>{" "}
                / Entregas
            </nav>

            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="font-libertinus text-3xl font-bold leading-tight text-neutral-900 dark:text-neutral-100">
                        {tarea.tarea.titulo}
                    </h1>
                    <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                        Publicada {fechaHora(tarea.publicada)} ·{" "}
                        {tarea.estado === "abierta" ? "Vence" : "Venció"}{" "}
                        {fechaHora(tarea.vence)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href={`/docente/tareas/${tarea.tarea.id}/detalle`} className={BTN_G}>
                        Ver detalle
                    </Link>
                    {siguiente?.entrega && (
                        <Link
                            href={`/docente/tareas/${tarea.tarea.id}/corregir?entrega=${siguiente.entrega.id}`}
                            className={BTN_P}
                        >
                            Corregir siguiente
                            <ArrowRightIcon className="h-5 w-5" />
                        </Link>
                    )}
                </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                    label="Entregaron"
                    valor={
                        <>
                            {filas.length - sinEntregar.length}
                            <span className="ml-1 text-lg text-neutral-500 dark:text-neutral-400">
                                / {filas.length}
                            </span>
                        </>
                    }
                />
                <Stat label="Fuera de término" valor={tarde} color="text-amber-500" />
                <Stat label="Corregidas" valor={corregidas} color="text-green-500" />
                <Stat label="Promedio parcial" valor={numero(notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null, 1)} />
            </div>

            {sinEntregar.length > 0 && (
                <div className={`${ROW} flex flex-wrap items-center gap-3.5 border-amber-300 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-950/30`}>
                    <p className="flex-[1_1_18rem] text-sm text-neutral-700 dark:text-neutral-200">
                        <strong className="text-amber-700 dark:text-amber-400">
                            {sinEntregar.length}{" "}
                            {sinEntregar.length === 1 ? "alumno no entregó" : "alumnos no entregaron"}:
                        </strong>{" "}
                        {sinEntregar
                            .slice(0, 6)
                            .map((f) => `${f.alumno.nombre} ${f.alumno.apellido}`)
                            .join(", ")}
                        {sinEntregar.length > 6 && ` y ${sinEntregar.length - 6} más`}.
                    </p>
                    <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                        Extender hasta
                        <input
                            type="date"
                            value={nuevoPlazo}
                            onChange={(e) => setNuevoPlazo(e.target.value)}
                            className={`${INPUT} h-9 w-auto`}
                        />
                    </label>
                    <button onClick={extender} className={`${BTN_G} h-9`}>
                        Extender plazo
                    </button>
                </div>
            )}

            <section className={`${CARD} overflow-hidden`}>
                <div className="flex flex-wrap gap-2 border-b border-neutral-200 p-3.5 dark:border-neutral-700">
                    {filtros.map((f) => (
                        <button
                            key={f.valor}
                            onClick={() => setFiltro(f.valor)}
                            className={`h-9 rounded-xl px-3 text-xs font-semibold transition-colors ${
                                filtro === f.valor
                                    ? "bg-primary text-white"
                                    : "border border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-600 dark:text-neutral-300"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {visibles.length === 0 ? (
                    <Vacio>No hay entregas con ese filtro.</Vacio>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[44rem] text-left text-sm">
                            <thead>
                                <tr className="bg-neutral-100 dark:bg-neutral-900">
                                    <th className={`${LABEL} px-4 py-3`}>Alumno</th>
                                    <th className={`${LABEL} px-4 py-3`}>Entrega</th>
                                    <th className={`${LABEL} px-4 py-3`}>Archivos</th>
                                    <th className={`${LABEL} px-4 py-3`}>Nota</th>
                                    <th className={`${LABEL} px-4 py-3`}>
                                        <span className="sr-only">Acción</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                {visibles.map((f) => {
                                    const estado: { tono: Tono; texto: string } = !f.entrega
                                        ? { tono: "rojo", texto: "No entregó" }
                                        : f.tarde
                                          ? { tono: "ambar", texto: "Fuera de término" }
                                          : { tono: "verde", texto: "A tiempo" };
                                    return (
                                        <tr key={f.entrega ? `e${f.entrega.id}` : `a${f.alumno.idUsuario}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar
                                                        id={f.alumno.idUsuario}
                                                        iniciales={`${f.alumno.nombre?.[0] ?? ""}${f.alumno.apellido?.[0] ?? ""}`.toUpperCase()}
                                                        size="h-8 w-8 text-[11px]"
                                                    />
                                                    <div>
                                                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                                            {f.alumno.apellido}, {f.alumno.nombre}
                                                        </p>
                                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                            {f.alumno.dni ? `DNI ${f.alumno.dni}` : `Usuario ${f.alumno.idUsuario}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Chip tono={estado.tono}>{estado.texto}</Chip>
                                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                                    {f.entrega ? fechaHora(f.entrega.fechaEntrega) : "Sin entrega"}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                                                {f.archivos.length === 0 ? (
                                                    "—"
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-xs">
                                                        <DocumentIcon className="h-4 w-4 shrink-0" />
                                                        {f.archivos.length}{" "}
                                                        {f.archivos.length === 1 ? "archivo" : "archivos"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <label>
                                                    <span className="sr-only">
                                                        Nota de {f.alumno.nombre} {f.alumno.apellido}
                                                    </span>
                                                    <input
                                                        defaultValue={f.nota ?? ""}
                                                        disabled={!f.entrega || guardando === f.entrega?.id}
                                                        placeholder="—"
                                                        onBlur={(e) => guardarNota(f, e.target.value)}
                                                        className={`${INPUT} h-9 w-16 px-2 text-center`}
                                                    />
                                                </label>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {f.entrega ? (
                                                    <Link
                                                        href={`/docente/tareas/${tarea.tarea.id}/corregir?entrega=${f.entrega.id}`}
                                                        className={`${f.nota === null ? BTN_P : BTN_G} h-9 text-xs`}
                                                    >
                                                        {f.nota === null ? "Corregir" : "Revisar"}
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs text-neutral-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
