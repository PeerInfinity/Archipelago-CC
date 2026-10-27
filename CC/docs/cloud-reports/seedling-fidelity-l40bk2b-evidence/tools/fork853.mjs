// scratch: rebuild the run at the orbit hook (request staging + the hook's prefix), print the map, play orbit candidates with a trace
import { readFileSync } from 'node:fs';
const B = (process.env.ROOT ?? '/home/user/Archipelago-CC') + '/';
const SD = B + 'frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(B + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(SD + 'atlasSource.js');
const { createRunForStaging } = await import(SD + 'tapeRunner.js');
const sb = await import(SD + 'solverBot.js');
const [file, id, i, hookFile] = process.argv.slice(2);
const r = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => String(x.id) === id);
const req = restoreRequest(r.requests.find((x) => String(x.i) === i).request);
const levelSource = levelSourceFromAtlas(req.source.records);
const hook = JSON.parse(readFileSync(hookFile, 'utf8'));
export function at() {
  const run = createRunForStaging(req.staging, levelSource, { scratchPersistence: true });
  for (const k of hook.perTick) run.advance(new Set(k));
  return run;
}
const run = at();
console.log(`rebuilt t${run.ticksCompleted} player (${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) equips ${req.equips?.size ?? 0} holds ${req.holds?.size ?? 0}`);
globalThis.__at = at; globalThis.__sb = sb; globalThis.__run = run;
if (process.env.MAP) {
  // ASCII walls around a box via the run's collision: try placing the player box at each 8px cell
  const w = run.world;
  console.log(Object.keys(w).slice(0, 80).join(' '));
}
