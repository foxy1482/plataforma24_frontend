"use client";

import ListaForo from "@/app/components/foro/lista-foro";

// El docente ve los debates de todos los cursos y puede moderarlos (el backend lo trata como personal).
export default function ForoDocenteView() {
    return <ListaForo config={{ base: "/docente/foro", personal: true }} />;
}