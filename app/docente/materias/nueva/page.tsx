import type { Metadata } from "next";
import NuevaMateriaView from "./nueva-materia-view";

export const metadata: Metadata = { title: "Nueva materia | Panel docente" };

export default function NuevaMateriaPage() {
    return <NuevaMateriaView />;
}
