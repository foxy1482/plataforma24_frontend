import type { DatosPersonalesPayload, Sexo } from "./types";

/* -------------------------------------------------------------------------- */
/*  Sexo                                                                      */
/* -------------------------------------------------------------------------- */

// El backend serializa el enum Sexo por su posición: Masculino = 0, Femenino = 1.
// Se acepta también el texto por si algún endpoint lo devolviera así.
export const SEXO_MASCULINO: Sexo = 0;
export const SEXO_FEMENINO: Sexo = 1;

export const OPCIONES_SEXO: { valor: Sexo; etiqueta: string }[] = [
    { valor: SEXO_MASCULINO, etiqueta: "Masculino" },
    { valor: SEXO_FEMENINO, etiqueta: "Femenino" },
];

export function sexoDe(valor: unknown): Sexo | null {
    const s = String(valor ?? "").trim().toLowerCase();
    if (s === String(SEXO_MASCULINO) || s === "masculino") return SEXO_MASCULINO;
    if (s === String(SEXO_FEMENINO) || s === "femenino") return SEXO_FEMENINO;
    return null;
}

export function sexoTexto(valor: unknown): string {
    const sexo = sexoDe(valor);
    return OPCIONES_SEXO.find((o) => o.valor === sexo)?.etiqueta ?? "—";
}

/* -------------------------------------------------------------------------- */
/*  Fecha de nacimiento                                                       */
/* -------------------------------------------------------------------------- */

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

// "2008-03-15" -> "15/03/2008". No pasa por Date: una fecha sin hora se interpretaría
// como UTC y en Argentina se mostraría el día anterior.
export function fechaNacimientoTexto(valor: string | null | undefined): string {
    const m = valor?.match(SOLO_FECHA);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

// Valor para <input type="date"> a partir de lo que devuelve la API.
export function fechaParaInput(valor: string | null | undefined): string {
    const m = valor?.match(SOLO_FECHA);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

export function hoyParaInput(): string {
    const hoy = new Date();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    return `${hoy.getFullYear()}-${mm}-${dd}`;
}

/* -------------------------------------------------------------------------- */
/*  Formulario                                                                */
/* -------------------------------------------------------------------------- */

export interface ValoresDatos {
    nombre: string;
    apellido: string;
    dni: string;
    telefonoCelular: string;
    direccion: string;
    fechaNacimiento: string;
    sexo: string; // "" | "0" | "1"
}

export type ErroresDatos = Partial<Record<keyof ValoresDatos, string>>;

export const FECHA_MINIMA = "1900-01-01";

const soloDigitos = (texto: string) => texto.replace(/[\s.\-+()]/g, "");

export function validarDatos(
    v: ValoresDatos,
    original: { telefonoCelular?: number | null; sexo?: unknown } | null
): ErroresDatos {
    const errores: ErroresDatos = {};

    if (v.nombre.trim().length < 2) errores.nombre = "Ingresá el nombre (mínimo 2 letras).";
    if (v.apellido.trim().length < 2) errores.apellido = "Ingresá el apellido (mínimo 2 letras).";

    const dni = soloDigitos(v.dni);
    if (!/^\d{6,8}$/.test(dni)) errores.dni = "El DNI debe tener entre 6 y 8 números, sin puntos.";

    if (v.telefonoCelular.trim()) {
        if (!/^\d{8,15}$/.test(soloDigitos(v.telefonoCelular))) {
            errores.telefonoCelular = "El celular debe tener entre 8 y 15 números.";
        }
    } else if (original?.telefonoCelular) {
        // El backend ignora un valor vacío al modificar, así que no se puede borrar un celular ya cargado.
        errores.telefonoCelular = "Un celular ya cargado no se puede borrar; ingresá el nuevo número.";
    }

    if (!v.direccion.trim()) errores.direccion = "Ingresá el domicilio.";
    else if (v.direccion.trim().length > 200) errores.direccion = "El domicilio es demasiado largo (máximo 200).";

    if (!v.fechaNacimiento) errores.fechaNacimiento = "Ingresá la fecha de nacimiento.";
    else if (v.fechaNacimiento > hoyParaInput()) errores.fechaNacimiento = "La fecha de nacimiento no puede ser futura.";
    else if (v.fechaNacimiento < FECHA_MINIMA) errores.fechaNacimiento = "La fecha de nacimiento no es válida.";

    if (!v.sexo && sexoDe(original?.sexo) !== null) {
        errores.sexo = "El sexo ya cargado no se puede quitar; elegí una opción.";
    }

    return errores;
}

// Arma el cuerpo para el backend a partir de los valores ya validados.
export function aPayload(v: ValoresDatos): DatosPersonalesPayload {
    const payload: DatosPersonalesPayload = {
        nombre: v.nombre.trim(),
        apellido: v.apellido.trim(),
        dni: Number(soloDigitos(v.dni)),
        direccion: v.direccion.trim(),
        fechaNacimiento: v.fechaNacimiento,
    };
    if (v.telefonoCelular.trim()) payload.telefonoCelular = Number(soloDigitos(v.telefonoCelular));
    const sexo = sexoDe(v.sexo);
    if (sexo !== null) payload.sexo = sexo;
    return payload;
}
