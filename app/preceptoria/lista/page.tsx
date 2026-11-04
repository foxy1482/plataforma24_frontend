import { Suspense } from "react";
import type { Metadata } from "next";
import { Cargando } from "@/app/components/ui";
import ListaView from "./lista-view";

export const metadata: Metadata = { title: "Tomar lista | Preceptoría" };

export default function ListaPage() {
    return (
        <Suspense fallback={<Cargando className="h-96" />}>
            <ListaView />
        </Suspense>
    );
}
