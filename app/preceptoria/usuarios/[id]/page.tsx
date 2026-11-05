import type { Metadata } from "next";
import UsuarioView from "@/app/components/usuarios/usuario-view";

export const metadata: Metadata = { title: "Usuario | Preceptoría" };

export default function UsuarioPage() {
    return <UsuarioView base="/preceptoria/usuarios" />;
}
