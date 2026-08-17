#!/usr/bin/env node
/**
 * attribute-seedling-pairs-cost — **WHERE THE CARVED-PAIRS DUMP'S WALL TIME
 * GOES, PER SOLVE**, attributed to the CANDIDATE INSTANCE that asked for it.
 *
 * PROCGEN ELEMENTS arc 3, PROBE 2b Q5 (`NewDocs/plans/procgen-elements-arc3-
 * kickoff.md` §9b). Slice 2 recorded that `dump-seedling-kind-pairs.mjs
 * --kinds=<the six carved kinds> --seeds=1-12 --count=4` went from ~2 min to
 * ~82 min, and attributed it in prose to *"a kill solve walks the combat
 * ladder"*. ⛔ `reference_seedling_arc_traps` 275: a RUN-level number cannot
 * say that. This attributes PER ITEM.
 *
 * ── HOW, WITHOUT TOUCHING THE GENERATOR ───────────────────────────────
 *
 * `generateSeedlingLevel` builds the model, the oracle and the rng and hands
 * them to `procgenCore.generateLevel`. This script builds THE SAME THREE and
 * calls the same entry point — with `oracle.solve` WRAPPED in a timer. The
 * wrapper adds no draw, reads no clock the generator can see, and returns the
 * oracle's own object unchanged, so the levels it produces are the dump's
 * levels. (⛔ `feedback_wallclock_budget_breaks_determinism`: the ms never
 * reach the generator. They are written to this script's table and nowhere
 * else.)
 *
 * The candidate is the LAST element of the `templates` list the loop passes —
 * `solveTemplates: [...keptRows, template]` — which is the instance under
 * trial, `instance` string and all. That is the attribution key.
 *
 * ⚠ IT NAMES WHAT IT BOUNDED. The kinds, seeds, biomes and `obstacleTarget`
 * are printed in the header; a subset run is a subset claim.
 *
 * Run:
 *   node scripts/procgen/attribute-seedling-pairs-cost.mjs \
 *       --kinds=winding,rooms,branchy,bushy,loopy,open --seeds=1-12 --count=4
 *   … --biomes=post-sword          # the arm that can hold a kill lock at all
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const mod = async (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { BIOME_NAMES, paletteFor } = await mod('frontend/modules/seedlingDemo/watchGenerate.js');
const { seedlingModel, seedlingOracle } = await mod('frontend/modules/seedlingDemo/procgenSeedling.js');
const { generateLevel } = await mod('frontend/modules/procgenCore/levelGenerator.js');
const { rngFor } = await mod('frontend/modules/seedlingDemo/procgenRng.js');
const { parseSkeleton } = await mod('frontend/modules/procgenCore/skeletonKinds.js');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? dflt : hit.slice(name.length + 3);
};
const seedRange = (spec) => {
    const [a, b] = spec.split('-').map(Number);
    const out = [];
    for (let s = a; s <= (b ?? a); s += 1) out.push(s);
    return out;
};

const KINDS = arg('kinds', 'winding,rooms,branchy,bushy,loopy,open')
    .split(',').map((s) => s.trim()).filter(Boolean);
const SEEDS = seedRange(arg('seeds', '1-12'));
const COUNT = Number(arg('count', '4'));
const BIOMES = arg('biomes', BIOME_NAMES.join(',')).split(',').filter(Boolean);
const JSON_OUT = arg('json', '');

const say = (l = '') => process.stdout.write(`${l}\n`);
const note = (l) => process.stderr.write(`${l}\n`);

const solves = [];
const runs = [];
const t0all = Date.now();

const checkpoint = () => {
    mkdirSync(path.dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({
        kinds: KINDS, seeds: SEEDS, count: COUNT, biomes: BIOMES,
        wallMs: Date.now() - t0all, complete: false, runs, solves,
    }, null, 2)}\n`);
};

for (const kindSpec of KINDS) {
    const skeleton = parseSkeleton(kindSpec, { simulator: false, substrate: 'this attribution' });
    for (const biome of BIOMES) {
        for (const seed of SEEDS) {
            note(`[stderr] ${kindSpec} ${biome} seed ${seed}…`);
            const palette = paletteFor(biome);
            const model = seedlingModel({ seed, skeleton });
            const inner = seedlingOracle({ model, items: palette.items ?? null });
            const oracle = {
                ...inner,
                solve(record, opts = {}) {
                    const list = opts.templates ?? [];
                    const cand = list[list.length - 1] ?? null;
                    const t0 = Date.now();
                    try {
                        const out = inner.solve(record, opts);
                        solves.push({
                            kind: kindSpec,
                            biome,
                            seed,
                            instance: cand?.instance ?? '(skeleton)',
                            name: cand?.name ?? '(skeleton)',
                            verdict: out.verdict,
                            ms: Date.now() - t0,
                        });
                        return out;
                    } catch (e) {
                        solves.push({
                            kind: kindSpec,
                            biome,
                            seed,
                            instance: cand?.instance ?? '(skeleton)',
                            name: cand?.name ?? '(skeleton)',
                            verdict: `THREW ${e.name}`,
                            /**
                             * ⛓ THE MESSAGE, NOT JUST THE NAME — and the first
                             * cut of this file recorded only the name, which
                             * left PROBE 2b's single most expensive item (a
                             * **21m 47s** `SolverBotError` that aborted its run)
                             * with no sentence class at all. A cost table that
                             * names its worst item's TYPE and not its CLAIM
                             * cannot be acted on.
                             */
                            reasonText: String(e.message ?? '').slice(0, 600),
                            ms: Date.now() - t0,
                        });
                        throw e;
                    }
                },
            };
            const t0 = Date.now();
            let stop = null;
            try {
                const out = generateLevel({
                    rng: rngFor(seed), model, oracle, palette,
                    bounds: { obstacleTarget: COUNT },
                });
                stop = out.summary.stop;
            } catch (e) {
                stop = `THREW ${e.name}`;
            }
            const runMs = Date.now() - t0;
            runs.push({ kind: kindSpec, biome, seed, stop, ms: runMs });
            /**
             * ⛓⛓ ONE LINE PER RUN, AND THE JSON RE-WRITTEN BESIDE IT — because
             * this instrument's own subject is a job that can outlive the
             * budget measuring it. PROBE 2b's first two attempts were killed
             * mid-bound and produced NOTHING, since the tables only print at
             * the end: `winding` post-sword seed 1 at `obstacleTarget 4` runs
             * for over 15 minutes by itself. A cost instrument whose result
             * exists only on completion cannot measure a cost that large.
             * ⇒ every completed run is durable, and a killed job is a SHORTER
             * BOUND rather than an empty one.
             */
            note(`[run] ${kindSpec} ${biome} seed=${seed} ${(runMs / 1000).toFixed(1)}s `
                + `stop=${stop} solves=${solves.filter((s) => s.kind === kindSpec
                    && s.biome === biome && s.seed === seed).length}`);
            if (JSON_OUT) checkpoint();
        }
    }
}
const wallMs = Date.now() - t0all;

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (a, b) => (b === 0 ? '—' : `${((100 * a) / b).toFixed(1)}%`);
const totalMs = sum(solves.map((s) => s.ms));

say('# PROBE 2b Q5 — the carved-pairs cost, ATTRIBUTED PER SOLVE');
say('');
say(`command: \`node scripts/procgen/attribute-seedling-pairs-cost.mjs `
    + `--kinds=${KINDS.join(',')} --seeds=${SEEDS[0]}-${SEEDS[SEEDS.length - 1]} `
    + `--count=${COUNT} --biomes=${BIOMES.join(',')}\``);
say(`bound:   ${KINDS.length} kind(s) × ${BIOMES.join(',')} × seeds `
    + `${SEEDS[0]}..${SEEDS[SEEDS.length - 1]} × obstacleTarget ${COUNT} — `
    + `${runs.length} generation run(s), ${solves.length} solve(s).`);
say(`harness wall time ${(wallMs / 1000).toFixed(1)} s · summed solve ms `
    + `${(totalMs / 1000).toFixed(1)} s (${pct(totalMs, wallMs)} of it)`);
say('⛔ `ms` is an EVIDENCE column and never reaches the generator.');
say('');

say('## 1. COST PER TEMPLATE INSTANCE');
say('');
say('| solves | sum ms | max ms | share of solve time | instance |');
say('|---|---|---|---|---|');
const byInstance = new Map();
for (const s of solves) {
    if (!byInstance.has(s.instance)) byInstance.set(s.instance, []);
    byInstance.get(s.instance).push(s);
}
for (const [inst, here] of [...byInstance.entries()]
    .sort((a, b) => sum(b[1].map((s) => s.ms)) - sum(a[1].map((s) => s.ms)))) {
    const s = sum(here.map((x) => x.ms));
    say(`| ${here.length} | ${s} | ${Math.max(...here.map((x) => x.ms))} `
        + `| ${pct(s, totalMs)} | \`${inst}\` |`);
}
say('');

say('## 2. THE KILL FAMILY, SPLIT BY `span` AND VERDICT');
say('');
say('| n | sum ms | max ms | share | instance | verdict |');
say('|---|---|---|---|---|---|');
const kill = solves.filter((s) => s.name === 'wall-gap-spinner-killlock');
const byKV = new Map();
for (const s of kill) {
    const k = `${s.instance}|${s.verdict}`;
    if (!byKV.has(k)) byKV.set(k, []);
    byKV.get(k).push(s);
}
for (const [k, here] of [...byKV.entries()]
    .sort((a, b) => sum(b[1].map((s) => s.ms)) - sum(a[1].map((s) => s.ms)))) {
    const [inst, verdict] = k.split('|');
    const s = sum(here.map((x) => x.ms));
    say(`| ${here.length} | ${s} | ${Math.max(...here.map((x) => x.ms))} | ${pct(s, totalMs)} `
        + `| \`${inst}\` | ${verdict} |`);
}
say('');
const span1 = kill.filter((s) => /span=1\b/.test(s.instance));
const span1Reverts = span1.filter((s) => s.verdict !== 'SOLVED');
say(`⇒ **span-1 kill solves: ${span1.length} of ${solves.length} `
    + `(${pct(span1.length, solves.length)} of the solves) carrying `
    + `${sum(span1.map((s) => s.ms))} ms — ${pct(sum(span1.map((s) => s.ms)), totalMs)} of `
    + `the solve time.** Of those, ${span1Reverts.length} are REVERTS `
    + `(${sum(span1Reverts.map((s) => s.ms))} ms, `
    + `${pct(sum(span1Reverts.map((s) => s.ms)), totalMs)}).`);
say('');

say('## 3. COST PER KIND × BIOME');
say('');
say('| kind | biome | runs | solves | sum ms | max run ms |');
say('|---|---|---|---|---|---|');
for (const kind of KINDS) {
    for (const biome of BIOMES) {
        const hr = runs.filter((r) => r.kind === kind && r.biome === biome);
        const hs = solves.filter((s) => s.kind === kind && s.biome === biome);
        say(`| ${kind} | ${biome} | ${hr.length} | ${hs.length} `
            + `| ${sum(hs.map((s) => s.ms))} | ${Math.max(0, ...hr.map((r) => r.ms))} |`);
    }
}
say('');

say('## 4. THE TEN SLOWEST SINGLE SOLVES');
say('');
say('| ms | verdict | kind | biome | seed | instance |');
say('|---|---|---|---|---|---|');
for (const s of [...solves].sort((a, b) => b.ms - a.ms).slice(0, 10)) {
    say(`| ${s.ms} | ${s.verdict} | ${s.kind} | ${s.biome} | ${s.seed} | \`${s.instance}\` |`);
}
say('');

if (JSON_OUT) {
    mkdirSync(path.dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({
        kinds: KINDS, seeds: SEEDS, count: COUNT, biomes: BIOMES, wallMs,
        complete: true, runs, solves,
    }, null, 2)}\n`);
    note(`wrote ${JSON_OUT}`);
}
