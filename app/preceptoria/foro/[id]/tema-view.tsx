"use client";

import TemaForo from "@/app/components/foro/tema-foro";

export default function TemaPreceptoriaView() {
    return <TemaForo config={{ base: "/preceptoria/foro", personal: true }} />;
}