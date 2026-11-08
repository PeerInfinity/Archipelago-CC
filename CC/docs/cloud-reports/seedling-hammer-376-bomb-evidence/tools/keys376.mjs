// scratch: the dashless pass's driven keys (the longest array of Sets the solver pushed), replayed tick by tick
import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
const R = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(R + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { atlasLevelSource } = await import(R + '/frontend/modules/seedlingDemo/levelSource.js');
const JR = await import(R + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { createRunForStaging } = await import(R + '/frontend/modules/seedlingDemo/tapeRunner.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const w = JSON.parse(gunzipSync(readFileSync(process.env.SCRATCH + '/leg376-play.json.gz')).toString());
const req = restoreRequest(atSeamTime(w.request, Number(args.seam)));
const { passes = JR.ANYTIME_PASSES, budgetWork, upgradeWindowWork, ...tape } = req;
const p = passes.find((x) => x.pass === (args.pass ?? 'dashless'));
let best = null; const orig = Array.prototype.push;
const upto = Number(args.upto ?? 1430);
Array.prototype.push = function (...xs) { if (xs.length === 1 && xs[0] instanceof Set && this.length >= upto - 5 && this.length <= upto + 40 && (best === null || this.length >= best.length) && Array.isArray(this)) { best = this; if (this.length === upto) snap = this.slice(); } return orig.apply(this, xs); };
let snap = null;
const a = JR.settleSolve(() => JR.solveFromTape({ ...tape, levelSource: atlasLevelSource(), dashMode: p.dashMode, adds: p.adds ?? null }));
Array.prototype.push = orig;
const keys = snap ?? best;
console.log('ok', a.ok, 'keys', keys?.length);
const run = createRunForStaging(tape.staging, atlasLevelSource(), { scratchPersistence: tape.scratchPersistence === true });
const [lo, hi] = (args.ticks ?? '1380-1440').split('-').map(Number);
for (let i = 0; i < Math.min(keys.length, hi); i++) {
  run.advance(keys[i]);
  if (i + 1 >= lo) {
    const bombs = (run.entities('bombs') ?? []).map((b) => [b.id.split('#')[1], +b.x.toFixed(1), +b.y.toFixed(1), b.t]);
    console.log(i + 1, [...keys[i]].join('+') || '-', run.state.x.toFixed(2), run.state.y.toFixed(2), run.state.vx.toFixed(2), run.state.vy.toFixed(2), 'hits', run.playerHits.length, JSON.stringify(bombs).slice(0, 200));
  }
}
console.log('entities', Object.keys(run.entitiesAll?.() ?? {}).join(','));
