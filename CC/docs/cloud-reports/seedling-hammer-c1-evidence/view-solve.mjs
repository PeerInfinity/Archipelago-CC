#!/usr/bin/env node
// SCRATCH (seedling-hammer-c1): one solveSegment from a survey boot view, the whole refusal printed, the kill
// records and the trace's ladder rows summarised. Measure-only.
//   node view-solve.mjs --view=step-61-boot.json --goal=collect:880,816 [--at=x,y] [--dash=all] [--json=out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const MODULE = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo';
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
const { createRunForStaging, solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const goalOf = (spec) => {
    const m = /^(collect|exit):(-?\d+),(-?\d+)$/.exec(spec);
    const p = { x: Number(m[2]), y: Number(m[3]) };
    return m[1] === 'collect' ? { kind: 'collect-placement', placement: p } : { kind: 'reach-exit', exit: p };
};
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(arg('view'), 'utf8'))));
const at = arg('at', null);
if (at) { const [x, y] = at.split(',').map(Number); staging.boot = { ...staging.boot, x, y }; }
const run = createRunForStaging(staging, atlasLevelSource());
const goals = arg('goal').split(';').map(goalOf);
const t0 = Date.now();
const res = { view: arg('view'), boot: staging.boot, goals: arg('goal'), env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_'))) };
try {
    const out = solveSegment({ run, goals, name: 'c1', boot: staging.boot, dashMode: arg('dash', 'all') });
    res.verdict = 'SOLVED';
    res.ticks = out.perTick.length;
    res.records = (out.records ?? []).filter((r) => r.strategy === 'kill').map((r) => ({ arm: r.arm ?? null, target: r.target, ledger: r.ledger ?? null }));
    res.hits = run.state?.hits ?? null;
    res.deaths = run.progress?.('playerDeaths') ?? null;
    res.end = { level: run.level, x: run.state.x, y: run.state.y };
    if (arg('tape', null)) writeFileSync(arg('tape'), JSON.stringify(out.perTick.map((s) => [...s])));
} catch (e) {
    res.verdict = 'REFUSED';
    res.name = e.name;
    res.message = String(e.message);
    res.refusalTicks = e.perTick?.length ?? null;
    res.at = { level: run.level, t: run.ticksCompleted, x: run.state.x, y: run.state.y, vx: run.state.vx, vy: run.state.vy };
    res.rows = (e.rows ?? []).filter((r) => r.strategy?.rung === 'kill' || r.strategy?.verb === 'kill').map((r) => ({ tick: r.tick, strategy: r.strategy }));
    if (arg('tape', null) && e.perTick) writeFileSync(arg('tape'), JSON.stringify(e.perTick.map((s) => [...s])));
}
res.ms = Date.now() - t0;
console.log(`${res.verdict} ${res.ticks ?? ''} ${res.ms} ms`);
console.log(res.message ?? JSON.stringify(res.records));
if (res.at) console.log('AT', JSON.stringify(res.at), 'refusalTicks', res.refusalTicks, 'killRows', JSON.stringify(res.rows));
if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(res, null, 1));
process.exit(0);
