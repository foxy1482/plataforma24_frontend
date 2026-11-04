"use client";

import { useEffect, useState } from "react";
import {
    AcademicCapIcon,
    CalendarDaysIcon,
    ChatBubbleLeftRightIcon,
    ClipboardDocumentListIcon,
    DocumentTextIcon,
    HomeIcon,
    IdentificationIcon,
    UserCircleIcon,
    UsersIcon,
} from "@heroicons/react/24/outline";
import PanelLayout from "@/app/components/panel-layout";
import { LABEL, ROW } from "@/app/components/ui";
import * as api from "@/app/lib/apiClient";
import { nombreCurso, turnoDe } from "@/app/lib/sesion";
import type { Curso } from "@/app/lib/types";
import { datosPreceptoria } from "./datos";

export default function PreceptoriaLayout({ children }: { children: React.ReactNode }) {
    const [cursos, setCursos] = useState<Curso[] | null>(null);
    const [reportes, setReportes] = useState(0);

    useEffect(() => {
        datosPreceptoria()
            .then((d) => setCursos(d.cursos))
            .catch(() => undefined);
        api.foro
            .reportes(true)
            .then((l) => setReportes((l ?? []).filter((r) => !r.resuelto).length))
            .catch(() => undefined);
    }, []);

    const grupos = [
        {
            titulo: "General",
            links: [
                { name: "Inicio", href: "/preceptoria", icon: HomeIcon },
                { name: "Legajos de alumnos", href: "/preceptoria/legajos", icon: IdentificationIcon },
                { name: "Mi perfil", href: "/preceptoria/perfil", icon: UserCircleIcon },
            ],
        },
        {
            titulo: "Asistencia",
            links: [
                { name: "Tomar lista", href: "/preceptoria/lista", icon: ClipboardDocumentListIcon },
                { name: "Historial y planillas", href: "/preceptoria/asistencia", icon: CalendarDaysIcon },
            ],
        },
        {
            titulo: "Boletines",
            links: [
                { name: "Boletines del curso", href: "/preceptoria/boletines", icon: DocumentTextIcon },
            ],
        },
        {
            titulo: "Administración",
            papeles: ["directivo" as const],
            links: [{ name: "Usuarios", href: "/admin/usuarios", icon: UsersIcon }],
        },
        {
            titulo: "Comunidad",
            links: [
                {
                    name: "Moderación del foro",
                    href: "/preceptoria/moderacion",
                    icon: ChatBubbleLeftRightIcon,
                    badge: reportes,
                },
            ],
        },
    ];

    return (
        <PanelLayout
            titulo="Preceptoría"
            acento="teal"
            papeles={["preceptor", "directivo"]}
            subtitulo="Preceptoría"
            perfilHref="/preceptoria/perfil"
            grupos={grupos}
            buscar={{ placeholder: "Buscar alumno por nombre, DNI o legajo…" }}
            extra={
                <div className={`${ROW} mt-6 p-3.5`}>
                    <p className={LABEL}>Mis cursos</p>
                    {cursos === null ? (
                        <div className="mt-2 h-3.5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                    ) : (
                        <ul className="mt-2 space-y-1.5 text-sm">
                            {cursos.slice(0, 6).map((c) => (
                                <li key={c.id} className="flex justify-between gap-2">
                                    <span className="text-neutral-700 dark:text-neutral-200">
                                        {nombreCurso(c)}
                                    </span>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                        {turnoDe(c)}
                                    </span>
                                </li>
                            ))}
                            {cursos.length === 0 && (
                                <li className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                                    <AcademicCapIcon className="h-4 w-4" />
                                    Sin cursos cargados
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            }
        >
            {children}
        </PanelLayout>
    );
}
