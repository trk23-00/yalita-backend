import { Router } from 'express';
import { z } from 'zod';
import { db } from './db.js';
import { admin, allowed, ApiError, body, exists, id, idSchema, page, text } from './core.js';

export const moderation = Router();
moderation.post('/reportes', async (req, res) => {
  const data = body(req, z.object({ reportado_id: idSchema, razon: text }).strict());
  const target = id(data.reportado_id);
  if (target === req.auth.id) throw new ApiError(400, 'No puedes reportarte a ti mismo');
  exists(await db.usuarios.findUnique({ where: { id: target }, select: { id: true } }));
  res.status(201).json(await db.reportes.create({ data: { reportado_id: target, reportado_por: req.auth.id, razon: data.razon } }));
});
moderation.get('/reportes', admin, async (req, res) => { res.json(await db.reportes.findMany({ orderBy: { id: 'desc' }, ...page(req) })); });
moderation.get('/reportes/:id', async (req, res) => {
  const report = exists(await db.reportes.findUnique({ where: { id: id(req.params.id) } }));
  allowed(req.auth.admin || report.reportado_por === req.auth.id); res.json(report);
});
moderation.patch('/reportes/:id', admin, async (req, res) => {
  const data = body(req, z.object({ estado: z.enum(['pendiente', 'revisado', 'resuelto', 'rechazado']) }).strict());
  res.json(await db.reportes.update({ where: { id: id(req.params.id) }, data }));
});
moderation.get('/notificaciones', async (req, res) => { res.json(await db.notificaciones.findMany({ where: { usuario_id: req.auth.id }, orderBy: [{ fecha_notificacion: 'desc' }, { id: 'desc' }], ...page(req) })); });
moderation.get('/notificaciones/:id', async (req, res) => {
  const item = exists(await db.notificaciones.findUnique({ where: { id: id(req.params.id) } })); allowed(item.usuario_id === req.auth.id); res.json(item);
});
moderation.patch('/notificaciones/:id/leida', async (req, res) => {
  const item = exists(await db.notificaciones.findUnique({ where: { id: id(req.params.id) } })); allowed(item.usuario_id === req.auth.id);
  res.json(await db.notificaciones.update({ where: { id: item.id }, data: { leida: true } }));
});
moderation.delete('/notificaciones/:id', async (req, res) => {
  const item = exists(await db.notificaciones.findUnique({ where: { id: id(req.params.id) } })); allowed(item.usuario_id === req.auth.id);
  await db.notificaciones.delete({ where: { id: item.id } }); res.status(204).end();
});
