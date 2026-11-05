import type { Metadata } from "next";
import ForoDocenteView from "./foro-view";

export const metadata: Metadata = { title: "Foro | ET N°24" };

export default function ForoDocentePage() {
    return <ForoDocenteView />;
}