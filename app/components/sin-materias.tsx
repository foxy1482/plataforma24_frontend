import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { BTN_P, CARD } from "@/app/components/ui";

// Estado vacío del panel docente: en vez de "pedile a la administración", se ofrece crear la materia.
export default function SinMaterias() {
    return (
        <div className={`${CARD} flex flex-col items-center gap-3 p-8 text-center`}>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
                Todavía no tenés materias. Creá la primera y elegí el curso en el que la dictás.
            </p>
            <Link href="/docente/materias/nueva" className={BTN_P}>
                <PlusIcon className="h-5 w-5" />
                Nueva materia
            </Link>
        </div>
    );
}
