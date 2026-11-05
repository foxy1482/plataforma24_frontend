import type { Metadata } from "next";
import TemaDocenteView from "./tema-view";

export const metadata: Metadata = { title: "Debate | ET N°24" };

export default function DebateDocentePage() {
    return <TemaDocenteView />;
}