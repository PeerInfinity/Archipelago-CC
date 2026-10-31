#!/usr/bin/env node
// Seedling font maker — writes the glyph sheet behind the JS runtime's font
// seam (`seedlingEffectSkin.KEYS.font` = `seedling:font/default`, frame =
// char code − 32) from the GLYPHS table below.
//
// Seedling JS graphics, slice G4b (⚖ the user, 2026-10-21: "Ok, let's make
// our own pixel font."). The game draws its text in 04B_03 at size 8
// (`Preloader.as:30`, `Game.talk` `Text.size = 8`). That font's licence is
// unclear, so it is NOT shipped, traced or rasterised: every glyph below is
// ORIGINAL work authored for this repository, released under the repository's
// licence (MIT, the root LICENSE). Only 04B_03's GLOBAL metrics were read
// (the TTF's `hhea` ascent 750 / descent 250 per 1000 units, `OS/2`
// avgCharWidth 550) — no glyph outline, advance table or bitmap.
//
// ── The metrics, and why they fit ─────────────────────────────────────
// A cell is 4 × 8 px: 3 columns of ink plus 1 of spacing (the ADVANCE, 4),
// and 6 rows above the baseline plus 2 below (04B_03's ascent/descent at
// size 8: 750·8/1000 = 6, 250·8/1000 = 2; the LINE HEIGHT, 8). Capitals and
// digits stand on rows 1..5, lowercase bodies on rows 2..5, descenders on
// rows 6..7. The renderer reads the advance and the line height off the
// frame size (`resolveFont`).
//
// The model wraps in CHARACTERS (`NPC.endlineText`), so the font must fit the
// wrap it already computes: pickups 32, NPCs 28, statues 34 (`Statue.as:20`),
// in the 152 px text area (`Game.talk`: 160 − `textToImageMargin` 8; no NPC
// has a portrait, `NPC.myPic` is never assigned). The widest page line the
// game has is 31 characters (a pickup's and a statue's) → 31·4 + 4 = 128 px
// ≤ 152 (a 5 px advance gives 159, which overflows). Pages have at most 3
// lines (NPCs) → 3·8 + 4 = 28 px, whose ink (2 px in from the box, `Text`'s
// gutter) spans rows 135..158 of the 133..160 lower bar.
// `frontend/modules/seedlingDemo/seedlingFont.test.js` proves both on every
// dialogue page the repository carries.
//
// ── Bytes ─────────────────────────────────────────────────────────────
// The PNG is RGBA, white ink on transparent (`Text` renders 0xFFFFFF and the
// game TINTS it: `drawTextBold`'s black copies are `Image.color = 0`, a
// multiply, which the renderer's `tint` reproduces). It is encoded with
// STORED deflate blocks and a hand-rolled CRC/Adler, so the bytes depend on
// nothing but this file — no zlib version can move them.
//
// Usage:
//   node scripts/procgen/make-seedling-font.mjs           # write the sheet
//   node scripts/procgen/make-seedling-font.mjs --check   # byte compare, exit 1 on drift
//
// The pack's manifest row (`seedling:font/default`) is written by
// `extract-seedling-art-packs.mjs`, which takes this sheet's bytes from
// `fontSheetBytes()`; its own `--check` covers the sheet too.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** The published path, inside `frontend/packs/seedling/art/`. */
export const FONT_SHEET_FILE = 'SeedlingFont.png';
export const FONT_SHEET_PATH = join(REPO_ROOT, 'frontend/packs/seedling/art/sheets', FONT_SHEET_FILE);

export const FONT_METRICS = Object.freeze({ cellW: 4, cellH: 8, inkW: 3, cols: 16, rows: 6, first: 32, last: 126 });

/**
 * A glyph: the row its first line sits on, then its lines ('#' ink, '.' none),
 * separated by '/'. Each line is FONT_METRICS.inkW wide.
 */
const g = (top, rows) => ({ top, rows: rows ? rows.split('/') : [] });

/** THE GLYPHS — printable ASCII 32..126. Original work (see the header). */
export const GLYPHS = Object.freeze({
    ' ': g(1, ''),
    '!': g(1, '.#./.#./.#./.../.#.'),
    '"': g(1, '#.#/#.#'),
    '#': g(1, '#.#/###/#.#/###/#.#'),
    '$': g(0, '.#./.##/#../.#./..#/##./.#.'),
    '%': g(1, '#.#/..#/.#./#../#.#'),
    '&': g(1, '.#./#.#/.#./#.#/.##'),
    "'": g(1, '.#./.#.'),
    '(': g(1, '..#/.#./.#./.#./..#'),
    ')': g(1, '#../.#./.#./.#./#..'),
    '*': g(2, '#.#/.#./#.#'),
    '+': g(2, '.#./###/.#.'),
    ',': g(5, '.#./#..'),
    '-': g(3, '###'),
    '.': g(5, '.#.'),
    '/': g(1, '..#/..#/.#./#../#..'),
    0: g(1, '###/#.#/#.#/#.#/###'),
    1: g(1, '.#./##./.#./.#./###'),
    2: g(1, '##./..#/.#./#../###'),
    3: g(1, '##./..#/.#./..#/##.'),
    4: g(1, '#.#/#.#/###/..#/..#'),
    5: g(1, '###/#../##./..#/##.'),
    6: g(1, '.##/#../###/#.#/###'),
    7: g(1, '###/..#/.#./.#./.#.'),
    8: g(1, '###/#.#/###/#.#/###'),
    9: g(1, '###/#.#/###/..#/##.'),
    ':': g(2, '.#./.../.#.'),
    ';': g(2, '.#./.../.#./#..'),
    '<': g(1, '..#/.#./#../.#./..#'),
    '=': g(2, '###/.../###'),
    '>': g(1, '#../.#./..#/.#./#..'),
    '?': g(1, '##./..#/.#./.../.#.'),
    '@': g(1, '.#./#.#/###/#../.##'),
    A: g(1, '.#./#.#/###/#.#/#.#'),
    B: g(1, '##./#.#/##./#.#/##.'),
    C: g(1, '.##/#../#../#../.##'),
    D: g(1, '##./#.#/#.#/#.#/##.'),
    E: g(1, '###/#../##./#../###'),
    F: g(1, '###/#../##./#../#..'),
    G: g(1, '.##/#../#.#/#.#/.##'),
    H: g(1, '#.#/#.#/###/#.#/#.#'),
    I: g(1, '###/.#./.#./.#./###'),
    J: g(1, '..#/..#/..#/#.#/.#.'),
    K: g(1, '#.#/#.#/##./#.#/#.#'),
    L: g(1, '#../#../#../#../###'),
    M: g(1, '#.#/###/###/#.#/#.#'),
    N: g(1, '##./#.#/#.#/#.#/#.#'),
    O: g(1, '.#./#.#/#.#/#.#/.#.'),
    P: g(1, '##./#.#/##./#../#..'),
    Q: g(1, '.#./#.#/#.#/##./.##'),
    R: g(1, '##./#.#/##./#.#/#.#'),
    S: g(1, '.##/#../.#./..#/##.'),
    T: g(1, '###/.#./.#./.#./.#.'),
    U: g(1, '#.#/#.#/#.#/#.#/###'),
    V: g(1, '#.#/#.#/#.#/#.#/.#.'),
    W: g(1, '#.#/#.#/###/###/#.#'),
    X: g(1, '#.#/#.#/.#./#.#/#.#'),
    Y: g(1, '#.#/#.#/.#./.#./.#.'),
    Z: g(1, '###/..#/.#./#../###'),
    '[': g(1, '##./#../#../#../##.'),
    '\\': g(1, '#../#../.#./..#/..#'),
    ']': g(1, '.##/..#/..#/..#/.##'),
    '^': g(1, '.#./#.#'),
    _: g(6, '###'),
    '`': g(1, '#../.#.'),
    a: g(2, '.##/#.#/#.#/.##'),
    b: g(1, '#../##./#.#/#.#/##.'),
    c: g(2, '.##/#../#../.##'),
    d: g(1, '..#/.##/#.#/#.#/.##'),
    e: g(2, '.#./###/#../.##'),
    f: g(1, '.##/.#./###/.#./.#.'),
    g: g(2, '.##/#.#/#.#/.##/..#/##.'),
    h: g(1, '#../##./#.#/#.#/#.#'),
    i: g(1, '.#./.../.#./.#./.#.'),
    j: g(1, '..#/.../..#/..#/..#/..#/##.'),
    k: g(1, '#../#.#/##./#.#/#.#'),
    l: g(1, '##./.#./.#./.#./.##'),
    m: g(2, '###/###/#.#/#.#'),
    n: g(2, '##./#.#/#.#/#.#'),
    o: g(2, '.#./#.#/#.#/.#.'),
    p: g(2, '##./#.#/#.#/##./#../#..'),
    q: g(2, '.##/#.#/#.#/.##/..#/..#'),
    r: g(2, '#.#/##./#../#..'),
    s: g(2, '.##/#../..#/##.'),
    t: g(1, '.#./###/.#./.#./..#'),
    u: g(2, '#.#/#.#/#.#/.##'),
    v: g(2, '#.#/#.#/#.#/.#.'),
    w: g(2, '#.#/#.#/###/###'),
    x: g(2, '#.#/.#./.#./#.#'),
    y: g(2, '#.#/#.#/#.#/.##/..#/##.'),
    z: g(2, '###/..#/#../###'),
    '{': g(1, '.##/.#./#../.#./.##'),
    '|': g(1, '.#./.#./.#./.#./.#./.#.'),
    '}': g(1, '##./.#./..#/.#./##.'),
    '~': g(2, '##./.##'),
});

/** The sheet as an RGBA pixel grid (white ink, transparent elsewhere), validated. */
export function fontPixels() {
    const { cellW, cellH, inkW, cols, rows, first, last } = FONT_METRICS;
    const w = cols * cellW;
    const h = rows * cellH;
    const px = new Uint8Array(w * h * 4);
    const want = [];
    for (let c = first; c <= last; c += 1) want.push(String.fromCharCode(c));
    const extra = Object.keys(GLYPHS).filter((k) => !want.includes(k));
    if (extra.length) throw new Error(`GLYPHS: not printable ASCII: ${JSON.stringify(extra)}`);
    for (const ch of want) {
        const glyph = GLYPHS[ch];
        if (!glyph) throw new Error(`GLYPHS: no glyph for ${JSON.stringify(ch)} (${ch.charCodeAt(0)})`);
        if (glyph.top + glyph.rows.length > cellH) throw new Error(`GLYPHS ${JSON.stringify(ch)}: runs past row ${cellH - 1}`);
        const frame = ch.charCodeAt(0) - first;
        const ox = (frame % cols) * cellW;
        const oy = Math.floor(frame / cols) * cellH;
        glyph.rows.forEach((line, r) => {
            if (!/^[#.]+$/.test(line) || line.length !== inkW) throw new Error(`GLYPHS ${JSON.stringify(ch)}: line ${JSON.stringify(line)} is not ${inkW} of '#'/'.'`);
            [...line].forEach((cell, x) => {
                if (cell !== '#') return;
                px.fill(255, ((oy + glyph.top + r) * w + ox + x) * 4, ((oy + glyph.top + r) * w + ox + x) * 4 + 4);
            });
        });
    }
    return { w, h, px };
}

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf) {
    let a = 1;
    let b = 0;
    for (const x of buf) { a = (a + x) % 65521; b = (b + a) % 65521; }
    return ((b << 16) | a) >>> 0;
}

function chunk(type, data) {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
}

/** A zlib stream of STORED deflate blocks (no compression: the bytes are this function's alone). */
function zlibStored(raw) {
    const parts = [Buffer.from([0x78, 0x01])];
    for (let i = 0; i < raw.length || i === 0; i += 0xffff) {
        const block = raw.subarray(i, Math.min(i + 0xffff, raw.length));
        const head = Buffer.alloc(5);
        head[0] = i + 0xffff >= raw.length ? 1 : 0;
        head.writeUInt16LE(block.length, 1);
        head.writeUInt16LE(~block.length & 0xffff, 3);
        parts.push(head, block);
    }
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(adler32(raw), 0);
    parts.push(tail);
    return Buffer.concat(parts);
}

/** The sheet's PNG bytes (8-bit RGBA, filter 0 on every row). */
export function fontSheetBytes() {
    const { w, h, px } = fontPixels();
    return rgbaPngBytes(w, h, px);
}

/**
 * Any 8-bit RGBA image as PNG bytes — filter 0 on every row, STORED deflate blocks, so
 * the bytes depend on the pixels alone (no zlib version). `px` is a Uint8Array/Buffer
 * of w·h·4. (Also `archipelagoLogoArt.mjs`'s 64×64 logo.)
 */
export function rgbaPngBytes(w, h, px) {
    const raw = Buffer.alloc(h * (w * 4 + 1));
    for (let y = 0; y < h; y += 1) Buffer.from(px.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlibStored(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** The pack row `extract-seedling-art-packs.mjs` adds (`authored`: it takes `fontSheetBytes()`, not a checkout file). */
export const FONT_ART_ROW = Object.freeze({
    pack: 'seedling', key: 'seedling:font/default', file: FONT_SHEET_FILE, fw: FONT_METRICS.cellW, fh: FONT_METRICS.cellH,
    authored: 'scripts/procgen/make-seedling-font.mjs — ORIGINAL glyphs (not 04B_03), MIT (the repository licence)',
    as3: 'Game.as:1677-1757 talk(), Text.size = 8 (04B_03, Preloader.as:30, not shipped); frame = char code − 32',
});

function main() {
    const rel = relative(REPO_ROOT, FONT_SHEET_PATH);
    const bytes = fontSheetBytes();
    if (process.argv.includes('--check')) {
        const have = existsSync(FONT_SHEET_PATH) ? readFileSync(FONT_SHEET_PATH) : null;
        if (!have || !have.equals(bytes)) {
            console.error(`DIFFERS ${FONT_SHEET_FILE}: ${rel} ${have ? `(${have.length} bytes)` : 'is MISSING'} vs a fresh build (${bytes.length} bytes)`);
            console.error('Regenerate with: node scripts/procgen/make-seedling-font.mjs');
            process.exit(1);
        }
        console.log(`same ${FONT_SHEET_FILE}: ${rel} (${bytes.length} bytes, ${Object.keys(GLYPHS).length} glyphs)`);
        return;
    }
    mkdirSync(join(FONT_SHEET_PATH, '..'), { recursive: true });
    writeFileSync(FONT_SHEET_PATH, bytes);
    console.log(`wrote ${rel} (${bytes.length} bytes, ${Object.keys(GLYPHS).length} glyphs)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
