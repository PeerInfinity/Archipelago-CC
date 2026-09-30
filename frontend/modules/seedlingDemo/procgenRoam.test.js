/**
 * procgenRoam.test — **THE ROAMING ENEMY'S SEEDLING BINDING** (concept library
 * F1, D4).
 *
 * The rows ask the four things the binding adds for a `none`-law element:
 *
 *   1. NO LOCK — the composite gives a placement with bodies and `killLock:
 *      false` no `killLockCell`, and the mapping realises it as spinners only,
 *      spending NO tag.
 *   2. THE TEXTLESS GOAL — a level whose COMMITTED record holds a roaming body
 *      certifies against `ROAMING_GOAL_CLASS`; every other level keeps
 *      `torchpickup` (a `chamber` level at the same seed is the control).
 *   3. THE NAMED CERTIFICATION REFUSAL — `rooms` seed 10 (found by the F1 scan):
 *      the solver REFUSES the room with the body in it, on both boots, and the
 *      gap is `the-solver-cannot-cross-the-roaming-body` with the solver's own
 *      words; the level ships with the element DROPPED and the torch back.
 *   4. THE KILL-LOCK CLAUSE — a `tset:-1` lock offered to a room that holds a
 *      roaming body is refused BY NAME at the anchor; the same template in a
 *      room without one is not.
 *   5. (D5) THE BODY ABLATION — the level solved with and without its bodies at
 *      the SAME boot: `empty` s2 pre-sword is INERT (the body stays in its side
 *      room), `branchy` s7 post-sword COSTS (149 vs 86 ticks, measured at F1).
 */

import { describe, expect, it } from 'vitest';

import { ROAM } from '../procgenCore/elements/roam.js';
import {
    BODY_ABLATION_VERDICTS, ROAMING_GOAL_CLASS, SEEDLING_DEFAULTS, bodyAblation,
    generateSeedlingLevel, seedlingModel, seedlingSeam, seedlingSkeletonSpec,
} from './procgenSeedling.js';
import { GRADES } from '../procgenCore/differentialGrade.js';
import { compositeSeedlingElement, seedlingElementEntities } from './procgenSeedlingElements.js';
import {
    POST_SWORD_ITEMS, POST_SWORD_PALETTE, PRE_SWORD_ITEMS, PRE_SWORD_PALETTE,
} from './procgenPalette.js';
import { rngFor } from './procgenRng.js';

const goalOf = (record) => record.entities.find((e) => e.attrs?.tag === SEEDLING_DEFAULTS.goalTag
    && e.type !== 'spinner');

describe('roam — the composite and the mapping carry NO lock', () => {
    /** A 10x10 open room, a 3x3 roam blob at (3,3), start (1,1), goal (8,8). */
    const placementAt = (seed) => {
        const site = { x: 3, y: 3, w: 3, h: 3 };
        const concrete = ROAM.instantiate(rngFor(seed), { w: 3, h: 3, bodies: 2 });
        return { site, placement: concrete.construct(site) };
    };
    const open = (x, y) => x > 0 && y > 0 && x < 9 && y < 9;

    it('killLock:false records the bodies and a NULL kill lock; killLock:true (the arena\'s '
        + 'law) puts one on a cut', () => {
        const { site, placement } = placementAt(3);
        const args = { width: 10, height: 10, groundAt: open, site, placement,
            start: { tx: 1, ty: 1 }, goal: { tx: 8, ty: 8 } };
        const roam = compositeSeedlingElement({ ...args, killLock: false });
        expect(roam.refused, roam.refused?.detail).toBeUndefined();
        expect(roam.placed.bodies).toHaveLength(2);
        expect(roam.placed.killLockCell).toBeNull();
        /** ⛓ the default is the arena's — every caller before F1 is unchanged. */
        const arena = compositeSeedlingElement(args);
        if (!arena.refused) expect(arena.placed.killLockCell).not.toBeNull();
        else expect(arena.refused.reason).toBe('no-cut-for-the-kill-lock');
    });

    it('realises each body as `spinner {tag:-1}`, no lock, and spends NO tag', () => {
        const placed = { door: null, killLockCell: null,
            bodies: [{ x: 4, y: 4, id: 'roam_body_0' }, { x: 5, y: 4, id: 'roam_body_1' }] };
        let asked = 0;
        const out = seedlingElementEntities({ placed, groupIdFor: () => 1,
            tagFor: () => { asked += 1; return 7; }, ids: null });
        expect(asked).toBe(0);
        expect(out.tags).toEqual({});
        expect(out.entities.map((e) => e.type)).toEqual(['spinner', 'spinner']);
        expect(out.entities.every((e) => e.attrs.tag === '-1')).toBe(true);
    });
});

describe('roam — the textless goal is the COMMITTED record\'s', () => {
    it('is `totempart`, a different class from the default torch', () => {
        expect(ROAMING_GOAL_CLASS).toBe('totempart');
        expect(SEEDLING_DEFAULTS.goalClass).toBe('torchpickup');
    });

    /** ⛓ `empty` seed 2 places a roam blob (F1's scan) — and the SAME seed with
     *  the chamber head is the control that keeps the torch. */
    it('a level holding a roaming body certifies against the textless goal; a chamber '
        + 'level at the same seed keeps the torch', () => {
        const roam = seedlingModel({ seed: 2, elements: { name: 'roam' } });
        expect(roam.elements.ran).toBe(true);
        expect(roam.roamingBodies.length).toBeGreaterThan(0);
        expect(roam.goalClass).toBe(ROAMING_GOAL_CLASS);
        const sk = roam.skeleton();
        expect(goalOf(sk).type).toBe(ROAMING_GOAL_CLASS);
        expect(sk.entities.filter((e) => e.type === 'lock')).toEqual([]);
        expect(sk.entities.filter((e) => e.type === 'spinner'))
            .toHaveLength(roam.roamingBodies.length);

        const chamber = seedlingModel({ seed: 2, elements: { name: 'chamber' } });
        expect(chamber.roamingBodies).toEqual([]);
        expect(chamber.goalClass).toBe('torchpickup');
        expect(goalOf(chamber.skeleton()).type).toBe('torchpickup');
    });

    it('a roam level whose element REFUSED keeps the torch (the record holds no body)', () => {
        const m = seedlingModel({ seed: 1, elements: { name: 'roam' } });
        expect(m.elements.ran).toBe(false);
        expect(m.roamingBodies).toEqual([]);
        expect(goalOf(m.skeleton()).type).toBe('torchpickup');
    });
});

describe('roam — the solver\'s refusal is the element\'s, BY NAME', () => {
    for (const [boot, items] of [['pre-sword', PRE_SWORD_ITEMS], ['post-sword', POST_SWORD_ITEMS]]) {
        it(`rooms seed 10, ${boot}: the-solver-cannot-cross-the-roaming-body, with the `
            + 'solver\'s own words, and the element is DROPPED', () => {
            const seam = seedlingSeam({ seed: 10, items, skeleton: seedlingSkeletonSpec('rooms'),
                elements: { name: 'roam' } });
            const c = seam.certification;
            expect(c.certified).toBe(false);
            expect(c.verdict).toBe('REFUSED');
            expect(c.gap).toBe('the-solver-cannot-cross-the-roaming-body');
            expect(c.reasonText).toMatch(/the combat ladder is EXHAUSTED/);
            expect(seam.model.elements.ran).toBe(false);
            expect(seam.model.roamingBodies).toEqual([]);
            expect(goalOf(seam.model.skeleton()).type).toBe('torchpickup');
        });
    }
});

describe('roam — a kill lock in a room that holds a roaming body is refused BY NAME', () => {
    /** A fake pass-2 template: nothing but a `tset:-1` lock on one cell. */
    const killLock = Object.freeze({ name: 'probe-kill-lock', footprint: [{ dx: 0, dy: 0 }],
        terrain: [], entities: [{ type: 'lock', dx: 0, dy: 0, attrs: { tset: '-1' } }] });
    const firstFree = (m) => m.interiorCells(m.skeleton()).find((c) => m.isFree(m.skeleton(),
        c.tx, c.ty));

    it('refuses it where the record holds a roaming body', () => {
        const m = seedlingModel({ seed: 2, elements: { name: 'roam' } });
        const c = firstFree(m);
        expect(m.refusalAt(m.skeleton(), killLock, c.tx, c.ty))
            .toMatch(/a-kill-lock-would-count-the-roaming-bodies/);
    });

    it('does not, where it holds none (the chamber at the same seed)', () => {
        const m = seedlingModel({ seed: 2, elements: { name: 'chamber' } });
        const c = firstFree(m);
        expect(m.refusalAt(m.skeleton(), killLock, c.tx, c.ty) ?? '')
            .not.toMatch(/a-kill-lock-would-count-the-roaming-bodies/);
    });
});

describe('roam — the BODY ABLATION (D5)', () => {
    const level = (kind, seed, palette) => generateSeedlingLevel({ seed, palette,
        skeleton: seedlingSkeletonSpec(kind), elements: { name: 'roam' } });

    /** ⛓ Two of the three BORROW the differential's words with the differential's
     *  meaning (INERT = equal cost, NOT-ESTABLISHED = no claim); `COSTS` is the
     *  ablation's own and is NOT added to `GRADES`, whose six words are pinned
     *  across both substrates. */
    it('declares three verdicts and adds NO word to differentialGrade.GRADES', () => {
        expect(BODY_ABLATION_VERDICTS).toEqual(['INERT', 'COSTS', 'NOT-ESTABLISHED']);
        expect(Object.values(GRADES)).toEqual(['STRONG', 'BOUND-DEPENDENT', 'WEAK', 'INERT',
            'SHORTENS', 'NOT-ESTABLISHED']);
        expect(Object.values(GRADES)).not.toContain('COSTS');
        expect(GRADES.INERT).toBe('INERT');
        expect(GRADES.NOT_ESTABLISHED).toBe('NOT-ESTABLISHED');
    });

    it('is absent from the summary of a level with no roaming body', () => {
        const lv = generateSeedlingLevel({ seed: 2, palette: PRE_SWORD_PALETTE,
            elements: { name: 'chamber' } });
        expect(lv.summary.bodyAblation).toBeUndefined();
        expect(bodyAblation({ model: lv.model, out: lv, palette: PRE_SWORD_PALETTE })).toBeNull();
    });

    /**
     * ⛓⛓ **THE SAME-BOOT PIN.** A body in a sealed side room that never leaves
     * it is INERT — and INERT is only reachable if the two arms ran at ONE boot:
     * the pre-sword and post-sword solves of any room differ (the census's empty
     * control is 218 vs 123), so an ablation whose without-arm ran at the other
     * boot reads COSTS or NOT-ESTABLISHED here (F1 mutant (b)).
     */
    it('empty s2 pre-sword: INERT — both arms SOLVED in the same tick count, the body removed',
        () => {
            const lv = level('empty', 2, PRE_SWORD_PALETTE);
            const a = lv.summary.bodyAblation;
            expect(lv.summary.goalClass).toBe(ROAMING_GOAL_CLASS);
            expect(a.removed).toBe(a.bodies);
            expect(a.withBodies.verdict).toBe('SOLVED');
            expect(a.withoutBodies.verdict).toBe('SOLVED');
            expect(a.withoutBodies.ticks).toBe(a.withBodies.ticks);
            expect(a.verdict).toBe('INERT');
        });

    it('branchy s7 post-sword: COSTS — the bodies are on the route (149 vs 86 ticks)', () => {
        const a = level('branchy', 7, POST_SWORD_PALETTE).summary.bodyAblation;
        expect(a.verdict).toBe('COSTS');
        expect(a.withBodies.ticks).toBeGreaterThan(a.withoutBodies.ticks);
        expect(a.deltaTicks).toBe(a.withBodies.ticks - a.withoutBodies.ticks);
    });
});
