import 'dotenv/config';
import { z } from 'zod';

export const config = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
}).parse(process.env);
