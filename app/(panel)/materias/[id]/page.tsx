"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    BookOpenIcon,
    ClipboardDocumentListIcon,
    ClockIcon,
    DocumentArrowDownIcon,
    MapPinIcon,
    UserIcon,
} from "@heroicons/react/24/outline";
import { auth, materias, tareas, materiales, materialArchivos, registrarError } from "@/app/lib/apiClient";
import { ArchivoChip } from "@/app/components/visor-archivos";
import ContactoDocente from "@/app/components/contacto-docente";
import { CARD, Cargando, Chip, ErrorPanel, ROW, Vacio } from "@/app/components/ui";
import { fechaCorta, notaNumerica } from "@/app/lib/format";
import type { Archivo, Entrega, Materia, Material, Tarea } from "@/app/lib/types";
import { seguro } from "@/app/lib/api-utils";
import { buscarDocente, type Docente } from "../cargar-materias";
import { etiquetaVencimiento, formatoLimite, parseFecha, tonoDe, type TareaItem } from "../../tareas/tarea-utils";

function Dato({ icono: Icono, children }: { icono: typeof ClockIcon; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <Icono className="h-4 w-4 shrink-0" />
            {children}
        </span>
    );
}

export default function MateriaDetailPage() {
    const params = useParams();
    const materiaId = Number(params.id);

    const [materia, setMateria] = useState<Materia | null>(null);
    const [docente, setDocente] = useState<Docente | null>(null);
    const [listaTareas, setListaTareas] = useState<Tarea[]>([]);
    const [misEntregas, setMisEntregas] = useState<Entrega[]>([]);
    const [listaMateriales, setListaMateriales] = useState<Material[]>([]);
    const [adjuntos, setAdjuntos] = useState<Record<number, Archivo[]>>({});
    const [alumno, setAlumno] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!materiaId) return;
        let activo = true;

        (async () => {
            try {
                setLoading(true);
                setError(false);
                const perfil = await auth.getProfile();
                const [materiaData, tareasData, materialesData, entregasData] = await Promise.all([
                    materias.porNumero(materiaId),
                    tareas.porMateria(materiaId),
                    materiales.porMateria(materiaId),
                    seguro("entregas", materias.entregasDeAlumno(materiaId, perfil.id)),
                ]);

                // Docente y adjuntos son secundarios: si fallan, la página se ve igual sin ellos.
                // El material programado para más adelante (publicadaDesde en el futuro) no se muestra todavía.
                const lista = (materialesData ?? [])
                    .filter((m) => {
                        const f = parseFecha(m.publicadaDesde);
                        return !f || f.getTime() <= Date.now();
                    })
                    .sort(
                        (a, b) =>
                            (parseFecha(b.publicadaDesde)?.getTime() ?? 0) -
                            (parseFecha(a.publicadaDesde)?.getTime() ?? 0)
                    );
                const [docenteData, archivosDe] = await Promise.all([
                    buscarDocente(materiaData.idProfesor).catch(() => null),
                    Promise.all(
                        lista.map((m) => materialArchivos.porMaterial(m.id).then((l) => l ?? [], () => []))
                    ),
                ]);

                if (!activo) return;
                setMateria(materiaData);
                setAlumno((perfil.nombre ?? perfil.nombreUsuario ?? "").replace(/[._]+/g, " ").trim());
                setDocente(docenteData);
                setListaTareas(tareasData ?? []);
                setMisEntregas(entregasData ?? []);
                setListaMateriales(lista);
                setAdjuntos(Object.fromEntries(lista.map((m, i) => [m.id, archivosDe[i]])));
            } catch (err) {
                registrarError("Error al cargar los datos de la materia:", err);
                if (activo) setError(true);
            } finally {
                if (activo) setLoading(false);
            }
        })();

        return () => {
            activo = false;
        };
    }, [materiaId]);

    const hoy = useMemo(() => new Date(), []);

    const items = useMemo(
        () =>
            listaTareas
                .map((t): TareaItem => {
                    const entrega = misEntregas.find((e) => e.idTarea === t.id);
                    return {
                        id: t.id,
                        idMateria: t.idMateria,
                        titulo: t.titulo,
                        tituloCorto: t.titulo,
                        materia: materia?.nombre ?? "",
                        fecha: parseFecha(t.fechaEntrega),
                        entrega: entrega
                            ? { fecha: parseFecha(entrega.fechaEntrega), calificacion: entrega.calificacion ?? null }
                            : null,
                    };
                })
                .sort((a, b) => {
                    if (Boolean(a.entrega) !== Boolean(b.entrega)) return a.entrega ? 1 : -1;
                    return (a.fecha?.getTime() ?? Infinity) - (b.fecha?.getTime() ?? Infinity);
                }),
        [listaTareas, misEntregas, materia]
    );

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl space-y-6">
                <Cargando className="h-28" />
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Cargando className="h-80" />
                    <Cargando className="h-80" />
                </div>
            </div>
        );
    }

    if (error || !materia) {
        return (
            <div className="mx-auto max-w-5xl">
                <ErrorPanel mensaje="No se pudo cargar la información de la materia." />
            </div>
        );
    }

    const pendientes = items.filter((t) => !t.entrega).length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-5xl space-y-6"
        >
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href="/materias" className="hover:underline">
                    Materias
                </Link>
                {" / "}
                <span aria-current="page" className="text-neutral-700 dark:text-neutral-300">
                    {materia.nombre}
                </span>
            </nav>

            <header className="flex items-start gap-4">
                <div className="rounded-2xl bg-primary/10 p-3.5 text-primary">
                    <BookOpenIcon className="h-8 w-8" />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="font-libertinus text-4xl font-bold leading-tight tracking-tight text-neutral-900 dark:text-neutral-100">
                        {materia.nombre}
                    </h1>
                    <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {docente && <Dato icono={UserIcon}>{docente.nombre}</Dato>}
                        <Dato icono={MapPinIcon}>{materia.aula || "Aula sin asignar"}</Dato>
                        <Dato icono={ClockIcon}>{materia.horario || "Horario a confirmar"}</Dato>
                    </p>
                    {docente && (
                        <div className="mt-3">
                            <ContactoDocente
                                email={docente.email}
                                docente={docente.nombre}
                                materia={materia.nombre}
                                alumno={alumno}
                            />
                        </div>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
                <section className={`${CARD} p-5 sm:p-6`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2.5 font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                            <ClipboardDocumentListIcon className="h-6 w-6 text-primary" />
                            Tareas
                        </h2>
                        {items.length > 0 && (
                            <Chip tono={pendientes > 0 ? "azul" : "verde"}>
                                {pendientes > 0
                                    ? `${pendientes} pendiente${pendientes === 1 ? "" : "s"}`
                                    : "Al día"}
                            </Chip>
                        )}
                    </div>
                    {items.length === 0 ? (
                        <Vacio>No hay tareas asignadas.</Vacio>
                    ) : (
                        <div className="space-y-2.5">
                            {items.map((tarea) => {
                                const nota = notaNumerica(tarea.entrega?.calificacion);
                                return (
                                    <Link
                                        key={tarea.id}
                                        href={`/tareas/${tarea.id}`}
                                        className={`${ROW} flex items-center justify-between gap-3 p-3.5 transition-colors hover:border-primary/60`}
                                    >
                                        <div className="min-w-0">
                                            <h3 className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
                                                {tarea.titulo}
                                            </h3>
                                            <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                                                {formatoLimite(tarea.fecha)}
                                            </p>
                                        </div>
                                        {tarea.entrega ? (
                                            <Chip tono="verde">
                                                {nota !== null ? `Nota ${nota}` : "Entregada"}
                                            </Chip>
                                        ) : (
                                            <Chip tono={tonoDe(tarea, hoy)}>{etiquetaVencimiento(tarea, hoy)}</Chip>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className={`${CARD} p-5 sm:p-6`}>
                    <h2 className="mb-4 flex items-center gap-2.5 font-libertinus text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        <DocumentArrowDownIcon className="h-6 w-6 text-primary" />
                        Material de estudio
                    </h2>
                    {listaMateriales.length === 0 ? (
                        <Vacio>No hay materiales subidos.</Vacio>
                    ) : (
                        <div className="space-y-2.5">
                            {listaMateriales.map((material) => (
                                <div key={material.id} className={`${ROW} p-3.5`}>
                                    <div className="flex flex-wrap items-start justify-between gap-x-3">
                                        <h3 className="min-w-0 font-semibold text-neutral-900 dark:text-neutral-100">
                                            <Link
                                                href={`/material/${material.id}`}
                                                className="text-primary hover:underline"
                                            >
                                                {material.titulo || "Sin título"}
                                            </Link>
                                        </h3>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {fechaCorta(parseFecha(material.publicadaDesde))}
                                        </span>
                                    </div>
                                    {material.descripcion && (
                                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                                            {material.descripcion}
                                        </p>
                                    )}
                                    {(adjuntos[material.id] ?? []).length > 0 && (
                                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                                            {adjuntos[material.id].map((archivo) => (
                                                <ArchivoChip key={archivo.id} archivo={archivo} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </motion.div>
    );
}
