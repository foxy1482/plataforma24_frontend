"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCookie } from "cookies-next";
import { auth } from "./apiClient";
import { rutaDeSesion } from "./sesion";

// Si ya hay una sesión válida redirige al panel del rol; si el token venció lo descarta.
// Devuelve true mientras se verifica, para no mostrar el formulario por un instante.
export function useRedirigirSiHaySesion() {
    const router = useRouter();
    const [verificando, setVerificando] = useState(true);

    useEffect(() => {
        let vigente = true;
        const destino = getCookie("token") ? rutaDeSesion() : Promise.resolve("/login");

        destino
            .then((ruta) => {
                if (!vigente) return;
                if (ruta === "/login") {
                    auth.logout();
                    setVerificando(false);
                } else {
                    router.replace(ruta);
                }
            })
            .catch(() => {
                if (vigente) setVerificando(false);
            });

        return () => {
            vigente = false;
        };
    }, [router]);

    return verificando;
}
