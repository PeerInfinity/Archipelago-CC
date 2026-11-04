/**
 * Cloudberry substrate — the Procgen Pipeline knobs (runner's `runnerProcgenParams.js`
 * is the model).
 *
 * Every key is prefixed `cloudberry…` so it survives mixed-substrate merging. The
 * defaults are merged into the panel's params through the `defaultProcgenParams`
 * registry hook; `buildCloudberryRegionParams` copies them into the world-level
 * regionParams that reach `buildZoneSpecs`, and `renderCloudberryProcgenParams`
 * draws them in the panel.
 *
 * The generator's own settings are a WHITELIST (the plan's P1a open item 6): the
 * Cloudberry generator's reflection lists engine state fields too, so only the
 * settings below are surfaced; the rest keep the generator's defaults.
 */

import { fieldRow, numberField } from '../procgenCore/regionGenerationForm.js';

/** Tilesets offered (the generator's `schema().tilesets`, minus None/Random/the anders__ test sets). */
export const CLOUDBERRY_TILESETS = Object.freeze([
    'castle', 'cave', 'cloud', 'cloud_rain', 'forest', 'forest_snow', 'hills', 'hills_rain', 'sea', 'sea_rain',
]);
/** The generator's hazard upgrades (`schema().upgrades.names`) that only add danger, never platforms. */
export const CLOUDBERRY_HAZARD_UPGRADES = Object.freeze([
    'Spike', 'Fireball', 'FireSpinner', 'SpikeyGuy', 'Pinky', 'SpikeyLine', 'Laser', 'Firesnake', 'Serpent', 'LavaDrip',
]);

/**
 * P5b — the Hero Factory's physics sliders as world settings (⚖ Robert 2026-11-04: the proposed ranges, per world +
 * a variation knob, on ability levels too). `phsx` = the generator's `heroCustom.phsx` name; `def` = the game's own
 * default hero (the Hero Factory's slider default); `min`/`max` = the RULED range (narrower than the game's bounds
 * table where P5b measured trouble — replay/reroll: numjumps 2–4, jumplength2 ≤ 1.35; crossing the fixed ladder between
 * pieces as often as the default hero (⚖ Robert's rulings A then A3): gravity ≤ 1.5, jumplength ≥ 0.85, jumpaccel ≥ 0.9,
 * friction ≥ 0.5, size ≥ 0.8 (also ≥ the 0.5 the replay needs)); `levels` = which levels the
 * slider acts on ('all', 'double' = Double Jump-hero levels, 'jetpack' = Jetpack-hero levels). ORDER IS LOAD-BEARING:
 * the variation draw (draw order (5)) takes one rng number per applicable slider in this order.
 */
export const CLOUDBERRY_HERO_PHYSICS = Object.freeze([
    { key: 'cloudberryHeroGravity', phsx: 'gravity', label: 'Gravity', def: 1, min: 0.5, max: 1.5, levels: 'all' },
    { key: 'cloudberryHeroAccel', phsx: 'accel', label: 'Acceleration', def: 1, min: 0.5, max: 2, levels: 'all' },
    { key: 'cloudberryHeroMaxSpeed', phsx: 'maxspeed', label: 'Max speed', def: 1, min: 0.5, max: 2, levels: 'all' },
    { key: 'cloudberryHeroMaxFall', phsx: 'maxfall', label: 'Max fall speed', def: 1, min: 0.33, max: 3, levels: 'all' },
    { key: 'cloudberryHeroJumpLength', phsx: 'jumplength', label: 'Jump length', def: 1, min: 0.85, max: 1.65, levels: 'all' },
    { key: 'cloudberryHeroJumpAccel', phsx: 'jumpaccel', label: 'Jump acceleration', def: 1, min: 0.9, max: 1.65, levels: 'all' },
    { key: 'cloudberryHeroFriction', phsx: 'friction', label: 'Friction', def: 1, min: 0.5, max: 3, levels: 'all' },
    { key: 'cloudberryHeroSize', phsx: 'size', label: 'Size', def: 1, min: 0.8, max: 2.1, levels: 'all' },
    { key: 'cloudberryHeroNumJumps', phsx: 'numjumps', label: 'Jumps (Double Jump levels)', def: 2, min: 2, max: 4, levels: 'double', integer: true },
    { key: 'cloudberryHeroJumpLength2', phsx: 'jumplength2', label: 'Double jump length', def: 1, min: 0.5, max: 1.35, levels: 'double' },
    { key: 'cloudberryHeroJumpAccel2', phsx: 'jumpaccel2', label: 'Double jump acceleration', def: 1, min: 0.5, max: 1.65, levels: 'double' },
    { key: 'cloudberryHeroJetpackAccel', phsx: 'jetpackaccel', label: 'Jetpack acceleration', def: 1, min: 0.75, max: 2, levels: 'jetpack' },
    { key: 'cloudberryHeroJetpackFuel', phsx: 'jetpackfuel', label: 'Jetpack fuel', def: 1, min: 0.5, max: 4, levels: 'jetpack' },
].map(Object.freeze));
/** The variation knob's range: 0 = every level has the world's hero; 1 = each slider drawn over its whole range. */
export const CLOUDBERRY_HERO_VARIATION_MAX = 1;

export const DEFAULT_CLOUDBERRY_PROCGEN_PARAMS = Object.freeze({
    // The generator's `difficulty` (0 Easy .. 4 Masochistic). Each piece names its own
    // upgrades, so difficulty only shapes what the upgrades leave to the generator.
    cloudberryDifficulty: 2,
    // Each piece's length in world units (the generator's `pieceLength`). Generation time
    // grows with it (~1–2 s per region at 3500 in the tab).
    cloudberryPieceLength: 3500,
    // The fewest pieces a level has. A level gets one piece per check-coin group with no
    // items, then the pieces that bring in its exits' platform items; this pads with
    // item-free pieces up to the minimum.
    cloudberryMinPieces: 2,
    // ⚖ R19: check coins per level piece (chosen among the coins the computer collects).
    cloudberryChecksPerPiece: 1,
    // Hazard upgrades on every piece (difficulty texture only: the computer's recording
    // still passes, so requirements never change).
    cloudberryHazards: false,
    // The level of each hazard upgrade (0–10), and how many hazard kinds a level draws.
    cloudberryHazardLevel: 3,
    cloudberryHazardKinds: 2,
    // The chance that a region entered through a Jetpack gate is a Jetpack-hero level
    // (everything in it needs Jetpack, which the player holds on the way in).
    cloudberryJetpackChance: 0.5,
    // The chance that a region entered through a Double Jump gate is a Double-hero level
    // (2 jumps; everything in it needs Double Jump). Drawn after the Jetpack draw: a
    // Jetpack level is never also a Double Jump level (P5a).
    cloudberryDoubleJumpChance: 0.5,
    // A tileset name (CLOUDBERRY_TILESETS), or 'random' (drawn per region).
    cloudberryTileset: 'random',
    // The generator's Jump upgrade on every piece (0–10): wider, higher jumps.
    cloudberryJumpLevel: 2,
    // How many times a refused region is generated again with a derived seed before the
    // run is refused by name (RerollExhausted, too few witnessed coins, no start door).
    cloudberryRetries: 4,
    // P5b: the hero's physics (CLOUDBERRY_HERO_PHYSICS; defaults = the game's own hero).
    ...Object.fromEntries(CLOUDBERRY_HERO_PHYSICS.map((h) => [h.key, h.def])),
    // P5b: how far each region's hero is drawn from the world's values toward a random point of each
    // slider's range (0 = off: every level has the world's hero). A refused attempt redraws.
    cloudberryHeroVariation: 0,
});

const D = DEFAULT_CLOUDBERRY_PROCGEN_PARAMS;

/** World-level regionParams (the `buildRegionParams` hook): each knob, defaulted. */
export function buildCloudberryRegionParams({ params } = {}) {
    const p = params ?? {};
    return Object.fromEntries(Object.keys(D).map((k) => [k, p[k] ?? D[k]]));
}

/** The knobs a stored payload records (the panel's Edit flow): the request's own settings. */
export function cloudberryProcgenParamsFromPayload(payload) {
    const g = payload?.params?.generate ?? {};
    const out = {};
    if (typeof g.difficulty === 'number') out.cloudberryDifficulty = g.difficulty;
    if (typeof g.pieceLength === 'number') out.cloudberryPieceLength = g.pieceLength;
    if (typeof g.tileset === 'string') out.cloudberryTileset = g.tileset;
    const phsx = g.heroCustom?.phsx ?? {};
    for (const h of CLOUDBERRY_HERO_PHYSICS) {
        if (typeof phsx[h.phsx] === 'number') out[h.key] = phsx[h.phsx];
    }
    return out;
}

function selectRow(params, { key, label, title, options, def }, onChange) {
    const select = document.createElement('select');
    for (const [value, text] of options) {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = text;
        select.appendChild(o);
    }
    select.value = String(params[key] ?? def);
    select.addEventListener('change', () => {
        params[key] = select.value === 'true' ? true : select.value === 'false' ? false : select.value;
        onChange();
    });
    return fieldRow(label, title, select);
}

/** The panel's controls for the Cloudberry knobs (the `renderProcgenParams` hook). */
export function renderCloudberryProcgenParams({ params, onChange = () => {} } = {}) {
    const wrap = document.createElement('div');
    wrap.appendChild(numberField(params, {
        key: 'cloudberryDifficulty', label: 'Difficulty',
        title: 'The generator\'s difficulty, 0 (Easy) to 4 (Masochistic).',
        def: D.cloudberryDifficulty, step: 1, max: 4, integer: true,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'cloudberryPieceLength', label: 'Piece length',
        title: 'Each level piece\'s length in world units. Longer pieces take longer to generate.',
        def: D.cloudberryPieceLength, min: 1500, step: 100, max: 12000, integer: true,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'cloudberryMinPieces', label: 'Min pieces',
        title: 'The fewest pieces a level has (checkpoints between pieces). A level needs one piece per '
            + 'group of check coins and one for its exits\' platform items; extra pieces have no items.',
        def: D.cloudberryMinPieces, min: 1, step: 1, max: 6, integer: true,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'cloudberryChecksPerPiece', label: 'Check coins per piece',
        title: 'How many of the coins the computer collects in a piece are Archipelago checks.',
        def: D.cloudberryChecksPerPiece, min: 1, step: 1, max: 4, integer: true,
    }, onChange));
    wrap.appendChild(selectRow(params, {
        key: 'cloudberryHazards', label: 'Hazards',
        title: 'Hazard upgrades on every piece. Requirements never change: the computer\'s run still passes.',
        options: [['false', 'Off'], ['true', 'On']], def: D.cloudberryHazards,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'cloudberryHazardLevel', label: 'Hazard level',
        title: 'The level of each hazard upgrade (0–10).',
        def: D.cloudberryHazardLevel, step: 1, max: 10, integer: true,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'cloudberryHazardKinds', label: 'Hazard kinds',
        title: 'How many hazard kinds each level draws (Spike, Fireball, FireSpinner, …).',
        def: D.cloudberryHazardKinds, min: 1, step: 1, max: CLOUDBERRY_HAZARD_UPGRADES.length, integer: true,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'cloudberryJetpackChance', label: 'Jetpack chance',
        title: 'The chance that a region entered through a Jetpack gate is a Jetpack-hero level.',
        def: D.cloudberryJetpackChance, step: 0.05, max: 1,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'cloudberryDoubleJumpChance', label: 'Double Jump chance',
        title: 'The chance that a region entered through a Double Jump gate is a Double-hero level '
            + '(not when it is already a Jetpack level).',
        def: D.cloudberryDoubleJumpChance, step: 0.05, max: 1,
    }, onChange));
    wrap.appendChild(selectRow(params, {
        key: 'cloudberryTileset', label: 'Tileset',
        title: 'The level\'s tileset, or a random one per region.',
        options: [['random', 'Random'], ...CLOUDBERRY_TILESETS.map((t) => [t, t])], def: D.cloudberryTileset,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'cloudberryJumpLevel', label: 'Jump upgrade',
        title: 'The generator\'s Jump upgrade on every piece (0–10).',
        def: D.cloudberryJumpLevel, step: 1, max: 10, integer: true,
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'cloudberryRetries', label: 'Retries',
        title: 'How often a refused level is generated again with a derived seed before generation stops.',
        def: D.cloudberryRetries, step: 1, max: 16, integer: true,
    }, onChange));
    for (const h of CLOUDBERRY_HERO_PHYSICS) {
        const where = h.levels === 'double' ? ' Double Jump levels only.' : h.levels === 'jetpack' ? ' Jetpack levels only.' : '';
        wrap.appendChild(numberField(params, {
            key: h.key, label: `Hero: ${h.label}`,
            title: `The Hero Factory's ${h.label.toLowerCase()} (${h.def} = the game's own hero; ${h.min}–${h.max}).${where}`,
            def: h.def, min: h.min, max: h.max, step: h.integer ? 1 : 0.05, ...(h.integer ? { integer: true } : {}),
        }, onChange));
    }
    wrap.appendChild(numberField(params, {
        key: 'cloudberryHeroVariation', label: 'Hero variation',
        title: 'How far each region\'s hero is drawn from the values above toward a random point of each slider\'s '
            + 'range: 0 = every level has the same hero, 1 = drawn over the whole range.',
        def: D.cloudberryHeroVariation, step: 0.05, max: CLOUDBERRY_HERO_VARIATION_MAX,
    }, onChange));
    return wrap;
}
