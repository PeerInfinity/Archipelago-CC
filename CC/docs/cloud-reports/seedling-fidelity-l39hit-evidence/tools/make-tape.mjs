// MEASURE ONLY: the captured L39 request's staging at seam T + a solved plan (plan-*.json) → a seam-declaring tape
// (the l39shaft witness tapes' shape: buildStagedTape over the staging, equips as tape v4 rows).
import { readFileSync, writeFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const [capFile, planFile, out] = process.argv.slice(2);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const { buildStagedTape } = await import(R + 'frontend/modules/seedlingDemo/botDriverV1.js');
const { parseTape } = await import(R + 'frontend/modules/seedlingDemo/tapeFormat.js');
const { tapeEquips } = await import(R + 'frontend/modules/seedlingDemo/wasmPlayback.js');
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const cap = JSON.parse(readFileSync(capFile, 'utf8').split('\n')[0]).requests[0].request;
const req = restoreRequest(atSeamTime(cap, plan.seam));
const staging = { ...req.staging, equips: tapeEquips(plan.equipsAt) };
const perTick = plan.solution.map((k) => new Set(k));
const text = buildStagedTape({ staging, perTick, name: `l39hit-seam${plan.seam}` });
const obj = typeof text === "string" ? JSON.parse(text) : text; const tape = parseTape(JSON.stringify(obj));
writeFileSync(out, JSON.stringify(obj));
console.log('tape', tape.tick_count, 'seam.time', obj.seam?.time, 'equips', (tape.equips ?? []).length, 'boot', JSON.stringify(tape.boot));
