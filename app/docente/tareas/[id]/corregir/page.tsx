import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/app/components/ui";
import CorregirView from "./corregir-view";

export const metadata: Metadata = { title: "Corregir entrega | Panel docente" };

export default function CorregirPage() {
    return (
        <Suspense fallback={<Cargando className="h-96" />}>
            <CorregirView />
        </Suspense>
    );
}
