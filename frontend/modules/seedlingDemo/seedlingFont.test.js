/**
 * The authored dialogue font (G4b, ⚖ the user 2026-10-21: "Ok, let's make
 * our own pixel font"): `scripts/procgen/make-seedling-font.mjs` →
 * `frontend/packs/seedling/art/sheets/SeedlingFont.png`, the pack key
 * `seedling:font/default` (frame = char code − 32).
 *
 *   1. THE SHEET: the committed PNG is the producer's bytes; the manifest row
 *      is 4 × 8 cells; every printable ASCII glyph is inked (but the space),
 *      stays in its 3 ink columns and its 8 rows, and no two are the same.
 *   2. ⛔ THE FIT: the model wraps in CHARACTERS (`NPC.endlineText`), so the
 *      font must fit the box the game's wrap already chose. Every dialogue
 *      page the repository carries — every `.oel` text attribute in the
 *      committed atlas (NPCs 28, statues 34, the seed's pickup 32), the
 *      pickup ceremonies (32), the Bob boss's forms (28), and the AS3 code
 *      literals the atlas cannot hold — measures ≤ the 152 px text area
 *      (`Game.talk`: 160 − `textToImageMargin` 8, no portrait) and its ink
 *      lies inside the 133..160 lower bar. The counterfactual is pinned too:
 *      a 5 px advance overflows the widest page.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FONT_ART_ROW, FONT_METRICS, FONT_SHEET_PATH, GLYPHS, fontPixels, fontSheetBytes } from '../../../scripts/procgen/make-seedling-font.mjs';
import { PICKUP_CEREMONY, PICKUP_CEREMONY_BY_KEYTYPE, PICKUP_LINE_LENGTH, pagesOf } from './dialogue.js';
import { BOB_BOSS_FORMS, BOSS_LINE_LENGTH, FIRE } from './bobBoss.js';
import { KEYS, measureText } from './seedlingEffectSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/seedling/art/manifest.json'), 'utf8'));
const ATLAS = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const VENDOR = join(ROOT, 'vendor/seedling/src');

/** `NPC.as:46` default 28; `Statue.as:20` passes 34; a pickup's NPC (`Pickup`, `Seed`) wraps at 32. */
const NPC_LINE_LENGTH = 28;
const STATUE_LINE_LENGTH = 34;
/** `Game.talk` (`Game.as:1680-1684`): the screen, `n`, `textToImageMargin`. */
const SCREEN = 160;
const BAR = Math.trunc(SCREEN / 6);
const TEXT_AREA = SCREEN - 8;

/**
 * The AS3 dialogue that lives in CODE, not in a level (so the atlas cannot carry it), quoted with its line.
 * `vendor/seedling` (when initialised) must still hold each one verbatim.
 */
const AS3_LITERALS = Object.freeze([
    ['NPCs/Witch.as', 'Oh, you found the wand!~You must be very powerful and your goals noble.~Here is an enchantment to improve your sword!', NPC_LINE_LENGTH],
    ['NPCs/Witch.as', 'May you do only good with that sword.~I presume you can be trusted?', NPC_LINE_LENGTH],
    // the Watcher's death makes a `Seed` PICKUP with this text (`Watcher.as:102`), so it wraps at the pickup's 32
    ['NPCs/Watcher.as', 'The seed, covered in the blood of the Watcher, seems almost to cower from your grasp.~This was supposed to be a triumph...', PICKUP_LINE_LENGTH],
    ['NPCs/Oracle.as', 'You have brought the seed. Good work.~Your purpose is fulfilled, but now you are not needed.~Goodbye.', NPC_LINE_LENGTH],
    ['Enemies/LightBossController.as', 'HOW FAR YOU HAVE COME, BEING OF THE LIGHT.~OUR OWN LIGHT WILL SWALLOW YOU. COME, MEET YOUR FATE.', NPC_LINE_LENGTH],
]);

/** Every dialogue page, `{ from, lineL, page }`. */
function allPages() {
    const out = [];
    const add = (from, text, lineL) => { for (const page of pagesOf(text, lineL)) out.push({ from, lineL, page }); };
    for (const level of ATLAS.levels) {
        for (const e of level.entities ?? []) {
            for (const [k, v] of Object.entries(e.attrs ?? {})) {
                if (!/^text\d*$/.test(k) || !v) continue;
                const lineL = /^statue/.test(e.type) ? STATUE_LINE_LENGTH : e.type === 'seed' ? PICKUP_LINE_LENGTH : NPC_LINE_LENGTH;
                add(`atlas ${level.name ?? level.file ?? level.index} ${e.type}.${k}`, v, lineL);
            }
        }
    }
    for (const [k, c] of Object.entries(PICKUP_CEREMONY)) add(`pickup ${k}`, c.text, PICKUP_LINE_LENGTH);
    for (const [k, byIndex] of Object.entries(PICKUP_CEREMONY_BY_KEYTYPE)) for (const [i, c] of Object.entries(byIndex)) add(`pickup ${k}/${i}`, c.text, PICKUP_LINE_LENGTH);
    add('pickup fire', FIRE.text, PICKUP_LINE_LENGTH);
    for (const f of BOB_BOSS_FORMS) add(`bob form ${f.index}`, f.text, BOSS_LINE_LENGTH);
    for (const [file, text, lineL] of AS3_LITERALS) add(file, text, lineL);
    return out;
}

const FONT = { id: KEYS.font, advance: FONT_METRICS.cellW, lineHeight: FONT_METRICS.cellH, gutter: 4, sprite: true };

describe('1. the sheet', () => {
    it('the committed PNG is the producer\'s bytes, and the manifest row is the producer\'s (4 × 8, authored)', () => {
        expect(readFileSync(FONT_SHEET_PATH).equals(fontSheetBytes())).toBe(true);
        const sp = MANIFEST.sprites[KEYS.font];
        expect([sp.sheet, sp.fw, sp.fh, sp.frames]).toEqual(['SeedlingFont', 4, 8, 96]);
        expect(MANIFEST.sheets.SeedlingFont).toEqual({ file: 'sheets/SeedlingFont.png', w: 64, h: 48, authored: FONT_ART_ROW.authored });
        expect(FONT_ART_ROW.key).toBe(KEYS.font);
    });

    it('printable ASCII 32..126: inked (but the space), inside its 3 ink columns, every glyph different', () => {
        const { w, px } = fontPixels();
        const seen = new Map();
        for (let code = 32; code <= 126; code += 1) {
            const f = code - 32;
            const ox = (f % FONT_METRICS.cols) * FONT_METRICS.cellW;
            const oy = Math.floor(f / FONT_METRICS.cols) * FONT_METRICS.cellH;
            let bits = '';
            for (let y = 0; y < FONT_METRICS.cellH; y += 1) {
                for (let x = 0; x < FONT_METRICS.cellW; x += 1) bits += px[((oy + y) * w + ox + x) * 4 + 3] ? '#' : '.';
            }
            const ch = String.fromCharCode(code);
            expect(bits.split('').filter((_, i) => i % 4 === 3).join(''), `${ch}: column 3 is the spacing`).toBe('........');
            expect(bits.includes('#'), `${ch}: inked`).toBe(code !== 32);
            if (code !== 32) {
                expect(seen.get(bits), `${ch} draws the same as ${seen.get(bits)}`).toBe(undefined);
                seen.set(bits, ch);
            }
        }
        expect(Object.keys(GLYPHS)).toHaveLength(95);
    });
});

describe('2. ⛔ the fit: the game\'s character wrap, in our metrics', () => {
    const pages = allPages();

    it('the AS3 code literals are still the source\'s, verbatim', () => {
        if (!existsSync(VENDOR)) return;
        for (const [file, text] of AS3_LITERALS) expect(readFileSync(join(VENDOR, file), 'utf8').includes(`"${text}"`), file).toBe(true);
    });

    it('every page is printable ASCII (the sheet has a glyph for every character)', () => {
        expect(pages.length).toBeGreaterThan(150);
        for (const { from, page } of pages) expect(/^[\x20-\x7e\n]*$/.test(page), `${from}: ${JSON.stringify(page)}`).toBe(true);
    });

    it('every page fits the 152 px text area and its ink lies inside the 133..160 bar', () => {
        let widest = null;
        let tallest = 0;
        for (const p of pages) {
            const m = measureText(p.page, FONT);
            expect(m.w, `${p.from}: ${JSON.stringify(p.page)}`).toBeLessThanOrEqual(TEXT_AREA);
            if (!widest || m.w > widest.w) widest = { ...p, w: m.w };
            tallest = Math.max(tallest, m.lines.length);
            // `t.render` at y = 160·(n − 1/2)/n − h/2 + 1; the glyphs 2 px in; the ink of the last line ends at its row 7
            const ty = Math.floor((SCREEN * 5.5) / 6 - m.h / 2 + 1);
            const inkTop = ty + FONT.gutter / 2;
            const inkBottom = inkTop + m.lines.length * FONT.lineHeight - 1;
            expect(inkTop, p.from).toBeGreaterThanOrEqual(SCREEN - BAR - 1);
            expect(inkBottom, p.from).toBeLessThanOrEqual(SCREEN - 1);
        }
        // the measured extremes (the as-built quotes them): a 31-character line (pickup + statue), 3 lines (NPCs)
        expect([widest.w, tallest]).toEqual([31 * 4 + 4, 3]);
        expect(pages.filter((p) => measureText(p.page, FONT).w === widest.w).map((p) => p.page.split('\n').find((l) => l.length === 31)))
            .toContain('You can now swim up waterfalls.');
        // the counterfactual: one more pixel of advance and the widest page overflows the area
        expect(measureText(widest.page, { ...FONT, advance: 5 }).w).toBeGreaterThan(TEXT_AREA);
    });
});
