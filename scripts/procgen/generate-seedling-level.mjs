#!/usr/bin/env node
/**
 * generate-seedling-level — THE PoC's CLI TWIN (kickoff §3.5, slice 2).
 *
 * Seed + biome + obstacle target + budget in; a generated Seedling level and
 * its FULL generation trace out. One loop, one model, one oracle — this
 * script owns no generation logic at all: it parses arguments, calls
 * `procgenSeedling.generateSeedlingLevel`, and prints. ⚖ Kickoff §5's
 * one-of-everything law, applied to the thing most likely to grow a second
 * copy of the loop.
 *
 * ── ⛔ STDOUT IS THE DETERMINISM CHANNEL ──────────────────────────────
 *
 * `prove-seedling-procgen-seam.mjs`'s law, inherited: everything that may
 * honestly differ between two runs of one seed — milliseconds, this
 * machine's speed — goes to STDERR and never to stdout. So
 *
 *     node … --seed=1 > a; node … --seed=1 > b; cmp a b
 *
 * is the determinism proof rather than a ritual, in two SEPARATE PROCESSES
 * (one process proves the generator is a function; two prove it depends on
 * nothing the process carries).
 *
 * ── ⚠⚠ NOTHING BOUNDS ELAPSED TIME, SO THE COST IS STATED UP FRONT ────
 *
 * `solveSegment` is synchronous and uninterruptible, and since 2026-08-14 no
 * budget in this pipeline is denominated in milliseconds at all: the budget
 * bounds TICKS, which is a property of the candidate rather than of the box
 * (`procgenOracle`'s DEFAULT_BUDGET docblock carries the measurements). ⇒
 * `--cost` prints `levelGenerator.costModel`'s arithmetic — `1 + target x
 * tries` solves at the worst measured solve — BEFORE anything runs, and the
 * real total goes to stderr afterwards. A reader who expected a timeout is the
 * reader this exists for, and there is no timeout to expect.
 *
 * ── WHAT THIS SCRIPT DOES NOT DO ──────────────────────────────────────
 *
 * ⛔ NO PNG. ⚖ Kickoff §3.5 pairs the CLI's JSON with a PNG through
 * `export-seedling-view.mjs`, and that exporter renders a level THE PAGE HAS
 * LOADED — it drives `watch.html` in a browser, and the page's SOURCE arms
 * are the atlas, a tape and manual mode. A synthetic level enters the page
 * through the GENERATE arm, which is **slice 4's** work. There is no
 * zero-new-surface way to hand the existing exporter a level that is not in
 * the atlas: `--level` selects an atlas level by id. Reported rather than
 * half-built (slice 2's charge says exactly this).
 *
 * ⛔ NOTHING IS WRITTEN TO `fixtures/`, EVER (standing law). `--out` writes
 * where it is told; without it the payload is stdout.
 *
 * Run:
 *   node scripts/procgen/generate-seedling-level.mjs --seed=1
 *   node scripts/procgen/generate-seedling-level.mjs --seed=1 --count=8 --json
 *   node scripts/procgen/generate-seedling-level.mjs --seed=1 --out=/tmp/level.json
 *   node scripts/procgen/generate-seedling-level.mjs --cost --count=8
 */

import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const M = (p) => import(join(HERE, '..', '..', 'frontend/modules/seedlingDemo', p));

const { ATTEMPT, STOP, costModel } = await M('levelGenerator.js');
const { DEFAULT_BUDGET } = await M('procgenOracle.js');
const { generateSeedlingLevel } = await M('procgenSeedling.js');
const { GENERATE_BIOMES } = await M('watchGenerate.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);
const num = (name, fallback) => Number(arg(name, fallback));

const SEED = num('seed', 1);
const BIOME = arg('biome', 'pre-sword');
const COUNT = num('count', 6);
const TRIES = num('tries', 8);
const SATURATION_K = num('k', 3);
/**
 * ⛓ THE ANCHOR SEARCH (GENERATE-mode UI slice 3, track B). 1 is the
 * pre-search behaviour and the level it produces is byte-identical to what
 * this CLI produced before the bound existed; above 1 the loop walks further
 * down the SAME seeded anchor order before giving a candidate up.
 */
const ANCHOR_TRIES = num('anchor-tries', 1);
/**
 * ⛔ `--budget-ms` IS GONE and is refused by name below rather than ignored —
 * the wall clock it set no longer exists (`procgenOracle`'s DEFAULT_BUDGET
 * docblock has the measurements). A flag that silently did nothing would leave
 * a caller believing they had bounded a run they had not.
 */
const BUDGET = {
    maxTicksPerTarget: num('ticks', DEFAULT_BUDGET.maxTicksPerTarget),
};
if (process.argv.some((a) => a.startsWith('--budget-ms'))) {
    process.stderr.write('generate-seedling-level: --budget-ms is GONE. Elapsed time no '
        + 'longer classifies a solve — it is not a property of the candidate, and it made '
        + 'generation depend on how busy the box was. Bound `--ticks` instead.\n');
    process.exit(2);
}

/**
 * ⚖ THE TWO BIOMES (kickoff §0), and slice 4 is where the second one arrives.
 *
 * The refusal stays BY NAME: a `--biome` this map does not hold must not
 * silently generate the other biome's level, because the boot is the whole
 * difference between them and a level generated under the wrong inventory is
 * a level whose certification is about a run nobody asked for.
 *
 * ⛓ SLICE 5 — IMPORTED, NOT SPELLED. The page's GENERATE arm needs the same
 * map, and the moment there were two of them "the CLI and the page generate
 * different levels for the same `--biome`" became possible. One map
 * (`watchGenerate.GENERATE_BIOMES`), two readers.
 */
const BIOMES = GENERATE_BIOMES;
if (!BIOMES[BIOME]) {
    process.stderr.write(`generate-seedling-level: biome "${BIOME}" is not available — `
        + `this build ships [${Object.keys(BIOMES).join(', ')}].\n`);
    process.exit(2);
}

const say = (line) => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const bounds = {
    obstacleTarget: COUNT,
    triesPerStep: TRIES,
    saturationK: SATURATION_K,
    anchorTriesPerCandidate: ANCHOR_TRIES,
};

if (has('cost')) {
    /** ⚠ 139 ms is slice 1's own worst measured empty-room solve. */
    const cost = costModel(bounds, 139);
    say(JSON.stringify(cost, null, 2));
    process.exit(0);
}

const t0 = Date.now();
let out;
try {
    out = generateSeedlingLevel({ seed: SEED, palette: BIOMES[BIOME], bounds, budget: BUDGET });
} catch (e) {
    /**
     * ⛔ AN ABORT PRINTS ITS EVIDENCE AND EXITS 3 — a distinct code, because
     * "the room could not be generated" and "the engine threw inside the
     * oracle" are different things to a caller. `GenerationAborted` carries
     * the trace up to the abort precisely so this branch has something to
     * print (see its docblock: the measured case is the solver's own drive
     * clipping lethal terrain in a dense room).
     */
    if (e.name !== 'GenerationAborted') throw e;
    note(`ABORTED: ${e.message}`);
    say(JSON.stringify({
        seed: SEED, biome: BIOME, bounds, aborted: true,
        cause: { name: e.cause?.name ?? null, message: e.cause?.message ?? null },
        trace: e.trace,
    }, null, 2));
    process.exit(3);
}
const elapsedMs = Date.now() - t0;

/**
 * ⛔ THE PAYLOAD — everything that must be identical between two runs of one
 * seed, and NOTHING that is allowed to differ. No `ms`, nothing derived from
 * one. The LEVEL is the atlas record itself (⚖ kickoff §2: the atlas-record
 * JSON IS the PoC's level format), so this file is loadable by anything that
 * can read the atlas.
 */
const payload = {
    generator: 'scripts/procgen/generate-seedling-level.mjs',
    seed: SEED,
    biome: BIOME,
    bounds,
    budget: out.summary.budget,
    summary: out.summary,
    level: out.record,
    trace: out.trace,
};

if (has('json')) {
    say(JSON.stringify(payload, null, 2));
} else {
    const s = out.summary;
    say(`# generated Seedling level — seed ${SEED}, biome ${BIOME}`);
    say('');
    say(`room:   ${out.record.width}x${out.record.height} tiles, level ${out.record.level}`);
    say(`start:  (${s.startCell.tx},${s.startCell.ty})   goal: ${s.goalClass} at cell `
        + `(${s.goalCell.tx},${s.goalCell.ty}) = OEL (${s.goalOel.x},${s.goalOel.y})`);
    say(`items:  ${JSON.stringify(s.items)}   pins: [${s.pins.join(', ')}]`);
    say(`bounds: obstacleTarget=${bounds.obstacleTarget} triesPerStep=${bounds.triesPerStep} `
        + `saturationK=${bounds.saturationK} `
        + `anchorTriesPerCandidate=${bounds.anchorTriesPerCandidate}`);
    say(`budget: maxTicksPerTarget=${s.budget.maxTicksPerTarget} `
        + '(⛓ TICKS, not milliseconds — the budget is a property of the candidate, so '
        + 'this run reproduces on a loaded box)');
    say('');
    say(`stop:   ${s.stop}${s.stop === STOP.SATURATED
        ? ` — ${bounds.saturationK} consecutive steps kept nothing` : ''}`);
    say(`kept:   ${s.keptCount} obstacle(s) over ${s.attempts} attempt(s); `
        + `solve ${s.skeletonTicks} ticks (skeleton) -> ${s.finalTicks} ticks (final)`);
    say(`draws:  ${s.drawsSpent}, rng state ${s.rngState}`);
    say('');
    say('## per family');
    for (const [family, c] of Object.entries(s.byFamily)) {
        say(`  ${family.padEnd(12)} kept ${c.kept}  reverted ${c.reverted}  `
            + `illegal ${c.illegal}  no-anchor ${c.noAnchor}`);
    }
    say('');
    say('## the generation trace');
    for (const r of out.trace) {
        // ⛓ THE INSTANCE LABEL, not the roster key (GENERATE-mode UI slice 2)
        // — `wall-segment(ori=v,len=4)` and `wall-segment(ori=h,len=2)` are two
        // different obstacles, and a trace that called both `wall-segment`
        // would print a key where a reader needs a geometry.
        say(`  step ${String(r.step).padStart(2)}.${r.try} `
            + `${String(r.instance ?? r.template ?? '(skeleton)').padEnd(30)} `
            + `${r.at ? `@(${r.at.tx},${r.at.ty})`.padEnd(9) : ''.padEnd(9)} `
            + `${r.outcome.padEnd(18)} ${r.verdict ?? '-'}`
            + `${r.ticks !== null ? ` ${r.ticks} ticks` : ''}`);
        if (r.outcome !== ATTEMPT.KEPT) {
            say(`      classified by: ${r.classifiedBy}`);
            if (r.reasonText) say(`      reason: ${r.reasonText}`);
        }
    }
    say('');
    say(`certification: ${JSON.stringify(s.finalCertification)}`);
    say(`level sha: ${sha(out.record)}   trace sha: ${sha(out.trace)}`);
    say('');
    // ⛔ THE BIOME'S OWN exclusions, not the pre-sword list under another
    // name — the two biomes exclude different families for different measured
    // reasons, and printing one under the other's heading would be a report
    // that agrees with itself by construction.
    const excluded = BIOMES[BIOME].excluded ?? [];
    say(`## excluded from this palette (${excluded.length}), each with its measurement`);
    for (const x of excluded) {
        say(`  ${x.name.padEnd(22)} ${x.cause}`);
    }
}

if (has('out') || arg('out', '') !== '') {
    const path = arg('out', '');
    if (path.includes('fixtures/')) {
        note('generate-seedling-level: REFUSED to write under `fixtures/` — committed '
            + 'fixtures are byte-identical artifacts of recorded runs and no tool in this '
            + 'arc writes them (standing law).');
        process.exit(2);
    }
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
    note(`[stderr] wrote ${path}`);
}

note(`[timing, stderr only] ${elapsedMs} ms for ${out.trace.length} solve(s); `
    + `cost model said <= ${costModel(bounds, 139).worstCaseTotalMs} ms`);
