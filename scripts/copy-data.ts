import { cp, mkdir } from 'node:fs/promises';

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await cp(new URL('../../data/', import.meta.url), new URL('../data/', import.meta.url), { recursive: true });
