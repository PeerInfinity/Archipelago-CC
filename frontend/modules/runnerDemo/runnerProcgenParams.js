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
    };
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

    const physRow = document.createElement('div');
    physRow.className = 'procgen-pipeline-field';
    const physLabel = document.createElement('label');
    physLabel.textContent = 'Physics profile';
    physLabel.title = 'Logic-affecting: access rules derive from the profile\'s physics, '
        + 'and the profile is stamped into every runner payload. Profiles that saturate '
        + 'the calibration sweep cannot host physics gates (double-jump / blue-platform '
        + 'gaps are vetoed there).';
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
    physRow.appendChild(physLabel);
    physRow.appendChild(physSelect);
    wrap.appendChild(physRow);

    const numberField = (labelText, title, key, def, { step = 1, max = null } = {}) => {
        const r = document.createElement('div');
        r.className = 'procgen-pipeline-field';
        const l = document.createElement('label');
        l.textContent = labelText;
        l.title = title;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = String(step); // without this the browser rejects non-integers
        if (max != null) input.max = String(max);
        input.value = String(params[key] ?? def);
        input.addEventListener('change', () => {
            let v = Number(input.value);
            if (!Number.isFinite(v) || v < 0) v = def;
            if (max != null) v = Math.min(v, max);
            params[key] = v;
            input.value = String(v);
            onChange();
        });
        r.appendChild(l);
        r.appendChild(input);
        return r;
    };
    wrap.appendChild(numberField('Gap margin',
        'How close plain run gaps sit to the max grounded jump (0–1). 0 = the calibrated '
        + 'default window; 1 = gaps up to the 0.75×reach structural cap. Gate windows '
        + 'never move.',
        'runnerGapMargin', 0, { step: 0.01, max: 1 }));
    wrap.appendChild(numberField('Hazard density',
        'Spike-patch probability per eligible plain floor (0–1). Spiked floors always '
        + 'get a flush partner floor.',
        'runnerHazardDensity', 0.35, { step: 0.01, max: 1 }));
    wrap.appendChild(numberField('Length steps',
        'Max plain floors between features (1 + random·N) — longer strips per region.',
        'runnerLengthSteps', 2, { step: 1, max: 8 }));
    wrap.appendChild(numberField('Jitter',
        'Vertical placement jitter (0–1): plain floors rise up to jitter × 1.2 units '
        + 'above the base line. Gates and branch tips stay flat — gap windows never move.',
        'runnerJitter', 0, { step: 0.01, max: 1 }));
    wrap.appendChild(numberField('Splits',
        'Split-segment probability per plains slot (0–1): a rising ramp forks into a '
        + 'one-way top lane (jump) over a bottom lane (no jump / drop), merging where '
        + 'the lane ends. Route texture only — requirements never change.',
        'runnerSplitChance', 0, { step: 0.01, max: 1 }));
    wrap.appendChild(numberField('Ceiling hazards',
        'Ceiling-hazard probability per plains slot (0–1): a kill slab hung over its '
        + 'own short gap — full jumps clip it, short holds cross underneath. Difficulty '
        + 'texture only — requirements never change. Some physics profiles have no '
        + 'safe ceiling window and skip these.',
        'runnerCeilingDensity', 0, { step: 0.01, max: 1 }));
    return wrap;
}
