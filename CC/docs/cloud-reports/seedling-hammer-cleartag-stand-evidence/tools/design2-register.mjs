// MEASUREMENT ONLY: `node --import ./design2-register.mjs replay.mjs …` (design (2), design2-loader.mjs).
import { register } from 'node:module';
register(new URL('./design2-loader.mjs', import.meta.url).href);
