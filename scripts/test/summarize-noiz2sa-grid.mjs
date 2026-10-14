/**
 * Summarize `measure-noiz2sa-grid.mjs` output (one or more JSON files) into markdown tables and one merged raw JSON.
 *
 *   node scripts/test/summarize-noiz2sa-grid.mjs a.json [b.json …] [--merged out.json]
 *
 * Per cell: the per-attempt deathless rate (clears ÷ attempts — the maximum-likelihood rate of a geometric run
 * censored at max-attempts; attempts are independent draws, each on its own bot seed) with a Wilson 95% interval,
 * the first-attempt rate, censored visits, the mean seconds of a visit (a lower bound when visits are censored) and,
 * for a priced region, its mana (floor(seconds) × rate, as the drain charges) against the planned cost. Per scene of
 * a span: the conditional pass rate (attempts that got past the scene ÷ attempts that reached it) against the model's
 * `sceneChance`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const mi = args.indexOf('--merged');
const mergedPath = mi >= 0 ? args[mi + 1] : null;
const files = args.filter((a, i) => a.endsWith('.json') && (mi < 0 || i !== mi + 1));
const FPS = 62.5;

/** Wilson 95% interval of k successes in n */
export function wilson(k, n, z = 1.96) {
    if (!n) return [0, 1];
    const p = k / n; const d = 1 + z * z / n;
    const c = (p + z * z / (2 * n)) / d; const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
}
const sceneName = (i) => `${Math.floor(i / 10) + 1}:${i % 10 === 9 ? 'boss' : (i % 10) + 1}`;
const f3 = (x) => x.toFixed(3);

export function cellStats(c) {
    const att = c.visits.flat();
    const clears = att.filter((x) => x.c).length;
    const [lo, hi] = wilson(clears, att.length);
    const first = c.visits.filter((v) => v[0].c).length;
    const censored = c.visits.filter((v) => !v.at(-1).c).length;
    const secs = c.visits.map((v) => v.reduce((a, x) => a + x.f, 0) / FPS);
    const meanE = secs.reduce((a, b) => a + b, 0) / secs.length;
    const scenes = c.model.scenes.map((s) => {
        const reached = att.filter((x) => x.c || x.h >= s.index).length;
        const hit = att.filter((x) => !x.c && x.h === s.index).length;
        const [l, h] = wilson(reached - hit, reached);
        return { scene: sceneName(s.index), model: s.p, reached, passed: reached - hit, rate: reached ? (reached - hit) / reached : null, lo: l, hi: h };
    });
    const mana = c.rate ? c.visits.reduce((a, v, k) => a + Math.floor(secs[k]) * c.rate, 0) / c.visits.length : null;
    return { label: c.label, span: c.spanText, skill: c.skill, modelP: c.model.p, modelMeasured: c.model.measured, modelE: c.model.seconds,
        attempts: att.length, clears, p: clears / att.length, lo, hi, visits: c.visits.length, first, censored, meanE, scenes,
        rate: c.rate ?? null, planned: c.planned ?? null, mana, picked: c.picked ?? null };
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const cells = files.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).cells);
    const stats = cells.map(cellStats);
    console.log('| cell | span | skill | model p | measured p (95% CI) | attempts | visits | censored | first-attempt | E model (s) | E measured (s) | E ratio |');
    console.log('|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const s of stats) {
        console.log(`| ${s.label} | ${s.span} | ${s.skill} | ${f3(s.modelP)}${s.modelMeasured ? '' : '×'} | ${f3(s.p)} (${f3(s.lo)}–${f3(s.hi)}) | ${s.attempts} | ${s.visits} | ${s.censored} | ${s.first}/${s.visits} `
            + `| ${s.modelE.toFixed(1)} | ${s.meanE.toFixed(1)}${s.censored ? '+' : ''} | ${(s.meanE / s.modelE).toFixed(2)} |`);
    }
    console.log('\n| cell | scene | model p | in-span pass rate (95% CI) | reached |');
    console.log('|---|---|---:|---|---:|');
    for (const s of stats) if (s.scenes.length > 1) for (const sc of s.scenes) console.log(`| ${s.label} | ${sc.scene} | ${f3(sc.model)} | ${sc.rate === null ? '—' : `${f3(sc.rate)} (${f3(sc.lo)}–${f3(sc.hi)})`} | ${sc.reached} |`);
    const priced = stats.filter((s) => s.rate);
    if (priced.length) {
        console.log('\n| region | span | skill | rate | planned | measured mana | ratio |');
        console.log('|---|---|---:|---:|---:|---:|---:|');
        for (const s of priced) console.log(`| ${s.label} | ${s.span} | ${s.skill} | ${s.rate} | ${s.planned} | ${s.mana.toFixed(1)}${s.censored ? '+' : ''} | ${(s.mana / s.planned).toFixed(2)} |`);
    }
    if (mergedPath) fs.writeFileSync(mergedPath, JSON.stringify({ meta: JSON.parse(fs.readFileSync(files[0], 'utf8')).meta, cells: cells.map((c, k) => ({ ...c, summary: { ...stats[k] } })) }) + '\n');
}
