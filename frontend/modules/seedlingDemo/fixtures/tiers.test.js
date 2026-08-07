import { describe, expect, it } from 'vitest';

import { fixtureNames, loadTape } from './index.js';
import {
    LEGACY_ONLY_LEVELS, LEGACY_TAPES, TierError, TIERS,
    assertTiersComplete, tapesInTier,
} from './tiers.js';

/**
 * The tier assignment's own tests. ⛔ The mutation list these are written
 * against, and what each would look like if it slipped through:
 *
 *   · a LEGACY name misspelled       -> a demotion that demotes nothing and
 *                                       reads exactly like one that works
 *   · a fixture added with no tier   -> silently skipped by the gate
 *   · `full` narrowed to exclude     -> the pre-push gate stops being a
 *     legacy                            gate, invisibly
 *   · a PAIR arm demoted             -> a pair with one arm, which is not a
 *                                       pair (feedback_control_that_removes
 *                                       _treatment_changes_the_world)
 */
describe('roster tiers', () => {
    const roster = fixtureNames();

    it('every LEGACY name is a real fixture', () => {
        expect(() => assertTiersComplete(roster)).not.toThrow();
    });

    it('a LEGACY name the roster does not have is a NAMED failure', () => {
        // The rot this file exists to prevent, exercised directly.
        expect(() => assertTiersComplete(roster.filter((n) => n !== LEGACY_TAPES[0])))
            .toThrow(TierError);
    });

    it('gate and legacy PARTITION the roster', () => {
        const { gate, legacy } = assertTiersComplete(roster);
        expect(gate.length + legacy.length).toBe(roster.length);
        expect(new Set([...gate, ...legacy]).size).toBe(roster.length);
        expect(gate.some((n) => LEGACY_TAPES.includes(n))).toBe(false);
    });

    it('`full` still means EVERYTHING — the pre-push gate skips nothing', () => {
        expect(tapesInTier('full', roster).sort()).toEqual([...roster].sort());
        // …and legacy is a strict subset of it, not something outside it.
        for (const n of LEGACY_TAPES) expect(tapesInTier('full', roster)).toContain(n);
    });

    it('a new fixture joins `gate` automatically — the list can only fail SAFE', () => {
        const withNew = [...roster, 'zz-a-fixture-nobody-classified'];
        const { gate } = assertTiersComplete(withNew);
        expect(gate).toContain('zz-a-fixture-nobody-classified');
    });

    it('an unknown tier name throws rather than sweeping nothing', () => {
        expect(() => tapesInTier('fast', roster)).toThrow(TierError);
        expect(() => tapesInTier('nonsense', roster)).toThrow(TierError);
    });

    it('NO PAIR ARM is demoted — a pair with one arm is not a pair', () => {
        const names = new Set(roster);
        for (const n of LEGACY_TAPES) {
            const isArm = n.endsWith('-control') || names.has(`${n}-control`);
            expect(isArm, `${n} is a pair arm and must not be demoted`).toBe(false);
        }
    });

    it('the r3 demotions really are byte-identical walks with more crutches', () => {
        // The claim the demotion rests on, checked rather than restated.
        for (const [dominated, dominator] of [
            ['r3-walk-1-sword', 'r4-walk-1-sword'],
            ['r3-walk-2-feather', 'r4-walk-2-feather'],
            ['r3-walk-3-torch', 'r4-walk-3-torch'],
        ]) {
            expect(LEGACY_TAPES).toContain(dominated);
            expect(LEGACY_TAPES).not.toContain(dominator);
            const a = loadTape(dominated);
            const b = loadTape(dominator);
            expect(JSON.stringify(a.inputs)).toBe(JSON.stringify(b.inputs));
            expect(a.tick_count).toBe(b.tick_count);
            // Strictly fewer crutches on the KEPT side: `noHazards` is the
            // relaxation, and r4's list must be a strict subset of r3's.
            const ah = new Set(a.noHazards ?? []);
            const bh = new Set(b.noHazards ?? []);
            expect(bh.size).toBeLessThan(ah.size);
            for (const h of bh) expect(ah.has(h)).toBe(true);
        }
    });

    it('every demoted R1 walk really is a noclip tape', () => {
        for (const n of LEGACY_TAPES.filter((x) => x.startsWith('r1-'))) {
            expect(loadTape(n).noclip, `${n} was demoted as "the noclip era"`).toBe(true);
        }
    });

    it('the coverage that LEAVES is named, and the name is still true', () => {
        // ⛔ A bounded sweep must name what it bounded. If some other tape
        // starts reaching L49, this assertion is what notices — and the
        // right response is to update the note, not to delete the test.
        const kept = roster.filter((n) => !LEGACY_TAPES.includes(n));
        const reaches = (n, level) => {
            const t = loadTape(n);
            if (t.boot?.level === level) return true;
            if ((t.grants ?? []).some((g) => g.level === level)) return true;
            if ((t.persistence ?? []).some((c) => c.level === level)) return true;
            return false;
        };
        for (const level of LEGACY_ONLY_LEVELS) {
            expect(kept.some((n) => reaches(n, level)),
                `L${level} is declared LEGACY-only but a kept tape declares it`).toBe(false);
            expect(LEGACY_TAPES.some((n) => reaches(n, level)),
                `L${level} is declared LEGACY-only but no legacy tape declares it`).toBe(true);
        }
    });

    it('TIERS documents exactly the tiers the code answers for', () => {
        expect(Object.keys(TIERS).sort()).toEqual(['fast', 'full', 'gate', 'legacy']);
    });
});
