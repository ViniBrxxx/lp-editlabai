import { cp, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../public/', import.meta.url));
const output = fileURLToPath(new URL('../dist/', import.meta.url));
await stat(new URL('../public/index.html', import.meta.url));
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true, force: true });
console.log('Site pronto em dist/.');
