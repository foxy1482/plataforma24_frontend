import { getCookie, setCookie, deleteCookie } from "cookies-next";
import type {
    Archivo,
    Asistencia,
    BoletinDetalle,
    BoletinResumen,
    Curso,
    DatosPersonales,
    DatosPersonalesPayload,
    Entrega,
    EstadoAsistencia,
    EstadoBoletin,
    ForoMensaje,
    ForoTema,
    Material,
    Materia,
    ModoCoincidencia,
    Palabra,
    PeriodoApi,
    Planilla,
    Reporte,
    ResumenAsistencia,
    Rol,
    Tarea,
    Usuario,
    VerificacionTexto,
} from "./types";

// Sin barra final, para que `${BASE_URL}${endpoint}` nunca genere "//".
const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://localhost:7070").replace(
    /\/+$/,
    ""
);

const TOKEN_COOKIE = "token";

/* -------------------------------------------------------------------------- */
/*  Núcleo                                                                    */
/* -------------------------------------------------------------------------- */

// El backend responde los errores como ProblemDetails ({ title, detail }); los de validación
// de modelo traen además { errors: { campo: [mensajes] } }.
function mensajeDeCuerpo(cuerpo: string): string {
    const texto = cuerpo.trim();
    if (!texto) return "";
    try {
        const json: unknown = JSON.parse(texto);
        if (typeof json === "string") return json;
        if (json && typeof json === "object") {
            const { detail, mensaje, message, errors, title } = json as Record<string, unknown>;
            for (const candidato of [detail, mensaje, message]) {
                if (typeof candidato === "string" && candidato) return candidato;
            }
            if (errors && typeof errors === "object") {
                const primero = Object.values(errors as Record<string, unknown>)
                    .flat()
                    .find((e): e is string => typeof e === "string" && e.length > 0);
                if (primero) return primero;
            }
            if (typeof title === "string") return title;
        }
        return "";
    } catch {
        return texto;
    }
}

export class ApiError extends Error {
    status: number;
    body: string;
    // Texto legible para el usuario; vacío si el servidor no explicó el error.
    mensaje: string;

    constructor(status: number, body: string, statusText: string) {
        const mensaje = mensajeDeCuerpo(body);
        super(`Error HTTP ${status}: ${mensaje || statusText}`);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
        this.mensaje = mensaje;
    }
}

// Registra un error esperado (red caída, 4xx/5xx del backend) sin disparar el overlay rojo de
// Next en desarrollo, que se activa solo con console.error. Las pantallas ya muestran su
// propio mensaje al usuario; esto queda solo como rastro en la consola.
export function registrarError(...detalle: unknown[]): void {
    console.warn("[api]", ...detalle);
}

// Mensaje del servidor para los errores que el usuario puede corregir (datos inválidos,
// duplicados, texto no permitido); para cualquier otro fallo, el texto alternativo.
export function mensajeDeError(error: unknown, alternativo: string): string {
    if (error instanceof ApiError && [400, 409, 422].includes(error.status) && error.mensaje) {
        return error.mensaje;
    }
    return alternativo;
}

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions extends Omit<RequestInit, "body"> {
    params?: Record<string, QueryValue>;
    // Un objeto/array se serializa solo a JSON; FormData/Blob/string pasan tal cual.
    body?: BodyInit | object | null;
}

function buildUrl(endpoint: string, params?: Record<string, QueryValue>) {
    const url = `${BASE_URL}${endpoint}`;
    if (!params) return url;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
            searchParams.append(key, String(value));
        }
    }
    const query = searchParams.toString();
    if (!query) return url;
    return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

function getToken() {
    return getCookie(TOKEN_COOKIE) as string | undefined;
}

// Los módulos que guardan datos de la sesión en memoria (nombre, cursos, materias…) se registran acá
// para vaciarlos cuando cambia la cuenta. La navegación entre pantallas no recarga la página, así que
// sin esto el usuario siguiente vería los datos (y el nombre) del anterior.
const alCambiarSesionFns = new Set<() => void>();

export function alCambiarSesion(vaciar: () => void): void {
    alCambiarSesionFns.add(vaciar);
}

function sesionCambiada(): void {
    alCambiarSesionFns.forEach((vaciar) => vaciar());
}

// Token vencido o inválido: se descarta la cookie y se vuelve al login.
// Las pantallas públicas (inicio, login, registro) validan el token por su cuenta.
const RUTAS_PUBLICAS = ["/", "/login", "/registro"];

function sesionVencida(endpoint: string) {
    if (typeof window === "undefined") return;
    // Un 401 al iniciar sesión es "credenciales incorrectas", no una sesión vencida.
    if (endpoint.startsWith("/auth/login") || endpoint.startsWith("/auth/registro")) return;
    deleteCookie(TOKEN_COOKIE, { path: "/" });
    sesionCambiada();
    if (!RUTAS_PUBLICAS.includes(window.location.pathname)) window.location.replace("/login");
}

async function fallar(response: Response, endpoint: string): Promise<never> {
    if (response.status === 401) sesionVencida(endpoint);
    const errorBody = await response.text().catch(() => "");
    throw new ApiError(response.status, errorBody, response.statusText);
}

// fetch rechaza con un TypeError crudo ("Failed to fetch") si no hay red, el servidor está caído
// o el certificado no es de confianza. Se convierte en ApiError con status 0 para que todas las
// pantallas lo traten igual que cualquier otro fallo de la API. Los abortos se dejan pasar.
async function conectar(url: string, init: RequestInit): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new ApiError(0, "", "No se pudo conectar con el servidor");
    }
}

function isRawBody(body: unknown): body is BodyInit {
    return (
        typeof body === "string" ||
        body instanceof FormData ||
        body instanceof Blob ||
        body instanceof URLSearchParams ||
        body instanceof ArrayBuffer
    );
}

export async function apiClient<T>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<T> {
    const { params, headers, body, ...customOptions } = options;

    const finalHeaders = new Headers(headers);
    const token = getToken();
    if (token && !finalHeaders.has("Authorization")) {
        finalHeaders.set("Authorization", `Bearer ${token}`);
    }

    let payload: BodyInit | undefined;
    if (body !== undefined && body !== null) {
        if (isRawBody(body)) {
            payload = body;
            if (typeof body === "string" && !finalHeaders.has("Content-Type")) {
                finalHeaders.set("Content-Type", "application/json");
            }
        } else {
            payload = JSON.stringify(body);
            if (!finalHeaders.has("Content-Type")) {
                finalHeaders.set("Content-Type", "application/json");
            }
        }
    }

    const response = await conectar(buildUrl(endpoint, params), {
        ...customOptions,
        headers: finalHeaders,
        body: payload,
    });

    if (!response.ok) return fallar(response, endpoint);

    const text = await response.text();
    if (!text) return null as T;
    try {
        return JSON.parse(text) as T;
    } catch {
        return text as unknown as T;
    }
}

export async function apiBlob(endpoint: string): Promise<Blob> {
    const token = getToken();
    const response = await conectar(buildUrl(endpoint), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return fallar(response, endpoint);
    return response.blob();
}

const get = <T>(endpoint: string, params?: Record<string, QueryValue>) =>
    apiClient<T>(endpoint, { params });
const post = <T>(endpoint: string, body?: RequestOptions["body"]) =>
    apiClient<T>(endpoint, { method: "POST", body });
const patch = <T>(endpoint: string, body?: RequestOptions["body"]) =>
    apiClient<T>(endpoint, { method: "PATCH", body });
const del = <T>(
    endpoint: string,
    options?: { params?: Record<string, QueryValue>; body?: RequestOptions["body"] }
) => apiClient<T>(endpoint, { method: "DELETE", ...options });

type Lista<T> = T[] | null;

// Los endpoints de adjuntos devuelven el join {idTarea|idMaterial|idEntrega, idArchivo, nombreOriginal, ruta},
// no la fila de Archivo: se normaliza para que `id` sea el id del archivo.
interface VinculoArchivo {
    idArchivo: number;
    nombreOriginal?: string | null;
    ruta?: string | null;
}

function aArchivos(lista: Lista<VinculoArchivo>): Lista<Archivo> {
    if (!lista) return lista;
    return lista.map(
        (v) =>
            ({
                id: v.idArchivo,
                nombreOriginal: v.nombreOriginal ?? "",
                ruta: v.ruta ?? "",
            }) as Archivo
    );
}

/* -------------------------------------------------------------------------- */
/*  Auth                                                                      */
/* -------------------------------------------------------------------------- */

export const auth = {
    login: (credentials: { email: string; password: string }) =>
        post<{ token?: string; access_token?: string }>("/auth/login/", credentials),

    registro: (credentials: { email: string; nombre: string; password: string }) =>
        post<unknown>("/auth/registro/", credentials),

    // Usuario dueño del token
    getProfile: () => get<Usuario>("/auth/profile/"),

    // Manejo del token en cookie
    setToken: (token: string) => {
        sesionCambiada();
        setCookie(TOKEN_COOKIE, token, {
            path: "/",
            maxAge: 60 * 60 * 24 * 7, // igual que la vigencia del JWT (7 días)
            sameSite: "lax",
            secure: typeof window !== "undefined" && window.location.protocol === "https:",
        });
    },
    logout: () => {
        deleteCookie(TOKEN_COOKIE, { path: "/" });
        sesionCambiada();
    },
};

/* -------------------------------------------------------------------------- */
/*  Usuarios                                                                  */
/* -------------------------------------------------------------------------- */

export const usuarios = {
    listar: () => get<Lista<Usuario>>("/usuarios/"),
    // El backend recibe el id numérico del usuario (no el legajo "ALU-0001")
    porLegajo: (legajo: number | string) => get<Usuario>(`/usuarios/${legajo}`),
    // Todos los usuarios de un curso, sin el profesor
    porCurso: (numCurso: number) => get<Lista<Usuario>>(`/usuarios/curso/${numCurso}`),
    modificar: (
        legajo: number | string,
        data: Partial<Pick<Usuario, "idCurso" | "idRol" | "nombreUsuario" | "email">>
    ) => patch<Usuario>(`/usuarios/${legajo}`, data),
    eliminar: (legajo: number | string) => del<null>(`/usuarios/${legajo}`),
};

/* -------------------------------------------------------------------------- */
/*  Datos personales                                                          */
/* -------------------------------------------------------------------------- */

export const datos = {
    porLegajo: (legajo: number | string) => get<DatosPersonales>(`/datos/usuario/${legajo}`),
    // Join con los datos personales de todos los alumnos de un curso
    alumnosDeCurso: (numCurso: number) =>
        get<Lista<DatosPersonales>>(`/datos/alumnos/curso/${numCurso}`),
    crear: (data: DatosPersonalesPayload & { idUsuario: number }) =>
        post<DatosPersonales>("/datos/", data),
    // El backend responde 204: para ver el resultado hay que volver a pedir los datos.
    // Solo modifica los campos con valor; no hay forma de vaciar el celular ni el sexo.
    modificar: (legajo: number | string, data: Partial<DatosPersonalesPayload>) =>
        patch<DatosPersonales>(`/datos/usuario/${legajo}`, data),
    eliminar: (legajo: number | string) => del<null>(`/datos/usuario/${legajo}`),
};

/* -------------------------------------------------------------------------- */
/*  Roles                                                                     */
/* -------------------------------------------------------------------------- */

export const roles = {
    listar: () => get<Lista<Rol>>("/roles/"),
    porNumero: (numero: number) => get<Rol>(`/roles/${numero}`),
    crear: (data: Record<string, unknown>) => post<Rol>("/roles/", data),
    modificar: (numero: number, data: Record<string, unknown>) =>
        patch<Rol>(`/roles/${numero}`, data),
    eliminar: (numero: number) => del<null>(`/roles/${numero}`),
};

/* -------------------------------------------------------------------------- */
/*  Cursos                                                                    */
/* -------------------------------------------------------------------------- */

export const cursos = {
    listar: () => get<Lista<Curso>>("/cursos/"),
    porNumero: (numero: number) => get<Curso>(`/cursos/${numero}`),
    // El backend usa enums numéricos: ano 1-6 y turno 0-2 (un valor como "M" da 400).
    porAnoYTurno: (ano: number, turno: number) =>
        get<Lista<Curso>>("/cursos", { ano, turno }),
    crear: (data: Record<string, unknown>) => post<Curso>("/cursos/", data),
    modificar: (
        numero: number,
        data: Record<string, unknown>
    ) => patch<Curso>(`/cursos/${numero}`, data),
    eliminar: (numero: number) => del<null>(`/cursos/${numero}`),
};

/* -------------------------------------------------------------------------- */
/*  Materias                                                                  */
/* -------------------------------------------------------------------------- */

export const materias = {
    listar: () => get<Lista<Materia>>("/materias/"),
    porProfesor: (numProfesor: number) =>
        get<Lista<Materia>>("/materias", { profesor: numProfesor }),
    porCurso: (numCurso: number) =>
        get<Lista<Materia>>("/materias", { curso: numCurso }),
    porNumero: (numero: number) => get<Materia>(`/materias/${numero}`),
    crear: (data: Omit<Materia, "id" | "horario" | "aula">) => post<Materia>("/materias/", data),
    modificar: (
        numero: number,
        data: Partial<Pick<Materia, "idProfesor" | "idCurso">>
    ) => patch<Materia>(`/materias/${numero}`, data),
    eliminar: (numero: number) => del<null>(`/materias/${numero}`),
    // Entregas que hizo un alumno dentro de una materia
    entregasDeAlumno: (materiaId: number, legajo: number | string) =>
        get<Lista<Entrega>>(`/materias/${materiaId}/entregas/alumno/${legajo}`),
};

/* -------------------------------------------------------------------------- */
/*  Tareas (+ archivos adjuntos de la tarea)                                  */
/* -------------------------------------------------------------------------- */

export const tareas = {
    listar: () => get<Lista<Tarea>>("/tareas/"),
    porMateria: (numMateria: number) =>
        get<Lista<Tarea>>(`/tareas?materia=${numMateria}`),
    porNumero: (numero: number) => get<Tarea>(`/tareas/${numero}`),
    crear: (data: Record<string, unknown>) => post<Tarea>("/tareas/", data),
    modificar: (
        numero: number,
        data: Record<string, unknown>
    ) => patch<Tarea>(`/tareas/${numero}`, data),
    // Solo el profesor de la materia o una autoridad
    eliminar: (numero: number) => del<null>(`/tareas/${numero}`),
};

export const tareaArchivos = {
    porTarea: async (idTarea: number): Promise<Lista<Archivo>> =>
        aArchivos(await get<Lista<VinculoArchivo>>("/tareas/archivos", { idTarea })),
    vincular: (data: Record<string, unknown>) =>
        post<unknown>("/tareas/archivos/", data),
    desvincular: (idTarea: number, idArchivo: number) =>
        del<null>("/tareas/archivos", { params: { idTarea, idArchivo } }),
};

/* -------------------------------------------------------------------------- */
/*  Archivos                                                                  */
/* -------------------------------------------------------------------------- */

export const archivos = {
    listar: () => get<Lista<Archivo>>("/archivos/"),
    porNumero: (numero: number) => get<Archivo>(`/archivos/${numero}`),
    porNombre: (nombre: string) => get<Lista<Archivo>>("/archivos", { nombre }),
    porUsuario: (idUsuario: number) => get<Lista<Archivo>>("/archivos", { idUsuario }),
    // Sube un File (multipart, campo "archivo")
    subir: (file: File) => {
        const form = new FormData();
        form.append("archivo", file);
        return post<Archivo>("/archivos", form);
    },
    descargar: (numero: number) => apiBlob(`/archivos/descargar/${numero}`),
    ver: (numero: number) => apiBlob(`/archivos/ver/${numero}`),
    modificar: (numero: number, data: Record<string, unknown>) =>
        patch<Archivo>(`/archivos/${numero}`, data),
    eliminar: (numero: number) => del<null>(`/archivos/${numero}`),
};

/* -------------------------------------------------------------------------- */
/*  Material de estudio (+ archivos)                                          */
/* -------------------------------------------------------------------------- */

export const materiales = {
    listar: () => get<Lista<Material>>("/materiales/"),
    porMateria: (numMateria: number) =>
        get<Lista<Material>>("/materiales", { idMateria: numMateria }),
    porNumero: (numero: number) => get<Material>(`/materiales/${numero}`),
    crear: (data: Record<string, unknown>) => post<Material>("/materiales/", data),
    modificar: (
        numero: number,
        data: Record<string, unknown>
    ) => patch<Material>(`/materiales/${numero}`, data),
    eliminar: (numero: number) => del<null>(`/materiales/${numero}`),
};

export const materialArchivos = {
    porMaterial: async (idMaterial: number): Promise<Lista<Archivo>> =>
        aArchivos(await get<Lista<VinculoArchivo>>("/materiales/archivos", { idMaterial })),
    vincular: (data: Record<string, unknown>) =>
        post<unknown>("/materiales/archivos/", data),
    desvincular: (idMaterial: number, idArchivo: number) =>
        del<null>("/materiales/archivos", { params: { idMaterial, idArchivo } }),
};

/* -------------------------------------------------------------------------- */
/*  Entregas (+ archivos)                                                     */
/* -------------------------------------------------------------------------- */

export const entregas = {
    porAlumno: (legajo: number | string) => get<Lista<Entrega>>(`/entregas/alumno/${legajo}`),
    porTarea: (numTarea: number) => get<Lista<Entrega>>(`/entregas/tarea/${numTarea}`),
    crear: (data: Record<string, unknown>) =>
        post<Entrega>("/entregas/", data),
    modificar: (numero: number, data: Record<string, unknown>) =>
        patch<Entrega>(`/entregas/${numero}`, data),
    eliminar: (numero: number) => del<null>(`/entregas/${numero}`),
};

export const entregaArchivos = {
    porEntrega: async (idEntrega: number): Promise<Lista<Archivo>> =>
        aArchivos(await get<Lista<VinculoArchivo>>("/entregas/archivos", { idEntrega })),
    vincular: (data: Record<string, unknown>) =>
        post<unknown>("/entregas/archivos/", data),
    // Un archivo puntual de una entrega
    quitarArchivo: (idEntrega: number, idArchivo: number) =>
        del<null>("/entregas/archivos", { params: { idEntrega, idArchivo } }),
    // Todo el registro de archivos de la entrega
    quitarTodos: (numero: number) => del<null>(`/entregas/archivos/${numero}`),
};

/* -------------------------------------------------------------------------- */
/*  Periodos (bimestres del ciclo lectivo)                                    */
/* -------------------------------------------------------------------------- */

export const periodos = {
    listar: (ciclo?: number) => get<Lista<PeriodoApi>>("/periodos", { ciclo }),
    porNumero: (id: number) => get<PeriodoApi>(`/periodos/${id}`),
    crear: (data: Record<string, unknown>) => post<PeriodoApi>("/periodos", data),
    modificar: (id: number, data: { fechaInicio?: string; fechaFin?: string }) =>
        patch<PeriodoApi>(`/periodos/${id}`, data),
    eliminar: (id: number) => del<null>(`/periodos/${id}`),
};

/* -------------------------------------------------------------------------- */
/*  Asistencias                                                               */
/* -------------------------------------------------------------------------- */

export const asistencias = {
    // Crea la planilla del día si todavía no existe
    abrir: (idCurso: number, fecha: string) =>
        post<unknown>("/asistencias/abrir", { idCurso, fecha }),
    // fecha en formato "2026-10-28"; sin fecha devuelve la de hoy
    delCurso: (idCurso: number, fecha?: string) =>
        get<Planilla>(`/asistencias/curso/${idCurso}`, { fecha }),
    planillas: (idCurso: number, desde?: string, hasta?: string) =>
        get<Lista<Asistencia>>(`/asistencias/curso/${idCurso}/planillas`, { desde, hasta }),
    guardarDetalle: (
        idAsistencia: number,
        detalle: { idAlumno: number; estado: EstadoAsistencia; observacion?: string | null }[]
    ) => patch<unknown>(`/asistencias/${idAsistencia}/detalle`, detalle),
    modificar: (idAsistencia: number, data: { cerrada?: boolean; observaciones?: string | null }) =>
        patch<unknown>(`/asistencias/${idAsistencia}`, data),
    eliminar: (idAsistencia: number) => del<null>(`/asistencias/${idAsistencia}`),
    resumenAlumno: (idAlumno: number, ciclo?: number) =>
        get<ResumenAsistencia>(`/asistencias/alumno/${idAlumno}/resumen`, { ciclo }),
};

/* -------------------------------------------------------------------------- */
/*  Boletines                                                                 */
/* -------------------------------------------------------------------------- */

export const boletines = {
    porAlumno: (idAlumno: number, ciclo?: number) =>
        get<Lista<BoletinResumen>>(`/boletines/alumno/${idAlumno}`, { ciclo }),
    porCurso: (idCurso: number, ciclo?: number, bimestre?: number) =>
        get<Lista<BoletinResumen>>(`/boletines/curso/${idCurso}`, { ciclo, bimestre }),
    porNumero: (id: number) => get<BoletinDetalle>(`/boletines/${id}`),
    modificar: (id: number, data: { observaciones?: string | null; estado?: EstadoBoletin }) =>
        patch<unknown>(`/boletines/${id}`, data),
    eliminar: (id: number) => del<null>(`/boletines/${id}`),
    generar: (idAlumno: number, idPeriodo: number) =>
        post<unknown>("/boletines/generar", { idAlumno, idPeriodo }),
    generarCurso: (idCurso: number, idPeriodo: number) =>
        post<unknown>("/boletines/generar-curso", { idCurso, idPeriodo }),
    // Carga la nota de una materia dentro del boletín (planilla del docente)
    cargarNota: (
        idBoletin: number,
        idMateria: number,
        data: { nota?: number | null; observacion?: string | null }
    ) => patch<unknown>(`/boletines/${idBoletin}/notas/${idMateria}`, data),
};

/* -------------------------------------------------------------------------- */
/*  Foro                                                                      */
/* -------------------------------------------------------------------------- */

export const foro = {
    temas: (idCurso?: number) => get<Lista<ForoTema>>("/foro/temas", { idCurso }),
    crearTema: (data: { idCurso?: number | null; titulo: string; primerMensaje?: string }) =>
        post<unknown>("/foro/temas", data),
    modificarTema: (idTema: number, data: { fijado?: boolean; cerrado?: boolean }) =>
        patch<unknown>(`/foro/temas/${idTema}`, data),
    eliminarTema: (idTema: number) => del<null>(`/foro/temas/${idTema}`),
    mensajes: (idTema: number) => get<Lista<ForoMensaje>>(`/foro/temas/${idTema}/mensajes`),
    crearMensaje: (idTema: number, data: { contenido: string; idRespuestaA?: number | null }) =>
        post<unknown>(`/foro/temas/${idTema}/mensajes`, data),
    modificarMensaje: (idMensaje: number, contenido: string) =>
        patch<unknown>(`/foro/mensajes/${idMensaje}`, { contenido }),
    eliminarMensaje: (idMensaje: number) => del<null>(`/foro/mensajes/${idMensaje}`),
    reportar: (idMensaje: number, motivo: string) =>
        post<unknown>(`/foro/mensajes/${idMensaje}/reportes`, { motivo }),
    reportes: (pendientes?: boolean) => get<Lista<Reporte>>("/foro/reportes", { pendientes }),
    resolverReporte: (idReporte: number) => patch<unknown>(`/foro/reportes/${idReporte}/resolver`),
};

export const palabras = {
    listar: () => get<Lista<Palabra>>("/foro/palabras"),
    crear: (palabra: string, modo: ModoCoincidencia) =>
        post<unknown>("/foro/palabras", { palabra, modo }),
    modificar: (id: number, data: { activa?: boolean; modo: ModoCoincidencia }) =>
        patch<unknown>(`/foro/palabras/${id}`, data),
    eliminar: (id: number) => del<null>(`/foro/palabras/${id}`),
    verificar: (texto: string) => post<VerificacionTexto>("/foro/palabras/verificar", { texto }),
};
