/**
 * seedlingPortalSkin — THE SHOWN TELEPORTERS IN THE GAME'S PICTURE (slice `seedling-js-portal-sprite`).
 *
 * `Teleporter.as:14-15,47-54`: an 18×18 Spritemap of Portal.png at `x = y = −1`, "spin" [0,1,2,3] at 15 fps played in
 * the constructor, `visible = _show`. `roomOps` draws a shown, active teleporter as `PORTAL_KEY` at layer 0, framed
 * from the visit's start; the stand-in rectangle is its fallback. Golden lines (`formatOp`) pin the frame CHOICE and
 * the placement, never pixels; the mutants (a wrong origin, a wrong rate) turn them red.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { buildLevelWorld } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import {
    PORTAL_ANIM, PORTAL_KEY, PORTAL_LAYER, TELEPORTER_COLOUR, formatOp, portalVisitTick, roomOps, shownTeleporters,
    teleporterArtFilter,
} from './seedlingSkinRenderer.js';
import { NIGHT_COPIES, NIGHT_COVERAGE } from './seedlingNightSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const recordOf = (level) => MAP.levels.find((l) => l.level === level) ?? null;

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/** The page's call, with art: only the shown teleporters reach `roomOps`, which draws them as portals. */
const pageOps = (world, level, lib, extra = {}) => {
    const record = recordOf(level);
    return roomOps(world, lib, {
        level, drawnTeleporters: teleporterArtFilter(record), shownTeleporter: shownTeleporters(record), ...extra,
    });
};
const portalLines = (ops) => ops.filter((o) => o?.key === PORTAL_KEY).map(formatOp);
const standIns = (ops) => ops.filter((o) => o && !o.key && o.colour === TELEPORTER_COLOUR);
const worldOf = (level, opts) => buildLevelWorld(levelSourceFromAtlas(MAP)(level), opts);

/**
 * One shown portal per level that has one, at tick 0 (frame 0): the frame's top-left at the entity position − (1, 1).
 * L58's portal carries tag 1 (deactivated while it holds), so it is built with tag 1 cleared; L69's is the Light Boss's
 * runtime exit (`LightBossController.as:104`, `_show = true`), built with the controller's tag 0 cleared.
 */
const GOLDENS = Object.freeze([
    { level: 43, cleared: null, lines: ['drawImage(seedling/Portal, 0, 0, 143, 63)'] },
    { level: 58, cleared: [1], lines: ['drawImage(seedling/Portal, 0, 0, 79, 15)'] },
    { level: 69, cleared: [0], lines: ['drawImage(seedling/Portal, 0, 0, 71, 71)'] },
    { level: 100, cleared: null, lines: ['drawImage(seedling/Portal, 0, 0, 287, 95)'] },
    { level: 101, cleared: null, lines: ['drawImage(seedling/Portal, 0, 0, 103, 23)'] },
    { level: 106, cleared: null, lines: ['drawImage(seedling/Portal, 0, 0, 63, 47)'] },
    { level: 109, cleared: null, lines: ['drawImage(seedling/Portal, 0, 0, 159, 47)'] },
]);

/** "spin" at 15 fps: 15 × 0.0333 = 0.4995 frames per update (`Spritemap.as:70-99`), so each frame holds 2–3 ticks. */
const SPIN = Object.freeze([[0, 0], [2, 0], [3, 1], [4, 1], [5, 2], [6, 2], [7, 3], [8, 3], [9, 0], [10, 0], [11, 1], [41, 0]]);

describe('1. which teleporters the game shows', () => {
    it('the vanilla map shows exactly six (L43 L58 L100 L101 L106 L109), re-derived from the map', () => {
        const levels = MAP.levels.filter((l) => (l.entities ?? []).some((e) => e.type === 'teleporter' && Number(e.attrs?.show ?? 0) !== 0))
            .map((l) => l.level);
        expect(levels).toEqual([43, 58, 100, 101, 106, 109]);
    });
    it('the Light Boss exit is shown (`_show = true`); the stairs never are', () => {
        const shown = shownTeleporters(null);
        expect(shown({ x: 72, y: 72, lightsExit: true })).toBe(true);
        expect(shown({ x: 72, y: 72 })).toBe(false);
        expect(shownTeleporters(recordOf(43))({ x: 144, y: 64, isStairs: true })).toBe(false);
        const l69 = worldOf(69, { cleared: [0] });
        expect(l69.teleporters.filter((tp) => tp.lightsExit).length).toBe(1);
    });
});

describe('2. the golden lists: one shown portal per level, at the AS3 origin, layer 0', () => {
    for (const g of GOLDENS) {
        it(`L${g.level}: the portal sprite, and no stand-in rectangle left`, () => {
            const world = worldOf(g.level, g.cleared ? { cleared: g.cleared } : undefined);
            const ops = pageOps(world, g.level, art);
            expect(portalLines(ops)).toEqual(g.lines);
            expect(standIns(ops)).toEqual([]);
            for (const o of ops.filter((p) => p?.key === PORTAL_KEY)) {
                expect(o.layer).toBe(PORTAL_LAYER);
                expect(o.fallback.colour).toBe(TELEPORTER_COLOUR);
            }
        });
    }
    it('MUTANT: a wrong origin (the frame\'s top-left ON the entity) moves every golden', () => {
        const wrong = { ...art, frameRect: (k, f) => (k === PORTAL_KEY ? { ...art.frameRect(k, f), ox: 0, oy: 0 } : art.frameRect(k, f)) };
        const g = GOLDENS[0];
        expect(portalLines(pageOps(worldOf(g.level), g.level, wrong))).not.toEqual(g.lines);
    });
    it('the portal sits under the Y-sorted bodies and over the tiles (layer 0)', () => {
        const world = worldOf(43);
        const body = { key: 'test:body', sheetRef: 'x', sx: 0, sy: 0, sw: 1, sh: 1, dx: 0, dy: 0, layer: -80 };
        const ops = pageOps(world, 43, art, { entitySprites: [body] });
        const at = (p) => ops.findIndex(p);
        expect(at((o) => o.key === PORTAL_KEY)).toBeLessThan(at((o) => o === body));
        expect(at((o) => o.layer === 100)).toBeLessThan(at((o) => o.key === PORTAL_KEY));
    });
});

describe('3. the frame: "spin" at 15 fps from the visit\'s start, on the GAME tick', () => {
    const frameAtTick = (lib, tick, visitTick = 0) => {
        const op = pageOps(worldOf(43), 43, lib, { tick, visitTick }).find((o) => o?.key === PORTAL_KEY);
        return op.sx / 18;
    };
    it('ticks since the visit → frame', () => {
        expect(SPIN.map(([n]) => frameAtTick(art, n))).toEqual(SPIN.map(([, f]) => f));
    });
    it('the cycle restarts with the visit (`visitTick`), and the same tick always gives the same frame', () => {
        expect(SPIN.map(([n]) => frameAtTick(art, 1000 + n, 1000))).toEqual(SPIN.map(([, f]) => f));
        expect(frameAtTick(art, 1234, 1000)).toBe(frameAtTick(art, 1234, 1000));
        expect(art.frameAt(PORTAL_KEY, PORTAL_ANIM, 3)).toBe(1);
    });
    it('MUTANT: a wrong rate (30 fps) picks other frames', () => {
        const fast = { ...art, frameAt: (k, a, t, p) => (k === PORTAL_KEY ? [0, 1, 2, 3][Math.floor(t * 30 * 0.0333) % 4] : art.frameAt(k, a, t, p)) };
        expect(SPIN.map(([n]) => frameAtTick(fast, n))).not.toEqual(SPIN.map(([, f]) => f));
    });
    it('portalVisitTick: the newest arrival into the run\'s level, or the newest death in it; 0 for the boot visit', () => {
        expect(portalVisitTick(null)).toBe(0);
        expect(portalVisitTick({ level: 43, transitions: [] })).toBe(0);
        const run = { level: 43, transitions: [{ t: 10, to_level: 43 }, { t: 50, to_level: 37 }, { t: 90, to_level: 43 }], playerDeaths: [] };
        expect(portalVisitTick(run)).toBe(90);
        expect(portalVisitTick({ ...run, playerDeaths: [{ t: 120, level: 43 }, { t: 200, level: 37 }] })).toBe(120);
    });
});

describe('4. what stays: the fallback, the deactivated, the debug view, the other callers', () => {
    it('art without PORTAL_KEY: the shown portal is its stand-in rectangle', () => {
        const without = { ...art, has: (k) => k !== PORTAL_KEY && art.has(k) };
        const ops = pageOps(worldOf(43), 43, without);
        expect(portalLines(ops)).toEqual([]);
        expect(standIns(ops).map((o) => `${o.rect.x},${o.rect.y}`)).toEqual(['144,64']);
    });
    it('a deactivated portal (L58, tag 1 holding) draws nothing (`Teleporter.as:122-125`)', () => {
        const world = worldOf(58);
        expect(world.teleporters.some((tp) => tp.x === 80 && tp.y === 16 && tp.deactivated)).toBe(true);
        const ops = pageOps(world, 58, art);
        expect(portalLines(ops)).toEqual([]);
        expect(standIns(ops)).toEqual([]);
    });
    it('the art-less (debug) view paints every active teleporter as a rectangle, the shown one too', () => {
        const world = worldOf(43);
        const ops = roomOps(world, null, { level: 43, shownTeleporter: shownTeleporters(recordOf(43)) });
        expect(standIns(ops).length).toBe(world.teleporters.filter((tp) => !tp.deactivated).length);
    });
    it('without `shownTeleporter` (every other caller) the list is the old one, op for op', () => {
        const world = worldOf(101);
        const old = roomOps(world, art, { level: 101, drawnTeleporters: teleporterArtFilter(recordOf(101)) });
        expect(portalLines(old)).toEqual([]);
        expect(standIns(old).length).toBe(1);
        const now = pageOps(world, 101, art);
        const strip = (ops) => ops.filter((o) => o.key !== PORTAL_KEY && !(o.colour === TELEPORTER_COLOUR && !o.key)).map(formatOp);
        expect(strip(now)).toEqual(strip(old));
    });
    it('the night copy (`Teleporter.as:129-137` renderLit) is the same picture', () => {
        expect(NIGHT_COPIES[PORTAL_KEY]).toEqual({ alpha: 'same' });
        expect(NIGHT_COVERAGE.remaining.join(' ')).not.toMatch(/Teleporter/);
    });
    it('THE PAGE passes the shown predicate and the visit tick (jsRuntimePage.js)', () => {
        const src = readFileSync(join(HERE, 'jsRuntimePage.js'), 'utf8');
        expect(src).toContain('shownTeleporter: shownTeleporters(roomRecord)');
        expect(src).toContain('visitTick: portalVisitTick(runtime.run)');
    });
});
