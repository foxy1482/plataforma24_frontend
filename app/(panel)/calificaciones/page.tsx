import type { Metadata } from "next";
import CalificacionesView from "./calificaciones-view";

export const metadata: Metadata = { title: "Calificaciones | ET N°24" };

export default function CalificacionesPage() {
    return <CalificacionesView />;
}