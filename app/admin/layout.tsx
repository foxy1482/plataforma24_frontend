"use client";

import { HomeIcon, UsersIcon } from "@heroicons/react/24/outline";
import PanelLayout from "@/app/components/panel-layout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const grupos = [
        {
            titulo: "Administración",
            links: [{ name: "Usuarios", href: "/admin/usuarios", icon: UsersIcon }],
        },
        {
            titulo: "Escuela",
            links: [{ name: "Ir a preceptoría", href: "/preceptoria", icon: HomeIcon }],
        },
    ];

    return (
        <PanelLayout
            titulo="Administración"
            acento="violeta"
            papeles={["directivo"]}
            subtitulo="Autoridad"
            perfilHref="/admin/perfil"
            grupos={grupos}
            buscar={{ placeholder: "Buscar usuario…" }}
        >
            {children}
        </PanelLayout>
    );
}
