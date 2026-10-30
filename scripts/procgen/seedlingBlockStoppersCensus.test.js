/**
 * ⛓ RULES rules-block-stoppers — the KILLABLE and MOBILE Enemy bodies on a pushed block's cells
 * (`census-seedling-block-stoppers.mjs`, over the rules' own push search and the producer's own crossing cases). Pinned
 * by COUNT so it cannot drift silently: a new body on a block path, a moved block or a model change that makes a body
 * critical to a crossing reds a row here and has to be read. The game witness of the one MOBILE row is
 * `probe-seedling-l65-bob-block.mjs`, pinned to the cells it witnesses.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { blockStopperCensus, censusCounts } from './census-seedling-block-stoppers.mjs';
import { bobBlockTapes, expectBobBlock, CRITICAL, LEVEL, EAST } from './probe-seedling-l65-bob-block.mjs';

let census;
beforeAll(() => {
    census = blockStopperCensus();
}, 300_000);

describe('the bodies on the pushed blocks\' cells', () => {
    it('the counts: 19 blocks, 131 (use x body) rows that meet — 119 can\'t gate, 11 in holder rooms, 1 mobile, 0 kill-gates', () => {
        expect(censusCounts(census)).toEqual({
            blocks: 19,
            uses: { none: 7, holder: 8, 'crossing+holder': 1, crossing: 3 },
            rows: 131,
            verdicts: { "CAN'T-GATE": 119, HOLDER: 11, MOBILE: 1 },
            movement: { chase: 91, static: 10, 'wall-hug-launch': 6, none: 24 },
        });
    });

    it('no KILL-GATE: no static killable body parked on a block path changes a crossing\'s price', () => {
        expect(census.rows.filter((r) => r.verdict === 'KILL-GATE')).toEqual([]);
    });

    it('the one MOBILE row is the probe\'s: L65\'s Bob, critical on the cells the probe watches, its kill held by the crossing', () => {
        const mobile = census.rows.filter((r) => r.verdict === 'MOBILE');
        expect(mobile.map((r) => ({ level: r.level, crossing: r.crossing, cls: r.cls, critical: r.critical.map((t) => t.join(',')), killHeld: r.killHeld, respawns: r.respawns })))
            .toEqual([{ level: LEVEL, crossing: 'r0c8 -> r4c11', cls: 'Bob', critical: [...CRITICAL], killHeld: true, respawns: true }]);
    });

    it('the HOLDER rows (the holder search models no Enemy) stand in two rooms: L16\'s Bobs, L39\'s Spinners', () => {
        const holder = census.rows.filter((r) => r.verdict === 'HOLDER');
        expect([...new Set(holder.map((r) => `L${r.level} ${r.cls}`))].sort()).toEqual(['L16 Bob', 'L39 Spinner']);
    });
});

describe('the probe\'s tapes and expectations', () => {
    it('two tapes, both booting east of the block on [12,8] with the Spear', () => {
        const tapes = bobBlockTapes();
        expect(Object.keys(tapes)).toEqual(['alive', 'kill-first']);
        expect([EAST.x / 16, EAST.y / 16]).toEqual([12, 8]);
        for (const t of Object.values(tapes)) expect(t.grants).toEqual([{ level: LEVEL, items: ['spear'] }]);
    });

    it('the expectations: a crossing with the Bob alive and off the critical cells; the control with it dead first', () => {
        const crossed = { reachedLedge: true, blockFinal: null, blockTiles: ['11,8', '10,8', '10,7', '9,7'], bobOnCritical: false };
        expect(expectBobBlock('alive', { ...crossed, bobAtEnd: 1, bobDiedAt: null })).toBe(true);
        expect(expectBobBlock('alive', { ...crossed, bobAtEnd: 1, bobDiedAt: null, bobOnCritical: true })).toBe(false);
        expect(expectBobBlock('alive', { ...crossed, reachedLedge: false, bobAtEnd: 1, bobDiedAt: null })).toBe(false);
        expect(expectBobBlock('kill-first', { ...crossed, bobAtEnd: 0, bobDiedAt: 210 })).toBe(true);
        expect(expectBobBlock('kill-first', { ...crossed, bobAtEnd: 1, bobDiedAt: null })).toBe(false);
    });
});
