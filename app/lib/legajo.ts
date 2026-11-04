import type { Rol } from "./types";

// El legajo ("ALU-0003") acompaña al rol: la base le asigna uno nuevo, con el prefijo del rol
// nuevo, cuando el usuario cambia a un rol con otro prefijo (alumno <-> adminAlumno comparten "ALU").

export function prefijoDeLegajo(numeroLegajo: string | null | undefined): string {
    return (numeroLegajo ?? "").split("-")[0].toUpperCase();
}

export function prefijoDeRol(roles: Rol[], idRol: number): string | null {
    const prefijo = roles.find((r) => r.id === idRol)?.prefijoLegajo?.trim();
    return prefijo ? prefijo.toUpperCase() : null;
}

// Prefijo que va a tener el legajo después de pasar al rol `idRolNuevo`, o null si no cambia
// (mismo prefijo, o no se conoce el del rol).
export function prefijoNuevoDeLegajo(
    numeroLegajo: string | null | undefined,
    roles: Rol[],
    idRolNuevo: number
): string | null {
    const nuevo = prefijoDeRol(roles, idRolNuevo);
    if (!nuevo) return null;
    return nuevo !== prefijoDeLegajo(numeroLegajo) ? nuevo : null;
}

export const AVISO_LEGAJO_NO_RENOVADO =
    "El rol se cambió, pero el legajo conserva el prefijo anterior. Avisale a quien administra la base de datos.";
