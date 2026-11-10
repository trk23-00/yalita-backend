import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from './db.js';
import { config } from './config.js';
import { ApiError, authenticate, body, privateUser } from './core.js';

export const auth = Router();
const credentials = z.object({ email: z.email().trim().toLowerCase().max(254), password: z.string().min(8).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Máximo 72 bytes') });
auth.post('/register', async (req, res) => {
  const data = body(req, credentials.extend({ nombre: z.string().trim().min(1).max(120) }).strict());
  const user = await db.usuarios.create({ data: { nombre: data.nombre, email: data.email, password_hash: await bcrypt.hash(data.password, 12), tipo_usuario: 'usuario' }, select: privateUser });
  res.status(201).json(user);
});
auth.post('/login', async (req, res) => {
  const data = body(req, credentials.strict());
  const user = await db.usuarios.findUnique({ where: { email: data.email } });
  // La comparación ficticia evita omitir el trabajo de hash cuando el correo no existe.
  const valid = await bcrypt.compare(data.password, user?.password_hash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEe.1V5QvaH3nO.0MWQyUpXmTCOCN7eZHDK');
  if (!user || !valid) throw new ApiError(401, 'Credenciales incorrectas');
  const session = randomUUID();
  await db.sesiones.create({ data: { id: session, usuario_id: user.id, expira_en: new Date(Date.now() + 86400000) } });
  const token = jwt.sign({}, config.JWT_SECRET, { subject: user.id.toString(), jwtid: session, expiresIn: '1d', algorithm: 'HS256', issuer: 'yalita-api', audience: 'yalita-app' });
  res.json({ token, token_type: 'Bearer', expires_in: 86400, usuario: { id: user.id, nombre: user.nombre, email: user.email, verificado: user.verificado, tipo_usuario: user.tipo_usuario } });
});
auth.post('/logout', authenticate, async (req, res) => {
  await db.sesiones.update({ where: { id: req.auth.session }, data: { revocada: true } });
  res.status(204).end();
});
