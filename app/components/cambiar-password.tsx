"use client";

import { useId, useState } from "react";
import * as api from "@/app/lib/apiClient";
import { mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { BTN_G, BTN_P, CARD, INPUT, LABEL } from "@/app/components/ui";

const MINIMO = 5;

// Cambio de contraseña desde el perfil (todos los roles). Pide la actual; si un administrador
// la blanqueó, el usuario entra creando una nueva desde el login, no desde acá.
export default function CambiarPassword() {
    const id = useId();
    const [abierto, setAbierto] = useState(false);
    const [actual, setActual] = useState("");
    const [nueva, setNueva] = useState("");
    const [repetida, setRepetida] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const cerrar = () => {
        setAbierto(false);
        setActual("");
        setNueva("");
        setRepetida("");
        setError(null);
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!actual) return setError("Ingresá tu contraseña actual.");
        if (nueva.length < MINIMO) return setError(`La contraseña nueva debe tener al menos ${MINIMO} caracteres.`);
        if (nueva !== repetida) return setError("Las contraseñas nuevas no coinciden.");
        if (nueva === actual) return setError("La contraseña nueva tiene que ser distinta de la actual.");

        setGuardando(true);
        try {
            await api.auth.cambiarPassword({ passwordActual: actual, passwordNueva: nueva });
            cerrar();
            setOk(true);
        } catch (err) {
            registrarError(err);
            setError(mensajeDeError(err, "No se pudo cambiar la contraseña. Intentá de nuevo."));
        } finally {
            setGuardando(false);
        }
    };

    if (!abierto) {
        return (
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => { setOk(false); setAbierto(true); }} className={BTN_G}>
                    Cambiar contraseña
                </button>
                {ok && (
                    <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
                        Listo, tu contraseña se cambió.
                    </p>
                )}
            </div>
        );
    }

    const campo = (clave: string, etiqueta: string, valor: string, cambiar: (v: string) => void, autoComplete: string) => (
        <div className="min-w-0 flex-[1_1_14rem]">
            <label htmlFor={`${id}-${clave}`} className={`${LABEL} mb-1.5 block`}>
                {etiqueta}
            </label>
            <input
                id={`${id}-${clave}`}
                type="password"
                autoComplete={autoComplete}
                value={valor}
                onChange={(e) => cambiar(e.target.value)}
                className={INPUT}
            />
        </div>
    );

    return (
        <form onSubmit={guardar} noValidate className={`${CARD} space-y-4 p-5`}>
            <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Cambiar contraseña
            </h2>
            <div className="flex flex-wrap gap-4">
                {campo("actual", "Contraseña actual", actual, setActual, "current-password")}
                {campo("nueva", "Contraseña nueva", nueva, setNueva, "new-password")}
                {campo("repetida", "Repetir contraseña nueva", repetida, setRepetida, "new-password")}
            </div>
            {error && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                    {error}
                </p>
            )}
            <div className="flex flex-wrap gap-2.5">
                <button type="submit" disabled={guardando} className={BTN_P}>
                    {guardando ? "Guardando…" : "Guardar contraseña"}
                </button>
                <button type="button" onClick={cerrar} disabled={guardando} className={BTN_G}>
                    Cancelar
                </button>
            </div>
        </form>
    );
}
