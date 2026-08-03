#!/usr/bin/env node
// Seedling pixelmask extractor — turns the MIT mask PNGs in a Seedling source
// checkout into the ONE committed module `seedlingDemo/seedlingPixelMasks.js`.
//
// Region-atlas Phase 8, subtractive ladder rung R2, slice 1. Brief:
// `CC/docs/plans/seedling-bot-r2-opus-kickoff.md` §3.2 and §8.5.
//
// ── Why a JS module and not JSON ──────────────────────────────────────
// `levelWorld.js` is browser-usable and import-free of anything node-shaped
// (the `atlasSource` split exists because an ES module runs its imports
// before any export is reachable — `feedback_browser_safe_export_node_module`).
// A generated JS module can be imported from both sides with no loader; a
// generated JSON cannot, without a fetch the browser has to await.
//
// ── Why `#`/`.` rows and not hex ──────────────────────────────────────
// This artifact's correctness is VISUAL. `OpenTreeMask`'s 10x12 doorway is
// the difference between reaching the health room and not (§8.5), and a
// reviewer can see a doorway in a picture and cannot see one in
// `ffffffe00007ffffff`. The whole set is ~91k pixels, which is a ~100 KB
// file — cheap for an artifact nobody can otherwise check.
//
// Usage:
//   node scripts/procgen/extract-seedling-masks.mjs --source ~/CC/seedling
//   node scripts/procgen/extract-seedling-masks.mjs --source <path> --check
//
// --check re-extracts and compares against the committed module WITHOUT
// writing, exiting 1 on any difference — the same gate every other committed
// artifact in this arc carries. The module holds no timestamp so that the
// check can be exact: same checkout in, same bytes out.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DEFAULT_OUT = join(REPO_ROOT, 'frontend/modules/seedlingDemo/seedlingPixelMasks.js');
const GRAPHICS = 'assets/graphics';

/**
 * Every mask that backs a SOLID collider, with the class that reads it.
 *
 * ⛔ `TentacleBeastMask.png` USED TO BE deliberately absent, on the reading
 * that "`TentacleBeast extends Enemy`, so its type is `"Enemy"`, which is in
 * no solids list". R5's blocking sweep read the ctor: `TentacleBeast.as:46`
 * OVERWRITES the inherited type with `"Solid"`, exactly as `BombPusher.as:31`
 * does — it is the THIRD enemy on the map that blocks the player (the
 * `IceTurret` corpse is the other). The mask is a real collider and L57 could
 * not be built without it.
 *
 * The nine building masks are `Game.buildingMasks` in index order
 * (`Game.as:343-344`); the five cliffside masks are the `switch(frame)` arms
 * of `CliffSide.as:19-32` in frame order, and THAT ORDER IS THE INDEX the
 * `<cliffsides>` layer's `tx` column selects (`Game.as:2013`).
 */
export const MASK_SOURCES = Object.freeze([
    { name: 'BuildingMask', file: 'BuildingMask.png', as3: 'Game.imgBuildingMask' },
    { name: 'Building1Mask', file: 'Building1Mask.png', as3: 'Game.imgBuilding1Mask' },
    { name: 'Building2Mask', file: 'Building2Mask.png', as3: 'Game.imgBuilding2Mask' },
    { name: 'Building3Mask', file: 'Building3Mask.png', as3: 'Game.imgBuilding3Mask' },
    { name: 'Building4Mask', file: 'Building4Mask.png', as3: 'Game.imgBuilding4Mask' },
    { name: 'Building5Mask', file: 'Building5Mask.png', as3: 'Game.imgBuilding5Mask' },
    { name: 'Building6Mask', file: 'Building6Mask.png', as3: 'Game.imgBuilding6Mask' },
    { name: 'Building7Mask', file: 'Building7Mask.png', as3: 'Game.imgBuilding7Mask' },
    { name: 'Building8Mask', file: 'Building8Mask.png', as3: 'Game.imgBuilding8Mask' },
    { name: 'OpenTreeMask', file: 'OpenTreeMask.png', as3: 'Game.imgOpenTreeMask' },
    { name: 'SnowHillMask', file: 'SnowHillMask.png', as3: 'Game.imgSnowHillMask' },
    { name: 'TreeLargeMask', file: 'TreeLargeMask.png', as3: 'Game.imgTreeLargeMask' },
    {
        name: 'TentacleBeastMask',
        file: 'TentacleBeastMask.png',
        as3: 'Enemies/TentacleBeast.as:45 (new Pixelmask(imgTentacleBeastMask, -23, -22))',
    },
    { name: 'CliffSideMaskL', file: 'CliffSideMaskL.png', as3: 'Game.imgCliffSidesMaskL' },
    { name: 'CliffSideMaskR', file: 'CliffSideMaskR.png', as3: 'Game.imgCliffSidesMaskR' },
    { name: 'CliffSideMaskLU', file: 'CliffSideMaskLU.png', as3: 'Game.imgCliffSidesMaskLU' },
    { name: 'CliffSideMaskRU', file: 'CliffSideMaskRU.png', as3: 'Game.imgCliffSidesMaskRU' },
    { name: 'CliffSideMaskU', file: 'CliffSideMaskU.png', as3: 'Game.imgCliffSidesMaskU' },
]);

/**
 * Decode a PNG to `{width, height, rgba}`.
 *
 * Deliberately narrow: 8-bit RGBA, non-interlaced, which is what all
 * seventeen masks are. Anything else THROWS by name rather than being
 * coerced — a mask decoded by a guess is worse than no mask.
 */
export function decodePng(buf, where) {
    if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
        throw new Error(`${where}: not a PNG`);
    }
    let pos = 8;
    let width = 0; let height = 0;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            const depth = data[8]; const colour = data[9]; const interlace = data[12];
            if (depth !== 8 || colour !== 6 || interlace !== 0) {
                throw new Error(`${where}: only 8-bit RGBA non-interlaced PNGs are decoded here, `
                    + `got depth ${depth} colour-type ${colour} interlace ${interlace}`);
            }
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        pos += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(idat));
    const bpp = 4;
    const stride = width * bpp;
    const rgba = Buffer.alloc(height * stride);
    let prev = Buffer.alloc(stride);
    let p = 0;
    for (let y = 0; y < height; y++) {
        const filter = raw[p]; p += 1;
        const line = Buffer.from(raw.subarray(p, p + stride)); p += stride;
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? line[i - bpp] : 0;
            const b = prev[i];
            const c = i >= bpp ? prev[i - bpp] : 0;
            switch (filter) {
                case 0: break;
                case 1: line[i] = (line[i] + a) & 0xff; break;
                case 2: line[i] = (line[i] + b) & 0xff; break;
                case 3: line[i] = (line[i] + ((a + b) >> 1)) & 0xff; break;
                case 4: {
                    const pp = a + b - c;
                    const pa = Math.abs(pp - a); const pb = Math.abs(pp - b);
                    const pc = Math.abs(pp - c);
                    const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
                    line[i] = (line[i] + pr) & 0xff;
                    break;
                }
                default: throw new Error(`${where}: unknown PNG filter ${filter} on row ${y}`);
            }
        }
        line.copy(rgba, y * stride);
        prev = line;
    }
    return { width, height, rgba };
}

/**
 * The alpha plane as one `#`/`.` string per row.
 *
 * ⚠ The threshold is `>= 1`, not `> 0.5` or "not fully transparent by
 * eye": `Pixelmask.threshold` is declared `= 1` and `bd_hit_test` compares
 * `CA(pixel) >= threshold` (`avm2_bitmap.c:1487`). Any non-zero alpha
 * collides.
 */
export function alphaRows({ width, height, rgba }) {
    const rows = [];
    for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) row += rgba[(y * width + x) * 4 + 3] >= 1 ? '#' : '.';
        rows.push(row);
    }
    return rows;
}

export function buildModule(sourceDir) {
    const out = [];
    for (const m of MASK_SOURCES) {
        const file = join(sourceDir, GRAPHICS, m.file);
        if (!existsSync(file)) throw new Error(`missing mask asset: ${file}`);
        const png = decodePng(readFileSync(file), m.file);
        const rows = alphaRows(png);
        const opaque = rows.reduce((n, r) => n + [...r].filter((c) => c === '#').length, 0);
        out.push({ ...m, w: png.width, h: png.height, rows, opaque });
    }
    const body = out.map((m) => `    ${m.name}: {\n`
        + `        // ${m.as3} — ${GRAPHICS}/${m.file}\n`
        + `        w: ${m.w}, h: ${m.h}, opaque: ${m.opaque},\n`
        + `        rows: [\n${m.rows.map((r) => `            '${r}',`).join('\n')}\n        ],\n`
        + '    },').join('\n');
    return `/**
 * GENERATED — do not edit. Regenerate with:
 *   node scripts/procgen/extract-seedling-masks.mjs --source ~/CC/seedling
 * and verify with the same command plus --check (which is what CI runs).
 *
 * The FlashPunk \`Pixelmask\` bitmaps for every Seedling class whose collider
 * is a mask rather than a hitbox. One \`#\`/\`.\` string per row, x increasing
 * left to right, y increasing downward, \`#\` meaning alpha >= 1 — which is
 * \`Pixelmask.threshold\`'s declared value and the comparison
 * \`bd_hit_test\` actually makes.
 *
 * These are the RAW bitmaps only. Where each one lands in the world is the
 * owning class's business and lives in \`levelWorld.ENTITY_CLASSES\` with the
 * constructor chain cited, because two classes read the same picture from
 * different origins.
 *
 * Import-free on purpose: \`levelWorld\` is browser-usable and an ES module
 * runs every import before any export is reachable.
 */
export const SEEDLING_PIXEL_MASKS = Object.freeze({
${body}
});

/** Mask names, for the census guard. */
export const PIXEL_MASK_NAMES = Object.freeze(Object.keys(SEEDLING_PIXEL_MASKS));
`;
}

function main() {
    const argv = process.argv.slice(2);
    const arg = (name, fallback) => {
        const i = argv.indexOf(name);
        return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
    };
    const source = resolve(arg('--source', join(process.env.HOME ?? '', 'CC/seedling')));
    const out = resolve(arg('--out', DEFAULT_OUT));
    const check = argv.includes('--check');
    const text = buildModule(source);
    if (check) {
        if (!existsSync(out)) {
            console.error(`--check: ${out} does not exist`);
            process.exit(1);
        }
        const have = readFileSync(out, 'utf8');
        if (have !== text) {
            console.error(`--check FAILED: ${out} differs from a fresh extract of ${source}`);
            process.exit(1);
        }
        console.log(`--check OK: ${MASK_SOURCES.length} masks, byte-identical`);
        return;
    }
    writeFileSync(out, text);
    console.log(`wrote ${out}: ${MASK_SOURCES.length} masks`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
