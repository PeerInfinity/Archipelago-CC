/**
 * Bounce ↔ procgen-pipeline integration: the substrate's procgen
 * parameters and its pre-plan / region-params contributions.
 *
 * These are the bounce-specific pieces the generic Procgen Pipeline
 * driver used to hard-code. They attach to the bounce substrate
 * registry entry as four optional adapter hooks so the driver stays
 * substrate-agnostic (maze and the others simply don't declare them):
 *
 *   - defaultProcgenParams  — the panel merges this into its defaults.
 *   - prepareSphereGrowth   — pre-plan contributions (the free arrow).
 *   - buildRegionParams     — assembles the substrate's regionParams.
 *   - renderProcgenParams   — the panel's per-substrate param controls.
 *
 * A fifth region-step hook lives in bounceDemoLibrary.js (it needs no
 * params/DOM):
 *
 *   - buildRegionContract   — maps the engine's generic per-node realiser
 *     specs onto the bounce editor contract (exit/location specs, mode,
 *     free arrow); the engine's buildRegionContract dispatcher calls it.
 *
 * Pure logic + call-time DOM only (no top-level document/window access,
 * no eventBus/panel imports) so headless CLI drivers can import the
 * bounce library without pulling in panel code.
 */

import { ABILITY_ITEM_NAMES } from './apRules.js';
import { createRng } from '../shared/rng.js';

// ── Panel parameter defaults ────────────────────────────────────────
// Merged into the Procgen Pipeline panel's DEFAULT_PARAMS via the
// `defaultProcgenParams` registry hook.
export const DEFAULT_BOUNCE_PROCGEN_PARAMS = Object.freeze({
    // What falling off the level bottom does. 'current' respawns at the
    // entrance; 'previous' exits to the previous region; 'start' is
    // reserved. Routing never depends on it — every non-start region
    // carries a real back portal.
    bounceFallBehavior: 'current',
    // Physics profile (bounceDemo/physics.js PROFILES). LOGIC-AFFECTING:
    // access rules derive from the profile's step constants, so the
    // profile is stamped into every bounce payload and the world plays
    // under the constants it was generated with. New worlds default to
    // 'dj' (real Doodle Jump constants); 'experimental' stamps nothing.
    bouncePhysicsProfile: 'dj',
    // Layout is always the 2-wide branching-path "braid" generator.
    // Column mode (the fixed-column proposer) was deprecated 2026-06-19:
    // braid is the only reachable layout. The column code in the engine
    // / bounce generator remains physically present but DORMANT (nothing
    // sets bounceMode to anything but 'braid'), pending later removal.
    // Braid level width (px) — the wrap-ring width. 240 is DJ-authentic
    // (fits two simultaneous branches; three need ≥318).
    bounceBraidWidth: 240,
    // Braid per-row jitter (px): horizontal meander applied to each row.
    bounceJitter: 40,
    // Extra PLAIN climb rows added per region after the gating content
    // (gated braid only) — distributed across the requirement segments
    // to make levels taller and lift the hardest exit to the summit.
    // 0 = minimal gated chain.
    bouncePlatformRows: 0,
    // Braid decoration chances (0–1), per eligible platform. Blue
    // (moving, 1-lane), brown (breaking, terminal), spring + jetpack
    // (1-lane, launch higher → bigger gap above). Jetpack defaults off —
    // its dj gap is huge.
    bounceBlueChance: 0.3,
    bounceBrownChance: 0.3,
    bounceSpringChance: 0.3,
    bounceJetpackChance: 0,
    // Decorative fork chance (0–1) per extra platformRows row (gated
    // braid): a 2-wide companion lane beside the spine, then a merge.
    // The terminal merge branch may break (brown chance). Overshoots
    // the platform-rows target.
    bounceForkChance: 0,
});

const BOUNCE_FALL_OPTIONS = [
    { value: 'current', label: 'Restart current region', disabled: false },
    { value: 'previous', label: 'Return to previous region', disabled: false },
    { value: 'start', label: 'Return to starting region (v2)', disabled: true },
];

// Mirrors bounceDemo/physics.js PROFILES.
const BOUNCE_PHYSICS_PROFILE_OPTIONS = [
    { value: 'dj', label: 'Doodle Jump (measured, 20Hz)', disabled: false },
    { value: 'experimental', label: 'Experimental (original model)', disabled: false },
];

// ── Pre-plan contributions (the free arrow) ─────────────────────────
/**
 * A bounce region is only traversable beyond its forced column with an
 * arrow, so when bounce is in the world one arrow (seeded-random) is
 * made available up front. The braid model treats the free arrow as
 * ALWAYS held — it can never be a gate — so the arrow is a STARTING
 * ITEM (removed from the pool via itemPoolDelta) in every bounce world,
 * and its direction rides regionParams.bounceFreeArrow so the braid
 * realiser/verifier knows which arrow is free.
 *
 * (Column mode's sphere-1 "start-stack" intro — collect your first
 * arrow in-region — is retired with column mode. A simplified braid
 * intro could be revisited later; it isn't a priority.)
 *
 * Returns a contributions object the driver merges:
 *   { startingItems?, itemPoolDelta?, regionParams?, note? }
 */
export function prepareBounceSphereGrowth({
    itemPool, quotas, startSubstrate, seed, substrateId = 'bounce',
} = {}) {
    const startSub = startSubstrate ?? null;
    const selected = (quotas?.[substrateId] ?? 0) > 0 || startSub === substrateId;
    if (!selected) return {};

    const left = ABILITY_ITEM_NAMES.left;
    const arrows = [left, ABILITY_ITEM_NAMES.right]
        .filter((a) => (itemPool?.[a] ?? 0) > 0);
    if (arrows.length === 0) return {};
    const pick = arrows[Math.floor(createRng((seed * 31 + 17) | 0).next() * arrows.length)];
    const freeArrowAbility = pick === left ? 'left' : 'right';

    return {
        startingItems: [pick],
        itemPoolDelta: { [pick]: -1 },
        note: `${pick} granted as a starting item`,
        regionParams: { bounceFreeArrow: freeArrowAbility },
    };
}

// ── regionParams assembly ───────────────────────────────────────────
/**
 * The bounce-specific regionParams keys (maze ignores unknown keys).
 * Layout is always braid (column deprecated 2026-06-19). `mode` is
 * 'sphere' | 'topDown' — top-down omits platformRows + the fork
 * decoration (sphere-growth / gated-braid concepts). bounceFreeArrow is
 * NOT assembled here; it rides prepareSphereGrowth's regionParams and
 * the driver merges the two.
 */
export function buildBounceRegionParams({ params, mode = 'sphere' } = {}) {
    const p = params ?? {};
    const out = {
        physicsProfile: p.bouncePhysicsProfile ?? 'dj',
        fallBehavior: p.bounceFallBehavior ?? 'current',
        bounceMode: 'braid',
        braidWidth: p.bounceBraidWidth ?? 240,
        bounceJitter: p.bounceJitter ?? 40,
    };
    if (mode === 'topDown') {
        out.bounceDecorChance = {
            blue: p.bounceBlueChance ?? 0,
            brown: p.bounceBrownChance ?? 0,
            spring: p.bounceSpringChance ?? 0,
            jetpack: p.bounceJetpackChance ?? 0,
        };
    } else {
        out.platformRows = p.bouncePlatformRows ?? 0;
        out.bounceDecorChance = {
            spring: p.bounceSpringChance ?? 0,
            jetpack: p.bounceJetpackChance ?? 0,
            blue: p.bounceBlueChance ?? 0,
            fork: p.bounceForkChance ?? 0,
            brown: p.bounceBrownChance ?? 0,
        };
    }
    return out;
}

// ── Panel parameter controls ────────────────────────────────────────
/**
 * Render the bounce parameter subsection for the Procgen Pipeline
 * panel. Mutates the passed `params` object in place and calls
 * `onChange` after each edit (the panel wires it to its silent
 * localStorage save). Returns a DOM element.
 */
export function renderBounceProcgenParams({ params, onChange = () => {} } = {}) {
    const wrap = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'procgen-pipeline-field';
    const label = document.createElement('label');
    label.textContent = 'Fall behavior';
    label.title = 'What falling off the level bottom does. Routing never depends on it — every non-start region has a real back portal.';
    const select = document.createElement('select');
    for (const opt of BOUNCE_FALL_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.disabled) o.disabled = true;
        select.appendChild(o);
    }
    select.value = params.bounceFallBehavior ?? 'current';
    select.addEventListener('change', () => {
        params.bounceFallBehavior = select.value;
        onChange();
    });
    row.appendChild(label);
    row.appendChild(select);
    wrap.appendChild(row);

    const physRow = document.createElement('div');
    physRow.className = 'procgen-pipeline-field';
    const physLabel = document.createElement('label');
    physLabel.textContent = 'Physics profile';
    physLabel.title = 'Logic-affecting: access rules derive from the profile\'s physics, '
        + 'and the profile is stamped into every bounce payload so the world plays under '
        + 'the constants it was generated with. dj is provisional until probe calibration.';
    const physSelect = document.createElement('select');
    for (const opt of BOUNCE_PHYSICS_PROFILE_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.disabled) o.disabled = true;
        physSelect.appendChild(o);
    }
    physSelect.value = params.bouncePhysicsProfile ?? 'dj';
    physSelect.addEventListener('change', () => {
        params.bouncePhysicsProfile = physSelect.value;
        onChange();
    });
    physRow.appendChild(physLabel);
    physRow.appendChild(physSelect);
    wrap.appendChild(physRow);

    // Layout is always braid (the 2-wide branching-path generator);
    // column mode was deprecated 2026-06-19, so there is no layout
    // selector. The braid sub-fields (width + per-row jitter +
    // decoration) are always shown.
    const braidFields = document.createElement('div');
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
    braidFields.appendChild(numberField('Braid width',
        'Wrap-ring width in px. 240 is DJ-authentic and fits two simultaneous branches; three need ≥318.',
        'bounceBraidWidth', 240));
    braidFields.appendChild(numberField('Max jitter',
        'Per-row horizontal meander in px (clamped to ~one hop\'s reach). 0 = straight lanes.',
        'bounceJitter', 40));
    braidFields.appendChild(numberField('Platform rows',
        'Extra plain climb rows added per region AFTER the logic-gating content '
        + '(sphere-growth / gated braid only). Spread across the gate segments to make '
        + 'levels taller and lift the hardest exit to the summit. 0 = minimal gated chain.',
        'bouncePlatformRows', 0));
    braidFields.appendChild(numberField('Blue chance',
        'Per-eligible-platform probability (0–1) of a blue platform (moving, full-width '
        + 'sweep; 1-lane rows only). Capped per level so the reachability check stays fast.',
        'bounceBlueChance', 0.3, { step: 0.01, max: 1 }));
    braidFields.appendChild(numberField('Brown chance',
        'Per-eligible-platform probability (0–1) of a brown platform (breaks on landing; '
        + 'terminal only — a pre-merge branch or the top). Capped per level.',
        'bounceBrownChance', 0.3, { step: 0.01, max: 1 }));
    braidFields.appendChild(numberField('Spring chance',
        'Per-eligible-platform probability (0–1) of a spring (1-lane rows; launches higher, '
        + 'so the gap above grows to the spring window).',
        'bounceSpringChance', 0.3, { step: 0.01, max: 1 }));
    braidFields.appendChild(numberField('Jetpack chance',
        'Per-eligible-platform probability (0–1) of a jetpack (1-lane rows). Launches FAR '
        + 'higher — under dj the gap is ~6200px, making very tall levels. Default 0.',
        'bounceJetpackChance', 0, { step: 0.01, max: 1 }));
    braidFields.appendChild(numberField('Fork chance',
        'Per-extra-row probability (0–1) of a decorative 2-wide fork/merge beside the '
        + 'gated spine (sphere growth). Adds companion platforms BEYOND the platform-rows '
        + 'target; the terminal merge branch breaks at Brown chance. Default 0.',
        'bounceForkChance', 0, { step: 0.01, max: 1 }));
    wrap.appendChild(braidFields);
    return wrap;
}
