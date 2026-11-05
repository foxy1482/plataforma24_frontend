import type { Metadata } from "next";
import UsuariosView from "@/app/components/usuarios/usuarios-view";

export const metadata: Metadata = { title: "Usuarios | Preceptoría" };

export default function UsuariosPage() {
    return <UsuariosView base="/preceptoria/usuarios" />;
}
