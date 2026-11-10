# Informe de implementación del backend de Yalita

Fecha: 10 de noviembre de 2026.

## Objetivo y alcance

Se desarrolló una API REST para Yalita, una aplicación de mensajería y coincidencias similar a Tinder. El backend permite administrar usuarios y perfiles, registrar interacciones, generar matches, intercambiar mensajes y gestionar reportes y notificaciones.

La implementación tomó como base el esquema PostgreSQL de `yalita_boo.sql` y los 38 endpoints definidos en `listaDeEndPoints.docx`. Se conectó la API a la base de datos existente y se añadieron los elementos necesarios para completar las operaciones solicitadas.

## Tecnologías utilizadas

| Tecnología o herramienta | Uso en el proyecto |
| --- | --- |
| Node.js 24 | Ejecutar el backend y las herramientas de desarrollo. |
| TypeScript | Desarrollar el código con comprobación de tipos y compilarlo a JavaScript. |
| Express 5 | Definir rutas, recibir solicitudes HTTP y devolver respuestas JSON. |
| PostgreSQL | Almacenar los usuarios, perfiles, interacciones, matches y demás información. |
| Docker | Ejecutar PostgreSQL en el contenedor existente proporcionado por el usuario. |
| Prisma 7 y Prisma Client | Representar las tablas mediante modelos y realizar consultas desde el backend. |
| `@prisma/adapter-pg` y `pg` | Conectar Prisma con PostgreSQL y ejecutar el proceso de migraciones SQL. |
| Zod | Validar cuerpos de solicitudes, identificadores, paginación y variables de entorno. |
| bcryptjs | Generar y comprobar hashes de contraseñas. |
| JSON Web Token y `jsonwebtoken` | Emitir y comprobar los tokens de autenticación. |
| dotenv | Cargar la configuración desde las variables del archivo `.env`. |
| cors | Configurar los orígenes web que pueden consumir la API desde un navegador. |
| Helmet | Incorporar cabeceras HTTP de seguridad. |
| express-rate-limit | Limitar la frecuencia de solicitudes y los intentos de autenticación. |
| OpenAPI 3.0.3 | Describir el contrato de la API: rutas, parámetros, cuerpos, respuestas y errores. |
| Swagger UI | Mostrar documentación interactiva y permitir probar endpoints desde el navegador. |
| tsx | Ejecutar TypeScript durante el desarrollo y reiniciar el servidor al guardar cambios. |
| Node Test Runner y Supertest | Ejecutar pruebas de integración mediante solicitudes HTTP a la aplicación. |
| npm | Administrar dependencias y ejecutar los comandos del proyecto. |

Express gestiona el funcionamiento de la API. La interfaz visible en `/api/docs` corresponde a Swagger UI, incorporada al proyecto para consultar y probar los servicios; no es la interfaz de la aplicación móvil.

## Trabajo realizado

### Preparación del proyecto

Se organizó el código en módulos de autenticación, usuarios y perfiles, funciones sociales, mensajes y moderación. Se configuraron TypeScript, los comandos de desarrollo y compilación, la carga de variables de entorno y la exclusión de archivos locales como `.env` y `node_modules` mediante `.gitignore`.

Se estableció `/api/v1` como prefijo de los endpoints funcionales. Las respuestas usan JSON y códigos HTTP según el resultado de la operación. Se centralizó el manejo de errores y se incorporó paginación en las consultas de listas.

### Conexión y ampliación de la base de datos

Se utilizó el contenedor existente `postgres_yalita_mobil_container`, creado con la imagen de PostgreSQL. La configuración local conecta el backend con estos valores:

| Parámetro | Valor |
| --- | --- |
| Servidor | `localhost` |
| Puerto del equipo | `5433` |
| Puerto interno del contenedor | `5432` |
| Base de datos | `yalitaDB` |
| Usuario PostgreSQL | `admin` |
| Esquema | `public` |
| Puerto de la API | `3000` |

La contraseña de conexión se guarda en `.env`, junto con la clave JWT y los orígenes CORS permitidos. La clave JWT local se generó aleatoriamente.

Se conservaron las nueve tablas originales: `usuarios`, `perfiles`, `recomendaciones`, `interacciones`, `matches`, `chats`, `mensajesanonimos`, `reportes` y `notificaciones`.

Para completar los endpoints se añadieron:

- `reportes.estado`, con los valores `pendiente`, `revisado`, `resuelto` y `rechazado`.
- `notificaciones.leida`, para registrar si una notificación ya fue leída.
- Un índice único sobre `perfiles.usuario_id`, para permitir un perfil por usuario.
- La tabla `sesiones`, con vencimiento y revocación de sesiones.
- La tabla técnica `api_migrations`, para registrar las migraciones aplicadas.

Se incorporó un proceso de migración SQL versionado, transaccional y con bloqueo para impedir aplicaciones simultáneas. Su ejecución reconoce las migraciones ya aplicadas y evita repetirlas. Prisma se utilizó para consultar y modificar registros; las modificaciones estructurales se gestionan con los scripts SQL, conservando las restricciones y el índice funcional de matches del esquema original.

### Implementación de los módulos

| Módulo | Endpoints | Funcionalidad implementada |
| --- | --- | --- |
| Autenticación y usuarios | 7 | Registro, inicio y cierre de sesión, consulta, actualización y eliminación de usuarios. |
| Perfiles | 4 | Creación, consulta, actualización y eliminación de perfiles, intereses, gustos y preferencias. |
| Recomendaciones | 3 | Generación y consulta de recomendaciones para el usuario autenticado. |
| Interacciones | 4 | Registro, consulta y eliminación de acciones `like` y `dislike`. |
| Matches | 4 | Consulta, creación y eliminación de coincidencias entre usuarios. |
| Chats y mensajes | 4 | Envío, consulta y eliminación de mensajes asociados a un match. |
| Mensajes anónimos | 4 | Envío y consulta de mensajes, con revelación voluntaria de identidad. |
| Reportes | 4 | Registro de denuncias, consulta y actualización administrativa de su estado. |
| Notificaciones | 4 | Consulta, marcado como leída y eliminación de notificaciones. |
| **Total** | **38** | **Endpoints del documento proporcionado.** |

También se añadieron las rutas de soporte `/health`, `/api/docs` y `/api/openapi.json`, que no forman parte de esos 38 endpoints.

### Autenticación y permisos

Las contraseñas se almacenan como hashes. El inicio de sesión devuelve un JWT con duración de 24 horas y crea una sesión persistente. Cerrar sesión revoca la sesión actual; cambiar la contraseña revoca todas las sesiones del usuario.

El registro crea usuarios normales sin verificar. Solo un administrador puede asignar roles o cambiar el estado de verificación. Se añadió un comando local para designar al administrador inicial, sin exponer una ruta pública para obtener ese permiso.

Se restringieron las operaciones según el propietario del recurso y el rol. Los usuarios normales no pueden listar todos los usuarios ni administrar reportes. Los chats están disponibles únicamente para sus participantes, incluso si otro usuario tiene rol de administrador. Los hashes de contraseña no se devuelven en las respuestas; el correo y las fotos de identificación solo se muestran al propietario o al administrador.

### Reglas de funcionamiento adoptadas

El documento de endpoints no detallaba todas las reglas de negocio. Se implementaron estas decisiones iniciales, que pueden ajustarse al comportamiento deseado de la aplicación:

- La última interacción en cada dirección determina el interés. Dos likes mutuos crean automáticamente un match y notificaciones para ambos usuarios.
- La creación de matches usa transacciones y bloqueos por pareja para evitar duplicados ante solicitudes simultáneas.
- Eliminar un match elimina sus mensajes y las interacciones previas entre ambos usuarios. Para coincidir de nuevo se necesitan nuevas interacciones.
- Solo el autor puede eliminar un mensaje de chat.
- El destinatario de un mensaje anónimo no recibe el identificador del remitente hasta que este decida revelar su identidad. Solo el remitente puede autorizar esa revelación.
- Las recomendaciones comparan términos de intereses, gustos y preferencias. Excluyen al propio usuario, las interacciones previas y los matches existentes; evalúan hasta 1000 perfiles y guardan los mejores 100.
- Las notificaciones se generan para nuevos matches, mensajes de chat y mensajes anónimos. Cada usuario solo puede gestionar las suyas.
- La eliminación de cuentas es física y aplica las cascadas definidas en el SQL original.

## Documentación y archivos entregados

| Archivo o carpeta | Contenido |
| --- | --- |
| `src/` | Código de la API, módulos, configuración, conexión y documentación OpenAPI. |
| `prisma/schema.prisma` | Modelos que representan la estructura de PostgreSQL. |
| `prisma.config.ts` | Configuración de Prisma. |
| `database/001_base.sql` | Copia del esquema SQL proporcionado. |
| `database/002_api.sql` | Ampliaciones necesarias para la API. |
| `scripts/` | Migraciones, asignación de administrador y exportación de documentación. |
| `tests/api.test.ts` | Pruebas de integración de los endpoints y permisos. |
| `.env.example` | Ejemplo de variables necesarias para configurar el proyecto. |
| `README.md` | Instrucciones de instalación, ejecución, integración y reglas del backend. |
| `docs/endpoints.md` | Listado resumido de los 38 endpoints. |
| `docs/openapi.json` | Contrato de API para Swagger y herramientas como Postman. |

## Verificaciones realizadas durante la implementación

Se comprobó la conexión con PostgreSQL, se aplicó la ampliación de la base y se verificó que repetir el comando de migración no volviera a aplicar los cambios.

La compilación con `npm run build` finalizó correctamente. Las pruebas ejecutadas con `npm test` aprobaron los ocho casos reportados por el ejecutor: una prueba principal y siete subpruebas, con recorridos exitosos por los 38 endpoints. Se comprobaron validaciones, permisos, privacidad, likes simultáneos, anonimato, eliminación en cascada y revocación de sesiones.

Las pruebas utilizaron un esquema temporal separado del esquema `public`, que se eliminó al finalizar. También se verificó el arranque de la versión compilada y las respuestas HTTP correctas de `/health`, Swagger y el contrato OpenAPI. La revisión de dependencias realizada al terminar la implementación no reportó vulnerabilidades.

Estos resultados corresponden a las comprobaciones de la implementación inicial; no sustituyen las pruebas de integración posteriores con la aplicación móvil ni una evaluación de carga o de seguridad independiente.

## Ejecución y alcance actual

Para iniciar el backend durante el desarrollo:

```powershell
npm run dev
```

Una vez iniciado, la documentación interactiva está disponible en [Swagger UI](http://localhost:3000/api/docs).

El trabajo realizado corresponde al backend REST. La interfaz móvil y su integración se desarrollan por separado. Los mensajes y notificaciones se consultan mediante HTTP; no se implementaron WebSockets ni notificaciones push. Los campos de fotos aceptan URLs, sin un servicio de carga de archivos ni verificación automática de documentos. Tampoco se realizó un despliegue de producción.
