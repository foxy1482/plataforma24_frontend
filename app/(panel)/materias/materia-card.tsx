import Link from "next/link";
import {
    ArrowRightIcon,
    BookOpenIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationCircleIcon,
    FolderOpenIcon,
    MapPinIcon,
} from "@heroicons/react/24/outline";
import { formatoLimite } from "../tareas/tarea-utils";
import type { MateriaItem } from "./cargar-materias";

const AVATARES = [
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
    "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
];

function Badge({ pendientes }: { pendientes: number | null }) {
    if (pendientes === null) return null;

    if (pendientes === 0) {
        return (
            <span className="shrink-0 whitespace-nowrap rounded-lg bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">
                Al día
            </span>
        );
    }
    return (
        <span className="shrink-0 whitespace-nowrap rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {pendientes} {pendientes === 1 ? "pendiente" : "pendientes"}
        </span>
    );
}

export default function MateriaCard({ materia }: { materia: MateriaItem }) {
    const { docente, proxima } = materia;
    const colorAvatar = AVATARES[docente.id % AVATARES.length];

    return (
        <Link
            href={`/materias/${materia.id}`}
            className="group flex h-full min-h-60 flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-neutral-700 dark:bg-neutral-800"
        >
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary" aria-hidden="true">
                    <BookOpenIcon className="h-6 w-6" />
                </div>
                <h2 className="min-w-0 flex-1 font-libertinus text-xl font-bold leading-snug text-neutral-900 [overflow-wrap:anywhere] dark:text-neutral-100">
                    {materia.nombre}
                </h2>
                <Badge pendientes={materia.pendientes} />
            </div>

            <div className="mt-4 flex items-center gap-2.5">
                <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colorAvatar}`}
                    aria-hidden="true"
                >
                    {docente.iniciales}
                </div>
                <p className="min-w-0 truncate text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {docente.nombre}
                </p>
            </div>

            {(materia.aula || materia.horario) && (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {materia.aula && (
                        <span className="inline-flex items-center gap-1">
                            <MapPinIcon className="h-4 w-4 shrink-0" />
                            {materia.aula}
                        </span>
                    )}
                    {materia.horario && (
                        <span className="inline-flex items-center gap-1">
                            <ClockIcon className="h-4 w-4 shrink-0" />
                            {materia.horario}
                        </span>
                    )}
                </p>
            )}

            <dl className="mt-4 space-y-2.5 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-700">
                <div className="flex items-start gap-2.5">
                    {proxima ? (
                        <ExclamationCircleIcon
                            className={`mt-0.5 h-5 w-5 shrink-0 ${proxima.vencida ? "text-red-500" : "text-primary"}`}
                        />
                    ) : (
                        <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
                    )}
                    <div className="min-w-0">
                        <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                            {proxima?.vencida ? "Entrega vencida" : "Próxima entrega"}
                        </dt>
                        <dd className="text-neutral-900 dark:text-neutral-100">
                            {proxima ? (
                                <>
                                    <span className="block truncate font-medium">{proxima.titulo}</span>
                                    {proxima.fecha && (
                                        <span
                                            className={`text-xs ${proxima.vencida ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"}`}
                                        >
                                            {formatoLimite(proxima.fecha)}
                                        </span>
                                    )}
                                </>
                            ) : materia.pendientes === null ? (
                                <span className="text-neutral-500 dark:text-neutral-400">No se pudo consultar</span>
                            ) : (
                                <span>Sin entregas pendientes</span>
                            )}
                        </dd>
                    </div>
                </div>

                {materia.materiales !== null && (
                    <div className="flex items-center gap-2.5">
                        <FolderOpenIcon className="h-5 w-5 shrink-0 text-neutral-400" />
                        <dt className="sr-only">Material de estudio</dt>
                        <dd className="text-neutral-700 dark:text-neutral-300">
                            {materia.materiales === 0
                                ? "Sin material de estudio"
                                : `${materia.materiales} ${materia.materiales === 1 ? "material" : "materiales"} de estudio`}
                        </dd>
                    </div>
                )}
            </dl>

            <span className="mt-auto flex items-center justify-end gap-1 pt-4 text-sm font-semibold text-primary">
                Ver materia
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
        </Link>
    );
}
