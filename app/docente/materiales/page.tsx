import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/app/components/ui";
import MaterialesView from "./materiales-view";

export const metadata: Metadata = { title: "Materiales | Panel docente" };

export default function MaterialesPage() {
    return (
        <Suspense fallback={<Cargando className="h-96" />}>
            <MaterialesView />
        </Suspense>
    );
}
