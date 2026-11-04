"use client";

import { useId, useState } from "react";
import { ExclamationTriangleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { notificar } from "@/app/components/avisos";
import { BTN_G, BTN_P, BTN_R, CARD, INPUT, LABEL } from "@/app/components/ui";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import {
    aPayload,
    FECHA_MINIMA,
    fechaParaInput,
    hoyParaInput,
    OPCIONES_SEXO,
    sexoDe,
    validarDatos,
    type ErroresDatos,
    type ValoresDatos,
} from "@/app/lib/datos-personales";
import type { DatosPersonales, DatosPersonalesPayload } from "@/app/lib/types";

export interface DatosPersonalesFormProps {
    idUsuario: number;
    // null = todavía no tiene datos: el formulario los crea.
    datos: DatosPersonales | null;
    // El backend permite eliminar solo a preceptores y autoridades.
    puedeEliminar: boolean;
    // Se llama con los datos guardados, o con null cuando se eliminaron.
    onGuardado: (datos: DatosPersonales | null) => void;
    onCancelar?: () => void;
    titulo?: string;
}

function valoresIniciales(datos: DatosPersonales | null): ValoresDatos {
    const sexo = sexoDe(datos?.sexo);
    return {
        nombre: datos?.nombre ?? "",
        apellido: datos?.apellido ?? "",
        dni: datos?.dni ? String(datos.dni) : "",
        telefonoCelular: datos?.telefonoCelular ? String(datos.telefonoCelular) : "",
        direccion: datos?.direccion ?? "",
        fechaNacimiento: fechaParaInput(datos?.fechaNacimiento),
        sexo: sexo === null ? "" : String(sexo),
    };
}

const ORDEN_CAMPOS: (keyof ValoresDatos)[] = [
    "nombre",
    "apellido",
    "dni",
    "fechaNacimiento",
    "sexo",
    "telefonoCelular",
    "direccion",
];

// Solo los campos que cambiaron respecto de lo guardado (PATCH parcial).
function cambios(nuevo: DatosPersonalesPayload, datos: DatosPersonales): Partial<DatosPersonalesPayload> {
    const diff: Partial<DatosPersonalesPayload> = {};
    if (nuevo.nombre !== datos.nombre) diff.nombre = nuevo.nombre;
    if (nuevo.apellido !== datos.apellido) diff.apellido = nuevo.apellido;
    if (nuevo.dni !== datos.dni) diff.dni = nuevo.dni;
    if (nuevo.direccion !== datos.direccion) diff.direccion = nuevo.direccion;
    if (nuevo.fechaNacimiento !== fechaParaInput(datos.fechaNacimiento)) {
        diff.fechaNacimiento = nuevo.fechaNacimiento;
    }
    if (nuevo.telefonoCelular !== undefined && nuevo.telefonoCelular !== datos.telefonoCelular) {
        diff.telefonoCelular = nuevo.telefonoCelular;
    }
    if (nuevo.sexo !== undefined && nuevo.sexo !== sexoDe(datos.sexo)) diff.sexo = nuevo.sexo;
    return diff;
}

export default function DatosPersonalesForm({
    idUsuario,
    datos,
    puedeEliminar,
    onGuardado,
    onCancelar,
    titulo,
}: DatosPersonalesFormProps) {
    const prefijo = useId();
    const idCampo = (campo: keyof ValoresDatos) => `${prefijo}-${campo}`;

    const [valores, setValores] = useState<ValoresDatos>(() => valoresIniciales(datos));
    const [errores, setErrores] = useState<ErroresDatos>({});
    const [errorServidor, setErrorServidor] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState<"guardando" | "eliminando" | null>(null);

    const editando = datos !== null;

    const cambiar = (campo: keyof ValoresDatos, valor: string) => {
        setValores((v) => ({ ...v, [campo]: valor }));
        if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorServidor(null);

        const encontrados = validarDatos(valores, datos);
        const primero = ORDEN_CAMPOS.find((c) => encontrados[c]);
        if (primero) {
            setErrores(encontrados);
            document.getElementById(idCampo(primero))?.focus();
            return;
        }
        setErrores({});

        const payload = aPayload(valores);
        setOcupado("guardando");
        try {
            if (datos) {
                const diff = cambios(payload, datos);
                if (Object.keys(diff).length === 0) {
                    setErrorServidor("No hay cambios para guardar.");
                    return;
                }
                await api.datos.modificar(idUsuario, diff);
            } else {
                await api.datos.crear({ idUsuario, ...payload });
            }
            // El PATCH responde 204 y el POST puede omitir campos: se vuelve a leer lo guardado.
            const guardados = await api.datos.porLegajo(idUsuario);
            onGuardado(guardados);
        } catch (err) {
            registrarError(err);
            setErrorServidor(
                err instanceof ApiError && err.status === 403
                    ? "Tu usuario no tiene permiso para modificar estos datos."
                    : mensajeDeError(err, "No se pudieron guardar los datos. Revisá la conexión e intentá de nuevo.")
            );
        } finally {
            setOcupado(null);
        }
    };

    const eliminar = async () => {
        if (
            !window.confirm(
                "¿Eliminar los datos personales? Se pierden el DNI, la fecha de nacimiento, el celular y el domicilio. Esta acción no se puede deshacer."
            )
        ) {
            return;
        }
        setErrorServidor(null);
        setOcupado("eliminando");
        try {
            await api.datos.eliminar(idUsuario);
            onGuardado(null);
        } catch (err) {
            registrarError(err);
            if (err instanceof ApiError && err.status === 403) {
                setErrorServidor("Tu usuario no tiene permiso para eliminar estos datos.");
            } else {
                notificar(mensajeDeError(err, "No se pudieron eliminar los datos personales."));
            }
        } finally {
            setOcupado(null);
        }
    };

    const deshabilitado = ocupado !== null;

    const campo = (
        nombre: keyof ValoresDatos,
        etiqueta: string,
        opciones: React.InputHTMLAttributes<HTMLInputElement> & { ayuda?: string } = {}
    ) => {
        const { ayuda, ...atributos } = opciones;
        const id = idCampo(nombre);
        const error = errores[nombre];
        return (
            <div>
                <label htmlFor={id} className={LABEL}>
                    {etiqueta}
                </label>
                <input
                    id={id}
                    name={nombre}
                    value={valores[nombre]}
                    onChange={(e) => cambiar(nombre, e.target.value)}
                    disabled={deshabilitado}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined}
                    className={`${INPUT} mt-1 ${error ? "border-red-400 dark:border-red-500" : ""}`}
                    {...atributos}
                />
                {error ? (
                    <p id={`${id}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {error}
                    </p>
                ) : (
                    ayuda && (
                        <p id={`${id}-ayuda`} className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {ayuda}
                        </p>
                    )
                )}
            </div>
        );
    };

    return (
        <form onSubmit={guardar} noValidate className={`${CARD} p-5`} aria-busy={deshabilitado}>
            <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {titulo ?? (editando ? "Editar datos personales" : "Cargar datos personales")}
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {editando
                    ? "Modificá solo lo que cambió. Los demás datos se mantienen."
                    : "Todos los campos son obligatorios, salvo el celular y el sexo."}
            </p>

            {errorServidor && (
                <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                >
                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                    {errorServidor}
                </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {campo("nombre", "Nombre", { autoComplete: "off", maxLength: 80, required: true })}
                {campo("apellido", "Apellido", { autoComplete: "off", maxLength: 80, required: true })}
                {campo("dni", "DNI", {
                    inputMode: "numeric",
                    autoComplete: "off",
                    maxLength: 10,
                    required: true,
                    ayuda: "Solo números, sin puntos.",
                })}
                {campo("fechaNacimiento", "Fecha de nacimiento", {
                    type: "date",
                    min: FECHA_MINIMA,
                    max: hoyParaInput(),
                    required: true,
                })}

                <div>
                    <label htmlFor={idCampo("sexo")} className={LABEL}>
                        Sexo
                    </label>
                    <select
                        id={idCampo("sexo")}
                        name="sexo"
                        value={valores.sexo}
                        onChange={(e) => cambiar("sexo", e.target.value)}
                        disabled={deshabilitado}
                        aria-invalid={errores.sexo ? true : undefined}
                        aria-describedby={errores.sexo ? `${idCampo("sexo")}-error` : undefined}
                        className={`${INPUT} mt-1 ${errores.sexo ? "border-red-400 dark:border-red-500" : ""}`}
                    >
                        <option value="">Sin especificar</option>
                        {OPCIONES_SEXO.map((o) => (
                            <option key={o.valor} value={o.valor}>
                                {o.etiqueta}
                            </option>
                        ))}
                    </select>
                    {errores.sexo && (
                        <p id={`${idCampo("sexo")}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {errores.sexo}
                        </p>
                    )}
                </div>

                {campo("telefonoCelular", "Celular (opcional)", {
                    type: "tel",
                    inputMode: "tel",
                    autoComplete: "off",
                    maxLength: 20,
                    ayuda: "Con característica, sin 0 ni 15. Ej: 1155551234",
                })}

                <div className="sm:col-span-2">
                    {campo("direccion", "Domicilio", { autoComplete: "off", maxLength: 200, required: true })}
                </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={deshabilitado} className={BTN_P}>
                    {ocupado === "guardando" ? "Guardando…" : editando ? "Guardar cambios" : "Guardar datos"}
                </button>
                {onCancelar && (
                    <button type="button" onClick={onCancelar} disabled={deshabilitado} className={BTN_G}>
                        Cancelar
                    </button>
                )}
                {editando && puedeEliminar && (
                    <button
                        type="button"
                        onClick={eliminar}
                        disabled={deshabilitado}
                        className={`${BTN_R} sm:ml-auto`}
                    >
                        <TrashIcon className="h-5 w-5" />
                        {ocupado === "eliminando" ? "Eliminando…" : "Eliminar datos"}
                    </button>
                )}
            </div>
        </form>
    );
}
