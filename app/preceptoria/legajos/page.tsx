import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/app/components/ui";
import LegajosView from "./legajos-view";

export const metadata: Metadata = { title: "Legajos de alumnos | Preceptoría" };

export default function LegajosPage() {
    return (
        <Suspense fallback={<Cargando className="h-96" />}>
            <LegajosView />
        </Suspense>
    );
}
