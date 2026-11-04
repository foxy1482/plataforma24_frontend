import { ApiError } from "./apiClient";

// Una llamada secundaria que falla no debe romper toda la página,
// salvo que sea un 401 (sesión vencida), que se propaga.
// Devuelve undefined si falló (para distinguirlo de "lista vacía").
export async function seguro<T>(
    etiqueta: string,
    promesa: Promise<T[] | null>
): Promise<T[] | undefined> {
    try {
        return (await promesa) ?? [];
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) throw error;
        console.warn(`[api] falló ${etiqueta}:`, error);
        return undefined;
    }
}