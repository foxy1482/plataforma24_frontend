"use client";

import { useState } from "react";
import { IdentificationIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { ApiError, auth, mensajeDeError, registrarError } from "../lib/apiClient";

const MINIMO = 5;

const INPUT =
    "block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600";

// Cuenta con la contraseña blanqueada por un administrador: sin mail de recuperación, la identidad
// se confirma con el número de legajo. Al crearla, el backend devuelve el token y se entra directo.
export default function CrearPassword({
    email,
    onCreada,
    onVolver,
}: {
    email: string;
    onCreada: (token: string) => Promise<void>;
    onVolver: () => void;
}) {
    const [legajo, setLegajo] = useState("");
    const [nueva, setNueva] = useState("");
    const [repetida, setRepetida] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!legajo.trim()) return setError("Ingresá tu número de legajo.");
        if (nueva.length < MINIMO) return setError(`La contraseña debe tener al menos ${MINIMO} caracteres.`);
        if (nueva !== repetida) return setError("Las contraseñas no coinciden.");

        setEnviando(true);
        try {
            const r = await auth.crearPassword({ email, numeroLegajo: legajo.trim().toUpperCase(), passwordNueva: nueva });
            if (!r?.token) throw new Error("sin token");
            await onCreada(r.token);
        } catch (err) {
            registrarError("Error al crear la contraseña:", err);
            setError(
                err instanceof ApiError && err.status === 0
                    ? "No se pudo conectar con el servidor."
                    : mensajeDeError(err, "No se pudo crear la contraseña. Intentá de nuevo.")
            );
            setEnviando(false);
        }
    };

    return (
        <form onSubmit={enviar} className="space-y-5" noValidate>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                La contraseña de <strong>{email}</strong> fue blanqueada. Creá una nueva confirmando tu número de
                legajo (lo ves en tu perfil o te lo da la oficina de alumnos, por ejemplo <strong>ALU-0012</strong>).
            </div>

            {error && (
                <div role="alert" className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-xl text-center border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            <div>
                <label htmlFor="legajo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Número de legajo
                </label>
                <div className="relative">
                    <IdentificationIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    <input
                        id="legajo"
                        name="legajo"
                        autoComplete="off"
                        required
                        value={legajo}
                        onChange={(e) => setLegajo(e.target.value)}
                        className={`${INPUT} uppercase`}
                        placeholder="ALU-0012"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="nueva" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contraseña nueva
                </label>
                <div className="relative">
                    <LockClosedIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    <input
                        id="nueva"
                        name="nueva"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={nueva}
                        onChange={(e) => setNueva(e.target.value)}
                        className={INPUT}
                    />
                </div>
            </div>

            <div>
                <label htmlFor="repetida" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Repetir contraseña
                </label>
                <div className="relative">
                    <LockClosedIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    <input
                        id="repetida"
                        name="repetida"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={repetida}
                        onChange={(e) => setRepetida(e.target.value)}
                        className={INPUT}
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={enviando}
                className="w-full flex justify-center py-3 px-4 rounded-xl shadow-md text-lg font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all active:scale-[0.98] disabled:opacity-50"
            >
                {enviando ? "Guardando…" : "Crear contraseña e ingresar"}
            </button>
            <button
                type="button"
                onClick={onVolver}
                disabled={enviando}
                className="w-full text-sm font-medium text-primary hover:text-primary/80"
            >
                Volver al inicio de sesión
            </button>
        </form>
    );
}
