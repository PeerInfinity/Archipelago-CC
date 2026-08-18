#!/usr/bin/env node
/**
 * find-seedling-seeds — **THE SEED SEARCH BY NAMED PROPERTY** (PROCGEN ELEMENTS
 * arc 3, slice 4d, D4).
 *
 * *"Which seed gives me a level that is CERTIFIED, whose kill lock was opened
 * by a SWORD, that kept at least five templates from at least three families,
 * that did not abort, and whose `require:['hasSword']` differential grades
 * STRONG?"* — asked in one line, answered with the command that reproduces it.
 *
 * ⛔⛔ **IT IS A MEASUREMENT INSTRUMENT AND IT ASSERTS NOTHING.** No exit code
 * carries a verdict about the generator: 0 means the search ran, 2 means the
 * QUESTION was malformed. A search that finds nothing prints "0 hit(s)" and
 * exits 0, because *"no seed in 1..40 has that property"* is an answer.
 *
 * ── THE VOCABULARY (an unknown property is a USAGE ERROR, exit 2) ──────
 *
 *   `certified`        the element PLACED and its certification solve SOLVED
 *   `cause=<c>`        the element lock's `scratchClears` cause on the FINAL
 *                      level — `sword`, `water`, `pit`, `lava`, `none`
 *   `kept>=n`          at least n templates kept by pass 2
 *   `families>=n`      at least n DISTINCT families among them
 *   `noabort`          the run did not throw `GenerationAborted`
 *   `grade=<g>`        the `require` differential's grade — STRONG,
 *                      BOUND-DEPENDENT, WEAK, INERT, NOT-ESTABLISHED
 *   `elements=<head>`  the head that actually RAN
 *   `areas-accepted`   the area graph ran AND certified
 *   `saturated`        pass 2 stopped on the saturation counter
 *   `target-reached`   pass 2 reached its obstacle target
 *
 * ⚠ **WHAT YOU ASK FOR DECIDES WHAT IT COSTS.** `cause=` needs a solve of the
 * FINAL level (the generator never runs one — its last ladder solve is the
 * one the loop kept), and `grade=` needs `--require=`, whose without-arm is a
 * second real solve. A search without either is generation only. The header
 * prints which of the three the run is paying for.
 *
 * ⛓ ONE CELL PER CHILD PROCESS (the yield table's shape), in seed order, each
 * bounded by `--cellbudget=` seconds — so one pathological seed cannot end the
 * search, and a cell that outruns the bound is reported as `TIMEOUT` rather
 * than dropped.
 *
 * Run:
 *   node scripts/procgen/find-seedling-seeds.mjs --seeds=1-40 --biome=post-sword \
 *       --require=hasSword \
 *       --where='certified,cause=sword,grade=STRONG,kept>=5,families>=3,noabort'
 */

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..'));
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const CORE = (p) => import(join(REPO, 'frontend/modules/procgenCore', p));

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const typed = (name) => process.argv.some((a) => a.startsWith(`--${name}=`));
const say = (line = '') => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);
const bail = (line) => { note(`find-seedling-seeds: ${line}`); process.exit(2); };

const { DEFAULT_BOUNDS } = await CORE('levelGenerator.js');
const { parseElementSpec, parseItemRequireList, formatElementSpec } = await CORE('elementSpec.js');
const { formatAreaSpec, parseAreaSpec } = await CORE('areaSpec.js');
const { DEFAULT_BUDGET, bootStaging, solve } = await M('procgenOracle.js');
const { generateSeedlingLevel, seedlingSkeletonSpec } = await M('procgenSeedling.js');
const { formatSkeleton } = await CORE('skeletonKinds.js');
const { GENERATE_BIOMES } = await M('watchGenerate.js');
const { TILE_SIZE } = await M('levelWorld.js');
const { writeGenerateParams } = await M('watchGenerate.js');

const BIOME = arg('biome', 'post-sword');
if (!GENERATE_BIOMES[BIOME]) {
    bail(`--biome=${BIOME} is not a Seedling biome. The two are `
        + `[${Object.keys(GENERATE_BIOMES).join(', ')}].`);
}
const PALETTE = GENERATE_BIOMES[BIOME];
const SKELETON = seedlingSkeletonSpec(arg('skeleton', 'empty'));
const ELEMENTS = typed('elements') ? parseElementSpec(arg('elements', '')) : undefined;
const REQUIRE = typed('require') ? parseItemRequireList(arg('require', '')) : undefined;
const AREAS = parseAreaSpec(arg('areas', '0'));
const BOUNDS = { ...DEFAULT_BOUNDS, obstacleTarget: Number(arg('count', DEFAULT_BOUNDS.obstacleTarget)) };
const BUDGET = Object.freeze({ ...DEFAULT_BUDGET });
const CELL_BUDGET_S = Number(arg('cellbudget', 120));

/* ══════════ THE `--where=` GRAMMAR ══════════════════════════════════ */

/**
 * ⛔ A NAMED VOCABULARY, and an unknown name is a USAGE ERROR rather than a
 * predicate that quietly matches nothing. A filter nobody validated is a search
 * that reports "0 hits" for a typo, which is the worst possible answer: it looks
 * like a measurement.
 */
const PROPERTIES = Object.freeze({
    certified: { kind: 'flag', needs: [] },
    noabort: { kind: 'flag', needs: [] },
    'areas-accepted': { kind: 'flag', needs: ['areas'] },
    saturated: { kind: 'flag', needs: [] },
    'target-reached': { kind: 'flag', needs: [] },
    cause: { kind: 'eq', needs: ['finalSolve'] },
    grade: { kind: 'eq', needs: ['require'] },
    elements: { kind: 'eq', needs: [] },
    kept: { kind: 'ge', needs: [] },
    families: { kind: 'ge', needs: [] },
});

function parseWhere(text) {
    const raw = String(text ?? '').trim();
    if (raw === '') {
        bail('an EMPTY --where=. A search with no question is the whole seed range; say '
            + `one, from [${Object.keys(PROPERTIES).join(', ')}].`);
    }
    const out = [];
    for (const part of raw.split(',')) {
        const t = part.trim();
        if (t === '') bail(`the --where list ${JSON.stringify(raw)} carries an EMPTY clause.`);
        const ge = t.match(/^([a-z-]+)>=(\d+)$/);
        const eq = t.match(/^([a-z-]+)=(.+)$/);
        const name = ge ? ge[1] : (eq ? eq[1] : t);
        const p = PROPERTIES[name];
        if (!p) {
            bail(`${JSON.stringify(name)} is not a property this instrument measures. The `
                + `vocabulary is [${Object.keys(PROPERTIES).join(', ')}]. ⛔ An unknown `
                + 'property is refused rather than matched against nothing — a filter that '
                + 'silently never fires reports "0 hits" for a typo, and that reads like a '
                + 'measurement.');
        }
        if (ge && p.kind !== 'ge') bail(`property "${name}" is not a >= comparison.`);
        if (!ge && eq && p.kind !== 'eq') bail(`property "${name}" takes no value.`);
        if (!ge && !eq && p.kind !== 'flag') bail(`property "${name}" needs a value.`);
        out.push({ name, op: p.kind, value: ge ? Number(ge[2]) : (eq ? eq[2] : true), needs: p.needs });
    }
    return out;
}

const WHERE = parseWhere(arg('where', ''));
const NEEDS = new Set(WHERE.flatMap((w) => w.needs));
if (NEEDS.has('require') && REQUIRE === undefined) {
    bail('--where names `grade=`, which is the `require` DIFFERENTIAL\'s grade, and no '
        + '--require= was given. The grade is a property of a DIRECTIVE; without one there is '
        + 'nothing to grade. Say --require=<item>.');
}
if (NEEDS.has('areas') && AREAS.keys === 0) {
    bail('--where names `areas-accepted` and --areas= is 0, so the area module does not run '
        + 'at all. Say --areas=<keys>.');
}

/* ══════════ ONE CELL ═════════════════════════════════════════════════ */

function measure(seed) {
    const row = { seed, aborted: false, head: null, certified: false, kept: 0, families: 0,
        stop: null, cause: null, grade: null, met: null, areasRan: false, areasCertified: false };
    let out;
    try {
        out = generateSeedlingLevel({ seed, palette: PALETTE, bounds: BOUNDS, budget: BUDGET,
            skeleton: SKELETON, areas: AREAS, elements: ELEMENTS, require: REQUIRE });
    } catch (e) {
        row.aborted = true;
        row.error = `${e.name}: ${String(e.message).split('\n')[0].slice(0, 120)}`;
        return row;
    }
    const s = out.summary;
    row.head = out.model.elementHead?.name ?? null;
    row.certified = out.certification?.certified === true;
    row.kept = s.keptCount;
    row.families = new Set((s.kept ?? []).map((k) => k.family)).size;
    row.stop = s.stop;
    row.areasRan = Boolean(s.areas?.ran);
    row.areasCertified = Boolean(s.areas?.certified);
    if (s.require) {
        row.met = s.require.met;
        row.grade = [].concat(s.require.grade ?? []).filter(Boolean).join('+') || null;
        row.refused = s.require.refused?.reason ?? null;
    }
    /**
     * ⛓ THE CAUSE NEEDS A SOLVE OF THE **FINAL** LEVEL, which nothing else in
     * the pipeline runs — the loop's last solve is the one it kept, and the
     * certification solve is on the SKELETON. Spent only when the question asks.
     */
    if (NEEDS.has('finalSolve') && row.certified && out.model.elements.ran) {
        const p = out.model.elements.placed[0];
        const lockId = p.doorCell
            ? `lock@${p.doorCell.x * TILE_SIZE},${p.doorCell.y * TILE_SIZE}` : null;
        try {
            const solved = solve(out.record, bootStaging({ boot: out.model.boot(),
                items: PALETTE.items ?? null, pins: s.pins }), out.model.goals, BUDGET,
            { name: `find-s${seed}` });
            row.finalVerdict = solved.verdict;
            const clear = (solved.scratchClears ?? []).find((c) => c.lock === lockId) ?? null;
            row.cause = clear?.cause ?? 'none';
        } catch (e) {
            row.finalVerdict = `THREW:${e.name}`;
            row.cause = 'none';
        }
    }
    return row;
}

const matches = (row) => WHERE.every((w) => {
    switch (w.name) {
    case 'certified': return row.certified === true;
    case 'noabort': return row.aborted === false;
    case 'areas-accepted': return row.areasRan && row.areasCertified;
    case 'saturated': return row.stop === 'SATURATED';
    case 'target-reached': return row.stop === 'TARGET_REACHED';
    case 'cause': return row.cause === w.value;
    case 'grade': return row.grade === w.value;
    case 'elements': return row.head === w.value;
    case 'kept': return row.kept >= w.value;
    case 'families': return row.families >= w.value;
    default: return false;
    }
});

/** ⛓ The child arm — ONE seed, one JSON line on stdout. */
if (typed('cell')) {
    say(JSON.stringify(measure(Number(arg('cell', '0')))));
    process.exit(0);
}

/* ══════════ THE SEARCH ═══════════════════════════════════════════════ */

const [S0, S1] = arg('seeds', '1-40').split('-').map(Number);
const SEEDS = Array.from({ length: S1 - S0 + 1 }, (_, i) => S0 + i);

/** ⛓ THE COMMAND THAT REPRODUCES ONE HIT — this file's own argv, one seed. */
const commandFor = (seed) => ['node', 'scripts/procgen/generate-seedling-level.mjs',
    `--seed=${seed}`, `--biome=${BIOME}`,
    ...(SKELETON.kind === 'empty' && !SKELETON.params ? [] : [`--skeleton='${formatSkeleton(SKELETON)}'`]),
    ...(ELEMENTS === undefined ? [] : [`--elements='${formatElementSpec(ELEMENTS)}'`]),
    ...(REQUIRE === undefined ? [] : [`--require=${REQUIRE.join(',')}`]),
    ...(AREAS.keys === 0 ? [] : [`--areas='${formatAreaSpec(AREAS)}'`]),
    `--count=${BOUNDS.obstacleTarget}`].join(' ');

/**
 * ⛓⛓ THE PAGE LINK, THROUGH THE PAGE'S OWN WRITER (`watchGenerate
 * .writeGenerateParams`) — never hand-spelled, which is this repo's standing
 * law for URLs.
 *
 * ⚠⚠ AND IT DOES NOT CARRY THE ELEMENT OR THE DIRECTIVE, which is said here
 * rather than discovered by clicking. `?elements=` and `?require=` are not
 * Seedling URL parameters yet — they are slice 5a's — so this link opens the
 * DEFAULT spec at that seed, which at most hits is a DIFFERENT room (the
 * default is a `+` list and spends a `pick` the forced head does not). ⇒ the
 * CLI command beside it is the reproducing one, and making the link reproduce
 * a directed run is a concrete requirement handed to 5a.
 */
const urlFor = (seed) => `frontend/seedlingDemo/watch.html?${writeGenerateParams('', {
    seed, biome: BIOME, bounds: BOUNDS, step: BOUNDS.obstacleTarget, skeleton: SKELETON,
})}`;

const rows = [];
for (const seed of SEEDS) {
    let row;
    try {
        const outText = execFileSync('node', [join(HERE, 'find-seedling-seeds.mjs'),
            ...process.argv.slice(2).filter((a) => !a.startsWith('--cell=')
                && !a.startsWith('--json=') && !a.startsWith('--seeds=')),
            `--cell=${seed}`], { cwd: REPO, encoding: 'utf8', timeout: CELL_BUDGET_S * 1000,
            stdio: ['ignore', 'pipe', 'ignore'] });
        row = JSON.parse(outText);
    } catch (e) {
        row = { seed, aborted: true, timeout: true, error: `the cell exceeded ${CELL_BUDGET_S}s `
            + `or died: ${e.message.split('\n')[0].slice(0, 100)}` };
    }
    rows.push(row);
    note(`  seed ${seed}: ${row.timeout ? 'TIMEOUT' : (row.aborted ? 'ABORTED'
        : `${row.head ?? '-'} cert=${row.certified} kept=${row.kept}/${row.families}f`
            + `${row.cause ? ` cause=${row.cause}` : ''}${row.grade ? ` ${row.grade}` : ''}`)}`
        + `${matches(row) ? '   <-- HIT' : ''}`);
}

const hits = rows.filter(matches);
say('# find-seedling-seeds');
say('');
say(`question: \`--where=${arg('where', '')}\``);
say(`corpus:   seeds ${S0}..${S1} · biome ${BIOME} · skeleton ${formatSkeleton(SKELETON)}`
    + ` · elements ${ELEMENTS === undefined ? '(the biome default, unless a directive forces one)'
        : formatElementSpec(ELEMENTS)}`
    + ` · require ${REQUIRE === undefined ? '(none)' : REQUIRE.join(',')}`
    + ` · areas ${formatAreaSpec(AREAS)} · count ${BOUNDS.obstacleTarget}`);
say(`cost:     generation${NEEDS.has('finalSolve') ? ' + one FINAL-LEVEL solve per cell' : ''}`
    + `${REQUIRE !== undefined ? ' + the directive\'s WITHOUT arm (one solve per true boot flag)' : ''}`);
say('');
say(`**${hits.length} hit(s) in ${rows.length} cell(s)**`);
say('');
if (hits.length > 0) {
    for (const h of hits) {
        say(`### seed ${h.seed} — ${h.head} · kept ${h.kept} from ${h.families} famil${h.families === 1 ? 'y' : 'ies'}`
            + `${h.cause ? ` · cause \`${h.cause}\`` : ''}${h.grade ? ` · grade **${h.grade}**` : ''}`);
        say('');
        say(`    ${commandFor(h.seed)}`);
        say(`    ${urlFor(h.seed)}`);
        say('');
    }
}
say('## every cell');
say('');
say('| seed | outcome | head | certified | kept | families | stop | cause | grade | HIT |');
say('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    say(`| ${r.seed} | ${r.timeout ? 'TIMEOUT' : (r.aborted ? 'ABORTED' : 'ok')} `
        + `| ${r.head ?? '-'} | ${r.certified ?? '-'} | ${r.kept ?? '-'} | ${r.families ?? '-'} `
        + `| ${r.stop ?? '-'} | ${r.cause ?? '-'} | ${r.grade ?? (r.refused ?? '-')} `
        + `| ${matches(r) ? '**YES**' : ''} |`);
}
say('');
say('⛔ This instrument asserts nothing. Exit 0 means the search ran; 0 hits is an answer.');

const OUT = arg('json', '');
if (OUT) {
    writeFileSync(OUT, `${JSON.stringify({ where: arg('where', ''), biome: BIOME,
        skeleton: SKELETON, elements: ELEMENTS ?? null, require: REQUIRE ?? null,
        areas: AREAS, bounds: BOUNDS, rows, hits: hits.map((h) => h.seed) }, null, 2)}\n`);
    note(`[stderr] wrote ${OUT}`);
}
