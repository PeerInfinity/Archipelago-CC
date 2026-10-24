/**
 * seedling-fidelity-timedpass — THE SOLVER WALKS PAST L28's HOPPING DRILLS (`CONTACT_FIDELITY.drillTimedPass`): the
 * game witnesses' plans and the staging they boot from (`fidelityRope.ropeStaging`). The model's samples, the game
 * poll's fold and the comparison are DRILLKILL's own (`fidelityDrillKill`), so a pass is checked on exactly what a
 * kill is: the player (x, y, level, hits), every drill (x, y, anim, `hits`, `hitsTimer`) and the bobsoldier, every tick.
 * Shared by `scripts/procgen/probe-seedling-timed-pass.mjs` (plays them on the game, `--record`) and
 * `fidelityTimedPass.test.js` (replays the recordings against the model at 0 px).
 *
 *   timedpass-l28-fire-l26   the solver's plan from the L26 arrival with Fire alone: the pass past `drill@80,96` and
 *                            `drill@128,96` to (152,56), then the fire cut of `rope@160,64`
 *   timedpass-l28-fire-l25   the same from the L25 arrival — its walk wakes `drill@128,96`, so it plans a pass too
 */
import { ropeStaging, IDLE_TAIL } from './fidelityRope.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const TIMEDPASS_WITNESS_DIR = join(HERE, 'fixtures', 'timedpass-witness');

/** The switches every witness is planned and replayed under: this slice's key (the rest at their defaults). */
export const TIMEDPASS_SWITCHES = Object.freeze({ drillTimedPass: true });

const L28_CUT = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' });

export const TIMEDPASS_WITNESSES = Object.freeze([
    Object.freeze({ name: 'timedpass-l28-fire-l26', boot: Object.freeze({ level: 28, x: 16, y: 96 }), items: ['hasFire'],
        persistence: [], goals: [L28_CUT] }),
    Object.freeze({ name: 'timedpass-l28-fire-l25', boot: Object.freeze({ level: 28, x: 96, y: 16 }), items: ['hasFire'],
        persistence: [], goals: [L28_CUT] }),
]);

/** The solver's plan (the key ON) for a witness, via `twoPassSolve` as the page solves it (its `forkRun` too). */
export async function timedPassTape(w) {
    const { atlasLevelSource } = await import('./levelSource.js');
    const { twoPassSolve } = await import('./twoPassSolve.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging(w);
    const levelSource = atlasLevelSource();
    const solved = await withContactFidelity(TIMEDPASS_SWITCHES, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.goals, name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
    const tape = buildStagedTape({
        staging: { ...staging, persistence: solved.persistence,
            equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        perTick: [...solved.out.perTick, ...Array.from({ length: IDLE_TAIL }, () => new Set())],
        name: w.name,
    });
    return { staging, solved, tape: { ...tape, description: `seedling-fidelity-timedpass: ${w.name} — the solver's `
        + 'timed pass past the drills, then the rope cut (probe-seedling-timed-pass.mjs)' } };
}
