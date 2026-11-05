import { redirect } from "next/navigation";

// No hay una lista global de material: se llega desde cada materia (/materias/[id]) a /material/[id].
export default function MaterialIndexPage() {
    redirect("/materias");
}
