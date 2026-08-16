#!/usr/bin/env node
/**
 * attribute-seedling-door-cut — **WHICH ANCHORS THE DOOR LAW MOVED, AND WHY**.
 *
 * PROCGEN ELEMENTS arc 3, slice 2. The `empty`-kind pairs move when the door
 * law lands, and ⚖ trap 285 says an md5 that moved is not a finding until the
 * MOVERS ARE NAMED. This is the naming instrument: it runs under the SUBJECT
 * build and, for every door-family instantiation at every legal-by-footprint
 * anchor of the bare skeleton, prints
 *
 *   · which clause of the law refuses it (CUT / START-SIDE / neither), and
 *   · what the RETIRED `doorClear` predicate would have said about the same
 *     anchor — `template.door === 'h' ? goal.ty > ty : goal.tx > tx`, retyped
 *     HERE and nowhere else, because the rule it belongs to is gone.
 *
 * ── ⛔ WHAT THE ATTRIBUTION CLAIM IS, EXACTLY ─────────────────────────
 *
 * Before this slice `wall-gap-block` and `wall-gap-lock-weigh` declared NO
 * `door`, so the old build ACCEPTED every anchor whose footprint was free and
 * which did not seal the room — including the ones where the goal sits on the
 * START's side of a full-span wall, which is a wall the walk goes round. The
 * claim the differential needs is therefore:
 *
 *   **every anchor the new law refuses is one where the old `doorClear`
 *   predicate is FALSE** — i.e. the placements that disappeared are exactly
 *   the decoration doors, and none of them is a door the old rule would have
 *   called legal.
 *
 * An anchor refused by the law where `doorClear` says TRUE is the counter-
 * example: it would mean the CUT law and the compass law disagree on the open
 * room, where they are supposed to be the same fact. The script counts them
 * and exits 1 if there are any.
 *
 * ⚠ THE CLAUSE-2 COLUMN IS NOT PART OF THAT EQUIVALENCE and is reported
 * separately: `doorClear` had no clause 2 at all (on the open room the clearer
 * lane is on the start's side by construction), so a clause-2 refusal on
 * `empty` would be a NEW refusal with no old counterpart — a finding, not a
 * contradiction. The table prints its count so the as-built can say whether it
 * is zero.
 *
 * Run:
 *   node scripts/procgen/attribute-seedling-door-cut.mjs
 *   node scripts/procgen/attribute-seedling-door-cut.mjs --kinds=empty --seeds=1-40
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));

const {
    generateSeedlingLevel, interiorCells, seedlingModel,
} = await M('seedlingDemo/procgenSeedling.js');
const {
    POST_SWORD_PALETTE, PRE_SWORD_PALETTE, enumerateValues,
} = await M('seedlingDemo/procgenPalette.js');
const { parseSkeleton } = await M('procgenCore/skeletonKinds.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const KINDS = arg('kinds', 'empty').split(',').filter(Boolean);
const SEEDS = (() => {
    const spec = arg('seeds', '1-40');
    const m = /^(\d+)-(\d+)$/.exec(spec);
    if (!m) return spec.split(',').map(Number);
    const out = [];
    for (let s = Number(m[1]); s <= Number(m[2]); s += 1) out.push(s);
    return out;
})();
const VERBOSE = process.argv.includes('--verbose');
/**
 * ⛓⛓⛓ **THE ACCUMULATED ARM** — ⚖ raised by the arc's design session,
 * 2026-08-16, and it is the half a BARE-SKELETON scan cannot see.
 *
 * On a fresh skeleton clause 2 (START-SIDE) is VACUOUS at `empty` by geometry:
 * the clearer lane sits at across `-1`, north or west of a full-span wall, and
 * the start is the fixed NW corner — so it is on the start's side by
 * construction and the column is zero for a reason that is not a measurement.
 *
 * ⛔ On an ACCUMULATED record it is not vacuous at all. Pass 2 has painted pools
 * and segments by step 3, and one of them can wall the clearer cell off from the
 * start ONCE THE DOOR IS WALLED. That is a refusal the OLD build never made — it
 * would place the door, spend a solve, and discover the room had no answer as a
 * post-solve REVERT. So this arm re-runs the scan on the record the loop really
 * had at each step, and the number it prints is *how many solves the law now
 * saves*, not a contradiction of anything `doorClear` said.
 *
 * ⚠ THE RECORD IS THE LOOP'S OWN, taken by generating at each target 1..N — not
 * a record this script assembled, which would be a second cost model for what
 * "accumulated" means.
 */
const ACCUMULATE = Number(arg('accumulate', '0'));

const say = (line = '') => process.stdout.write(`${line}\n`);

/** ⛓ THE RETIRED PREDICATE, retyped here because its rule no longer exists. */
const oldDoorClear = (door, goal, ty, tx) => (door === 'h' ? goal.ty > ty : goal.tx > tx);

const DOORS = POST_SWORD_PALETTE.templates.filter((t) => t.params.length >= 0)
    .flatMap((t) => enumerateValues(t).map((v) => t.instantiate(null, v)))
    .filter((t) => t.door !== undefined);

say('# THE DOOR LAW\'S MOVERS, NAMED (arc 3 slice 2)');
say('');
say(`command: \`node scripts/procgen/attribute-seedling-door-cut.mjs --kinds=${KINDS.join(',')} `
    + `--seeds=${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}\``);
say(`rows:    ${DOORS.length} door instantiations x ${KINDS.length} kind(s) x `
    + `${SEEDS.length} seed(s), every interior anchor of the BARE SKELETON`);
say('');

const tally = new Map();
let contradictions = 0;
for (const kindSpec of KINDS) {
    const skeleton = parseSkeleton(kindSpec, { simulator: false, substrate: 'this attribution' });
    for (const seed of SEEDS) {
        const model = seedlingModel({ seed, skeleton });
        const record = model.skeleton();
        const goal = model.goalCell;
        for (const t of DOORS) {
            const key = `${kindSpec} ${t.name}`;
            if (!tally.has(key)) {
                tally.set(key, { legal: 0, cut: 0, startSide: 0, other: 0, clash: 0 });
            }
            const row = tally.get(key);
            for (const c of interiorCells(record)) {
                const why = model.refusalAt(record, t, c.tx, c.ty);
                if (why === null) { row.legal += 1; continue; }
                const isCut = /it is NOT A CUT/.test(why);
                const isSide = /is on the GOAL side of it/.test(why);
                if (!isCut && !isSide) { row.other += 1; continue; }
                if (isSide) { row.startSide += 1; continue; }
                row.cut += 1;
                if (oldDoorClear(t.door, goal, c.ty, c.tx)) {
                    row.clash += 1;
                    contradictions += 1;
                    say(`⛔ CONTRADICTION ${kindSpec} seed=${seed} ${t.instance} at `
                        + `(${c.tx},${c.ty}): the law says NOT A CUT, the retired `
                        + `\`doorClear\` says the goal (${goal.tx},${goal.ty}) IS beyond.`);
                } else if (VERBOSE) {
                    say(`  ${kindSpec} seed=${seed} ${t.instance} (${c.tx},${c.ty}): `
                        + `NOT-A-CUT, doorClear also false (goal ${goal.tx},${goal.ty})`);
                }
            }
        }
    }
}

/**
 * ⛓ THE ACCUMULATED ARM — the same classification over the record the LOOP had.
 */
if (ACCUMULATE > 0) {
    for (const kindSpec of KINDS) {
        const skeleton = parseSkeleton(kindSpec,
            { simulator: false, substrate: 'this attribution' });
        for (const [biome, palette] of [['pre-sword', PRE_SWORD_PALETTE],
            ['post-sword', POST_SWORD_PALETTE]]) {
            for (const seed of SEEDS) {
                for (let target = 1; target <= ACCUMULATE; target += 1) {
                    let out = null;
                    try {
                        out = generateSeedlingLevel({
                            seed, palette, skeleton, bounds: { obstacleTarget: target },
                        });
                    } catch { continue; }
                    const model = out.model;
                    const record = out.record;
                    for (const t of DOORS) {
                        if (!palette.templates.some((b) => b.name === t.name)) continue;
                        const key = `${kindSpec} ACCUMULATED(${biome}) ${t.name}`;
                        if (!tally.has(key)) {
                            tally.set(key,
                                { legal: 0, cut: 0, startSide: 0, other: 0, clash: 0 });
                        }
                        const row = tally.get(key);
                        for (const c of interiorCells(record)) {
                            const why = model.refusalAt(record, t, c.tx, c.ty);
                            if (why === null) { row.legal += 1; continue; }
                            if (/is on the GOAL side of it/.test(why)) {
                                row.startSide += 1;
                                if (VERBOSE) {
                                    say(`  START-SIDE ${kindSpec} ${biome} seed=${seed} `
                                        + `target=${target} ${t.instance} (${c.tx},${c.ty})`);
                                }
                            } else if (/it is NOT A CUT/.test(why)) row.cut += 1;
                            else row.other += 1;
                        }
                    }
                }
            }
        }
    }
}

say('');
say('| kind + family | LEGAL | refused: NOT-A-CUT | refused: START-SIDE | refused: other rules '
    + '| ⛔ cut-vs-doorClear clashes |');
say('|---|---|---|---|---|---|');
for (const [key, r] of tally) {
    say(`| \`${key}\` | ${r.legal} | ${r.cut} | ${r.startSide} | ${r.other} | ${r.clash} |`);
}
say('');
say(contradictions === 0
    ? '✔ ZERO CONTRADICTIONS — every anchor the CUT clause refuses is one the retired '
        + '`doorClear` predicate also called decoration. On this kind the two laws are the '
        + 'same fact, which is what ⚖ ruling 3 asked to be MEASURED rather than assumed.'
    : `⛔ ${contradictions} CONTRADICTION(S) — the cut law and the retired compass law `
        + 'disagree; the differential\'s movers are NOT all explained.');
process.exit(contradictions === 0 ? 0 : 1);
