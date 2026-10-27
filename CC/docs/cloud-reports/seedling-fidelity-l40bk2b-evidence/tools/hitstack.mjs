// scratch: solve a captured request's staging with solveSegment directly (no deadline), wrapping the live run's advance:
// print the executor stack on the tick a player hit lands, and the tick the orbit kill's body goes.
import { readFileSync } from 'node:fs';
const R = (process.env.ROOT ?? '/home/user/Archipelago-CC') + '/';
const SD = R + 'frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(SD + 'atlasSource.js');
const { createRunForStaging } = await import(SD + 'tapeRunner.js');
const { solveSegment } = await import(SD + 'solverBot.js');
const [file, id, i] = process.argv.slice(2);
const r = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((x) => String(x.id) === id);
const req = restoreRequest(r.requests.find((x) => String(x.i) === i).request);
const levelSource = levelSourceFromAtlas(req.source.records);
const mk = () => createRunForStaging(req.staging, levelSource, { scratchPersistence: true });
const run = mk();
const adv = run.advance.bind(run);
let hits = 0;
const pos = [];
const shf = run.stepHeldFrames?.bind(run); if (shf) run.stepHeldFrames = (...a) => { console.log(`stepHeldFrames at t${run.ticksCompleted}`); return shf(...a); };
const eq = run.equipNow?.bind(run); if (eq) run.equipNow = (...a) => { console.log(`equipNow ${JSON.stringify(a)} at t${run.ticksCompleted}`); return eq(...a); };
run.advance = (k) => {
  const o = adv(k);
  pos[run.ticksCompleted] = [run.state.x, run.state.y, (run.entities('spinnerBodies') ?? []).map((c) => [c.id, c.x, c.y, c.hits ?? null])];
  const h = run.playerHits.length;
  if (h > hits) {
    hits = h;
    const st = new Error().stack.split('\n').slice(2, 14).map((l) => l.trim().replace(/\(file:\/\/\/[^)]*\/(\w+\.js):(\d+):\d+\)/, '$1:$2')).join('\n   ');
    console.log(`HIT t${run.ticksCompleted} ${JSON.stringify(run.playerHits.at(-1))}\n   ${st}`);
  }
  return o;
};
try { solveSegment({ run, goals: [req.solverGoal], name: req.name, boot: req.staging.boot, dashMode: 'all', forkRun: mk }); console.log('SOLVED'); }
catch (e) { (await import('node:fs')).writeFileSync('/tmp/claude-0/w/live853.json', JSON.stringify(pos)); console.log(`refused at t${run.ticksCompleted}: ${String(e.message).slice(0, 400)}`); }
