#!/usr/bin/env node
/**
 * census-seedling-sites — **THE SITE CENSUS**: how many of each SITE class a
 * Seedling skeleton offers, per kind, per knob, per seed.
 *
 * PROCGEN ELEMENTS arc 3, slice 1 (`NewDocs/plans/procgen-elements-arc3-
 * kickoff.md` §3.1, deliverable 3). ⚖ Arc 1 §9.1's discipline, applied to the
 * other substrate: **measure the subject before sizing a knob against it**
 * (trap 254). Slices 2-4 size a door's `span`, an element's `len` and an area
 * count against these numbers; a slice that picked a bound first and measured
 * afterwards would be adjudicating a domain nobody swept.
 *
 * ── ⛔ IT IS A MEASUREMENT, NOT A GATE (the house sweep law) ───────────
 *
 * Nothing here decides anything: it builds a MODEL per (kind, seed) and reads
 * `model.siteSummary`. No template is placed, no oracle is called, no level is
 * generated — so a cell of this table costs a carve and a flood, and the whole
 * table runs in one process in well under a second.
 *
 * ⛓ IT NAMES WHAT IT BOUNDED (`feedback_bounded_sweep_must_name_what_it_
 * bounded`): the kinds, the knobs and the seeds are printed in the header.
 *
 * Run:
 *   node scripts/procgen/census-seedling-sites.mjs
 *   node scripts/procgen/census-seedling-sites.mjs --seeds=1-12 --kinds=empty,winding
 *   node scripts/procgen/census-seedling-sites.mjs --json=/tmp/sites.json
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));

const { seedlingModel } = await M('seedlingDemo/procgenSeedling.js');
const { parseSkeleton } = await M('procgenCore/skeletonKinds.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

/**
 * ⛓ THE KNOB LADDER IS §14.12's, VERBATIM — the constructive arc's own
 * `sweep-yield-table` cells. Reusing it rather than inventing a second one is
 * what makes this census comparable with the yield table beside it.
 */
const DEFAULT_KINDS = [
    'empty',
    'branchy', 'branchy;chambers=2',
    'bushy', 'loopy', 'open',
    'rooms', 'rooms;minRoom=2', 'rooms;minRoom=4',
    'winding', 'winding;chambers=1', 'winding;chambers=2',
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

const say = (line = '') => process.stdout.write(`${line}\n`);

const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const range = (xs) => (xs.length === 0 ? '—' : `${Math.min(...xs)}..${Math.max(...xs)}`);

say('# SEEDLING SITE CENSUS');
say('');
say(`kinds:  ${KINDS.join(', ')}`);
say(`seeds:  ${SEEDS[0]}..${SEEDS[SEEDS.length - 1]} (${SEEDS.length})`);
say('room:   10x10, one screen (`SINGLE_SCREEN_TILES`) — ⛔ not an axis, ⚖ arc-3 ruling 7');
say('cost:   one carve + the site derivation per cell; NO template, NO solve.');
say('');

const rows = [];
for (const kindSpec of KINDS) {
    for (const seed of SEEDS) {
        const skeleton = parseSkeleton(kindSpec);
        let model = null;
        let error = null;
        try {
            model = seedlingModel({ seed, skeleton });
        } catch (e) {
            error = `${e.name}: ${e.message.slice(0, 60)}`;
        }
        if (error) { rows.push({ kind: kindSpec, seed, error }); continue; }
        const s = model.siteSummary;
        const rec = model.skeleton();
        let ground = 0;
        for (let ty = 0; ty < rec.height; ty += 1) {
            for (let tx = 0; tx < rec.width; tx += 1) {
                if (rec.terrain?.[ty]?.[tx] === 'ground'
                    || model.sites) ground += 0;
            }
        }
        rows.push({
            kind: kindSpec,
            seed,
            ...s,
            goal: `${model.goalCell.tx},${model.goalCell.ty}`,
        });
    }
}

say('## Per kind — the roll-up over the seeds (mean, then the range)');
say('');
say('| kind | main | bends | branches | branch len | tips | chambers | chamber cells | '
    + 'largest chamber | corridor |');
say('|---|---|---|---|---|---|---|---|---|---|');
const byKind = new Map();
for (const r of rows) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, []);
    byKind.get(r.kind).push(r);
}
for (const [kind, rs] of byKind) {
    const ok = rs.filter((r) => !r.error);
    if (ok.length === 0) { say(`| ${kind} | ALL ${rs.length} REFUSED |`); continue; }
    const lens = ok.flatMap((r) => r.branchLengths);
    const biggest = ok.map((r) => (r.chamberSizes.length ? Math.max(...r.chamberSizes) : 0));
    say(`| ${kind} `
        + `| ${fmt(mean(ok.map((r) => r.main)))} (${range(ok.map((r) => r.main))}) `
        + `| ${fmt(mean(ok.map((r) => r.bend)))} (${range(ok.map((r) => r.bend))}) `
        + `| ${fmt(mean(ok.map((r) => r.branch)))} (${range(ok.map((r) => r.branch))}) `
        + `| ${lens.length ? range(lens) : '—'} `
        + `| ${fmt(mean(ok.map((r) => r.tip)))} (${range(ok.map((r) => r.tip))}) `
        + `| ${fmt(mean(ok.map((r) => r.chambers)))} (${range(ok.map((r) => r.chambers))}) `
        + `| ${fmt(mean(ok.map((r) => r.chamber)))} (${range(ok.map((r) => r.chamber))}) `
        + `| ${fmt(mean(biggest))} (${range(biggest)}) `
        + `| ${fmt(mean(ok.map((r) => r.corridor)))} (${range(ok.map((r) => r.corridor))}) |`);
}
say('');
say('## Per cell — kind x seed');
say('');
say('| kind | seed | goal | main | bend | branch (lengths) | tip | chambers (sizes) | corridor |');
say('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    if (r.error) { say(`| ${r.kind} | ${r.seed} | REFUSED — ${r.error} |`); continue; }
    say(`| ${r.kind} | ${r.seed} | (${r.goal}) | ${r.main} | ${r.bend} `
        + `| ${r.branch} (${r.branchLengths.join(',') || '—'}) | ${r.tip} `
        + `| ${r.chambers} (${r.chamberSizes.join(',') || '—'}) | ${r.corridor} |`);
}

if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({ kinds: KINDS, seeds: SEEDS, rows }, null, 2)}\n`);
    process.stderr.write(`wrote ${JSON_OUT}\n`);
}
