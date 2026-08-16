#!/usr/bin/env node
/**
 * census-seedling-doors — **THE DOOR CENSUS**: where on a Seedling skeleton is a
 * wall-with-a-gap actually a CUT, per kind, per orientation, per span, per gap?
 *
 * PROCGEN ELEMENTS arc 3, slice 2 (`NewDocs/plans/procgen-elements-arc3-
 * kickoff.md` §3.2, D2). ⚖ Trap 254, the same discipline slice 1's site census
 * ran and this file's shape is copied from: **measure the subject before sizing
 * a knob against it.** Slice 2 gives the door families a `span` PARAMETER, and
 * a domain is a claim that every value in it is one the generator can use. This
 * table is the first half of that claim (which spans CUT anything, anywhere);
 * `sweep-seedling-wave1-domains.mjs --kinds=` is the second (which of those
 * SOLVE and DISCHARGE).
 *
 * ── ⛔ IT IS A MEASUREMENT, NOT A GATE (the house sweep law) ───────────
 *
 * Nothing here decides anything and nothing here is a template. Each cell asks
 * the MODEL'S OWN `refusalAt` — never a second copy of the law — about a BARE
 * DOOR ROW: `span` cells in a line, all but one written `wall`, the remaining
 * one declared as the `doorCells`, and **NO clearer and NO entities**. So a
 * counted anchor is one where the footprint is free, the placement does not
 * seal the room, and walling the gap DISCONNECTS the goal — the two facts a
 * span domain is sized against, with the family-specific lane geometry (which
 * is what `clearer` and `clearance` add) deliberately left out.
 *
 * ⛓ The geometry comes from `procgenPalette.doorGeometry`, the same function
 * the three door families build from, so this census cannot measure a door
 * shape no template can produce.
 *
 * ⛓ IT NAMES WHAT IT BOUNDED (`feedback_bounded_sweep_must_name_what_it_
 * bounded`): kinds, seeds, orientations and the span/gap product are printed in
 * the header. No solve, no oracle, no generation.
 *
 * Run:
 *   node scripts/procgen/census-seedling-doors.mjs
 *   node scripts/procgen/census-seedling-doors.mjs --seeds=1-12 --kinds=empty,winding
 *   node scripts/procgen/census-seedling-doors.mjs --json=/tmp/doors.json
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));

const { interiorCells, seedlingModel } = await M('seedlingDemo/procgenSeedling.js');
const { doorGeometry } = await M('seedlingDemo/procgenPalette.js');
const { parseSkeleton } = await M('procgenCore/skeletonKinds.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

/**
 * ⛓ THE KIND LADDER IS THE PROMPT'S (D2) — the seven bare kinds the binding
 * offers plus the three knobbed ones the site census showed actually HAVE area,
 * so the table is readable beside `census-seedling-sites.mjs`'s own.
 */
const DEFAULT_KINDS = [
    'empty', 'branchy', 'bushy', 'loopy', 'open',
    'rooms', 'rooms;minRoom=4',
    'winding', 'winding;chambers=2', 'loopy;chambers=2',
].join(',');

const KINDS = arg('kinds', DEFAULT_KINDS).split(',').filter(Boolean);
const SEEDS = (() => {
    const spec = arg('seeds', '1-12');
    const m = /^(\d+)-(\d+)$/.exec(spec);
    if (m) {
        const out = [];
        for (let s = Number(m[1]); s <= Number(m[2]); s += 1) out.push(s);
        return out;
    }
    return spec.split(',').map(Number);
})();
const MAX_SPAN = Number(arg('maxspan', 8));
const JSON_OUT = arg('json', '');
const ORIS = ['h', 'v'];

const say = (line = '') => process.stdout.write(`${line}\n`);

/** The bare door row — geometry only; ⛔ no clearer, no entities. */
const bareDoor = (ori, span, gap) => {
    const g = doorGeometry(ori, span, gap);
    return {
        name: 'census-door',
        instance: `census-door(ori=${ori},span=${span},gap=${gap})`,
        family: 'census',
        door: ori,
        doorCells: [g.doorCell],
        clearer: [],
        footprint: g.cells,
        clearance: [],
        terrain: g.wall,
        entities: [],
    };
};

say('# SEEDLING DOOR CENSUS — where is a wall-with-a-gap a CUT?');
say('');
say(`kinds:  ${KINDS.join(', ')}`);
say(`seeds:  ${SEEDS[0]}..${SEEDS[SEEDS.length - 1]} (${SEEDS.length})`);
say(`door:   ori h,v  x  span 1..${MAX_SPAN}  x  gap 0..span-1  `
    + `(${ORIS.length * ((MAX_SPAN * (MAX_SPAN + 1)) / 2)} shapes)`);
say('anchor: every INTERIOR cell of the 10x10 room, asked through `model.refusalAt`');
say('row:    BARE — the wall and its gap only. ⛔ no clearer, no entity, NO SOLVE.');
say('');

const rows = [];
for (const kindSpec of KINDS) {
    for (const seed of SEEDS) {
        const skeleton = parseSkeleton(kindSpec, { simulator: false, substrate: 'the Seedling binding' });
        const model = seedlingModel({ seed, skeleton });
        const record = model.skeleton();
        const cells = interiorCells(record);
        for (const ori of ORIS) {
            for (let span = 1; span <= MAX_SPAN; span += 1) {
                for (let gap = 0; gap < span; gap += 1) {
                    const row = bareDoor(ori, span, gap);
                    let legal = 0;
                    for (const c of cells) {
                        if (model.refusalAt(record, row, c.tx, c.ty) === null) legal += 1;
                    }
                    rows.push({ kind: kindSpec, seed, ori, span, gap, legal });
                }
            }
        }
    }
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pick = (f) => rows.filter(f);

say('## Per kind x span — `S/N` seeds with at least one CUT anchor, then the total anchor count');
say('');
say(`| kind | ${Array.from({ length: MAX_SPAN }, (_, i) => `span ${i + 1}`).join(' | ')} |`);
say(`|---|${'---|'.repeat(MAX_SPAN)}`);
for (const kind of KINDS) {
    const cellsOut = [];
    for (let span = 1; span <= MAX_SPAN; span += 1) {
        const here = pick((r) => r.kind === kind && r.span === span);
        const seedsHit = new Set(here.filter((r) => r.legal > 0).map((r) => r.seed));
        cellsOut.push(`${seedsHit.size}/${SEEDS.length} · ${sum(here.map((r) => r.legal))}`);
    }
    say(`| ${kind} | ${cellsOut.join(' | ')} |`);
}
say('');

say('## Per kind x span x ori — total CUT anchors (over every seed and every gap)');
say('');
say(`| kind | ori | ${Array.from({ length: MAX_SPAN }, (_, i) => i + 1).join(' | ')} |`);
say(`|---|---|${'---|'.repeat(MAX_SPAN)}`);
for (const kind of KINDS) {
    for (const ori of ORIS) {
        const cellsOut = [];
        for (let span = 1; span <= MAX_SPAN; span += 1) {
            cellsOut.push(String(sum(pick((r) => r.kind === kind && r.ori === ori
                && r.span === span).map((r) => r.legal))));
        }
        say(`| ${kind} | ${ori} | ${cellsOut.join(' | ')} |`);
    }
}
say('');

say('## Per span x gap — total CUT anchors over EVERY kind and seed');
say('');
say(`| span | ${Array.from({ length: MAX_SPAN }, (_, i) => `gap ${i}`).join(' | ')} |`);
say(`|---|${'---|'.repeat(MAX_SPAN)}`);
for (let span = 1; span <= MAX_SPAN; span += 1) {
    const cellsOut = [];
    for (let gap = 0; gap < MAX_SPAN; gap += 1) {
        cellsOut.push(gap < span
            ? String(sum(pick((r) => r.span === span && r.gap === gap).map((r) => r.legal)))
            : '—');
    }
    say(`| ${span} | ${cellsOut.join(' | ')} |`);
}
say('');

if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({
        kinds: KINDS, seeds: SEEDS, oris: ORIS, maxSpan: MAX_SPAN, rows,
    }, null, 2)}\n`);
    process.stderr.write(`wrote ${JSON_OUT}\n`);
}
