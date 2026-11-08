// WALLS-CENSUS-2 scratch instrument (measure only; no tracked source is edited). A node module `load` hook that
// rewrites dangerMap.js IN MEMORY so `staticEnemyDanger` logs (stderr, `SPINTRACE`) every time it prices a SPINNER
// placement as a static body: the id, the run's live spinner roster, the press-hit ledger, and the removed ledger.
// Use: node --import ./trace-hook.mjs <replay tool> …
import { register } from 'node:module';
register(new URL('./trace-loader.mjs', import.meta.url));
