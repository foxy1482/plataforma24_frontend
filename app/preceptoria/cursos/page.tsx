import type { Metadata } from "next";
import CursosView from "./cursos-view";

export const metadata: Metadata = { title: "Cursos | Preceptoría" };

export default function CursosPage() {
    return <CursosView />;
}
