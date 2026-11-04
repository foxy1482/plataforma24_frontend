import type { Metadata } from "next";
import TareasView from "./tareas-view";

export const metadata: Metadata = { title: "Tareas | ET N°24" };

export default function TareasPage() {
    return <TareasView />;
}