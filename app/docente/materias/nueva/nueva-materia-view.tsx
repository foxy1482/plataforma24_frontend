"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as api from "@/app/lib/apiClient";
import { ApiError, registrarError } from "@/app/lib/apiClient";
import type { Curso } from "@/app/lib/types";
import { CARD, Cargando, ErrorPanel, Vacio } from "@/app/components/ui";
import MateriaForm from "@/app/components/materia-form";
import { invalidarDocente } from "../../datos";

export default function NuevaMateriaView() {
    const router = useRouter();
    const [cursos, setCursos] = useState<Curso[] | null>(null);
    const [error, setError] = useState(false);

    const cargar = useCallback(() => {
        api.cursos
            .listar()
            .then((l) => setCursos(l ?? []))
            .catch((e) => {
                if (e instanceof ApiError && e.status === 401) {
                    router.replace("/login");
                    return;
                }
                registrarError(e);
                setError(true);
            });
    }, [router]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    return (
        <div className="mx-auto max-w-2xl space-y-5">
            <nav aria-label="Ruta" className="text-sm text-neutral-500 dark:text-neutral-400">
                <Link href="/docente/materias" className="hover:underline">
                    Mis materias
                </Link>{" "}
                / Nueva materia
            </nav>
            <header>
                <h1 className="font-libertinus text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Nueva materia
                </h1>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                    Creá tu materia y elegí el curso en el que la dictás. Queda a tu cargo y ya
                    podés cargar tareas y materiales.
                </p>
            </header>

            {error ? (
                <ErrorPanel
                    mensaje="No pudimos cargar los cursos."
                    onReintentar={() => {
                        setError(false);
                        cargar();
                    }}
                />
            ) : !cursos ? (
                <Cargando className="h-72" />
            ) : cursos.length === 0 ? (
                <Vacio>
                    Todavía no hay cursos cargados, así que no se puede crear una materia. Avisale a
                    la administración.
                </Vacio>
            ) : (
                <div className={`${CARD} p-6`}>
                    <MateriaForm
                        cursos={cursos}
                        onGuardado={(creada) => {
                            invalidarDocente();
                            router.push(`/docente/materias?materia=${creada.id}`);
                        }}
                        onCancelar={() => router.push("/docente/materias")}
                    />
                </div>
            )}
        </div>
    );
}
