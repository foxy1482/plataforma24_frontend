"use client";

import ListaForo from "@/app/components/foro/lista-foro";

// Foro del alumno: ve los debates generales y los de su curso (el backend filtra el resto).
export default function ForoView() {
    return <ListaForo config={{ base: "/foro", personal: false }} />;
}