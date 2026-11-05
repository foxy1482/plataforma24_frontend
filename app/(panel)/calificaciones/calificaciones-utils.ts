import { numero, ordinal, promedio } from "@/app/lib/format";
import { estadoPeriodo, rangoPeriodo } from "@/app/lib/periodos";
import type { BoletinNota, BoletinResumen, PeriodoApi } from "@/app/lib/types";

export {
    ESCALA_MAX,
    INASISTENCIAS_PERMITIDAS,
    NOTA_APROBACION,
    notaNumerica,
    ordinal,
} from "@/app/lib/format";
export { periodoActual as bimestreActual } from "@/app/lib/periodos";

export const NOTA_MINIMA_APROBACION = 6;

export type EstadoBimestre = "cerrado" | "en-curso" | "proximo";
export type EstadoMateria = "aprobada" | "desaprobada" | "sin-cargar";

export interface FilaMateria {
    id: number;
    nombre: string;
    docente: string;
    nota: number | null;
    estado: EstadoMateria;
}

export interface BimestreVista {
    numero: number;
    titulo: string;
    rango: string;
    estado: EstadoBimestre;
    promedio: number | null;
    filas: FilaMateria[];
}

export interface Boletin {
    bimestres: BimestreVista[];
    promedioAnual: number | null;
    bimestresCerrados: number;
    aprobadas: { cantidad: number; total: number; bimestre: number } | null;
}

export const formatoNota = (n: number) => numero(n, 2);

export function armarBoletin(args: {
    hoy: Date;
    periodos: PeriodoApi[];
    resumenes: BoletinResumen[];
    notasPorBimestre: Map<number, BoletinNota[]>;
}): Boletin {
    const { hoy, periodos, resumenes, notasPorBimestre } = args;

    const bimestres = periodos.map((periodo, i): BimestreVista => {
        const notas = notasPorBimestre.get(periodo.bimestre) ?? [];
        const filas = notas.map((n): FilaMateria => {
            const nota = n.nota ?? null;
            return {
                id: n.idMateria,
                nombre: n.materia ?? `Materia ${n.idMateria}`,
                docente: n.profesor ?? "Sin docente asignado",
                nota,
                estado:
                    nota === null
                        ? "sin-cargar"
                        : nota >= NOTA_MINIMA_APROBACION
                          ? "aprobada"
                          : "desaprobada",
            };
        });
        const resumen = resumenes.find((r) => r.bimestre === periodo.bimestre);

        return {
            numero: periodo.bimestre,
            titulo: `${ordinal(periodo.bimestre || i + 1)} bimestre`,
            rango: rangoPeriodo(periodo),
            estado: estadoPeriodo(periodo, hoy),
            promedio:
                resumen?.promedio ?? promedio(filas.flatMap((f) => (f.nota === null ? [] : [f.nota]))),
            filas,
        };
    });

    const cerrados = bimestres.filter((b) => b.estado === "cerrado" && b.promedio !== null);
    const ultimo = cerrados.at(-1) ?? bimestres.findLast((b) => b.filas.length > 0);

    return {
        bimestres,
        bimestresCerrados: cerrados.length,
        promedioAnual: promedio(cerrados.flatMap((b) => (b.promedio === null ? [] : [b.promedio]))),
        aprobadas: ultimo
            ? {
                  cantidad: ultimo.filas.filter((f) => f.estado === "aprobada").length,
                  total: ultimo.filas.length,
                  bimestre: ultimo.numero,
              }
            : null,
    };
}
