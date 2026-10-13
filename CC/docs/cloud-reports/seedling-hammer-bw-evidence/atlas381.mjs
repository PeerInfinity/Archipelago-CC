// SCRATCH (seedling-hammer-bw): leg 381's atlas staging (`l40buttonStaging`, boot (848,16)), one solveSegment, the
// executed keys captured at the inner run's advance, the hits and bomb events, and (BW_DBG) the press kill's labels.
//   REPO=<tree> SEEDLING_MOVING_WAIT=1 [SEEDLING_PRESS_KILL_BOMBS=1] node atlas381.mjs --out=x.json [--boot=848,16]
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
globalThis.__BW_DBG = process.env.BW_DBG ? ((r) => { (globalThis.__BW_ROWS ??= []).push(r); }) : null;
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const md5 = (s) => createHash('md5').update(s).digest('hex');
const { l40buttonStaging, L40BUTTON_GOAL } = await import(join(REPO, 'scripts/procgen/plan-seedling-l40button-witness.mjs'));
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { solveSegment } = await M('solverBot.js');
const { createRunForStaging } = await M('tapeRunner.js');
const { atlasLevelSource } = await M('levelSource.js');
const [bx, by] = arg('boot', '848,16').split(',').map(Number);
const staging = await l40buttonStaging({ level: 40, x: bx, y: by });
const run = createRunForStaging(staging, atlasLevelSource());
const keys = [];
const adv = run.advance;
run.advance = (h) => { keys.push([...h].sort()); return adv.call(run, h); };
const res = { boot: staging.boot, env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_'))) };
const t0 = Date.now();
try {
    const out = solveSegment({ run, goals: [JSON.parse(JSON.stringify(L40BUTTON_GOAL))], name: 'bw-381', boot: staging.boot, dashMode: 'all' });
    res.verdict = 'SOLVED';
    res.ticks = out.perTick.length;
    res.verbs = (out.records ?? []).map((r) => r.strategy);
    res.kills = (out.records ?? []).filter((r) => r.strategy === 'kill').map((r) => ({ arm: r.arm, bombed: r.cycles?.map((c) => c.bombed) }));
} catch (e) {
    res.verdict = e.name === 'SolverRefusal' || e.perTick ? 'REFUSED' : 'THREW';
    res.name = e.name;
    res.message = String(e.message);
    res.refusalTicks = e.perTick?.length ?? null;
}
res.executed = keys.length;
res.keysMd5 = md5(JSON.stringify(keys));
res.at = { level: run.level, t: run.ticksCompleted, x: run.state.x, y: run.state.y };
res.hits = run.ledger('playerHits');
res.bombEvents = (run.ledger('bombEvents') ?? []).filter((e) => e.what !== 'spawn' || true);
res.ms = Date.now() - t0;
res.keys = keys;
if (process.env.BW_DBG) res.dbg = globalThis.__BW_ROWS ?? [];
try { const { PRESS_KILL_BOMBS_COUNTS } = await M('pressKillBombs.js'); res.counts = { ...PRESS_KILL_BOMBS_COUNTS }; } catch {}
writeFileSync(arg('out'), JSON.stringify(res));
console.log(`${res.verdict} executed=${res.executed} ${res.ms} ms keys=${res.keysMd5} hits=${JSON.stringify(res.hits.map((h) => [h.t, h.source, h.id]))}`);
console.log((res.message ?? '').slice(0, 600));
process.exit(0);
