type Schema = Record<string, unknown>;
const str = (example?: string): Schema => ({ type: 'string', ...(example ? { example } : {}) });
const identifier = { type: 'string', pattern: '^[1-9][0-9]*$', example: '1', description: 'BIGINT como cadena decimal para evitar pérdida de precisión en JavaScript.' };
const boolean = { type: 'boolean' };
const date = { type: 'string', format: 'date-time' };
const nullableText = { type: 'string', nullable: true };
const fields = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const input = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ ...fields(properties, required), additionalProperties: false });
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const array = (schema: Schema): Schema => ({ type: 'array', items: schema });
const enumString = (values: string[]): Schema => ({ type: 'string', enum: values });
const message = { type: 'string', minLength: 1, maxLength: 2000, example: 'Hola, ¿cómo estás?' };
const email = { type: 'string', format: 'email', maxLength: 254, example: 'ana@example.com' };
const password = { type: 'string', minLength: 8, maxLength: 72, example: 'MiClaveSegura123', description: 'Máximo 72 bytes UTF-8.' };
const profileFields = { informacion: nullableText, intereses: array(str('música')), gustos: array(str('cine')), preferencias: array(str('deporte')) };
const matchSchema = fields({ id: identifier, usuario1_id: identifier, usuario2_id: identifier, fecha_match: date });
const schemas: Record<string, Schema> = {
  Error: fields({ error: str('Descripción del error'), detalles: array(fields({ campo: str(), mensaje: str() })) }, ['error']),
  UsuarioPublico: fields({ id: identifier, nombre: str('Ana'), verificado: boolean }),
  Usuario: fields({ id: identifier, nombre: str('Ana'), email, verificado: boolean, foto_credencial: nullableText, foto_carnet: nullableText, tipo_usuario: nullableText }),
  Login: fields({ token: str(), token_type: str('Bearer'), expires_in: { type: 'integer', example: 86400 }, usuario: ref('Usuario') }),
  Perfil: fields({ id: identifier, usuario_id: identifier, ...profileFields }),
  Recomendacion: fields({ id: identifier, usuario_id: identifier, recomendado_id: identifier, compatibilidad: { type: 'number', minimum: 0, maximum: 100, nullable: true } }),
  Interaccion: fields({ id: identifier, usuario_id: identifier, interactuado_id: identifier, tipo_interaccion: enumString(['like', 'dislike']) }),
  Match: matchSchema,
  InteraccionResultado: fields({ interaccion: ref('Interaccion'), match: { ...matchSchema, nullable: true } }),
  Mensaje: fields({ id: identifier, match_id: identifier, enviado_por: identifier, mensaje: message, fecha_envio: date }),
  MensajeAnonimo: fields({ id: identifier, remitente_id: { ...identifier, description: 'Se omite para el destinatario mientras revelado sea false.' }, destinatario_id: identifier, mensaje: message, revelado: boolean }),
  Reporte: fields({ id: identifier, reportado_id: identifier, reportado_por: identifier, razon: nullableText, fecha_reporte: date, estado: enumString(['pendiente', 'revisado', 'resuelto', 'rechazado']) }),
  Notificacion: fields({ id: identifier, usuario_id: identifier, tipo_notificacion: nullableText, contenido: nullableText, fecha_notificacion: date, leida: boolean }),
};
const paths: Record<string, Record<string, unknown>> = {};
function endpoint(method: string, path: string, tag: string, summary: string, response: Schema | null, options: { request?: Schema; status?: number; public?: boolean; list?: boolean; description?: string } = {}) {
  const parameters: Schema[] = [...path.matchAll(/\{([^}]+)\}/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: identifier }));
  if (options.list) parameters.push({ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } });
  const status = options.status ?? 200;
  const errorResponse = { description: 'Error de validación, acceso o recurso.', content: { 'application/json': { schema: ref('Error') } } };
  paths[path] ??= {};
  paths[path][method] = {
    tags: [tag], summary, description: options.description,
    operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
    security: options.public ? [] : [{ bearerAuth: [] }], parameters,
    ...(options.request ? { requestBody: { required: true, content: { 'application/json': { schema: options.request } } } } : {}),
    responses: {
      [status]: { description: status === 204 ? 'Operación completada sin contenido.' : 'Operación completada.', ...(response ? { content: { 'application/json': { schema: options.list ? array(response) : response } } } : {}) },
      '400': errorResponse, '401': errorResponse, '403': errorResponse, '404': errorResponse, '409': errorResponse, '413': errorResponse, '429': errorResponse, '500': errorResponse,
    },
  };
}
const root = '/api/v1';
const add = (method: string, path: string, tag: string, summary: string, response: Schema | null, options: NonNullable<Parameters<typeof endpoint>[5]> = {}) => endpoint(method, root + path, tag, summary, response, options);
add('post', '/auth/register', 'Autenticación', 'Registrar usuario', ref('Usuario'), { public: true, status: 201, request: input({ nombre: { ...str('Ana'), minLength: 1, maxLength: 120 }, email, password }, ['nombre', 'email', 'password']) });
add('post', '/auth/login', 'Autenticación', 'Iniciar sesión', ref('Login'), { public: true, request: input({ email, password }, ['email', 'password']) });
add('post', '/auth/logout', 'Autenticación', 'Cerrar e invalidar la sesión actual', null, { status: 204 });
add('get', '/usuarios', 'Usuarios', 'Listar usuarios (administrador)', ref('Usuario'), { list: true });
add('get', '/usuarios/{id}', 'Usuarios', 'Consultar usuario', { anyOf: [ref('UsuarioPublico'), ref('Usuario')] }, { description: 'Solo el propietario y administrador reciben correo y fotos de identificación.' });
add('put', '/usuarios/{id}', 'Usuarios', 'Actualizar usuario propio o como administrador', ref('Usuario'), { request: { ...input({ nombre: { ...str('Ana'), minLength: 1, maxLength: 120 }, email, password, foto_credencial: { type: 'string', format: 'uri', nullable: true, maxLength: 2048 }, foto_carnet: { type: 'string', format: 'uri', nullable: true, maxLength: 2048 }, verificado: boolean, tipo_usuario: enumString(['usuario', 'admin']) }), minProperties: 1 }, description: 'verificado y tipo_usuario solo pueden modificarse por un administrador. Al cambiar contraseña se revocan todas las sesiones del usuario. Las fotos se reciben como URL, no archivos.' });
add('delete', '/usuarios/{id}', 'Usuarios', 'Eliminar cuenta propia o como administrador', null, { status: 204, description: 'Eliminación física con cascada según el SQL original.' });
add('get', '/perfiles/{usuario_id}', 'Perfiles', 'Consultar perfil de usuario', ref('Perfil'));
add('post', '/perfiles', 'Perfiles', 'Crear perfil', ref('Perfil'), { status: 201, request: input({ usuario_id: identifier, ...profileFields }), description: 'usuario_id se omite para usar el usuario autenticado. Solo se permite un perfil por usuario.' });
add('put', '/perfiles/{id}', 'Perfiles', 'Actualizar perfil propio', ref('Perfil'), { request: { ...input(profileFields), minProperties: 1 } });
add('delete', '/perfiles/{id}', 'Perfiles', 'Eliminar perfil propio', null, { status: 204 });
add('get', '/recomendaciones', 'Recomendaciones', 'Listar recomendaciones propias', ref('Recomendacion'), { list: true });
add('get', '/recomendaciones/{id}', 'Recomendaciones', 'Consultar recomendación propia', ref('Recomendacion'));
add('post', '/recomendaciones/generar', 'Recomendaciones', 'Regenerar recomendaciones propias', array(ref('Recomendacion')), { description: 'Requiere perfil. Similitud de intereses, gustos y preferencias normalizados; excluye al propio usuario, interacciones previas y matches. Evalúa hasta 1000 perfiles por ID y devuelve los mejores 100. Sustituye las recomendaciones anteriores y sus IDs.' });
add('post', '/interacciones', 'Interacciones', 'Registrar like o dislike', ref('InteraccionResultado'), { status: 201, request: input({ interactuado_id: identifier, tipo_interaccion: enumString(['like', 'dislike']) }, ['interactuado_id', 'tipo_interaccion']), description: 'La última interacción por dirección determina la decisión. Likes mutuos crean automáticamente un match y notificaciones. Un dislike no elimina un match existente.' });
add('get', '/interacciones', 'Interacciones', 'Listar interacciones propias', ref('Interaccion'), { list: true });
add('get', '/interacciones/{id}', 'Interacciones', 'Consultar interacción propia', ref('Interaccion'));
add('delete', '/interacciones/{id}', 'Interacciones', 'Eliminar interacción propia', null, { status: 204, description: 'Devuelve 409 si existe un match entre ambos usuarios.' });
add('get', '/matches', 'Matches', 'Listar matches propios', ref('Match'), { list: true });
add('get', '/matches/{id}', 'Matches', 'Consultar match como participante', ref('Match'));
add('post', '/matches', 'Matches', 'Obtener o crear match con likes mutuos', ref('Match'), { request: input({ usuario2_id: identifier }, ['usuario2_id']), description: 'El usuario autenticado es la otra parte. Requiere que las últimas interacciones sean likes mutuos. Es idempotente y devuelve 200.' });
add('delete', '/matches/{id}', 'Matches', 'Eliminar match como participante', null, { status: 204, description: 'Elimina sus mensajes en cascada y las interacciones previas entre ambos usuarios.' });
add('get', '/matches/{match_id}/mensajes', 'Chats', 'Consultar mensajes como participante', ref('Mensaje'), { list: true, description: 'Orden más reciente primero; el cliente puede invertirlo al mostrar el chat.' });
add('post', '/matches/{match_id}/mensajes', 'Chats', 'Enviar mensaje como participante', ref('Mensaje'), { status: 201, request: input({ mensaje: message }, ['mensaje']) });
add('get', '/mensajes/{id}', 'Chats', 'Consultar mensaje como participante', ref('Mensaje'));
add('delete', '/mensajes/{id}', 'Chats', 'Eliminar mensaje enviado por uno mismo', null, { status: 204 });
add('post', '/mensajes-anonimos', 'Mensajes anónimos', 'Enviar mensaje anónimo', ref('MensajeAnonimo'), { status: 201, request: input({ destinatario_id: identifier, mensaje: message }, ['destinatario_id', 'mensaje']) });
add('get', '/mensajes-anonimos', 'Mensajes anónimos', 'Listar mensajes anónimos recibidos', ref('MensajeAnonimo'), { list: true });
add('get', '/mensajes-anonimos/{id}', 'Mensajes anónimos', 'Consultar mensaje como remitente o destinatario', ref('MensajeAnonimo'));
add('patch', '/mensajes-anonimos/{id}/revelar', 'Mensajes anónimos', 'Revelar identidad propia como remitente', ref('MensajeAnonimo'), { description: 'Solo el remitente puede consentir la revelación; el destinatario no puede forzarla.' });
add('post', '/reportes', 'Reportes', 'Reportar a otro usuario', ref('Reporte'), { status: 201, request: input({ reportado_id: identifier, razon: message }, ['reportado_id', 'razon']) });
add('get', '/reportes', 'Reportes', 'Listar reportes (administrador)', ref('Reporte'), { list: true });
add('get', '/reportes/{id}', 'Reportes', 'Consultar reporte como autor o administrador', ref('Reporte'));
add('patch', '/reportes/{id}', 'Reportes', 'Actualizar estado (administrador)', ref('Reporte'), { request: input({ estado: enumString(['pendiente', 'revisado', 'resuelto', 'rechazado']) }, ['estado']) });
add('get', '/notificaciones', 'Notificaciones', 'Listar notificaciones propias', ref('Notificacion'), { list: true });
add('get', '/notificaciones/{id}', 'Notificaciones', 'Consultar notificación propia', ref('Notificacion'));
add('patch', '/notificaciones/{id}/leida', 'Notificaciones', 'Marcar notificación propia como leída', ref('Notificacion'));
add('delete', '/notificaciones/{id}', 'Notificaciones', 'Eliminar notificación propia', null, { status: 204 });

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'Yalita API REST', version: '1.0.0', description: '38 endpoints. Autenticación Bearer con sesiones revocables de 24 horas. IDs BIGINT como cadenas. Listas paginadas mediante page y limit. Respuestas JSON directas; los errores contienen error y opcionalmente detalles.' },
  servers: [{ url: '/', description: 'Servidor actual' }], paths,
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas },
};
