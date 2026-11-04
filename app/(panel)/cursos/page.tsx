import type { Metadata } from "next";
import CursosView from "./cursos-view";

export const metadata: Metadata = { title: "Cursos | ET N°24" };

export default function CursosPage() {
    return <CursosView />;
}
