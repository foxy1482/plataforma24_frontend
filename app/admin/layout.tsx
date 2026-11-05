"use client";

import {
    BookOpenIcon,
    HomeIcon,
    IdentificationIcon,
    Squares2X2Icon,
    UsersIcon,
} from "@heroicons/react/24/outline";
import PanelLayout from "@/app/components/panel-layout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const grupos = [
        {
            titulo: "Administración",
            links: [
                { name: "Usuarios", href: "/admin/usuarios", icon: UsersIcon },
                { name: "Materias", href: "/admin/materias", icon: BookOpenIcon },
            ],
        },
        {
            titulo: "Escuela",
            links: [
                { name: "Ir a preceptoría", href: "/preceptoria", icon: HomeIcon },
                { name: "Legajos", href: "/preceptoria/legajos", icon: IdentificationIcon },
                { name: "Cursos", href: "/preceptoria/cursos", icon: Squares2X2Icon },
            ],
        },
    ];

    return (
        <PanelLayout
            titulo="Administración"
            acento="violeta"
            papeles={[]} // sin papeles: solo entran los administradores (ver puedeEntrar)
            subtitulo="Autoridad"
            perfilHref="/admin/perfil"
            grupos={grupos}
            buscar={{ placeholder: "Buscar usuario…" }}
        >
            {children}
        </PanelLayout>
    );
}
