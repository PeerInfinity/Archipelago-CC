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
 * Shipped presets. All are fixture-backed known-good configs:
 *
 * - runner-sphere-demo extends the committed runner_sphere_worldgen
 *   config (runner phase 9d) with the Springs item (§8.7 step 1):
 *   dump-sphere-growth.js --seed 1 --quota runner=99 --start runner
 *   with the Double Jump / Blue Platforms / Springs / Victory pool —
 *   3 spheres, 3 regions, oracle-clean (CLI-verified; the committed
 *   3-item world stays bot-verified by verify-runner-embed.mjs). The
 *   runner difficulty knobs are pinned at the values that world was
 *   generated with, so the preset keeps reproducing it even if the
 *   runner defaults ever move. Note sphere worlds contain no reward
 *   shelves: the engine's pickups are requirement-free (gates ride
 *   region entries), so no spec window ever elects one — shelves are
 *   the zone-table demo's business.
 *
 * - runner-placement-demo is the sphere demo config with the
 *   placement + texture knobs on (runnerJitter 0.75, runnerSplitChance
 *   0.6, runnerCeilingDensity 0.5, runnerCeilingMargin 1) — the demo
 *   for jittered floors,
 *   split segments (ramp → one-way top lane / bottom lane merge), and
 *   ceiling hazards (§8.7 step 3: kill slabs that punish full-height
 *   jumps). CLI-verified oracle-clean at this exact config.
 *
 * - runner-zone-demo mirrors the committed runner_worldgen preset:
 *   dump-shuffled-spiral.js --seed 1 --quota runner=6 --start runner.
 *   The 6-zone table (5 feature zones + Victory since the Shield,
 *   §4.10) shows the full current runner vocabulary: dj / stone /
 *   spring gates, the glide pad + drop chasm, the shield spike bed,
 *   and reward shelves with saws where the seed elects them
 *   (§8.7 steps 2-5).
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
            + 'runner_sphere_worldgen config plus the Springs item: '
            + 'seed 1, Double Jump / Blue Platforms / Springs / Victory, '
            + 'quota runner=99, start runner, celeste physics.',
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
                runnerJitter: 0,
            },
            scenario: {
                items: {
                    'Double Jump': 1, 'Blue Platforms': 1, Springs: 1, Victory: 1,
                },
                obstacles: {},
            },
            substrateQuotas: { runner: 99 },
            substrateMix: {},
            substrateMode: 'quotas',
        },
    },
    {
        id: 'shipped:runner-placement-demo',
        label: 'Runner demo (jitter + splits + ceilings)',
        description: 'The sphere demo config with the placement and '
            + 'texture knobs turned up: jitter 0.75 (plain floors rise '
            + 'up to ~0.9), splits 0.6 (ramps forking into one-way top '
            + 'lanes over bottom lanes), and ceilings 0.5 (kill slabs '
            + 'over short gaps — full jumps clip them, a plain short '
            + 'hop crosses at the default margin 1). '
            + 'Same 4-item pool, seed 1 — oracle-clean with 5 ceiling '
            + 'slabs, 4 lane segments and 19 raised floors across 3 '
            + 'regions.',
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
                runnerJitter: 0.75,
                runnerSplitChance: 0.6,
                runnerCeilingDensity: 0.5,
                runnerCeilingMargin: 1,
            },
            scenario: {
                items: {
                    'Double Jump': 1, 'Blue Platforms': 1, Springs: 1, Victory: 1,
                },
                obstacles: {},
            },
            substrateQuotas: { runner: 99 },
            substrateMix: {},
            substrateMode: 'quotas',
        },
    },
    {
        id: 'shipped:runner-zone-demo',
        label: 'Runner demo (zone tables)',
        description: 'Runner-only 6-zone shuffled-spiral world — the '
            + 'committed runner_worldgen config: seed 1, quota runner=6, '
            + 'start runner. The zone table mints its own items and '
            + 'shows the full runner vocabulary: dj / stone / spring / glide '
            + 'gates, the shield spike bed (hit budget), and reward '
            + 'shelves with saws under them.',
        state: {
            mode: 'shuffledSpiral',
            params: {
                seed: 1,
                regionWidth: 8,
                regionHeight: 6,
                startSubstrate: 'runner',
                // no runner* difficulty pins: the spiral path serves the
                // library's fixed default zone table (RUNNER_ZONE_SEED,
                // default physics) — those knobs are spec-path-only
            },
            scenario: {
                items: {},
                obstacles: {},
            },
            substrateQuotas: { runner: 6 },
            substrateMix: {},
            substrateMode: 'quotas',
        },
    },
    {
        id: 'shipped:jta-zone-demo',
        label: 'JtA demo (zone tables)',
        description: 'JtA-only 15-zone shuffled-spiral world — one AP '
            + 'region per Journey to Ascension zone (The Village onward), '
            + 'played in the JtA substrate panel with the shared loop-mode '
            + 'energy pool. Zone completion travels between regions; the '
            + 'playback bot / loops queue can drive it.',
        state: {
            mode: 'shuffledSpiral',
            params: {
                seed: 1,
                regionWidth: 8,
                regionHeight: 6,
                startSubstrate: 'jta',
            },
            scenario: {
                items: {},
                obstacles: {},
            },
            substrateQuotas: { jta: 15 },
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
    mode, params, scenario, substrateMix, substrateQuotas, substrateMode, libraries,
}) {
    return JSON.parse(JSON.stringify({
        mode, params, scenario, substrateMix, substrateQuotas, substrateMode,
        // Selected region libraries in the hybrid-persistence shape (served
        // references + inline ad-hoc/edited docs — regionLibraryLoader
        // serializeLibrarySelection). Carried verbatim; the panel resolves
        // served references (async fetch) into growthParams.substrateConfig at
        // generation time. Omitted when empty so existing presets stay unchanged.
        ...(Array.isArray(libraries) && libraries.length ? { libraries } : {}),
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
        // Region-library selection (hybrid persistence). Passed through verbatim
        // — served references stay unresolved here (resolution is an async fetch
        // the panel runs), so unlike substrateQuotas there is no registry filter.
        // A present-but-empty selection clears; absent keeps `current`.
        libraries: Array.isArray(state?.libraries) ? state.libraries : (current.libraries ?? []),
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
