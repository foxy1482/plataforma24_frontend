import type { Metadata } from "next";
import EntregasView from "./entregas-view";

export const metadata: Metadata = { title: "Entregas de la tarea | Panel docente" };

export default function EntregasPage() {
    return <EntregasView />;
}
