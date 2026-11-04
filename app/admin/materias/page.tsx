import type { Metadata } from "next";
import MateriasView from "./materias-view";

export const metadata: Metadata = { title: "Materias | Administración" };

export default function AdminMateriasPage() {
    return <MateriasView />;
}
