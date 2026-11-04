import type { Metadata } from "next";
import InicioDocenteView from "./inicio-view";

export const metadata: Metadata = { title: "Panel docente | ET N°24" };

export default function DocenteInicioPage() {
    return <InicioDocenteView />;
}
