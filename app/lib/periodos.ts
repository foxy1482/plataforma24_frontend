import * as api from "./apiClient";
import { parseFecha } from "./format";
import type { PeriodoApi } from "./types";

export type EstadoPeriodo = "cerrado" | "en-curso" | "proximo";

export function estadoPeriodo(periodo: PeriodoApi, hoy: Date): EstadoPeriodo {
    const inicio = parseFecha(periodo.fechaInicio);
    const fin = parseFecha(periodo.fechaFin);
    if (fin && hoy.getTime() > fin.getTime()) return "cerrado";
    if (inicio && hoy.getTime() >= inicio.getTime()) return "en-curso";
    return "proximo";
}

const diaMes = (f: Date) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(f);

export function rangoPeriodo(periodo: PeriodoApi) {
    const inicio = parseFecha(periodo.fechaInicio);
    const fin = parseFecha(periodo.fechaFin);
    if (!inicio || !fin) return "";
    return `${diaMes(inicio)} – ${diaMes(fin)}`;
}

export function periodoActual(periodos: PeriodoApi[], hoy: Date) {
    const enCurso = periodos.find((p) => estadoPeriodo(p, hoy) === "en-curso");
    if (enCurso) return enCurso;
    const cerrados = periodos.filter((p) => estadoPeriodo(p, hoy) === "cerrado");
    return cerrados.at(-1) ?? periodos[0] ?? null;
}

const cache = new Map<number, Promise<PeriodoApi[]>>();

export function listarPeriodos(ciclo: number) {
    if (!cache.has(ciclo)) {
        cache.set(
            ciclo,
            api.periodos.listar(ciclo).then(
                (l) => [...(l ?? [])].sort((a, b) => a.bimestre - b.bimestre),
                () => []
            )
        );
    }
    return cache.get(ciclo)!;
}
