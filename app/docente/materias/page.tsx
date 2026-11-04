import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/app/components/ui";
import AulaView from "./aula-view";

export const metadata: Metadata = { title: "Mis materias | Panel docente" };

export default function DocenteMateriasPage() {
    return (
        <Suspense fallback={<Cargando className="h-96" />}>
            <AulaView />
        </Suspense>
    );
}
