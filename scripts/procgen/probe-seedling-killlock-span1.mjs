#!/usr/bin/env node
/**
 * ⛔⛔⛔ **RETIRED — PROCGEN ELEMENTS arc 3, slice 4c (2026-08-17).** ⚖ The
 * user retired the three door TEMPLATES into the room-aware ELEMENTS, and this
 * instrument's SUBJECT went with them: its subject is the span-1 corridor form of `wall-gap-spinner-killlock`, retired into the `killgate` ELEMENT (arc-3 §13.2) — which GROWS 0 wall cells on a corridor rather than drawing `span=1`, so there is no parameter left for an outcome x cost x geometry table to be about.
 *
 * ⛓ ITS LAST MEASUREMENT LIVES IN arc-3 kickoff §9b (this probe's own findings, in full) and §13.6(c).
 *
 * ⛔ IT REFUSES TO RUN rather than printing a table of zeros. A sweep whose
 * subject no longer exists still produces a well-formed table, and a reader
 * who found that table in an as-built would read the zeros as a FINDING. The
 * body below is kept verbatim — it is the record of how the measurement was
 * made, and the day a comparable subject ships it is what a new instrument
 * should be written against.
 */
process.stderr.write(
    'probe-seedling-killlock-span1: RETIRED in PROCGEN ELEMENTS arc 3 slice 4c — its subject '
    + 'retired with the three door TEMPLATES. See this file\'s header for where its '
    + 'last measurement lives. ⛔ It refuses rather than printing a table of zeros.\n',
);
process.exit(2);
/* eslint-disable */
/**
 * probe-seedling-killlock-span1 — **THE OUTCOME × COST × GEOMETRY TABLE** for
 * the span-1 corridor kill lock (`wall-gap-spinner-killlock`, `span=1`).
 *
 * PROCGEN ELEMENTS arc 3, PROBE 2b (`NewDocs/plans/procgen-elements-arc3-
 * kickoff.md` §9b). Slice 2 shipped the corridor form and its yield table
 * carried two numbers nobody could attribute: `winding`/`branchy`/`rooms`
 * REVERT more often than they KEEP, and one solve took **28,010 ms**. The
 * wave-1 sweep (`sweep-seedling-wave1-domains.mjs --kinds=`) counts outcomes
 * per (value, kind) and that is the right shape for certifying a domain and
 * the wrong shape for this question: it cannot say WHICH anchor cost the time
 * or WHAT the room looked like there (`reference_seedling_arc_traps` 275 —
 * attribute per ITEM, never per RUN).
 *
 * So this is the same measurement PER ANCHOR, with the geometry beside it:
 *
 *   · outcome — SOLVED+discharged / SOLVED-no-verb / REFUSED /
 *     BUDGET_EXHAUSTED / THREW, through the model's own `legalAt` and the
 *     Seedling oracle, the instance placed ALONE on the bare skeleton (the
 *     wave-1 instrument's bound, `--anchors=all`).
 *   · cost — `ms` and ticks. ⛔ BOTH ARE EVIDENCE COLUMNS ONLY. Nothing here
 *     decides anything and no wall clock reaches the generator
 *     (`feedback_wallclock_budget_breaks_determinism`).
 *   · the refusal or throw SENTENCE CLASS — the message with its numbers
 *     masked, which is the channel the oracle itself treats as evidence.
 *   · the geometry AT THE DOOR — the corridor's direction through the lock
 *     cell, the door's own degree, where the nub sits in compass terms,
 *     whether the nub cell was CARVED out of skeleton wall or was already
 *     ground, the nub's floor-neighbour count after the carve, and the
 *     distance from the door to the nearest BEND or junction.
 *
 * ── ⛔ WHAT IT IS NOT ─────────────────────────────────────────────────
 *
 * Not a gate, not a generation run, and not comparable to a yield table: like
 * `--anchors=all` it probes EVERY legal anchor of every seed, which is far
 * more of the space than generation ever reaches (slice 2 §9.5c makes that
 * point about the same bound's throw count). The yield table is the rate; this
 * is the anatomy.
 *
 * Run:
 *   node scripts/procgen/probe-seedling-killlock-span1.mjs
 *   node scripts/procgen/probe-seedling-killlock-span1.mjs --kinds=winding --seeds=1-3
 *   node scripts/procgen/probe-seedling-killlock-span1.mjs --json=/tmp/probe.json
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));

const {
    POST_SWORD_PALETTE, dischargesVerb,
} = await M('seedlingDemo/procgenPalette.js');
const { interiorCells, seedlingModel, seedlingOracle } = await M('seedlingDemo/procgenSeedling.js');
const { terrainAt } = await M('seedlingDemo/procgenLevel.js');
const { parseSkeleton } = await M('procgenCore/skeletonKinds.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

/** ⛓ The prompt's ladder: the six bare carved kinds plus the one knobbed room kind. */
const DEFAULT_KINDS = 'winding,branchy,bushy,loopy,open,rooms,rooms;minRoom=4';
const KINDS = arg('kinds', DEFAULT_KINDS).split(',').filter(Boolean);
const SEEDS = (() => {
    const spec = arg('seeds', '1-12');
    const m = /^(\d+)-(\d+)$/.exec(spec);
    if (!m) return spec.split(',').map(Number);
    const out = [];
    for (let s = Number(m[1]); s <= Number(m[2]); s += 1) out.push(s);
    return out;
})();
const SPAN = Number(arg('span', 1));
const JSON_OUT = arg('json', '');
/**
 * ⛓ TWO FILTERS THAT NARROW THE PROBE TO ONE ROW — `--ori=` and
 * `--anchor=tx,ty`. They exist so a single anchor can be re-run ALONE under
 * `node --cpu-prof`, which is how §9b answers *"what did the 24-second refusal
 * spend it on"* without touching the solver: the profile is an instrument the
 * subject cannot see.
 */
const ORIS = arg('ori', 'h,v').split(',').filter(Boolean);
const ONLY_ANCHOR = arg('anchor', '');

const say = (line = '') => process.stdout.write(`${line}\n`);
const note = (line) => process.stderr.write(`${line}\n`);

const KILL = POST_SWORD_PALETTE.templates.find(
    (t) => t.name === 'wall-gap-spinner-killlock',
);
if (!KILL) {
    note('probe-seedling-killlock-span1: `wall-gap-spinner-killlock` is not in the '
        + 'post-sword palette. The probe is about that row and nothing else.');
    process.exit(2);
}

/**
 * ⛔ THE SENTENCE CLASS IS THE MESSAGE WITH ITS NUMBERS MASKED — never a
 * hand-kept list of the refusals somebody remembered. Coordinates, tick counts
 * and entity ids are what differ BETWEEN anchors of one class, so masking them
 * is exactly the equivalence this table wants; a curated list would silently
 * lump a new class into "other".
 */
const sentenceClass = (message) => String(message ?? '')
    .replace(/-?\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110);

const DIRS = Object.freeze([
    { dx: 0, dy: -1, name: 'N' }, { dx: 0, dy: 1, name: 'S' },
    { dx: -1, dy: 0, name: 'W' }, { dx: 1, dy: 0, name: 'E' },
]);

const isGround = (record, tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= record.width || ty >= record.height) return false;
    return terrainAt(record, tx, ty) === 'ground';
};

const groundDirs = (record, tx, ty) => DIRS
    .filter((d) => isGround(record, tx + d.dx, ty + d.dy)).map((d) => d.name);

/**
 * The corridor's shape AT a cell, read off its floor neighbours:
 * `NS`/`EW` a straight run, `bend` two neighbours at right angles, `T`/`X` a
 * junction, `stub` a dead end, `isolated` nothing.
 */
const shapeAt = (record, tx, ty) => {
    const ds = groundDirs(record, tx, ty).join('');
    if (ds.length === 0) return 'isolated';
    if (ds.length === 1) return `stub-${ds}`;
    if (ds.length >= 4) return 'X';
    if (ds.length === 3) return 'T';
    if (ds === 'NS') return 'NS';
    if (ds === 'WE') return 'EW';
    return 'bend';
};

const isTurn = (shape) => shape === 'bend' || shape === 'T' || shape === 'X';

/** BFS over floor from a cell to the nearest BEND or junction (0 = it is one). */
const bendDistance = (record, tx, ty) => {
    const seen = new Set([`${tx},${ty}`]);
    let frontier = [{ tx, ty }];
    for (let dist = 0; dist <= record.width * record.height; dist += 1) {
        const next = [];
        for (const c of frontier) {
            if (isTurn(shapeAt(record, c.tx, c.ty))) return dist;
            for (const d of DIRS) {
                const nx = c.tx + d.dx;
                const ny = c.ty + d.dy;
                const key = `${nx},${ny}`;
                if (seen.has(key) || !isGround(record, nx, ny)) continue;
                seen.add(key);
                next.push({ tx: nx, ty: ny });
            }
        }
        if (!next.length) return -1;
        frontier = next;
    }
    return -1;
};

/**
 * ⛓ THE THREE CELLS OF THE CORRIDOR FORM, re-derived from the INSTANCE rather
 * than retyped: the door is the `doorCells` entry, the nub is the `clearer`
 * entry (which is also the only `terrain` write), and the lane is the declared
 * `clearance` cell. Reading them off the built instance is what keeps this
 * probe honest if the geometry is ever changed — which is exactly what Q4 of
 * the probe may do.
 */
const cellsOf = (instance, at) => ({
    door: { tx: at.tx + instance.doorCells[0].dx, ty: at.ty + instance.doorCells[0].dy },
    nub: { tx: at.tx + instance.clearer[0].dx, ty: at.ty + instance.clearer[0].dy },
    lane: { tx: at.tx + instance.clearance[0].dx, ty: at.ty + instance.clearance[0].dy },
});

const compass = (from, to) => {
    const dx = to.tx - from.tx;
    const dy = to.ty - from.ty;
    return `${dy < 0 ? 'N' : dy > 0 ? 'S' : ''}${dx < 0 ? 'W' : dx > 0 ? 'E' : ''}` || '·';
};

const rows = [];
const t0all = Date.now();

for (const kindSpec of KINDS) {
    for (const seed of SEEDS) {
        const skeletonSpec = parseSkeleton(kindSpec,
            { simulator: false, substrate: 'this probe' });
        const model = seedlingModel({ seed, skeleton: skeletonSpec });
        const base = model.skeleton();
        const oracle = seedlingOracle({ model, items: POST_SWORD_PALETTE.items ?? null });
        for (const ori of ORIS) {
            const instance = KILL.instantiate(null, { ori, span: SPAN });
            const anchors = interiorCells(base)
                .filter((c) => model.legalAt(base, instance, c.tx, c.ty))
                .filter((c) => !ONLY_ANCHOR || `${c.tx},${c.ty}` === ONLY_ANCHOR);
            for (const at of anchors) {
                note(`[stderr] ${kindSpec} seed ${seed} ori ${ori} @${at.tx},${at.ty}…`);
                const g = cellsOf(instance, at);
                const nubWasWall = terrainAt(base, g.nub.tx, g.nub.ty) !== 'ground';
                const record = model.place(base, instance, at);
                const row = {
                    kind: kindSpec,
                    seed,
                    ori,
                    span: SPAN,
                    anchor: `${at.tx},${at.ty}`,
                    door: `${g.door.tx},${g.door.ty}`,
                    doorShape: shapeAt(base, g.door.tx, g.door.ty),
                    doorDegree: groundDirs(base, g.door.tx, g.door.ty).length,
                    laneAt: compass(g.door, g.lane),
                    nubAt: compass(g.lane, g.nub),
                    nubCarved: nubWasWall,
                    nubNeighbours: groundDirs(record, g.nub.tx, g.nub.ty).length,
                    bendDist: bendDistance(base, g.door.tx, g.door.ty),
                };
                const t0 = Date.now();
                try {
                    const out = oracle.solve(record, { templates: [instance] });
                    row.ms = Date.now() - t0;
                    if (out.verdict === 'SOLVED') {
                        row.discharged = dischargesVerb(KILL.family, out.records);
                        row.outcome = row.discharged ? 'SOLVED+discharged' : 'SOLVED-no-verb';
                        row.ticks = out.ticks;
                        row.klass = '(solved)';
                        row.replans = out.replans ?? null;
                        row.trace = digestTrace(out.trace?.rows ?? []);
                        row.killRecords = (out.records ?? [])
                            .filter((r) => r.strategy === 'kill')
                            .map((r) => ({
                                arm: r.arm ?? null,
                                ticks: r.ticks ?? null,
                                landings: (r.landings ?? []).length,
                                cycles: (r.cycles ?? []).length,
                            }));
                    } else {
                        row.outcome = out.verdict === 'BUDGET_EXHAUSTED'
                            ? 'BUDGET_EXHAUSTED' : 'REFUSED';
                        row.ticks = out.ticksSpent ?? null;
                        row.klass = sentenceClass(out.reasonText);
                        row.reasonText = out.reasonText;
                        row.trace = digestTrace(out.rows ?? []);
                    }
                } catch (e) {
                    row.ms = Date.now() - t0;
                    row.outcome = 'THREW';
                    row.ticks = null;
                    row.klass = sentenceClass(e.message);
                    row.errorName = e.name;
                    row.reasonText = e.message;
                }
                rows.push(row);
            }
        }
    }
}
const wallMs = Date.now() - t0all;

/** ⛓ A trace is SPARSE — the digest is one entry per DECISION, in tick order. */
function digestTrace(traceRows) {
    return traceRows.map((r) => ({
        tick: r.tick,
        verb: r.strategy?.verb ?? null,
        rung: r.strategy?.rung ?? null,
        goal: r.goal?.kind ?? null,
    }));
}

// ── the tables ────────────────────────────────────────────────────────
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const fmt = (n) => (n == null ? '—' : String(n));

say('# PROBE 2b — the span-1 kill lock, PER ANCHOR: outcome × cost × geometry');
say('');
say(`command: \`node scripts/procgen/probe-seedling-killlock-span1.mjs `
    + `--kinds=${KINDS.join(',')} --seeds=${SEEDS[0]}-${SEEDS[SEEDS.length - 1]} `
    + `--span=${SPAN}\``);
say(`bound:   kinds ${KINDS.join(', ')} × seeds ${SEEDS[0]}..${SEEDS[SEEDS.length - 1]} `
    + `× ori h,v × EVERY legal span-${SPAN} anchor, the instance placed ALONE on the `
    + 'bare skeleton (the wave-1 `--anchors=all` bound).');
say(`rows:    ${rows.length} · harness wall time ${(wallMs / 1000).toFixed(1)} s`);
say('⛔ `ms` is an EVIDENCE column. Nothing here decides anything.');
say('');

say('## 1. OUTCOME × COST, per kind');
say('');
const CLASSES = ['SOLVED+discharged', 'SOLVED-no-verb', 'REFUSED', 'BUDGET_EXHAUSTED', 'THREW'];
say(`| kind | anchors | ${CLASSES.join(' | ')} | sum ms | max ms |`);
say(`|---|---|${'---|'.repeat(CLASSES.length)}---|---|`);
for (const kind of KINDS) {
    const here = rows.filter((r) => r.kind === kind);
    const counts = CLASSES.map((c) => here.filter((r) => r.outcome === c).length);
    say(`| ${kind} | ${here.length} | ${counts.join(' | ')} `
        + `| ${sum(here.map((r) => r.ms))} | ${Math.max(0, ...here.map((r) => r.ms))} |`);
}
say('');

say('## 2. COST PER OUTCOME CLASS — is the wall time REVERTS or SOLVES?');
say('');
say('| outcome | count | sum ms | max ms | mean ms | share of wall |');
say('|---|---|---|---|---|---|');
const totalMs = sum(rows.map((r) => r.ms));
for (const c of CLASSES) {
    const here = rows.filter((r) => r.outcome === c);
    if (!here.length) { say(`| ${c} | 0 | 0 | — | — | 0% |`); continue; }
    const s = sum(here.map((r) => r.ms));
    say(`| ${c} | ${here.length} | ${s} | ${Math.max(...here.map((r) => r.ms))} `
        + `| ${Math.round(s / here.length)} | ${((100 * s) / totalMs).toFixed(1)}% |`);
}
say(`| **all** | ${rows.length} | ${totalMs} | ${Math.max(...rows.map((r) => r.ms))} `
    + `| ${Math.round(totalMs / rows.length)} | 100% |`);
say('');

say('## 3. THE REFUSAL / THROW SENTENCE CLASSES');
say('');
say('| n | sum ms | outcome | class (numbers masked) |');
say('|---|---|---|---|');
const byClass = new Map();
for (const r of rows.filter((x) => x.outcome !== 'SOLVED+discharged' && x.outcome !== 'SOLVED-no-verb')) {
    const key = `${r.outcome} ${r.klass}`;
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key).push(r);
}
for (const [key, here] of [...byClass.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const [outcome, klass] = key.split(' ');
    say(`| ${here.length} | ${sum(here.map((r) => r.ms))} | ${outcome} | \`${klass}\` |`);
}
say('');

say('## 4. THE TOP-10 ANCHORS BY ms');
say('');
say('| ms | ticks | outcome | kind | seed | ori | anchor | doorShape | nub | carved | nubNbrs | bendDist |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of [...rows].sort((a, b) => b.ms - a.ms).slice(0, 10)) {
    say(`| ${r.ms} | ${fmt(r.ticks)} | ${r.outcome} | ${r.kind} | ${r.seed} | ${r.ori} `
        + `| ${r.anchor} | ${r.doorShape} | ${r.nubAt} | ${r.nubCarved ? 'CARVED' : 'ground'} `
        + `| ${r.nubNeighbours} | ${r.bendDist} |`);
}
say('');

say('## 4b. WHAT THE WORST ANCHORS SPENT IT ON — the decision trace, per anchor');
say('');
say('⛓ A trace is SPARSE: one entry per DECISION, `tick: verb/rung`. A refusal carries '
    + 'the rows the refused pass had emitted. ⛔ **`ticks` is what the run DROVE; the `ms` '
    + 'may be spent entirely before the first tick** — that is the reading this section '
    + 'exists to make visible.');
say('');
for (const r of [...rows].sort((a, b) => b.ms - a.ms).slice(0, 5)) {
    const t = (r.trace ?? []).map((e) => `${e.tick}:${e.verb ?? '?'}/${e.rung ?? '-'}`);
    say(`- **${r.ms} ms · ${r.outcome} · ${r.kind} seed ${r.seed} ori ${r.ori} `
        + `@${r.anchor}** — ticks ${fmt(r.ticks)}, trace ${t.length} row(s)`
        + `${t.length ? `: ${t.slice(0, 24).join(' · ')}${t.length > 24 ? ' …' : ''}` : ''}`
        + `${r.killRecords?.length
            ? ` · kill record(s): ${r.killRecords.map((k) => `${k.arm} ${k.ticks}t `
                + `${k.landings} landing(s) ${k.cycles} strike cycle(s)`).join('; ')}`
            : ''}`
        + `${r.replans == null ? '' : ` · replans ${r.replans}`}`);
    if (r.reasonText) say(`  - \`${r.reasonText.slice(0, 300)}\``);
}
say('');

say('## 5. GEOMETRY vs OUTCOME');
say('');
const bucket = (label, groups) => {
    say(`### ${label}`);
    say('');
    say(`| ${label} | n | ${CLASSES.join(' | ')} | max ms |`);
    say(`|---|---|${'---|'.repeat(CLASSES.length)}---|`);
    for (const [name, here] of groups) {
        const counts = CLASSES.map((c) => here.filter((r) => r.outcome === c).length);
        say(`| ${name} | ${here.length} | ${counts.join(' | ')} `
            + `| ${Math.max(0, ...here.map((r) => r.ms))} |`);
    }
    say('');
};
const groupBy = (f) => {
    const m = new Map();
    for (const r of rows) {
        const k = String(f(r));
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(r);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
};
bucket('door shape (the corridor at the lock)', groupBy((r) => r.doorShape));
bucket('nub side (from the lane)', groupBy((r) => `${r.ori} → ${r.nubAt}`));
bucket('nub CARVED vs already ground', groupBy((r) => (r.nubCarved ? 'CARVED' : 'ground')));
bucket('nub floor-neighbours after the carve', groupBy((r) => r.nubNeighbours));
bucket('door distance to the nearest bend/junction', groupBy((r) => r.bendDist));

if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({
        kinds: KINDS, seeds: SEEDS, span: SPAN, oris: ORIS, wallMs, rows,
    }, null, 2)}\n`);
    note(`wrote ${JSON_OUT}`);
}
