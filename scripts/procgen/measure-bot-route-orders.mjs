#!/usr/bin/env node
/**
 * measure-bot-route-orders — **WHAT ORDER SHOULD THE PLAYBACK BOT VISIT LOCATIONS IN?** Prices the bot's walk route
 * under several orderings of the same sphere log, offline: no browser, no game. Per ordering it prints the legs, the
 * Restarts, the region transitions (hops) and, where regions name Seedling levels, the level visits. The legs are
 * `surveyRoute.deriveLegs`' (an ordering is only a different pickups list), and the greedy orderings pick with
 * `procgenCore/routeChooser.js`, the function the bot's `sphere-cheapest` / `reachable-cheapest` sources call. The
 * pure half is `routeOrders.js`.
 *
 * ⚠ No time column: no measured per-hop or per-Restart cost exists to multiply by, and this does not invent one.
 *
 * Run:
 *   node scripts/procgen/measure-bot-route-orders.mjs                          # the default worlds
 *   node scripts/procgen/measure-bot-route-orders.mjs --preset=tloz             # one preset dir (its AP_* seed)
 *   node scripts/procgen/measure-bot-route-orders.mjs --rules=<rules.json> [--log=<sphere_log.jsonl>]
 *   node scripts/procgen/measure-bot-route-orders.mjs --penalties=0,5,10,inf    # the Restart penalty sweep
 *   node scripts/procgen/measure-bot-route-orders.mjs --legs=13-20              # print legs touching levels 13–20
 *   node scripts/procgen/measure-bot-route-orders.mjs --json=<out.json>
 *
 * A rules file with no `--log` (and no sphere log beside it) gets one from `forwardSimulator.generateSphereLog`, as
 * the bot builds it in page.
 */
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const { makeRuleHolds, RESTART_TARGET } = await import('./surveyRoute.js');
    const { ORDERINGS, goalItemOf, priceOrdering, rowsOfSphereLog, levelOfRegion, walkGraphOf } = await import('./routeOrders.js');
    const { returnToMenu } = await import('../../frontend/modules/procgenCore/restartWarp.js');
    const { restartTargetFor } = await import('../../frontend/modules/procgenCore/restartRoute.js');
    const { generateSphereLog } = await import('../../frontend/modules/shared/procgen/forwardSimulator.js');
    const argOf = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

    const PRESETS = join(REPO, 'frontend', 'presets');
    const seedDir = (game) => {
        const seeds = readdirSync(join(PRESETS, game)).filter((d) => /^AP_\d+$/.test(d)).sort();
        return seeds.map((s) => ({ name: `${game}/${s}`, rules: join(PRESETS, game, s, `${s}_rules.json`),
            log: join(PRESETS, game, s, `${s}_sphere_log.jsonl`) }));
    };
    let targets;
    if (argOf('rules')) targets = [{ name: relative(REPO, argOf('rules')), rules: argOf('rules'), log: argOf('log') ?? null }];
    else if (argOf('preset')) targets = seedDir(argOf('preset'));
    else targets = ['seedling_playthrough', 'seedling', 'jta', 'wargroove', 'dlcquest', 'codingadventure'].flatMap(seedDir);

    const penalties = (argOf('penalties') ?? 'inf').split(',').map((s) => (s === 'inf' ? Infinity : Number(s)));
    const legLevels = argOf('legs')?.split('-').map(Number) ?? null;
    const out = [];
    for (const t of targets) {
        const rules = JSON.parse(readFileSync(t.rules, 'utf8'));
        const graph = walkGraphOf(rules, '1');
        const regions = graph.regions;
        const fromFile = t.log && existsSync(t.log);
        const entries = fromFile
            ? readFileSync(t.log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
            : generateSphereLog(rules, { playerId: '1' });
        const rows = rowsOfSphereLog(entries, regions, '1', goalItemOf(rules));
        const ruleHolds = makeRuleHolds(rules);
        const gameStart = regions[RESTART_TARGET]?.exits?.find((e) => e.name === 'GameStart')?.connected_region;
        const start = gameStart ?? restartTargetFor(rules, '1');
        const restart = returnToMenu(rules);
        console.log(`\n## ${t.name} — ${rows.length} rows, sphere log ${fromFile ? relative(REPO, t.log) : 'generated (forwardSimulator)'}, `
            + `start ${start}, return_to_menu ${restart}, bidirectional ${graph.assumeBidirectional} (${graph.source})`);
        console.log('| ordering | penalty | legs | restarts | hops | level visits |');
        console.log('|---|---|---|---|---|---|');
        for (const ordering of ORDERINGS) {
            for (const restartPenalty of ordering === 'listed' ? [null] : penalties) {
                const r = priceOrdering({ regions, ruleHolds, start, rows, ordering, restart,
                    restartPenalty: restartPenalty ?? Infinity });
                const pen = restartPenalty === null ? '—' : String(restartPenalty);
                if (r.error) {
                    console.log(`| ${ordering} | ${pen} | ✗ ${r.error.replace(/\|/g, '/')} | | | |`);
                } else {
                    const m = r.metrics;
                    console.log(`| ${ordering} | ${pen} | ${m.legs} | ${m.restarts} | ${m.hops} | ${m.levelVisits || '—'} |`);
                }
                out.push({ world: t.name, ordering, restartPenalty: restartPenalty === Infinity ? 'inf' : restartPenalty,
                    ...(r.error ? { error: r.error } : { metrics: r.metrics,
                        legs: r.legs.map((l) => ({ sphere: l.sphere, goal: l.goal, from: l.from, to: l.to,
                            hops: l.regions.length - 1, ...(l.restart ? { restart: true } : {}),
                            ...(l.event ? { event: l.event.id } : {}) })) }) });
                if (legLevels && !r.error) {
                    const [lo, hi] = legLevels;
                    const touches = (l) => l.regions.some((x) => { const n = levelOfRegion(x); return n !== null && n >= lo && n <= hi; });
                    r.legs.forEach((l, i) => {
                        if (touches(l)) {
                            console.log(`    ${String(i).padStart(3)} ${l.sphere.padEnd(9)} ${l.restart ? 'RESTART' : 'walk   '} `
                                + `${String(l.regions.length - 1).padStart(3)} hops  ${l.from} → ${l.to}  (${l.goal})`);
                        }
                    });
                }
            }
        }
    }
    if (argOf('json')) writeFileSync(argOf('json'), `${JSON.stringify(out, null, 1)}\n`);
}
