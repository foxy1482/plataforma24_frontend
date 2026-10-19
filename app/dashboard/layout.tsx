"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
    AcademicCapIcon, 
    UserCircleIcon, 
    ArrowRightOnRectangleIcon,
    BookOpenIcon,
    ClipboardDocumentCheckIcon,
    ChartBarIcon,
    BellIcon
} from "@heroicons/react/24/outline";
import ThemeToggle from "@/app/components/themetoggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const links = [
        { name: "Inicio", href: "/dashboard", icon: AcademicCapIcon },
        { name: "Materias", href: "/materias", icon: BookOpenIcon },
        { name: "Tareas", href: "/tareas", icon: ClipboardDocumentCheckIcon },
        { name: "Calificaciones", href: "/calificaciones", icon: ChartBarIcon },
        { name: "Avisos", href: "   )/avisos", icon: BellIcon },
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
                                    const isActive = pathname === link.href;
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
                            <Link href="/dashboard/perfil" className="text-neutral-500 hover:text-primary dark:text-neutral-400 dark:hover:text-primary transition-colors">
                                <UserCircleIcon className="h-7 w-7" />
                            </Link>
                            <Link href="/" className="text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-500 transition-colors">
                                <ArrowRightOnRectangleIcon className="h-7 w-7" />
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>

            <footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-6 text-center transition-colors duration-300 mt-auto">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    &copy; Escuela Técnica N°24 "Defensa de Buenos Aires".
                </p>
            </footer>
        </div>
    );
}