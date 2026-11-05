import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Página no encontrada | ET N°24" };

export default function NotFound() {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
            <p className="font-libertinus text-6xl font-bold text-primary">404</p>
            <h1 className="font-libertinus text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                No encontramos esta página
            </h1>
            <p className="max-w-md text-neutral-600 dark:text-neutral-400">
                Puede que el enlace esté mal escrito o que la página ya no exista.
            </p>
            <Link
                href="/"
                className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-primary px-6 font-bold text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
                Volver al inicio
            </Link>
        </main>
    );
}
