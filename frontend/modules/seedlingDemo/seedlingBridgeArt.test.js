/**
 * seedlingBridgeArt.test.js — THE JS PAGE'S BRIDGE (tile 29) from the pack, closed / opening / open AS THE RUN SAYS
 * (`seedlingBridgeSkin.bridgeSkinView` → `roomOps`' `bridgeLook`), per `Scenery/Tile.as:343-376`.
 *
 *   A. BY HAND from the AS3: `openingBridge[int((1 - timer/60) * 6)]` with the timer-0 overflow → frame 0; the
 *      frame lists equal the pack's `closed` / `open` anims; the INVERT spelling is the solids skin's.
 *   B. THE SCHEDULE (`bridgeLook`): closed through the hit's tick, then one opening frame per tick counting the timer
 *      down to 0 on the last state before the run's gate opens, then `open` exactly when the gate says so.
 *   C. THE RENDER (`roomOps`): no `bridgeLook` → the `closed` anim (the lab, byte-identical); `{anim: 'open'}` → the
 *      `open` anim on the WORLD clock (not timed from the opening, not held); `{opening}` → that frame, inverted.
 *   D. NO PACK → the bridge object's stand-in `fillRect` stays; with the key, claiming `BRIDGE_OBJECT_TAGS` drops
 *      exactly that rect. A press from an EARLIER visit, or a run with no bridge state, is closed.
 *   E. THE REAL TAPE `fixtures/tapes/rulesref-l66-door.json` (L66's spear bridge (7,9), one thrust at tick 5):
 *      closed before the spear, opening after it, open from the tick the run's `openBridges` holds it — and the run's
 *      stream, ledgers and `stateDigest` are identical with the view + ops called every tick or never.
 *   F. THE NIGHT COPY of an opening op is alpha 1, NORMAL blend, no silhouette (`:364`, `:370-373`).
 *   G. THE PAGE (`jsRuntimePage.js`) parses and has the wiring; the browser row `seedling-js-runtime-graphics-bridge`
 *      is the real page's pin.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { runTape } from './tapeRunner.js';
import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { createLevelRun } from './levelRun.js';
import { formatOp, roomOps } from './seedlingSkinRenderer.js';
import { INVERT_SILHOUETTE } from './seedlingSolidsSkin.js';
import { nightOps, nightSkinView, stepNightSkin } from './seedlingNightSkin.js';
import {
    BRIDGE_FRAMES, BRIDGE_INVERT, BRIDGE_OBJECT_TAGS, BRIDGE_TILE_KEY, bridgeLook, bridgeSkinView, openingFrame,
} from './seedlingBridgeSkin.js';
import { BRIDGE_TILE_KEY as LAB_BRIDGE_TILE_KEY, FAMILY_OBJECT_TAGS } from './watchArt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/seedling/art/manifest.json'), 'utf8'));
const L66_DOOR = () => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes/rulesref-l66-door.json'), 'utf8'));

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

const findSprite = (o, key) => {
    if (!o || typeof o !== 'object') return null;
    if (o[key]) return o[key];
    for (const v of Object.values(o)) { const hit = findSprite(v, key); if (hit) return hit; }
    return null;
};
/** The sheet frame an op draws, read back from its source rect (`frameRect`), not from any field the code sets. */
const frameOfOp = (op) => {
    for (let f = 0; f < 19; f++) {
        const r = art.frameRect(BRIDGE_TILE_KEY, f);
        if (r && r.sheetRef === op.sheetRef && r.sx === op.sx && r.sy === op.sy) return f;
    }
    return null;
};
const bridgeTileOps = (ops) => ops.filter((o) => o?.key === BRIDGE_TILE_KEY);
const world66 = () => buildLevelWorld(levelSourceFromAtlas(MAP)(66));

describe('A. by hand from Tile.as:75-79, :353', () => {
    it('the frame lists, and the pack carries closed [0,1] / open [7..18] on the world clock, 2 loops', () => {
        expect(BRIDGE_FRAMES).toEqual({ closed: [0, 1], opening: [1, 2, 3, 4, 5, 6], open: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] });
        const s = findSprite(MANIFEST, BRIDGE_TILE_KEY);
        expect(s.anims.closed).toEqual({ clock: 'world', frames: [0, 1], loops: 2 });
        expect(s.anims.open).toEqual({ clock: 'world', frames: BRIDGE_FRAMES.open, loops: 2 });
        expect(s.frames).toBe(19);
    });
    it('openingFrame: int((1 - timer/60) * 6) into [1..6]; timer 0 overflows to undefined → frame 0', () => {
        // by hand: timer 58 → int(0.2) = 0 → 1; 45 → int(1.5) = 1 → 2; 30 → 3 → 4; 10 → int(5) = 5 → 6
        expect([58, 45, 30, 10, 1].map(openingFrame)).toEqual([1, 2, 4, 6, 6]);
        expect(openingFrame(0)).toBe(0);
    });
    it('the opening INVERT is the solids skin\'s Lock spelling (a white silhouette under difference)', () => {
        expect(BRIDGE_INVERT).toEqual({ blend: 'difference', tint: INVERT_SILHOUETTE });
    });
});

describe('B. the schedule (bridgeLook)', () => {
    // L66's real press row: t 5, fired 6; the run's gate holds the bridge from ticksCompleted 64 (= 5 + 60 - 1)
    const press = { t: 5, fired: 6 };
    it('closed (null) with no press, and through the hit\'s own tick', () => {
        expect(bridgeLook({ open: false, press: null, ticksCompleted: 100 })).toBeNull();
        for (const c of [0, 5, 6]) expect(bridgeLook({ open: false, press, ticksCompleted: c })).toBeNull();
    });
    it('opening from the hit: the timer counts down to 0 on the last state before the gate opens', () => {
        const timers = [];
        for (let c = 7; c <= 63; c++) timers.push(bridgeLook({ open: false, press, ticksCompleted: c }).timer);
        expect(timers[0]).toBe(56);
        expect(timers.at(-1)).toBe(0);
        expect(timers.every((t, i) => i === 0 || t === timers[i - 1] - 1)).toBe(true);
        expect(bridgeLook({ open: false, press, ticksCompleted: 63 })).toEqual({ opening: 0, timer: 0 });
        expect(bridgeLook({ open: false, press, ticksCompleted: 7 })).toEqual({ opening: 1, timer: 56 });
    });
    it('open is the run\'s gate, whatever the ledger says', () => {
        expect(bridgeLook({ open: true, press, ticksCompleted: 64 })).toEqual({ anim: 'open' });
        expect(bridgeLook({ open: true, press: null, ticksCompleted: 3 })).toEqual({ anim: 'open' });
    });
});

describe('C. the render (roomOps)', () => {
    it('no bridgeLook → every bridge is the closed anim at the tick (the lab\'s path, unchanged)', () => {
        for (const tick of [0, 7, 13, 40]) {
            const ops = bridgeTileOps(roomOps(world66(), art, { level: 66, tick }));
            expect(ops).toHaveLength(1);
            expect(frameOfOp(ops[0])).toBe(art.frameAt(BRIDGE_TILE_KEY, 'closed', tick));
            expect(ops[0].blend).toBeUndefined();
        }
    });
    it('{anim: open} → the open anim on the WORLD clock: the same frame as any open bridge at that tick', () => {
        const seen = new Set();
        for (let tick = 0; tick < 80; tick += 3) {
            const [op] = bridgeTileOps(roomOps(world66(), art, { level: 66, tick, bridgeLook: () => ({ anim: 'open' }) }));
            const f = frameOfOp(op);
            expect(f).toBe(art.frameAt(BRIDGE_TILE_KEY, 'open', tick));
            expect(BRIDGE_FRAMES.open).toContain(f);
            seen.add(f);
        }
        expect(seen.size).toBeGreaterThan(2); // it loops; it does not hold one frame
    });
    it('{opening} → that sheet frame, inverted, live (never baked), and only for the bridge asked about', () => {
        for (const f of [0, 1, 4, 6]) {
            const ops = roomOps(world66(), art, { level: 66, tick: 9, bridgeLook: (id) => (id === '7,9' ? { opening: f } : null) });
            const [op] = bridgeTileOps(ops);
            expect(frameOfOp(op)).toBe(f);
            expect(op).toMatchObject({ blend: 'difference', tint: INVERT_SILHOUETTE, bridgeOpening: true, still: false });
        }
        const other = bridgeTileOps(roomOps(world66(), art, { level: 66, tick: 9, bridgeLook: (id) => (id === '0,0' ? { opening: 3 } : null) }));
        expect(frameOfOp(other[0])).toBe(art.frameAt(BRIDGE_TILE_KEY, 'closed', 9));
    });
    it('the lab constants are the bridge skin\'s (one spelling)', () => {
        expect(LAB_BRIDGE_TILE_KEY).toBe(BRIDGE_TILE_KEY);
        expect(FAMILY_OBJECT_TAGS.bridge).toBe(BRIDGE_OBJECT_TAGS);
        expect([...BRIDGE_OBJECT_TAGS]).toEqual(['tile:Bridge']);
    });
});

describe('D. the fallback and the visit', () => {
    it('no pack: the bridge object keeps its stand-in rect; claiming BRIDGE_OBJECT_TAGS drops exactly that one', () => {
        const w = world66();
        const solid = w.objectSolids.find((o) => o.tag === 'tile:Bridge');
        expect(solid.bridgeId).toBe('7,9');
        const bare = roomOps(w, null, { level: 66 }).map(formatOp);
        // the object's stand-in (layer -bottom); the tile's own colour rect shares the rect object, at TILE_LAYER
        const isStandIn = (o) => !o.sheetRef && o.rect === solid.rect && o.layer === -solid.rect.bottom;
        const standIn = roomOps(w, null, { level: 66 }).filter(isStandIn);
        expect(standIn).toHaveLength(1);
        expect(standIn[0].colour).toBe('#6b4a2a');
        const withArt = roomOps(w, art, { level: 66 });
        const claimed = roomOps(w, art, { level: 66, drawnObjects: (o) => BRIDGE_OBJECT_TAGS.has(o.tag) });
        expect(withArt.filter(isStandIn)).toHaveLength(1);
        expect(claimed.filter(isStandIn)).toHaveLength(0);
        expect(claimed.length).toBe(withArt.length - 1);
        expect(bare.length).toBeGreaterThan(0);
    });
    it('a press from an EARLIER visit is closed; a run with no bridge state (openBridges null) is closed', () => {
        const fake = (over) => ({
            state: {}, level: 66, ticksCompleted: 40, openBridges: new Set(), transitions: [], playerDeaths: [],
            presses: [{ t: 5, fired: 6, level: 66, hits: [{ as3: 'Tile', id: '7,9' }] }], ...over,
        });
        expect(bridgeSkinView(fake()).look('7,9')).toEqual({ opening: openingFrame(23), timer: 23 });
        expect(bridgeSkinView(fake({ transitions: [{ t: 20, to_level: 66 }] })).look('7,9')).toBeNull();
        expect(bridgeSkinView(fake({ playerDeaths: [{ t: 20, level: 66 }] })).look('7,9')).toBeNull();
        expect(bridgeSkinView(fake({ openBridges: null })).look('7,9')).toBeNull();
        expect(bridgeSkinView(fake({ level: 63 })).look('7,9')).toBeNull();
        expect(bridgeSkinView(null)).toBeNull();
    });
});

/** Play the L66 tape; per tick the page's look for (7,9), the run's gate and the drawn tile op. */
function scrubL66({ paint = true } = {}) {
    const rows = [];
    let lastRun = null;
    const out = runTape(L66_DOOR(), {
        levelSource: atlasLevelSource(),
        onTick: (t, now, held, run) => {
            lastRun = run;
            if (!paint) return;
            const view = bridgeSkinView(run);
            const ops = run.level === 66 ? roomOps(run.world, art, { level: 66, tick: run.ticksCompleted, bridgeLook: view.look }) : [];
            const op = bridgeTileOps(ops)[0] ?? null;
            rows.push({ c: run.ticksCompleted, level: run.level, look: view.look('7,9'), gate: !!run.openBridges?.has('7,9'),
                frame: op ? frameOfOp(op) : null, inverted: op?.blend === 'difference' });
        },
    });
    return { rows, out, end: JSON.stringify([lastRun.stateDigest(), lastRun.presses, lastRun.transitions, lastRun.playerDeaths]) };
}

describe('E. the real tape: rulesref-l66-door (L66\'s spear bridge (7,9), one thrust at tick 5)', () => {
    let scrub;
    beforeAll(() => { scrub = scrubL66(); });
    it('the press row is the one the schedule pins (t 5, fired 6), and the gate opens at ticksCompleted 64', () => {
        const at66 = scrub.rows.filter((r) => r.level === 66);
        expect(at66.find((r) => r.gate).c).toBe(64);
    });
    it('closed before the spear lands, opening after it, open (the open anim) from the gate on', () => {
        const at66 = scrub.rows.filter((r) => r.level === 66);
        for (const r of at66) {
            if (r.c <= 6) {
                expect(r.look, `c ${r.c}`).toBeNull();
                expect(r.frame).toBe(art.frameAt(BRIDGE_TILE_KEY, 'closed', r.c));
                expect(r.inverted).toBe(false);
            } else if (r.c < 64) {
                expect(r.look.timer, `c ${r.c}`).toBe(63 - r.c);
                expect(r.frame).toBe(openingFrame(63 - r.c));
                expect(r.inverted).toBe(true);
            } else {
                expect(r.gate, `c ${r.c}`).toBe(true);
                expect(r.look).toEqual({ anim: 'open' });
                expect(r.frame).toBe(art.frameAt(BRIDGE_TILE_KEY, 'open', r.c));
                expect(r.inverted).toBe(false);
            }
        }
        // every opening frame the AS3 can show is shown, in order
        const opening = [...new Set(at66.filter((r) => r.c > 6 && r.c < 64).map((r) => r.frame))];
        expect(opening).toEqual([1, 2, 3, 4, 5, 6, 0]);
        expect(at66.at(-1).c).toBeGreaterThan(64);
    });
    it('⛔ render only: the stream, the ledgers and stateDigest are identical with the view and ops every tick or never', () => {
        const bare = scrubL66({ paint: false });
        expect(JSON.stringify(scrub.out.ticks)).toBe(JSON.stringify(bare.out.ticks));
        expect(JSON.stringify(scrub.out.transitions)).toBe(JSON.stringify(bare.out.transitions));
        expect(scrub.end).toBe(bare.end);
    });
});

describe('F. the night copy of an opening op (Tile.as:364, :370-373)', () => {
    it('alpha 1, NORMAL blend, no silhouette — the closed bridge keeps its sin-pulse copy', () => {
        // L63 is a night room (`night-poles-L63`) with a bridge (2,9)
        const run = createLevelRun({ levelSource: atlasLevelSource(), boot: { level: 63, x: 32, y: 128 },
            noHazards: ['water', 'lava', 'ice', 'waterfall'] });
        const record = loadAtlas().levels[63];
        const view = nightSkinView(run, { record });
        const skin = stepNightSkin(null, view, 0);
        const cam = { x: 0, y: 0, w: 160, h: 160 };
        const copyOf = (look) => {
            const ops = roomOps(run.world, art, { level: 63, tick: 0, bridgeLook: () => look });
            const night = nightOps(view, art, { skin, ops, cam });
            expect(night).not.toBeNull();
            return night.ops.filter((o) => o.key === BRIDGE_TILE_KEY);
        };
        const opening = copyOf({ opening: 3 });
        expect(opening).toHaveLength(1);
        expect(opening[0].alpha).toBeUndefined(); // 1 = the field absent
        expect(opening[0].blend).toBeUndefined();
        expect(opening[0].tint).toBeUndefined();
        expect(frameOfOp(opening[0])).toBe(3);
        for (const o of copyOf(null)) expect(o.alpha).toBeLessThanOrEqual(0.1);
    });
});

describe('G. the page (jsRuntimePage.js)', () => {
    const PAGE = join(HERE, 'jsRuntimePage.js');
    it('parses (node --check): vitest never imports it', () => {
        expect(() => execFileSync(process.execPath, ['--check', PAGE], { stdio: 'pipe' })).not.toThrow();
    });
    it('feeds the run\'s look to the tile pass and claims the stand-in only while the tile\'s key is in the stack', () => {
        const src = readFileSync(PAGE, 'utf8');
        expect(src).toMatch(/const bridgeView = art \? bridgeSkinView\(runtime\.run\) : null;/);
        expect(src).toMatch(/const bridgesDrawn = !!art\?\.has\(BRIDGE_TILE_KEY\);/);
        expect(src).toMatch(/\(bridgesDrawn && BRIDGE_OBJECT_TAGS\.has\(o\.tag\)\)/);
        expect(src).toMatch(/bridgeLook: bridgeView\?\.look \?\? null/);
    });
});
