"use client";

import { useEffect, useState } from "react";
import { ExclamationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface Aviso {
    id: number;
    texto: string;
}

const oyentes = new Set<(aviso: Aviso) => void>();
let contador = 0;

// Muestra un aviso de error no bloqueante (reemplaza a window.alert).
export function notificar(texto: string): void {
    const aviso = { id: ++contador, texto };
    oyentes.forEach((oyente) => oyente(aviso));
}

const DURACION_MS = 7000;

// Se monta una sola vez en el layout raíz.
export function Avisos() {
    const [avisos, setAvisos] = useState<Aviso[]>([]);

    useEffect(() => {
        const quitar = (id: number) => setAvisos((prev) => prev.filter((a) => a.id !== id));
        const oyente = (aviso: Aviso) => {
            setAvisos((prev) => [...prev.slice(-2), aviso]);
            window.setTimeout(() => quitar(aviso.id), DURACION_MS);
        };
        oyentes.add(oyente);
        return () => {
            oyentes.delete(oyente);
        };
    }, []);

    if (avisos.length === 0) return null;

    return (
        <div
            role="alert"
            aria-live="assertive"
            className="pointer-events-none fixed inset-x-4 bottom-20 z-[100] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end"
        >
            {avisos.map((aviso) => (
                <div
                    key={aviso.id}
                    className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-red-200 bg-white p-3 text-sm text-neutral-800 shadow-lg dark:border-red-900 dark:bg-neutral-900 dark:text-neutral-100"
                >
                    <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <p className="min-w-0 flex-1">{aviso.texto}</p>
                    <button
                        type="button"
                        aria-label="Cerrar aviso"
                        onClick={() => setAvisos((prev) => prev.filter((a) => a.id !== aviso.id))}
                        className="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
