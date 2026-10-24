#!/usr/bin/env node
// SCRATCH (seedling-hammer-d D1): a leg's room re-solved on C1's TAPE staging (`crusherStaging`: r8-solve-11's staging
// re-booted, items and keys set) with `twoPassSolve`, the tree given by REPO (the rung mutant's worktree, or the base),
// and the plan written as a game tape (`buildStagedTape`). Measure-only.
//   REPO=… node mut-solve.mjs --boot=40,928,96 --items=hasSword,hasGhostSword,… --keys=0,1,2,3 --goal=collect:64,144 --tape=out.json
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend/modules/seedlingDemo');
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { crusherStaging } = await import(join(REPO, 'scripts/procgen/plan-seedling-crusher-witness.mjs'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
const [level, x, y] = arg('boot').split(',').map(Number);
const staging = await crusherStaging({ boot: { level, x, y }, keys: arg('keys', '').split(',').filter(Boolean).map(Number),
    items: arg('items').split(',') });
const m = /^(collect|exit):(-?\d+),(-?\d+)$/.exec(arg('goal'));
const goal = m[1] === 'collect' ? { kind: 'collect-placement', placement: { x: +m[2], y: +m[3] } }
    : { kind: 'reach-exit', exit: { x: +m[2], y: +m[3] } };
const levelSource = atlasLevelSource();
const out = { boot: staging.boot, items: arg('items'), goal: arg('goal'), repo: REPO };
const t0 = Date.now();
try {
    const res = await twoPassSolve({ makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: [goal], name: 'hammer-d', boot: staging.boot, dashMode: 'all', persistence: staging.persistence, log: () => {} });
    const st = { ...staging, persistence: res.persistence, equips: [...(staging.equips ?? []), ...(res.out.equips ?? [])] };
    const run = createRunForStaging(st, levelSource);
    for (const h of res.out.perTick) run.advance(h);
    Object.assign(out, { verdict: 'SOLVED', ticks: res.out.perTick.length, hits: run.playerHits.length,
        landings: run.spinnerPressHits.filter((h) => h.landed).map((h) => ({ t: h.t, id: h.id, weapon: h.weapon, hits: h.hits,
            killed: h.killed, reach: Number(h.reach.toFixed(3)) })), kills: run.spinnerKills ?? null,
        verbs: [...new Set((res.out.records ?? []).map((r) => r.strategy))] });
    if (arg('tape', '')) {
        const built = buildStagedTape({ staging: st, perTick: res.out.perTick, name: arg('name', 'hammer-d-scratch') });
        writeFileSync(arg('tape'), `${JSON.stringify({ ...built, description: `scratch (hammer-d D1): ${JSON.stringify(out)}` }, null, 1)}\n`);
    }
} catch (e) {
    Object.assign(out, { verdict: 'REFUSED', msg: String(e.message).slice(0, 2500), refusalTicks: e.perTick?.length ?? null });
}
out.s = (Date.now() - t0) / 1000;
console.log(JSON.stringify(out));
process.exit(0);
