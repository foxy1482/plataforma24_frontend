import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/app/components/ui";
import PlanillaView from "./planilla-view";

export const metadata: Metadata = { title: "Planilla de notas | Panel docente" };

export default function PlanillaPage() {
    return (
        <Suspense fallback={<Cargando className="h-96" />}>
            <PlanillaView />
        </Suspense>
    );
}
