"use client";

import TemaForo from "@/app/components/foro/tema-foro";

export default function TemaView() {
    return <TemaForo config={{ base: "/foro", personal: false }} />;
}