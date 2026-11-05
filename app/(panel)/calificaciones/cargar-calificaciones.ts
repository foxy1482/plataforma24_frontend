import * as api from "@/app/lib/apiClient";
import { leer } from "@/app/lib/format";
import type { BoletinNota, Curso } from "@/app/lib/types";
import { armarBoletin, type Boletin } from "./calificaciones-utils";

export interface CalificacionesData extends Boletin {
    hoy: Date;
    curso: Curso | null;
    inasistencias: number | null;
}

export async function cargarCalificaciones(): Promise<CalificacionesData> {
    const hoy = new Date();
    const perfil = await api.auth.getProfile();
    const ciclo = hoy.getFullYear();

    const [curso, periodos, resumenes, resumenAsistencia] = await Promise.all([
        perfil.idCurso == null ? null : api.cursos.porNumero(perfil.idCurso).catch(() => null),
        api.periodos.listar(ciclo).catch(() => null),
        api.boletines.porAlumno(perfil.id, ciclo).catch(() => null),
        api.asistencias.resumenAlumno(perfil.id, ciclo).catch(() => null),
    ]);

    const lista = resumenes ?? [];
    const detalles = await Promise.all(
        lista.map((r) => api.boletines.porNumero(r.idBoletin).catch(() => null))
    );

    const notasPorBimestre = new Map<number, BoletinNota[]>();
    detalles.forEach((d, i) => {
        if (!d) return;
        notasPorBimestre.set(lista[i].bimestre, d.notas ?? []);
    });

    // Si todavía no hay periodos cargados, se usan los bimestres que traigan los boletines.
    const ordenados = (periodos?.length
        ? [...periodos]
        : lista.map((r) => ({
              id: r.idBoletin,
              cicloLectivo: r.cicloLectivo,
              bimestre: r.bimestre,
              fechaInicio: "",
              fechaFin: "",
          }))
    ).sort((a, b) => a.bimestre - b.bimestre);
    const anual = resumenAsistencia?.anuales?.find((a) => a.cicloLectivo === ciclo);

    return {
        ...armarBoletin({ hoy, periodos: ordenados, resumenes: lista, notasPorBimestre }),
        hoy,
        curso,
        inasistencias: anual ? anual.totalInasistencias : null,
    };
}

export function describirCurso(curso: Curso | null) {
    const anio = leer(curso, "año", "anio", "ano");
    const division = leer(curso, "division");
    return [anio && `${anio}º año`, division && `${division}ª división`].filter(Boolean).join(", ");
}

export function cicloLectivo(curso: Curso | null, hoy: Date) {
    return leer(curso, "cicloLectivo", "ciclo_lectivo", "ciclo") ?? hoy.getFullYear();
}
