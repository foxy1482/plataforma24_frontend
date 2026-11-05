"use client";

import TemaForo from "@/app/components/foro/tema-foro";

export default function TemaDocenteView() {
    return <TemaForo config={{ base: "/docente/foro", personal: true }} />;
}