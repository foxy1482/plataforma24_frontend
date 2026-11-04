"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { alumnosDeCurso } from "@/app/lib/alumnos";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { normalizar } from "@/app/lib/format";
import { cursoLargo, nombreCurso } from "@/app/lib/sesion";
import type { DatosPersonales } from "@/app/lib/types";
import {
    Avatar,
    CARD,
    Cargando,
    ErrorPanel,
    INPUT,
    LABEL,
    Select,
    Vacio,
} from "@/app/components/ui";
import { cursoDe, datosPreceptoria, type DatosPreceptoria } from "../datos";

export default function LegajosView() {
    const router = useRouter();
    const params = useSearchParams();

    const [datos, setDatos] = useState<DatosPreceptoria | null>(null);
    const [alumnos, setAlumnos] = useState<DatosPersonales[] | null>(null);
    const [busqueda, setBusqueda] = useState("");
    const [error, setError] = useState(false);

    const idCurso = params.get("curso") ? Number(params.get("curso")) : null;

    useEffect(() => {
        datosPreceptoria()
            .then(setDatos)
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

    const cargar = useCallback(async (): Promise<DatosPersonales[]> => {
        if (!curso) return [];
        const lista = await alumnosDeCurso(curso.id);
        return [...lista].sort((a, b) =>
            `${a.apellido}${a.nombre}`.localeCompare(`${b.apellido}${b.nombre}`, "es")
        );
    }, [curso]);

    const refrescar = useCallback(() => {
        cargar()
            .then(setAlumnos)
            .catch((e) => {
                registrarError(e);
                setError(true);
            });
    }, [cargar]);

    useEffect(() => {
        refrescar();
    }, [refrescar]);

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar los legajos."
                onReintentar={() => {
                    setError(false);
                    refrescar();
                }}
            />
        );
    }
    if (!datos) return <Cargando className="h-96" />;
    if (!curso) return <Vacio>No hay cursos cargados todavía.</Vacio>;

    const q = normalizar(busqueda.trim());
    const visibles = (alumnos ?? []).filter(
        (a) =>
            !q ||
            normalizar(`${a.apellido} ${a.nombre}`).includes(q) ||
            (a.dni ? String(a.dni).includes(q) : false) ||
            normalizar(a.numeroLegajo ?? "").includes(q)
    );

    const conLegajo = (alumnos ?? []).some((a) => a.numeroLegajo);

    return (
        <div className="mx-auto max-w-4xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        Legajos de alumnos
                    </h1>
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        {nombreCurso(curso)} · {alumnos?.length ?? "…"} alumnos
                    </p>
                </div>
                <label className="relative block w-full sm:w-64">
                    <span className="sr-only">Buscar alumno por nombre, DNI o legajo</span>
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre, DNI o legajo"
                        className={`${INPUT} pl-10`}
                    />
                </label>
            </header>

            <Select
                label="Curso"
                valor={curso.id}
                onChange={(v) => router.replace(`/preceptoria/legajos?curso=${v}`)}
            >
                {datos.cursos.map((c) => (
                    <option key={c.id} value={c.id}>
                        {cursoLargo(c)}
                    </option>
                ))}
            </Select>

            {!alumnos ? (
                <Cargando className="h-96" />
            ) : visibles.length === 0 ? (
                <Vacio>
                    {q
                        ? `Ningún alumno coincide con "${busqueda}".`
                        : "Este curso no tiene alumnos cargados."}
                </Vacio>
            ) : (
                <section className={`${CARD} overflow-hidden`}>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-neutral-100 dark:bg-neutral-900">
                                <th className={`${LABEL} px-4 py-3`}>Alumno</th>
                                {conLegajo && <th className={`${LABEL} hidden px-4 py-3 sm:table-cell`}>Legajo</th>}
                                <th className={`${LABEL} hidden px-4 py-3 sm:table-cell`}>DNI</th>
                                <th className={`${LABEL} hidden px-4 py-3 sm:table-cell`}>Celular</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                            {visibles.map((a) => (
                                <tr
                                    key={a.idUsuario}
                                    className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                                >
                                    <td className="px-4 py-2.5">
                                        <Link
                                            href={`/preceptoria/legajos/${a.idUsuario}`}
                                            className="flex items-center gap-2.5"
                                        >
                                            <Avatar
                                                id={a.idUsuario}
                                                iniciales={`${a.nombre?.[0] ?? ""}${a.apellido?.[0] ?? ""}`.toUpperCase()}
                                                size="h-8 w-8 text-[11px]"
                                            />
                                            <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                                {a.apellido}, {a.nombre}
                                            </span>
                                        </Link>
                                    </td>
                                    {conLegajo && (
                                        <td className="hidden px-4 py-2.5 text-neutral-600 sm:table-cell dark:text-neutral-300">
                                            {a.numeroLegajo || "—"}
                                        </td>
                                    )}
                                    <td className="hidden px-4 py-2.5 text-neutral-600 sm:table-cell dark:text-neutral-300">
                                        {a.dni || "—"}
                                    </td>
                                    <td className="hidden px-4 py-2.5 text-neutral-600 sm:table-cell dark:text-neutral-300">
                                        {a.telefonoCelular || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}
        </div>
    );
}
