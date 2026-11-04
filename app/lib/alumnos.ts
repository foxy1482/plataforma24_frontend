import * as api from "./apiClient";
import type { DatosPersonales } from "./types";

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Alumnos de un curso con sus datos personales. Los usuarios que todavía no cargaron
// sus datos aparecen igual, con el nombre armado a partir de su nombre de usuario.
export async function alumnosDeCurso(idCurso: number): Promise<DatosPersonales[]> {
    const [usuarios, datos] = await Promise.all([
        api.usuarios.porCurso(idCurso),
        api.datos.alumnosDeCurso(idCurso),
    ]);

    const personales = new Map((datos ?? []).map((d) => [d.idUsuario, d]));

    return (usuarios ?? [])
        .filter((u) => u.idRol === 1)
        .map((u): DatosPersonales => {
            const d = personales.get(u.id);
            const [nombre, ...resto] = (u.nombreUsuario ?? u.nombre ?? u.email).split(".");
            return {
                id: u.id,
                idUsuario: u.id,
                numeroLegajo: u.numeroLegajo,
                nombre: d?.nombre ?? capitalizar(nombre),
                apellido: d?.apellido ?? capitalizar(resto.join(" ")),
                dni: d?.dni ?? 0,
                telefonoCelular: d?.telefonoCelular ?? "",
                direccion: d?.direccion ?? "",
                fechaNacimiento: d?.fechaNacimiento ?? "",
                idFotoArchivo: d?.idFotoArchivo,
                sexo: d?.sexo,
            };
        });
}
