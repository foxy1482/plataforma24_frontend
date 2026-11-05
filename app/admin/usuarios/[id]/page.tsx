import type { Metadata } from "next";
import UsuarioView from "@/app/components/usuarios/usuario-view";

export const metadata: Metadata = { title: "Usuario | Administración" };

export default function UsuarioPage() {
    return <UsuarioView base="/admin/usuarios" />;
}
