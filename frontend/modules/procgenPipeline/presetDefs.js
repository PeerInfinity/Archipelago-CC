/**
 * Preset definitions + pure capture/apply helpers for the Procgen
 * Pipeline panel's preset drop-down (rendered by procgenPipelineUI.js).
 *
 * A preset's `state` is the SAME bundle _saveToLocalStorage persists —
 * { mode, params, scenario, substrateMix, substrateQuotas,
 *   substrateMode } — so applying a preset and restoring the auto-saved
 * session share one normalisation path (applyPresetState). `params`
 * may be SPARSE: apply merges it over the panel's merged defaults
 * (defaultProcgenParams), so a preset pins only what it means to pin
 * and picks up new substrate default keys automatically.
 *
 * Shipped presets live in SHIPPED_PRESETS below (this file is imported
 * by the panel — it is NOT a separate frontend module, so no
 * init-bundled registration). User presets persist via
 * loadUserPresets/saveUserPreset/deleteUserPreset under LS_PRESETS_KEY,
 * deliberately separate from the panel's auto-save key so applying or
 * editing never mutates the preset library itself.
 *
 * Pure logic only (storage passed in, no DOM/module singletons) so the
 * helpers are unit-testable in plain node.
 */

export const LS_PRESETS_KEY = 'procgenPipeline_presets';

// The panel's pipeline modes (procgenPipelineUI.js mode radio +
// _loadFromLocalStorage validation share this list via applyPresetState).
export const VALID_MODES = ['gridGrowth', 'sphereGrowth', 'shuffledSpiral', 'topDown'];

/**
 * Shipped presets. Both are fixture-backed known-good configs:
 *
 * - runner-sphere-demo mirrors the committed runner_sphere_worldgen
 *   preset (runner phase 9d): dump-sphere-growth.js --seed 1
 *   --quota runner=99 --start runner with the Double Jump /
 *   Blue Platforms / Victory pool — 3 spheres, 3 regions, oracle-clean,
 *   bot-verified end to end by verify-runner-embed.mjs. The runner
 *   difficulty knobs are pinned at the values that world was generated
 *   with, so the preset keeps reproducing it even if the runner
 *   defaults ever move.
 *
 * - bounce-sphere-demo is the config verify-sphere-growth-ui.mjs /
 *   verify-sphere-steps-ui.mjs pre-seed the panel with. Bounce knobs
 *   are deliberately NOT pinned: those gates run on the live bounce
 *   defaults, so the preset should follow them too.
 */
export const SHIPPED_PRESETS = Object.freeze([
    {
        id: 'shipped:runner-sphere-demo',
        label: 'Runner demo (sphere growth)',
        description: 'Runner-only 3-sphere world — the committed '
            + 'runner_sphere_worldgen config: seed 1, Double Jump / '
            + 'Blue Platforms / Victory, quota runner=99, start runner, '
            + 'celeste physics.',
        state: {
            mode: 'sphereGrowth',
            params: {
                seed: 1,
                regionWidth: 8,
                regionHeight: 6,
                maxItemsPerRegion: 2,
                sphereCount: 3,
                fillerCount: 0,
                revisitPercent: 25,
                startSubstrate: 'runner',
                runnerPhysicsProfile: 'celeste',
                runnerGapMargin: 0,
                runnerHazardDensity: 0.35,
                runnerLengthSteps: 2,
            },
            scenario: {
                items: { 'Double Jump': 1, 'Blue Platforms': 1, Victory: 1 },
                obstacles: {},
            },
            substrateQuotas: { runner: 99 },
            substrateMix: {},
            substrateMode: 'quotas',
        },
    },
    {
        id: 'shipped:bounce-sphere-demo',
        label: 'Bounce demo (sphere growth)',
        description: 'Bounce-only 3-sphere world — the '
            + 'verify-sphere-growth-ui config: seed 1, the 7-item bounce '
            + 'pool, quota bounce=99.',
        state: {
            mode: 'sphereGrowth',
            params: {
                seed: 1,
                regionWidth: 8,
                regionHeight: 6,
                maxItemsPerRegion: 2,
                sphereCount: 3,
                fillerCount: 0,
                revisitPercent: 25,
                startSubstrate: 'auto',
            },
            scenario: {
                items: {
                    'Right arrow': 1,
                    'Left arrow': 1,
                    Springs: 1,
                    Jetpacks: 1,
                    'Blue platforms': 1,
                    'Brown platforms': 1,
                    Victory: 1,
                },
                obstacles: {},
            },
            substrateQuotas: { bounce: 99 },
            substrateMix: {},
            substrateMode: 'quotas',
        },
    },
]);

/**
 * Snapshot a panel-shaped object's preset-relevant state as a
 * JSON-safe deep copy (the bundle round-trips through localStorage, so
 * everything in it is JSON-serialisable by construction).
 */
export function capturePresetState({
    mode, params, scenario, substrateMix, substrateQuotas, substrateMode,
}) {
    return JSON.parse(JSON.stringify({
        mode, params, scenario, substrateMix, substrateQuotas, substrateMode,
    }));
}

/**
 * Normalise a preset/persisted state bundle into full panel state.
 * Mirrors (and now backs) the panel's _loadFromLocalStorage rules:
 *
 * - `params` present → merged over `defaults` (sparse presets pick up
 *   panel + substrate default keys); absent → `current.params`.
 * - `scenario` present → deep-copied with items/obstacles defaulting
 *   to {}; absent → `current.scenario`.
 * - `substrateMix`/`substrateQuotas` are ALWAYS rebuilt, dropping
 *   entries whose substrate isn't registered (`hasSubstrate`) or whose
 *   value isn't > 0 — a missing dict comes back empty.
 * - `substrateMode`/`mode` only apply when valid; otherwise the
 *   `current` value is kept.
 *
 * Pure: returns a new state object, mutates nothing.
 */
export function applyPresetState(state, { defaults, hasSubstrate, current }) {
    const filterDict = (raw) => {
        const out = {};
        if (raw && typeof raw === 'object') {
            for (const [id, v] of Object.entries(raw)) {
                if (hasSubstrate(id) && v > 0) out[id] = v;
            }
        }
        return out;
    };
    return {
        params: state?.params
            ? { ...defaults, ...state.params }
            : current.params,
        scenario: state?.scenario
            ? {
                items: { ...(state.scenario.items ?? {}) },
                obstacles: { ...(state.scenario.obstacles ?? {}) },
            }
            : current.scenario,
        substrateMix: filterDict(state?.substrateMix),
        substrateQuotas: filterDict(state?.substrateQuotas),
        substrateMode: (state?.substrateMode === 'quotas' || state?.substrateMode === 'mix')
            ? state.substrateMode
            : current.substrateMode,
        mode: VALID_MODES.includes(state?.mode) ? state.mode : current.mode,
    };
}

/** Resolve a preset id against the shipped list + a user preset array. */
export function getPresetById(id, userPresets = []) {
    return SHIPPED_PRESETS.find((p) => p.id === id)
        ?? userPresets.find((p) => p.id === id)
        ?? null;
}

/** Stable id for a user preset name (same name ⇒ same id ⇒ overwrite). */
export function userPresetId(label) {
    const slug = String(label).toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `user:${slug}`;
}

/**
 * Load the user preset array from `storage` (a localStorage-like
 * object). Malformed/missing data → []. Entries without a usable
 * id/label/state are dropped.
 */
export function loadUserPresets(storage) {
    try {
        const raw = storage.getItem(LS_PRESETS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.presets)) return [];
        return parsed.presets.filter((p) => typeof p?.id === 'string'
            && typeof p?.label === 'string'
            && p?.state && typeof p.state === 'object');
    } catch (e) {
        return [];
    }
}

/**
 * Save (or overwrite, on name collision) a user preset. Returns
 * { presets, id } — the updated array plus the saved preset's id — or
 * null when the label is blank. Persists to `storage`.
 */
export function saveUserPreset(storage, label, state) {
    const trimmed = String(label ?? '').trim();
    if (!trimmed) return null;
    const id = userPresetId(trimmed);
    if (id === 'user:') return null;
    const presets = loadUserPresets(storage).filter((p) => p.id !== id);
    presets.push({ id, label: trimmed, state });
    storage.setItem(LS_PRESETS_KEY, JSON.stringify({ version: 1, presets }));
    return { presets, id };
}

/** Delete a user preset by id. Returns the updated array. */
export function deleteUserPreset(storage, id) {
    const presets = loadUserPresets(storage).filter((p) => p.id !== id);
    storage.setItem(LS_PRESETS_KEY, JSON.stringify({ version: 1, presets }));
    return presets;
}
