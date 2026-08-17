#!/usr/bin/env node
/**
 * census-seedling-elements — **DOES A REVERSE-PULL GADGET FIT A 10x10 SEEDLING
 * ROOM AT ALL?** — PROCGEN ELEMENTS arc 3, slice 3, D1(b).
 *
 * ⚖ Arc-3 ruling 7: **the room does not grow.** So the census's job is to say
 * which `len` fits and where, honestly, before anything is built around the
 * answer — the maze's own §10.1 shape (`procgen-elements-arc2-kickoff.md`),
 * carried over. It is ALL GEOMETRY: kinds x seeds x `len` x the site pick,
 * counted, with **no solve at all** (the certification is a different question
 * and `sweep-yield-table.mjs --substrate=seedling --elements=` is where it is
 * asked). The whole table runs in a few seconds.
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
const { REVERSE_PULL_BLOCK } = await M('procgenCore/elements/reversePullBlock.js');
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
const JSON_OUT = arg('json', '');

const W = SEEDLING_DEFAULTS.width;
const H = SEEDLING_DEFAULTS.height;

/** One (site, len) tried on one room, through the SAME functions the binding uses. */
function tryAt({ model, goal, len, site, rng }) {
    const concrete = REVERSE_PULL_BLOCK.instantiate(rng, { len, turns: 0 });
    const out = concrete.construct(site);
    if (out.refused) return { refused: out.refused.reason };
    const sk = model.skeleton();
    const composed = compositeSeedlingElement({
        width: W, height: H,
        groundAt: (x, y) => terrainAt(sk, x, y) === 'ground',
        site, placement: out, start: SEEDLING_DEFAULTS.start, goal,
    });
    return composed.refused ? { refused: composed.refused.reason } : { placed: composed.placed };
}

const rows = [];
for (const kind of KINDS) {
    const skeleton = parseSkeleton(kind, { simulator: false, substrate: 'the elements census' });
    for (const len of LENS) {
        const row = { kind, len,
            sizeShipped: len + SITE_MARGIN_STRAIGHT, sizeMaze: len + MAZE_SITE_MARGIN,
            seeds: SEEDS.length, sitesShipped: [], sitesMaze: [],
            drawn: {}, any: 0, anyWhy: {} };
        for (const seed of SEEDS) {
            /**
             * ⛔ THE DRAWN ARM IS THE BINDING ITSELF, not a re-implementation of
             * it: `seedlingModel` spends the real stream (goal, then the element's
             * `len`/site/walk, then the carve) and returns its own graded
             * refusal. A prototype that picked its own site would certify a
             * distribution nobody generates.
             */
            const mod = seedlingModel({ seed, skeleton,
                elements: { name: 'guard', params: { len } } });
            const key = mod.elements.ran ? 'PLACED' : mod.elements.refused.reason;
            row.drawn[key] = (row.drawn[key] ?? 0) + 1;

            const bare = seedlingModel({ seed, skeleton });
            const goal = bare.goalCell;
            const cs = seedlingElementSiteCandidates({ width: W, height: H,
                start: SEEDLING_DEFAULTS.start, goal, size: row.sizeShipped });
            row.sitesShipped.push(cs.length);
            row.sitesMaze.push(seedlingElementSiteCandidates({ width: W, height: H,
                start: SEEDLING_DEFAULTS.start, goal, size: row.sizeMaze }).length);
            if (cs.length === 0) {
                row.anyWhy['no-site-fits-this-room'] = (row.anyWhy['no-site-fits-this-room'] ?? 0) + 1;
                continue;
            }
            let ok = false;
            const why = new Set();
            for (const s of cs) {
                /** ⚠ A DIFFERENT STREAM PER SITE, derived from the site's own
                 *  cell, so one site's walk cannot decide another's — and the arm
                 *  is reproducible without being the binding's own draw. */
                const r = tryAt({ model: bare, goal, len, site: s,
                    rng: rngFor(seed * 1000 + s.x * 31 + s.y) });
                if (r.placed) { ok = true; break; }
                why.add(r.refused);
            }
            if (ok) row.any += 1;
            else for (const w of why) row.anyWhy[w] = (row.anyWhy[w] ?? 0) + 1;
        }
        rows.push(row);
    }
}

const say = (l) => process.stdout.write(`${l}\n`);
const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `\`${k}\` ${v}`).join(' · ') || '—';
const range = (a) => `${Math.min(...a)}..${Math.max(...a)}`;

say('# THE SEEDLING ELEMENTS CENSUS — geometry only, no solve');
say('');
say(`room ${W}x${H} (interior ${W - 2}x${H - 2}) · start `
    + `(${SEEDLING_DEFAULTS.start.tx},${SEEDLING_DEFAULTS.start.ty}) · `
    + `${KINDS.length} kind(s) x ${SEEDS.length} seed(s) x len [${LENS.join(', ')}]`);
say('');
say(`| kind | len | site len+${SITE_MARGIN_STRAIGHT} (shipped) | cand sites | `
    + `site len+${MAZE_SITE_MARGIN} (maze) | cand sites | DRAWN placed | ANY-SITE placed | `
    + 'drawn outcomes | why ANY failed |');
say('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    say(`| ${r.kind} | ${r.len} | ${r.sizeShipped}x${r.sizeShipped} | ${range(r.sitesShipped)} `
        + `| ${r.sizeMaze}x${r.sizeMaze} | ${range(r.sitesMaze)} `
        + `| **${r.drawn.PLACED ?? 0}**/${r.seeds} | **${r.any}**/${r.seeds} `
        + `| ${fmt(r.drawn)} | ${fmt(r.anyWhy)} |`);
}
say('');
const total = (pick) => {
    const acc = {};
    for (const r of rows) for (const [k, n] of Object.entries(pick(r))) acc[k] = (acc[k] ?? 0) + n;
    return acc;
};
say('## rolled up over every cell');
say('');
say(`DRAWN: ${fmt(total((r) => r.drawn))}`);
say('');
say(`ANY-SITE failures: ${fmt(total((r) => r.anyWhy))}`);
say('');
const mazeZero = rows.filter((r) => Math.max(...r.sitesMaze) === 0);
say(`⛓ **the maze's \`SITE_MARGIN = ${MAZE_SITE_MARGIN}\` offers ZERO candidate sites in `
    + `${mazeZero.length} of ${rows.length} (kind, len) cells** — `
    + `${[...new Set(mazeZero.map((r) => `len ${r.len}`))].sort().join(', ')}`);

if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({ kinds: KINDS, seeds: SEEDS, lens: LENS,
        marginShipped: SITE_MARGIN_STRAIGHT, marginMaze: MAZE_SITE_MARGIN, rows }, null, 1)}\n`);
    process.stderr.write(`[stderr] wrote ${JSON_OUT}\n`);
}
