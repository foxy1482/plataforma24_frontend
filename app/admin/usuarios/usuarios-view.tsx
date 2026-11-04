"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { notificar } from "@/app/components/avisos";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { normalizar } from "@/app/lib/format";
import { cursoLargo, inicialesDeNombre, ordenarCursos } from "@/app/lib/sesion";
import type { Curso, Rol, Usuario } from "@/app/lib/types";
import { Avatar, BTN_G, BTN_R, CARD, Cargando, ErrorPanel, Select, Vacio } from "@/app/components/ui";

interface Datos {
    yo: number;
    usuarios: Usuario[];
    roles: Rol[];
    cursos: Curso[];
}

export default function UsuariosView() {
    const [datos, setDatos] = useState<Datos | null>(null);
    const [error, setError] = useState(false);
    const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);
    const [texto, setTexto] = useState("");
    const [filtroRol, setFiltroRol] = useState("");
    const [filtroCurso, setFiltroCurso] = useState("");

    const cargar = useCallback(() => {
        Promise.all([api.auth.getProfile(), api.usuarios.listar(), api.roles.listar(), api.cursos.listar()])
            .then(([yo, usuarios, roles, cursos]) =>
                setDatos({
                    yo: yo.id,
                    usuarios: usuarios ?? [],
                    roles: roles ?? [],
                    cursos: ordenarCursos(cursos ?? []),
                })
            )
            .catch(() => setError(true));
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const lista = useMemo(() => {
        if (!datos) return [];
        const q = normalizar(texto);
        return datos.usuarios
            .filter((u) => !filtroRol || String(u.idRol) === filtroRol)
            .filter((u) =>
                filtroCurso === "sin" ? u.idCurso == null : !filtroCurso || String(u.idCurso) === filtroCurso
            )
            .filter(
                (u) =>
                    !q ||
                    normalizar(`${u.nombreUsuario ?? u.nombre ?? ""} ${u.email} ${u.numeroLegajo}`).includes(q)
            );
    }, [datos, texto, filtroRol, filtroCurso]);

    const actualizar = (id: number, cambios: Partial<Usuario>) =>
        setDatos((d) => d && { ...d, usuarios: d.usuarios.map((u) => (u.id === id ? { ...u, ...cambios } : u)) });

    const guardar = async (u: Usuario, cambios: { idRol?: number; idCurso?: number }) => {
        setAviso(null);
        const anterior = { idRol: u.idRol, idCurso: u.idCurso };
        actualizar(u.id, cambios);
        try {
            await api.usuarios.modificar(u.id, cambios);
            setAviso({ texto: "Cambios guardados.", ok: true });
        } catch (e) {
            registrarError(e);
            actualizar(u.id, anterior);
            notificar(
                e instanceof ApiError && e.status === 403
                    ? "Tu usuario no tiene permiso para modificar esta cuenta."
                    : mensajeDeError(e, "No se pudo guardar el cambio.")
            );
        }
    };

    const cambiarRol = (u: Usuario, idRol: number) => {
        if (idRol >= 3 && idRol <= 7) {
            const nombreRol = datos?.roles.find((r) => r.id === idRol)?.nombre ?? `rol ${idRol}`;
            const nombre = u.nombreUsuario ?? u.nombre ?? u.email;
            const ok = window.confirm(
                `Vas a asignar el rol "${nombreRol}" a ${nombre}. Este rol permite ver y modificar datos de otras personas. ¿Confirmás el cambio?`
            );
            if (!ok) return;
        }
        guardar(u, { idRol });
    };

    const eliminar = async (u: Usuario) => {
        const nombre = u.nombreUsuario ?? u.nombre ?? u.email;
        if (!window.confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
        setAviso(null);
        try {
            await api.usuarios.eliminar(u.id);
            setDatos((d) => d && { ...d, usuarios: d.usuarios.filter((x) => x.id !== u.id) });
            setAviso({ texto: `${nombre} fue eliminado.`, ok: true });
        } catch (e) {
            registrarError(e);
            notificar(mensajeDeError(e, "No se pudo eliminar el usuario."));
        }
    };

    if (error) {
        return (
            <ErrorPanel
                mensaje="No pudimos cargar los usuarios."
                onReintentar={() => {
                    setError(false);
                    cargar();
                }}
            />
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header>
                <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Usuarios
                </h1>
                <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                    Asigná el rol y el curso de cada persona registrada.
                </p>
            </header>

            {!datos ? (
                <Cargando className="h-96" />
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex h-10 min-w-0 flex-1 basis-60 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 dark:border-neutral-600 dark:bg-neutral-900">
                            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-neutral-400" />
                            <span className="sr-only">Buscar usuario</span>
                            <input
                                type="search"
                                value={texto}
                                onChange={(e) => setTexto(e.target.value)}
                                placeholder="Buscar por nombre, correo o legajo…"
                                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
                            />
                        </label>
                        <Select label="Filtrar por rol" valor={filtroRol} onChange={setFiltroRol}>
                            <option value="">Todos los roles</option>
                            {datos.roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.nombre}
                                </option>
                            ))}
                        </Select>
                        <Select label="Filtrar por curso" valor={filtroCurso} onChange={setFiltroCurso}>
                            <option value="">Todos los cursos</option>
                            <option value="sin">Sin curso</option>
                            {datos.cursos.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {cursoLargo(c)}
                                </option>
                            ))}
                        </Select>
                    </div>

                    {aviso && (
                        <p
                            role="status"
                            className={`rounded-xl border p-3 text-sm ${
                                aviso.ok
                                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                        >
                            {aviso.texto}
                        </p>
                    )}

                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {lista.length} de {datos.usuarios.length} usuarios
                    </p>

                    {lista.length === 0 ? (
                        <Vacio>No hay usuarios que coincidan con la búsqueda.</Vacio>
                    ) : (
                        <ul className={`${CARD} divide-y divide-neutral-200 dark:divide-neutral-700`}>
                            {lista.map((u) => {
                                const nombre = u.nombreUsuario ?? u.nombre ?? u.email;
                                const esYo = u.id === datos.yo;
                                return (
                                    <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                                        <Avatar iniciales={inicialesDeNombre(nombre.replace(/[._]+/g, " "))} id={u.id} />
                                        <div className="min-w-0 flex-1 basis-48">
                                            <Link
                                                href={`/admin/usuarios/${u.id}`}
                                                className="block truncate text-sm font-semibold text-neutral-900 hover:text-primary hover:underline dark:text-neutral-100"
                                            >
                                                {nombre}
                                                {esYo && " (vos)"}
                                            </Link>
                                            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                                                {u.email} · {u.numeroLegajo}
                                            </p>
                                        </div>
                                        <Select
                                            label={`Rol de ${nombre}`}
                                            valor={u.idRol}
                                            onChange={(v) => cambiarRol(u, Number(v))}
                                        >
                                            {datos.roles.map((r) => (
                                                <option key={r.id} value={r.id} disabled={esYo}>
                                                    {r.nombre}
                                                </option>
                                            ))}
                                        </Select>
                                        <Select
                                            label={`Curso de ${nombre}`}
                                            valor={u.idCurso ?? ""}
                                            onChange={(v) => guardar(u, { idCurso: Number(v) })}
                                        >
                                            <option value="" disabled>
                                                Sin curso
                                            </option>
                                            {datos.cursos.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {cursoLargo(c)}
                                                </option>
                                            ))}
                                        </Select>
                                        <Link
                                            href={`/admin/usuarios/${u.id}`}
                                            aria-label={`Editar cuenta y datos de ${nombre}`}
                                            className={`${BTN_G} h-10 px-3`}
                                        >
                                            <PencilSquareIcon className="h-5 w-5" />
                                            <span className="hidden sm:inline">Editar</span>
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => eliminar(u)}
                                            disabled={esYo}
                                            aria-label={`Eliminar a ${nombre}`}
                                            className={`${BTN_R} h-10 w-10 px-0`}
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
