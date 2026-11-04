import type { Metadata } from "next";
import PorCorregirView from "./por-corregir-view";

export const metadata: Metadata = { title: "Por corregir | Panel docente" };

export default function PorCorregirPage() {
    return <PorCorregirView />;
}
