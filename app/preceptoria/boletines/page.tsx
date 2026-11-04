import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/app/components/ui";
import BoletinesView from "./boletines-view";

export const metadata: Metadata = { title: "Boletines del curso | Preceptoría" };

export default function BoletinesPage() {
    return (
        <Suspense fallback={<Cargando className="h-96" />}>
            <BoletinesView />
        </Suspense>
    );
}
