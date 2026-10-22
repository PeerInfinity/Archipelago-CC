/**
 * seedling-fidelity-ropestance — the `rope` verb's SPEAR and FIRE cuts (`CONTACT_FIDELITY.ropeCutAnyWeapon`): the
 * solver's own plans for a `clear-tag` on a rope's tag with no sword, the staging they boot from (`fidelityRope`'s,
 * `r9-solve-16`'s seam), and the model's samples. Shared by `scripts/procgen/probe-seedling-rope-stance.mjs` (plays
 * them on the game, `--record`) and `fidelityRopeStance.test.js` (replays the recordings against the model at 0 px).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDLE_TAIL, ropeStaging } from './fidelityRope.js';

export { compareWitness, modelSamples } from './fidelityRope.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const ROPESTANCE_WITNESS_DIR = join(HERE, 'fixtures', 'ropestance-witness');

/** The switches every plan is made under (the verb, and this slice's weapons). */
export const ROPESTANCE_SWITCHES = Object.freeze({ ropeCutVerb: true, ropeCutAnyWeapon: true });

const L16_CUT = { kind: 'clear-tag', tag: { level: 16, tag: 0 }, at: { x: 32, y: 16 }, obstacle: 'rope@32,16' };
const L28_CUT = { kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 }, obstacle: 'rope@160,64' };
const FROM_L15 = { level: 16, x: 32, y: 64 };
const FROM_L25 = { level: 28, x: 96, y: 16 };
/**
 * A stand EAST of `rope@160,64` (the player at (240,72)), out of both drills' reach. From the L25 arrival the only
 * spear stances are on rows 4-5 within `drill@128,96`'s run range, and that drill is not stepped by the model (two drills
 * and a bobsoldier share the room) — measured on p4g: a hop and a hit at t59 the model never saw. So the solver refuses
 * the spear there by name (`solverBot.unsteppedDrills`, the interim) and the spear's L28 cut is witnessed from here.
 */
const L28_EAST = { level: 28, x: 232, y: 64 };

/**
 * The witnesses: L16 from the L15 side (the user's stance region, r1c9 west) and L28 from the L25 arrival, each with the
 * Spear alone and with Fire alone (selected: a lone item is slot 0; L28's spear from the stand east of the rope, see
 * `L28_EAST`); and one with the WAND selected and the Spear held,
 * so the plan selects the spear's slot for the thrust (`equip`) and restores the wand's.
 */
export const ROPESTANCE_WITNESSES = Object.freeze([
    Object.freeze({ name: 'ropestance-l16-spear', boot: FROM_L15, items: ['hasSpear'], persistence: [],
        goals: [L16_CUT], weapon: 'spear', flags: [0], to: 16 }),
    Object.freeze({ name: 'ropestance-l16-fire', boot: FROM_L15, items: ['hasFire'], persistence: [],
        goals: [L16_CUT], weapon: 'fire', flags: [0], to: 16 }),
    Object.freeze({ name: 'ropestance-l28-spear-east', boot: L28_EAST, items: ['hasSpear'], persistence: [],
        goals: [L28_CUT], weapon: 'spear', flags: [0, 1], to: 28 }),
    Object.freeze({ name: 'ropestance-l28-fire', boot: FROM_L25, items: ['hasFire'], persistence: [],
        goals: [L28_CUT], weapon: 'fire', flags: [0, 1], to: 28 }),
    Object.freeze({ name: 'ropestance-l28-wand-spear-east', boot: L28_EAST, items: ['hasWand', 'hasSpear'], persistence: [],
        goals: [L28_CUT], weapon: 'spear', flags: [0, 1], to: 28 }),
]);

/** The solver's plan (both switches ON) and its tape. */
export async function ropeStancePlan(w) {
    const { atlasLevelSource } = await import('./levelSource.js');
    const { twoPassSolve } = await import('./twoPassSolve.js');
    const { createRunForStaging } = await import('./tapeRunner.js');
    const { withContactFidelity } = await import('./contactFidelity.js');
    const { buildStagedTape } = await import('./botDriverV1.js');
    const staging = await ropeStaging(w);
    const levelSource = atlasLevelSource();
    const solved = await withContactFidelity(ROPESTANCE_SWITCHES, () => twoPassSolve({
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
    return { staging, solved, tape: { ...tape, description: 'seedling-fidelity-ropestance: the solver\'s `rope` plan '
        + `for ${w.goals.map((g) => g.obstacle).join(' then ')} with the ${w.weapon} (probe-seedling-rope-stance.mjs)` } };
}
