# Endpoints de Yalita

Base: `/api/v1`. Todas las rutas requieren Bearer JWT salvo registro y login. IDs como cadenas decimales. Los detalles de cuerpos, respuestas y errores están en OpenAPI y Swagger.

| Método | Endpoint | Operación |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | Registrar usuario |
| POST | `/api/v1/auth/login` | Iniciar sesión |
| POST | `/api/v1/auth/logout` | Cerrar e invalidar la sesión actual |
| GET | `/api/v1/usuarios` | Listar usuarios (administrador) |
| GET | `/api/v1/usuarios/{id}` | Consultar usuario |
| PUT | `/api/v1/usuarios/{id}` | Actualizar usuario propio o como administrador |
| DELETE | `/api/v1/usuarios/{id}` | Eliminar cuenta propia o como administrador |
| GET | `/api/v1/perfiles/{usuario_id}` | Consultar perfil de usuario |
| POST | `/api/v1/perfiles` | Crear perfil |
| PUT | `/api/v1/perfiles/{id}` | Actualizar perfil propio |
| DELETE | `/api/v1/perfiles/{id}` | Eliminar perfil propio |
| GET | `/api/v1/recomendaciones` | Listar recomendaciones propias |
| GET | `/api/v1/recomendaciones/{id}` | Consultar recomendación propia |
| POST | `/api/v1/recomendaciones/generar` | Regenerar recomendaciones propias |
| POST | `/api/v1/interacciones` | Registrar like o dislike |
| GET | `/api/v1/interacciones` | Listar interacciones propias |
| GET | `/api/v1/interacciones/{id}` | Consultar interacción propia |
| DELETE | `/api/v1/interacciones/{id}` | Eliminar interacción propia |
| GET | `/api/v1/matches` | Listar matches propios |
| POST | `/api/v1/matches` | Obtener o crear match con likes mutuos |
| GET | `/api/v1/matches/{id}` | Consultar match como participante |
| DELETE | `/api/v1/matches/{id}` | Eliminar match como participante |
| GET | `/api/v1/matches/{match_id}/mensajes` | Consultar mensajes como participante |
| POST | `/api/v1/matches/{match_id}/mensajes` | Enviar mensaje como participante |
| GET | `/api/v1/mensajes/{id}` | Consultar mensaje como participante |
| DELETE | `/api/v1/mensajes/{id}` | Eliminar mensaje enviado por uno mismo |
| POST | `/api/v1/mensajes-anonimos` | Enviar mensaje anónimo |
| GET | `/api/v1/mensajes-anonimos` | Listar mensajes anónimos recibidos |
| GET | `/api/v1/mensajes-anonimos/{id}` | Consultar mensaje como remitente o destinatario |
| PATCH | `/api/v1/mensajes-anonimos/{id}/revelar` | Revelar identidad propia como remitente |
| POST | `/api/v1/reportes` | Reportar a otro usuario |
| GET | `/api/v1/reportes` | Listar reportes (administrador) |
| GET | `/api/v1/reportes/{id}` | Consultar reporte como autor o administrador |
| PATCH | `/api/v1/reportes/{id}` | Actualizar estado (administrador) |
| GET | `/api/v1/notificaciones` | Listar notificaciones propias |
| GET | `/api/v1/notificaciones/{id}` | Consultar notificación propia |
| DELETE | `/api/v1/notificaciones/{id}` | Eliminar notificación propia |
| PATCH | `/api/v1/notificaciones/{id}/leida` | Marcar notificación propia como leída |
