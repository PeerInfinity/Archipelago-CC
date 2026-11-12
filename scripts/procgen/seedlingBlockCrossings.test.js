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

    it('the gates: L63 r6c9 -> r0c1 costs lightpole@64,88 lit; L40\'s BK2 crossings cost flag 12 (the pulser\'s activator walk)', () => {
        const flag12 = { rule: 'Has', args: { item_name: 'L40 flag 12: wandlock@480,560 cleared' } };
        expect(layer.blocks.internalExitGates.map(({ region_id, from, to, rule }) => ({ region_id, from, to, rule }))).toEqual([
            { region_id: 'level_40', from: 'r32c36', to: 'r26c13', rule: flag12 },
            { region_id: 'level_40', from: 'r26c13', to: 'r32c36', rule: flag12 },
            { region_id: 'level_40', from: 'r26c13', to: 'r36c35', rule: flag12 },
            {
                region_id: 'level_63', from: 'r6c9', to: 'r0c1',
                rule: { rule: 'Has', args: { item_name: 'L63 flag 1: lightpole@64,88 cleared' } },
            },
        ]);
    });

    // ⛓ RULES rules-l40-bk2-witness (game NO without flag 12, `CC/docs/cloud-reports/rules-l40-bk2-witness-evidence/`):
    // Fire from below pushes the BK2 block only north, into the plain block (`PushableBlockFire.as:98-121`), so only
    // pulser@592,576's westward shove opens column 36, and its group's activator (button@816,400 {tset 4}) is walked to
    // from the corridor only through the flag-12 door.
    it('L40: every BK2 gate is the pulser shove\'s, priced by the walk to its activator; the pocket side is sealed by name', () => {
        const l40 = layer.blocks.internalExitGates.filter((g) => g.region_id === 'level_40');
        expect(l40.length).toBeGreaterThan(0);
        for (const g of l40) {
            expect(g.why).toMatch(/^L40 pushableblockfire@576,576: no push of the player's from r\d+c\d+ opens it \(beside it: the pushable at \(36,35\)\); only pulser@592,576's shove does/);
            expect(g.why).toContain('only with L40 flag 12: wandlock@480,560 cleared');
        }
        expect(layer.blocks.notes.filter((n) => /entered only through the block's cell/.test(n))).toEqual([
            'L40 pushableblockfire@576,576: r36c35 -> r32c36: r36c35 is entered only through the block\'s cell — nothing to price',
            'L40 pushableblockfire@576,576: r36c35 -> r26c13: r36c35 is entered only through the block\'s cell — nothing to price',
        ]);
    });

    it('every other crossing through a struck block in a room with a stopper or another body is free beyond the push item, by name', () => {
        expect(layer.blocks.notes.filter((n) => /free beyond/.test(n))).toEqual([
            'L40 pushableblockfire@576,576: r32c36 -> r36c35 free beyond the push item',
            'L63 pushableblockspear@112,96: r0c1 -> r6c9 free beyond the push item',
            'L65 pushableblockspear@176,128: r0c8 -> r4c11 free beyond the push item',
            'L65 pushableblockspear@176,128: r4c11 -> r0c8 free beyond the push item',
        ]);
    });

    it('the probe witnesses that gate: its tapes stand east of the block, and its control clears the gate\'s own flag', () => {
        const gate = layer.blocks.internalExitGates.find((g) => g.region_id === 'level_63');
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
