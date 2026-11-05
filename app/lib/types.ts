
export interface Usuario {
    id: number;
    numeroLegajo: string;
    email: string;
    // /auth/profile/ lo devuelve como "nombre" y /usuarios/{id} como "nombreUsuario"
    nombre?: string;
    nombreUsuario?: string;
    idRol: number;
    rol?: string | null; // nombre del rol; solo viene en /auth/profile/
    idCurso: number | null;
}

export interface Materia {
    id: number;
    nombre: string;
    idProfesor: number;
    idCurso: number;
    horario?: string;
    aula?: string;
}

export interface Tarea {
    id: number;
    titulo: string;
    descripcion: string;
    fechaEntrega: string;
    publicadaDesde: string;
    idMateria: number;
}

export interface Rol {
    id: number;
    nombre: string;
    prefijoLegajo: string;
}

export interface Curso {
    id: number;
    año: number | string;
    division: number | string;
    turno: number | string; // 0 mañana, 1 tarde, 2 noche
    aula?: string;
    cicloLectivo: number;
}

// Enum Sexo del backend, serializado por posición: 0 Masculino, 1 Femenino.
export type Sexo = 0 | 1;

export interface DatosPersonalesPayload {
    nombre: string;
    apellido: string;
    dni: number;
    telefonoCelular?: number | null;
    direccion: string;
    fechaNacimiento: string; // "yyyy-MM-dd"
    sexo?: Sexo | null;
}

export interface DatosPersonales extends Omit<DatosPersonalesPayload, "telefonoCelular"> {
    idUsuario: number;
    numeroLegajo?: string; // lo completa alumnosDeCurso() desde el usuario
    telefonoCelular: number | null;
    idFotoArchivo?: number | null;
    // true cuando el usuario todavía no cargó sus datos y el nombre sale de su alias (alumnosDeCurso)
    sinDatos?: boolean;
}

export interface Material {
    id: number;
    titulo: string;
    descripcion: string;
    publicadaDesde: string;
    idMateria: number;
}

export interface Entrega {
    id: number;
    idTarea: number;
    idUsuario: number;
    fechaEntrega: string;
    calificacion?: string;
}

export interface Archivo {
    id: number;
    nombreOriginal: string;
    guidArchivo: string;
    ruta: string;
    tipo: string;
    idUsuario: number;
    fechaSubida: string;
}

export interface Registro {
    id: number;
    [clave: string]: unknown;
}

export type EstadoAsistencia = "presente" | "ausente" | "tarde" | "justificado";

export interface Asistencia {
    id: number;
    idCurso: number;
    fecha: string;
    cerrada: boolean;
    idRegistradoPor?: number | null;
    observaciones?: string | null;
}

export interface AsistenciaDetalle {
    id: number;
    idAlumno: number;
    numeroLegajo?: string;
    apellido?: string;
    nombre?: string;
    estado: EstadoAsistencia;
    observacion?: string | null;
}

export interface Planilla extends Asistencia {
    detalle?: AsistenciaDetalle[] | null;
}

export interface InasistenciaAnual {
    idAlumno: number;
    cicloLectivo: number;
    ausentes: number;
    tardes: number;
    justificadas: number;
    totalInasistencias: number;
    diasRegistrados: number;
}

export interface InasistenciaPeriodo extends InasistenciaAnual {
    idPeriodo: number;
    bimestre: number;
    presentes: number;
}

export interface ResumenAsistencia {
    anuales?: InasistenciaAnual[] | null;
    porBimestre?: InasistenciaPeriodo[] | null;
}

export interface PeriodoApi {
    id: number;
    cicloLectivo: number;
    bimestre: number;
    fechaInicio: string;
    fechaFin: string;
}

export type EstadoBoletin = "borrador" | "publicado";

export interface BoletinResumen {
    idBoletin: number;
    estado: EstadoBoletin;
    idAlumno: number;
    numeroLegajo?: string;
    apellido?: string;
    nombre?: string;
    idCurso: number;
    cicloLectivo: number;
    bimestre: number;
    materiasDelCurso: number;
    materiasEnBoletin: number;
    notasCargadas: number;
    promedio?: number | null;
    materiasDesaprobadas: number;
    inasistenciasBimestre: number;
    fechaPublicacion?: string | null;
}

export interface BoletinNota {
    idBoletin: number;
    estado: EstadoBoletin;
    cicloLectivo: number;
    bimestre: number;
    idAlumno: number;
    numeroLegajo?: string;
    apellido?: string;
    nombre?: string;
    idCurso: number;
    curso?: string;
    idMateria: number;
    materia?: string;
    idProfesor?: number | null;
    profesor?: string;
    nota?: number | null;
    observacion?: string | null;
    fechaCarga?: string | null;
}

export interface BoletinDetalle {
    resumen: BoletinResumen;
    notas?: BoletinNota[] | null;
}

export interface ForoTema {
    id: number;
    idCurso?: number | null;
    titulo?: string;
    idAutor: number;
    autor?: string;
    fechaCreacion: string;
    fijado: boolean;
    cerrado: boolean;
    cantidadMensajes: number;
    ultimoMensaje?: string | null;
}

export interface ForoMensaje {
    id: number;
    idTema: number;
    tema?: string;
    idCurso?: number | null;
    idAutor: number;
    autor?: string;
    rolAutor?: string;
    idRespuestaA?: number | null;
    contenido?: string;
    fechaPublicacion: string;
    fechaEdicion?: string | null;
    eliminado: boolean;
    reportesPendientes: number;
}

export interface Reporte {
    id: number;
    idMensaje: number;
    contenidoMensaje?: string;
    idAutorMensaje: number;
    idReportante: number;
    motivo?: string;
    fecha: string;
    resuelto: boolean;
    idResueltoPor?: number | null;
}

export type ModoCoincidencia = "palabra_completa" | "contiene";

export interface Palabra {
    id: number;
    palabra?: string;
    modo: ModoCoincidencia;
    activa: boolean;
    idAgregadaPor?: number | null;
    fechaAlta: string;
}

export interface VerificacionTexto {
    permitido: boolean;
    palabra?: string | null;
}
