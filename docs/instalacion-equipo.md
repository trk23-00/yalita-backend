# Instalación del backend para el equipo

Esta guía indica qué instalar y cómo preparar una copia local del backend de Yalita después de clonar el repositorio. Los comandos deben ejecutarse desde la carpeta que contiene `package.json`.

## 1. Programas necesarios

| Programa | Requisito y propósito |
| --- | --- |
| Git | Clonar el repositorio y trabajar con los cambios del equipo. |
| Node.js | Instalar la versión **24.x**, que es la admitida por el proyecto. |
| npm | Se incluye con Node.js y permite instalar las dependencias. |
| Docker Desktop o Docker Engine | Ejecutar PostgreSQL en un contenedor. Debe estar iniciado antes de utilizar la base de datos. |

Como alternativa a Docker, se puede usar una instalación de PostgreSQL accesible y adaptar `DATABASE_URL`. No es necesario instalar PostgreSQL directamente en el equipo si se utiliza el contenedor.

Comprobar las instalaciones:

```powershell
git --version
node --version
npm --version
docker --version
```

`node --version` debe mostrar una versión que comience con `v24.`. Swagger UI, Prisma, TypeScript y Express se instalan como dependencias del proyecto; no necesitan instalación global. Postman y un administrador gráfico de PostgreSQL son opcionales.

## 2. Instalar las dependencias del repositorio

Una vez clonado el repositorio, abrir una terminal en la carpeta del backend y ejecutar:

```powershell
npm ci --include=dev
```

Este comando instala las versiones registradas en `package-lock.json`, incluidas las herramientas de desarrollo. No es necesario instalar cada paquete por separado. Los archivos `package.json` y `package-lock.json` deben estar incluidos en el repositorio; `node_modules` no se comparte porque se reconstruye con este comando.

### Dependencias de funcionamiento

| Paquete | Para qué se utiliza |
| --- | --- |
| `express` | Servidor HTTP y endpoints de la API. |
| `@prisma/client` | Consultas y operaciones sobre los modelos de la base de datos. |
| `@prisma/adapter-pg` | Adaptador de Prisma para PostgreSQL. |
| `pg` | Conexión con PostgreSQL y ejecución de las migraciones SQL. |
| `bcryptjs` | Hash y comprobación de contraseñas. |
| `jsonwebtoken` | Generación y verificación de tokens JWT. |
| `zod` | Validación de datos y configuración. |
| `dotenv` | Lectura de variables desde `.env`. |
| `cors` | Configuración de acceso desde aplicaciones web. |
| `helmet` | Cabeceras HTTP de seguridad. |
| `express-rate-limit` | Límites de solicitudes y autenticación. |
| `swagger-ui-express` | Interfaz de documentación y pruebas de la API. |

### Dependencias de desarrollo

| Paquete | Para qué se utiliza |
| --- | --- |
| `typescript` | Comprobación de tipos y compilación del backend. |
| `tsx` | Ejecución de TypeScript y reinicio automático en desarrollo. |
| `prisma` | Generación de Prisma Client e introspección de la base de datos. |
| `supertest` | Pruebas HTTP de la aplicación. |
| `@types/node` | Tipos de Node.js. |
| `@types/express` | Tipos de Express. |
| `@types/cors` | Tipos de CORS. |
| `@types/pg` | Tipos del controlador PostgreSQL. |
| `@types/jsonwebtoken` | Tipos de JWT. |
| `@types/supertest` | Tipos de las herramientas de pruebas HTTP. |
| `@types/swagger-ui-express` | Tipos de la integración de Swagger UI. |

Las versiones y rangos declarados se consultan en `package.json`. Las versiones concretas que instala el equipo se mantienen en `package-lock.json`.

## 3. Preparar PostgreSQL

Si el contenedor ya existe en el equipo, iniciarlo:

```powershell
docker start postgres_yalita_mobil_container
```

Si es la primera instalación y el contenedor no existe, crearlo con la configuración local utilizada en el proyecto:

```powershell
docker run --name postgres_yalita_mobil_container -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin -e POSTGRES_DB=yalitaDB -p 5433:5432 -d postgres
```

Ejecutar solo la opción que corresponda. La configuración utiliza la base `yalitaDB`, el usuario y contraseña locales `admin`, y el puerto `5433` del equipo. Estas credenciales corresponden a PostgreSQL; no son las credenciales de inicio de sesión de los usuarios de la app.

No es necesario crear otro contenedor si se trabaja con una base ya disponible. En ese caso, configurar su conexión en el siguiente paso.

## 4. Crear el archivo de variables de entorno

El archivo `.env` está excluido de Git, por lo que cada integrante debe crear el suyo. En PowerShell:

```powershell
Copy-Item .env.example .env
```

Hacer la copia solo si todavía no existe un `.env` local que se quiera conservar. Editarlo con estos valores para el contenedor anterior:

```dotenv
DATABASE_URL=postgresql://admin:admin@localhost:5433/yalitaDB?schema=public
PORT=3000
JWT_SECRET=REEMPLAZAR_POR_UN_SECRETO_ALEATORIO
CORS_ORIGINS=http://localhost:3000,http://localhost:8081
NODE_ENV=development
```

Generar un secreto aleatorio con este comando:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copiar el resultado como valor de `JWT_SECRET`. Debe tener al menos 32 caracteres. Cada integrante puede usar una clave diferente en su entorno local. No subir `.env` al repositorio.

Si la aplicación web utiliza otro origen, añadirlo a `CORS_ORIGINS`, separado por comas. Si PostgreSQL usa otro servidor, puerto, usuario o contraseña, actualizar `DATABASE_URL`.

## 5. Crear la estructura y generar Prisma Client

Con PostgreSQL iniciado y `.env` configurado:

```powershell
npm run db:migrate
npm run db:generate
```

El primer comando crea las tablas en una base vacía o aplica las ampliaciones pendientes a la base existente, y registra las migraciones aplicadas. La base de datos indicada en `DATABASE_URL` debe existir previamente; el contenedor del paso 3 ya crea `yalitaDB`.

El segundo comando genera el cliente de Prisma que utiliza el código. Debe ejecutarse después de instalar las dependencias y cuando se modifique el modelo de Prisma.

No es necesario importar manualmente `database/001_base.sql` en una instalación nueva: el proceso de migración ya lo ejecuta. Este proyecto administra los cambios estructurales mediante SQL versionado; no se debe sustituir el procedimiento por `prisma db push` ni `prisma migrate reset`.

La preparación de la estructura no crea usuarios de prueba. Para obtener una cuenta con contraseña válida, utilizar el endpoint de registro. Los valores de ejemplo como `$2b$12$hashdeprueba.admin` no son hashes bcrypt válidos y no permiten iniciar sesión.

## 6. Iniciar y comprobar el backend

```powershell
npm run dev
```

Con la configuración predeterminada:

- Documentación y pruebas: [Swagger UI](http://localhost:3000/api/docs).
- Estado del servidor y conexión con PostgreSQL: [Health](http://localhost:3000/health).
- Contrato de la API: [OpenAPI JSON](http://localhost:3000/api/openapi.json).

Para usar rutas protegidas desde Swagger, registrar una cuenta, iniciar sesión y pegar el token recibido en **Authorize**. Para listar todos los usuarios se necesita rol de administrador. Después de registrar la cuenta que tendrá ese rol, se puede asignar localmente con:

```powershell
npm run admin:set -- correo@ejemplo.com
```

## 7. Comandos de trabajo y verificación

| Comando | Uso |
| --- | --- |
| `npm run dev` | Iniciar el servidor durante el desarrollo. |
| `npm run build` | Comprobar tipos y generar la versión compilada en `dist`. |
| `npm start` | Ejecutar la versión compilada; requiere haber ejecutado `npm run build`. |
| `npm test` | Ejecutar pruebas de integración con PostgreSQL. |
| `npm run db:migrate` | Aplicar los scripts SQL pendientes. |
| `npm run db:generate` | Generar Prisma Client. |
| `npm run db:introspect` | Actualizar los modelos de Prisma a partir de la estructura real de PostgreSQL. |
| `npm run docs:export` | Regenerar `docs/openapi.json` y `docs/endpoints.md`. |

Las pruebas necesitan una conexión PostgreSQL cuyo usuario pueda crear esquemas. Crean y eliminan un esquema temporal propio; no borran los registros del esquema `public`.

## 8. Problemas frecuentes al preparar el entorno

| Problema | Qué revisar |
| --- | --- |
| La versión de Node.js no es compatible | Utilizar Node.js 24.x y volver a instalar dependencias. |
| `npm ci` indica diferencias con el archivo de bloqueo | Comprobar que se clonaron las versiones correspondientes de `package.json` y `package-lock.json`. Si se modificaron dependencias intencionalmente, quien realiza el cambio debe actualizar y compartir ambos archivos. |
| Docker no responde | Iniciar Docker Desktop o el servicio de Docker. |
| El puerto 5433 está ocupado | Revisar si el contenedor ya existe. Si se utiliza otro puerto, cambiar también `DATABASE_URL`. |
| No se puede conectar a PostgreSQL | Comprobar que el contenedor está iniciado y que coinciden servidor, puerto, usuario, contraseña y base. |
| Prisma Client no está generado | Ejecutar `npm run db:generate`. |
| Faltan tablas o campos | Ejecutar `npm run db:migrate`. |
| Se requiere un token Bearer | Iniciar sesión y autorizar Swagger con el token. |
| La API devuelve un error de configuración | Revisar `.env`, especialmente `DATABASE_URL` y la longitud de `JWT_SECRET`. |
