#!/usr/bin/env node
/**
 * region-map-placement-dump — **THE REGION LAYOUT AS CANONICAL JSON, ONE FILE PER WORLD** (region-map placement
 * slice: the before/after proof for source-group placement (P) and the join audit (A)).
 *
 *   node scripts/dev/region-map-placement-dump.mjs <outDir>
 *
 * For every world the Region Map's in-app rows load (`tests/testCases/regionMapTests.js`: `adventure`,
 * `seedling_playthrough`, `procgen_topdown` AP_1) plus the editor's vanilla 116 compiled as a CUSTOM set (with its
 * derived atlas), writes `<outDir>/<world>.json`: `resolveRegionLayout`'s source, group count and sizes, the
 * groups (root, placedBy, bbox, members), every display region's signed cell, every layout link `[from, to, kind,
 * dir]`, and `crossLength` — the summed Euclidean length (in cells) of the links whose ends are in different
 * groups, computed HERE so a base without `groupedStats.crossLength` dumps the same number.
 * Keys sorted, two-space indent, one trailing newline: a dump diffs line by line. Headless; no box lock.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const M = (rel) => pathToFileURL(join(REPO, 'frontend/modules', rel)).href;

const WORLDS = [
    { name: 'adventure', preset: 'adventure' },
    { name: 'seedling_playthrough', preset: 'seedling_playthrough' },
    { name: 'procgen_topdown', rules: 'frontend/presets/procgen_topdown/AP_1/AP_1_rules.json' },
    { name: 'vanilla_set_custom', vanillaSet: true },
];

const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
    return v;
};

export function canonicalDump(layout) {
    const gOf = new Map();
    layout.groups.forEach((g, gi) => g.members.forEach((m) => gOf.set(m, gi)));
    let cross = 0;
    let crossLinks = 0;
    for (const l of layout.graph.links) {
        if (gOf.get(l.from) === gOf.get(l.to)) continue;
        const a = layout.positions.get(l.from);
        const b = layout.positions.get(l.to);
        cross += Math.hypot(b.gx - a.gx, b.gy - a.gy);
        crossLinks += 1;
    }
    const { sizes, bbox, crossLength: _c, ...stats } = layout.stats;
    return sortKeys({
        source: layout.stats.source,
        start: layout.start,
        stats: { ...stats, bbox },
        groupCount: layout.groups.length,
        largestGroup: Math.max(0, ...layout.groups.map((g) => g.members.length)),
        sizes,
        crossLinks,
        crossLength: Math.round(cross * 100) / 100,
        groups: layout.groups.map((g) => ({ root: g.root, placedBy: g.placedBy, bbox: g.bbox, members: g.members })),
        positions: Object.fromEntries([...layout.positions].map(([id, p]) => [id, [p.gx, p.gy]])),
        links: layout.graph.links.map((l) => [l.from, l.to, l.kind ?? 'join', l.dir ?? null]),
    });
}

async function main() {
    const outDir = process.argv[2];
    if (!outDir) {
        console.log('usage: region-map-placement-dump.mjs <outDir>');
        process.exit(2);
    }
    const { rulesPathOf, vanillaSetRules } = await import(pathToFileURL(join(REPO, 'scripts/dev/preview-region-layout.mjs')).href);
    const { loadRegistry } = await import(pathToFileURL(join(REPO, 'scripts/procgen/reference/registry.mjs')).href);
    const { resolveRegionLayout } = await import(M('procgenCore/regionLayoutResolve.js'));
    const log = console.log;
    console.log = () => {};
    console.warn = () => {};
    console.info = () => {};
    console.error = () => {};
    await loadRegistry();
    mkdirSync(outDir, { recursive: true });
    const lines = [];
    for (const w of WORLDS) {
        let src;
        if (w.vanillaSet) src = await vanillaSetRules();
        else {
            const p = w.rules ? join(REPO, w.rules) : rulesPathOf(w.preset);
            src = { rules: JSON.parse(readFileSync(p, 'utf8')), hookCtx: {} };
        }
        const layout = resolveRegionLayout({ rules: src.rules, hookCtx: src.hookCtx });
        const d = canonicalDump(layout);
        writeFileSync(join(outDir, `${w.name}.json`), `${JSON.stringify(d, null, 2)}\n`);
        lines.push(`${w.name}: source=${d.source} groups=${d.groupCount} largest=${d.largestGroup} crossLinks=${d.crossLinks} crossLength=${d.crossLength}`);
    }
    console.log = log;
    for (const l of lines) console.log(l);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((e) => {
        console.error(e?.stack ?? String(e));
        process.exit(1);
    });
}
