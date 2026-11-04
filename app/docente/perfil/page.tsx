import type { Metadata } from "next";
import PerfilView from "@/app/components/perfil-view";

export const metadata: Metadata = { title: "Mi perfil | Plataforma 24" };

export default function PerfilPage() {
    return <PerfilView />;
}
