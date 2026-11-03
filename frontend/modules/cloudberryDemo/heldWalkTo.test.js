import { describe, expect, it } from 'vitest';
import { createHeldWalkTo } from './heldWalkTo.js';

const coin = { kind: 'location', name: 'region_2_2__loc_0' };
const door = { kind: 'exit', name: 'exit_S' };

describe('the bot\'s walk while the Cloudberry game page is not up (heldWalkTo)', () => {
    it('a walkTo before the game page is up is sent again when it is (the cold-page loss)', () => {
        const h = createHeldWalkTo();
        h.sent('walkTo', [coin]);
        expect(h.pageReady()).toEqual([coin]);
        expect(h.pageReady()).toBe(null);   // sent once
    });

    it('the latest walkTo wins; its options ride along', () => {
        const h = createHeldWalkTo();
        h.sent('walkTo', [coin]);
        h.sent('walkTo', [door, { door: 'end' }]);
        expect(h.pageReady()).toEqual([door, { door: 'end' }]);
    });

    it('a stop or reset after it forgets it', () => {
        for (const m of ['stop', 'reset']) {
            const h = createHeldWalkTo();
            h.sent('walkTo', [coin]);
            h.sent(m, []);
            expect(h.pageReady(), m).toBe(null);
        }
    });

    it('once the page is up nothing is held (a later appReady re-sends nothing)', () => {
        const h = createHeldWalkTo();
        h.pageReady();
        h.sent('walkTo', [coin]);
        expect(h.held()).toBe(null);
        expect(h.pageReady()).toBe(null);
    });

    it('a site change opens the window again', () => {
        const h = createHeldWalkTo();
        h.pageReady();
        h.pageGone();
        h.sent('walkTo', [door]);
        expect(h.pageReady()).toEqual([door]);
    });

    it('other control messages are not held; an empty walkTo holds nothing', () => {
        const h = createHeldWalkTo();
        h.sent('play', [60]);
        h.sent('instant', [true]);
        h.sent('walkTo', []);
        expect(h.pageReady()).toBe(null);
    });
});
