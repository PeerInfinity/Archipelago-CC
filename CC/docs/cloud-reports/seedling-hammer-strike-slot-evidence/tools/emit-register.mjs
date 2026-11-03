// MEASUREMENT ONLY: register emit-loader.mjs (see it).
import { register } from 'node:module';
if (!process.env.SLOT_EMIT_DIR) throw new Error('emit-register: set SLOT_EMIT_DIR');
register(new URL('./emit-loader.mjs', import.meta.url).href);
