import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { admin, allowed, body, exists, id, idSchema, owner, page, privateUser, publicUser, text } from './core.js';

export const users = Router();
users.get('/usuarios', admin, async (req, res) => { res.json(await db.usuarios.findMany({ select: privateUser, orderBy: { id: 'asc' }, ...page(req) })); });
users.get('/usuarios/:id', async (req, res) => {
  const userId = id(req.params.id);
  res.json(exists(await db.usuarios.findUnique({ where: { id: userId }, select: req.auth.admin || req.auth.id === userId ? privateUser : publicUser })));
});
users.put('/usuarios/:id', async (req, res) => {
  const userId = id(req.params.id); owner(req, userId);
  const schema = z.object({ nombre: z.string().trim().min(1).max(120).optional(), email: z.email().trim().toLowerCase().max(254).optional(), password: z.string().min(8).max(72).refine(v => Buffer.byteLength(v) <= 72).optional(), foto_credencial: z.url().max(2048).nullable().optional(), foto_carnet: z.url().max(2048).nullable().optional(), verificado: z.boolean().optional(), tipo_usuario: z.enum(['usuario', 'admin']).optional() }).strict().refine(v => Object.keys(v).length > 0, 'Indica al menos un campo');
  const { password, ...data } = body(req, schema);
  if (data.verificado !== undefined || data.tipo_usuario !== undefined) allowed(req.auth.admin);
  const result = await db.$transaction(async tx => {
    const user = await tx.usuarios.update({ where: { id: userId }, data: { ...data, ...(password ? { password_hash: await bcrypt.hash(password, 12) } : {}) }, select: privateUser });
    if (password) await tx.sesiones.updateMany({ where: { usuario_id: userId }, data: { revocada: true } });
    return user;
  });
  res.json(result);
});
users.delete('/usuarios/:id', async (req, res) => { const userId = id(req.params.id); owner(req, userId); await db.usuarios.delete({ where: { id: userId } }); res.status(204).end(); });

const profile = z.object({ informacion: text.nullable().optional(), intereses: z.array(z.string().trim().min(1).max(100)).max(50).optional(), gustos: z.array(z.string().trim().min(1).max(100)).max(50).optional(), preferencias: z.array(z.string().trim().min(1).max(100)).max(50).optional() });
users.get('/perfiles/:usuario_id', async (req, res) => { res.json(exists(await db.perfiles.findFirst({ where: { usuario_id: id(req.params.usuario_id) } }))); });
users.post('/perfiles', async (req, res) => {
  const { usuario_id, ...data } = body(req, profile.extend({ usuario_id: idSchema.optional() }).strict());
  const userId = usuario_id ? id(usuario_id) : req.auth.id; owner(req, userId);
  res.status(201).json(await db.perfiles.create({ data: { ...data, usuario_id: userId } }));
});
users.put('/perfiles/:id', async (req, res) => {
  const data = body(req, profile.strict().refine(v => Object.keys(v).length > 0));
  const p = exists(await db.perfiles.findUnique({ where: { id: id(req.params.id) } })); owner(req, p.usuario_id);
  res.json(await db.perfiles.update({ where: { id: p.id }, data }));
});
users.delete('/perfiles/:id', async (req, res) => {
  const p = exists(await db.perfiles.findUnique({ where: { id: id(req.params.id) } })); owner(req, p.usuario_id);
  await db.perfiles.delete({ where: { id: p.id } }); res.status(204).end();
});
