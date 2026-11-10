import 'dotenv/config';
import { db } from '../src/db.js';
const email = process.argv[2]?.trim().toLowerCase();
try {
  if (!email) throw new Error('Uso: npm run admin:set -- correo@ejemplo.com');
  await db.usuarios.update({ where: { email }, data: { tipo_usuario: 'admin' } });
  console.log('Usuario designado como administrador.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo asignar administrador');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
