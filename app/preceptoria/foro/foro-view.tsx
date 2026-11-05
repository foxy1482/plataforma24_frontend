"use client";

import ListaForo from "@/app/components/foro/lista-foro";

// Preceptoría y autoridades: todos los debates, más acceso a la pantalla de reportes.
export default function ForoPreceptoriaView() {
    return (
        <ListaForo
            config={{ base: "/preceptoria/foro", personal: true, moderacionHref: "/preceptoria/moderacion" }}
        />
    );
}