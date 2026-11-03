/**
 * ⛓ RULES l63-pole-crossings — a struck block's crossing, priced by its push paths (`playthroughBlockCrossings`, the model in
 * `seedlingBlockPaths.blockCrossingCost`). Pinned so the set cannot drift silently: a new stopper, a moved block or a model
 * change that gates (or frees) a crossing reds a row here and has to be read. The game witness is
 * `probe-seedling-l63-spear-block.mjs`, pinned to the gate it witnesses.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { buildPlaythroughAtlas, setPlaythroughLandingAtlas, playthroughEventLayer } from './make-seedling-playthrough-rules.mjs';
import { spearBlockTapes, POLE_TAG, TRAP_TAG, EAST } from './probe-seedling-l63-spear-block.mjs';
import { IN_ROOM_PRESS_GATE_KIND } from '../../frontend/modules/flashPanel/seedlingObstacleEvents.js';

let layer;
beforeAll(() => {
    const doc = buildPlaythroughAtlas();
    setPlaythroughLandingAtlas(doc);
    layer = playthroughEventLayer(doc);
}, 300_000);

describe('the struck blocks\' crossings', () => {
    // ⛓ RULES l20-button-latch: the layer's `internalExitGates` is no longer the blocks' alone — an in-room latching press
    // gates the crossings through its lock there too (pinned in `seedlingBossLockCensus.test.js`). This file pins the BLOCK
    // producer's own list (`layer.blocks.internalExitGates`); the row below holds that the layer carries exactly that list
    // plus in-room press gates, so no third source joins it unread.
    it('the layer\'s internal gates are the blocks\' plus the in-room presses\' (kind in-room-press), nothing else', () => {
        const blockGates = new Set(layer.blocks.internalExitGates);
        const rest = layer.internalExitGates.filter((g) => !blockGates.has(g));
        expect(layer.internalExitGates.length).toBe(layer.blocks.internalExitGates.length + rest.length);
        expect(rest.every((g) => g.kind === IN_ROOM_PRESS_GATE_KIND)).toBe(true);
        expect(layer.blocks.internalExitGates.some((g) => g.kind === IN_ROOM_PRESS_GATE_KIND)).toBe(false);
    });

    it('ONE gate: L63 r6c9 -> r0c1 also costs lightpole@64,88 lit (the block parks on darktrap@64,96 otherwise)', () => {
        expect(layer.blocks.internalExitGates.map(({ region_id, from, to, rule }) => ({ region_id, from, to, rule }))).toEqual([{
            region_id: 'level_63', from: 'r6c9', to: 'r0c1',
            rule: { rule: 'Has', args: { item_name: 'L63 flag 1: lightpole@64,88 cleared' } },
        }]);
    });

    it('every other crossing through a struck block in a room with a stopper is free beyond the push item, by name', () => {
        expect(layer.blocks.notes.filter((n) => /free beyond/.test(n))).toEqual([
            'L63 pushableblockspear@112,96: r0c1 -> r6c9 free beyond the push item',
            'L65 pushableblockspear@176,128: r0c8 -> r4c11 free beyond the push item',
            'L65 pushableblockspear@176,128: r4c11 -> r0c8 free beyond the push item',
        ]);
    });

    it('the probe witnesses that gate: its tapes stand east of the block, and its control clears the gate\'s own flag', () => {
        const gate = layer.blocks.internalExitGates[0];
        expect(gate.rule.args.item_name).toContain(`flag ${POLE_TAG}:`);
        const tapes = spearBlockTapes();
        expect(Object.keys(tapes)).toEqual(['east-no-f1', 'east-f1', 'east-f8']);
        expect(tapes['east-no-f1'].persistence).toEqual([]);
        expect(tapes['east-f1'].persistence.map((p) => p.tag)).toEqual([POLE_TAG]);
        expect(tapes['east-f8'].persistence.map((p) => p.tag)).toEqual([TRAP_TAG]);
        // [9,6], the r6c9 side of the block (the gate's `from`).
        expect([EAST.x / 16, EAST.y / 16]).toEqual([9, 6]);
    });
});
