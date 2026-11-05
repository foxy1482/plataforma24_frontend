"use client";

import { useEffect } from "react";
import Link from "next/link";
import { registrarError } from "@/app/lib/apiClient";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        registrarError("Error no controlado en la pantalla:", error);
    }, [error]);

    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
            <h1 className="font-libertinus text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                Algo salió mal
            </h1>
            <p className="max-w-md text-neutral-600 dark:text-neutral-400">
                No pudimos mostrar esta pantalla. Podés intentarlo de nuevo o volver al inicio.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded-xl bg-primary px-6 font-bold text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                    Reintentar
                </button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center rounded-xl border border-neutral-300 px-6 font-semibold text-neutral-800 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                    Ir al inicio
                </Link>
            </div>
        </main>
    );
}
