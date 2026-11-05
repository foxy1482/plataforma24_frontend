"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import * as api from "@/app/lib/apiClient";
import { ApiError, mensajeDeError, registrarError } from "@/app/lib/apiClient";
import { normalizar } from "@/app/lib/format";
import { nombreCurso, ROLES_ALUMNO, turnoDe } from "@/app/lib/sesion";
import type { Curso, Usuario } from "@/app/lib/types";
import Modal from "@/app/components/modal";
import { BTN_G, BTN_P, Cargando, ErrorPanel } from "@/app/components/ui";

// Tope que acepta el backend por pedido.
const MAXIMO = 200;

// "maria.lopez" -> "Maria Lopez": el nombre de usuario es lo que se puede mostrar sin pedir datos personales
// de cada alumno (un pedido por persona).
function nombreVisible(u: Usuario) {
    const alias = (u.nombreUsuario ?? u.nombre ?? u.email).replace(/[._]+/g, " ").trim();
    return alias.replace(/(^|\s)(\S)/g, (_, esp: string, letra: string) => esp + letra.toUpperCase());
}

export default function AsignarAlumnosModal({
    curso,
    recienCreado = false,
    onCerrar,
    onAsignado,
}: {
    curso: Curso;
    recienCreado?: boolean;
    onCerrar: () => void;
    onAsignado: (cantidad: number) => void;
}) {
    const id = useId();
    const [lista, setLista] = useState<Usuario[] | null>(null);
    const [errorCarga, setErrorCarga] = useState(false);
    const [texto, setTexto] = useState("");
    const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
    const [enviando, setEnviando] = useState(false);
    const [errorServidor, setErrorServidor] = useState<string | null>(null);
    const casillaTodos = useRef<HTMLInputElement>(null);

    const cargar = useCallback(() => {
        api.usuarios
            .listar()
            .then((usuarios) => {
                const sinCurso = (usuarios ?? [])
                    .filter((u) => ROLES_ALUMNO.includes(u.idRol) && u.idCurso == null)
                    .sort((a, b) => nombreVisible(a).localeCompare(nombreVisible(b), "es"));
                setLista(sinCurso);
                // Si se actualizó la lista, se descarta lo elegido que ya no está disponible.
                setSeleccion((prev) => new Set([...prev].filter((idSel) => sinCurso.some((u) => u.id === idSel))));
            })
            .catch((e) => {
                registrarError(e);
                setErrorCarga(true);
            });
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const filtrados = useMemo(() => {
        const q = normalizar(texto.trim());
        if (!lista) return [];
        if (!q) return lista;
        return lista.filter((u) => normalizar(`${nombreVisible(u)} ${u.email} ${u.numeroLegajo}`).includes(q));
    }, [lista, texto]);

    const marcados = filtrados.filter((u) => seleccion.has(u.id)).length;
    const todosMarcados = filtrados.length > 0 && marcados === filtrados.length;

    useEffect(() => {
        if (casillaTodos.current) casillaTodos.current.indeterminate = marcados > 0 && !todosMarcados;
    }, [marcados, todosMarcados]);

    const alternar = (idUsuario: number) =>
        setSeleccion((prev) => {
            const sig = new Set(prev);
            if (sig.has(idUsuario)) sig.delete(idUsuario);
            else if (sig.size < MAXIMO) sig.add(idUsuario);
            return sig;
        });

    const alternarTodos = () =>
        setSeleccion((prev) => {
            const sig = new Set(prev);
            if (todosMarcados) {
                filtrados.forEach((u) => sig.delete(u.id));
            } else {
                for (const u of filtrados) {
                    if (sig.size >= MAXIMO) break;
                    sig.add(u.id);
                }
            }
            return sig;
        });

    const agregar = async () => {
        if (enviando || seleccion.size === 0) return;
        setErrorServidor(null);
        setEnviando(true);
        try {
            const respuesta = await api.cursos.asignarUsuarios(curso.id, [...seleccion]);
            onAsignado(respuesta?.asignados ?? seleccion.size);
        } catch (e) {
            registrarError(e);
            if (e instanceof ApiError && e.status === 403) {
                setErrorServidor("Tu usuario no tiene permiso para asignar alumnos a un curso.");
            } else if (e instanceof ApiError && e.status === 404) {
                setErrorServidor("El curso ya no existe. Cerrá esta ventana y actualizá la lista de cursos.");
            } else {
                setErrorServidor(
                    mensajeDeError(e, "No se pudieron agregar los alumnos. Revisá la conexión e intentá de nuevo.")
                );
            }
            setEnviando(false);
        }
    };

    const nombre = nombreCurso(curso);
    const turno = turnoDe(curso);
    const cantidad = seleccion.size;

    return (
        <Modal
            titulo={`Agregar alumnos a ${nombre}`}
            descripcion={
                recienCreado
                    ? `Curso creado (${turno ? `turno ${turno}, ` : ""}ciclo ${curso.cicloLectivo}). Sumá ahora a los alumnos que todavía no tienen curso, o hacelo después desde la tarjeta del curso.`
                    : `${turno ? `Turno ${turno} · ` : ""}Ciclo ${curso.cicloLectivo}. Elegí los alumnos que todavía no tienen curso asignado.`
            }
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-neutral-600 dark:text-neutral-300" aria-live="polite">
                        {cantidad === 0
                            ? "Ningún alumno seleccionado"
                            : `${cantidad} ${cantidad === 1 ? "seleccionado" : "seleccionados"}`}
                        {cantidad >= MAXIMO && ` (máximo ${MAXIMO} por vez)`}
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                        <button type="button" onClick={onCerrar} disabled={enviando} className={BTN_G}>
                            {recienCreado ? "Omitir por ahora" : "Cancelar"}
                        </button>
                        <button
                            type="button"
                            onClick={agregar}
                            disabled={enviando || cantidad === 0}
                            className={BTN_P}
                        >
                            {enviando
                                ? "Agregando…"
                                : cantidad === 0
                                  ? "Agregar alumnos"
                                  : `Agregar ${cantidad} ${cantidad === 1 ? "alumno" : "alumnos"} a ${nombre}`}
                        </button>
                    </div>
                </div>
            }
        >
            {errorCarga ? (
                <ErrorPanel
                    mensaje="No pudimos cargar la lista de alumnos."
                    onReintentar={() => {
                        setErrorCarga(false);
                        cargar();
                    }}
                />
            ) : !lista ? (
                <div className="space-y-3">
                    <Cargando className="h-11" />
                    <Cargando className="h-48" />
                </div>
            ) : lista.length === 0 ? (
                <p className="rounded-xl bg-neutral-50 p-6 text-center text-sm text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">
                    No hay alumnos sin curso. Los alumnos nuevos aparecen acá apenas se registran.
                </p>
            ) : (
                <div className="space-y-3">
                    <label className="flex h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 dark:border-neutral-600 dark:bg-neutral-900">
                        <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-neutral-400" />
                        <span className="sr-only">Buscar alumno</span>
                        <input
                            type="search"
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            placeholder="Buscar por nombre, correo o legajo…"
                            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
                        />
                    </label>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                            htmlFor={`${id}-todos`}
                            className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-neutral-800 dark:text-neutral-100"
                        >
                            <input
                                ref={casillaTodos}
                                id={`${id}-todos`}
                                type="checkbox"
                                checked={todosMarcados}
                                onChange={alternarTodos}
                                disabled={filtrados.length === 0 || enviando}
                                className="h-5 w-5 accent-primary"
                            />
                            {texto.trim() ? `Seleccionar los ${filtrados.length} filtrados` : `Seleccionar todos (${filtrados.length})`}
                        </label>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {lista.length} {lista.length === 1 ? "alumno sin curso" : "alumnos sin curso"}
                        </p>
                    </div>

                    {filtrados.length === 0 ? (
                        <p className="rounded-xl bg-neutral-50 p-6 text-center text-sm text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">
                            Ningún alumno coincide con la búsqueda.
                        </p>
                    ) : (
                        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
                            {filtrados.map((u) => {
                                const elegido = seleccion.has(u.id);
                                return (
                                    <li key={u.id}>
                                        <label
                                            className={`flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 transition-colors ${
                                                elegido
                                                    ? "bg-primary/10 dark:bg-primary/20"
                                                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={elegido}
                                                onChange={() => alternar(u.id)}
                                                disabled={enviando}
                                                className="h-5 w-5 shrink-0 accent-primary"
                                            />
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                    {nombreVisible(u)}
                                                </span>
                                                <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
                                                    {u.numeroLegajo} · {u.email}
                                                </span>
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            {errorServidor && (
                <div
                    role="alert"
                    className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                >
                    <p>{errorServidor}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setErrorServidor(null);
                            cargar();
                        }}
                        className="mt-1 font-semibold underline"
                    >
                        Actualizar la lista de alumnos
                    </button>
                </div>
            )}
        </Modal>
    );
}
