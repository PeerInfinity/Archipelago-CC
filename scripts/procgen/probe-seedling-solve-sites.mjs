#!/usr/bin/env node
/**
 * probe-seedling-solve-sites — Measure-only (SEEDLING FIDELITY CRUSHER, D1): WHERE A
 * LONG SOLVE SPENDS ITS TIME, read off the solver's own deadline sites.
 *
 * One `solveSegment` from a survey boot view (a staged 0-tick tape, as
 * `survey-seedling-route.mjs` writes them), re-pointed at `--at=x,y` if asked,
 * with `fineCheckpoints` on and a `shouldStop` that RECORDS every site ask
 * instead of deciding anything: per site, how many asks and how much wall time
 * since the previous ask; every gap over `--gap=` ms is printed with the run's
 * tick and position. `--deny=a,b` answers those sites "stop" (the rung is refused
 * BY NAME and the ladder goes on — how to see what the ladder does without a
 * rung); `--budget=` stops everything after that many ms.
 *
 * ⚠ It changes nothing tracked, and it is not a verdict on a room: a solve cut by
 * `--budget` says so in its refusal (`⏱ DEADLINE`).
 *
 * Run:
 *   node scripts/procgen/probe-seedling-solve-sites.mjs --view=<step-N-boot.json> --goal=collect:64,144
 *       [--at=928,96] [--dash=all|none|full] [--deny=kill-chaser] [--budget=600000] [--gap=2000]
 *   (`--goal=exit:x,y` for a reach-exit; `--step=82` reads the survey's own view for that step)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** Parse `collect:x,y` / `exit:x,y` into a solver goal. */
export function goalFrom(spec) {
    const m = /^(collect|exit):(-?\d+),(-?\d+)$/.exec(spec ?? '');
    if (!m) throw new Error(`--goal must be collect:x,y or exit:x,y, got ${JSON.stringify(spec)}`);
    const p = { x: Number(m[2]), y: Number(m[3]) };
    return m[1] === 'collect' ? { kind: 'collect-placement', placement: p } : { kind: 'reach-exit', exit: p };
}

/** The recorder: a `shouldStop` that tallies sites and gaps, and stops only when told to. */
export function siteRecorder({ budget = Infinity, deny = [], gap = 2000, now = Date.now, where = () => '' } = {}) {
    const t0 = now();
    let last = t0;
    const per = {};
    const gaps = [];
    const shouldStop = (site) => {
        const t = now();
        const row = per[site] ?? (per[site] = { asks: 0, ms: 0, maxGapMs: 0 });
        const g = t - last;
        row.asks += 1;
        row.ms += g;
        row.maxGapMs = Math.max(row.maxGapMs, g);
        if (g > gap) gaps.push({ atS: (t - t0) / 1000, site, gapMs: g, where: where() });
        last = t;
        return t - t0 > budget || deny.includes(site);
    };
    return { shouldStop, per, gaps, elapsed: () => now() - t0 };
}

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const step = arg('step', null);
    const view = arg('view', step ? join(REPO, '.cache', 'seedling-survey', 'through-end', 'views', `step-${step}-boot.json`) : null);
    if (!view) throw new Error('pass --view=<boot view json> or --step=N');
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { createRunForStaging, solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(view, 'utf8'))));
    const at = arg('at', null);
    if (at) {
        const [x, y] = at.split(',').map(Number);
        staging.boot = { ...staging.boot, x, y };
    }
    const run = createRunForStaging(staging, atlasLevelSource());
    const rec = siteRecorder({
        budget: Number(arg('budget', 'Infinity')),
        deny: (arg('deny', '') || '').split(',').filter(Boolean),
        gap: Number(arg('gap', '2000')),
        where: () => `t${run.ticksCompleted} (${run.state.x.toFixed(0)},${run.state.y.toFixed(0)})`,
    });
    let verdict;
    try {
        const out = solveSegment({ run, goals: [goalFrom(arg('goal', null))], name: 'probe-sites',
            boot: staging.boot, dashMode: arg('dash', 'all'), shouldStop: rec.shouldStop, fineCheckpoints: true });
        verdict = `SOLVED ${out.perTick.length} t`;
    } catch (e) {
        verdict = `REFUSED — ${e.message.slice(0, 900)}`;
    }
    console.log(`L${staging.boot.level} @(${staging.boot.x},${staging.boot.y}) dash=${arg('dash', 'all')} `
        + `deny=[${arg('deny', '')}] — ${(rec.elapsed() / 1000).toFixed(1)} s — ${verdict}`);
    console.log('\nsite            asks      ms   max gap ms');
    for (const [site, r] of Object.entries(rec.per).sort((a, b) => b[1].ms - a[1].ms)) {
        console.log(`${site.padEnd(14)} ${String(r.asks).padStart(6)} ${String(r.ms).padStart(8)} ${String(r.maxGapMs).padStart(10)}`);
    }
    if (rec.gaps.length) {
        console.log(`\ngaps over ${arg('gap', '2000')} ms (${rec.gaps.length}):`);
        for (const g of rec.gaps.slice(0, 40)) console.log(`  ${g.atS.toFixed(1)} s  ${g.site}  ${g.gapMs} ms  ${g.where}`);
    }
}

if (isEntryPoint(import.meta.url)) await main();
