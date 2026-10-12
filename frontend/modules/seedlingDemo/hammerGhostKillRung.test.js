/**
 * seedlingDemo/hammerGhostKillRung.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE G1: THE KILL RUNG'S GHOST-SWORD GATE.
 *
 * The combat ladder's kill rung, in its lock-less spinner arm, asked `derivePressKill` only for a `sword` primary and
 * refused every other one by name, although C2 had taught `derivePressKill` the ghost's press (hammer-phase D's
 * finding: L40 legs 378 / 381 / 397 / 414 and C1's staging A refuse a ghost run there). `GHOST_KILL_RUNG` (OFF) lets
 * the rung ask it for a weapon `derivePressKill` admits. OFF is the gate it replaces, byte for byte.
 */
import { describe, expect, it } from 'vitest';

import {
    GHOST_KILL_RUNG, GHOST_KILL_RUNG_DEFAULT, killRungPresses, withGhostKillRung, withGhostSpinnerPress,
} from './ghostSpinnerPress.js';

describe('GHOST_KILL_RUNG — the switch (hammer-phase G1, D1)', () => {
    it('is OFF by default and opted in by `SEEDLING_GHOST_KILL_RUNG=1`; the wrapper restores it', () => {
        expect(GHOST_KILL_RUNG_DEFAULT).toBe(false);
        expect(GHOST_KILL_RUNG.enabled).toBe(process.env.SEEDLING_GHOST_KILL_RUNG === '1');
        const was = GHOST_KILL_RUNG.enabled;
        expect(withGhostKillRung(true, () => GHOST_KILL_RUNG.enabled)).toBe(true);
        expect(withGhostKillRung(false, () => GHOST_KILL_RUNG.enabled)).toBe(false);
        expect(() => withGhostKillRung(true, () => { throw new Error('x'); })).toThrow('x');
        expect(GHOST_KILL_RUNG.enabled).toBe(was);
    });

    it('`killRungPresses`: OFF only the sword; ON also the ghost sword, and only where `derivePressKill` admits it '
        + '(`GHOST_SPINNER_PRESS` ON)', () => {
        const table = () => ['sword', 'ghostsword', null, 'fire', 'spear'].map((w) => [w, killRungPresses(w)]);
        const off = [['sword', true], ['ghostsword', false], [null, false], ['fire', false], ['spear', false]];
        withGhostSpinnerPress(true, () => {
            expect(withGhostKillRung(false, table)).toEqual(off);
            expect(withGhostKillRung(true, table)).toEqual([['sword', true], ['ghostsword', true], [null, false],
                ['fire', false], ['spear', false]]);
        });
        withGhostSpinnerPress(false, () => {
            expect(withGhostKillRung(false, table)).toEqual(off);
            expect(withGhostKillRung(true, table)).toEqual(off);
        });
    });
});
