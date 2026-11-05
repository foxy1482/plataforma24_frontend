import type { Metadata } from "next";
import TemaPreceptoriaView from "./tema-view";

export const metadata: Metadata = { title: "Debate | ET N°24" };

export default function DebatePreceptoriaPage() {
    return <TemaPreceptoriaView />;
}