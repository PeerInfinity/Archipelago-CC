/**
 * ⛓⛓⛓ seedling-fidelity-rockbutton (wave 41): A LANDED FALLROCK IS A SOLID THAT HOLDS A BUTTON DOWN
 * (`CONTACT_FIDELITY.fallRockHoldsButton`, OFF).
 *
 * The game witnesses (`fixtures/rockbutton-witness/`, p4g, `probe-seedling-rock-button.mjs --record`) are replayed on the
 * model: ON, all three at 0 px with L28's flags on their ticks; OFF, the walk and the live fall diverge where the lock
 * opens. See `fidelityRockButton.js` for the three tapes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { L28, ROCKBUTTON_WITNESS_DIR, compareRockButton, rockButtonModelSamples } from './fidelityRockButton.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { solveSegment, SolverRefusal, withRestingHolder } from './solverBot.js';

const ON = { fallRockHoldsButton: true };
const OFF = { fallRockHoldsButton: false };
const fixture = (name) => JSON.parse(readFileSync(join(ROCKBUTTON_WITNESS_DIR, `${name}.json`), 'utf8'));
const compared = async (name, over) => {
    const w = fixture(name);
    const m = await rockButtonModelSamples(w.tape, over);
    return { w, m, bad: compareRockButton(w.samples, m.samples) };
};
const lockT = (m) => m.ledger.writes.find((x) => x.tag === L28.lock.tag)?.t ?? null;
const bootRun = (cleared) => createRunForStaging(arrivalStaging({ level: 28, x: 128, y: 288 },
    { items: ['hasSword'], cleared }), atlasLevelSource());

describe('ROCKBUTTON D1 — `fallRockHoldsButton` (ON since the flip, ⚖ user 2026-11-12)', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_FALL_ROCK_HOLDS_BUTTON)(
        'ships ON (⚖ user 2026-11-12, the ROCKBUTTON flip) and LAST; its env name is a known worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.fallRockHoldsButton).toBe(true);
            expect(CONTACT_FIDELITY.fallRockHoldsButton).toBe(true);
            expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).at(-1)).toBe('fallRockHoldsButton');
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FALL_ROCK_HOLDS_BUTTON');
        });

    it('the recordings are the p4g game\'s, by this slice\'s probe', () => {
        for (const name of ['rockbutton-l28-walk', 'rockbutton-l28-control', 'rockbutton-l28-livefall']) {
            const w = fixture(name);
            expect(w.page).toBe('seedling_bot_ap_p4g');
            expect(w.recordedBy).toBe('scripts/procgen/probe-seedling-rock-button.mjs --record');
            expect(w.samples.length).toBe(w.tape.tick_count);
        }
    });

    it('the GAME: the rock booted fallen holds the button — the lock writes {28,2} at t102 and the walk crosses it, 0 hits',
        () => {
            const w = fixture('rockbutton-l28-walk');
            expect(w.samples.find((s) => s.cleared.includes(2)).t).toBe(102);
            expect(Math.min(...w.samples.map((s) => s.y))).toBeCloseTo(191.709, 3);
            expect(w.samples.every((s) => !s.hits)).toBe(true);
            const c = fixture('rockbutton-l28-control');
            expect(c.samples.some((s) => s.cleared.includes(2))).toBe(false);
            expect(Math.min(...c.samples.map((s) => s.y))).toBeCloseTo(226.042, 3);
        });

    it('the GAME: a rock cut down IN PLAY presses through its frozen span — {28,2} at t166, ten live ticks after the cut',
        () => {
            const w = fixture('rockbutton-l28-livefall');
            const first = (tag) => w.samples.find((s) => s.cleared.includes(tag)).t;
            expect([first(0), first(1), first(2)]).toEqual([156, 156, 166]);
        });

    it('ON: all three witnesses reproduce at 0 px (player, level, hits, L28 flags)', async () => {
        for (const name of ['rockbutton-l28-walk', 'rockbutton-l28-control', 'rockbutton-l28-livefall']) {
            const { bad } = await compared(name, ON);
            expect(bad, name).toEqual([]);
        }
    });

    it('ON: the lock writes at t101 (boot fallen) and t165 (the pull at t155, the span stepped to its last frame but one)',
        async () => {
            expect(lockT((await compared('rockbutton-l28-walk', ON)).m)).toBe(101);
            expect(lockT((await compared('rockbutton-l28-control', ON)).m)).toBe(null);
            const live = (await compared('rockbutton-l28-livefall', ON)).m;
            expect(live.ledger.rockFalls.map((f) => [f.id, f.t, f.deadFrames])).toEqual([[L28.rock.id, 155, 181]]);
            expect(lockT(live)).toBe(165);
        });

    it('OFF: byte-identical to the base — the button reads up, the lock never opens, the walk stalls at 226.04', async () => {
        const walk = await compared('rockbutton-l28-walk', OFF);
        expect(lockT(walk.m)).toBe(null);
        expect(Math.min(...walk.m.samples.map((s) => s.y))).toBeCloseTo(226.042, 3);
        expect(walk.bad.length).toBe(96);
        expect(walk.bad[0]).toMatch(/^t 102: player game/);
        const live = await compared('rockbutton-l28-livefall', OFF);
        expect(lockT(live.m)).toBe(null);
        expect(live.bad.length).toBe(164);
        expect((await compared('rockbutton-l28-control', OFF)).bad).toEqual([]);
    });

    it('the boot read: ON `button@112,240` is down from t0 (the rock booted fallen); OFF it is up', () => {
        for (const [over, down] of [[ON, true], [OFF, false]]) {
            withContactFidelity(over, () => {
                const run = bootRun([0, 1]);
                expect(run.activatorsNow.pressers.find((p) => p.id === L28.button.id).down).toBe(down);
            });
        }
        withContactFidelity(ON, () => {
            expect(bootRun([]).activatorsNow.pressers.find((p) => p.id === L28.button.id).down).toBe(false);
        });
    });

    /**
     * ⛓ HAND-OVER TO HAMMER (pinned so the move is seen, re-pinned by hammer): ON, the model opens the lock at t101 with
     * no input, but the solver still refuses at t0 — `stanceHypothesis` asks `deriveWeighSource` for a block onto the
     * button and never reads that a landed rock already holds it (the solver's wait; not this slice's region).
     *
     * ⛓ RE-PINNED by hammer ROCK-HOLDER-WAIT (`RESTING_HOLDER`, `SEEDLING_RESTING_HOLDER`): the wait landed behind its
     * own switch, OFF. Old: "ON, the solver still refuses … at the button's stance" (the switch did not exist). New:
     * the same refusal with `RESTING_HOLDER` OFF; with it ON the button's refusal is gone — the solver waits out the
     * fade and crosses the lock (t101), and stops at the room's next wall, the bobsoldier (`hammerRockHolderWait.test.js`).
     */
    it('HAND-OVER (re-pinned): ON, the solver refuses at the button\'s stance with `RESTING_HOLDER` OFF, waits ON', () => {
        const solve = () => {
            const run = bootRun([0, 1]);
            let err = null;
            try {
                solveSegment({ run, goals: [{ kind: 'reach-exit', exit: { x: 304, y: 16 } }], name: 'rockbutton-l28',
                    boot: { level: 28, x: 128, y: 288 } });
            } catch (e) { err = e; }
            return { err, run };
        };
        withContactFidelity(ON, () => {
            const off = withRestingHolder(false, solve);
            expect(off.err).toBeInstanceOf(SolverRefusal);
            expect(off.err.obstacle).toEqual({ kind: 'proximity-hazard', id: L28.button.id });
            const on = withRestingHolder(true, solve);
            expect(on.err?.obstacle).not.toEqual({ kind: 'proximity-hazard', id: L28.button.id });
            expect(on.run.lockWrites.map((w) => [w.id, w.t, w.value])).toEqual([[L28.lock.id, 101, false]]);
        });
    });
});
