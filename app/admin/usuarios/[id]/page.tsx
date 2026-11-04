import type { Metadata } from "next";
import UsuarioView from "./usuario-view";

export const metadata: Metadata = { title: "Usuario | Administración" };

export default function UsuarioPage() {
    return <UsuarioView />;
}
