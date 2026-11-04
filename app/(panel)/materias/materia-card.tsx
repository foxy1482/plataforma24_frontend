import Link from "next/link";
import { ClockIcon } from "@heroicons/react/24/outline";
import type { MateriaItem } from "./cargar-materias";

// Color del avatar según el id del docente: siempre el mismo para la misma persona.
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
            <span className="shrink-0 whitespace-nowrap rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                Al día
            </span>
        );
    }
    return (
        <span className="shrink-0 whitespace-nowrap rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {pendientes} {pendientes === 1 ? "tarea pendiente" : "tareas pendientes"}
        </span>
    );
}

export default function MateriaCard({ materia }: { materia: MateriaItem }) {
    const { docente } = materia;
    const colorAvatar = AVATARES[docente.id % AVATARES.length];

    return (
        <Link
            href={`/materias/${materia.id}`}
            className="block rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-libertinus text-xl font-bold leading-snug text-neutral-900 dark:text-neutral-100">
                        {materia.nombre}
                    </h2>
                    {materia.horario && (
                        <p className="mt-2 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                            <ClockIcon className="h-4 w-4 shrink-0" />
                            {materia.horario}
                        </p>
                    )}
                </div>
                <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-neutral-200 text-lg font-bold dark:border-neutral-700 ${colorAvatar}`}
                    aria-hidden="true"
                >
                    {docente.iniciales}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {docente.nombre}
                    </p>
                    {materia.aula && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {materia.aula}
                        </p>
                    )}
                </div>
                <Badge pendientes={materia.pendientes} />
            </div>
        </Link>
    );
}
