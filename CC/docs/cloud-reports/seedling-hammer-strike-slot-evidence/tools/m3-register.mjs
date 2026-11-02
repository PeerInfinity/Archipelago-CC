// MEASUREMENT ONLY: register m3-loader (design (3)), then the census hook.
import { register } from 'node:module';
register(new URL('./m3-loader.mjs', import.meta.url).href);
await import('./slot-register.mjs');
process.on('exit', () => console.error(`M3 re-selections: ${globalThis.__m3 ?? 0}`));
