"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    AcademicCapIcon,
    ArrowRightOnRectangleIcon,
    MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import ThemeToggle from "@/app/components/themetoggle";
import { Avatar, ErrorPanel, LABEL } from "@/app/components/ui";
import * as api from "@/app/lib/apiClient";
import { cargarSesion, puedeEntrar, rutaDePapel, type Papel, type Sesion } from "@/app/lib/sesion";

export interface PanelLink {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
}

export interface PanelGrupo {
    titulo: string;
    links: PanelLink[];
    papeles?: Papel[];
}

const ACENTOS = {
    violeta: "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-500/15 dark:text-violet-300",
    azul: "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-500/15 dark:text-blue-300",
    teal: "border-teal-300 bg-teal-100 text-teal-800 dark:border-teal-900 dark:bg-teal-500/15 dark:text-teal-300",
};

export default function PanelLayout({
    titulo,
    acento,
    papeles,
    grupos,
    buscar,
    subtitulo,
    extra,
    verComoAlumno,
    perfilHref,
    children,
}: {
    titulo: string;
    acento: keyof typeof ACENTOS;
    papeles: Papel[];
    grupos: PanelGrupo[];
    buscar: { placeholder: string; onBuscar?: (texto: string) => void };
    subtitulo?: string;
    extra?: React.ReactNode;
    verComoAlumno?: boolean;
    perfilHref: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [sesion, setSesion] = useState<Sesion | null>(null);
    const [falloSesion, setFalloSesion] = useState(false);
    const [texto, setTexto] = useState("");

    useEffect(() => {
        cargarSesion()
            .then((s) => {
                if (puedeEntrar(s, papeles)) setSesion(s);
                else router.replace(rutaDePapel(s.papel));
            })
            .catch((e) => {
                // Un 401 ya descarta el token y vuelve al login (apiClient); acá se cubre
                // el caso sin token. Otros fallos (red, 5xx) no son motivo para cerrar la sesión.
                if (e instanceof api.ApiError && e.status !== 401) setFalloSesion(true);
                else router.replace("/login");
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const salir = () => {
        api.auth.logout();
        router.replace("/login");
    };

    const activo = (href: string) => {
        const base = grupos[0]?.links[0]?.href;
        if (href === base) return pathname === href;
        return pathname === href || pathname.startsWith(`${href}/`);
    };

    return (
        <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
            <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
                    <Link href={grupos[0]?.links[0]?.href ?? "/"} className="flex items-center gap-2">
                        <AcademicCapIcon className="h-7 w-7 text-primary" />
                        <span className="font-libertinus text-xl font-bold text-neutral-900 dark:text-neutral-100">
                            ET N°<span className="text-primary">24</span>
                        </span>
                    </Link>
                    <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${ACENTOS[acento]}`}
                    >
                        {titulo}
                    </span>

                    {/* Solo se muestra si el panel sabe qué hacer con el texto: un buscador que
                        no filtra nada confunde más que ayuda. */}
                    {buscar.onBuscar && (
                        <label className="flex h-10 min-w-0 flex-1 basis-60 items-center gap-2 rounded-xl border border-neutral-300 bg-neutral-50 px-3 sm:max-w-md dark:border-neutral-700 dark:bg-neutral-950">
                            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-neutral-400" />
                            <span className="sr-only">{buscar.placeholder}</span>
                            <input
                                type="search"
                                value={texto}
                                placeholder={buscar.placeholder}
                                onChange={(e) => {
                                    setTexto(e.target.value);
                                    buscar.onBuscar?.(e.target.value);
                                }}
                                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
                            />
                        </label>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                        {verComoAlumno && sesion?.esAdmin && (
                            <Link
                                href="/dashboard"
                                className="hidden h-9 items-center rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-600 hover:border-neutral-400 sm:inline-flex dark:border-neutral-600 dark:text-neutral-300"
                            >
                                Ver como alumno
                            </Link>
                        )}
                        <ThemeToggle />
                        <span aria-hidden="true" className="h-6 w-px bg-neutral-200 dark:bg-neutral-700" />
                        <Link
                            href={perfilHref}
                            aria-label="Mi perfil"
                            className="flex items-center gap-2 rounded-xl p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                            <Avatar iniciales={sesion?.iniciales ?? "·"} id={sesion?.usuario.id ?? 0} />
                            <span className="hidden leading-tight sm:block">
                                <span className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                    {sesion?.nombre ?? "…"}
                                </span>
                                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400">
                                    {sesion?.rol ?? subtitulo ?? ""}
                                </span>
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={salir}
                            aria-label="Cerrar sesión"
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 hover:text-red-500 dark:text-neutral-400"
                        >
                            <ArrowRightOnRectangleIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 flex-wrap items-stretch">
                <aside
                    aria-label={`Menú de ${titulo}`}
                    className="w-full border-neutral-200 bg-white px-3 pb-5 pt-2 lg:w-60 lg:border-r dark:border-neutral-800 dark:bg-neutral-900"
                >
                    <nav>
                        {grupos
                            .filter((g) => !g.papeles || (sesion && g.papeles.includes(sesion.papel)))
                            .map((grupo) => (
                            <div key={grupo.titulo}>
                                <p className={`${LABEL} px-3 pb-1.5 pt-4`}>{grupo.titulo}</p>
                                {grupo.links.map((link) => (
                                    <Link
                                        key={link.href + link.name}
                                        href={link.href}
                                        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                                            activo(link.href)
                                                ? "bg-primary/10 font-medium text-primary dark:bg-primary/20"
                                                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                        }`}
                                    >
                                        <link.icon className="h-5 w-5 shrink-0" />
                                        <span className="truncate">{link.name}</span>
                                        {link.badge !== undefined && link.badge > 0 && (
                                            <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
                                                {link.badge}
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </nav>
                    {extra}
                </aside>

                <main className="min-w-0 flex-1 basis-[36rem] px-4 py-7 sm:px-8">
                    {/* El contenido no se monta hasta confirmar sesión y rol: así no dispara
                        llamadas a la API ni muestra datos de un panel que el usuario no puede ver. */}
                    {sesion ? (
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
            </div>

            <footer className="border-t border-neutral-200 bg-white py-5 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                <p className="font-libertinus">
                    &copy; Escuela Técnica N°24 &quot;Defensa de Buenos Aires&quot;.
                </p>
            </footer>
        </div>
    );
}
