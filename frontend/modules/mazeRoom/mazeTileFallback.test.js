/**
 * CONTENT SETS TILE-1 — **THE ONE TILE FALLBACK CHAIN** (`mazeTileArt.drawMazeTile`; ⚖ the user 2026-11-15: "I don't
 * want adding a new custom tile type in the library to require updating the default graphics."). In node, on the
 * recorded draw-op log (`drawOpRecorder.js`):
 *
 *   1. The chain's four steps, in order: the theme's art; the caller's own draw; the kind's base; the placeholder —
 *      which never throws and logs each kind once.
 *   2. The bases: every `MAZE_ART_KEYS` row declares one of the closed set; `floor`/`wall` paint the painter's own
 *      colours; the `marker`/`character` colours and the placeholder's are used by no kind (no `COLORS` value, no
 *      composite `COLORS` value), so a fallback is never mistaken for a kind's own look.
 *   3. ⛔ THE COVERAGE PIN: every `MAZE_ART_KEYS` row resolves in BOTH views — the one-region view (`drawWorld` + the
 *      things pass) and the composite map's cell (`drawMazeCompositeRegion`) — save the kinds the composite map names
 *      in `MAZE_COMPOSITE_UNDRAWN`, each with its reason. With art for every key, each view blits every row's key; with
 *      none, each view draws every row's OWN look and never a base or the placeholder. The kinds and the exemptions
 *      are read off the tables, never counted here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { recordingContext } from './drawOpRecorder.js';
import { COLORS, drawWorld, plainView } from './mazeRoomRender.js';
import { TILE_WALL, getTile } from './mazeRoomEngine.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { drawMazeThings } from './mazeThingOverlay.js';
import { MAZE_COMPOSITE_UNDRAWN, drawMazeCompositeRegion } from './mazeCompositeMap.js';
import { COLORS as COMPOSITE_COLORS } from '../procgenCore/compositeMapRenderer.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import {
    MAZE_ART_KEYS, MAZE_ART_THINGS, MAZE_TILE_BASES, MAZE_TILE_PLACEHOLDER, drawMazeTile, mazeTileBaseOf,
    mazeTileStep, resetMazeTilePlaceholderLogForTests,
} from './mazeTileArt.js';

/** A tileArt stub: every key in `keys` resolves to its own one-frame sheet. */
function stubTileArt(keys) {
    const set = new Set(keys);
    const art = {
        has: (k) => set.has(k),
        frameRect: (k) => (set.has(k) ? { sheetRef: `sheet:${k}`, sx: 0, sy: 0, sw: 16, sh: 16 } : null),
        packOf: () => 'stub',
    };
    return { art, images: new Map(keys.map((k) => [`sheet:${k}`, { src: k }])) };
}

const drawn = (fn) => {
    const ctx = recordingContext();
    const step = fn(ctx);
    return { step, log: ctx.__log };
};
const BASE_NAMES = Object.keys(MAZE_TILE_BASES);

describe('the chain, step by step', () => {
    afterEach(() => {
        resetMazeTilePlaceholderLogForTests();
        vi.restoreAllMocks();
    });

    it('1. a row the theme has art for draws the art, and not its own draw', () => {
        const own = vi.fn();
        const { step, log } = drawn((ctx) => drawMazeTile(ctx, stubTileArt([MAZE_ART_KEYS.trap.key]), 'trap', 10, 20, 16, { own }));
        expect(step).toBe('art');
        expect(own).not.toHaveBeenCalled();
        expect(log.join('\n')).toContain(JSON.stringify({ src: MAZE_ART_KEYS.trap.key }));
    });

    it('2. without art, a row draws its own draw — and only that', () => {
        for (const tileArt of [null, stubTileArt([]), { art: createArtLibrary([]), images: new Map() }]) {
            const { step, log } = drawn((ctx) => drawMazeTile(ctx, tileArt, 'trap', 0, 0, 16, {
                own: () => { ctx.fillStyle = COLORS.trap; },
            }));
            expect(step).toBe('default');
            expect(log).toEqual([`fillStyle=${JSON.stringify(COLORS.trap)}`]);
        }
    });

    it('3. a row with no own draw falls back to its declared base', () => {
        const { step, log } = drawn((ctx) => drawMazeTile(ctx, null, 'pulser', 0, 0, 16));
        expect(step).toBe('base');
        expect(log.join('\n')).toContain(JSON.stringify(MAZE_TILE_BASES[MAZE_ART_KEYS.pulser.base].color));
    });

    it('a kind the table does not know draws its declared art key, else its declared base', () => {
        const key = 'fixture:object/lantern';
        const art = drawn((ctx) => drawMazeTile(ctx, stubTileArt([key]), 'lantern', 0, 0, 16, { base: 'marker', artKey: key }));
        expect(art.step).toBe('art');
        for (const base of BASE_NAMES) {
            const { step, log } = drawn((ctx) => drawMazeTile(ctx, stubTileArt([]), 'lantern', 0, 0, 16, { base, artKey: key }));
            expect(step, base).toBe('base');
            expect(log.join('\n'), base).toContain(JSON.stringify(MAZE_TILE_BASES[base].color));
            expect(log.join('\n'), base).not.toContain(JSON.stringify(MAZE_TILE_PLACEHOLDER.color));
        }
    });

    it('4. a kind with no art, no own draw and no base draws the placeholder: no throw, logged once per kind', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const declared of [null, 'not-a-base']) {
            const { step, log } = drawn((ctx) => drawMazeTile(ctx, null, 'lantern', 0, 0, 16, { base: declared }));
            expect(step).toBe('placeholder');
            expect(log.join('\n')).toContain(JSON.stringify(MAZE_TILE_PLACEHOLDER.color));
            expect(log.join('\n')).toContain('fillText("la"');
        }
        expect(() => drawMazeTile(recordingContext(), null, undefined, 0, 0, 16)).not.toThrow();
        drawMazeTile(recordingContext(), null, 'torch', 0, 0, 16);
        expect(warn.mock.calls.map((c) => c[0].match(/"([^"]*)"/)[1])).toEqual(['lantern', 'undefined', 'torch']);
    });

    it('mazeTileStep answers what drawMazeTile does, without drawing', () => {
        const tileArt = stubTileArt([MAZE_ART_KEYS.wall.key]);
        expect(mazeTileStep(tileArt, 'wall')).toBe('art');
        expect(mazeTileStep(tileArt, 'floor', { hasOwn: true })).toBe('default');
        expect(mazeTileStep(tileArt, 'floor')).toBe('base');
        expect(mazeTileStep(tileArt, 'lantern', { base: 'character' })).toBe('base');
        expect(mazeTileStep(tileArt, 'lantern')).toBe('placeholder');
        // an inherited property name is not a row
        expect(mazeTileStep(null, 'constructor')).toBe('placeholder');
    });
});

describe('the bases', () => {
    it('every key-table row declares a base of the closed set', () => {
        for (const thing of MAZE_ART_THINGS) {
            expect(BASE_NAMES, thing).toContain(MAZE_ART_KEYS[thing].base);
            expect(mazeTileBaseOf(thing), thing).toBe(MAZE_ART_KEYS[thing].base);
        }
    });

    it('floor and wall are the painter\'s own colours', () => {
        expect(MAZE_TILE_BASES.floor.color).toBe(COLORS.floor);
        expect(MAZE_TILE_BASES.wall.color).toBe(COLORS.wall);
    });

    it('the marker, character and placeholder colours are no kind\'s, and differ from each other', () => {
        const used = new Set([...Object.values(COLORS), ...Object.values(COMPOSITE_COLORS)].map((c) => String(c).toLowerCase()));
        const own = [MAZE_TILE_BASES.marker.color, MAZE_TILE_BASES.character.color, MAZE_TILE_PLACEHOLDER.color]
            .map((c) => c.toLowerCase());
        expect(own.filter((c) => used.has(c))).toEqual([]);
        expect(new Set(own).size).toBe(own.length);
    });
});

// ── (3) the coverage pin ────────────────────────────────────────────────────────────────────────────────────────
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const PLAYTHROUGH = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const floorCells = (w) => {
    let n = 0;
    for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) if (getTile(w, x, y) !== TILE_WALL) n++;
    return n;
};

/**
 * A world on which every kind of the key table appears: the roomiest maze region of a committed world (its floor,
 * walls, exits and entrance; read off the data, never named), with the rest STAGED on free cells of the deserialized world, as the painters read it —
 * a mana tile, an arrow trap, the three block kinds, a button up and one held down by a block, a pulser on a wall, a
 * pull, and a sign. Nothing here is a world anyone plays. Also returns a floor cell for the player.
 */
function everyKindWorld() {
    const worlds = Object.values(PLAYTHROUGH.preset_sidecars['1']).filter((v) => v.playable_payload)
        .map((v) => substrateRegistryEntry.deserializeWorld(JSON.parse(JSON.stringify(v.playable_payload))));
    // ⚠ an entrance that is also an exit draws as the exit (§5), so the world must have one that is not
    const own = worlds.filter((w) => ![...w.exits.values()].some((e) => e.x === w.entrance.x && e.y === w.entrance.y));
    const world = own.reduce((a, b) => (floorCells(b) > floorCells(a) ? b : a));
    world.atlas = undefined; // ⚠ a Seedling-atlas world gets no tile art on the map; this one is a plain maze stage
    const busy = new Set([...world.items.keys(), ...world.obstacles.keys(), `${world.entrance.x},${world.entrance.y}`,
        ...[...world.exits.values()].map((e) => `${e.x},${e.y}`)]);
    const free = (wantWall) => {
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                const key = `${x},${y}`;
                if (!busy.has(key) && (getTile(world, x, y) === TILE_WALL) === wantWall) { busy.add(key); return { x, y, key }; }
            }
        }
        throw new Error('staging: no free cell');
    };
    world.manaTiles = new Map([[free(false).key, 1]]);
    const trap = free(false);
    world.traps = [{ x: trap.x, y: trap.y, lane: [] }];
    world.blockLib = { 'staged-walk': { walk: true }, 'staged-struck': {}, 'staged-dormant': { wake: true } };
    const up = free(false);
    const down = free(false);
    world.buttons = new Map([[up.key, 'staged-up'], [down.key, 'staged-down']]);
    world.blocks = new Map([[free(false).key, 'staged-walk'], [free(false).key, 'staged-struck'],
        [free(false).key, 'staged-dormant'], [down.key, 'staged-walk']]);
    const pulser = free(true);
    world.pulsers = [{ x: pulser.x, y: pulser.y, reach: [], token: 'staged-pulser' }];
    const pull = free(false);
    world.pulls = [{ x: pull.x, y: pull.y, gate: 'staged-gate', disc: [pull.key] }];
    const sign = free(false);
    world.things = [{ id: 'thing_0', x: sign.x, y: sign.y, kind: 'info', concept: 'staged:info/sign', name: 'Staged',
        info: { concept: 'staged:info/sign', name: 'Staged', body: 'Staged.' } }];
    return { world, player: free(false) };
}

/** Each view's draw of the world with `tileArt` → its op log. */
const VIEWS = Object.freeze({
    single: (world, player, tileArt) => {
        const ctx = recordingContext();
        const view = plainView({ tilePx: 16, playerPos: { x: player.x, y: player.y }, tileArt });
        drawWorld(ctx, world, view);
        drawMazeThings(ctx, world, { tilePx: 16, playerPos: view.playerPos, fogEnabled: false, isTileVisible: () => true, tileArt });
        return ctx.__log;
    },
    composite: (world, player, tileArt) => {
        const ctx = recordingContext();
        drawMazeCompositeRegion(ctx, { region_id: 'staged', substrate: 'maze', playable_payload: world }, { offX: 28, offY: 14, tileArt });
        return ctx.__log;
    },
});
const UNDRAWN = Object.freeze({ single: {}, composite: MAZE_COMPOSITE_UNDRAWN });
const blitted = (log) => new Set(log.map((l) => l.match(/^drawImage\(\{"src":"([^"]+)"\}/)?.[1]).filter(Boolean));

describe('⛔ the coverage pin: every key-table kind resolves in both views', () => {
    it('every exemption names a real kind and says why', () => {
        for (const [view, undrawn] of Object.entries(UNDRAWN)) {
            for (const [kind, why] of Object.entries(undrawn)) {
                expect(MAZE_ART_THINGS, `${view}.${kind}`).toContain(kind);
                expect(typeof why === 'string' && why.length > 0, `${view}.${kind}`).toBe(true);
            }
        }
    });

    for (const [name, draw] of Object.entries(VIEWS)) {
        const wanted = MAZE_ART_THINGS.filter((k) => !(k in UNDRAWN[name]));

        it(`${name}: with art for every key, every drawn kind is the theme's art`, () => {
            const { world, player } = everyKindWorld();
            const log = draw(world, player, stubTileArt(MAZE_ART_THINGS.map((k) => MAZE_ART_KEYS[k].key)));
            const got = blitted(log);
            expect(wanted.filter((k) => !got.has(MAZE_ART_KEYS[k].key)), 'kinds not drawn from art').toEqual([]);
            expect(Object.keys(UNDRAWN[name]).filter((k) => got.has(MAZE_ART_KEYS[k].key)), 'an exempt kind was drawn').toEqual([]);
        });

        it(`${name}: with no art, every drawn kind draws its own look — never a base or the placeholder`, () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { world, player } = everyKindWorld();
            const log = draw(world, player, null).join('\n');
            const missing = wanted.filter((k) => !MAZE_ART_KEYS[k].colors.some((c) => log.includes(JSON.stringify(COLORS[c]))));
            expect(missing, 'kinds whose own colour is not drawn').toEqual([]);
            for (const c of [MAZE_TILE_BASES.marker.color, MAZE_TILE_BASES.character.color, MAZE_TILE_PLACEHOLDER.color]) {
                expect(log, c).not.toContain(JSON.stringify(c));
            }
            expect(warn).not.toHaveBeenCalled();
            vi.restoreAllMocks();
        });
    }
});
