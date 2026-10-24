/**
 * seedlingDemo/ghostMotion.test — ⛓⛓⛓ SEEDLING FIDELITY GHOSTMOTION: the ghost swing's release clock.
 *
 * `slashEnd()` (the swing animation's own callback) is what clears `slashDashed` and so re-arms the dash. The ghost
 * sword's animations are 7 / 6 ticks, the sword's 5 / 4 — and `levelRun` timed every swing's release off the sword's,
 * so the model dashed a press the game swallows (+2 px along travel: the wave-10 sweep's 18 tick-exact legs). The
 * game witnesses are tapes (`ghostmotion-l102-axis`, `ghostmotion-l102-diag`, recorded on p4f and replayed by
 * `tapeRunner`); these rows are the arithmetic and the contract, each asked with `GHOSTSWORD_MOTION` ON and OFF.
 */
import { describe, expect, it } from 'vitest';

import {
    GHOSTSWORD_MOTION, GHOSTSWORD_MOTION_DEFAULT, GHOST_DASH_CHAIN, ghostClockFor, slashEndTicksFor,
    withGhostSwordMotion, withGhostSwordPress,
} from './ghostSword.js';
import { DASH_CHAIN, SLASH_ANIM_TICKS, deriveDashChain } from './combatVerbs.js';
import { DASH_CHAIN_PATTERN, GHOST_DASH_CHAIN_PATTERN, dashPrefixesFor } from './solverBot.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import { PIN_NAMES } from './tapeFormat.js';

describe('the switch', () => {
    it('is ON by default, and `withGhostSwordMotion` restores it', () => {
        expect(GHOSTSWORD_MOTION_DEFAULT).toBe(true);
        const was = GHOSTSWORD_MOTION.enabled;
        withGhostSwordMotion(!was, () => expect(GHOSTSWORD_MOTION.enabled).toBe(!was));
        expect(GHOSTSWORD_MOTION.enabled).toBe(was);
    });

    it('the ghost clock needs BOTH ghost switches and a ghost swing', () => {
        expect(ghostClockFor('ghostsword')).toBe(true);
        expect(ghostClockFor('sword')).toBe(false);
        expect(withGhostSwordMotion(false, () => ghostClockFor('ghostsword'))).toBe(false);
        expect(withGhostSwordPress(false, () => ghostClockFor('ghostsword'))).toBe(false);
    });
});

describe('the release clock — `slashEndTicksFor`', () => {
    it('ON: the ghost sword\'s own animations (7 / 6); the sword\'s stay 5 / 4', () => {
        expect(slashEndTicksFor('slash', 'ghostsword')).toBe(7);
        expect(slashEndTicksFor('slashnarrow', 'ghostsword')).toBe(6);
        expect(slashEndTicksFor('slash', 'sword')).toBe(SLASH_ANIM_TICKS.slash);
        expect(slashEndTicksFor('slashnarrow', 'sword')).toBe(SLASH_ANIM_TICKS.slashnarrow);
    });

    it('OFF: every swing on the sword\'s clock (the BEFORE model)', () => {
        withGhostSwordMotion(false, () => {
            expect(slashEndTicksFor('slash', 'ghostsword')).toBe(5);
            expect(slashEndTicksFor('slashnarrow', 'ghostsword')).toBe(4);
        });
    });
});

describe('the dash chain — `combatVerbs.deriveDashChain`', () => {
    it('the sword\'s is unchanged by the refactor: 2 · 8 · 14', () => {
        expect([...DASH_CHAIN.at]).toEqual([2, 8, 14]);
        expect(deriveDashChain(SLASH_ANIM_TICKS)).toEqual(DASH_CHAIN);
        expect([...DASH_CHAIN_PATTERN]).toEqual([0, 2, 8, 14]);
    });

    it('⛓⛓ the ghost sword\'s is 2 · 10 · 18 (a 6-tick dash, the release below the press, the key\'s edge)', () => {
        expect([...GHOST_DASH_CHAIN.at]).toEqual([2, 10, 18]);
        expect([...GHOST_DASH_CHAIN_PATTERN]).toEqual([0, 2, 10, 18]);
    });

    it('`dashPrefixesFor(mode, {weapon})`: the ghost chain ON, the sword\'s OFF and for the sword', () => {
        expect(dashPrefixesFor('full', { weapon: 'ghostsword' }).map((p) => [...p])).toEqual([[0, 2, 10, 18]]);
        expect(dashPrefixesFor('all', { weapon: 'ghostsword' }).map((p) => [...p]))
            .toEqual([[0], [0, 2], [0, 2, 10], [0, 2, 10, 18]]);
        expect(dashPrefixesFor('full').map((p) => [...p])).toEqual([[0, 2, 8, 14]]);
        expect(withGhostSwordMotion(false, () => dashPrefixesFor('full', { weapon: 'ghostsword' }))
            .map((p) => [...p])).toEqual([[0, 2, 8, 14]]);
        expect(dashPrefixesFor('none', { weapon: 'ghostsword' })).toEqual([]);
    });
});

describe('the run — `levelRun`\'s release (the witnesses\' own stance: L102, `right` held)', () => {
    const levelSource = atlasLevelSource();
    const drive = (items, pressAt) => {
        const run = createLevelRun({
            levelSource, boot: { level: 102, x: 176, y: 96 }, noclip: false, noHazards: [], noDamage: false,
            grants: [], persistence: [], despawn: [], equips: [], pins: [...PIN_NAMES],
            save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null, seam: { items }, roles: ROLES,
        });
        const endsAfterDash = [];
        for (let t = 0; t < 16; t += 1) {
            const held = new Set(['right']);
            if (pressAt.includes(t)) held.add('primary');
            run.advance(held);
            if (t === 2) endsAfterDash.push(run.progress('slashInfo').endsAt);
        }
        return { outcomes: run.slashPresses.map((p) => `${p.t}:${p.outcome}`), endsAt: endsAfterDash[0], x: run.state.x };
    };
    const GHOST = { hasSword: true, hasGhostSword: true };

    it('⛓⛓⛓ ON: the ghost dash at t 2 releases at t 8, so the t 8 press is SWALLOWED (the game\'s outcome)', () => {
        const r = drive(GHOST, [0, 2, 8, 14]);
        expect(r.endsAt).toBe(8);
        expect(r.outcomes).toEqual(['0:slash', '2:dash', '8:swallowed', '14:dash']);
    });

    it('OFF: the sword\'s clock releases at t 6 and the t 8 press dashes (the defect, by name)', () => {
        const r = withGhostSwordMotion(false, () => drive(GHOST, [0, 2, 8, 14]));
        expect(r.endsAt).toBe(6);
        expect(r.outcomes).toEqual(['0:slash', '2:dash', '8:dash', '14:dash']);
    });

    it('the plain sword is untouched by the switch', () => {
        const SWORD = { hasSword: true };
        const on = drive(SWORD, [0, 2, 8, 14]);
        const off = withGhostSwordMotion(false, () => drive(SWORD, [0, 2, 8, 14]));
        expect(on).toEqual(off);
        expect(on.endsAt).toBe(6);
    });
});
