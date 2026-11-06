# Plataforma 24 — Frontend

Plataforma educativa de la **Escuela Técnica N°24 "Defensa de Buenos Aires"**. Reúne en un solo lugar el trabajo diario de alumnos, docentes, preceptores y autoridades: materias, tareas y entregas, material de estudio, calificaciones, asistencia, boletines bimestrales, legajos y un foro moderado.

---

## Índice

- [Funcionalidades por rol](#funcionalidades-por-rol)
- [Stack](#stack)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Scripts](#scripts)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Arquitectura](#arquitectura)
- [Roles y paneles](#roles-y-paneles)
- [Backend](#backend)
- [Despliegue](#despliegue)
- [Limitaciones conocidas](#limitaciones-conocidas)

---

## Funcionalidades por rol

### Alumno (`/dashboard`)
- **Inicio**: resumen de tareas próximas y novedades.
- **Materias**: tarjetas con docente, curso y aula; detalle de cada materia con su material y sus tareas.
- **Material de estudio** (`/material/[id]`): descripción, adjuntos con visor integrado y contacto con el docente.
- **Tareas**: listado y calendario táctil, entrega con archivos adjuntos y anulación de la entrega.
- **Calificaciones**: notas de entregas y boletines publicados por bimestre.
- **Cursos**: compañeros y datos del curso.
- **Foro**: temas del curso y generales, mensajes, respuestas y reportes.
- **Perfil**: datos personales (nombre, DNI, teléfono, dirección, fecha de nacimiento) y cambio de contraseña.

### Docente (`/docente`)
- Materias propias y alta de materias (`/docente/materias/nueva`).
- Tareas: alta, edición, detalle de entregas y corrección (`/docente/tareas/[id]/corregir`), vista "por corregir".
- Material didáctico con adjuntos.
- Carga de notas.
- Foro con permisos de moderación.

### Preceptoría y autoridades (`/preceptoria`)
- **Asistencia**: abrir la planilla diaria por curso, marcar presente/ausente/tarde/justificado y cerrarla.
- **Boletines**: generar por alumno o por curso, cargar notas por materia y publicar.
- **Legajos**: ficha de cada alumno con datos personales, asistencia y boletines.
- **Lista de curso**, **gestión de cursos** (alta, edición, baja y asignación de alumnos sin curso) y **usuarios**.
- **Moderación del foro**: reportes pendientes y palabras prohibidas.

### Administración (`/admin`)
- Usuarios (rol, curso, email, blanqueo de contraseña), materias y acceso a todos los paneles.

Común a todos: modo claro/oscuro, diseño responsive con menú inferior en el celular, páginas 404/error propias y visor de archivos (PDF, DOCX, imágenes, video y texto/código).

---

## Stack

| Área | Tecnología |
|---|---|
| Framework | **Next.js 16** (App Router) + **React 19** |
| Lenguaje | TypeScript 5 (modo estricto) |
| Estilos | Tailwind CSS 4, `next-themes` para el tema claro/oscuro |
| Animaciones | `framer-motion` |
| Iconos | `@heroicons/react` |
| Sesión | JWT del backend guardado en una cookie con `cookies-next` |
| Visor de archivos | `pdfjs-dist` (PDF) y `docx-preview` (Word) |
| Gestor de paquetes | **pnpm** |

---

## Puesta en marcha

Requisitos: **Node.js 20+**, **pnpm** y el backend corriendo (por defecto en `https://localhost:7070`).

```bash
pnpm install          # el postinstall copia el worker de pdf.js a public/
# crear .env con NEXT_PUBLIC_API_BASE_URL (ver abajo)
pnpm dev              # http://localhost:3000
```

> En desarrollo el backend usa un certificado HTTPS de desarrollo. Si el navegador no confía en él, `fetch` falla con "No se pudo conectar con el servidor": abrir una vez `https://localhost:7070/swagger` y aceptar el certificado, o ejecutar `dotnet dev-certs https --trust`.

---

## Variables de entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | URL base de la API, sin barra final | `https://localhost:7070` |

Al ser `NEXT_PUBLIC_*`, el valor se **incrusta en el bundle durante `next build`**: hay que definirlo antes de compilar para cada entorno; cambiarlo después no tiene efecto.

---

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm start` | Sirve el build de producción |
| `pnpm lint` | ESLint (config de Next) |
| `postinstall` | `scripts/copiar-worker-pdf.mjs`: copia `pdf.worker.min.mjs` a `public/` para que la versión del worker coincida siempre con la de `pdfjs-dist` |

---

## Estructura del proyecto

```
app/
├── (panel)/            Panel del alumno (grupo de rutas: no aparece en la URL)
│   ├── dashboard/      Inicio y perfil
│   ├── materias/       Listado y detalle de materias
│   ├── material/[id]/  Detalle de un material de estudio
│   ├── tareas/         Listado, calendario y entrega
│   ├── calificaciones/
│   ├── cursos/
│   └── foro/           Temas y mensajes
├── docente/            Panel docente (materias, tareas, corrección, materiales, notas, foro)
├── preceptoria/        Panel de preceptoría/autoridades (asistencia, boletines, legajos, cursos, usuarios, moderación, foro)
├── admin/              Panel de administración (usuarios, materias)
├── login/, registro/   Pantallas públicas
├── components/         Componentes compartidos (navbar, modal, formularios, visor de archivos, foro, usuarios…)
├── lib/                Lógica sin UI
│   ├── apiClient.ts    Cliente HTTP y todos los endpoints de la API agrupados por recurso
│   ├── sesion.ts       Perfil, rol → panel, utilidades de cursos y ciclo lectivo
│   ├── types.ts        Tipos de las respuestas de la API
│   ├── periodos.ts     Bimestres y fechas (en hora local)
│   └── …               format, legajo, alumnos, datos-personales, api-utils
├── layout.tsx          Layout raíz (fuentes, tema)
├── page.tsx            Portada pública
├── not-found.tsx, error.tsx
public/                 Imágenes de la escuela, escudo y fuentes Libertinus
scripts/                Scripts de instalación
wireframes/             Maquetas HTML de las pantallas
data/db.json            Datos de ejemplo del prototipo inicial (no lo usa la app)
```

Convención de las páginas: `page.tsx` es delgado y delega en un `*-view.tsx` (componente cliente con la UI) y, cuando hace falta, en un `cargar-*.ts` con la carga y combinación de datos.

---

## Arquitectura

- **SPA sobre App Router.** Las pantallas son componentes cliente (`"use client"`) que consumen la API directamente desde el navegador. No hay rutas `app/api` ni Server Actions: Next sirve la UI y el backend concentra datos y permisos.
- **`lib/apiClient.ts`** es el único punto de contacto con el backend:
  - agrega `Authorization: Bearer <token>` desde la cookie `token`;
  - serializa a JSON los objetos y deja pasar `FormData`/`Blob` (subida de archivos);
  - convierte errores en `ApiError` (status `0` = sin conexión) y extrae el mensaje del cuerpo (`ProblemDetails`, `{ mensaje }` o texto plano). `mensajeDeError()` solo muestra al usuario los mensajes de 400/409/422;
  - ante un **401** borra la cookie, vacía las cachés en memoria registradas con `alCambiarSesion()` y redirige a `/login`.
- **Sesión.** El login guarda el JWT en la cookie `token` (7 días, `SameSite=Lax`, `Secure` bajo HTTPS). Cada layout de panel llama a `/auth/profile` al montarse y decide si el usuario puede entrar o lo manda a su panel. Esta protección es solo de navegación: **la autorización real la hace la API**.
- **Archivos.** Se suben a `/archivos` como `multipart/form-data` y luego se vinculan a tareas, materiales o entregas. Se descargan como `Blob` autenticado (`apiBlob`) y se muestran en `components/visor-archivos.tsx`.

---

## Roles y paneles

| `idRol` | Rol | Panel | Acceso al resto de los paneles |
|---|---|---|---|
| 1 | Alumno | `/dashboard` | No |
| 2 | Profesor | `/docente` | No |
| 3 | Autoridad | `/preceptoria` | No |
| 4 | AdminAlumno | `/preceptoria` | Sí |
| 5 | AdminProfesor | `/preceptoria` | Sí |
| 6 | Admin | `/preceptoria` | Sí |
| 7 | Preceptor | `/preceptoria` | No |

La correspondencia está en `lib/sesion.ts` (`PAPEL_POR_ROL`, `ROLES_ADMIN`, `ROLES_ALUMNO`). Los roles 1 y 4 cuentan como alumnos de un curso.

> En el backend, `RolIds.EsAdmin` abarca los roles **3 a 6**: la Autoridad tiene permisos de administrador en la API aunque en la interfaz se quede en `/preceptoria`.

### Contraseñas

- **Cambiar la contraseña:** desde *Mi perfil* (todos los roles), con la contraseña actual (`POST /auth/cambiar-password`).
- **Olvido, sin envío de mail:** un administrador entra al detalle del usuario y elige *Blanquear contraseña* (`POST /usuarios/{id}/blanquear-password`). Las cuentas administrativas solo las blanquea el Admin general (rol 6). Cuando el usuario intenta iniciar sesión, el login responde 409 y la pantalla le pide su **número de legajo** y una contraseña nueva (`POST /auth/crear-password`). El legajo funciona como verificación: con el email solo no alcanza para tomar la cuenta.

---

## Backend

`../plataforma24_backend`: **.NET 10**, ASP.NET Core Web API con controllers, servicios, repositorios y unidad de trabajo. Usa **PostgreSQL** con EF Core 10 (Npgsql), JWT Bearer, BCrypt, políticas de autorización por rol, rate limiting por usuario y por IP, y un endpoint GraphQL en `/graphql`. Swagger queda disponible en `https://localhost:7070/swagger` en el entorno `Development`. La configuración sensible (cadena de conexión y `Jwt__Key`) se toma de `.env`; ver `.env.example`.

Parte de la lógica de negocio (generación de boletines, apertura de asistencia, filtro de palabras prohibidas, legajos y las vistas `v_*`) está implementada en **funciones, vistas y triggers de PostgreSQL**. Esa lógica se conserva con el backup de la base (`pg_dump`), porque no está versionada en el repo.

---

## Despliegue

1. Definir `NEXT_PUBLIC_API_BASE_URL` con la URL pública de la API (HTTPS).
2. `pnpm install --frozen-lockfile && pnpm build && pnpm start` (o desplegar en Vercel o un contenedor Node).
3. La API acepta hoy cualquier origen por CORS. En producción conviene limitarla al dominio del frontend.

Como la app es 100% cliente, también se puede servir detrás de un proxy inverso (nginx, Caddy) en el mismo dominio que la API.

---

## Limitaciones conocidas

- No hay tests automatizados.
- La protección de rutas es solo del lado del cliente (no hay `middleware`/`proxy` de Next), así que el código de todos los paneles se descarga aunque el usuario no pueda usarlos.
- El token se guarda en una cookie accesible desde JavaScript (no `httpOnly`).
- Se versionan dos lockfiles (`package-lock.json` y `pnpm-lock.yaml`); el gestor oficial es pnpm.
- Los JWT duran 7 días y no se revocan: cambiar o blanquear una contraseña no cierra las sesiones ya abiertas en otros dispositivos.
