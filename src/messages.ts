import { Router } from 'express';
import { z } from 'zod';
import type { mensajesanonimos } from '@prisma/client';
import { db } from './db.js';
import { allowed, ApiError, body, exists, id, idSchema, member, page, text } from './core.js';

export const messages = Router();
messages.get('/matches/:match_id/mensajes', async (req, res) => {
  const matchId = id(req.params.match_id); await member(req, matchId);
  res.json(await db.chats.findMany({ where: { match_id: matchId }, orderBy: [{ fecha_envio: 'desc' }, { id: 'desc' }], ...page(req) }));
});
messages.post('/matches/:match_id/mensajes', async (req, res) => {
  const data = body(req, z.object({ mensaje: text }).strict());
  const match = await member(req, id(req.params.match_id));
  const message = await db.$transaction(async tx => {
    const result = await tx.chats.create({ data: { match_id: match.id, enviado_por: req.auth.id, mensaje: data.mensaje } });
    await tx.notificaciones.create({ data: { usuario_id: match.usuario1_id === req.auth.id ? match.usuario2_id : match.usuario1_id, tipo_notificacion: 'mensaje', contenido: `Nuevo mensaje en match ${match.id}` } });
    return result;
  });
  res.status(201).json(message);
});
messages.get('/mensajes/:id', async (req, res) => {
  const message = exists(await db.chats.findUnique({ where: { id: id(req.params.id) } })); await member(req, message.match_id); res.json(message);
});
messages.delete('/mensajes/:id', async (req, res) => {
  const message = exists(await db.chats.findUnique({ where: { id: id(req.params.id) } }));
  allowed(message.enviado_por === req.auth.id); await member(req, message.match_id);
  await db.chats.delete({ where: { id: message.id } }); res.status(204).end();
});

function anonymousView(message: mensajesanonimos, viewer: bigint) {
  const { remitente_id, ...rest } = message;
  return message.revelado || remitente_id === viewer ? { ...rest, remitente_id } : rest;
}
messages.post('/mensajes-anonimos', async (req, res) => {
  const data = body(req, z.object({ destinatario_id: idSchema, mensaje: text }).strict());
  const recipient = id(data.destinatario_id);
  if (recipient === req.auth.id) throw new ApiError(400, 'No puedes enviarte mensajes anónimos');
  const message = await db.$transaction(async tx => {
    exists(await tx.usuarios.findUnique({ where: { id: recipient }, select: { id: true } }));
    const result = await tx.mensajesanonimos.create({ data: { remitente_id: req.auth.id, destinatario_id: recipient, mensaje: data.mensaje } });
    await tx.notificaciones.create({ data: { usuario_id: recipient, tipo_notificacion: 'mensaje_anonimo', contenido: 'Recibiste un mensaje anónimo' } });
    return result;
  });
  res.status(201).json(anonymousView(message, req.auth.id));
});
messages.get('/mensajes-anonimos', async (req, res) => {
  const result = await db.mensajesanonimos.findMany({ where: { destinatario_id: req.auth.id }, orderBy: { id: 'desc' }, ...page(req) });
  res.json(result.map(m => anonymousView(m, req.auth.id)));
});
messages.get('/mensajes-anonimos/:id', async (req, res) => {
  const message = exists(await db.mensajesanonimos.findUnique({ where: { id: id(req.params.id) } }));
  allowed(message.remitente_id === req.auth.id || message.destinatario_id === req.auth.id);
  res.json(anonymousView(message, req.auth.id));
});
messages.patch('/mensajes-anonimos/:id/revelar', async (req, res) => {
  const message = exists(await db.mensajesanonimos.findUnique({ where: { id: id(req.params.id) } }));
  allowed(message.remitente_id === req.auth.id);
  res.json(await db.mensajesanonimos.update({ where: { id: message.id }, data: { revelado: true } }));
});
