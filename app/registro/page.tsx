"use client";

import { motion } from "framer-motion";
import {
    EnvelopeIcon,
    LockClosedIcon,
    EyeIcon,
    EyeSlashIcon,
    UserIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, mensajeDeError } from "../lib/apiClient";
import { rutaDeSesion } from "../lib/sesion";
import { useRedirigirSiHaySesion } from "../lib/usar-sesion-activa";

const INPUT =
    "block w-full pl-10 pr-3 py-3 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600";
const LABEL = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors";
const ICONO = "h-5 w-5 text-gray-400 dark:text-gray-500";

export default function RegistroPage() {
    const [nombre, setNombre] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [repetida, setRepetida] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const isChecking = useRedirigirSiHaySesion();

    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (nombre.trim().length < 3) return setError("El nombre debe tener al menos 3 caracteres.");
        if (password.length < 5) return setError("La contraseña debe tener al menos 5 caracteres.");
        if (password !== repetida) return setError("Las contraseñas no coinciden.");

        setLoading(true);
        try {
            await auth.registro({ email, nombre: nombre.trim(), password });
        } catch (err) {
            setError(mensajeDeError(err, "No se pudo crear la cuenta. Intentá de nuevo en unos minutos."));
            setLoading(false);
            return;
        }

        try {
            const respuesta = await auth.login({ email, password });
            const token = respuesta.token || respuesta.access_token;
            if (!token) throw new Error("sin token");
            auth.setToken(token);
            router.push(await rutaDeSesion());
        } catch {
            router.push("/login");
        }
    };

    if (isChecking) {
        return null;
    }

    return (
        <main className="flex-1 flex items-center justify-center bg-gray-50/50 dark:bg-gray-950 px-4 py-12 transition-colors duration-300">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md bg-gray-100 dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 transition-colors duration-300"
            >
                <h1 className="sr-only">Crear cuenta</h1>
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

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="nombre" className={LABEL}>Nombre de usuario</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserIcon className={ICONO} />
                            </div>
                            <input
                                id="nombre" name="username" autoComplete="username" type="text"
                                required
                                minLength={3}
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className={INPUT}
                                placeholder="nombre.apellido"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" className={LABEL}>Correo Electrónico</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <EnvelopeIcon className={ICONO} />
                            </div>
                            <input
                                id="email" name="email" autoComplete="email" type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={INPUT}
                                placeholder="estudiante@ejemplo.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className={LABEL}>Contraseña</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LockClosedIcon className={ICONO} />
                            </div>
                            <input
                                id="password" name="password" autoComplete="new-password" type={showPassword ? "text" : "password"}
                                required
                                minLength={5}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`${INPUT} pr-10`}
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none"
                            >
                                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="repetida" className={LABEL}>Repetir contraseña</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LockClosedIcon className={ICONO} />
                            </div>
                            <input
                                id="repetida" name="repetida" autoComplete="new-password" type={showPassword ? "text" : "password"}
                                required
                                value={repetida}
                                onChange={(e) => setRepetida(e.target.value)}
                                className={INPUT}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-lg font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? "Creando cuenta..." : "Registrarme"}
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-gray-600 dark:text-gray-400">
                    Te registrás como alumno. Después las autoridades te asignan a tu curso.
                </p>

                <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 transition-colors">
                    ¿Ya tenés una cuenta?{" "}
                    <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
                        Iniciá sesión
                    </Link>
                </div>
            </motion.div>
        </main>
    );
}
