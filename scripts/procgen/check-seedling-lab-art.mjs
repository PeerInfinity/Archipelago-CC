#!/usr/bin/env node
/**
 * check-seedling-lab-art — THE LAB ARC L2 ACCEPTANCE ROW (seedling-lab-static-art): does `watch.html` boot, load
 * the Seedling art, and draw the room in it (statically) in every arm — and fall back to the rectangles when told?
 *
 * ── WHAT THIS ADDS OVER THE VITEST ROWS ───────────────────────────────
 * `watchArt.test.js` pins the DRAW LISTS, the layer cache and the static frame in node. This proves the PAGE'S
 * path: the packs fetched and decoded in a real browser, the toggle as DOM, and the PIXELS — the canvas is not
 * the rectangle palette.
 *
 * ⛔ READ FROM THE DRIVEN SYSTEM. `window.__labArt.drawn` is written by `makeRenderer.draw` itself (the main
 * canvas only), and the pixel census reads the canvas — not the checkbox, not the load status alone. A page whose
 * toggle said "on" while the renderer drew rectangles fails on both.
 *
 *   per arm (replay, solve, edit, generate): the art loads (`status: 'ready'`, no failed sheet), the last draw
 *   painted sprites, and at most `RECT_MAX` of the canvas is rectangle-palette colour — then `?art=off` (and the
 *   checkbox) draws rectangles: `drawn: null` and at least `RECT_MIN` of the canvas in the palette. The replay arm
 *   also scrubs BACKWARDS. The set editor's strip draws its room stills, and the toggle re-draws them.
 *
 *   ⛓ L2b (seedling-lab-static-art-2): one vanilla room per newly drawn family (blocks, hazards, an NPC, a
 *   machine, a turret, a boss), art on and off — every family the room holds reports sprites in the readout
 *   (`drawn.families`), and in the boxes L2 drew as rectangles at most `SAME_MAX` of the pixels are unchanged.
 *
 *   ⛓ seedling-gen-ropegate: a generated ROPE GATE room (`?elements=ropegate`, post-sword) certifies, holds its trap
 *   and rope, and draws the trap in sprites.
 *
 *   ⛓ gen-biomes-1: the generate arm's LOOK select — one generated room in every look, the canvas's floor and
 *   wall pixels following each look's COLUMN (stills `look-<name>.png`) — and the four new item presets boot.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like its siblings.
 * Run: node scripts/procgen/check-seedling-lab-art.mjs [--host=http://localhost:8000] [--shots=<dir>]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLOOR_COLOUR, SOLID_COLOUR, TILE_COLOURS } from '../../frontend/modules/seedlingDemo/rectPalette.js';

argvHelp(import.meta.url);

/**
 * ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help`'s import door): the box, the probe and the browser are all
 * `main()`'s.
 */
async function main() {
    takeBoxLockOrExit({ name: 'check-seedling-lab-art.mjs', kind: 'browser' });

    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

    const HOST = arg('host', 'http://localhost:8000');
    const SHOTS = arg('shots', '');
    const PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`;
    const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';
    /** The share of canvas pixels in the rectangle palette: an art draw stays under the first, a rect draw over the second. */
    const RECT_MAX = 0.2;
    const RECT_MIN = 0.5;

    let failed = 0;
    const check = (ok, what, detail) => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed++;
    };

    // (the body is drained: an unread body kills Node 22's undici — trap 1057)
    const alive = await fetch(`${HOST}/${TAPES}/index.json`)
        .then(async (r) => { await r.arrayBuffer(); return r.ok; }).catch(() => false);
    if (!alive) {
        console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO ROOT (or pass --host=)`);
        process.exit(0);
    }
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });

    /** The palette the rectangle view fills with (the floor, the walls, every tile colour) plus the background. */
    const PALETTE = [...new Set([FLOOR_COLOUR, SOLID_COLOUR, ...Object.values(TILE_COLOURS), '#101014'])]
        .map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));

    const browser = await chromium.launch();

    /** The share of the main canvas's pixels that are EXACTLY a palette colour (the rect view's flat fills). */
    const paletteShare = (page) => page.evaluate((palette) => {
        const c = document.getElementById('canvas');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const keys = new Set(palette.map(([r, g, b]) => (r << 16) | (g << 8) | b));
        let hit = 0;
        let n = 0;
        for (let i = 0; i < d.length; i += 4 * 7) { n += 1; if (keys.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) hit += 1; }
        return { share: hit / n, w: c.width, h: c.height };
    }, PALETTE);

    const ARMS = Object.freeze([
        { name: 'replay', q: `tape=${TAPES}/r8-solve-1.json&side=js&tick=40`, scrub: true },
        { name: 'solve', q: 'source=solve' },
        { name: 'edit', q: 'source=edit&level=4' },
        { name: 'generate', q: 'source=generate&seed=1' },
    ]);

    for (const arm of ARMS) {
        console.log(`\n## ${arm.name}`);
        for (const mode of ['on', 'off']) {
            const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
            const errors = [];
            page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
            page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
            const q = [arm.q, mode === 'off' ? 'art=off' : ''].filter(Boolean).join('&');
            await page.goto(`${PAGE}${q ? `?${q}` : ''}`, { waitUntil: 'domcontentloaded' });
            const ready = await page.waitForFunction((want) => {
                const a = window.__labArt;
                if (!a || a.status === 'loading' || a.status === 'idle') return false;
                return want === 'on' ? (a.status !== 'ready' || a.drawn !== null) : a.status === 'ready';
            }, mode, { timeout: 90000 }).then(() => true).catch(() => false);
            // the replay arm keeps drawing; give every arm a beat to settle its first frame
            await page.waitForTimeout(1500);
            const art = await page.evaluate(() => window.__labArt ?? null);
            const px = await paletteShare(page);
            if (mode === 'on') {
                check(ready && art?.status === 'ready' && art.failedSheets === 0,
                    `${arm.name}: the art loads (graphics.seedling), every sheet decoded`, JSON.stringify(art && { status: art.status, why: art.why, failedSheets: art.failedSheets }));
                check(art?.active === true && (art.drawn?.sprites ?? 0) > 0,
                    `${arm.name}: the main canvas's last draw painted SPRITES (read off the renderer)`, JSON.stringify(art?.drawn));
                check(px.share <= RECT_MAX, `${arm.name}: the canvas is NOT the rectangle palette (≤ ${RECT_MAX})`,
                    `${(px.share * 100).toFixed(1)}% palette over ${px.w}×${px.h}`);
                const box = await page.$eval('#lab-art', (i) => ({ checked: i.checked, disabled: i.disabled, inLayers: !!i.closest('#layers') }));
                check(box.checked && !box.disabled && !box.inLayers,
                    `${arm.name}: the "Seedling art" toggle is on, enabled, and NOT inside #layers`, JSON.stringify(box));
                if (SHOTS) await page.locator('#canvas').screenshot({ path: join(SHOTS, `lab-art-${arm.name}.png`) });
                if (arm.scrub) {
                    // ⛔ STATIC: scrubbing BACKWARDS needs no re-step — the frame is not a function of the tick
                    await page.$eval('#scrub', (el) => { el.value = '5'; el.dispatchEvent(new Event('input')); });
                    await page.waitForTimeout(500);
                    const back = await page.evaluate(() => window.__labArt);
                    const pxBack = await paletteShare(page);
                    check((back.drawn?.sprites ?? 0) > 0 && pxBack.share <= RECT_MAX && errors.length === 0,
                        `${arm.name}: a scrub BACKWARDS (tick 40 → 5) still draws the art, with no error`,
                        `${JSON.stringify(back.drawn)}, ${(pxBack.share * 100).toFixed(1)}% palette`);
                }
                // the checkbox turns it off on the live page (the arm's registered redraw repaints)
                await page.uncheck('#lab-art');
                await page.waitForTimeout(800);
                const off = await page.evaluate(() => window.__labArt);
                const pxOff = await paletteShare(page);
                check(off.active === false && off.drawn === null && pxOff.share >= RECT_MIN,
                    `${arm.name}: unticking the box repaints in rectangles`,
                    `drawn ${JSON.stringify(off.drawn)}, ${(pxOff.share * 100).toFixed(1)}% palette`);
            } else {
                check(art?.on === false && art.drawn === null, `${arm.name} ?art=off: the toggle starts off and the draw is rectangles`,
                    JSON.stringify(art && { on: art.on, drawn: art.drawn }));
                check(px.share >= RECT_MIN, `${arm.name} ?art=off: the canvas IS the rectangle palette (≥ ${RECT_MIN})`,
                    `${(px.share * 100).toFixed(1)}% palette`);
                if (SHOTS) await page.locator('#canvas').screenshot({ path: join(SHOTS, `lab-art-${arm.name}-off.png`) });
            }
            check(errors.length === 0, `${arm.name} (${mode}): no page errors`, errors.slice(0, 2).join(' | '));
            await page.close();
        }
    }

    // ── the SET editor's strip: the stills draw (in art), and the toggle re-keys them ──
    console.log('\n## set editor — the room stills');
    {
        const R = new URL('../../frontend/modules/seedlingDemo/', import.meta.url).href;
        const { buildLevelSet } = await import(`${R}levelSetExporter.js`);
        const { emptyLevel } = await import(`${R}procgenLevel.js`);
        // three exit-free rooms (a vanilla room's stairs name levels outside a 3-room set, which the validator refuses)
        const set = buildLevelSet([0, 1, 2].map((l) => ({ seed: 0, record: emptyLevel({ level: l, width: 10, height: 8 }),
            summary: null, name: `E${l}` })), { setId: 'lab-art-probe', generator: 'check-seedling-lab-art.mjs' }).set;
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        await page.goto(`${PAGE}?source=edit&level=4`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__labArt?.status === 'ready', null, { timeout: 90000 });
        await page.fill('#editLoad', JSON.stringify(set));
        await page.click('#editLoadGo');
        await page.waitForTimeout(1500);
        /** The strip's distinct colours inside room 0's still (a failed still is the flat cell fill). */
        const stillColours = () => page.evaluate(() => {
            const c = document.getElementById('editSetOverview');
            const cell = c.width / 3;
            const d = c.getContext('2d').getImageData(Math.round(cell * 0.2), Math.round(c.height * 0.4),
                Math.round(cell * 0.6), Math.round(c.height * 0.4)).data;
            const seen = new Set();
            for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
            return [...seen];
        });
        const detail = await page.textContent('#detail');
        const on = await stillColours();
        check(!/clientWidth/.test(detail) && on.length > 4,
            'the set strip DRAWS its room stills (before L2 every still threw `null.clientWidth` in `fit`: a detached canvas)',
            `${on.length} colours in room 0's still; detail "${detail.slice(0, 80)}"`);
        if (SHOTS) await page.locator('#editSetOverview').screenshot({ path: join(SHOTS, 'lab-art-set-strip.png') });
        await page.uncheck('#lab-art');
        await page.waitForTimeout(800);
        const off = await stillColours();
        check(JSON.stringify(off.sort()) !== JSON.stringify(on.sort()),
            '⛓ unticking the art RE-DRAWS the stills (`labStillKey`: one key per source AND mode)',
            `${on.length} → ${off.length} colours`);
        check(errors.length === 0, 'set editor: no page errors', errors.slice(0, 2).join(' | '));
        await page.close();
    }

    // ── ⛓ LAB L2b (seedling-lab-static-art-2): the room's OTHER objects, where L2 drew rectangles ──
    //
    // Per room (the editor arm, a vanilla level): the objects the skins now draw (`watchArt.labDrawnObjects` over
    // the world `buildLevelWorld` makes in node, the page's own builder) — and in each object's own box, the share
    // of canvas pixels that are IDENTICAL with the art on and off. With the art off that box is the stand-in fill;
    // with it on it is the sprite (and the tiles around it), so an identical pixel is a rectangle the art left.
    console.log('\n## L2b — blocks, hazards, NPCs, machines, static enemies, bosses');
    {
        const R = new URL('../../frontend/modules/seedlingDemo/', import.meta.url).href;
        const { ROLES, buildLevelWorld } = await import(`${R}levelWorld.js`);
        const { atlasLevelSource } = await import(`${R}levelSource.js`);
        const { FAMILY_OBJECT_TAGS } = await import(`${R}watchArt.js`);
        const source = atlasLevelSource();
        const drawnTags = new Set(Object.values(FAMILY_OBJECT_TAGS).flatMap((s) => [...s]));
        /** ⛔ the share of a box's pixels left identical by the art: at most this many (a sprite's transparent edge
         *  over a tile that happens to match is not a rectangle, so it is not zero). */
        const SAME_MAX = 0.1;
        /** `families`: the skin families that must report sprites in the renderer's readout (`drawn.families`). */
        const ROOMS = Object.freeze([
            { name: 'blocks', level: 16, families: ['puzzle', 'solids', 'trap', 'lamp'],
                why: 'a pushable block, breakable rocks, a lock, a button, sand traps, arrow traps' },
            { name: 'hazards', level: 72, families: ['hazard'], why: 'the lava chains' },
            { name: 'npc', level: 34, families: ['npc'], why: 'the talkers' },
            { name: 'machine', level: 107, families: ['machine', 'hazard', 'solids'], why: 'the beam towers, a pulser, a crusher, a button-room' },
            { name: 'turret', level: 29, families: ['roomBody'], why: 'the turrets (static "Enemy" placements: never rectangles, drawn by nothing before)' },
            { name: 'boss', level: 19, families: ['boss'], why: 'the shield boss' },
        ]);
        /** The canvas pixels inside each box (room units → canvas px), as packed RGB per box. */
        const boxPixels = (page, boxes, roomW) => page.evaluate(({ boxes, roomW }) => {
            const c = document.getElementById('canvas');
            const s = c.width / roomW;
            const ctx = c.getContext('2d');
            return boxes.map((b) => {
                const x = Math.max(0, Math.round(b.x * s));
                const y = Math.max(0, Math.round(b.y * s));
                const w = Math.max(1, Math.min(c.width - x, Math.round(b.w * s)));
                const h = Math.max(1, Math.min(c.height - y, Math.round(b.h * s)));
                const d = ctx.getImageData(x, y, w, h).data;
                const out = [];
                for (let i = 0; i < d.length; i += 4) out.push((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
                return out;
            });
        }, { boxes, roomW });
        for (const room of ROOMS) {
            const world = buildLevelWorld(source(room.level), { roles: ROLES });
            const boxes = [...world.objectSolids, ...world.pixelmasks].filter((o) => drawnTags.has(o.tag))
                .map((o) => ({ tag: o.tag, x: o.rect.x, y: o.rect.y, w: o.rect.w, h: o.rect.h }));
            const shots = {};
            for (const mode of ['on', 'off']) {
                const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
                const errors = [];
                page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
                await page.goto(`${PAGE}?source=edit&level=${room.level}${mode === 'off' ? '&art=off' : ''}`, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction((want) => {
                    const a = window.__labArt;
                    return !!a && a.status === 'ready' && (want === 'off' ? a.drawn === null : a.drawn !== null);
                }, mode, { timeout: 90000 }).catch(() => {});
                await page.waitForTimeout(1200);
                shots[mode] = { art: await page.evaluate(() => window.__labArt ?? null),
                    px: await boxPixels(page, boxes, world.world.width) };
                if (SHOTS) {
                    await page.locator('#canvas').screenshot({ path: join(SHOTS, `lab-art-2-${room.name}-L${room.level}${mode === 'off' ? '-off' : ''}.png`) });
                }
                check(errors.length === 0, `L${room.level} ${room.name} (${mode}): no page errors`, errors.slice(0, 2).join(' | '));
                await page.close();
            }
            const { art } = shots.on;
            check(art?.active === true && (art.drawn?.sprites ?? 0) > 0 && art.drawn.fallbacks === 0
                && room.families.every((f) => (art.drawn.families?.[f] ?? 0) > 0),
                `L${room.level} ${room.name}: drawn in sprites, no missing-key fallback, and ${room.families.join(' + ')} each drew (${room.why})`,
                JSON.stringify(art?.drawn));
            if (boxes.length === 0) continue;   // nothing there was ever a rectangle: the readout row above is the check
            let same = 0;
            let total = 0;
            const worst = [];
            boxes.forEach((b, i) => {
                const on = shots.on.px[i];
                const off = shots.off.px[i];
                let k = 0;
                for (let j = 0; j < on.length; j += 1) if (on[j] === off[j]) k += 1;
                same += k;
                total += on.length;
                worst.push([k / Math.max(1, on.length), b.tag]);
            });
            worst.sort((a, b) => b[0] - a[0]);
            check(same / Math.max(1, total) <= SAME_MAX,
                `L${room.level} ${room.name}: ≤ ${SAME_MAX * 100}% of the ${boxes.length} object box(es)' pixels are the rectangles L2 drew there`,
                `${((same / Math.max(1, total)) * 100).toFixed(1)}% identical; worst ${worst.slice(0, 3).map(([s, t]) => `${t} ${(s * 100).toFixed(0)}%`).join(', ')}`);
        }
    }

    // ── ⛓ seedling-gen-ropegate: a generated ROPE GATE room, art on ──
    //
    // The generate arm with `?elements=ropegate` (post-sword): the room the lab generates holds the element's two
    // parts — an armed `arrowtrap` and a `rope` with its node, one `tset` — it certifies, and the art draws the trap
    // in sprites (the `trap` family). ⚠ The rope has NO skin in the art library yet, so it draws as the renderer's
    // stand-in rect; the row records that rather than asserting a sprite nothing draws.
    console.log('\n## ropegate — a generated rope gate room');
    for (const mode of ['on', 'off']) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        await page.goto(`${PAGE}?source=generate&seed=1&biome=post-sword&elements=ropegate${mode === 'off' ? '&art=off' : ''}`,
            { waitUntil: 'domcontentloaded' });
        await page.waitForFunction((want) => {
            const a = window.__labArt;
            return !!a && a.status === 'ready' && !!window.__watch?.payload?.level
                && (want === 'off' ? a.drawn === null : a.drawn !== null);
        }, mode, { timeout: 180000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const { art, payload } = await page.evaluate(() => ({ art: window.__labArt ?? null,
            payload: window.__watch?.payload ? { certified: window.__watch.payload.certified,
                entities: window.__watch.payload.level.entities } : null }));
        if (mode === 'on') {
            const trap = (payload?.entities ?? []).filter((e) => e.type === 'arrowtrap');
            const rope = (payload?.entities ?? []).filter((e) => e.type === 'rope');
            check(payload?.certified === true && trap.length === 1 && rope.length === 1
                && trap[0].attrs?.shoot === '1' && trap[0].attrs.tset === rope[0].attrs?.tset
                && (rope[0].nodes ?? []).length === 1,
                'ropegate: the generated room CERTIFIES and holds an armed trap and a rope of ONE group, the rope with its node',
                JSON.stringify({ certified: payload?.certified, trap, rope }));
            check(art?.active === true && (art.drawn?.sprites ?? 0) > 0 && (art.drawn.families?.trap ?? 0) > 0,
                'ropegate: drawn in sprites, the arrow trap among them (`trap` family)', JSON.stringify(art?.drawn));
        } else {
            check(art?.drawn === null, 'ropegate ?art=off: the rectangles', JSON.stringify(art && { on: art.on, drawn: art.drawn }));
        }
        if (SHOTS) await page.locator('#canvas').screenshot({ path: join(SHOTS, `lab-art-ropegate${mode === 'off' ? '-off' : ''}.png`) });
        check(errors.length === 0, `ropegate (${mode}): no page errors`, errors.slice(0, 2).join(' | '));
        await page.close();
    }

    // ── ⛓ seedling-gen-biomes-1 (C1 + C2): the generate arm's LOOK select and the four new item presets ──
    //
    // One generated room (seed 1, pre-sword), redrawn in every look with the art on. The record's own GROUND and
    // WALL cells (`__editorGenerated.level`, the generator's record, which the look never touches) are averaged
    // to one colour per class off the CANVAS, and compared with the `none` draw (Ground / Stone) and with each
    // other: every look's floor must leave Ground; its walls must leave Stone exactly when its wall column is not
    // Stone's; and two looks agree on a class exactly when they paint it with the same COLUMN. That last clause
    // is the pixel proof the canvas is drawn from the look's columns: sharing a column ⇒ the same pixels, a
    // different column ⇒ different ones, for every pair.
    console.log('\n## gen-biomes-1 — the generate arm draws each LOOK, and offers the new presets');
    {
        const R = new URL('../../frontend/modules/seedlingDemo/', import.meta.url).href;
        const { GEN_LOOKS, LAB_LOOK_NONE } = await import(`${R}procgenLook.js`);
        const { TERRAIN } = await import(`${R}procgenLevel.js`);
        /** Mean-colour distance (0–441) above which two class colours DIFFER, and below which they are the SAME. */
        const DIFFER = 12;
        const SAME = 4;
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        await page.goto(`${PAGE}?source=generate&seed=1&biome=pre-sword`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__labArt?.status === 'ready' && window.__labArt.drawn !== null
            && window.__editorGenerate?.status === 'ok', null, { timeout: 120000 }).catch(() => {});
        const options = await page.$$eval('#genBiome option', (os) => os.map((o) => o.value));
        check(['post-fire', 'post-spear', 'post-dark-suit', 'endgame'].every((b) => options.includes(b)),
            'the generate arm\'s biome select lists the four new presets', options.join(', '));
        const looks = await page.$$eval('#genLook option', (os) => os.map((o) => o.value));
        check(Object.keys(GEN_LOOKS).every((l) => looks.includes(l)) && looks.includes(LAB_LOOK_NONE),
            'the generate arm has a look select holding every look and `none`', looks.join(', '));
        const record = await page.evaluate(() => window.__editorGenerated?.level ?? null);
        const cells = { floor: [], wall: [] };
        for (const [tx, ty, px] of record?.layers?.[0]?.tiles ?? []) {
            if (px / 16 === TERRAIN.ground.column) cells.floor.push([tx, ty]);
            if (px / 16 === TERRAIN.wall.column) cells.wall.push([tx, ty]);
        }
        /** The canvas's mean colour over each class's cells (each cell's middle half, away from autotile edges). */
        const classColours = () => page.evaluate(({ cells, w }) => {
            const c = document.getElementById('canvas');
            const s = c.width / w;
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            const out = {};
            for (const [cls, list] of Object.entries(cells)) {
                const sum = [0, 0, 0];
                let n = 0;
                for (const [tx, ty] of list) {
                    for (let y = Math.round((ty + 0.25) * s); y < Math.round((ty + 0.75) * s); y += 1) {
                        for (let x = Math.round((tx + 0.25) * s); x < Math.round((tx + 0.75) * s); x += 1) {
                            const i = (y * c.width + x) * 4;
                            sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; n += 1;
                        }
                    }
                }
                out[cls] = sum.map((v) => v / Math.max(1, n));
            }
            return out;
        }, { cells, w: record?.width ?? 1 });
        const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        const drawn = {};
        for (const look of [LAB_LOOK_NONE, ...Object.keys(GEN_LOOKS)]) {
            await page.selectOption('#genLook', look);
            const want = look === LAB_LOOK_NONE ? null : look;
            const ok = await page.waitForFunction((w) => window.__editorGenerate?.look === w
                && window.__labArt?.drawn !== null, want, { timeout: 60000 }).then(() => true).catch(() => false);
            await page.waitForTimeout(800);
            drawn[look] = await classColours();
            check(ok, `look ${look}: the arm redrew in it (\`__editorGenerate.look\` = ${JSON.stringify(want)}, art drawn)`);
            if (SHOTS) await page.locator('#canvas').screenshot({ path: join(SHOTS, `look-${look}.png`) });
        }
        check(cells.floor.length > 0 && cells.wall.length > 0, 'the room holds ground and wall cells to measure',
            `${cells.floor.length} floor, ${cells.wall.length} wall`);
        const columnOf = (look, cls) => (look === LAB_LOOK_NONE
            ? (cls === 'floor' ? TERRAIN.ground.column : TERRAIN.wall.column) : GEN_LOOKS[look][cls]);
        const names = Object.keys(drawn);
        for (const cls of ['floor', 'wall']) {
            const wrong = [];
            for (let i = 0; i < names.length; i += 1) {
                for (let j = i + 1; j < names.length; j += 1) {
                    const sameColumn = columnOf(names[i], cls) === columnOf(names[j], cls);
                    const d = dist(drawn[names[i]][cls], drawn[names[j]][cls]);
                    if (sameColumn ? d > SAME : d < DIFFER) {
                        wrong.push(`${names[i]}/${names[j]} ${sameColumn ? 'share' : 'differ in'} column, Δ ${d.toFixed(1)}`);
                    }
                }
            }
            check(wrong.length === 0, `the ${cls} pixels follow the look's ${cls} COLUMN across all ${names.length} draws `
                + `(same column ⇒ Δ ≤ ${SAME}, different ⇒ Δ ≥ ${DIFFER})`, wrong.slice(0, 4).join('; '));
        }
        check(errors.length === 0, 'looks: no page errors', errors.slice(0, 2).join(' | '));
        await page.close();

        for (const biome of ['post-fire', 'post-spear', 'post-dark-suit', 'endgame']) {
            const p = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
            const errs = [];
            p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
            await p.goto(`${PAGE}?source=generate&seed=1&biome=${biome}`, { waitUntil: 'domcontentloaded' });
            const g = await p.waitForFunction(() => (window.__editorGenerate?.status ? window.__editorGenerate : null),
                null, { timeout: 120000 }).then((h) => h.jsonValue()).catch(() => null);
            await p.waitForTimeout(800);
            check(g?.status === 'ok' && g.biome === biome && g.look === biome && errs.length === 0,
                `${biome}: the generate arm builds, solves and draws it in its own look`,
                JSON.stringify(g && { status: g.status, biome: g.biome, look: g.look, step: g.step }) + errs.slice(0, 1).join(''));
            if (SHOTS) await p.locator('#canvas').screenshot({ path: join(SHOTS, `preset-${biome}.png`) });
            await p.close();
        }
    }

    await browser.close();
    console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}

if (isEntryPoint(import.meta.url)) await main();
