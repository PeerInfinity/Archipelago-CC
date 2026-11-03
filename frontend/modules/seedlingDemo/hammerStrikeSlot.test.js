/**
 * seedlingDemo/hammerStrikeSlot.test — ⛓⛓⛓ hammer-phase STRIKE-SLOT: the walk's strike policy reads the SELECTED slot
 * (`strikeSlot.STRIKE_SLOT`, OFF).
 *
 * ⛓ CORPSEBUMP2's hand-over: `strikePolicyFor` gated on the INVENTORY's blade, so a walk with Fire selected was handed
 * a policy whose `primary` presses the game runs as `useItem(Main.primary)` — Fire presses (L40's latch chain: the walk
 * to corpse bump 2's stance, a planned dash press, bumped the corpse; p4g at 0 px, fidelity's witness
 * `corpsebump2-walk-press`). ON, the gate is `primaryWeapon` (`pressIsBlade`): a non-blade selection builds no policy,
 * a built one stands down while the slot is not a blade, and `planSwordDash` refuses by name. With the Ghost Sword held
 * only `ghostsword` is a blade (⚖ 2026-10-30: it replaces the sword).
 *
 * The fixture is L6's bob on its lane (`hammerAxisStrikes`' room), with Fire selected: the smallest walk on which the
 * policy presses. The game's answer to that press is `levelRun.weaponForPress` (`Player.useItem`'s switch,
 * transcribed): a Fire press — five dispatches T+4..T+8, none of which touches the bob, the same timing the corpse
 * witness's walk press has in the game (press t1182, dispatches t1186–t1190, the corpse moved).
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { ROLES } from './levelWorld.js';
import { drive } from './botDriverV2.js';
import { planSwordDash, previewWalk, strikePolicyFor } from './solverBot.js';
import {
    STRIKE_SLOT, STRIKE_SLOT_COUNTS, STRIKE_SLOT_DEFAULT, pressIsBlade, resetStrikeSlotCounts, withStrikeSlot,
} from './strikeSlot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const ENV = globalThis.process?.env ?? {};
const levelSource = atlasLevelSource();
const BOB = 'bob@112,48';
const AIM = { x: 160, y: 56 };
const FIRE = [{ t: 0, slot: 1 }];
const key = (h) => [...h].sort().join('+') || '-';

/** L6 at the lane's west end with `items`, `equips` selecting the slot. */
const l6 = (items = { hasSword: true, hasFire: true }, equips = []) => createLevelRun({
    levelSource, boot: { level: 6, x: 80, y: 48 }, noclip: false, noHazards: [], noDamage: false,
    grants: [], persistence: [], despawn: [], equips, pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null, seam: { items }, roles: ROLES,
});

/** The plain (non-axis) drive east along the lane for 60 ticks, the walk's policy built under the switch. */
function driveLane(on, items, equips) {
    const run = l6(items, equips);
    resetStrikeSlotCounts();
    const strike = withStrikeSlot(on, () => strikePolicyFor(run));
    const perTick = [];
    try {
        withStrikeSlot(on, () => drive(run, AIM, perTick, { until: 'arrival', tolerance: 0, maxTicks: 60,
            what: 'the STRIKE-SLOT lane', avoidVolumes: false, strike }));
    } catch (e) {
        // the bob stands on the lane: neither arm arrives in 60 ticks, and that is not what is asked here
        if (!/not reached within 60 ticks/.test(e.message)) throw e;
    }
    return {
        run, strike, keys: perTick.map(key), counts: { ...STRIKE_SLOT_COUNTS },
        pressTicks: perTick.flatMap((k, i) => (k.has('primary') ? [i] : [])),
        presses: run.ledger('presses').map((p) => [p.t, p.weapon, p.fired, p.hits.length]),
        hits: run.ledger('playerHits').map((h) => [h.t, h.id]),
    };
}

describe('hammer-phase STRIKE-SLOT — the strike policy reads the selected slot (`STRIKE_SLOT`)', () => {
    it('ships OFF (`SEEDLING_STRIKE_SLOT=1` turns it on in node; the page channel knows the name)', () => {
        expect(STRIKE_SLOT_DEFAULT).toBe(false);
        expect(STRIKE_SLOT.enabled).toBe(ENV.SEEDLING_STRIKE_SLOT === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_STRIKE_SLOT');
        const run = l6(undefined, FIRE);
        expect(run.progress('primaryWeapon')).toBe('fire');
        // OFF the inventory's sword builds the policy whatever is selected; ON a Fire selection builds none.
        expect(withStrikeSlot(false, () => strikePolicyFor(run))).not.toBeNull();
        expect(withStrikeSlot(true, () => strikePolicyFor(run))).toBeNull();
        expect(STRIKE_SLOT.enabled).toBe(ENV.SEEDLING_STRIKE_SLOT === '1');
    });

    it('a Fire-selected walk: OFF the policy "strikes" the bob and every press is a Fire press; ON it presses nothing', () => {
        const off = driveLane(false, undefined, FIRE);
        const on = driveLane(true, undefined, FIRE);
        // OFF: the policy aims at the bob and believes it presses a sword at it five times …
        expect(off.strike.trace.filter((t) => t.decision === 'press').map((t) => [t.tick, t.target]))
            .toEqual([11, 23, 35, 47, 59].map((t) => [t, BOB]));
        expect(off.pressTicks).toEqual([11, 23, 35, 47, 59]);
        // … and the game runs each as `useItem(1)`: a Fire press, five dispatches T+4..T+8, none touching the bob.
        expect(off.presses).toEqual([11, 23, 35, 47].flatMap((t) => [4, 5, 6, 7, 8].map((d) => [t, 'fire', t + d, 0])));
        expect(off.run.ledger('presses').some((p) => p.weapon === 'sword')).toBe(false);
        // ON: no policy is built, the walk holds no `primary`, and the bob's contacts are the same two (the strikes
        // OFF priced never landed).
        expect(on.strike).toBeNull();
        expect(on.counts).toMatchObject({ refused: 1, stoodDown: 0 });
        expect(on.pressTicks).toEqual([]);
        expect(on.presses).toEqual([]);
        expect(on.hits).toEqual(off.hits);
        expect(on.hits).toEqual([[20, BOB], [42, BOB]]);
        // ⚖ 30(c): the preview spends the drive's keys under either state (OFF its Fire presses, ON none).
        for (const [arm, on_] of [[off, false], [on, true]]) {
            const pv = withStrikeSlot(on_, () => previewWalk(l6(undefined, FIRE), [AIM], 0,
                { strike: strikePolicyFor(l6(undefined, FIRE)) }));
            expect(pv.samples.slice(0, 19).map((x) => key(x.held ?? new Set()))).toEqual(arm.keys.slice(0, 19));
        }
    });

    it('a built policy stands down when the slot leaves the blade; `planSwordDash` refuses by name ON', () => {
        const run = l6();
        const policy = withStrikeSlot(true, () => strikePolicyFor(run));
        expect(policy).not.toBeNull();
        run.equipNow(1);
        expect(run.progress('primaryWeapon')).toBe('fire');
        resetStrikeSlotCounts();
        const bob = run.entities('strikeBodies').find((b) => b.id === BOB);
        const state = { ...run.state, x: bob.rect.x - 4, y: (bob.rect.y + bob.rect.bottom) / 2 };
        const walk = new Set(['right']);
        expect(withStrikeSlot(true, () => policy.decide(state, [bob], 0, walk))).toEqual({ held: walk, decision: 'none' });
        expect(STRIKE_SLOT_COUNTS.stoodDown).toBe(1);
        const fired = l6(undefined, FIRE);
        const dashOn = withStrikeSlot(true, () => planSwordDash(fired, [{ x: fired.state.x + 32, y: fired.state.y }], {}));
        expect(dashOn.plan).toBeNull();
        expect(dashOn.why).toMatch(/the selected slot fires `fire`, not a blade/);
        expect(STRIKE_SLOT_COUNTS.dashRefused).toBe(1);
    });

    it('a blade-selected walk = OFF, key for key', () => {
        const off = driveLane(false);
        const on = driveLane(true);
        expect(off.run.progress('primaryWeapon')).toBe('sword');
        expect(on.keys).toEqual(off.keys);
        expect(on.strike.trace).toEqual(off.strike.trace);
        expect(on.presses).toEqual(off.presses);
        expect(on.presses.filter(([, , , n]) => n > 0).length).toBeGreaterThan(0);
        expect(on.counts).toEqual({ refused: 0, stoodDown: 0, dashRefused: 0 });
    });

    it('the Ghost Sword held selects `ghostsword` and never `sword` (⚖ it replaces the sword)', () => {
        const ghost = { hasSword: true, hasGhostSword: true };
        const off = driveLane(false, ghost);
        const on = driveLane(true, ghost);
        expect(on.run.progress('inventorySlots')).toEqual([4]);
        expect(on.run.progress('primaryWeapon')).toBe('ghostsword');
        expect(on.keys).toEqual(off.keys);
        expect(new Set(on.run.ledger('presses').map((p) => p.weapon))).toEqual(new Set(['ghostsword']));
        // a `sword` reading while the ghost is up (the pre-GHOSTSWORD model's) is not a blade ON
        const run = l6(ghost);
        const read = run.progress.bind(run);
        run.progress = (f) => (f === 'primaryWeapon' ? 'sword' : read(f));
        expect(withStrikeSlot(true, () => strikePolicyFor(run))).toBeNull();
        expect(withStrikeSlot(false, () => strikePolicyFor(run))).not.toBeNull();
        expect([['sword', {}], ['sword', { hasGhostSword: true }], ['ghostsword', { hasGhostSword: true }],
            ['fire', {}], ['wand', {}], ['spear', {}], [null, {}]].map(([w, inv]) => pressIsBlade(w, inv)))
            .toEqual([true, false, true, false, false, false, false]);
    });
});
