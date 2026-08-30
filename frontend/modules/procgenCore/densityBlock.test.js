/**
 * procgenCore/densityBlock.test — **THE DENSITY BLOCK'S OWN ROWS** (PROCGEN
 * ELEMENTS arc 5, slice 6b; kickoff §3.6).
 *
 * ⛔ These rows measure the SPELLING — six fields, one order, always all six —
 * and the two places the block could quietly stop being a reading of the record:
 * the `chambers` knob a kind may not declare, and the `fill` word that a
 * recomputation would get wrong on exactly the room arc 5 slice 1 measured.
 * Whether the page and the CLI print the SAME block on the same run is the
 * browser rows' claim, not this file's.
 */

import { describe, expect, it } from 'vitest';

import { DENSITY_LABEL, chambersOf, densityBlock, densityLine } from './densityBlock.js';

const BASE = {
    skeleton: { kind: 'winding', params: { chambers: 1 } },
    width: 10,
    height: 10,
    fill: 'dense',
    element: { name: 'chamber', params: { w: 2, h: 3 } },
    obstacleTarget: 6,
};

describe('the SIX fields, in ONE order', () => {
    it('⛓ names every lever, every time', () => {
        expect(densityBlock(BASE)).toBe('kind=winding · chambers=1 · size=10x10 · '
            + 'fill=dense · element=chamber;w=2;h=3 · target=6');
    });

    it('⛔ prints all six even when every one of them is at its default — a DIAL is '
        + 'read by seeing every position at once', () => {
        const line = densityBlock({
            skeleton: { kind: 'empty' }, width: 10, height: 10, obstacleTarget: 6,
        });
        expect(line).toBe('kind=empty · chambers=n/a · size=10x10 · fill=dense · '
            + 'element=none · target=6');
        for (const key of ['kind=', 'chambers=', 'size=', 'fill=', 'element=', 'target=']) {
            expect(line).toContain(key);
        }
    });

    it('⛓ the labelled form is the block with ONE prefix', () => {
        expect(densityLine(BASE)).toBe(`${DENSITY_LABEL}: ${densityBlock(BASE)}`);
    });
});

describe('`chambers` is the RESOLVED knob, and `n/a` where there is no knob', () => {
    it('⛓ resolves an unnamed value from the kind\'s own schema', () => {
        expect(chambersOf({ kind: 'winding' })).toBe('0');
        expect(chambersOf({ kind: 'winding', params: { chambers: 2 } })).toBe('2');
        expect(chambersOf({ kind: 'rooms' })).toBe('0');
    });

    it('⛔ says `n/a`, never `0`, for a kind that declares no `chambers` — a reader who '
        + 'saw `chambers=0` on `empty` would reasonably ask for `chambers=1`, and that '
        + 'refuses by name', () => {
        for (const kind of ['empty', 'classic', 'corridor']) {
            expect(chambersOf({ kind })).toBe('n/a');
        }
    });
});

describe('⛔⛔ the block READS the declared fill and never recomputes it', () => {
    /**
     * ⛓⛓ THE ROOM THAT SEPARATES THE TWO ANSWERS, and arc 5 slice 1 measured
     * it: `fill=shell` on an OPEN room strips **0%** — every wall of the border
     * ring is 4- or 8-adjacent to floor, so the shell IS the dense room and
     * `tiles.length === width * height`. A block that spelled the word from the
     * written-cell count would print `dense` about a run generated `shell`.
     */
    it('⛓ says `shell` for a shell run whose strip dropped NOTHING', () => {
        expect(densityBlock({
            skeleton: { kind: 'empty' }, width: 10, height: 10, fill: 'shell',
            obstacleTarget: 6,
        })).toContain('fill=shell');
    });

    it('⛓ and `dense` for the same room asked dense — the word is the ASK', () => {
        expect(densityBlock({
            skeleton: { kind: 'empty' }, width: 10, height: 10, fill: 'dense',
            obstacleTarget: 6,
        })).toContain('fill=dense');
    });
});

describe('the element is the head AS RESOLVED', () => {
    it('⛓ names ONE head, in the URL\'s own spelling — a `+` list names four possible '
        + 'rooms and only one of them was built', () => {
        expect(densityBlock({ ...BASE, element: { name: 'guard', params: { len: 4 } } }))
            .toContain('element=guard;len=4');
    });

    it('⛓ and `none` where nothing ran', () => {
        expect(densityBlock({ ...BASE, element: null })).toContain('element=none');
    });
});

describe('the SIZE is the record\'s, so the block follows arc 5 slice 1\'s channel', () => {
    it('⛓ prints a non-square multi-screen room as it is', () => {
        expect(densityBlock({ ...BASE, width: 40, height: 60 })).toContain('size=40x60');
    });
});
