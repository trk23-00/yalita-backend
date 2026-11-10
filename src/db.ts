import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const url = new URL(process.env.DATABASE_URL!);
export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema: url.searchParams.get('schema') ?? 'public' }) });
