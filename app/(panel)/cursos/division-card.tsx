"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Chip, LABEL, ROW } from "@/app/components/ui";
import { cargarDivision, type DetalleDivision, type DivisionItem } from "./cargar-cursos";

export default function DivisionCard({ division }: { division: DivisionItem }) {
    const [abierto, setAbierto] = useState(division.mia);
    const [detalle, setDetalle] = useState<DetalleDivision | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!abierto || detalle || error) return;
        cargarDivision(division.curso.id)
            .then(setDetalle)
            .catch(() => setError(true));
    }, [abierto, detalle, error, division.curso.id]);

    return (
        <div className={`${ROW} overflow-hidden ${division.mia ? "border-primary/60" : ""}`}>
            <button
                onClick={() => setAbierto(!abierto)}
                aria-expanded={abierto}
                className="flex min-h-11 w-full items-center justify-between gap-2 p-3.5 text-left"
            >
                <span>
                    <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {division.nombre}
                        </span>
                        {division.mia && <Chip tono="azul">Tu curso</Chip>}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                        {[
                            division.turno && `Turno ${division.turno}`,
                            division.aula && `Aula ${division.aula}`,
                            detalle?.alumnos != null &&
                                `${detalle.alumnos} alumno${detalle.alumnos === 1 ? "" : "s"}`,
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                </span>
                <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${abierto ? "rotate-180" : ""}`}
                />
            </button>

            {abierto && (
                <div className="px-4 pb-3.5">
                    <p className={`${LABEL} border-t border-neutral-200 pb-1.5 pt-2.5 dark:border-neutral-700`}>
                        Materias
                    </p>
                    {error ? (
                        <p role="alert" className="py-2 text-xs text-red-600 dark:text-red-400">
                            No se pudieron cargar las materias.{" "}
                            <button
                                type="button"
                                onClick={() => setError(false)}
                                className="font-semibold underline"
                            >
                                Reintentar
                            </button>
                        </p>
                    ) : !detalle ? (
                        <div className="space-y-2 py-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-3.5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
                                />
                            ))}
                        </div>
                    ) : detalle.materias.length === 0 ? (
                        <p className="py-2 text-xs text-neutral-500 dark:text-neutral-400">
                            Esta división no tiene materias cargadas.
                        </p>
                    ) : (
                        <ul>
                            {detalle.materias.map((m) => (
                                <li
                                    key={m.id}
                                    className="flex justify-between gap-3 border-b border-neutral-200 py-1.5 text-xs last:border-0 dark:border-neutral-800"
                                >
                                    <span className="text-neutral-700 dark:text-neutral-200">{m.nombre}</span>
                                    <span className="whitespace-nowrap text-right text-neutral-500 dark:text-neutral-400">
                                        {m.profesor}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
