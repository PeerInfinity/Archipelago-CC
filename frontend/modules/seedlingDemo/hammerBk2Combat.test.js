/**
 * seedlingDemo/hammerBk2Combat.test — ⛓⛓ SEEDLING HAMMER-PHASE BK2COMBAT (`CHASER_STAGED_HUNT`, OFF): the kill rung's
 * chaser arm, when it prices no stance, asks again from a cell it certified safe to wait in (`stagedChaserHunt`).
 *
 * The fast rows are the switch's shape, where it sits, and what `deriveKillByChaser` hands it. The workload is
 * L40LATCH's latch boot (`fixtures/l40latch-witness/latch-boot.json`) re-booted into L40's one-tile corridor at
 * (784,856), the pocket SHUT (the boot's banked `burnabletree@872,784` un-banked — the Boss Key 2 arrival legs'
 * shape), asked for `bobsoldier@880,832` with the burn's stance (888,824) as the aim: the BobSoldier stays in its notch,
 * so the three cells west of it are refused because it never comes, and those are the staging cells.
 * The chain itself (the staged kill, hitless, and where the refusal goes next) is `hammerBk2Combat.slow.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { l40LatchBoot } from './fidelityL40Latch.js';
import {
    CHASER_STAGED_HUNT, CHASER_STAGED_HUNT_COUNTS, CHASER_STAGED_HUNT_DEFAULT, deriveKillByChaser,
    resetChaserStagedHuntCounts, withChaserStagedHunt,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const BODY = 'bobsoldier@880,832';
const AIM = { x: 888, y: 824 };
const SRC = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');

/** A run of the latch boot in the corridor at (784,856), the pocket shut, one still tick in. */
async function corridorRun() {
    const { parseTape } = await import('./tapeFormat.js');
    const { buildTape, DEFAULT_TOLERANCE } = await import('./botDriverV1.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const base = await l40LatchBoot();
    const boot = { ...base, boot: { ...base.boot, x: 776, y: 848 },
        persistence: base.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) };
    const folded = buildTape([new Set()], boot.boot, 'bk2combat',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = parseTape(JSON.stringify({ ...boot, name: 'bk2combat', tick_count: 1, inputs: folded.inputs,
        equips: [] }));
    let run = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next());
    return { run, tolerance: DEFAULT_TOLERANCE };
}

describe('hammer-phase BK2COMBAT: CHASER_STAGED_HUNT', () => {
    it('ships OFF', () => {
        expect(CHASER_STAGED_HUNT_DEFAULT).toBe(false);
        expect(CHASER_STAGED_HUNT.enabled).toBe(globalThis.process?.env?.SEEDLING_CHASER_STAGED_HUNT === '1');
        const was = CHASER_STAGED_HUNT.enabled;
        expect(withChaserStagedHunt(true, () => CHASER_STAGED_HUNT.enabled)).toBe(true);
        expect(withChaserStagedHunt(false, () => CHASER_STAGED_HUNT.enabled)).toBe(false);
        expect(CHASER_STAGED_HUNT.enabled).toBe(was);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CHASER_STAGED_HUNT');
        resetChaserStagedHuntCounts();
        expect(CHASER_STAGED_HUNT_COUNTS).toEqual({ asks: [] });
    });

    it('sits inside the kill rung\'s chaser arm (the strategy switch\'s `kill` gate), after the arm\'s own ask', () => {
        const gate = SRC.indexOf('if (killRungArmRuns(run, target, hit) && rungGate(\'kill\')) {');
        const first = SRC.indexOf('const firstHunt = swordless');
        const staged = SRC.indexOf('stagedChaserHunt(hunted, firstHunt, ');
        expect(gate).toBeGreaterThan(0);
        expect(first).toBeGreaterThan(gate);
        expect(staged).toBeGreaterThan(first);
        // one call site, and nothing between the gate and it opens another rung
        expect(SRC.split('stagedChaserHunt(hunted, ').length).toBe(2);
        expect(SRC.slice(gate, staged)).not.toMatch(/progressRung\(/);
        // the switch is read where the arm's answer is built (no `waits` OFF) — the closure asks only on `waits`
        expect(SRC).toMatch(/const hunt = !firstHunt\.stance && firstHunt\.waits\?\.length > 0\n/);
        expect(SRC).toMatch(/\.\.\.\(CHASER_STAGED_HUNT\.enabled \? \{ waits: rejected\.filter\(/);
    });

    it('OFF: deriveKillByChaser carries no `waits`; ON: the same answer plus the cells the body never came to, '
        + 'nearest last', async () => {
        const { run, tolerance } = await corridorRun();
        expect([run.state.x, run.state.y]).toEqual([784, 856]);
        const ask = () => deriveKillByChaser(run, { id: BODY }, new Set(), { aim: AIM, tolerance });
        const off = withChaserStagedHunt(false, ask);
        const on = withChaserStagedHunt(true, ask);
        expect(off.stance).toBeNull();
        expect(off).not.toHaveProperty('waits');
        expect(off.why).toContain(`no stance derives for ${BODY} on level 40`);
        expect(off.why).toContain(`(856,856): ${BODY} is still standing after the whole 77-tick ceiling`);
        const { waits, ...rest } = on;
        expect(rest).toEqual(off);
        expect(waits.map((w) => [w.x, w.y, w.ceiling])).toEqual([[824, 856, 115], [840, 856, 96], [856, 856, 77]]);
        // the arm stages nearest the body first: (856,856), 34.9 px off its centre
        expect([...waits].sort((a, b) => a.d - b.d)[0]).toMatchObject({ x: 856, y: 856 });
    }, 120000);
});
