#!/usr/bin/env node
/**
 * census-seedling-elements — **DOES A REVERSE-PULL GADGET FIT A SEEDLING ROOM
 * AT ALL, AND IN WHICH ORIENTATION?** — PROCGEN ELEMENTS arc 3 slice 3 D1(b),
 * extended by arc 5 slice 2 (the oriented pick) and slice 1's SIZE axis.
 *
 * ⚖ Arc-3 ruling 7: **the room does not grow.** So the census's job is to say
 * which `len` fits and where, honestly, before anything is built around the
 * answer — the maze's own §10.1 shape (`procgen-elements-arc2-kickoff.md`),
 * carried over. It is ALL GEOMETRY: kinds x SIZES x seeds x `len` x the site
 * pick, counted, with **no solve at all** (the certification is a different
 * question and `sweep-yield-table.mjs --substrate=seedling --elements=` is
 * where it is asked). The whole table runs in a few seconds.
 *
 * ── ⛓⛓⛓ ARC 5 SLICE 2: **THE SITE IS THE ELEMENT'S OWN SNUG FOOTPRINT** ───
 *
 * The binding used to size a `len + SITE_MARGIN_STRAIGHT` SQUARE; it now asks
 * the element (`elements.assertFootprints`), which declares `len+2` along the
 * pull axis by `EXIT_RUN+1 = 4` across, offered BOTH ways round. ⛔ This file
 * calls the ELEMENT's own `reversePullFootprint` rather than re-spelling the
 * arithmetic — a detector carrying its own copy of production measures the
 * copy (trap 417).
 *
 * ⛓ **AND THE ORIENTATION IS COUNTED**, in the DRAWN arm and the ANY-SITE one.
 * A pick that never chooses one of the declared shapes is a finding about the
 * enumeration order, and a column is the only thing that can raise it.
 *
 * ⛔ **EVERY ROLL-UP IS KEYED ON SIZE.** A `no-site-fits-this-room` count is a
 * claim about ONE room's interior; adding a 10x10 count to a 20x20 one is trap
 * 383's shape.
 *
 * ── THREE ARMS, AND EACH ANSWERS A DIFFERENT QUESTION ─────────────────
 *
 *   SITES     — how many candidate rectangles exist at all, at BOTH margins:
 *               `len+2` (the turns-0 minimum this binding ships) and `len+4`
 *               (`procgenMaze.SITE_MARGIN`, sized for bent gadgets). ⛔ Pure
 *               arithmetic over the room, the start and the goal; no element.
 *   DRAWN     — what the BINDING really produces, through `seedlingModel`
 *               itself, i.e. at the one site `roomRng.pick` takes. This is the
 *               number generation gets.
 *   ANY-SITE  — does ANY candidate site work, over every one of them with a
 *               stream derived from the site's own cell. It answers ruling 7's
 *               question — *is there anywhere in this room a gadget goes?* — on
 *               rooms where the DRAWN site refused.
 *
 * ⚠⚠ **ANY-SITE IS NOT AN UPPER BOUND ON DRAWN, AND THE TABLE SHOWS IT** (e.g.
 * `rooms` len 2: DRAWN 4, ANY-SITE 3). The two arms spend DIFFERENT STREAMS: the
 * walk inside `construct` is drawn, so one (site, stream) pair can build a gadget
 * where another refuses `WALK_NOT_FOUND` or lands a mouth on the border. ⇒ the
 * honest reading of the ANY column is *"at least one (site, stream) pair works on
 * N of 12 seeds"*, never *"the most the room can do"*. Calling it a ceiling would
 * be the trap-269 shape — an ECHO of one draw read as a VALUE about the room.
 *
 * ⛔ Every refusal is counted BY NAME, which is what makes the table actionable
 * rather than a yield number. ⚠ In the ANY-SITE columns the reasons are counted
 * per SEED (the set of reasons its candidate sites produced), never per site —
 * otherwise a seed with 19 candidates would outvote one with 2.
 *
 * Run:
 *   node scripts/procgen/census-seedling-elements.mjs
 *   node scripts/procgen/census-seedling-elements.mjs --kinds=winding --seeds=6 --lens=2
 *   node scripts/procgen/census-seedling-elements.mjs --sizes=10x10,12x12,15x15,20x20
 *   node scripts/procgen/census-seedling-elements.mjs --json=/tmp/census.json
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));

const { SEEDLING_DEFAULTS, seedlingModel } = await M('seedlingDemo/procgenSeedling.js');
const { terrainAt } = await M('seedlingDemo/procgenLevel.js');
const {
    SITE_MARGIN_STRAIGHT, compositeSeedlingElement, seedlingElementSiteCandidates,
} = await M('seedlingDemo/procgenSeedlingElements.js');
const { REVERSE_PULL_BLOCK, reversePullFootprint } = await M('procgenCore/elements/reversePullBlock.js');
const { assertRoomSize } = await M('seedlingDemo/procgenLevel.js');
const { parseSkeleton } = await M('procgenCore/skeletonKinds.js');
const { rngFor } = await M('seedlingDemo/procgenRng.js');

/** ⛓ THE MAZE's margin, named rather than retyped as a magic 4 — the census
 *  exists partly to say that this value fits nothing here. */
const MAZE_SITE_MARGIN = 4;

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`)
    .slice(`--${n}=`.length);
const KINDS = arg('kinds', 'empty,winding,branchy,bushy,loopy,open,rooms,rooms;minRoom=4,'
    + 'winding;chambers=2,loopy;chambers=2').split(',').filter(Boolean);
const SEEDS = (() => {
    const spec = arg('seeds', '12');
    if (/^\d+$/.test(spec)) {
        const out = [];
        for (let s = 1; s <= Number(spec); s += 1) out.push(s);
        return out;
    }
    return spec.split(',').map(Number);
})();
const LENS = arg('lens', '2,3,4').split(',').map(Number);
/**
 * ⛓⛓ **SIZE IS AN AXIS** — arc 5, slice 1 gave the room a width/height channel
 * and slice 2 reads it here, because every number in this table is about ONE
 * room: `no-site-fits-this-room` at 130 of 360 is a claim about a 10x10 room's
 * 8x8 interior and says nothing about a 15x15 one (trap 383 — a subject found
 * with a different instrument is a different subject). ⛔ The DEFAULT stays
 * `10x10`, which is the room every committed number was measured in.
 */
const SIZES = arg('sizes', '10x10').split(',').filter(Boolean).map((spec) => {
    const m = /^(\d+)x(\d+)$/.exec(spec.trim());
    if (!m) {
        process.stderr.write(`census-seedling-elements: --sizes= member "${spec}" is not WxH.\n`);
        process.exit(2);
    }
    const size = { width: Number(m[1]), height: Number(m[2]) };
    try {
        assertRoomSize(size, 'census-seedling-elements');
    } catch (e) {
        process.stderr.write(`census-seedling-elements: ${e.message}\n`);
        process.exit(2);
    }
    return { ...size, label: `${size.width}x${size.height}` };
});
const JSON_OUT = arg('json', '');

/** One (site, len) tried on one room, through the SAME functions the binding uses. */
function tryAt({ model, goal, len, site, rng, W, H }) {
    const concrete = REVERSE_PULL_BLOCK.instantiate(rng, { len, turns: 0 });
    const out = concrete.construct(site);
    if (out.refused) return { refused: out.refused.reason };
    const sk = model.skeleton();
    const composed = compositeSeedlingElement({
        width: W, height: H,
        groundAt: (x, y) => terrainAt(sk, x, y) === 'ground',
        site, placement: out, start: model.defaults.start, goal,
    });
    return composed.refused ? { refused: composed.refused.reason } : { placed: composed.placed };
}

/**
 * ⛓⛓⛓ **THE SHIPPED SITE SHAPE IS THE ELEMENT'S OWN DECLARATION** (arc 5,
 * slice 2). Until this slice the census read `len + SITE_MARGIN_STRAIGHT` and
 * squared it, because the BINDING did; now the binding asks the element, so
 * the census asks the same function rather than re-spelling the arithmetic
 * (trap 417 — a detector with its own copy of production measures the copy).
 * ⛔ `SITE_MARGIN_STRAIGHT` is still printed, as the number the square arm
 * used, so the two columns are comparable to slice 1's table.
 */
const footprintsFor = (len) => reversePullFootprint({ len, turns: 0 });
const shapeOf = (fs) => fs.map((f) => `${f.w}x${f.h}`).join(' / ');

const rows = [];
for (const kind of KINDS) {
    const skeleton = parseSkeleton(kind, { simulator: false, substrate: 'the elements census' });
    for (const size of SIZES) {
        const W = size.width;
        const H = size.height;
        const defaults = { width: W, height: H };
        for (const len of LENS) {
            const footprints = footprintsFor(len);
            const row = { kind, size: size.label, len,
                shapeShipped: shapeOf(footprints), sizeMaze: len + MAZE_SITE_MARGIN,
                marginStraight: SITE_MARGIN_STRAIGHT,
                seeds: SEEDS.length, sitesShipped: [], sitesMaze: [],
                drawn: {}, orient: {}, any: 0, anyOrient: {}, anyWhy: {} };
            for (const seed of SEEDS) {
                /**
                 * ⛔ THE DRAWN ARM IS THE BINDING ITSELF, not a re-implementation
                 * of it: `seedlingModel` spends the real stream (goal, then the
                 * element's `len`/site/walk, then the carve) and returns its own
                 * graded refusal. A prototype that picked its own site would
                 * certify a distribution nobody generates.
                 */
                const mod = seedlingModel({ seed, skeleton, defaults,
                    elements: { name: 'guard', params: { len } } });
                const key = mod.elements.ran ? 'PLACED' : mod.elements.refused.reason;
                row.drawn[key] = (row.drawn[key] ?? 0) + 1;
                /** ⛓⛓ WHICH DECLARED ORIENTATION THE DRAW TOOK — arc 5, slice
                 *  2's own gate. A pick that never chooses `tall` is a finding
                 *  about the enumeration order, not a shrug, so it is COUNTED. */
                if (mod.elements.ran) {
                    const o = mod.elements.siteOrient ?? 'unnamed';
                    row.orient[o] = (row.orient[o] ?? 0) + 1;
                }

                const bare = seedlingModel({ seed, skeleton, defaults });
                const goal = bare.goalCell;
                const cs = seedlingElementSiteCandidates({ width: W, height: H,
                    start: bare.defaults.start, goal, footprints });
                row.sitesShipped.push(cs.length);
                row.sitesMaze.push(seedlingElementSiteCandidates({ width: W, height: H,
                    start: bare.defaults.start, goal,
                    footprints: [{ w: row.sizeMaze, h: row.sizeMaze, orient: 'square' }] }).length);
                if (cs.length === 0) {
                    row.anyWhy['no-site-fits-this-room'] = (row.anyWhy['no-site-fits-this-room'] ?? 0) + 1;
                    continue;
                }
                let ok = null;
                const why = new Set();
                for (const s of cs) {
                    /** ⚠ A DIFFERENT STREAM PER SITE, derived from the site's own
                     *  cell, so one site's walk cannot decide another's — and the arm
                     *  is reproducible without being the binding's own draw. */
                    const r = tryAt({ model: bare, goal, len, site: s,
                        rng: rngFor(seed * 1000 + s.x * 31 + s.y), W, H });
                    if (r.placed) { ok = s; break; }
                    why.add(r.refused);
                }
                if (ok) {
                    row.any += 1;
                    const o = ok.orient ?? 'unnamed';
                    row.anyOrient[o] = (row.anyOrient[o] ?? 0) + 1;
                } else for (const w of why) row.anyWhy[w] = (row.anyWhy[w] ?? 0) + 1;
            }
            rows.push(row);
        }
    }
}

const say = (l) => process.stdout.write(`${l}\n`);
const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `\`${k}\` ${v}`).join(' · ') || '—';
const range = (a) => `${Math.min(...a)}..${Math.max(...a)}`;

say('# THE SEEDLING ELEMENTS CENSUS — geometry only, no solve');
say('');
say(`sizes: ${SIZES.map((z) => z.label).join(', ')} · start `
    + `(${SEEDLING_DEFAULTS.start.tx},${SEEDLING_DEFAULTS.start.ty}) · `
    + `${KINDS.length} kind(s) x ${SEEDS.length} seed(s) x len [${LENS.join(', ')}]`);
say('');
say('⛓ THE SHIPPED SITE IS THE ELEMENT\'S OWN SNUG FOOTPRINT, offered in BOTH');
say(`orientations (arc 5, slice 2) — \`len+${SITE_MARGIN_STRAIGHT}\` along the pull axis by 4`);
say('across. The MAZE column is the square that binding still sizes for a BENT lane.');
say('');
say('| kind | size | len | snug footprint(s) | cand sites | '
    + `site len+${MAZE_SITE_MARGIN} (maze) | cand sites | DRAWN placed | orientation | `
    + 'ANY-SITE placed | drawn outcomes | why ANY failed |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    say(`| ${r.kind} | ${r.size} | ${r.len} | ${r.shapeShipped} | ${range(r.sitesShipped)} `
        + `| ${r.sizeMaze}x${r.sizeMaze} | ${range(r.sitesMaze)} `
        + `| **${r.drawn.PLACED ?? 0}**/${r.seeds} | ${fmt(r.orient)} | **${r.any}**/${r.seeds} `
        + `| ${fmt(r.drawn)} | ${fmt(r.anyWhy)} |`);
}
say('');
const total = (pick, from = rows) => {
    const acc = {};
    for (const r of from) for (const [k, n] of Object.entries(pick(r))) acc[k] = (acc[k] ?? 0) + n;
    return acc;
};
/** ⛔ KEYED BY SIZE. A roll-up that added a 10x10 count to a 15x15 one would be
 *  trap 383's shape: one number over two different rooms. */
for (const size of SIZES) {
    const mine = rows.filter((r) => r.size === size.label);
    const cells = mine.length * SEEDS.length;
    say(`## rolled up over every cell — **${size.label}**, ${cells} (kind, len, seed) cells`);
    say('');
    say(`DRAWN: ${fmt(total((r) => r.drawn, mine))}`);
    say('');
    say(`DRAWN placements BY ORIENTATION: ${fmt(total((r) => r.orient, mine))}`);
    say('');
    say(`ANY-SITE placements BY ORIENTATION: ${fmt(total((r) => r.anyOrient, mine))}`);
    say('');
    say(`ANY-SITE failures: ${fmt(total((r) => r.anyWhy, mine))}`);
    say('');
    const mazeZero = mine.filter((r) => Math.max(...r.sitesMaze) === 0);
    say(`⛓ **the maze's \`SITE_MARGIN = ${MAZE_SITE_MARGIN}\` offers ZERO candidate sites in `
        + `${mazeZero.length} of ${mine.length} (kind, len) cells** — `
        + `${[...new Set(mazeZero.map((r) => `len ${r.len}`))].sort().join(', ') || '—'}`);
    say('');
}

if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({ kinds: KINDS, sizes: SIZES.map((z) => z.label),
        seeds: SEEDS, lens: LENS,
        marginShipped: SITE_MARGIN_STRAIGHT, marginMaze: MAZE_SITE_MARGIN, rows }, null, 1)}\n`);
    process.stderr.write(`[stderr] wrote ${JSON_OUT}\n`);
}
