#!/usr/bin/env node
/**
 * census-seedling-areas — **THE AREA CENSUS**: how many AREAS a Seedling
 * skeleton offers, per kind, per knob, per seed, per biome — and what a lock on
 * every boundary cell would cost out of the 30 persistence tags.
 *
 * PROCGEN ELEMENTS arc 3, slice 4b (D2). ⚖ Arc-1 §9.1's discipline and
 * `census-seedling-sites.mjs`' shape, one family over: **measure the subject
 * before sizing a knob against it** (trap 254). The area BINDING (D3) is sized
 * against these numbers; a slice that shipped `--areas=1` and measured
 * afterwards would be adjudicating an acceptance rate nobody swept.
 *
 * ── ⛔ IT IS A MEASUREMENT, NOT A GATE (the house sweep law) ───────────
 *
 * Nothing here decides anything: it builds a MODEL per (kind, seed, biome) and
 * reads `model.areaPartition()`. **NO area graph is built, no template is
 * placed and NO ORACLE IS CALLED**, so a cell costs a carve, an element
 * construction and three floods, and the whole table runs in seconds.
 *
 * ⛓ THE ELEMENT SPEC IS THE BIOME'S DEFAULT (`defaultElementsFor`, slice 4c
 * §13.3) rather than `none`, because the guard's DECLARED area is one of the
 * areas the graph will see and a census run without it would measure a room the
 * generator does not generate. ⚠ A REFUSED element declares nothing, which is
 * why the `elem` column counts placements rather than specs.
 *
 * ⛓ IT NAMES WHAT IT BOUNDED (`feedback_bounded_sweep_must_name_what_it_
 * bounded`): the kinds, the seeds and the biomes are printed in the header.
 *
 * Run:
 *   node scripts/procgen/census-seedling-areas.mjs
 *   node scripts/procgen/census-seedling-areas.mjs --kinds=winding;chambers=2 --seeds=1-4
 *   node scripts/procgen/census-seedling-areas.mjs --json=/tmp/areas.json
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));

const { defaultElementsFor, seedlingModel } = await M('seedlingDemo/procgenSeedling.js');
const { PRE_SWORD_PALETTE, POST_SWORD_PALETTE } = await M('seedlingDemo/procgenPalette.js');
const { parseSkeleton } = await M('procgenCore/skeletonKinds.js');
const { TAGS_PER_LEVEL } = await M('seedlingDemo/breakableRocks.js');
const { formatElementSpec } = await M('procgenCore/elementSpec.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

/**
 * ⛓ THE KIND LADDER IS THE SITE CENSUS's (§8.3) PLUS THE `chambers=2` ARMS OF
 * THE FOUR OTHER TREE KINDS — the cells D6's `chambers` default is about.
 */
const DEFAULT_KINDS = [
    'empty', 'winding', 'branchy', 'bushy', 'loopy', 'open',
    'rooms', 'rooms;minRoom=2', 'rooms;minRoom=4',
    'winding;chambers=1', 'winding;chambers=2',
    'branchy;chambers=2', 'bushy;chambers=2', 'loopy;chambers=2', 'open;chambers=2',
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
const JSON_OUT = arg('json', '');
const BIOMES = [['pre', PRE_SWORD_PALETTE], ['post', POST_SWORD_PALETTE]];

const say = (line = '') => process.stdout.write(`${line}\n`);
const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const range = (xs) => (xs.length === 0 ? '—' : `${Math.min(...xs)}..${Math.max(...xs)}`);

say('# SEEDLING AREA CENSUS');
say('');
say(`kinds:  ${KINDS.join(', ')}`);
say(`seeds:  ${SEEDS[0]}..${SEEDS[SEEDS.length - 1]} (${SEEDS.length})`);
say('biomes: pre-sword and post-sword, each at its OWN default element spec '
    + `(\`${formatElementSpec(defaultElementsFor(PRE_SWORD_PALETTE.items))}\` / `
    + `\`${formatElementSpec(defaultElementsFor(POST_SWORD_PALETTE.items))}\`) `
    + '— ⛓ slice 4c §13.3');
say('room:   10x10, one screen — ⛔ not an axis, ⚖ arc-3 ruling 7');
say('cost:   one carve + one element construction + the partition per cell; '
    + 'NO area graph, NO template, NO solve.');
say('');
const rows = [];
for (const kindSpec of KINDS) {
    for (const [biome, palette] of BIOMES) {
        for (const seed of SEEDS) {
            const skeleton = parseSkeleton(kindSpec,
                { simulator: false, substrate: 'the area census' });
            let model = null;
            let error = null;
            try {
                model = seedlingModel({ seed, skeleton,
                    elements: defaultElementsFor(palette.items) });
            } catch (e) {
                error = `${e.name}: ${e.message.slice(0, 70)}`;
            }
            if (error) { rows.push({ kind: kindSpec, biome, seed, error }); continue; }
            const p = model.areaPartition();
            const real = p.areas.filter((a) => a.kind === 'chamber' && !a.synthetic);
            const element = p.areas.filter((a) => a.kind === 'element');
            const vestibule = p.areas.filter((a) => a.kind === 'goal');
            const synthetic = p.areas.filter((a) => a.synthetic);
            const goalArea = p.areas.find((a) => a.id === p.goalArea) ?? null;
            const entArea = p.areas.find((a) => a.id === p.entranceArea) ?? null;
            /**
             * ⛓⛓⛓ **THE TAG WORST CASE, BOTH WAYS** — D5's question is *does
             * every boundary LOCK need a tag of its own?*, and the two answers
             * cost very different numbers, so both are printed and the as-built
             * says which one the binding ships.
             *
             *  · `tagsPerCell` — one tag per LOCK CELL: every boundary cell of
             *    every non-entrance area, plus the element's own.
             *  · `tagsPerGroup` — one tag per KEY GROUP (all the locks of one
             *    symbol write one durable bit, together), plus one for that
             *    key's flag, plus the element's own.
             */
            const lockable = p.areas.filter((a) => a.id !== p.entranceArea);
            const boundaryCells = lockable.reduce((n, a) => n + a.boundary.length, 0);
            const elementTags = model.elements.ran
                ? Object.keys(model.elements.placed[0].tags ?? {}).length : 0;
            rows.push({
                kind: kindSpec,
                biome,
                seed,
                areas: p.areas.length,
                real: real.length,
                element: element.length,
                synthetic: synthetic.length,
                vestibule: vestibule.length,
                deadFloor: p.deadFloorCells,
                adjacency: p.adjacency.length,
                corridorComponents: p.corridorComponents.length,
                largestBoundary: Math.max(0, ...p.areas.map((a) => a.boundary.length)),
                goalSynthetic: goalArea?.synthetic ?? null,
                goalSize: goalArea?.size ?? null,
                goalBoundary: goalArea?.boundary.length ?? null,
                entSynthetic: entArea?.synthetic ?? null,
                share: p.entranceArea !== null && p.entranceArea === p.goalArea,
                elem: model.elements.ran ? model.elements.placed[0].element : null,
                elementTags,
                boundaryCells,
                tagsPerCell: boundaryCells + elementTags + 1,
                /** 1 goal tag + the element's + 2 per key (flag + its lock group) */
                tagsPerGroup1: 1 + elementTags + 2,
                tagsPerGroup2: 1 + elementTags + 4,
                /**
                 * ⛓⛓⛓ THE PREDICTED ACCEPTANCE at 1 and 2 keys, from the
                 * PARTITION alone (`buildAreaGraph`'s own structural refusals,
                 * restated): it needs at least two areas, the entrance and the
                 * goal in different ones, and one area per key level able to
                 * HOLD its symbol — a cell that is not a boundary cell (where
                 * its own locks go), not the START and not the GOAL.
                 *
                 * ⛔⛔ **AND THE GOAL'S OWN AREA IS NOT A HOLDER**, which is a
                 * correction this census made to its own first draft. The goal
                 * ends at the HIGHEST key level (`buildAreaGraph` retries
                 * otherwise), so the symbol that OPENS it cannot live inside it
                 * — a key behind its own lock. The first predictor counted the
                 * goal's VESTIBULE as a holder and answered "12/12 admits" for
                 * every bare tree kind, where the honest answer is 0: a bare
                 * corridor room's only two areas are the entrance's 1-cell
                 * synthetic (all boundary, no free cell) and the goal's
                 * vestibule.
                 */
                holders: p.areas.filter((a) => {
                    if (a.id === p.goalArea) return false;
                    const b = new Set(a.boundary.map((c) => `${c.x},${c.y}`));
                    return a.cells.some((c) => !b.has(`${c.x},${c.y}`)
                        && !(c.x === model.defaults.start.tx && c.y === model.defaults.start.ty)
                        && !(c.x === model.goalCell.tx && c.y === model.goalCell.ty));
                }).length,
            });
        }
    }
}

const ok = rows.filter((r) => !r.error);
say('## Per kind x biome — the roll-up over the seeds (mean, then the range)');
say('');
say('| kind | biome | areas | REAL | elem | synth | dead floor | adj | largest boundary | '
    + 'goal synthetic | ent==goal | holders (ex goal) | elem placed |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const byCell = new Map();
for (const r of rows) {
    const k = `${r.kind}|${r.biome}`;
    if (!byCell.has(k)) byCell.set(k, []);
    byCell.get(k).push(r);
}
for (const [k, rs] of byCell) {
    const [kind, biome] = k.split('|');
    const good = rs.filter((r) => !r.error);
    if (good.length === 0) { say(`| ${kind} | ${biome} | ALL ${rs.length} THREW |`); continue; }
    say(`| \`${kind}\` | ${biome} `
        + `| ${fmt(mean(good.map((r) => r.areas)))} (${range(good.map((r) => r.areas))}) `
        + `| **${fmt(mean(good.map((r) => r.real)))}** (${range(good.map((r) => r.real))}) `
        + `| ${good.filter((r) => r.element > 0).length}/${good.length} `
        + `| ${fmt(mean(good.map((r) => r.synthetic)))} `
        + `| ${fmt(mean(good.map((r) => r.deadFloor)))} `
        + `| ${fmt(mean(good.map((r) => r.adjacency)))} `
        + `| ${fmt(mean(good.map((r) => r.largestBoundary)))} `
            + `(${range(good.map((r) => r.largestBoundary))}) `
        + `| ${good.filter((r) => r.vestibule > 0).length}/${good.length} `
        + `| **${good.filter((r) => r.share).length}/${good.length}** `
        + `| ${fmt(mean(good.map((r) => r.holders)))} (${range(good.map((r) => r.holders))}) `
        + `| ${good.filter((r) => r.elem).length}/${good.length} |`);
}
say('');
say(`## THE TAG WORST CASE — against \`TAGS_PER_LEVEL\` = ${TAGS_PER_LEVEL}`);
say('');
say('| kind | biome | element tags | boundary cells (max) | ONE TAG PER CELL (max) | '
    + 'ONE TAG PER GROUP, 1 key | 2 keys |');
say('|---|---|---|---|---|---|---|');
for (const [k, rs] of byCell) {
    const [kind, biome] = k.split('|');
    const good = rs.filter((r) => !r.error);
    if (good.length === 0) continue;
    const worstCell = Math.max(...good.map((r) => r.tagsPerCell));
    say(`| \`${kind}\` | ${biome} `
        + `| ${range(good.map((r) => r.elementTags))} `
        + `| ${Math.max(...good.map((r) => r.boundaryCells))} `
        + `| ${worstCell}${worstCell > TAGS_PER_LEVEL ? ' ⛔ OVER' : ''} `
        + `| ${Math.max(...good.map((r) => r.tagsPerGroup1))} `
        + `| ${Math.max(...good.map((r) => r.tagsPerGroup2))} |`);
}
say('');
say('## Per cell — kind x biome x seed');
say('');
say('| kind | biome | seed | areas | REAL | elem | synth | goal area | ent==goal | '
    + 'largest boundary | holders | dead | element |');
say('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    if (r.error) { say(`| \`${r.kind}\` | ${r.biome} | ${r.seed} | ⛔ ${r.error} |`); continue; }
    say(`| \`${r.kind}\` | ${r.biome} | ${r.seed} | ${r.areas} | ${r.real} | ${r.element} `
        + `| ${r.synthetic} | ${r.goalArea ?? '-'}${r.vestibule ? ' (VESTIBULE)' : ''}`
        + ` size ${r.goalSize} | ${r.share ? '**YES**' : 'no'} | ${r.largestBoundary} `
        + `| ${r.holders} | ${r.deadFloor} | ${r.elem ?? '—'} |`);
}
say('');
say('## THE PREDICTION THIS CENSUS MAKES (structural refusals only)');
say('');
const predict = (r, keys) => {
    if (r.error) return 'THREW';
    if (r.areas <= 1) return 'the-partition-yields-one-area-or-fewer';
    if (r.share) return 'the-entrance-and-the-goal-share-one-area';
    if (r.holders < keys) return 'no-area-can-hold-its-key';
    return 'ADMITS';
};
say('| kind | biome | admits 1 key | admits 2 keys | the refusals it meets at 1 key |');
say('|---|---|---|---|---|');
for (const [k, rs] of byCell) {
    const [kind, biome] = k.split('|');
    const why = {};
    for (const r of rs) {
        const p1 = predict(r, 1);
        if (p1 !== 'ADMITS') why[p1] = (why[p1] ?? 0) + 1;
    }
    say(`| \`${kind}\` | ${biome} `
        + `| **${rs.filter((r) => predict(r, 1) === 'ADMITS').length}/${rs.length}** `
        + `| ${rs.filter((r) => predict(r, 2) === 'ADMITS').length}/${rs.length} `
        + `| ${Object.entries(why).map(([n, c]) => `${n} ${c}`).join(' · ') || '—'} |`);
}

if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({ kinds: KINDS, seeds: SEEDS, rows }, null, 2)}\n`);
    process.stderr.write(`[stderr] wrote ${JSON_OUT}\n`);
}
