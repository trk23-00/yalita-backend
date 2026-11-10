import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import { config } from './config.js';
import { db } from './db.js';

declare global {
  namespace Express {
    interface Request { auth: { id: bigint; admin: boolean; session: string } }
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const idSchema = z.string().regex(/^[1-9]\d*$/).refine(v => BigInt(v) <= 9223372036854775807n, 'ID fuera de rango');
export const id = (value: unknown) => BigInt(idSchema.parse(value));
export const text = z.string().trim().min(1).max(2000);
export const body = <T extends z.ZodType>(req: Request, schema: T): z.infer<T> => schema.parse(req.body);
export function page(req: Request) {
  const q = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query);
  return { skip: (q.page - 1) * q.limit, take: q.limit };
}
export const publicUser = { id: true, nombre: true, verificado: true } as const;
export const privateUser = { ...publicUser, email: true, foto_credencial: true, foto_carnet: true, tipo_usuario: true } as const;
export const exists = <T>(value: T | null): T => { if (!value) throw new ApiError(404, 'Recurso no encontrado'); return value; };
export const allowed = (condition: boolean) => { if (!condition) throw new ApiError(403, 'No tienes permiso para realizar esta operación'); };
export const owner = (req: Request, userId: bigint) => allowed(req.auth.id === userId || req.auth.admin);
export const admin = (req: Request, _res: Response, next: NextFunction) => { allowed(req.auth.admin); next(); };
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Se requiere un token Bearer');
  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(header.slice(7), config.JWT_SECRET, { algorithms: ['HS256'], issuer: 'yalita-api', audience: 'yalita-app' });
    if (typeof verified === 'string' || !verified.sub || typeof verified.jti !== 'string') throw new Error();
    payload = verified;
  } catch { throw new ApiError(401, 'Token inválido o expirado'); }
  const session = await db.sesiones.findUnique({ where: { id: payload.jti } });
  if (!session || session.revocada || session.expira_en <= new Date() || session.usuario_id.toString() !== payload.sub) throw new ApiError(401, 'Sesión inválida');
  const user = await db.usuarios.findUnique({ where: { id: session.usuario_id }, select: { tipo_usuario: true } });
  if (!user) throw new ApiError(401, 'Sesión inválida');
  req.auth = { id: session.usuario_id, admin: user.tipo_usuario === 'admin', session: session.id };
  next();
}
export async function member(req: Request, matchId: bigint) {
  const match = exists(await db.matches.findUnique({ where: { id: matchId } }));
  allowed(match.usuario1_id === req.auth.id || match.usuario2_id === req.auth.id);
  return match;
}
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) { res.status(400).json({ error: 'Datos inválidos', detalles: error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })) }); return; }
  if (error instanceof ApiError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const statuses: Record<string, [number, string]> = {
      P2002: [409, 'El registro ya existe'], P2003: [400, 'La referencia indicada no existe'],
      P2025: [404, 'Recurso no encontrado'], P2034: [409, 'Conflicto concurrente; vuelve a intentarlo'],
    };
    const [status, message] = statuses[error.code] ?? [500, 'Error de base de datos'];
    res.status(status).json({ error: message }); return;
  }
  if (error && typeof error === 'object' && 'status' in error && [400, 413].includes(Number(error.status))) {
    res.status(Number(error.status)).json({ error: 'Cuerpo JSON inválido o demasiado grande' }); return;
  }
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
}
