// Probe: replay request.json's solve exactly as procgenOracle.solve does (solveForPage's run construction), and on
// the refusal read the LIVE run: where the player is, whether the lock is open, and what the planner answers for the
// walk the refusal names. Usage: node probe-after-lock.mjs <repo-root> [request.json]
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
const [REPO, reqPath = new URL('request.json', import.meta.url).pathname] = process.argv.slice(2);
const M = (p) => import(join(REPO, 'frontend/modules', p));
const req = JSON.parse(readFileSync(reqPath, 'utf8'));
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { atlasOf } = await M('seedlingDemo/procgenLevel.js');
const { createRunForStaging } = await M('seedlingDemo/tapeRunner.js');
const { solveSegment, solverPlanOpts } = await M('seedlingDemo/solverBot.js');
const { planWaypoints } = await M('seedlingDemo/botDriverV2.js');
const levelSource = levelSourceFromAtlas(atlasOf(req.levelRecord));
const run = createRunForStaging(req.staging, levelSource, { scratchPersistence: true });
let err = null;
try {
    solveSegment({ run, goals: req.goals, name: req.opts.name, boot: req.staging.boot, maxTicksPerTarget: req.budget.maxTicksPerTarget });
} catch (e) { err = e; }
const st = run.state;
const open = [...(run.entities('openActivators') ?? [])];
const acts = (run.world.activators ?? []).map((a) => ({ id: a.id, tag: a.tag, rect: a.rect, keyLine: a.keyLine }));
const solidsNearLock = (run.world.solids ?? []).filter((s) => s.id?.includes('bosslock')).map((s) => ({ id: s.id, x: s.x, y: s.y }));
console.log(JSON.stringify({ refused: err?.message?.slice(0, 160) ?? null, state: { x: st.x, y: st.y }, keys: [...(run.progress('keys') ?? [])],
    open, acts, solidsNearLock, pickups: (run.world.pickups ?? []).map((p) => p.id ?? `${p.tag}@${p.x},${p.y}`) }, null, 1));
const tryPlan = (to, label, extra = {}) => {
    try {
        const wps = planWaypoints(run.world, run.state, to, null, solverPlanOpts(run, new Set(), extra));
        console.log(label, 'PLANS', JSON.stringify(wps));
    } catch (e) { console.log(label, 'REFUSED', String(e.message).slice(0, 300)); }
};
const [ax, ay] = (process.env.AIM ?? '24,104').split(',').map(Number);
tryPlan({ x: ax, y: ay }, `aim (${ax},${ay})`);
tryPlan({ x: 56, y: 104 }, 'through the door to (56,104) = tile (3,6)');
tryPlan({ x: 56, y: 120 }, 'onto the door cell (56,120) = tile (3,7)');
tryPlan({ x: 40, y: 104 }, 'onto the torch cell (40,104) = tile (2,6)');
tryPlan({ x: ax, y: ay }, `aim (${ax},${ay}) avoidVolumes:false`, { avoidVolumes: false });
const { HITBOX } = await M('seedlingDemo/botDriverV2.js').catch(() => ({}));
console.log('HITBOX', JSON.stringify(HITBOX ?? null));
const tp = (run.world.pickups ?? []).find((p) => p.tag === 'torchpickup');
console.log('torch row', JSON.stringify(tp));
