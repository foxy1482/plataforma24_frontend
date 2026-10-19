"use client";

import { motion } from "framer-motion";
import db from "@/data/db.json";
import { BookOpenIcon, CheckBadgeIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { ClockIcon } from "@heroicons/react/24/solid";

export default function DashboardPage() {
    // Simulamos la obtención de datos del usuario logueado (Legajo 1: Tomas Palavecino)
    const alumno = db.datos_personales.find((u) => u.num_legajo === 1);
    const materias = db.materias;
    const tareas = db.tareas;
    const entregas = db.entregas.filter((e) => e.num_legajo === 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white dark:bg-neutral-500/40 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <ExclamationCircleIcon className="h-8 w-8 text-primary" />
                        <h2 className="text-2xl font-libertinus font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Tareas Recientes</h2>
                    </div>
                    <div className="space-y-4">
                        {tareas.map((tarea) => {
                            const entrega = entregas.find((e) => e.num_tarea === tarea.id);
                            const materia = materias.find((m) => m.id === tarea.num_materia);
              
                            return (
                                <div key={tarea.id} className="flex justify-between items-center p-4 border border-neutral-100 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-gray-950/50">
                                    <div>
                                        <h3 className="font-libertinus font-semibold text-gray-800 dark:text-gray-100">{tarea.titulo}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{materia?.nombre}</p>
                                    </div>
                                    <div className="text-right">
                                        {entrega?.calificacion ? (
                                            <span className={`inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-lg ${(entrega?.calificacion == "1 (uno)" || entrega?.calificacion == "2 (dos)" || entrega?.calificacion == "3 (tres)" || entrega?.calificacion == "4 (cuatro)") ? "text-red-600 bg-green-50 dark:bg-red-900/28 dark:text-red-400" : "text-green-600 bg-green-50 dark:bg-green-900/28 dark:text-green-400"}`}>
                                                <CheckBadgeIcon className="h-4 w-4" /> Nota: {entrega.calificacion}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-sm font-medium text-orange-400 bg-orange-50 dark:bg-orange-900/28 dark:text-orange-400 px-3 py-1 rounded-lg">
                                                <ClockIcon className="size-4" /> Pendiente
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Tarjeta de Materias */}
                <div className="bg-white dark:bg-neutral-500/40 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <BookOpenIcon className="h-8 w-8 text-primary" />
                        <h2 className="text-2xl font-libertinus font-semibold text-gray-900 dark:text-neutral-100 tracking-tight">Mis Materias</h2>
                    </div>
                    <ul className="space-y-3">
                        {materias.map((materia) => (
                            <li key={materia.id} className="p-3 bg-gray-50 dark:bg-gray-950/50 border border-gray-100 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                                <span className="text-sm font-medium text-gray-700 dark:text-white">
                                    {materia.nombre}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </motion.div>
    );
}