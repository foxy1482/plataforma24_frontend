"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { fechaNacimientoTexto, sexoTexto } from "@/app/lib/datos-personales";
import { edadDe } from "@/app/lib/format";
import { cargarSesion, cursoLargo, type Papel, type Sesion } from "@/app/lib/sesion";
import type { Curso, DatosPersonales } from "@/app/lib/types";
import CambiarPassword from "@/app/components/cambiar-password";
import DatosPersonalesForm from "@/app/components/datos-personales-form";
import { Avatar, BTN_G, BTN_P, CARD, Cargando, Chip, ErrorPanel, LABEL } from "@/app/components/ui";

const ETIQUETA_PAPEL: Record<Papel, string> = {
    alumno: "Alumno",
    docente: "Docente",
    preceptor: "Preceptor",
    directivo: "Directivo",
    otro: "Usuario",
};

interface Perfil {
    sesion: Sesion;
    datos: DatosPersonales | null;
    curso: Curso | null;
}

async function cargarPerfil(): Promise<Perfil> {
    const sesion = await cargarSesion();
    const [datos, curso] = await Promise.all([
        api.datos.porLegajo(sesion.usuario.id).then(
            (d) => d,
            (e) => {
                // 404: todavía no tiene datos personales cargados. Otros fallos se muestran como error.
                if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
                throw e;
            }
        ),
        sesion.usuario.idCurso == null
            ? null
            : api.cursos.porNumero(sesion.usuario.idCurso).catch(() => null),
    ]);
    return { sesion, datos, curso };
}

function Campos({ titulo, campos }: { titulo: string; campos: [string, string][] }) {
    return (
        <section className={`${CARD} min-w-0 flex-[1_1_20rem] p-5`}>
            <h2 className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {titulo}
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
                {campos.map(([clave, valor]) => (
                    <div key={clave}>
                        <dt className={LABEL}>{clave}</dt>
                        <dd className="break-words text-neutral-900 dark:text-neutral-100">
                            {valor || "—"}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

export default function PerfilView() {
    const router = useRouter();
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [error, setError] = useState(false);
    const [editando, setEditando] = useState(false);

    const cargar = useCallback(() => {
        cargarPerfil()
            .then(setPerfil)
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar tu perfil."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }
    if (!perfil) {
        return (
            <div className="space-y-4">
                <Cargando className="h-32" />
                <Cargando className="h-72" />
            </div>
        );
    }

    const { sesion, datos, curso } = perfil;
    const { usuario } = sesion;
    const edad = edadDe(datos?.fechaNacimiento);
    // Solo preceptores y autoridades pueden eliminar datos personales (lo exige el backend).
    const puedeEliminar = sesion.papel === "preceptor" || sesion.papel === "directivo";

    return (
        <div className="mx-auto max-w-4xl space-y-5">
            <header>
                <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Mi perfil
                </h1>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Tus datos personales y los de tu cuenta.
                </p>
            </header>

            <div className={`${CARD} flex flex-wrap items-center gap-5 p-5`}>
                <Avatar id={usuario.id} iniciales={sesion.iniciales} size="h-20 w-20 text-2xl" />
                <div className="min-w-0 flex-[1_1_16rem]">
                    <h2 className="font-libertinus text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                        {sesion.nombre}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {[usuario.numeroLegajo && `Legajo ${usuario.numeroLegajo}`, usuario.email]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                        <Chip tono="teal">{sesion.rol ?? ETIQUETA_PAPEL[sesion.papel]}</Chip>
                        {curso && <Chip tono="gris">{cursoLargo(curso)}</Chip>}
                    </div>
                </div>
            </div>

            {editando ? (
                <DatosPersonalesForm
                    idUsuario={usuario.id}
                    datos={datos}
                    puedeEliminar={puedeEliminar}
                    titulo={datos ? "Editar mis datos" : "Completar mis datos"}
                    onCancelar={() => setEditando(false)}
                    onGuardado={() => {
                        setEditando(false);
                        cargar();
                    }}
                />
            ) : (
                <div className="flex flex-wrap items-center gap-3">
                    {!datos && (
                        <p className="flex-[1_1_20rem] text-sm text-neutral-500 dark:text-neutral-400">
                            Todavía no cargaste tus datos personales. Completalos para que figuren en tu perfil
                            y en los listados de la escuela.
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => setEditando(true)}
                        className={datos ? BTN_G : BTN_P}
                    >
                        {datos ? "Editar mis datos" : "Completar mis datos"}
                    </button>
                </div>
            )}

            <div className="flex flex-wrap items-start gap-5">
                <Campos
                    titulo="Datos personales"
                    campos={[
                        ["Apellido y nombre", datos ? `${datos.apellido}, ${datos.nombre}` : ""],
                        ["DNI", datos?.dni ? String(datos.dni) : ""],
                        [
                            "Fecha de nacimiento",
                            datos?.fechaNacimiento
                                ? `${fechaNacimientoTexto(datos.fechaNacimiento)}${edad !== null ? ` (${edad} años)` : ""}`
                                : "",
                        ],
                        ["Sexo", datos ? sexoTexto(datos.sexo) : ""],
                        ["Celular", datos?.telefonoCelular ? String(datos.telefonoCelular) : ""],
                        ["Domicilio", datos?.direccion ?? ""],
                    ]}
                />
                <Campos
                    titulo="Cuenta"
                    campos={[
                        ["Usuario", usuario.nombreUsuario ?? usuario.nombre ?? ""],
                        ["Correo", usuario.email],
                        ["Legajo", usuario.numeroLegajo],
                        ["Rol", sesion.rol ?? ETIQUETA_PAPEL[sesion.papel]],
                        ["Curso", curso ? cursoLargo(curso) : ""],
                        ["Aula", curso?.aula ?? ""],
                    ]}
                />
            </div>

            <CambiarPassword />
        </div>
    );
}
