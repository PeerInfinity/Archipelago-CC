/**
 * seedling-fidelity-l40res (wave 29) — L40's wandlock-hold residues after WANDHOLD.
 *
 * ⛓ D2 (survey step 93, `Totem Part 64,144` from the L39 teleporter, (488,904)). The frontier names
 * `wandlock@448,432` (group 2) nearest the aim. Its opener `button@480,384` stands INSIDE the room it shuts, and the
 * hold stance (488,392) was derived reachable under the stance hypothesis THROUGH the room's south door
 * `wandlock@480,560` (group 3; `buttonroom@880,768` latches, so that door is in the hypothesis, while group 2 is guard
 * (iii)'s weigh-wall and is not). The walk to the stance then named `wandlock@448,432` again: STANCE_REENTRY.
 * `stanceReentryNextDoor` (OFF) walks on along the frontier instead. The south door's hold refuses by name (its
 * presser is behind `chest@880,816` and `burnabletree@872,784`), and the chest is this round's order: the first link
 * of the room's real chain. The new end is the chest walk's danger ladder, `kill (spinner@880,848) by press` (the
 * hammer arc's region, handed over).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { SolverRefusal, stanceHypothesisProbe } from './solverBot.js';
import { createRunForStaging } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'l40res-witness', `${n}.json`), 'utf8'));

const STEP93_GOAL = Object.freeze({ kind: 'collect-placement', placement: { x: 64, y: 144 },
    why: 'Level 040 - Totem Part 64,144', location: 'Level 040 - Totem Part 64,144' });

/** Survey step 93's boot (the survey's own staged block at L40@480,896), solved for the part alone. */
async function solveStep93() {
    const staging = fixture('step93-boot');
    const levelSource = atlasLevelSource();
    try {
        await twoPassSolve({
            makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
            goals: [STEP93_GOAL], name: 'l40res', boot: staging.boot, dashMode: 'all',
            persistence: staging.persistence, log: () => {},
        });
    } catch (e) {
        if (e instanceof SolverRefusal) return e;
        throw e;
    }
    return null;
}

describe('L40RES D2 — a stance walk that re-enters its own order walks on along its frontier', () => {
    it('the switch is OFF by default', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.stanceReentryNextDoor).toBe(false);
    });

    it('the measurement behind it: the south door is in the stance hypothesis, the west door is not', () => {
        const run = createRunForStaging(fixture('step93-boot'), atlasLevelSource());
        const h = stanceHypothesisProbe(run);
        expect(h).toContainEqual({ id: 'wandlock@480,560', kind: 'activator', strategy: 'hold' });
        expect(h.map((r) => r.id)).not.toContain('wandlock@448,432');
        expect(h.map((r) => r.id)).not.toContain('wandlock@512,480');
    });

    it('OFF: survey step 93 refuses STANCE_REENTRY at the west door, the survey\'s text', async () => {
        const e = await withContactFidelity({ stanceReentryNextDoor: false }, solveStep93);
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toContain('-> hold stance (wandlock@448,432): STANCE_REENTRY — the walk to '
            + 'wandlock@448,432\'s `hold` stance (488,392) is itself blocked by wandlock@448,432 at tick 0');
    }, 120_000);

    it('ON: the re-entry passes to the chest (the south door\'s chain); the end is the chest walk\'s press kill', async () => {
        const e = await withContactFidelity({ stanceReentryNextDoor: true }, solveStep93);
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).not.toContain('STANCE_REENTRY');
        expect(e.message).toContain('-> hold stance (wandlock@448,432) -> chest stance (chest@880,816) '
            + '-> kill (spinner@880,848) by press: the player died at t1266 (chaser bob@736,752)');
    }, 300_000);
});
