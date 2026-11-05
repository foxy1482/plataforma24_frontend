"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, ExclamationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

type TipoAviso = "error" | "exito";

interface Aviso {
    id: number;
    texto: string;
    tipo: TipoAviso;
}

const oyentes = new Set<(aviso: Aviso) => void>();
let contador = 0;

// Muestra un aviso no bloqueante (reemplaza a window.alert). Por defecto es de error; para confirmar algo
// que salió bien: notificar("Listo", "exito").
export function notificar(texto: string, tipo: TipoAviso = "error"): void {
    const aviso = { id: ++contador, texto, tipo };
    oyentes.forEach((oyente) => oyente(aviso));
}

const DURACION_MS = 7000;

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
                    className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-3 text-sm text-neutral-800 shadow-lg dark:bg-neutral-900 dark:text-neutral-100 ${
                        aviso.tipo === "exito"
                            ? "border-green-200 dark:border-green-900"
                            : "border-red-200 dark:border-red-900"
                    }`}
                >
                    {aviso.tipo === "exito" ? (
                        <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                        <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    )}
                    <p className="min-w-0 flex-1">{aviso.texto}</p>
                    <button
                        type="button"
                        aria-label="Cerrar aviso"
                        onClick={() => setAvisos((prev) => prev.filter((a) => a.id !== aviso.id))}
                        className="shrink-0 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
