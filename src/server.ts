import { app } from './app.js';
import { db } from './db.js';
import { config } from './config.js';

await db.$connect();
const server = app.listen(config.PORT, '0.0.0.0', () => { console.log(`Yalita API: http://localhost:${config.PORT}/api/docs`); });
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => { await db.$disconnect(); clearTimeout(timeout); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
