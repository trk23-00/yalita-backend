import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from './db.js';
import { allowed, ApiError, body, exists, id, idSchema, member, page } from './core.js';

export const social = Router();
const pair = (a: bigint, b: bigint) => ({ OR: [{ usuario1_id: a, usuario2_id: b }, { usuario1_id: b, usuario2_id: a }] });
export async function lockPair(tx: Prisma.TransactionClient, a: bigint, b: bigint) {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
async function createMatch(tx: Prisma.TransactionClient, a: bigint, b: bigint) {
  const existing = await tx.matches.findFirst({ where: pair(a, b) });
  if (existing) return existing;
  const match = await tx.matches.create({ data: { usuario1_id: a < b ? a : b, usuario2_id: a < b ? b : a } });
  await tx.notificaciones.createMany({ data: [a, b].map(usuario_id => ({ usuario_id, tipo_notificacion: 'match', contenido: `Nuevo match ${match.id}` })) });
  return match;
}
async function mutual(tx: Prisma.TransactionClient, a: bigint, b: bigint) {
  const first = await tx.interacciones.findFirst({ where: { usuario_id: a, interactuado_id: b }, orderBy: { id: 'desc' } });
  const second = await tx.interacciones.findFirst({ where: { usuario_id: b, interactuado_id: a }, orderBy: { id: 'desc' } });
  return first?.tipo_interaccion === 'like' && second?.tipo_interaccion === 'like';
}
social.post('/interacciones', async (req, res) => {
  const data = body(req, z.object({ interactuado_id: idSchema, tipo_interaccion: z.enum(['like', 'dislike']) }).strict());
  const target = id(data.interactuado_id);
  if (target === req.auth.id) throw new ApiError(400, 'No puedes interactuar contigo mismo');
  const result = await db.$transaction(async tx => {
    await lockPair(tx, req.auth.id, target);
    exists(await tx.usuarios.findUnique({ where: { id: target }, select: { id: true } }));
    const interaccion = await tx.interacciones.create({ data: { usuario_id: req.auth.id, interactuado_id: target, tipo_interaccion: data.tipo_interaccion } });
    const match = await mutual(tx, req.auth.id, target) ? await createMatch(tx, req.auth.id, target) : null;
    return { interaccion, match };
  });
  res.status(201).json(result);
});
social.get('/interacciones', async (req, res) => { res.json(await db.interacciones.findMany({ where: { usuario_id: req.auth.id }, orderBy: { id: 'desc' }, ...page(req) })); });
social.get('/interacciones/:id', async (req, res) => {
  const item = exists(await db.interacciones.findUnique({ where: { id: id(req.params.id) } })); allowed(item.usuario_id === req.auth.id); res.json(item);
});
social.delete('/interacciones/:id', async (req, res) => {
  await db.$transaction(async tx => {
    const item = exists(await tx.interacciones.findUnique({ where: { id: id(req.params.id) } })); allowed(item.usuario_id === req.auth.id);
    await lockPair(tx, item.usuario_id, item.interactuado_id);
    if (await tx.matches.findFirst({ where: pair(item.usuario_id, item.interactuado_id) })) throw new ApiError(409, 'Primero elimina el match asociado');
    await tx.interacciones.delete({ where: { id: item.id } });
  });
  res.status(204).end();
});
social.get('/matches', async (req, res) => { res.json(await db.matches.findMany({ where: { OR: [{ usuario1_id: req.auth.id }, { usuario2_id: req.auth.id }] }, orderBy: { id: 'desc' }, ...page(req) })); });
social.get('/matches/:id', async (req, res) => { res.json(await member(req, id(req.params.id))); });
social.post('/matches', async (req, res) => {
  const data = body(req, z.object({ usuario2_id: idSchema }).strict());
  const target = id(data.usuario2_id);
  if (target === req.auth.id) throw new ApiError(400, 'No puedes crear un match contigo mismo');
  const match = await db.$transaction(async tx => {
    await lockPair(tx, req.auth.id, target);
    exists(await tx.usuarios.findUnique({ where: { id: target }, select: { id: true } }));
    if (!await mutual(tx, req.auth.id, target)) throw new ApiError(409, 'Se requieren likes mutuos para crear un match');
    return createMatch(tx, req.auth.id, target);
  });
  res.status(200).json(match);
});
social.delete('/matches/:id', async (req, res) => {
  await db.$transaction(async tx => {
    const match = await member(req, id(req.params.id));
    await lockPair(tx, match.usuario1_id, match.usuario2_id);
    // Eliminar también los likes previos evita recrear el match sin una nueva decisión mutua.
    await tx.interacciones.deleteMany({ where: { OR: [{ usuario_id: match.usuario1_id, interactuado_id: match.usuario2_id }, { usuario_id: match.usuario2_id, interactuado_id: match.usuario1_id }] } });
    await tx.matches.delete({ where: { id: match.id } });
  });
  res.status(204).end();
});

social.get('/recomendaciones', async (req, res) => { res.json(await db.recomendaciones.findMany({ where: { usuario_id: req.auth.id }, orderBy: [{ compatibilidad: 'desc' }, { id: 'asc' }], ...page(req) })); });
social.get('/recomendaciones/:id', async (req, res) => {
  const item = exists(await db.recomendaciones.findUnique({ where: { id: id(req.params.id) } })); allowed(item.usuario_id === req.auth.id); res.json(item);
});
social.post('/recomendaciones/generar', async (req, res) => {
  const profile = exists(await db.perfiles.findUnique({ where: { usuario_id: req.auth.id } }));
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`recs:${req.auth.id}`}, 0))`;
    const interacted = await tx.interacciones.findMany({ where: { usuario_id: req.auth.id }, select: { interactuado_id: true } });
    const matched = await tx.matches.findMany({ where: { OR: [{ usuario1_id: req.auth.id }, { usuario2_id: req.auth.id }] } });
    const excluded = [req.auth.id, ...interacted.map(i => i.interactuado_id), ...matched.flatMap(m => [m.usuario1_id, m.usuario2_id])];
    const candidates = await tx.perfiles.findMany({ where: { usuario_id: { notIn: excluded } }, orderBy: { id: 'asc' }, take: 1000 });
    const normalize = (values: string[]) => new Set(values.map(v => v.trim().toLocaleLowerCase('es')));
    const own = normalize([...profile.intereses, ...profile.gustos, ...profile.preferencias]);
    const scored = candidates.map(p => {
      const other = normalize([...p.intereses, ...p.gustos]);
      const union = new Set([...own, ...other]).size;
      const common = [...own].filter(v => other.has(v)).length;
      return { usuario_id: req.auth.id, recomendado_id: p.usuario_id, compatibilidad: union ? Math.round(common / union * 100) : 0 };
    }).sort((a, b) => b.compatibilidad - a.compatibilidad).slice(0, 100);
    await tx.recomendaciones.deleteMany({ where: { usuario_id: req.auth.id } });
    if (scored.length) await tx.recomendaciones.createMany({ data: scored });
    return tx.recomendaciones.findMany({ where: { usuario_id: req.auth.id }, orderBy: [{ compatibilidad: 'desc' }, { id: 'asc' }] });
  });
  res.json(result);
});
