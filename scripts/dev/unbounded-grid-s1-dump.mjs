#!/usr/bin/env node
/**
 * unbounded-grid-s1-dump — **WHAT THE REGION-CELL READERS DRAW AND PICK, AS CANONICAL JSON** (unbounded grid, slice S1).
 *
 * S1 makes every reader/drawer of region `grid_cell`s accept signed coordinates, computing its box from the data.
 * Every committed `grid_cell` is ≥ 0, so nothing a user sees may move. This dumps, per tracked rules document that
 * carries a `grid_cell` (derived: `git ls-files '*rules.json'` ∩ contains `"grid_cell"`) and per player slot with
 * sidecars:
 *
 *   · `bounds`     — `mapBoundsFor` as the DRAWN box: `{left, top, width, height, boundsSource}` (`left/top` are
 *                    `minX/minY` when the reader returns them, else 0 — the box every reader drew from before S1);
 *   · `result`     — `reconstructResultFromSidecars` (grid size + origin, cell size + source, stats, refused, and
 *                    every placed region's cell in placement order);
 *   · `rects`      — every placed region's pixel rect on the canvas;
 *   · `draw`       — `drawCompositeMap` on a recording 2-D context (canvas sized from the grid as the hosts size it),
 *                    with art on / off and a region / exit selection: call count + sha256 of the call log;
 *   · `picks`      — `cellAtPoint` at each cell's centre and corners, and at points just outside the canvas;
 *   · `slotLayout` — `apworldEditor/regionLayout.slotLayout` (cells, grid size + origin, clash);
 *   · `issues`     — `sidecarIssues`' `GRID_CELL_*` rows.
 *
 * Usage: `node scripts/dev/unbounded-grid-s1-dump.mjs <out-dir>` → one JSON per document + `index.json` (sha256 per
 * file). Compare two dumps with `diff -r`. Read-only: writes only under `<out-dir>`.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const M = (p) => import(pathToFileURL(join(ROOT, p)).href);

const canonical = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map((kk) => [kk, x[kk]])) : x), 1);
const sha = (s) => createHash('sha256').update(s).digest('hex');

const out = process.argv[2];
if (!out) { console.error('usage: unbounded-grid-s1-dump.mjs <out-dir>'); process.exit(2); }
mkdirSync(out, { recursive: true });

const { loadPipelineSubstrates } = await M('scripts/procgen/registerPipelineSubstrates.js');
await loadPipelineSubstrates();
const D = await M('frontend/modules/procgenPipeline/compositeMapDocument.js');
const R = await M('frontend/modules/procgenCore/compositeMapRenderer.js');
const { slotLayout } = await M('frontend/modules/apworldEditor/regionLayout.js');
const { sidecarIssues } = await M('frontend/modules/apworldEditor/sidecarIssues.js');

/** A 2-D context that records every call and property write, rounding numbers so the log is the value. */
function recordingCanvas(width, height) {
    const log = [];
    const fmt = (a) => (typeof a === 'number' ? Math.round(a * 1000) / 1000
        : (a && typeof a === 'object' ? (a.__tag ?? typeof a) : a));
    const stub = (tag) => new Proxy({ __tag: tag }, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === 'width') return 0;
            if (k === 'data') return new Uint8ClampedArray(4);
            return (...args) => { log.push([`${tag}.${String(k)}`, ...args.map(fmt)]); return stub(`${tag}.${String(k)}`); };
        },
        set(t, k, v) { log.push([`${tag}.${String(k)}=`, fmt(v)]); return true; },
    });
    const ctx = new Proxy({ __tag: 'ctx' }, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === 'measureText') return (s) => { log.push(['measureText', s]); return { width: String(s).length * 6 }; };
            if (k === 'canvas') return canvas;
            return (...args) => { log.push([String(k), ...args.map(fmt)]); return stub(String(k)); };
        },
        set(t, k, v) { log.push([`${String(k)}=`, fmt(v)]); return true; },
    });
    const canvas = { width, height, getContext: () => ctx };
    return { canvas, log };
}

const files = execFileSync('git', ['ls-files', '*rules.json'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter((p) => readFileSync(join(ROOT, p), 'utf8').includes('"grid_cell"'))
    .sort();

const index = {};
for (const path of files) {
    const doc = JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
    const slots = {};
    for (const slot of Object.keys(doc.preset_sidecars ?? {})) {
        const entries = Object.entries(doc.preset_sidecars[slot] ?? {});
        const b = D.mapBoundsFor(doc, entries, slot);
        const row = {
            bounds: b && { left: b.minX ?? 0, top: b.minY ?? 0, width: b.width, height: b.height, boundsSource: b.boundsSource },
        };
        const res = D.reconstructResultFromSidecars(doc, { playerId: slot, fallback: false });
        if (res) {
            const { grid, regionSize } = res;
            const ox = grid.minX ?? 0;
            const oy = grid.minY ?? 0;
            const cw = regionSize.width * R.TILE_PX;
            const ch = regionSize.height * R.TILE_PX;
            const regions = grid.allRegions();
            row.result = {
                grid: { width: grid.width, height: grid.height, left: ox, top: oy },
                regionSize, regionSizeSource: res.regionSizeSource, boundsSource: res.boundsSource,
                stats: res.stats, refused: res.refused, playerId: res.playerId,
                cells: regions.map((r) => [r.region_id, r.cell.gx, r.cell.gy]),
            };
            row.rects = regions.map((r) => [r.region_id, (r.cell.gx - ox) * cw, (r.cell.gy - oy) * ch, cw, ch]);
            const W = grid.width * cw;
            const H = grid.height * ch;
            const first = regions[0];
            const exitOf = (r) => {
                const ex = r?.exits;
                const list = Array.isArray(ex) ? ex : [...(ex?.values?.() ?? [])];
                return list.find((e) => e?.exit_id)?.exit_id ?? null;
            };
            const withExit = regions.find((r) => exitOf(r));
            const variants = {
                art: {},
                plain: { substrateArt: false },
                selRegion: { selection: first ? { kind: 'region', cell: first.cell } : null },
                selExit: { selection: withExit ? { kind: 'exit', cell: withExit.cell, exitId: exitOf(withExit) } : null },
            };
            row.draw = { canvas: [W, H] };
            for (const [k, opts] of Object.entries(variants)) {
                const { canvas, log } = recordingCanvas(W, H);
                let error = null;
                try {
                    R.drawCompositeMap(canvas, grid, regionSize, { ...opts, source: { rules: doc, playerId: slot } });
                } catch (e) { error = String(e?.message ?? e).split('\n')[0]; }
                const text = canonical(log);
                row.draw[k] = { calls: log.length, sha256: sha(text), error };
            }
            const pts = [];
            for (let gy = 0; gy < grid.height; gy++) {
                for (let gx = 0; gx < grid.width; gx++) {
                    const x0 = gx * cw; const y0 = gy * ch;
                    pts.push([x0 + cw / 2, y0 + ch / 2], [x0, y0], [x0 + cw - 1, y0 + ch - 1]);
                }
            }
            pts.push([-1, 0], [0, -1], [W, 0], [0, H], [W + cw, H + ch], [-cw, -ch]);
            row.picks = pts.map(([cx, cy]) => {
                const h = R.cellAtPoint(grid, regionSize, { cx, cy });
                return [cx, cy, h && [h.gx, h.gy, h.wx, h.wy], h ? (grid.getRegion(h)?.region_id ?? null) : null];
            });
        }
        const lay = slotLayout(doc, slot);
        row.slotLayout = {
            cells: [...lay.cells].map(([n, c]) => [n, c.gx, c.gy]),
            grid: lay.grid && { width: lay.grid.width, height: lay.grid.height, left: lay.grid.minX ?? 0, top: lay.grid.minY ?? 0 },
            clash: lay.clash,
        };
        row.issues = sidecarIssues(doc, slot).filter((i) => /^GRID_CELL/.test(i.kind))
            .map((i) => [i.kind, i.region ?? null, i.message]);
        slots[slot] = row;
    }
    const name = path.replace(/[\\/]/g, '__');
    const text = `${canonical({ path, slots })}\n`;
    writeFileSync(join(out, `${name}.json`), text);
    index[path] = sha(text);
}
writeFileSync(join(out, 'index.json'), `${canonical({ count: files.length, files: index })}\n`);
console.log(`${files.length} documents → ${out}`);
