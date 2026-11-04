"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import { edadDe, fechaCorta } from "@/app/lib/format";
import { cargarSesion, cursoLargo, type Papel, type Sesion } from "@/app/lib/sesion";
import type { Curso, DatosPersonales } from "@/app/lib/types";
import { Avatar, CARD, Cargando, Chip, ErrorPanel, LABEL } from "@/app/components/ui";

const ETIQUETA_PAPEL: Record<Papel, string> = {
    alumno: "Alumno",
    docente: "Docente",
    preceptor: "Preceptor",
    directivo: "Directivo",
    otro: "Usuario",
};

// La API serializa el sexo como número (0, 1) o como texto, según el endpoint.
function sexoTexto(sexo: unknown) {
    const s = String(sexo ?? "").toLowerCase();
    if (s === "0" || s === "femenino") return "Femenino";
    if (s === "1" || s === "masculino") return "Masculino";
    return "—";
}

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

            {!datos && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Todavía no hay datos personales cargados para tu usuario. Cuando la administración
                    los complete van a aparecer acá.
                </p>
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
                                ? `${fechaCorta(datos.fechaNacimiento)}${edad !== null ? ` (${edad} años)` : ""}`
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
        </div>
    );
}
