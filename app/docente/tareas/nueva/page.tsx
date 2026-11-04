import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/app/components/ui";
import NuevaTareaView from "./nueva-tarea-view";

export const metadata: Metadata = { title: "Nueva tarea | Panel docente" };

export default function NuevaTareaPage() {
    return (
        <Suspense fallback={<Cargando className="h-96" />}>
            <NuevaTareaView />
        </Suspense>
    );
}
