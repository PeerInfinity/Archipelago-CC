import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const sb = await M('solverBot.js');
const { withSolveProgress } = await M('solveProgress.js');
const { parseTape } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const W = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(W.tape))));
const src = levelSourceFromAtlas(patchedMapDocument(MAP));
const counts = {}; const t0 = Date.now(); let lastPrint = 0; let rungs = [];
const limit = Number(process.argv[3] ?? 90) * 1000;
try {
withSolveProgress((site, peek) => {
  counts[site] = (counts[site] ?? 0) + 1;
  if (site === 'rung' || site === 'climb' || site === 'walk') { const p = peek(); rungs.push(`${site}:${JSON.stringify(p?.segment?.rung ?? p?.rung ?? p?.segment?.verb ?? '')}`.slice(0, 60)); if (rungs.length > 400) rungs = rungs.slice(-400); }
  const now = Date.now();
  if (now - lastPrint > 15000) { lastPrint = now; console.log(Math.round((now - t0) / 1000) + 's', JSON.stringify(counts), 'tick', JSON.stringify(peek()?.segment?.tick ?? peek()?.tick ?? null)); }
  if (now - t0 > limit) { console.log('LAST RUNGS', rungs.slice(-60).join(' | ')); const p = peek(); const walk = (n, d) => { console.log(" ".repeat(d) + n.label + " a" + n.attempts + " s" + n.successes + " " + JSON.stringify(n.rejections).slice(0, 160)); for (const c of n.children ?? []) walk(c, d + 1); }; walk(p.tree, 0); process.exit(0); }
}, () => sb.solveSegment({ run: createRunForStaging(staging, src), goals: W.goals, name: 'p', boot: staging.boot,
    forkRun: () => createRunForStaging(staging, src) }));
console.log('DONE', Date.now() - t0, JSON.stringify(counts));
} catch (e) { console.log('REFUSED', Date.now() - t0, String(e.message).slice(0, 300), JSON.stringify(counts)); }
