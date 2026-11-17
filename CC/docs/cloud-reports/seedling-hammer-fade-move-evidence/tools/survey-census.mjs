// FADE-MOVE scratch instrument (measure only): run the route survey in THIS process (so the solver module is shared),
// then dump `FADE_MOVE_COUNTS` (the census of covered waits, and FADE_MOVE's moves/declines when ON) to --census=<json>.
// Every other argument is the survey's own. Usage: [ENV…] node survey-census.mjs --census=<json> --through=end --out=<json> …
import { writeFileSync } from 'node:fs';
const ROOT = '/home/user/Archipelago-CC';
const census = process.argv.find((a) => a.startsWith('--census='))?.slice(9);
process.argv = process.argv.filter((a) => !a.startsWith('--census='));
const SB = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
SB.resetFadeMoveCounts();
process.on('exit', () => { if (census) writeFileSync(census, JSON.stringify(SB.FADE_MOVE_COUNTS, null, 1)); });
process.argv[1] = `${ROOT}/scripts/procgen/survey-seedling-route.mjs`;
await import(`${ROOT}/scripts/procgen/survey-seedling-route.mjs`);
