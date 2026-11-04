import type { Metadata } from "next";
import InicioPreceptoriaView from "./inicio-view";

export const metadata: Metadata = { title: "Preceptoría | ET N°24" };

export default function PreceptoriaInicioPage() {
    return <InicioPreceptoriaView />;
}
