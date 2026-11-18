#!/usr/bin/env node
/**
 * region-map-atlas-cache-dump — **THE REGION MAP MODEL AS CANONICAL JSON, BEFORE AND AFTER THE ATLAS CACHE**
 * (region-map atlas-cache slice; report `CC/docs/region-map/atlas-cache.md`).
 *
 *   node scripts/dev/region-map-atlas-cache-dump.mjs <outDir> [--svg]
 *
 * Two worlds, two files each (`<world>.before.json`, `<world>.after.json`):
 *   · `vanilla_set_custom` — the editor's vanilla 116 with the VANILLA OVERLAY compiled as a CUSTOM set
 *     (`customSetRules` below). BEFORE = the hook context the base panel passed (`_hookCtx() { return {}; }`, base
 *     `regionMapUI.js:316`). AFTER = the host entry path: the rules and the derived atlas are zipped as a BUNDLE,
 *     handed to the real `PresetUI.prototype.loadDocumentFile` (the writer), and the hook context is the real
 *     `RegionMapUI.prototype._hookCtx` (the reader) for player 1.
 *   · `seedling_playthrough` — the same two contexts, the cache STILL HOLDING the custom atlas: AFTER must be
 *     byte-identical to BEFORE.
 * Each file: the layout source, every cell (extent, tile source, its squares `[location, x, y, kind]`), the
 * unplaced locations, and every layout link `[from, to, kind, dir]` with the link-kind counts. Keys sorted, two-space
 * indent, one trailing newline. Headless; no box lock.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const M = (rel) => pathToFileURL(join(REPO, 'frontend/modules', rel)).href;

const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
    return v;
};

/**
 * ⛓ THE CUSTOM SET — `preview-region-layout.mjs`'s `vanillaSetRules`, but with the committed VANILLA OVERLAY
 * (`seedlingDemo/fixtures/seedling-vanilla-overlay.json`) instead of an empty one, so the set has items and events
 * to place. Every module is a frontend one; `deriveAtlasOf`/`rulesJsonOf` are IMPORTED, never edited.
 * @returns {{rules, atlas}} the compiled rules and the derived atlas the lab would hold beside them
 */
export async function customSetRules() {
    const [{ tileTypeForPlacement, SEEDLING_TILE_SIZE }, { loadRulesSchema }, { compileRegionAtlas }, { parseOelLevel },
        SA, { editorVanillaSet }] = await Promise.all([
        import(M('flashPanel/seedlingSemantics.js')), import(M('procgenCore/jsonSchemaFiles.js')),
        import(M('procgenPipeline/regionAtlasCompiler.js')), import(M('seedlingDemo/procgenLevelOel.js')),
        import(M('seedlingDemo/seedlingSetAdapter.js')), import(M('seedlingDemo/watchSetEditor.js')),
    ]);
    const { readFileSync } = await import('node:fs');
    const read = (rel) => JSON.parse(readFileSync(join(REPO, 'frontend/modules', rel), 'utf8'));
    const DEPS = {
        parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement, rulesSchema: loadRulesSchema(),
        /**
         * ⛔ `game: 'seedling'` — the derivation's own default (`seedlingAtlasDerivation.js`) and the maze set lab's
         * `SEEDLING_ATLAS_GAME`, which compile to `flash_seedling` (the registered substrate). NOT the watch page's
         * `'seedling-watch-edit'`: that slugs to `flash_seedling_watch_edit`, which no substrate registers, so no
         * Seedling hook runs for it and an atlas changes nothing (measured; report § Residue).
         */
        atlas: { game: 'seedling', mapDocument: 'custom-set.json' },
    };
    const V = SA.setRecord(editorVanillaSet(read('seedlingDemo/fixtures/seedling-vanilla-set.json'),
        read('flashPanel/atlases/seedling-map.json')).set, read('seedlingDemo/fixtures/seedling-vanilla-overlay.json'));
    const s = SA.createSetSession(SA.createSeedlingSetAdapter(DEPS), V, { base: { kind: 'set', set_id: V.set.set_id } });
    const { rules, atlas } = SA.rulesJsonOf(s, DEPS, { compileRegionAtlas });
    return { rules, atlas };
}

export function canonicalModel(m) {
    const links = m.layout.graph.links.map((l) => [l.from, l.to, l.kind ?? 'join', l.dir ?? null]);
    const kinds = {};
    for (const l of links) kinds[l[2]] = (kinds[l[2]] ?? 0) + 1;
    const cells = Object.fromEntries([...m.cells].map(([k, c]) => [k, {
        extent: c.extent, tileSource: c.tileSource,
        tiles: c.tiles.map((t) => [t.location, t.x, t.y, t.kind ?? 'item']),
    }]));
    const placed = [...m.cells.values()].reduce((n, c) => n + c.tiles.length, 0);
    const tileSources = {};
    for (const c of m.cells.values()) tileSources[c.tileSource] = (tileSources[c.tileSource] ?? 0) + 1;
    const squareKinds = {};
    for (const c of m.cells.values()) for (const t of c.tiles) squareKinds[t.kind ?? 'item'] = (squareKinds[t.kind ?? 'item'] ?? 0) + 1;
    return sortKeys({
        source: m.layout.stats.source,
        cellCount: m.cells.size,
        sized: [...m.cells.values()].filter((c) => c.extent).length,
        placed,
        unplacedCount: m.unplaced.length,
        unplaced: [...m.unplaced].map((u) => (typeof u === 'string' ? u : u.location ?? JSON.stringify(u))).sort(),
        linkKinds: kinds,
        tileSources,
        squareKinds,
        links,
        cells,
    });
}

/**
 * ⛓ THE PICTURE — the model drawn with the panel's own geometry (`regionMapFrames.cellFrames`, `level` mode, the
 * same frames the panel paints): each cell's frame (dashed grey = an ESTIMATED extent, solid = the level's real
 * size), its squares at their tiles (`tileCentre`), and the cross-group links between cell centres coloured by
 * kind (join grey, down orange, up blue, warp purple dashed). No art: what the slice changes is geometry.
 */
export function modelSvg(m, { cellFrames, tileCentre, framesBounds }, title) {
    const ext = new Map([...m.cells].map(([k, c]) => [k, c.extent]));
    const frames = cellFrames(m.layout.positions, ext, 'level');
    const b = framesBounds([...frames.values()]);
    const PAD = 40;
    const HEAD = 60;
    const S = 1600 / Math.max(b.x1 - b.x0, 1);
    const X = (x) => PAD + (x - b.x0) * S;
    const Y = (y) => PAD + HEAD + (y - b.y0) * S;
    const W = Math.ceil((b.x1 - b.x0) * S + PAD * 2);
    const H = Math.ceil((b.y1 - b.y0) * S + PAD * 2 + HEAD);
    const COL = { join: '#adb5bd', down: '#e8590c', up: '#1971c2', warp: '#9c36b5' };
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">`,
        `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
        `<text x="${PAD}" y="26" font-size="18" font-weight="bold">${esc(title)}</text>`];
    const d = canonicalModel(m);
    out.push(`<text x="${PAD}" y="48" font-size="13" fill="#333">${esc(`cells sized ${d.sized}/${d.cellCount} · squares ${d.placed} (${JSON.stringify(d.tileSources)}) · links ${JSON.stringify(d.linkKinds)}`)}</text>`);
    const centre = (k) => { const f = frames.get(k); return [X(f.x + f.w / 2), Y(f.y + f.h / 2)]; };
    for (const l of m.layout.graph.links) {
        if (m.groupOf.get(l.from) === m.groupOf.get(l.to)) continue;
        const [x1, y1] = centre(l.from);
        const [x2, y2] = centre(l.to);
        const k = l.kind ?? 'join';
        out.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${COL[k] ?? '#000'}" stroke-width="1.2" stroke-opacity="0.7"${k === 'warp' ? ' stroke-dasharray="4 3"' : ''}/>`);
    }
    for (const [k, f] of frames) {
        const est = f.ext.estimated;
        out.push(`<rect x="${X(f.x).toFixed(1)}" y="${Y(f.y).toFixed(1)}" width="${(f.w * S).toFixed(1)}" height="${(f.h * S).toFixed(1)}" fill="#f1f3f5" fill-opacity="0.85" stroke="${est ? '#868e96' : '#212529'}" stroke-width="1"${est ? ' stroke-dasharray="3 2"' : ''}/>`);
        for (const t of m.cells.get(k).tiles) {
            const c = tileCentre(f, t.x, t.y);
            out.push(`<rect x="${(X(c.x) - 2.5).toFixed(1)}" y="${(Y(c.y) - 2.5).toFixed(1)}" width="5" height="5" fill="${t.kind === 'event' ? '#f08c00' : '#2f9e44'}"/>`);
        }
    }
    out.push('</svg>');
    return `${out.join('\n')}\n`;
}

const write = (dir, name, obj) => writeFileSync(join(dir, name), `${JSON.stringify(obj, null, 2)}\n`);

async function main() {
    const outDir = process.argv.slice(2).find((a) => !a.startsWith('--'));
    if (!outDir) {
        console.log('usage: region-map-atlas-cache-dump.mjs <outDir>');
        process.exit(2);
    }
    const log = console.log;
    const quiet = () => {};
    console.log = quiet; console.warn = quiet; console.info = quiet; console.error = quiet; console.debug = quiet;
    const { rulesPathOf } = await import(pathToFileURL(join(REPO, 'scripts/dev/preview-region-layout.mjs')).href);
    const { loadRegistry } = await import(pathToFileURL(join(REPO, 'scripts/procgen/reference/registry.mjs')).href);
    const { loadJSZipNode } = await import(pathToFileURL(join(REPO, 'scripts/procgen/loadJSZipNode.mjs')).href);
    const { writeBundle } = await import(M('presets/documentBundle.js'));
    const { PresetUI } = await import(M('presets/presetUI.js'));
    const { RegionMapUI } = await import(M('regionMap/regionMapUI.js'));
    const { buildRegionMapModel } = await import(M('regionMap/regionMapModel.js'));
    const { substrateRegistry } = await import(M('shared/procgen/substrateRegistry.js'));
    const { atlasCache } = await import(M('procgenCore/atlasCache.js'));
    const { readFileSync } = await import('node:fs');
    await loadRegistry();
    mkdirSync(outDir, { recursive: true });

    const model = (rules, hookCtx) => buildRegionMapModel({ rules, player: '1', registry: substrateRegistry, hookCtx });
    const readerCtx = (rules) => RegionMapUI.prototype._hookCtx.call({}, { rules, playerId: '1' });

    atlasCache.clear();
    const custom = await customSetRules();
    const { atlas } = custom;
    const before = canonicalModel(model(custom.rules, {}));
    // THE WRITER: the bundle through the real `loadDocumentFile`.
    const JSZip = loadJSZipNode();
    const bytes = await writeBundle([{ kind: 'rules', doc: custom.rules }, { kind: 'region-atlas', doc: atlas }], { jszip: JSZip });
    const notes = [];
    let shown = null;
    const host = {
        loadJSZip: async () => JSZip,
        eventBus: { publish: (ev, p) => notes.push([ev, p?.message ?? '']) },
        displayLoadedJsonFileDetails: (doc) => { shown = doc; },
    };
    await PresetUI.prototype.loadDocumentFile.call(host, { name: 'custom-set.zip', arrayBuffer: async () => bytes });
    if (!shown) throw new Error('loadDocumentFile displayed no rules');
    const ctx = readerCtx(shown);
    const after = canonicalModel(model(shown, ctx));
    write(outDir, 'vanilla_set_custom.before.json', before);
    write(outDir, 'vanilla_set_custom.after.json', after);
    if (process.argv.includes('--svg')) {
        const geo = await import(M('regionMap/regionMapFrames.js'));
        writeFileSync(join(outDir, 'vanilla_set_custom.before.svg'),
            modelSvg(model(custom.rules, {}), geo, 'custom Seedling set — BEFORE (no atlas: hookCtx {})'));
        writeFileSync(join(outDir, 'vanilla_set_custom.after.svg'),
            modelSvg(model(shown, ctx), geo, 'custom Seedling set — AFTER (the bundle\'s atlas, via atlasCache → _hookCtx)'));
    }

    const pt = JSON.parse(readFileSync(rulesPathOf('seedling_playthrough'), 'utf8'));
    const ptBefore = canonicalModel(model(pt, {}));
    const ptCtx = readerCtx(pt);
    const ptAfter = canonicalModel(model(pt, ptCtx));
    write(outDir, 'seedling_playthrough.before.json', ptBefore);
    write(outDir, 'seedling_playthrough.after.json', ptAfter);

    console.log = log;
    const line = (n, d) => `${n}: source=${d.source} cells=${d.cellCount} sized=${d.sized}/${d.cellCount} `
        + `placed=${d.placed} unplaced=${d.unplacedCount} squares=${JSON.stringify(d.squareKinds)} `
        + `cellTileSource=${JSON.stringify(d.tileSources)} links=${JSON.stringify(d.linkKinds)}`;
    console.log(`cache after the bundle load: [${atlasCache.ids().join(', ')}]; notification: ${notes.map((n) => n[1]).filter(Boolean).join(' | ')}`);
    console.log(line('vanilla_set_custom BEFORE', before));
    console.log(line('vanilla_set_custom AFTER ', after));
    console.log(line('seedling_playthrough BEFORE', ptBefore));
    console.log(line('seedling_playthrough AFTER ', ptAfter));
    console.log(`seedling_playthrough hook ctx keys: [${Object.keys(ptCtx).join(', ')}]; byte-identical: `
        + `${JSON.stringify(ptBefore) === JSON.stringify(ptAfter)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((e) => {
        process.stderr.write(`${e?.stack ?? String(e)}\n`);
        process.exit(1);
    });
}
