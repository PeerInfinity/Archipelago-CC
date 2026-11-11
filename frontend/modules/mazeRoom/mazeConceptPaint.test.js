/**
 * ⛓⛓ CONCEPT LIBRARY T1, D3 — **THE SKIN IS VISIBLE.** A rule gate that
 * carries a `concept` is painted (colour + symbol, dimmed when cleared) by the
 * panel's `drawWorld` and by the composite-map cell; a plain `logic_gate` is
 * drawn exactly as before.
 *
 * ⛓ The CONCEPT-LESS hashes are a CAPTURE, not a derivation: the same world
 * (placed with `concepts: []`) run through both painters at `67ce4d3`, the tree
 * before this paint existed — where a skinned world ALSO drew these exact ops
 * (the skin was invisible). The seven `mazeRoomRender.test.js` fixtures hold the
 * rest of the panel's draw to its own older capture.
 */
import { describe, it, expect } from 'vitest';

import { hashOf, recordingContext } from './drawOpRecorder.js';
import { drawWorld, plainView } from './mazeRoomRender.js';
import { drawMazeCompositeRegion } from './mazeCompositeMap.js';
import { generateRegionCore, placeFromRules } from './mazeRoomEngine.js';
import { MAZE_CONCEPT_REALISATIONS } from './mazeConcepts.js';
import { createRng } from '../shared/rng.js';

const SWORD = { rule: 'Has', args: { item_name: 'Progressive Sword' } };
const SWIM = { rule: 'Has', args: { item_name: 'Progressive Swim' } };

/** One exit gated on the sword, one location gated on swim, placed under `concepts`. */
function world(concepts) {
    const { world: w } = generateRegionCore({
        region_id: 'r1', size: { width: 10, height: 8 },
        entrances: [{ side: 'W', tile: { x: 0, y: 3 } }], exits: [{ side: 'E' }],
        rng: createRng(7), params: {},
    });
    const exitId = [...w.exits.keys()][0];
    placeFromRules(w, {
        exit_rules: { [exitId]: SWORD }, location_rules: { loc0: SWIM },
        item_placements: [{ item_id: 'map', location_id: 'loc0' }],
        rng: createRng(11), params: { concepts },
    });
    return w;
}

const panelLog = (w, inventory = new Set()) => {
    const ctx = recordingContext();
    drawWorld(ctx, w, { ...plainView(), inventory });
    return ctx.__log;
};
const compositeLog = (w) => {
    const ctx = recordingContext();
    drawMazeCompositeRegion(ctx, { playable_payload: w }, { offX: 0, offY: 0 });
    return ctx.__log;
};

/** ⛓ CAPTURED at `67ce4d3` (before D3) — ⛔ pasted, never recomputed. */
const CONCEPT_LESS_BEFORE = Object.freeze({
    drawWorld: { ops: 264, hash: 'bac171cf3f898325ab0ea4133a00772f' },
    composite: { ops: 182, hash: 'f9a439a1061e420073c25c49812d613e' },
});

describe('a concept-less world draws exactly what it drew before the paint', () => {
    it('the panel\'s drawWorld', () => {
        const log = panelLog(world([]));
        expect(log.length).toBe(CONCEPT_LESS_BEFORE.drawWorld.ops);
        expect(hashOf(log)).toBe(CONCEPT_LESS_BEFORE.drawWorld.hash);
    });
    it('the composite-map cell', () => {
        const log = compositeLog(world([]));
        expect(log.length).toBe(CONCEPT_LESS_BEFORE.composite.ops);
        expect(hashOf(log)).toBe(CONCEPT_LESS_BEFORE.composite.hash);
    });
});

describe('a skinned gate is painted as its concept', () => {
    const colorOf = (c) => MAZE_CONCEPT_REALISATIONS[c].art.color;
    const symbolOf = (c) => MAZE_CONCEPT_REALISATIONS[c].art.symbol;
    const drew = (log, c) => ({
        fill: log.some((op) => op.includes(`fillStyle`) && op.includes(colorOf(c))),
        stroke: log.some((op) => op.includes(`strokeStyle`) && op.includes(colorOf(c))),
        symbol: log.some((op) => op.startsWith(`fillText(${JSON.stringify(symbolOf(c))},`)),
    });

    it('closed: the panel fills each gate tile in the concept colour and writes its symbol; the plain world does not', () => {
        const skinned = panelLog(world(['guardian', 'water']));
        const plain = panelLog(world([]));
        for (const c of ['guardian', 'water']) {
            expect(drew(skinned, c), c).toMatchObject({ fill: true, symbol: true });
            expect(drew(plain, c), c).toEqual({ fill: false, stroke: false, symbol: false });
        }
        expect(skinned.length).toBeGreaterThan(plain.length);
    });

    it('cleared: the dimmed dashed outline in the concept colour (the door idiom), and the symbol still', () => {
        const log = panelLog(world(['guardian', 'water']), new Set(['Progressive Sword', 'Progressive Swim']));
        for (const c of ['guardian', 'water']) {
            expect(drew(log, c), c).toEqual({ fill: false, stroke: true, symbol: true });
        }
        expect(log.some((op) => op.startsWith('setLineDash'))).toBe(true);
    });

    it('the composite-map cell paints the same skin (closed — it has no inventory)', () => {
        const log = compositeLog(world(['guardian', 'water']));
        for (const c of ['guardian', 'water']) expect(drew(log, c), c).toMatchObject({ fill: true, symbol: true });
    });
});
