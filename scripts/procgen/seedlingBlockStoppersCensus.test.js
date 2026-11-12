/**
 * ⛓ RULES rules-block-stoppers — the KILLABLE and MOBILE Enemy bodies on a pushed block's cells
 * (`census-seedling-block-stoppers.mjs`, over the rules' own push search and the producer's own crossing cases). Pinned
 * by COUNT so it cannot drift silently: a new body on a block path, a moved block or a model change that makes a body
 * critical to a crossing reds a row here and has to be read. The game witness of the one MOBILE row is
 * `probe-seedling-l65-bob-block.mjs`, pinned to the cells it witnesses.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { blockStopperCensus, censusCounts, priceDnf } from './census-seedling-block-stoppers.mjs';
import { holderTapes, expectHolder, BLOCK_PATH, BUTTON, BOOT } from './probe-seedling-l16-holder-bobs.mjs';
import { bobBlockTapes, expectBobBlock, CRITICAL, LEVEL, EAST } from './probe-seedling-l65-bob-block.mjs';

let census;
beforeAll(() => {
    census = blockStopperCensus();
}, 300_000);

describe('the bodies on the pushed blocks\' cells', () => {
    // ⛓ tile-rules-automation-r-a5: 131 -> 125 rows, static 10 -> 4. L40's wand locks cost their presses, so the t2-button
    //   column is its own sub-region (r23c29) and `iceturret@472,400` stands there, where no block crossing is: its 6 CAN'T-GATE
    //   rows on the body's block crossings leave. Every other row is the same after the body's r23c29 -> r26c13 rename; no price moves.
    it('the counts: 19 blocks, 125 (use x body) rows that meet — 113 can\'t gate, 11 in holder rooms (all ok), 1 mobile, 0 kill-gates', () => {
        expect(censusCounts(census)).toEqual({
            blocks: 19,
            uses: { none: 7, holder: 8, 'crossing+holder': 1, crossing: 3 },
            rows: 125,
            verdicts: { "CAN'T-GATE": 113, HOLDER: 11, MOBILE: 1 },
            movement: { chase: 91, static: 4, 'wall-hug-launch': 6, none: 24 },
            holder: { 'ok (parked same)': 5, 'ok (parked tighter, never settles)': 6 },
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

    // ⛓ RULES rules-l16-holder-enemies — each HOLDER row priced with its body parked for good on every cell it meets.
    it('L16: each Bob parked for good moves NO entry — lock@320,112 from (19,7) already costs a Bob kill verb', () => {
        const l16 = census.rows.filter((r) => r.verdict === 'HOLDER' && r.level === 16);
        expect(l16.map((r) => r.body).sort()).toEqual(['bob@160,112', 'bob@176,16', 'bob@192,80', 'bob@208,32', 'bob@224,96']);
        for (const r of l16) {
            expect({ parked: r.parked, settles: r.settles, holderVerdict: r.holderVerdict, respawns: r.respawns, killFlags: r.killFlags })
                .toEqual({ parked: 'same', settles: true, holderVerdict: 'ok', respawns: true, killFlags: ['hasSword', 'hasSpear'] });
            expect(r.prices['lock@320,112 from 19,7']).toEqual(['flag:hasSpear', 'flag:hasSword']);
        }
    });

    it('L39: a Spinner parked for good would add a kill verb to Fire — but it never settles, so the rows are ok', () => {
        const l39 = census.rows.filter((r) => r.verdict === 'HOLDER' && r.level === 39);
        expect(l39).toHaveLength(6);
        for (const r of l39) {
            expect({ parked: r.parked, settles: r.settles, holderVerdict: r.holderVerdict }).toEqual({ parked: 'tighter', settles: false, holderVerdict: 'ok' });
            expect(r.moved.map((m) => [m.entry, m.price, m.parked])).toEqual([
                ['wandlock@144,64 from 9,5', ['flag:hasFire'], ['flag:hasFire & flag:hasSpear', 'flag:hasFire & flag:hasSword']],
                ['wandlock@48,160 from 3,9', ['flag:hasFire'], ['flag:hasFire & flag:hasSpear', 'flag:hasFire & flag:hasSword']],
            ]);
        }
    });

    it('priceDnf reads a price as logic: any() expanded, a superset conjunction dropped', () => {
        const byKey = new Map([['any(flag:hasSpear|flag:hasSword)', { any: [{ flag: 'hasSword' }, { flag: 'hasSpear' }] }], ['flag:hasSword', { flag: 'hasSword' }], ['flag:hasSpear', { flag: 'hasSpear' }]]);
        expect(priceDnf([['any(flag:hasSpear|flag:hasSword)', 'flag:hasSpear'], ['any(flag:hasSpear|flag:hasSword)', 'flag:hasSword']], byKey))
            .toEqual(priceDnf([['any(flag:hasSpear|flag:hasSword)']], byKey));
        expect(priceDnf([[]], byKey)).toEqual(['']);
        expect(priceDnf([], byKey)).toEqual([]);
    });
});

describe('the L16 holder probe\'s tapes and expectations', () => {
    it('six tapes, all booting on [10,2] with the Sword', () => {
        const tapes = holderTapes();
        expect(Object.keys(tapes)).toEqual(['alive', 'alive-south', 'kill-first', 'lure', 'parked', 'pinned']);
        expect([BOOT.x / 16, BOOT.y / 16]).toEqual([10, 2]);
        for (const t of Object.values(tapes)) expect(t.grants).toEqual([{ level: 16, items: ['sword'] }]);
    });

    it('the expectations: the block on the button and the lock passed every way; a Sword kill only on kill-first', () => {
        const held = { blockFinal: BUTTON, blockOnButtonAt: 594, passedLock: true, blockTiles: [...BLOCK_PATH] };
        expect(expectHolder('pinned', { ...held, swordKill: false, eastBobsAtButton: 2 })).toBe(true);
        expect(expectHolder('pinned', { ...held, swordKill: false, eastBobsAtButton: 0 })).toBe(false);
        expect(expectHolder('pinned', { ...held, blockFinal: '17,5', swordKill: false, eastBobsAtButton: 2 })).toBe(false);
        expect(expectHolder('alive', { ...held, swordKill: false, eastBobsAtButton: 1 })).toBe(true);
        expect(expectHolder('alive', { ...held, swordKill: true, eastBobsAtButton: 1 })).toBe(false);
        expect(expectHolder('kill-first', { ...held, swordKill: true, eastBobsAtButton: 0 })).toBe(true);
        expect(expectHolder('kill-first', { ...held, swordKill: false, eastBobsAtButton: 0 })).toBe(false);
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
