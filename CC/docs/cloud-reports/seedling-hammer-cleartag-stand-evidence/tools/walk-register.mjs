// MEASUREMENT ONLY: `node --import ./walk-register.mjs replay.mjs …` — every solver walk is recorded (walk-loader.mjs).
import { register } from 'node:module';
register(new URL('./walk-loader.mjs', import.meta.url).href);
const runs = new Map();
globalThis.__ctsWalks = runs;
globalThis.__ctsWalk = (rec) => { if (!runs.has(rec.run)) runs.set(rec.run, []); runs.get(rec.run).push(rec); };
