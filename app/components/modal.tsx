"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";

const FOCUSABLES =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Ventana modal accesible: role="dialog", foco atrapado y devuelto al cerrar, Esc y clic fuera cierran,
// el scroll de la página queda bloqueado y en el celular ocupa toda la pantalla.
// Se monta solo cuando hay que mostrarla (render condicional del padre).
export default function Modal({
    titulo,
    descripcion,
    onCerrar,
    bloqueado = false,
    pie,
    ancho = "max-w-2xl",
    children,
}: {
    titulo: string;
    descripcion?: string;
    onCerrar: () => void;
    // true mientras se guarda: Esc, el clic fuera y la X no cierran
    bloqueado?: boolean;
    pie?: React.ReactNode;
    ancho?: string;
    children: React.ReactNode;
}) {
    const idTitulo = useId();
    const idDescripcion = useId();
    const dialogo = useRef<HTMLDivElement>(null);
    // Los manejadores leen siempre lo último sin tener que re-suscribirse
    const estado = useRef({ onCerrar, bloqueado });
    useEffect(() => {
        estado.current = { onCerrar, bloqueado };
    });

    useEffect(() => {
        const previo = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const primero = dialogo.current?.querySelector<HTMLElement>("[data-modal-cuerpo] " + FOCUSABLES);
        (primero ?? dialogo.current)?.focus();

        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                if (!estado.current.bloqueado) estado.current.onCerrar();
                return;
            }
            if (e.key !== "Tab" || !dialogo.current) return;

            const enfocables = [...dialogo.current.querySelectorAll<HTMLElement>(FOCUSABLES)].filter(
                (el) => el.offsetParent !== null
            );
            if (enfocables.length === 0) {
                e.preventDefault();
                dialogo.current.focus();
                return;
            }
            const primero = enfocables[0];
            const ultimo = enfocables[enfocables.length - 1];
            const activo = document.activeElement;
            if (e.shiftKey && (activo === primero || activo === dialogo.current)) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && activo === ultimo) {
                e.preventDefault();
                primero.focus();
            }
        };

        document.addEventListener("keydown", alTeclear, true);
        return () => {
            document.removeEventListener("keydown", alTeclear, true);
            document.body.style.overflow = overflow;
            previo?.focus?.();
        };
    }, []);

    return createPortal(
        <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
            onMouseDown={(e) => {
                // Solo si el clic empezó en el fondo (no al soltar un arrastre que venía de adentro)
                if (e.target === e.currentTarget && !estado.current.bloqueado) estado.current.onCerrar();
            }}
        >
            <div
                ref={dialogo}
                role="dialog"
                aria-modal="true"
                aria-labelledby={idTitulo}
                aria-describedby={descripcion ? idDescripcion : undefined}
                tabIndex={-1}
                className={`flex h-full w-full flex-col overflow-hidden bg-white shadow-xl outline-none sm:h-auto sm:max-h-[85vh] sm:rounded-2xl dark:bg-neutral-900 ${ancho}`}
            >
                <header className="flex items-start justify-between gap-3 border-b border-neutral-200 p-4 sm:p-5 dark:border-neutral-700">
                    <div className="min-w-0">
                        <h2
                            id={idTitulo}
                            className="font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100"
                        >
                            {titulo}
                        </h2>
                        {descripcion && (
                            <p id={idDescripcion} className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                                {descripcion}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onCerrar}
                        disabled={bloqueado}
                        aria-label="Cerrar"
                        title="Cerrar (Esc)"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </header>

                <div data-modal-cuerpo className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    {children}
                </div>

                {pie && (
                    <footer className="border-t border-neutral-200 p-4 sm:px-5 dark:border-neutral-700">{pie}</footer>
                )}
            </div>
        </div>,
        document.body
    );
}
