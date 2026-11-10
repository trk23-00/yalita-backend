import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import request from 'supertest';

test('API completa: 38 endpoints, permisos, concurrencia y cierre de sesión', { timeout: 120000 }, async t => {
  const schema = `test_yalita_${randomBytes(8).toString('hex')}`;
  assert.match(schema, /^test_yalita_[a-f0-9]{16}$/);
  const originalUrl = process.env.DATABASE_URL;
  assert.ok(originalUrl, 'Se requiere DATABASE_URL');
  const client = new Client({ connectionString: originalUrl });
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  let disconnect: (() => Promise<void>) | undefined;
  try {
    await client.query(`SET search_path TO "${schema}"`);
    for (const file of ['001_base.sql', '002_api.sql']) await client.query(await readFile(new URL(`../database/${file}`, import.meta.url), 'utf8'));
    const testUrl = new URL(originalUrl); testUrl.searchParams.set('schema', schema);
    process.env.DATABASE_URL = testUrl.toString();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-for-integration-at-least-32-characters';
    const { app } = await import('../src/app.js');
    const { db } = await import('../src/db.js');
    const { openapi } = await import('../src/openapi.js');
    disconnect = () => db.$disconnect();
    const covered = new Set<string>();
    const call = async (method: string, route: string, status: number, token?: string, data?: unknown, contract?: string) => {
      let req = (request(app) as unknown as Record<string, (url: string) => request.Test>)[method](route);
      if (token) req = req.set('Authorization', `Bearer ${token}`);
      if (data !== undefined) req = req.send(data as object);
      const result = await req;
      assert.equal(result.status, status, `${method.toUpperCase()} ${route}: ${JSON.stringify(result.body)}`);
      if (status < 300 && contract) covered.add(`${method} /api/v1${contract}`);
      return result.body;
    };
    const register = (name: string) => call('post', '/api/v1/auth/register', 201, undefined, { nombre: name, email: `${name}@example.com`, password: 'password123' }, '/auth/register');
    const login = (name: string) => call('post', '/api/v1/auth/login', 200, undefined, { email: `${name}@example.com`, password: 'password123' }, '/auth/login');
    const a = await register('ana'); const b = await register('bea'); const c = await register('carla');
    const d = await register('dora');
    await db.usuarios.update({ where: { id: BigInt(c.id) }, data: { tipo_usuario: 'admin' } });
    const ta = (await login('ana')).token; const tb = (await login('bea')).token; const tc = (await login('carla')).token;

    await t.test('validación, privacidad y administración de usuarios', async () => {
      await call('get', '/health', 200);
      await call('get', '/api/v1/usuarios', 401);
      await call('get', '/api/v1/usuarios', 401, 'bad-token');
      await call('get', '/api/v1/usuarios', 403, ta);
      await call('post', '/api/v1/auth/register', 400, undefined, { nombre: 'x', email: 'bad', password: 'abc' });
      await call('post', '/api/v1/auth/register', 400, undefined, { nombre: 'x', email: 'x@example.com', password: 'password123', tipo_usuario: 'admin' });
      await call('post', '/api/v1/auth/login', 401, undefined, { email: 'ana@example.com', password: 'invalidpass' });
      await call('post', '/api/v1/auth/register', 409, undefined, { nombre: 'Ana', email: 'ana@example.com', password: 'password123' });
      const list = await call('get', '/api/v1/usuarios?limit=2', 200, tc, undefined, '/usuarios');
      assert.equal(list.length, 2); assert.equal(list[0].password_hash, undefined);
      const pub = await call('get', `/api/v1/usuarios/${b.id}`, 200, ta, undefined, '/usuarios/{id}');
      assert.equal(pub.email, undefined); assert.equal(pub.foto_carnet, undefined);
      await call('put', `/api/v1/usuarios/${b.id}`, 403, ta, { nombre: 'No' });
      await call('put', `/api/v1/usuarios/${a.id}`, 403, ta, { tipo_usuario: 'admin' });
      await call('put', `/api/v1/usuarios/${a.id}`, 403, ta, { verificado: true });
      await call('put', `/api/v1/usuarios/${a.id}`, 200, ta, { nombre: 'Ana actualizada' }, '/usuarios/{id}');
      await call('get', '/api/v1/usuarios/0', 400, ta);
      await call('get', '/api/v1/usuarios/9223372036854775808', 400, ta);
      await call('get', '/api/v1/usuarios/999999', 404, ta);
      await call('get', '/api/v1/usuarios?limit=999', 400, tc);
    });

    let pa: { id: string }; let pb: { id: string }; let pd: { id: string };
    await t.test('perfiles y recomendaciones', async () => {
      pa = await call('post', '/api/v1/perfiles', 201, ta, { intereses: ['Música', 'cine'], gustos: ['viajar'] }, '/perfiles');
      pb = await call('post', '/api/v1/perfiles', 201, tb, { intereses: ['música'], gustos: ['cine'] }, '/perfiles');
      pd = await call('post', '/api/v1/perfiles', 201, tc, { usuario_id: d.id, gustos: ['cine'] });
      await call('post', '/api/v1/perfiles', 409, ta, {});
      await call('get', `/api/v1/perfiles/${a.id}`, 200, tb, undefined, '/perfiles/{usuario_id}');
      await call('put', `/api/v1/perfiles/${pa.id}`, 403, tb, { informacion: 'No' });
      await call('put', `/api/v1/perfiles/${pa.id}`, 200, ta, { informacion: 'Hola' }, '/perfiles/{id}');
      const recs = await call('post', '/api/v1/recomendaciones/generar', 200, ta, undefined, '/recomendaciones/generar');
      assert.ok(recs.length > 0); assert.ok(recs.every((r: { recomendado_id: string }) => r.recomendado_id !== a.id));
      await call('get', '/api/v1/recomendaciones', 200, ta, undefined, '/recomendaciones');
      await call('get', `/api/v1/recomendaciones/${recs[0].id}`, 200, ta, undefined, '/recomendaciones/{id}');
      await call('get', `/api/v1/recomendaciones/${recs[0].id}`, 403, tb);
    });

    let match: { id: string }; let sent: { id: string };
    await t.test('interacciones, likes mutuos y match único concurrente', async () => {
      await call('post', '/api/v1/interacciones', 400, ta, { interactuado_id: a.id, tipo_interaccion: 'like' });
      await call('post', '/api/v1/interacciones', 400, ta, { interactuado_id: b.id, tipo_interaccion: 'otro' });
      await call('post', '/api/v1/matches', 409, ta, { usuario2_id: b.id });
      const interaction = await call('post', '/api/v1/interacciones', 201, ta, { interactuado_id: d.id, tipo_interaccion: 'dislike' }, '/interacciones');
      await call('get', '/api/v1/interacciones', 200, ta, undefined, '/interacciones');
      await call('get', `/api/v1/interacciones/${interaction.interaccion.id}`, 200, ta, undefined, '/interacciones/{id}');
      await call('get', `/api/v1/interacciones/${interaction.interaccion.id}`, 403, tb);
      await call('delete', `/api/v1/interacciones/${interaction.interaccion.id}`, 204, ta, undefined, '/interacciones/{id}');
      await Promise.all([
        call('post', '/api/v1/interacciones', 201, ta, { interactuado_id: b.id, tipo_interaccion: 'like' }),
        call('post', '/api/v1/interacciones', 201, tb, { interactuado_id: a.id, tipo_interaccion: 'like' }),
      ]);
      const results = await call('get', '/api/v1/matches', 200, ta, undefined, '/matches');
      assert.equal(results.length, 1); match = results[0];
      assert.equal(await db.matches.count(), 1);
      await call('get', `/api/v1/matches/${match.id}`, 200, tb, undefined, '/matches/{id}');
      await call('get', `/api/v1/matches/${match.id}`, 403, tc);
      const recreated = await call('post', '/api/v1/matches', 200, ta, { usuario2_id: b.id }, '/matches');
      assert.equal(recreated.id, match.id);
      const ownLike = await db.interacciones.findFirstOrThrow({ where: { usuario_id: BigInt(a.id) } });
      await call('delete', `/api/v1/interacciones/${ownLike.id}`, 409, ta);
    });

    await t.test('chat y mensajes restringidos a participantes', async () => {
      sent = await call('post', `/api/v1/matches/${match.id}/mensajes`, 201, ta, { mensaje: 'Hola Bea' }, '/matches/{match_id}/mensajes');
      await call('get', `/api/v1/matches/${match.id}/mensajes`, 200, tb, undefined, '/matches/{match_id}/mensajes');
      await call('post', `/api/v1/matches/${match.id}/mensajes`, 403, tc, { mensaje: 'No' });
      await call('get', `/api/v1/mensajes/${sent.id}`, 200, tb, undefined, '/mensajes/{id}');
      await call('get', `/api/v1/mensajes/${sent.id}`, 403, tc);
      await call('delete', `/api/v1/mensajes/${sent.id}`, 403, tb);
      await call('delete', `/api/v1/mensajes/${sent.id}`, 204, ta, undefined, '/mensajes/{id}');
    });

    await t.test('anonimato y consentimiento del remitente', async () => {
      const anon = await call('post', '/api/v1/mensajes-anonimos', 201, ta, { destinatario_id: b.id, mensaje: 'Mensaje secreto' }, '/mensajes-anonimos');
      const received = await call('get', '/api/v1/mensajes-anonimos', 200, tb, undefined, '/mensajes-anonimos');
      assert.ok(received.length); assert.equal(received[0].remitente_id, undefined);
      const detail = await call('get', `/api/v1/mensajes-anonimos/${anon.id}`, 200, tb, undefined, '/mensajes-anonimos/{id}');
      assert.equal(detail.remitente_id, undefined);
      await call('get', `/api/v1/mensajes-anonimos/${anon.id}`, 403, tc);
      await call('patch', `/api/v1/mensajes-anonimos/${anon.id}/revelar`, 403, tb);
      await call('patch', `/api/v1/mensajes-anonimos/${anon.id}/revelar`, 200, ta, undefined, '/mensajes-anonimos/{id}/revelar');
      const revealed = await call('get', `/api/v1/mensajes-anonimos/${anon.id}`, 200, tb);
      assert.equal(revealed.remitente_id, a.id);
    });

    await t.test('reportes, notificaciones y sus permisos', async () => {
      const report = await call('post', '/api/v1/reportes', 201, ta, { reportado_id: b.id, razon: 'Contenido ofensivo' }, '/reportes');
      await call('get', '/api/v1/reportes', 403, ta);
      await call('get', '/api/v1/reportes', 200, tc, undefined, '/reportes');
      await call('get', `/api/v1/reportes/${report.id}`, 200, ta, undefined, '/reportes/{id}');
      await call('get', `/api/v1/reportes/${report.id}`, 403, tb);
      await call('patch', `/api/v1/reportes/${report.id}`, 403, ta, { estado: 'resuelto' });
      const updated = await call('patch', `/api/v1/reportes/${report.id}`, 200, tc, { estado: 'resuelto' }, '/reportes/{id}');
      assert.equal(updated.estado, 'resuelto');
      const notifications = await call('get', '/api/v1/notificaciones', 200, tb, undefined, '/notificaciones');
      assert.ok(notifications.length);
      const notification = notifications[0];
      await call('get', `/api/v1/notificaciones/${notification.id}`, 403, ta);
      await call('get', `/api/v1/notificaciones/${notification.id}`, 200, tb, undefined, '/notificaciones/{id}');
      const read = await call('patch', `/api/v1/notificaciones/${notification.id}/leida`, 200, tb, undefined, '/notificaciones/{id}/leida');
      assert.equal(read.leida, true);
      await call('delete', `/api/v1/notificaciones/${notification.id}`, 204, tb, undefined, '/notificaciones/{id}');
    });

    await t.test('eliminaciones, revocación de sesiones y contrato de 38 endpoints', async () => {
      await call('delete', `/api/v1/matches/${match.id}`, 403, tc);
      await call('post', `/api/v1/matches/${match.id}/mensajes`, 201, ta, { mensaje: 'Se elimina con el match' });
      await call('delete', `/api/v1/matches/${match.id}`, 204, ta, undefined, '/matches/{id}');
      assert.equal(await db.chats.count(), 0);
      await call('post', '/api/v1/matches', 409, ta, { usuario2_id: b.id });
      await call('delete', `/api/v1/perfiles/${pd.id}`, 204, tc, undefined, '/perfiles/{id}');
      const td = (await login('dora')).token;
      await call('delete', `/api/v1/usuarios/${d.id}`, 204, tc, undefined, '/usuarios/{id}');
      await call('get', '/api/v1/notificaciones', 401, td);
      await call('post', '/api/v1/auth/logout', 204, ta, undefined, '/auth/logout');
      await call('get', '/api/v1/matches', 401, ta);
      await call('put', `/api/v1/usuarios/${b.id}`, 200, tb, { password: 'newpassword123' });
      await call('get', '/api/v1/matches', 401, tb);
      const spec = await call('get', '/api/openapi.json', 200);
      assert.equal(spec.openapi, '3.0.3');
      const expected = Object.entries(openapi.paths).flatMap(([path, methods]) => Object.keys(methods).map(method => `${method} ${path}`));
      assert.equal(expected.length, 38);
      assert.deepEqual([...covered].sort(), expected.sort());
    });
  } finally {
    if (disconnect) await disconnect();
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
    process.env.DATABASE_URL = originalUrl;
  }
});
