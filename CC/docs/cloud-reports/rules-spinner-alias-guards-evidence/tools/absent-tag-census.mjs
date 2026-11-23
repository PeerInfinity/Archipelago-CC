#!/usr/bin/env node
/**
 * absent-tag-census.mjs — slice `rules-spinner-alias-guards`, out-of-scope item (3): how the GAME's loader turns an
 * ABSENT `@tag` into an int, per element (read off `vendor/seedling/src/Game.as`'s `xml.objects[0].<el>` lines), against
 * the engine's `tagOf` (absent → -1), over every placement of the committed map.
 *
 *   node CC/docs/cloud-reports/rules-spinner-alias-guards-evidence/tools/absent-tag-census.mjs
 *
 * Loader forms: `o.@tag` passed raw to an `int` parameter → `int("")` = 0; `optionalTag(o.@tag)` → -1
 * (Game.as:1894-1900); `String(o.@tag) == "" ? -1 : …` (teleporter, Game.as:2387) → -1; no `@tag` in the call → the
 * constructor default (FORCED_TAG or the class's own).
 */
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const game = readFileSync(join(ROOT, 'vendor/seedling/src/Game.as'), 'utf8');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const { tagOf, FORCED_TAG } = await import(pathToFileURL(join(ROOT, 'frontend/modules/seedlingDemo/levelWorld.js')).href);
const { ALIAS_WRITER_TYPES } = await import(pathToFileURL(join(ROOT, 'frontend/modules/seedlingDemo/outOfBandAliases.js')).href);

const form = new Map();
// Each loader's text runs from its `for each (o in xml.objects[0].<el>)` to the next one (multi-line loaders: rope).
const loaders = [...game.matchAll(/for each \(o in xml\.objects\[0\]\.(\w+)\)/g)];
loaders.forEach((h, k) => {
    const body = game.slice(h.index, k + 1 < loaders.length ? loaders[k + 1].index : h.index + 2000);
    let f = 'no @tag in the call';
    if (/optionalTag\(o\.@tag\)/.test(body)) f = 'optionalTag → -1';
    else if (/String\(o\.@tag\)\s*==\s*""/.test(body)) f = 'String=="" → -1';
    else if (/o\.@tag/.test(body)) f = 'raw o.@tag → int("") = 0';
    if (!form.has(h[1])) form.set(h[1], { form: f, line: game.slice(0, h.index).split('\n').length });
});
console.log(`loader forms: ${[...new Set([...form.values()].map((v) => v.form))].map((f) => `${f}: ${
    [...form.values()].filter((v) => v.form === f).length}`).join('; ')}`);
// The committed map, then every generated preset's DELIVERED set (`assembleGeneratedSeedlingSet`), room by room.
const { assembleGeneratedSeedlingSet } = await import(pathToFileURL(join(ROOT, 'frontend/modules/seedlingDemo/seedlingGeneratedSet.js')).href);
const corpora = [['vanilla map', MAP.levels]];
const { readdirSync } = await import('node:fs');
for (const d of readdirSync(join(ROOT, 'frontend/presets')).filter((n) => n.startsWith('seedling_generated_')).sort()) {
    const rules = JSON.parse(readFileSync(join(ROOT, 'frontend/presets', d, 'AP_1/AP_1_rules.json'), 'utf8'));
    const { set } = assembleGeneratedSeedlingSet(rules, { selfPlayer: 1 });
    corpora.push([d, set.rooms.map((r, i) => ({ level: i, entities: r.source.record?.entities ?? [] }))]);
}
const rows = new Map();
for (const [corpus, levels] of corpora) for (const l of levels) for (const e of l.entities) {
    if (e.attrs?.tag !== undefined && e.attrs.tag !== '') continue;
    const f = form.get(e.type);
    if (!f) continue;
    const game0 = f.form.startsWith('raw') ? 0 : null;
    const model = tagOf(e.type, e.attrs);
    if (game0 === null || model === game0 || FORCED_TAG[e.type] !== undefined) continue;
    const k = `${corpus}|${e.type}`;
    if (!rows.has(k)) rows.set(k, { corpus, type: e.type, line: f.line, n: 0, levels: new Set(), writer: ALIAS_WRITER_TYPES[e.type] ?? null });
    rows.get(k).n += 1; rows.get(k).levels.add(l.level);
}
console.log(`corpora: ${corpora.map(([c, ls]) => `${c} (${ls.length} rooms)`).join(', ')}\n`);
console.log('| corpus | element | Game.as line | absent-@tag placements | levels | model tagOf | game | -1 writer class |');
console.log('|---|---|---|---|---|---|---|---|');
let total = 0;
for (const r of [...rows.values()].sort((a, b) => b.n - a.n)) {
    total += r.n;
    console.log(`| ${r.corpus} | \`${r.type}\` | ${r.line} | ${r.n} | ${[...r.levels].sort((a, b) => a - b).join(', ')} | -1 | 0 | ${r.writer ?? '—'} |`);
}
console.log(`\ntotal placements where the model reads -1 and the loader passes int("") = 0: ${total}`);
console.log(`of them, -1 WRITER classes (would alias {N-1,29} in the model, write {N,0} in the game): ${
    [...rows.values()].filter((r) => r.writer).reduce((a, r) => a + r.n, 0)}`);
