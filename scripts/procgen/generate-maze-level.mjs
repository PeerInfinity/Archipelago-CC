#!/usr/bin/env node
/**
 * generate-maze-level — THE MAZE'S CLI TWIN of `generate-seedling-level.mjs`.
 *
 * CONSTRUCTIVE-MODE arc, slice 2 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.2). Seed + bounds in; a generated maze level and its FULL
 * generation trace out. One loop, one model, one oracle — this script owns no
 * generation logic at all: it parses arguments, calls
 * `mazeRoom/procgenMaze.generateMazeLevel`, and prints.
 *
 * ── ⛔ STDOUT IS THE DETERMINISM CHANNEL ──────────────────────────────
 *
 * The Seedling CLI's law, inherited: everything that may honestly differ
 * between two runs of one seed — milliseconds, this machine's speed — goes to
 * STDERR and never to stdout. So
 *
 *     node … --seed=1 --json > a; node … --seed=1 --json > b; cmp a b
 *
 * is the determinism proof rather than a ritual, in two SEPARATE PROCESSES (one
 * process proves the generator is a function; two prove it depends on nothing
 * the process carries).
 *
 * ── ⛓ AND `--verify` RUNS EXACTLY THAT, HERE ──────────────────────────
 *
 * ⛔ It spawns **two children**, not one child compared against this process:
 * a parent that had already imported the modules and drawn nothing is not the
 * same starting condition, and a check whose two arms are asymmetric can pass
 * for a reason neither arm names. Each child is a fresh `node`, and the two
 * payloads are compared byte for byte with their md5 printed.
 *
 * ── WHY THE MAZE IS CHEAP WHERE SEEDLING IS NOT ───────────────────────
 *
 * The Seedling CLI prints a COST MODEL up front because its oracle is a
 * synchronous, uninterruptible solver run whose ceiling is minutes. The maze's
 * oracle is an exact BFS over `cells x 2^items` states — 242 of them in the
 * default room — so a whole run is milliseconds and the cost model is printed
 * only when asked (`--cost`). ⚠ That is a fact about the SUBSTRATE and not
 * about the loop: the arithmetic (`1 + target x tries x anchorTries` solves) is
 * the same function, called with a much smaller worst case.
 *
 * ⛔ NOTHING IS WRITTEN TO `fixtures/`, EVER (standing law). `--out` writes
 * where it is told; without it the payload is stdout.
 *
 * Run:
 *   node scripts/procgen/generate-maze-level.mjs --seed=1
 *   node scripts/procgen/generate-maze-level.mjs --seed=1 --json
 *   node scripts/procgen/generate-maze-level.mjs --seed=1 --verify
 *   node scripts/procgen/generate-maze-level.mjs --seed=1 --count=12 --width=5 --height=5
 *   node scripts/procgen/generate-maze-level.mjs --cost --count=8
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const CORE = (p) => import(join(HERE, '..', '..', 'frontend/modules/procgenCore', p));
const MAZE = (p) => import(join(HERE, '..', '..', 'frontend/modules/mazeRoom', p));

const { ATTEMPT, STOP, costModel } = await CORE('levelGenerator.js');
const { formatSkeleton, parseSkeleton } = await CORE('skeletonKinds.js');
const { formatAreaSpec, formatRequireList, parseAreaSpec, parseRequireList } =
    await CORE('areaSpec.js');
const {
    DEFAULT_MAZE_BUDGET, MAZE_PALETTE, generateMazeLevel, serializeMazeLevel,
} = await MAZE('procgenMaze.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);
const num = (name, fallback) => Number(arg(name, fallback));

const say = (line) => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const SEED = num('seed', 1);
const COUNT = num('count', 6);
const TRIES = num('tries', 8);
const SATURATION_K = num('k', 3);
const ANCHOR_TRIES = num('anchortries', 1);
const WIDTH = num('width', 11);
const HEIGHT = num('height', 11);
const BUDGET = { maxExpansions: num('expansions', DEFAULT_MAZE_BUDGET.maxExpansions) };
/**
 * ⛓ CONSTRUCTIVE-MODE SLICE 5 — the room the loop starts from. The default is
 * the OPEN room this CLI has always generated, so `--skeleton` absent produces
 * exactly the level it produced before the kinds existed. ⛔ An unknown or
 * unofferable kind refuses BY NAME through `assertKind` inside the binding —
 * this file does not keep a second list.
 */
/**
 * ⛓⛓ SLICE 7 — AND ITS PARAMETERS, in the SAME `;` grammar the URL speaks:
 * `--skeleton='rooms;minRoom=2;chambers=1'` (quote it — `;` is the shell's).
 */
const SKELETON = parseSkeleton(arg('skeleton', 'empty'),
    { simulator: true, substrate: 'the maze CLI' });
/**
 * ⛓⛓ PROCGEN ELEMENTS arc 1 slice 2 — THE AREA GRAPH, through the ONE codec
 * (`procgenCore/areaSpec.js`), which is the same string slice 3's `?areas=` will
 * read: `--areas=1`, `--areas='2;graphify=0.5;goalShortcut=0'` (quote it — `;`
 * is the shell's). ⛔ The default is `0` and at `0` the binding does not
 * partition, does not call the module and spends no draw, so this CLI's payload
 * is byte-identical to the one it printed before areas existed.
 */
const AREAS = parseAreaSpec(arg('areas', '0'));
/**
 * ⛓⛓⛓ SLICE 3 — THE RULE-DIRECTED DIRECTIVE, through the same codec:
 * `--require=K0,K1`. ⛔ ABSENT is no directive at all (and the payload then
 * carries no `require` field, so these bytes are unchanged); an EMPTY
 * `--require=` REFUSES, because a directive somebody emptied is not the same as
 * no directive. ⛔ EXIT 6 when it is refused — a REFUSED RUN is not a run that
 * produced what was asked for, and a caller scripting this must be able to tell
 * without parsing prose.
 */
const REQUIRE = process.argv.some((a) => a.startsWith('--require='))
    ? parseRequireList(arg('require', '')) : null;

const bounds = {
    obstacleTarget: COUNT,
    triesPerStep: TRIES,
    saturationK: SATURATION_K,
    anchorTriesPerCandidate: ANCHOR_TRIES,
};

if (has('cost')) {
    /**
     * ⚠ 3 ms is a generous ceiling for one maze solve: the whole state space of
     * the default room is 242 states and a run of 49 solves measures in tens of
     * milliseconds end to end. The number is stated rather than left implicit
     * so a caller raising `--count` can price it before pressing.
     */
    say(JSON.stringify(costModel(bounds, 3), null, 2));
    process.exit(0);
}

/**
 * ⛓ THE TWO-PROCESS CHECK, BUILT IN. Two fresh children, identical arguments,
 * `--json` forced so the comparison is over the PAYLOAD rather than over the
 * human report (which is derived from it and could agree for a weaker reason).
 */
if (has('verify')) {
    const childArgs = process.argv.slice(2).filter((a) => a !== '--verify' && a !== '--json');
    const run = () => execFileSync(process.execPath, [SELF, ...childArgs, '--json'], {
        encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
    });
    const a = run();
    const b = run();
    const md5 = createHash('md5').update(a).digest('hex');
    if (a !== b) {
        note(`generate-maze-level: ⛔ DRIFT — two processes at seed ${SEED} produced `
            + `different payloads (${a.length} vs ${b.length} bytes, md5 ${md5} vs `
            + `${createHash('md5').update(b).digest('hex')}).`);
        process.exit(4);
    }
    say(`two-process identity at seed ${SEED}: IDENTICAL, ${a.length} bytes, md5 ${md5}`);
    process.exit(0);
}

const t0 = Date.now();
let out;
try {
    out = generateMazeLevel({ seed: SEED, palette: MAZE_PALETTE, bounds, budget: BUDGET,
        width: WIDTH, height: HEIGHT, skeleton: SKELETON, areas: AREAS, require: REQUIRE });
} catch (e) {
    /**
     * ⛔ AN ABORT PRINTS ITS EVIDENCE AND EXITS 3 — the Seedling CLI's own
     * distinction, because "the room could not be generated" and "something
     * threw inside the oracle" are different things to a caller.
     */
    if (e.name !== 'GenerationAborted') throw e;
    note(`ABORTED: ${e.message}`);
    say(JSON.stringify({
        seed: SEED, bounds, aborted: true,
        cause: { name: e.cause?.name ?? null, message: e.cause?.message ?? null },
        trace: e.trace,
    }, null, 2));
    process.exit(3);
}
const elapsedMs = Date.now() - t0;

/**
 * ⛔ THE PAYLOAD — everything that must be identical between two runs of one
 * seed, and NOTHING that is allowed to differ. No `ms`, nothing derived from
 * one. The LEVEL is `serializeMazeLevel`'s plain JSON (⛔ NOT the AP pipeline's
 * sidecar — see that function's docblock).
 */
const payload = {
    generator: 'scripts/procgen/generate-maze-level.mjs',
    seed: SEED,
    palette: MAZE_PALETTE.name,
    bounds,
    /**
     * ⛓ SLICE 5's block. ⚠ It is written UNCONDITIONALLY, so this CLI's `--json`
     * bytes moved by exactly this field at every kind INCLUDING the default —
     * the `level` and the `trace` did not, and the as-built records both md5s.
     * The alternative (omit it at the default) would have kept the old bytes
     * and made a payload's identity depend on which fields happened to be
     * default, which is the thing `agreementWithPayload` compares against.
     */
    skeleton: SKELETON,
    /**
     * ⛓ THE AREA BLOCK, beside `skeleton`'s — and, unlike that one, written
     * **CONDITIONALLY**: it is omitted at `--areas=0`, which is what keeps this
     * CLI's per-kind md5s byte-identical (⚖ arc ruling 3). The BOTH-SIDES
     * DEFAULT is `{keys: 0}`, so a payload written before this slice normalizes
     * to the same object a caller at the default produces and AGREES rather
     * than diverging on a field it could not have had (the `DEFAULT_SKELETON`
     * precedent, applied the other way round because ruling 3 forbids moving
     * the bytes here).
     */
    ...(AREAS.keys === 0 ? {} : { areas: { spec: AREAS, graph: out.model.areas.graph } }),
    /** ⛓ SLICE 3's block — omitted entirely when nothing was required. */
    ...(REQUIRE ? { require: out.summary.require } : {}),
    budget: out.summary.budget,
    summary: out.summary,
    level: serializeMazeLevel(out.record),
    trace: out.trace,
};

if (has('json')) {
    say(JSON.stringify(payload, null, 2));
} else {
    const s = out.summary;
    say(`# generated maze level — seed ${SEED}, palette ${MAZE_PALETTE.name}`);
    say('');
    say(`room:   ${s.width}x${s.height} tiles, skeleton ${formatSkeleton(SKELETON)}`
        + `${SKELETON.kind === 'empty' ? ' (all floor before the loop, no wall ring)' : ' (CARVED)'}`);
    if (AREAS.keys > 0) {
        const a = out.model.areas;
        say(`areas:  ${formatAreaSpec(AREAS)} — ${a.partitionSummary?.areaCount ?? 0} area(s) `
            + `(${a.partitionSummary?.syntheticCount ?? 0} synthetic), `
            + `${a.partitionSummary?.adjacencyCount ?? 0} adjacency pair(s); `
            + (a.ran
                ? `${a.graph.symbols.length} symbol(s) [${a.graph.symbols.join(', ')}], `
                    + `${a.doors.length} door(s), ${a.keys.length} key(s), `
                    + `${a.graph.edges.filter((e) => e.kind === 'graphify').length} graphify `
                    + `edge(s); ${a.graph.draws} draw(s) over ${a.graph.attempts} attempt(s)`
                : `⛔ REFUSED: ${a.refused.reason} — ${a.refused.detail}`));
    }
    if (REQUIRE) {
        const r = s.require;
        say(`requires: ${formatRequireList(REQUIRE)} — `
            + (r.refused
                ? `⛔ REFUSED: ${r.refused.reason} — ${r.refused.detail}`
                : r.met.map((m) => `${m.symbol} MET (${m.grade}): the goal is ${m.planWith} `
                    + `step(s) away WITH key_${m.symbol} and UNREACHABLE without it, over `
                    + `${m.doorCount} door(s)`).join('; ')));
    }
    say(`start:  (${s.entranceCell.tx},${s.entranceCell.ty})   goal: exit tile `
        + `(${s.goalCell.tx},${s.goalCell.ty})`);
    say(`items:  ${JSON.stringify(s.items)} (the player starts empty-handed)`);
    say(`bounds: obstacleTarget=${bounds.obstacleTarget} triesPerStep=${bounds.triesPerStep} `
        + `saturationK=${bounds.saturationK} `
        + `anchorTriesPerCandidate=${bounds.anchorTriesPerCandidate}`);
    say(`budget: maxExpansions=${s.budget.maxExpansions} (⛓ BFS NODES — a property of the `
        + 'candidate, so this run reproduces on a loaded box)');
    say('');
    say(`stop:   ${s.stop}${s.stop === STOP.SATURATED
        ? ` — ${bounds.saturationK} consecutive steps kept nothing` : ''}`);
    say(`kept:   ${s.keptCount} obstacle(s) over ${s.attempts} attempt(s); `
        + `solve ${s.skeletonTicks} step(s) (skeleton) -> ${s.finalTicks} step(s) (final)`);
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
        say(`  step ${String(r.step).padStart(2)}.${r.try} `
            + `${String(r.instance ?? r.template ?? '(skeleton)').padEnd(26)} `
            + `${r.at ? `@(${r.at.tx},${r.at.ty})`.padEnd(9) : ''.padEnd(9)} `
            + `${r.outcome.padEnd(18)} ${r.verdict ?? '-'}`
            + `${r.ticks !== null ? ` ${r.ticks} step(s)` : ''}`);
        if (r.outcome !== ATTEMPT.KEPT) {
            say(`      classified by: ${r.classifiedBy}`);
            if (r.reasonText) say(`      reason: ${r.reasonText}`);
        }
    }
    say('');
    say(`certification: ${JSON.stringify(s.finalCertification)}`);
    if (s.elements?.length) {
        say('');
        say('## the elements — ⚖ ruling 20\'s SOLVER-WORK RECORDS (record only; nothing decides)');
        for (const e of s.elements) {
            say(`  ${e.symbol.padEnd(4)} ${e.doorCount} door(s) @ `
                + `${e.doors.map((dd) => `(${dd.x},${dd.y})`).join(' ')}  key @ `
                + `(${e.key?.x},${e.key?.y}) in ${e.key?.area}`);
            say(`       goal plan WITHOUT its doors+key: ${e.planWithout} `
                + `(${e.expandedWithout} node(s))    WITH: ${e.planWith} `
                + `(${e.expandedWith} node(s))`);
            say(`       ⛓ DIFFERENTIAL — key removed, doors kept: `
                + `${e.planWithoutKey === null ? 'UNREACHABLE — THE LOCK IS A CUT'
                    : `still ${e.planWithoutKey} step(s) (this symbol is NOT on the only route)`}`
                + `;  key->door plan: ${e.planKeyToDoor}`);
        }
    }
    say('');
    say('## the room');
    for (let y = 0; y < out.record.height; y += 1) {
        let row = '  ';
        for (let x = 0; x < out.record.width; x += 1) {
            const key = `${x},${y}`;
            if (x === out.record.entrance.x && y === out.record.entrance.y) row += '@';
            else if (x === s.goalCell.tx && y === s.goalCell.ty) row += 'X';
            else if (out.record.obstacles.has(key)) {
                row += out.record.obstacles.get(key).startsWith('door_K') ? 'A' : 'D';
            }
            else if (out.record.items.has(key)) row += 'k';
            else row += out.record.tiles[y * out.record.width + x] === 1 ? '#' : '.';
        }
        say(row);
    }
    say('');
    say(`level sha: ${sha(serializeMazeLevel(out.record))}   trace sha: ${sha(out.trace)}`);
}

if (arg('out', '') !== '') {
    const path = arg('out', '');
    if (path.includes('fixtures/')) {
        note('generate-maze-level: REFUSED to write under `fixtures/` — committed fixtures '
            + 'are byte-identical artifacts of recorded runs and no tool in this arc writes '
            + 'them (standing law).');
        process.exit(2);
    }
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
    note(`[stderr] wrote ${path}`);
}

note(`[timing, stderr only] ${elapsedMs} ms for ${out.trace.length} solve(s); `
    + `cost model said <= ${costModel(bounds, 3).worstCaseTotalMs} ms`);

/**
 * ⛓⛓ SLICE 3 — A REFUSED DIRECTIVE IS A REFUSED RUN, AND IT SAYS SO IN THE
 * EXIT CODE. The payload (and the level) are still printed, because the
 * evidence for the refusal is IN them; what the exit code carries is that the
 * run did not produce what was asked for. ⛔ Distinct from 3 (an abort inside
 * the generator) and 4 (a two-process drift): those are defects, this is the
 * honest answer to a directive the room could not meet.
 */
if (REQUIRE && out.summary.require?.refused) {
    note(`generate-maze-level: ⛔ REQUIRE REFUSED — ${out.summary.require.refused.reason}: `
        + `${out.summary.require.refused.detail}`);
    process.exit(6);
}
