/**
 * seedlingDemo/hammerPocketBurn.test — ⛓⛓ SEEDLING HAMMER-PHASE POCKET-BURN (`STANCE_BURN`, OFF): the hold stance's
 * prerequisite search offers a `burn` for a burnable tree that shuts the stance (`stancePrerequisite`'s arm (c)).
 *
 * The workload is L40LATCH's latch boot (`fixtures/l40latch-witness/latch-boot.json`) re-booted at (488,579) — the
 * staging point APPROACH and SOUTHDOOR measured on the Boss Key 2 arrival legs — in two shapes:
 *   - POCKET SHUT: the boot's banked `burnabletree@872,784` (its L40 tag 0 persistence row) un-banked, so the tree
 *     stands between (488,579) and `buttonroom@880,768`, the latch `hold(wandlock@480,560)` needs. That is the arrival
 *     legs' wall (SOUTHDOOR §2 row 2), and the run holds Fire (⚖ a plain AP item).
 *   - POCKET OPEN: the boot as committed (tree banked) — no tree on the stance's corridor.
 * The probe is `holdStanceProbe` (read-only; the derivation `resolveHoldStrategy` asks, prerequisites on).
 */
import { describe, expect, it } from 'vitest';

import { l40LatchBoot } from './fidelityL40Latch.js';
import { holdStanceProbe, STANCE_BURN, STANCE_BURN_DEFAULT, withStanceBurn } from './solverBot.js';
import { withDisabledScope } from './strategySwitch.js';

const PRESSER = { x: 880, y: 768 };
const TREE = 'burnabletree@872,784';

/** A run of the latch boot at (488,579), the tree standing (`shut`) or banked. */
async function southRun(shut) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const base = await l40LatchBoot();
    const boot = { ...base, boot: { ...base.boot, x: 480, y: 571 },
        persistence: shut ? base.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) : base.persistence };
    return createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(boot)))), atlasLevelSource());
}

/** `run` with its inventory read as not holding Fire (everything else the run's own). */
function withoutFire(run) {
    return new Proxy(run, {
        get(target, key) {
            if (key === 'progress') {
                return (name) => (name === 'inventory' ? { ...target.progress(name), hasFire: false }
                    : target.progress(name));
            }
            const v = target[key];
            return typeof v === 'function' ? v.bind(target) : v;
        },
    });
}

/** The strategy switch's per-solve scope with `burn` disabled (the shape `parseDisable` builds). */
const NO_BURN = () => ({ asked: ['burn'], key: 'burn', verbs: new Set(['burn']), rungs: new Set(), absent: [],
    hits: {}, first: null });

describe('hammer-phase POCKET-BURN: STANCE_BURN', () => {
    it('ships OFF', () => {
        expect(STANCE_BURN_DEFAULT).toBe(false);
        expect(STANCE_BURN.enabled).toBe(globalThis.process?.env?.SEEDLING_STANCE_BURN === '1');
        const was = STANCE_BURN.enabled;
        expect(withStanceBurn(true, () => STANCE_BURN.enabled)).toBe(true);
        expect(withStanceBurn(false, () => STANCE_BURN.enabled)).toBe(false);
        expect(STANCE_BURN.enabled).toBe(was);
    });

    it('pocket shut: OFF refuses the stance and names no burn; ON offers the tree\'s burn at (888,776); no Fire or '
        + '`burn` disabled = OFF', async () => {
        const run = await southRun(true);
        expect(run.progress('inventory').hasFire).toBe(true);
        const off = withStanceBurn(false, () => holdStanceProbe(run, PRESSER));
        expect(off.stance).toBeNull();
        expect(off.refusal).toMatch(/^solverBot: no REACHABLE stance inside buttonroom@880,768 in level 40 — 1 cell\(s\) /);
        expect(off.refusal).toContain('none of them plans a corridor from (488,579)');
        expect(off.refusal).toContain('pushableblock@576,560 (no shove of it plans the corridor).');
        expect(off.refusal).not.toContain('burnabletree');

        const on = withStanceBurn(true, () => holdStanceProbe(run, PRESSER));
        expect(on.refusal).toBeNull();
        expect(on.stance).toEqual({ x: 888, y: 776 });
        expect(on.prerequisite).toEqual({ id: TREE, kind: 'solid', tag: 'burnabletree', via: 'burn',
            why: expect.stringContaining(`once ${TREE} is burnt: the run holds Fire`) });

        // ⛔ no Fire held: nothing is offered, and the refusal is OFF's word for word
        expect(withStanceBurn(true, () => holdStanceProbe(withoutFire(run), PRESSER))).toEqual(off);
        // ⛔ the strategy switch's `burn` disabled: the offer is behind the gate, so OFF's refusal again
        expect(withDisabledScope(NO_BURN(), () => withStanceBurn(true, () => holdStanceProbe(run, PRESSER))))
            .toEqual(off);
    }, 120000);

    it('pocket open (no tree on the corridor): ON = OFF, the stance reached directly with no prerequisite', async () => {
        const run = await southRun(false);
        const off = withStanceBurn(false, () => holdStanceProbe(run, PRESSER));
        const on = withStanceBurn(true, () => holdStanceProbe(run, PRESSER));
        expect(off).toEqual({ stance: { x: 888, y: 776 }, prerequisite: null, refusal: null });
        expect(on).toEqual(off);
    }, 60000);
});
