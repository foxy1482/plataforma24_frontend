"use client";

import { motion } from "framer-motion";
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from 'next/image';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, auth, registrarError } from "../lib/apiClient";
import { rutaDeSesion } from "../lib/sesion";
import { useRedirigirSiHaySesion } from "../lib/usar-sesion-activa";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const isChecking = useRedirigirSiHaySesion();

    const router = useRouter();

    const handleAuth = async () => {
        setError(null);
        setLoading(true);

        try {
            const loginResponse = await auth.login({ email, password });
            
            const token = loginResponse.token || loginResponse.access_token;

            if (!token) {
                throw new Error("El servidor no devolvió un token válido.");
            }

            auth.setToken(token);

            const ruta = await rutaDeSesion();
            if (ruta === "/login") throw new Error("No se pudo leer el perfil.");
            router.push(ruta);
        } catch (err: unknown) {
            registrarError("Error de autenticación:", err);
            if (err instanceof ApiError && err.status === 401) {
                // El backend distingue "usuario no encontrado" de "contraseña incorrecta":
                // se muestra un único mensaje para no revelar qué correos existen.
                setError("Correo o contraseña incorrectos.");
            } else if (err instanceof ApiError && err.status === 0) {
                setError("No se pudo conectar con el servidor.");
            } else if (err instanceof ApiError && err.status >= 500) {
                setError("El servidor tuvo un problema. Intentá de nuevo en unos minutos.");
            } else if (err instanceof ApiError) {
                setError("No se pudo iniciar sesión. Revisá los datos ingresados.");
            } else {
                setError("No se pudo conectar con el servidor.");
            }
            // Si el token se guardó pero el perfil no pudo leerse, no se deja una sesión a medias
            auth.logout();
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleAuth();
    };

    if (isChecking) {
        return null;
    }

    return (
        <div className="flex-1 flex items-center justify-center bg-gray-50/50 dark:bg-gray-950 px-4 py-12 transition-colors duration-300">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md bg-gray-100 dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 transition-colors duration-300"
            >
                <div className="text-center mb-8 flex justify-center">
                  <Image
                    src="/img/escudo_et24.png"
                    alt="Escudo Escuela Técnica 24"
                    width={100}
                    height={100}
                    className="h-auto w-auto"
                  />
                </div>

                {error && (
                    <div role="alert" className="mb-4 p-3 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-xl text-center border border-red-200 dark:border-red-800">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <EnvelopeIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </div>
                            <input
                                id="email"
                                name="email"
                                autoComplete="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                                placeholder="estudiante@ejemplo.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors">
                            Contraseña
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LockClosedIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                autoComplete="current-password"
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-10 pr-10 py-3 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none"
                            >
                                {showPassword ? (
                                    <EyeSlashIcon className="h-5 w-5" />
                                ) : (
                                    <EyeIcon className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-lg font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 transition-colors">
                    ¿No tienes una cuenta?{" "}
                    <Link href="/registro" className="font-medium text-primary hover:text-primary/80 transition-colors">
                        Regístrate
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}