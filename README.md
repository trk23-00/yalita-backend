# Yalita API REST

Backend para una aplicación de mensajería y coincidencias. Implementa los 38 endpoints del documento proporcionado, con Express 5, TypeScript, Prisma 7 y PostgreSQL. Usa Zod para validar datos, bcrypt para contraseñas y JWT con sesiones persistentes para poder cerrar sesión de forma efectiva.

## Inicio

Se requiere Node.js 24 y PostgreSQL accesible. El contenedor existente `postgres_yalita_mobil_container` publica PostgreSQL en el puerto **5433** del equipo. No necesitas crear otro contenedor.

La conexión local configurada en `.env` es:

```dotenv
DATABASE_URL=postgresql://admin:admin@localhost:5433/yalitaDB?schema=public
PORT=3000
```

El archivo `.env` local ya contiene una clave JWT aleatoria. No se incluye en Git. Para otra instalación, copia `.env.example` a `.env` y reemplaza `JWT_SECRET` por un secreto aleatorio de al menos 32 caracteres. Configura `CORS_ORIGINS` con los orígenes de tu aplicación web, separados por comas.

```powershell
npm ci
npm run db:migrate
npm run db:generate
npm run dev
```

Documentación interactiva: [Swagger](http://localhost:3000/api/docs). Contrato JSON: [OpenAPI](http://localhost:3000/api/openapi.json). Comprobación de conexión: [Health](http://localhost:3000/health).

Para compilar y ejecutar:

```powershell
npm run build
npm start
```

## Base de datos

`database/001_base.sql` es una copia del archivo SQL suministrado. `database/002_api.sql` añade:

- `reportes.estado`: pendiente, revisado, resuelto o rechazado.
- `notificaciones.leida`: inicialmente falso.
- Un índice único para permitir un perfil por usuario.
- `sesiones`: identifica sesiones, su vencimiento y revocación.

El comando `db:migrate` conserva las tablas existentes. Si ya existe `usuarios`, registra la base original como aplicada y ejecuta la ampliación. Si la base está vacía, crea primero las nueve tablas. Registra las migraciones en `api_migrations`, usa una transacción y un bloqueo para impedir aplicaciones simultáneas. Si hay perfiles duplicados, la ampliación falla sin eliminar datos: deben resolverse antes de repetirla.

Las migraciones se gestionan con SQL versionado para conservar los `CHECK` y el índice funcional de pares de matches del esquema original. No usar `prisma db push` ni `prisma migrate reset` para esta base. Después de futuros cambios SQL, ejecutar `npm run db:introspect` y `npm run db:generate` para actualizar Prisma.

## Uso desde la app

Todos los endpoints funcionales comienzan con `/api/v1`. Solo registro y login son públicos. En las demás solicitudes enviar:

```http
Authorization: Bearer TOKEN
Content-Type: application/json
```

Los identificadores se envían y reciben como cadenas decimales, por ejemplo `"12"`, porque PostgreSQL usa BIGINT. No convertirlos a números en el cliente. Las fechas se devuelven como cadenas ISO 8601. Las listas aceptan `?page=1&limit=20`, con límite máximo de 100; la respuesta es un arreglo. Las operaciones DELETE y logout exitosas responden 204 sin cuerpo. Los errores contienen `error` y, para validaciones, `detalles`.

Ejemplo en PowerShell:

```powershell
$base = 'http://localhost:3000/api/v1'
$registro = @{ nombre = 'Ana'; email = 'ana@example.com'; password = 'MiClaveSegura123' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body $registro
$credenciales = @{ email = 'ana@example.com'; password = 'MiClaveSegura123' } | ConvertTo-Json
$sesion = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $credenciales
$cabeceras = @{ Authorization = "Bearer $($sesion.token)" }
$perfil = @{ informacion = 'Me gusta conocer gente'; intereses = @('música', 'cine') } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/perfiles" -Headers $cabeceras -ContentType 'application/json' -Body $perfil
Invoke-RestMethod -Uri "$base/matches" -Headers $cabeceras
```

Para un móvil físico, usar la IP local del equipo en lugar de `localhost`, con ambos dispositivos en la misma red. En el emulador Android habitual se usa `http://10.0.2.2:3000`. La API escucha en todas las interfaces. El móvil se comunica con la API en el puerto 3000; la conexión al puerto 5433 la realiza únicamente el backend.

## Reglas implementadas

- Registro siempre crea un usuario normal sin verificar; no permite enviar roles ni contraseñas ya hasheadas. El login devuelve un JWT válido durante 24 horas. Logout revoca la sesión actual; cambiar contraseña revoca todas las sesiones del usuario.
- Solo el propietario o un administrador puede actualizar o eliminar una cuenta o perfil. Eliminar una cuenta es una eliminación física con las cascadas del SQL original. Los demás usuarios solo ven ID, nombre y estado de verificación; nunca correo, fotos de documentos o hash de contraseña.
- `foto_credencial` y `foto_carnet` reciben URLs. No se implementa almacenamiento o carga de archivos, ni verificación automática de documentos. Solo un administrador puede cambiar `verificado` o `tipo_usuario`.
- Cada usuario tiene como máximo un perfil. El GET de perfil recibe el ID del usuario; PUT y DELETE reciben el ID del perfil. Los PUT aceptan los campos modificables presentes y conservan los omitidos.
- Las interacciones admiten `like` y `dislike`. La última acción en cada dirección determina el interés. Dos likes mutuos crean un match y una notificación para cada participante. Los pares se bloquean durante la transacción para impedir matches duplicados ante solicitudes simultáneas.
- `POST /matches` recibe `usuario2_id` y requiere likes mutuos. Devuelve el match existente o lo crea. Un dislike posterior no elimina un match; para terminarlo se usa DELETE. No se puede eliminar una interacción mientras exista ese match.
- Eliminar un match elimina sus chats y las interacciones previas entre esas dos personas. Para volver a coincidir se necesitan nuevas interacciones.
- Solo participantes pueden consultar y enviar mensajes de un match; solo quien envió un mensaje puede eliminarlo. Los administradores no tienen acceso automático a chats privados.
- Mensajes anónimos: el destinatario no recibe `remitente_id` hasta que el remitente decida revelar su identidad. Solo el remitente puede hacerlo; el destinatario no puede forzar la revelación. El POST devuelve el ID del mensaje al remitente para que pueda revelarlo después.
- Solo administradores listan todos los usuarios y reportes o cambian el estado de un reporte. Un usuario puede consultar sus propios reportes. El denunciado no puede conocer la identidad de quien lo reportó a través de estos endpoints.
- Cada usuario accede únicamente a sus notificaciones. Se generan para nuevos matches, mensajes de chat y mensajes anónimos. Marcar como leída es idempotente.
- Las recomendaciones requieren perfil. Se compara la proporción de términos compartidos entre los intereses, gustos y preferencias propios y los intereses y gustos del candidato, ignorando mayúsculas. Se excluyen el propio usuario, las personas con interacciones previas y los matches existentes. Se evalúan hasta 1000 perfiles por ID y se guardan los mejores 100 con puntuación de 0 a 100. Es una regla inicial, sin inferencia de edad, género o ubicación, porque esos campos no existen en el esquema. Cada generación reemplaza las recomendaciones anteriores.

Estas reglas completan las decisiones que el documento no especificaba y se pueden ajustar según la experiencia deseada en la app. Los chats funcionan mediante REST: la app consulta mensajes y notificaciones; WebSockets y notificaciones push no forman parte de estos 38 endpoints.

## Administrador inicial

Registrar primero una cuenta y luego ejecutar localmente:

```powershell
npm run admin:set -- correo@ejemplo.com
```

No existe una contraseña de administrador predeterminada ni un endpoint público para asignarse ese rol.

## Pruebas

```powershell
npm test
```

Las pruebas crean un esquema temporal con nombre aleatorio en PostgreSQL, ejecutan los 38 endpoints y comprueban validaciones, permisos, privacidad, likes simultáneos, cascadas y revocación de sesiones. Eliminan solo ese esquema al finalizar. Necesitan que el usuario PostgreSQL pueda crear esquemas. No usan ni borran registros del esquema `public`.

El contrato está en `docs/openapi.json` y puede importarse en Postman. Se regenera con `npm run docs:export`; la fuente compartida con Swagger es `src/openapi.ts`. El listado resumido está en `docs/endpoints.md`.
