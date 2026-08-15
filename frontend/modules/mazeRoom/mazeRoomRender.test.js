/**
 * mazeRoomRender — ⛓⛓⛓ THE PIXEL GATE for CONSTRUCTIVE-MODE slice 3's
 * extraction (`NewDocs/plans/seedling-constructive-mode-kickoff.md` §3.5).
 *
 * ── WHY THE GATE IS A DRAW-OP LOG AND NOT `getImageData` ──────────────
 *
 * `vitest.config.js` runs `environment: 'node'` and the repo has no `canvas`
 * package (checked: `require.resolve('canvas')` throws), so nothing in the unit
 * runner can rasterise. The gate is therefore an ORDERED LOG of every context
 * call and every property assignment, hashed.
 *
 * ⛔ THE LOG IS A SUPERSET OF WHAT DETERMINES THE RASTER. It records the state
 * mutations (`fillStyle`, `strokeStyle`, `lineWidth`, `globalAlpha`,
 * `setLineDash`, `save`/`restore`, the font trio) as well as the geometry, so
 * two runs with equal logs paint equal pixels on equal-sized canvases. It is a
 * STRICTER gate than a pixel hash, not a weaker one — two op sequences that
 * happened to paint identically would still differ — which is the correct
 * direction for a behaviour-preserving move.
 *
 * ⛔ AND THE RECORDER **THROWS ON AN UNKNOWN MEMBER**. A recorder that silently
 * returned `undefined` for a method it had not modelled would drop that
 * operation out of the log, which is a hole in the very check that exists to
 * find holes. An op nobody declared is a loud failure.
 *
 * ── THE `BEFORE` HASHES ARE A CAPTURE, NOT A DERIVATION ───────────────
 *
 * Every hash in `BEFORE` was produced by running these exact seven fixtures
 * through `MazeRoomUI._drawWorld` at commit `868c39266` — the tree BEFORE
 * `drawWorld` existed. They are pasted, not computed, because a gate whose
 * expected value comes out of the code under test is a fixed point and tests
 * self-consistency only (⚖ kickoff §5).
 *
 * ⛓ IT EARNED ITS KEEP ON THE FIRST RUN: the `consumables` case reddened
 * because `consumableTileColor` had been RE-WRITTEN during the move instead of
 * moved (a different hash function and different HSL constants, same op count
 * — invisible to every structural check). See the as-built §10.
 */

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

import { MazeRoomUI } from './mazeRoomUI.js';
import {
    COLORS, TILE_PX, VIEW_FIELDS, assertView, consumableTileColor, drawWorld, plainView,
} from './mazeRoomRender.js';

/* ══════════════════════════════════════════════════════════════════════
 * THE RECORDING CONTEXT
 * ══════════════════════════════════════════════════════════════════════ */

const PROPS = ['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font',
    'textAlign', 'textBaseline', 'lineCap', 'lineJoin'];
const METHODS = ['fillRect', 'strokeRect', 'save', 'restore', 'setLineDash', 'beginPath',
    'arc', 'fill', 'stroke', 'moveTo', 'lineTo', 'closePath', 'fillText', 'clearRect', 'rect'];

export function recordingContext() {
    const log = [];
    const target = { __log: log };
    for (const m of METHODS) {
        target[m] = (...args) => {
            log.push(`${m}(${args.map((a) => JSON.stringify(a)).join(',')})`);
        };
    }
    const store = {};
    return new Proxy(target, {
        get(t, key) {
            if (key === '__log') return log;
            if (typeof key === 'symbol') return undefined;
            if (key in t) return t[key];
            if (PROPS.includes(key)) return store[key];
            throw new Error(`recordingContext: unknown ctx member GET "${String(key)}" — an `
                + 'operation this recorder does not model would drop out of the log, which '
                + 'is a hole in the gate rather than a passing run.');
        },
        set(t, key, value) {
            if (!PROPS.includes(key)) {
                throw new Error(`recordingContext: unknown ctx member SET "${String(key)}".`);
            }
            store[key] = value;
            log.push(`${key}=${JSON.stringify(value)}`);
            return true;
        },
    });
}

const hashOf = (log) => createHash('sha256').update(log.join('\n')).digest('hex').slice(0, 32);

/* ══════════════════════════════════════════════════════════════════════
 * THE FIXTURES — chosen to reach every branch of the draw
 * ══════════════════════════════════════════════════════════════════════ */

function makeWorld({
    width = 7, height = 5, entrance = { x: 0, y: 0 }, exits = [], items = [], obstacles = [],
    walls = [], obstacleLib = {}, itemLib = undefined, consumableTiles = [], manaTiles = [],
    hazards = undefined, itemLocationNames = [],
} = {}) {
    const tiles = new Int8Array(width * height);
    for (const w of walls) tiles[w.y * width + w.x] = 1;
    return {
        width,
        height,
        tiles,
        entrance,
        exits: new Map(exits.map((e) => [e.exit_id, e])),
        items: new Map(items.map((i) => [`${i.x},${i.y}`, i.id])),
        obstacles: new Map(obstacles.map((o) => [`${o.x},${o.y}`, o.id])),
        consumableTiles: new Map(consumableTiles.map((c) => [`${c.x},${c.y}`, c.grant])),
        manaTiles: new Map(manaTiles.map((m) => [`${m.x},${m.y}`, m.amount])),
        itemLocationNames: new Map(itemLocationNames.map((n) => [`${n.x},${n.y}`, n.name])),
        obstacleLib,
        itemLib,
        hazards,
    };
}

const OBSTACLE_LIB = {
    door_red: { color: '#b84040', clear_set_type: 'combo_list', clear_set: ['key_red'] },
    gate_rule: { clear_set_type: 'rule', clear_set: { Has: 'key_blue' } },
};

/** Each case: the world, plus the PANEL fields the old `_drawWorld` read. */
const CASES = {
    /** walls · an exit · a known item · a FOREIGN item (hash colour + label) · a door */
    plain: () => ({
        world: makeWorld({
            walls: [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }],
            exits: [{ exit_id: 'goal', x: 6, y: 4 }],
            items: [{ x: 1, y: 3, id: 'key_red' }, { x: 5, y: 0, id: 'not_in_any_library' }],
            obstacles: [{ x: 4, y: 2, id: 'door_red' }],
            obstacleLib: OBSTACLE_LIB,
        }),
        panel: { state: { player_pos: { x: 0, y: 0 }, inventory: new Set() } },
    }),
    /** the door CLEARED (dashed outline) and the item collected (no sprite) */
    cleared: () => ({
        world: makeWorld({
            exits: [{ exit_id: 'goal', x: 6, y: 4 }],
            items: [{ x: 1, y: 3, id: 'key_red' }],
            obstacles: [{ x: 4, y: 2, id: 'door_red' }],
            obstacleLib: OBSTACLE_LIB,
        }),
        panel: { state: { player_pos: { x: 3, y: 1 }, inventory: new Set(['key_red']) } },
    }),
    /** a CLOSED logic gate on an exit tile (red fill) AND on a plain tile (red border) */
    gated: () => ({
        world: makeWorld({
            exits: [{ exit_id: 'goal', x: 6, y: 4 }],
            obstacles: [{ x: 6, y: 4, id: 'gate_rule' }, { x: 2, y: 2, id: 'gate_rule' }],
            obstacleLib: OBSTACLE_LIB,
        }),
        panel: { state: { player_pos: { x: 0, y: 0 }, inventory: new Set() } },
    }),
    /** FOG — the overlay-skip branch AND the blackout pass */
    fog: () => ({
        world: makeWorld({
            walls: [{ x: 2, y: 1 }],
            exits: [{ exit_id: 'goal', x: 6, y: 4 }],
            items: [{ x: 1, y: 3, id: 'key_red' }],
            obstacleLib: OBSTACLE_LIB,
        }),
        panel: {
            state: { player_pos: { x: 1, y: 1 }, inventory: new Set() },
            fogEnabled: true,
            seenTilesByRegion: new Map([['__local__', new Set(['0,0', '1,1', '1,3', '2,1'])]]),
        },
    }),
    /** PLAYBACK: external inventory, per-LOCATION pickup truth, hazards */
    playback: () => ({
        world: makeWorld({
            exits: [{ exit_id: 'goal', x: 6, y: 4, exitName: 'To Room 2' }],
            items: [{ x: 1, y: 3, id: 'key_red' }, { x: 5, y: 1, id: 'key_red' }],
            itemLocationNames: [{ x: 1, y: 3, name: 'Loc A' }, { x: 5, y: 1, name: 'Loc B' }],
            obstacleLib: OBSTACLE_LIB,
            hazards: [{
                shape: 'loop',
                tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
                phase: 0,
                cycleLength: 3,
            }],
        }),
        panel: {
            state: { player_pos: { x: 4, y: 4 }, inventory: new Set() },
            externalInventory: new Set(['key_red']),
            externalCheckedLocations: new Set(['Loc A']),
            currentRegionId: 'region-1',
        },
    }),
    /** X1 consumable + mana tiles, one of them COLLECTED (the alpha branch) */
    consumables: () => ({
        world: makeWorld({
            exits: [{ exit_id: 'goal', x: 6, y: 4 }],
            consumableTiles: [{ x: 1, y: 1, grant: { substrate: 'omsi', type: 'potion' } }],
            manaTiles: [{ x: 3, y: 2, amount: 5 }],
            obstacleLib: OBSTACLE_LIB,
        }),
        panel: {
            state: { player_pos: { x: 0, y: 0 }, inventory: new Set() },
            _visualizer: { isConsumableCollected: (rid, x, y) => (x === 1 && y === 1) },
        },
    }),
    /** no state at all — the pre-play draw, no player circle */
    noPlayer: () => ({
        world: makeWorld({ exits: [{ exit_id: 'goal', x: 6, y: 4 }], obstacleLib: OBSTACLE_LIB }),
        panel: { state: null },
    }),
};

/**
 * ⛓⛓⛓ CAPTURED FROM `MazeRoomUI._drawWorld` AT `868c39266` — the tree before
 * `mazeRoomRender.js` existed. ⛔ Pasted, never recomputed.
 */
const BEFORE = Object.freeze({
    plain: { ops: 170, hash: 'd018b91a1058ef53a9544425c1da40c5' },
    cleared: { ops: 142, hash: '3a4a6da48a6189fe4a78262775d422ac' },
    gated: { ops: 140, hash: 'b401ac669120d78adf0fe029f188c70b' },
    fog: { ops: 181, hash: 'd3c3622e44fb3a4d129457f2bcb846ac' },
    playback: { ops: 172, hash: '679e300f2ba8053141056c555827e4b1' },
    consumables: { ops: 174, hash: '5f5e78f842782147911d9f19e9799c50' },
    noPlayer: { ops: 133, hash: '717e65842421dbc592704ee244b20513' },
});

function panelFor(name) {
    const { world, panel: fields } = CASES[name]();
    const panel = new MazeRoomUI(null, {});
    panel.world = world;
    Object.assign(panel, fields);
    return panel;
}

function logOfPanel(name) {
    const panel = panelFor(name);
    const ctx = recordingContext();
    panel._drawWorld({ getContext: () => ctx });
    return ctx.__log;
}

/* ══════════════════════════════════════════════════════════════════════ */

describe('mazeRoomRender — the extraction is behaviour-preserving', () => {
    it('every fixture is a case the OLD path actually exercised (op counts are non-trivial)', () => {
        // ⛔ A guard against the gate quietly emptying: a fixture that draws
        // nothing would hash identically before and after any change at all.
        for (const [name, before] of Object.entries(BEFORE)) {
            expect(before.ops, name).toBeGreaterThan(100);
        }
        expect(Object.keys(CASES).sort()).toEqual(Object.keys(BEFORE).sort());
    });

    for (const name of Object.keys(CASES)) {
        it(`"${name}": the PANEL draws exactly what it drew before the extraction`, () => {
            const log = logOfPanel(name);
            expect(log.length, `${name}: op count`).toBe(BEFORE[name].ops);
            expect(hashOf(log), `${name}: draw-op log hash`).toBe(BEFORE[name].hash);
        });

        it(`"${name}": a DIRECT drawWorld call with the same view draws the same ops`, () => {
            /**
             * ⛓ The second half of the claim: the page and the panel reach ONE
             * function, so a view built by hand from the same facts must give
             * the same log. Built from the panel's own accessors — the point is
             * that the SEAM is complete, not that a hand-copied bag of state
             * happens to agree.
             */
            const panel = panelFor(name);
            const ctx = recordingContext();
            drawWorld(ctx, panel.world, {
                tilePx: TILE_PX,
                playerPos: panel.state ? panel.state.player_pos : null,
                inventory: panel._currentInventory(),
                isPlayback: panel.externalInventory !== null,
                checkedLocations: panel._currentCheckedLocations(),
                ruleEvaluator: panel._currentRuleEvaluator(),
                fogEnabled: panel.fogEnabled,
                isTileVisible: (x, y) => panel._isTileVisibleForRender(x, y),
                seenTiles: panel.seenTilesByRegion.get(panel._seenSetKey()) ?? null,
                isExitVisible: (exit) => panel._isExitVisibleToUI(exit),
                isLocationVisible: (n) => panel._isLocationVisibleToUI(n),
                isConsumableCollected: (x, y) => panel._visualizer
                    ?.isConsumableCollected?.(panel.currentRegionId, x, y),
            });
            expect(hashOf(ctx.__log), `${name}: direct drawWorld`).toBe(BEFORE[name].hash);
        });
    }

    it('the recorder REFUSES an op it does not model, rather than dropping it', () => {
        const ctx = recordingContext();
        expect(() => ctx.ellipse(0, 0, 1, 1, 0, 0, 1)).toThrow(/unknown ctx member GET "ellipse"/);
        expect(() => { ctx.shadowBlur = 4; }).toThrow(/unknown ctx member SET "shadowBlur"/);
    });
});

describe('mazeRoomRender — the view is the WHOLE input', () => {
    it('refuses a MISSING field by name rather than defaulting it', () => {
        const world = CASES.plain().world;
        for (const key of VIEW_FIELDS) {
            const view = plainView({ tilePx: TILE_PX });
            delete view[key];
            expect(() => drawWorld(recordingContext(), world, view), key)
                .toThrow(new RegExp(`missing "${key}"`));
        }
    });

    it('refuses a non-positive tilePx and a non-function predicate', () => {
        expect(() => assertView({ ...plainView(), tilePx: 0 })).toThrow(/tilePx must be a positive/);
        expect(() => assertView({ ...plainView(), isTileVisible: true }))
            .toThrow(/view\.isTileVisible must be a function/);
        expect(() => drawWorld(recordingContext(), CASES.plain().world, null))
            .toThrow(/needs a view object/);
    });

    it('`plainView` is every filter OFF — no fog, no playback, no discovery', () => {
        const v = plainView();
        expect(v.fogEnabled).toBe(false);
        expect(v.isPlayback).toBe(false);
        expect(v.seenTiles).toBe(null);
        expect(v.isConsumableCollected).toBe(null);
        expect(v.tilePx).toBe(TILE_PX);
        expect(v.isTileVisible(3, 3)).toBe(true);
    });

    it('tilePx really scales the geometry — a page may zoom without a second renderer', () => {
        const world = CASES.plain().world;
        const at = (px) => {
            const ctx = recordingContext();
            drawWorld(ctx, world, plainView({ tilePx: px }));
            return ctx.__log;
        };
        const a = at(20);
        const b = at(40);
        // ⛔ The SHAPE is identical (same ops, same order) and only the numbers
        // move — asserted rather than assumed, because a renderer that ignored
        // tilePx would also produce two logs of equal length.
        expect(b.length).toBe(a.length);
        expect(a[1]).toBe('fillRect(0,0,20,20)');
        expect(b[1]).toBe('fillRect(0,0,40,40)');
        expect(hashOf(a)).not.toBe(hashOf(b));
    });
});

describe('mazeRoomRender — the constants moved verbatim', () => {
    it('the entrance and the exit share ONE colour, so a colour SWAP between them is inert', () => {
        /**
         * ⛓ Recorded because the slice's mutant standard asked for exactly that
         * swap and it does not discriminate: both are `#3aa85a`. A mutant that
         * cannot redden a gate is a finding about the MUTANT — see as-built §10.
         */
        expect(COLORS.entrance).toBe('#3aa85a');
        expect(COLORS.exit).toBe(COLORS.entrance);
        expect(COLORS.exitBlocked).not.toBe(COLORS.exit);
    });

    it('consumableTileColor is the panel\'s own hash, not a re-derivation', () => {
        /**
         * ⛓ Computed INDEPENDENTLY of this module, from the pre-extraction
         * body (`git show 868c39266:…/mazeRoomUI.js`), in a scratch node — not
         * read back out of the function under test. The first draft of this
         * move re-invented the hash (`h*31`, 55%/55%) and only the `consumables`
         * draw-op hash caught it.
         */
        expect(consumableTileColor('omsi')).toBe('hsl(260, 70%, 60%)');
        expect(consumableTileColor('seedling')).toBe('hsl(175, 70%, 60%)');
        expect(consumableTileColor('')).toBe('hsl(0, 70%, 60%)');
        expect(consumableTileColor(null)).toBe('hsl(0, 70%, 60%)');
    });
});
