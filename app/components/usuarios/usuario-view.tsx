"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TrashIcon } from "@heroicons/react/24/outline";
import { notificar } from "@/app/components/avisos";
import DatosPersonalesForm from "@/app/components/datos-personales-form";
import {
    Avatar,
    BTN_G,
    BTN_P,
    BTN_R,
    CARD,
    Cargando,
    Chip,
    ErrorPanel,
    INPUT,
    LABEL,
} from "@/app/components/ui";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { fechaNacimientoTexto, sexoTexto } from "@/app/lib/datos-personales";
import { edadDe } from "@/app/lib/format";
import { AVISO_LEGAJO_NO_RENOVADO, prefijoDeLegajo, prefijoNuevoDeLegajo } from "@/app/lib/legajo";
import { cursoLargo, cursosDelCicloActual, etiquetaCurso, inicialesDeNombre } from "@/app/lib/sesion";
import { cargarUsuario, type DetalleUsuario } from "./cargar-usuario";

// Roles de autoridad (3 a 6) y preceptor (7): dan acceso a datos de otras personas.
const esRolAdministrativo = (idRol: number) => idRol >= 3 && idRol <= 7;

export default function UsuarioView({ base }: { base: string }) {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const idUsuario = Number(id);
    const prefijo = useId();

    // Los datos quedan atados al usuario que se pidió, así no se mezclan al navegar.
    const [cargado, setCargado] = useState<{ id: number; valor: DetalleUsuario } | null>(null);
    const detalle = cargado?.id === idUsuario ? cargado.valor : null;
    const [error, setError] = useState(false);

    const [rol, setRol] = useState("");
    const [curso, setCurso] = useState("");
    const [email, setEmail] = useState("");
    const [nombreUsuario, setNombreUsuario] = useState("");
    const [guardando, setGuardando] = useState(false);
    const [errorCuenta, setErrorCuenta] = useState<string | null>(null);
    const [okCuenta, setOkCuenta] = useState(false);
    const [editandoDatos, setEditandoDatos] = useState(false);
    const [eliminando, setEliminando] = useState(false);

    const aplicar = useCallback((valor: DetalleUsuario) => {
        setCargado({ id: valor.usuario.id, valor });
        setRol(String(valor.usuario.idRol));
        setCurso(valor.usuario.idCurso == null ? "" : String(valor.usuario.idCurso));
        setEmail(valor.usuario.email);
        setNombreUsuario(valor.usuario.nombreUsuario ?? valor.usuario.nombre ?? "");
    }, []);

    const cargar = useCallback(() => {
        cargarUsuario(idUsuario)
            .then(aplicar)
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [idUsuario, aplicar, router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    if (error) {
        return (
            <ErrorPanel
                mensaje="No encontramos ese usuario."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }
    if (!detalle) {
        return (
            <div className="mx-auto max-w-4xl space-y-4">
                <Cargando className="h-28" />
                <Cargando className="h-80" />
            </div>
        );
    }

    const { usuario, datos, roles, cursos, yo } = detalle;
    const esYo = usuario.id === yo;
    const alias = usuario.nombreUsuario ?? usuario.nombre ?? usuario.email;
    const nombre = datos ? `${datos.nombre} ${datos.apellido}` : alias.replace(/[._]+/g, " ");
    const nombreRol = (idRol: number) => roles.find((r) => r.id === idRol)?.nombre ?? `Rol ${idRol}`;
    const cursoActual = cursos.find((c) => c.id === usuario.idCurso) ?? null;
    // Solo el ciclo vigente, más el curso que ya tiene (y el elegido) para que el valor seleccionado exista.
    const opcionesCurso = cursosDelCicloActual(cursos, [usuario.idCurso, Number(curso) || null]);

    const cambios: { idRol?: number; idCurso?: number; email?: string; nombreUsuario?: string } = {};
    if (!esYo && Number(rol) !== usuario.idRol) cambios.idRol = Number(rol);
    if (curso !== "" && Number(curso) !== usuario.idCurso) cambios.idCurso = Number(curso);
    if (email.trim() !== usuario.email) cambios.email = email.trim();
    if (nombreUsuario.trim() !== (usuario.nombreUsuario ?? usuario.nombre ?? "")) {
        cambios.nombreUsuario = nombreUsuario.trim();
    }
    const hayCambios = Object.keys(cambios).length > 0;
    // Prefijo del legajo que quedará si se guarda el rol elegido (null: el legajo no cambia).
    const prefijoNuevo =
        cambios.idRol === undefined ? null : prefijoNuevoDeLegajo(usuario.numeroLegajo, roles, cambios.idRol);

    const guardarCuenta = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorCuenta(null);
        setOkCuenta(false);
        if (!hayCambios) return;
        if (!email.trim() || !nombreUsuario.trim()) {
            setErrorCuenta("El correo y el nombre de usuario no pueden quedar vacíos.");
            return;
        }
        if (cambios.idRol !== undefined) {
            const avisos: string[] = [`Vas a asignar el rol "${nombreRol(cambios.idRol)}" a ${nombre}.`];
            if (esRolAdministrativo(cambios.idRol)) {
                avisos.push("Este rol permite ver y modificar datos de otras personas.");
            }
            if (prefijoNuevo) {
                avisos.push(
                    `Su legajo cambiará de ${usuario.numeroLegajo} a uno nuevo con prefijo ${prefijoNuevo}; el número anterior no se reutiliza.`
                );
            }
            if (avisos.length > 1 || esRolAdministrativo(cambios.idRol)) {
                if (!window.confirm(`${avisos.join(" ")} ¿Confirmás el cambio?`)) return;
            }
        }
        setGuardando(true);
        try {
            await api.usuarios.modificar(usuario.id, cambios);
            // Se vuelve a leer el usuario: el legajo lo renueva la base al cambiar el rol.
            const actualizado = await api.usuarios.porLegajo(usuario.id);
            aplicar({ ...detalle, usuario: actualizado });
            if (cambios.idRol !== undefined && prefijoNuevo && prefijoDeLegajo(actualizado.numeroLegajo) !== prefijoNuevo) {
                setErrorCuenta(AVISO_LEGAJO_NO_RENOVADO);
            } else {
                setOkCuenta(true);
            }
        } catch (err) {
            registrarError(err);
            setErrorCuenta(
                err instanceof ApiError && err.status === 403
                    ? "Tu usuario no tiene permiso para modificar esta cuenta."
                    : mensajeDeError(err, "No se pudo guardar la cuenta. Revisá la conexión e intentá de nuevo.")
            );
        } finally {
            setGuardando(false);
        }
    };

    const eliminarUsuario = async () => {
        if (!window.confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
        setEliminando(true);
        try {
            await api.usuarios.eliminar(usuario.id);
            router.replace(base);
        } catch (err) {
            registrarError(err);
            notificar(mensajeDeError(err, "No se pudo eliminar el usuario."));
            setEliminando(false);
        }
    };

    const edad = edadDe(datos?.fechaNacimiento);

    return (
        <div className="mx-auto max-w-4xl space-y-5">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href={base} className="hover:underline">
                    Usuarios
                </Link>{" "}
                / {nombre}
            </nav>

            <div className={`${CARD} flex flex-wrap items-center gap-5 p-5`}>
                <Avatar id={usuario.id} iniciales={inicialesDeNombre(nombre)} size="h-16 w-16 text-xl" />
                <div className="min-w-0 flex-[1_1_16rem]">
                    <h1 className="font-libertinus text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                        {nombre}
                        {esYo && " (vos)"}
                    </h1>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {[usuario.numeroLegajo && `Legajo ${usuario.numeroLegajo}`, usuario.email]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                        <Chip tono="violeta">{nombreRol(usuario.idRol)}</Chip>
                        <Chip tono="gris">{cursoActual ? cursoLargo(cursoActual) : "Sin curso"}</Chip>
                        {!datos && <Chip tono="ambar">Sin datos personales</Chip>}
                    </div>
                </div>
                <Link href={`/preceptoria/legajos/${usuario.id}`} className={BTN_G}>
                    Ver legajo
                </Link>
            </div>

            <section className={`${CARD} p-5`} aria-labelledby={`${prefijo}-cuenta`}>
                <h2
                    id={`${prefijo}-cuenta`}
                    className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100"
                >
                    Cuenta
                </h2>
                <form onSubmit={guardarCuenta} className="mt-4 space-y-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor={`${prefijo}-rol`} className={LABEL}>
                                Rol
                            </label>
                            <select
                                id={`${prefijo}-rol`}
                                value={rol}
                                disabled={esYo}
                                aria-describedby={esYo ? `${prefijo}-rol-ayuda` : undefined}
                                onChange={(e) => setRol(e.target.value)}
                                className={`${INPUT} mt-1`}
                            >
                                {roles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.nombre}
                                    </option>
                                ))}
                            </select>
                            {prefijoNuevo && (
                                <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                    Al guardar, el legajo pasará del prefijo {prefijoDeLegajo(usuario.numeroLegajo)} a{" "}
                                    {prefijoNuevo} (se le asigna un número nuevo).
                                </p>
                            )}
                            {esYo && (
                                <p id={`${prefijo}-rol-ayuda`} className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                    No podés cambiar tu propio rol: te quedarías sin acceso. Pedíselo a otra autoridad.
                                </p>
                            )}
                        </div>
                        <div>
                            <label htmlFor={`${prefijo}-curso`} className={LABEL}>
                                Curso
                            </label>
                            <select
                                id={`${prefijo}-curso`}
                                value={curso}
                                onChange={(e) => setCurso(e.target.value)}
                                className={`${INPUT} mt-1`}
                            >
                                {usuario.idCurso == null && (
                                    <option value="">Sin curso</option>
                                )}
                                {opcionesCurso.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {etiquetaCurso(c, opcionesCurso)}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Un curso asignado se puede cambiar, pero no quitar.
                            </p>
                        </div>
                        <div>
                            <label htmlFor={`${prefijo}-email`} className={LABEL}>
                                Correo electrónico
                            </label>
                            <input
                                id={`${prefijo}-email`}
                                type="email"
                                autoComplete="off"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`${INPUT} mt-1`}
                            />
                        </div>
                        <div>
                            <label htmlFor={`${prefijo}-usuario`} className={LABEL}>
                                Nombre de usuario
                            </label>
                            <input
                                id={`${prefijo}-usuario`}
                                type="text"
                                autoComplete="off"
                                value={nombreUsuario}
                                onChange={(e) => setNombreUsuario(e.target.value)}
                                className={`${INPUT} mt-1`}
                            />
                        </div>
                    </div>

                    <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                        El legajo ({usuario.numeroLegajo}) acompaña al rol: si el rol nuevo tiene otro prefijo
                        (ALU, PRO, PRE, AUT, ADM), el sistema le asigna un legajo nuevo. Alumno y Admin alumno, o
                        Profesor y Admin profesor, comparten prefijo y conservan el suyo.
                    </p>

                    {errorCuenta && (
                        <p
                            role="alert"
                            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                        >
                            {errorCuenta}
                        </p>
                    )}
                    {okCuenta && !hayCambios && (
                        <p
                            role="status"
                            className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
                        >
                            Cambios guardados.
                        </p>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <button type="submit" disabled={guardando || !hayCambios} className={BTN_P}>
                            {guardando ? "Guardando…" : "Guardar cambios"}
                        </button>
                    </div>
                </form>
            </section>

            <section className={`${CARD} p-5`} aria-labelledby={`${prefijo}-datos`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2
                        id={`${prefijo}-datos`}
                        className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100"
                    >
                        Datos personales
                    </h2>
                    {!editandoDatos && (
                        <button type="button" onClick={() => setEditandoDatos(true)} className={BTN_G}>
                            {datos ? "Editar datos" : "Cargar datos personales"}
                        </button>
                    )}
                </div>

                {editandoDatos ? (
                    <div className="mt-4">
                        <DatosPersonalesForm
                            idUsuario={usuario.id}
                            datos={datos}
                            puedeEliminar
                            onCancelar={() => setEditandoDatos(false)}
                            onGuardado={(guardados) => {
                                setEditandoDatos(false);
                                aplicar({ ...detalle, datos: guardados });
                            }}
                        />
                    </div>
                ) : datos ? (
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        {[
                            ["Apellido y nombre", `${datos.apellido}, ${datos.nombre}`],
                            ["DNI", String(datos.dni)],
                            [
                                "Fecha de nacimiento",
                                `${fechaNacimientoTexto(datos.fechaNacimiento)}${edad !== null ? ` (${edad} años)` : ""}`,
                            ],
                            ["Sexo", sexoTexto(datos.sexo)],
                            ["Celular", datos.telefonoCelular ? String(datos.telefonoCelular) : "—"],
                            ["Domicilio", datos.direccion || "—"],
                        ].map(([clave, valor]) => (
                            <div key={clave}>
                                <dt className={LABEL}>{clave}</dt>
                                <dd className="text-neutral-900 dark:text-neutral-100">{valor}</dd>
                            </div>
                        ))}
                    </dl>
                ) : (
                    <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                        Todavía no hay datos personales cargados para este usuario.
                    </p>
                )}
            </section>

            <section
                className={`${CARD} border-red-200 p-5 dark:border-red-900/60`}
                aria-labelledby={`${prefijo}-peligro`}
            >
                <h2
                    id={`${prefijo}-peligro`}
                    className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100"
                >
                    Eliminar usuario
                </h2>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    {esYo
                        ? "No podés eliminar tu propia cuenta."
                        : "Se borra la cuenta junto con sus datos. Si tiene entregas, mensajes u otros registros asociados, el sistema no lo va a permitir."}
                </p>
                <button
                    type="button"
                    onClick={eliminarUsuario}
                    disabled={esYo || eliminando}
                    className={`${BTN_R} mt-3`}
                >
                    <TrashIcon className="h-5 w-5" />
                    {eliminando ? "Eliminando…" : "Eliminar usuario"}
                </button>
            </section>
        </div>
    );
}
