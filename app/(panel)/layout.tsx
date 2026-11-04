"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { 
    AcademicCapIcon, 
    UserCircleIcon, 
    ArrowRightOnRectangleIcon,
    BookOpenIcon,
    ClipboardDocumentCheckIcon,
    ChartBarIcon,
    UsersIcon,
    ChatBubbleLeftRightIcon
} from "@heroicons/react/24/outline";
import ThemeToggle from "@/app/components/themetoggle";
import { ErrorPanel } from "@/app/components/ui";
import { esAdminRol, papelDe, puedeEntrar, rutaDePapel } from "@/app/lib/sesion";
import { ApiError, auth } from "@/app/lib/apiClient";

// "Inicio" solo se marca en /dashboard exacto; el resto también en sus subrutas
// (ej: /materias/3 mantiene "Materias" activo).
function estaActivo(pathname: string, href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [sesionOk, setSesionOk] = useState(false);
    const [falloSesion, setFalloSesion] = useState(false);

    // Este es el panel del alumno: cada rol se queda en el suyo (docente en /docente, preceptor y
    // autoridad en /preceptoria) y solo los administradores pueden entrar a todos. Sin token válido
    // no se monta nada: antes cada página lo revisaba por su cuenta.
    useEffect(() => {
        auth.getProfile()
            .then((usuario) => {
                const sesion = { papel: papelDe(usuario.idRol, usuario.rol ?? undefined), esAdmin: esAdminRol(usuario.idRol) };
                if (puedeEntrar(sesion, ["alumno"])) setSesionOk(true);
                else router.replace(rutaDePapel(sesion.papel));
            })
            .catch((e) => {
                if (e instanceof ApiError && e.status !== 401) setFalloSesion(true);
                else router.replace("/login");
            });
    }, [router]);

    const salir = () => {
        auth.logout();
        router.replace("/login");
    };

    const links = [
        { name: "Inicio", href: "/dashboard", icon: AcademicCapIcon },
        { name: "Materias", href: "/materias", icon: BookOpenIcon },
        { name: "Tareas", href: "/tareas", icon: ClipboardDocumentCheckIcon },
        { name: "Calificaciones", href: "/calificaciones", icon: ChartBarIcon },
        { name: "Cursos", href: "/cursos", icon: UsersIcon },
        { name: "Foro", href: "/foro", icon: ChatBubbleLeftRightIcon },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
            <nav className="sticky top-0 z-50 w-full bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-sm transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
            
                        <div className="flex items-center gap-8">
                            <Link href="/" className="flex items-center gap-2 group">
                                <AcademicCapIcon className="h-8 w-8 text-primary transition-transform group-hover:scale-105" />
                                <span className="font-bold text-xl text-neutral-900 dark:text-neutral-100 tracking-tight transition-colors">
                                    ET N°<span className="text-primary">24</span>
                                </span>
                            </Link>

                            <div className="hidden md:flex items-center gap-1">
                                {links.map((link) => {
                                    const isActive = estaActivo(pathname, link.href);
                                    return (
                                        <Link
                                            key={link.name}
                                            href={link.href}
                                            className={`flex font-libertinus items-center gap-2 px-3 py-2 rounded-xl text-md font-medium transition-colors ${
                                                isActive 
                                                    ? "bg-primary/10 text-primary dark:bg-primary/20" 
                                                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100"
                                            }`}
                                        >
                                            <div className="p-1.5 rounded-2xl border-primary/50 border-3">
                                            <link.icon className="h-6 w-6" />
                                            </div>
                                            {link.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
            
                        <div className="flex items-center gap-3 sm:gap-4">
                            <ThemeToggle />
                            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700"></div>
                            <Link href="/dashboard/perfil" aria-label="Mi perfil" className="text-neutral-500 hover:text-primary dark:text-neutral-400 dark:hover:text-primary transition-colors">
                                <UserCircleIcon className="h-7 w-7" />
                            </Link>
                            <button
                                type="button"
                                onClick={salir}
                                aria-label="Cerrar sesión"
                                className="text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-500 transition-colors"
                            >
                                <ArrowRightOnRectangleIcon className="h-7 w-7" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                {sesionOk ? (
                    children
                ) : falloSesion ? (
                    <ErrorPanel
                        mensaje="No pudimos verificar tu sesión. Revisá tu conexión e intentá de nuevo."
                        onReintentar={() => window.location.reload()}
                    />
                ) : (
                    <div className="h-96 animate-pulse rounded-2xl bg-neutral-200/60 dark:bg-neutral-800/60" />
                )}
            </main>

            <footer className="hidden md:block bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-6 text-center transition-colors duration-300 mt-auto">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    &copy; Escuela Técnica N°24 &quot;Defensa de Buenos Aires&quot;.
                </p>
            </footer>

            {/* Navegación inferior para celulares: el menú horizontal solo existe desde md */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
                <div className="grid grid-cols-6">
                    {links.map((link) => {
                        const isActive = estaActivo(pathname, link.href);
                        return (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                                    isActive ? "text-primary" : "text-neutral-500 dark:text-neutral-400"
                                }`}
                            >
                                <link.icon className="h-5 w-5" />
                                <span className="max-w-full truncate px-0.5">{link.name}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}