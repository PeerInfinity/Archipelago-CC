/**
 * Runner ↔ procgen-pipeline integration: the substrate's procgen
 * parameters and its regionParams contribution (bounceProcgenParams.js
 * is the model; assembled centrally by sphereConfigHooks.js).
 *
 * Three of bounce's four adapter hooks — runner has no
 * prepareSphereGrowth (nothing to contribute pre-plan: no free-item
 * analog of bounce's arrow):
 *
 *   - defaultProcgenParams  — the panel merges this into its defaults.
 *   - buildRegionParams     — assembles the substrate's regionParams.
 *   - renderProcgenParams   — the panel's per-substrate param controls.
 *
 * The difficulty/texture knobs (the four v1 knobs of plan §4.9 plus
 * placement jitter + splits and §8.7 step 3's ceilings): gapMargin,
 * hazardDensity, lengthSteps,
 * physicsProfile, jitter, splitChance, ceilingDensity. Keys are
 * runner-prefixed in BOTH params and regionParams: assembleRegionParams
 * merges every active substrate's output into ONE object, so an
 * unprefixed `physicsProfile` would collide with bounce's in a mixed
 * world.
 *
 * Pure logic + call-time DOM only (no top-level document/window
 * access) so headless CLI drivers can import the runner library
 * without pulling in panel code.
 */

import { PROFILES, DEFAULT_PROFILE_ID } from './physics.js';
import { SWEEP_SATURATING_PROFILES } from './generator.js';
import { fieldRow, numberField } from '../procgenCore/regionGenerationForm.js';

// ── Panel parameter defaults ────────────────────────────────────────
// Merged into the Procgen Pipeline panel's DEFAULT_PARAMS via the
// `defaultProcgenParams` registry hook. Values mirror the generator
// defaults so an untouched panel produces byte-identical worlds.
export const DEFAULT_RUNNER_PROCGEN_PARAMS = Object.freeze({
    // Physics profile (runnerDemo/physics.js PROFILES). LOGIC-AFFECTING:
    // access rules derive from the profile's step constants, and the
    // profile is stamped into every runner payload so the world plays
    // under the constants it was generated with. sonic/meatboy saturate
    // the calibration sweep — physics gates are VETOED there
    // (exitGateVeto), so those profiles suit gate-free/mixed worlds only.
    runnerPhysicsProfile: DEFAULT_PROFILE_ID,
    // How close plain run gaps sit to the max grounded jump (0–1):
    // 0 = the calibrated default window, 1 = window max at the
    // 0.75×single-reach structural cap (coyote-aware — the swept reach
    // is coyote-INCLUSIVE, so the cap never spends the coyote window).
    // Gate windows are pinned calibration and never move.
    runnerGapMargin: 0,
    // Spike-patch probability per eligible plain floor (0–1). Every
    // spiked floor gets its flush partner floor by construction.
    runnerHazardDensity: 0.35,
    // Max plain floors between features (1 + rng·N) — the strip-length
    // texture knob.
    runnerLengthSteps: 2,
    // Vertical placement jitter (0–1): plain floors rise up to
    // jitter × JITTER_MAX above the base line. Gate/branch/exit floors
    // stay base-anchored (gap windows are calibrated flat); 0 keeps
    // the generator draw-for-draw identical to the flat layout.
    runnerJitter: 0,
    // Split-segment probability per plains slot (0–1): a rising ramp
    // forks into a one-way top lane (jump) over a base bottom lane
    // (no jump / drop), merging where the lane ends. Requirement-
    // neutral texture; 0 keeps the generator draw-for-draw identical.
    runnerSplitChance: 0,
    // Ceiling-hazard probability per plains slot (0–1): a kill slab
    // hung over its own short gap — full-height jumps clip it, short
    // holds cross underneath (jump modulation, no items). Profiles
    // whose calibration window collapses refuse ceilings; 0 keeps the
    // generator draw-for-draw identical.
    runnerCeilingDensity: 0,
    // Margin of error under ceiling hazards (0–1). 1 (default): gaps
    // narrow to grounded-tap range and the slab clears the grounded-
    // tap apex — a plain short hop pressed before the lip crosses,
    // coyote time is spare forgiveness, never required. 0: expert —
    // gaps widen so only a run-off coyote tap fits under the slab.
    runnerCeilingMargin: 1,
});

// ── regionParams assembly ───────────────────────────────────────────
/**
 * The runner-specific regionParams keys (other substrates ignore
 * unknown keys). Same shape for sphere and top-down modes.
 */
export function buildRunnerRegionParams({ params } = {}) {
    const p = params ?? {};
    return {
        runnerPhysicsProfile: p.runnerPhysicsProfile ?? DEFAULT_PROFILE_ID,
        runnerGapMargin: p.runnerGapMargin ?? 0,
        runnerHazardDensity: p.runnerHazardDensity ?? 0.35,
        runnerLengthSteps: p.runnerLengthSteps ?? 2,
        runnerJitter: p.runnerJitter ?? 0,
        runnerSplitChance: p.runnerSplitChance ?? 0,
        runnerCeilingDensity: p.runnerCeilingDensity ?? 0,
        runnerCeilingMargin: p.runnerCeilingMargin ?? 1,
    };
}

// ── The knobs a payload records (⚖ Q2 C-then-A) ────────────────────
/**
 * What an existing runner payload says about how it was generated, as bag
 * keys (procgenCore/regionGenerationForm.js `bagFromPayload`). Only the
 * physics profile is recorded: runner ALWAYS stamps `params.physics =
 * { profile, constants }`; a payload without it reads as DEFAULT_PROFILE_ID,
 * as runnerLibraryEntry.js's capture does.
 */
export function runnerProcgenParamsFromPayload(payload) {
    return { runnerPhysicsProfile: payload?.params?.physics?.profile ?? DEFAULT_PROFILE_ID };
}

// ── Panel parameter controls ────────────────────────────────────────
/**
 * Render the runner parameter subsection for the Procgen Pipeline
 * panel. Mutates the passed `params` object in place and calls
 * `onChange` after each edit (the panel wires it to its silent
 * localStorage save). Returns a DOM element.
 */
export function renderRunnerProcgenParams({ params, onChange = () => {} } = {}) {
    const wrap = document.createElement('div');

    const physSelect = document.createElement('select');
    for (const profile of Object.values(PROFILES)) {
        const o = document.createElement('option');
        o.value = profile.id;
        o.textContent = SWEEP_SATURATING_PROFILES.includes(profile.id)
            ? `${profile.label} (no physics gates)` : profile.label;
        physSelect.appendChild(o);
    }
    physSelect.value = params.runnerPhysicsProfile ?? DEFAULT_PROFILE_ID;
    physSelect.addEventListener('change', () => {
        params.runnerPhysicsProfile = physSelect.value;
        onChange();
    });
    wrap.appendChild(fieldRow('Physics profile',
        'Logic-affecting: access rules derive from the profile\'s physics, '
        + 'and the profile is stamped into every runner payload. Profiles that saturate '
        + 'the calibration sweep cannot host physics gates (double-jump / blue-platform '
        + 'gaps are vetoed there).',
        physSelect));

    wrap.appendChild(numberField(params, {
        key: 'runnerGapMargin', label: 'Gap margin',
        title: 'How close plain run gaps sit to the max grounded jump (0–1). 0 = the calibrated '
        + 'default window; 1 = gaps up to the 0.75×reach structural cap. Gate windows '
        + 'never move.',
        def: 0, step: 0.01, max: 1,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'runnerHazardDensity', label: 'Hazard density',
        title: 'Spike-patch probability per eligible plain floor (0–1). Spiked floors always '
        + 'get a flush partner floor.',
        def: 0.35, step: 0.01, max: 1,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'runnerLengthSteps', label: 'Length steps',
        title: 'Max plain floors between features (1 + random·N) — longer strips per region.',
        def: 2, step: 1, max: 8,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'runnerJitter', label: 'Jitter',
        title: 'Vertical placement jitter (0–1): plain floors rise up to jitter × 1.2 units '
        + 'above the base line. Gates and branch tips stay flat — gap windows never move.',
        def: 0, step: 0.01, max: 1,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'runnerSplitChance', label: 'Splits',
        title: 'Split-segment probability per plains slot (0–1): a rising ramp forks into a '
        + 'one-way top lane (jump) over a bottom lane (no jump / drop), merging where '
        + 'the lane ends. Route texture only — requirements never change.',
        def: 0, step: 0.01, max: 1,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'runnerCeilingDensity', label: 'Ceiling hazards',
        title: 'Ceiling-hazard probability per plains slot (0–1): a kill slab hung over its '
        + 'own short gap — full jumps clip it, short holds cross underneath. Difficulty '
        + 'texture only — requirements never change. Some physics profiles have no '
        + 'safe ceiling window and skip these.',
        def: 0, step: 0.01, max: 1,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'runnerCeilingMargin', label: 'Ceiling margin',
        title: 'Margin of error under ceiling hazards (0–1). 1 (default): a plain short hop '
        + 'pressed before the lip crosses — no coyote-time tricks needed. 0: expert — '
        + 'gaps widen so only a late run-off tap fits under the slab. Mid and full '
        + 'jumps are punished at every setting.',
        def: 1, step: 0.01, max: 1,
    }, onChange));
    return wrap;
}
