"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { AcademicCapIcon } from "@heroicons/react/24/solid";
import ThemeToggle from "@/app/components/themetoggle";

const RUTAS_PANEL = [
    "/dashboard",
    "/materias",
    "/material",
    "/tareas",
    "/calificaciones",
    "/cursos",
    "/foro",
    "/avisos",
    "/docente",
    "/preceptoria",
    "/admin",
];

export default function Navbar() {
    const pathname = usePathname();

    const enPanel = RUTAS_PANEL.some((r) => pathname === r || pathname?.startsWith(`${r}/`));
    if (enPanel) {
        return null;
    }
    return (
        <motion.nav 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="sticky top-0 z-50 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors duration-300"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center gap-2 group">
                        <AcademicCapIcon className="h-8 w-8 text-primary transition-transform group-hover:scale-105" />
                        <span className="font-bold text-xl text-gray-900 dark:text-gray-100 tracking-tight transition-colors">
                            ET N°<span className="text-primary">24</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-4 sm:gap-6">
                        <Link 
                            href="/" 
                            className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors text-sm font-medium"
                        >
                            Inicio
                        </Link>
                        <Link 
                            href="/login"
                            className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors text-sm font-medium"
                        >
                            Ingresar
                        </Link>
            
                        <ThemeToggle />
                    </div>
                </div>
            </div>
        </motion.nav>
    );
}