import type { Metadata } from "next";
import MateriasView from "./materias-view";

export const metadata: Metadata = { title: "Mis Materias | ET N°24" };

export default function MateriasPage() {
    return <MateriasView />;
}
