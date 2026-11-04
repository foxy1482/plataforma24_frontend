import type { Metadata } from "next";
import DetalleView from "./detalle-view";

export const metadata: Metadata = { title: "Detalle de la tarea | Panel docente" };

export default function DetallePage() {
    return <DetalleView />;
}
