// Counts L40/L18 heartbeats per loop, and the previewed states, under a silent counting hook.
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC'; const M = join(REPO, 'frontend/modules/seedlingDemo');
const { loadTape } = await import(join(M, 'fixtures/index.js'));
const { createRunForStaging, stagingFromTape } = await import(join(M, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(M, 'levelSource.js'));
const { twoPassSolve } = await import(join(M, 'twoPassSolve.js'));
const { withSolveDeadline } = await import(join(M, 'solverBot.js'));
const { withSolveProgress } = await import(join(M, 'solveProgress.js'));
const SOURCE = atlasLevelSource();
const base = stagingFromTape(loadTape('r5-l40-part5'));
const staging = { ...base, noclip: false, noDamage: false, equips: [], persistence: base.persistence.filter((c) => c.at === undefined) };
const by = {}; let states = 0; let lastSeg = -1; let lastPeek = null;
await withSolveProgress((site, peek) => {
  if (site === 'heartbeat') { const s = peek(); by[s.heartbeat.at] = (by[s.heartbeat.at] ?? 0) + 1; }
  if (site === 'done') { const s = peek(); states += s.budget.work.previewStates; }
}, () => withSolveDeadline({ shouldStop: () => false, fineCheckpoints: true }, () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
  goals: [{ kind: 'collect-placement', placement: { x: 160, y: 640 } }], name: 'l40', boot: staging.boot, persistence: staging.persistence, gameTick: () => { throw new Error('x'); } })));
console.log(JSON.stringify({ beats: by, previewStates: states }));
