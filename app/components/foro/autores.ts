import { useEffect, useState } from "react";
import * as api from "@/app/lib/apiClient";
import { nombreAutor } from "./foro-utils";

// Apellido y nombre reales por usuario. Solo el personal puede leer datos personales ajenos (un alumno
// recibe 403), así que el hook se activa solo para ellos; los demás ven el nombre de usuario formateado.
const cache = new Map<number, Promise<string | null>>();
api.alCambiarSesion(() => cache.clear());

function nombreReal(idUsuario: number): Promise<string | null> {
    if (!cache.has(idUsuario)) {
        cache.set(
            idUsuario,
            api.datos.porLegajo(idUsuario).then(
                (d) => [d.nombre, d.apellido].filter(Boolean).join(" ").trim() || null,
                () => null
            )
        );
    }
    return cache.get(idUsuario)!;
}

export function useNombresReales(ids: number[], activo: boolean): Record<number, string> {
    const [nombres, setNombres] = useState<Record<number, string>>({});
    const clave = [...new Set(ids)].sort((a, b) => a - b).join(",");

    useEffect(() => {
        if (!activo || !clave) return;
        let vivo = true;
        Promise.all(
            clave.split(",").map(async (s) => [Number(s), await nombreReal(Number(s))] as const)
        ).then((pares) => {
            if (!vivo) return;
            setNombres((previos) => {
                const siguientes = { ...previos };
                for (const [id, nombre] of pares) if (nombre) siguientes[id] = nombre;
                return siguientes;
            });
        });
        return () => {
            vivo = false;
        };
    }, [clave, activo]);

    return nombres;
}

export function nombreMostrado(idUsuario: number, alias: string | null | undefined, reales: Record<number, string>) {
    return reales[idUsuario] ?? nombreAutor(alias);
}
