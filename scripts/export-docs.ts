import { writeFile } from 'node:fs/promises';
import { openapi } from '../src/openapi.js';
await writeFile(new URL('../docs/openapi.json', import.meta.url), JSON.stringify(openapi, null, 2) + '\n');
const lines = ['# Endpoints de Yalita', '', 'Base: `/api/v1`. Todas las rutas requieren Bearer JWT salvo registro y login. IDs como cadenas decimales. Los detalles de cuerpos, respuestas y errores están en OpenAPI y Swagger.', '', '| Método | Endpoint | Operación |', '| --- | --- | --- |'];
for (const [path, methods] of Object.entries(openapi.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    lines.push(`| ${method.toUpperCase()} | \`${path}\` | ${(operation as { summary: string }).summary} |`);
  }
}
await writeFile(new URL('../docs/endpoints.md', import.meta.url), lines.join('\n') + '\n');
console.log('OpenAPI exportado en docs/openapi.json');
