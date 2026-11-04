"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRedirigirSiHaySesion } from "./lib/usar-sesion-activa";

export default function Home() {
    const isChecking = useRedirigirSiHaySesion();

    const images = [
        "/img/escuela1.jpeg",
        "/img/escuela2.jpg",
        "/img/escuela3.jpg",
    ];

    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [images.length]);

    if (isChecking) {
        return null; // Evita mostrar la vista de inicio mientras valida la sesión
    }

    return (
        <div className="relative flex-1 flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-b from-white to-gray-50 px-4 transition-colors duration-300 dark:from-gray-950 dark:to-gray-900">
            {/* Carrusel de fondo con 3 imágenes con efecto borroso */}
            <div className="absolute inset-0 z-0">
                {images.map((src, index) => (
                    <motion.div
                        key={src}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: index === currentImageIndex ? 1 : 0 }}
                        transition={{ duration: 1 }}
                        className="absolute inset-0"
                    >
                        <Image
                            src={src}
                            alt={`Fondo ${index + 1}`}
                            fill
                            priority={index === 0}
                            className="object-cover blur-xs scale-105"
                        />
                    </motion.div>
                ))}
                <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <span className="inline-block py-1 px-3 rounded-full bg-blue-50/80 text-primary text-sm font-semibold mb-6 border border-blue-100 transition-colors dark:bg-primary/20 dark:border-primary/30 dark:text-blue-300">
                        Plataforma de la escuela
                    </span>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 drop-shadow-md">
                        Escuela Técnica N°24 <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-400">
                            Defensa de Buenos Aires
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-200 mb-10 max-w-2xl mx-auto leading-relaxed drop-shadow">
                        Una experiencia escolar moderna, fluida y diseñada para potenciar el rendimiento de estudiantes y profesores.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/login">
                            <button className="w-full sm:w-auto bg-primary text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                                Iniciar Sesión
                            </button>
                        </Link>
                        <Link href="/registro">
                            <button className="w-full sm:w-auto bg-white/20 backdrop-blur-md text-white border border-white/30 px-8 py-4 rounded-full text-lg font-semibold hover:bg-white/30 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                                Registrarse
                            </button>
                        </Link>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}