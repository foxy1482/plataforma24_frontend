"use client";

import { useEffect, useState } from "react";
import {
    BookOpenIcon,
    ClipboardDocumentCheckIcon,
    DocumentPlusIcon,
    FolderIcon,
    HomeIcon,
    PlusCircleIcon,
    TableCellsIcon,
} from "@heroicons/react/24/outline";
import PanelLayout from "@/app/components/panel-layout";
import { LABEL, ROW } from "@/app/components/ui";
import { datosDocente } from "./datos";

export default function DocenteLayout({ children }: { children: React.ReactNode }) {
    const [resumen, setResumen] = useState<{
        sinCorregir: number;
        materias: number;
        alumnos: number;
    } | null>(null);

    useEffect(() => {
        datosDocente()
            .then((d) =>
                setResumen({
                    sinCorregir: d.sinCorregir,
                    materias: d.materias.length,
                    alumnos: new Set(d.materias.flatMap((m) => m.alumnos.map((a) => a.idUsuario))).size,
                })
            )
            .catch(() => undefined);
    }, []);

    const grupos = [
        {
            titulo: "General",
            links: [
                { name: "Inicio", href: "/docente", icon: HomeIcon },
                { name: "Mis materias", href: "/docente/materias", icon: BookOpenIcon },
                { name: "Nueva materia", href: "/docente/materias/nueva", icon: PlusCircleIcon },
            ],
        },
        {
            titulo: "Enseñanza",
            links: [
                { name: "Nueva tarea", href: "/docente/tareas/nueva", icon: DocumentPlusIcon },
                {
                    name: "Por corregir",
                    href: "/docente/tareas",
                    icon: ClipboardDocumentCheckIcon,
                    badge: resumen?.sinCorregir,
                },
                { name: "Planilla de notas", href: "/docente/notas", icon: TableCellsIcon },
                { name: "Materiales", href: "/docente/materiales", icon: FolderIcon },
            ],
        },
    ];

    return (
        <PanelLayout
            titulo="Panel docente"
            acento="azul"
            papeles={["docente"]}
            subtitulo="Docente"
            verComoAlumno
            perfilHref="/docente/perfil"
            grupos={grupos}
            buscar={{ placeholder: "Buscar alumno, tarea o curso…" }}
            extra={
                <div className={`${ROW} mt-6 p-3.5`}>
                    <p className={LABEL}>Mis cursos</p>
                    {resumen ? (
                        <>
                            <p className="mt-1.5 text-sm text-neutral-700 dark:text-neutral-200">
                                {resumen.materias} {resumen.materias === 1 ? "materia" : "materias"} ·{" "}
                                {resumen.alumnos} alumnos
                            </p>
                            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                                {resumen.sinCorregir === 0
                                    ? "No tenés entregas sin corregir"
                                    : `${resumen.sinCorregir} ${resumen.sinCorregir === 1 ? "entrega" : "entregas"} sin corregir`}
                            </p>
                        </>
                    ) : (
                        <div className="mt-2 h-3.5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                    )}
                </div>
            }
        >
            {children}
        </PanelLayout>
    );
}
