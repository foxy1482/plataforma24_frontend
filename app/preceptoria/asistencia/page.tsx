import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/app/components/ui";
import HistorialView from "./historial-view";

export const metadata: Metadata = { title: "Historial de asistencia | Preceptoría" };

export default function HistorialPage() {
    return (
        <Suspense fallback={<Cargando className="h-96" />}>
            <HistorialView />
        </Suspense>
    );
}
