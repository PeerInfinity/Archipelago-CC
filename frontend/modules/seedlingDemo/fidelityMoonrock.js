/**
 * seedlingDemo/fidelityMoonrock — **ONE DERIVATION OF THE MOONROCK WITNESSES**
 * (seedling fidelity MOONROCK), shared by the game probe
 * (`scripts/procgen/probe-seedling-moonrock.mjs`) and the node rows
 * (`fidelityMoonrock.test.js`), so the tape the game played and the tape the
 * rows replay are one tape.
 *
 * ⚖ The user (2026-10-04): the moonrock event never fires on the DELIVERED set,
 * and L110's fall reaches L2 (`seedlingSetPatches.js` holds the edits, their
 * reasons, and why the L110 repoint is NOT in the table — measured here).
 *
 * THE SET is `levelSetExporter.vanillaRecordSet(embed, map).set`, the source of
 * every vanilla delivery (the playthrough's AP rewrite and retag only swap
 * pickups on top of it; rooms 0, 2 and 110 carry none of those). Its records are
 * read back the way the game page and the JS runtime mount them
 * (`wasmWalkTape.mountedRecordsOf`: chunk → re-assemble → `recordOfRoom`), so
 * the model replays what the game was handed, not the document it came from.
 *
 * THE STAGING is route step 23's, VERBATIM from
 * `scripts/procgen/plan-seedling-u14-moonrock.mjs` (`r9-solve-13-v2`'s measured
 * L0 latch: sword, shield, the Red Key, the game's own rng and save). Only the
 * boot and `beam`/`rock_set` differ per arm.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTape } from './tapeFormat.js';
import { buildTape } from './botDriverV1.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { vanillaRecordSet } from './levelSetExporter.js';
import { PATCH_L110_FALL_OFF_STAIRS, PATCH_L110_FALL_TO_L2, SEEDLING_SET_PATCHES } from './seedlingSetPatches.js';

const MAP_PATH = 'frontend/modules/flashPanel/atlases/seedling-map.json';
const EMBED_PATH = 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json';

const readJson = (repoRoot, rel) => JSON.parse(readFileSync(join(repoRoot, rel), 'utf8'));

/** The committed map extract (the BUILT-IN map: what the game runs with no set mounted). */
export const builtInMap = (repoRoot) => readJson(repoRoot, MAP_PATH);

/**
 * The delivered set's VARIANTS, by the record patches each carries: `table` is
 * what the delivery ships (`SEEDLING_SET_PATCHES`); `unpatched` is vanilla's
 * rooms delivered (`{patches: []}`, the mutant's world); `approved` and
 * `off-stairs` add one of the two L110 repoints the table does NOT carry.
 */
export const MOONROCK_VARIANTS = Object.freeze({
    table: SEEDLING_SET_PATCHES,
    unpatched: Object.freeze([]),
    approved: Object.freeze([...SEEDLING_SET_PATCHES, PATCH_L110_FALL_TO_L2]),
    'off-stairs': Object.freeze([...SEEDLING_SET_PATCHES, PATCH_L110_FALL_OFF_STAIRS]),
});

/** The delivered set (`vanillaRecordSet`), its mounted records, and their level source. */
export function deliveredMoonrockSet(repoRoot, variant = 'table') {
    const patches = MOONROCK_VARIANTS[variant];
    if (!patches) throw new Error(`fidelityMoonrock: no variant ${JSON.stringify(variant)}`);
    const embed = readJson(repoRoot, EMBED_PATH);
    const map = builtInMap(repoRoot);
    // ⛔ `table` takes vanillaRecordSet's OWN default, so a delivery that stops
    // carrying the table is seen here (the D3 mutant), not papered over.
    const { set } = variant === 'table' ? vanillaRecordSet(embed, map) : vanillaRecordSet(embed, map, { patches });
    const records = mountedRecordsOf(set);
    return { set, records, levelSource: levelSourceFromAtlas(records) };
}

/** The built-in map's level source (the controls' world). */
export const builtInLevelSource = (repoRoot) => levelSourceFromAtlas(builtInMap(repoRoot));

// --- route step 23's staging, verbatim (plan-seedling-u14-moonrock.mjs) ------

const PERSISTENCE = Object.freeze([
    [3, 0], [5, 0], [8, 0], [8, 1], [10, 0], [11, 0], [15, 0], [15, 2], [15, 3],
    [16, 0], [16, 3], [16, 4], [16, 6], [16, 7], [17, 29], [18, 0], [19, 0], [19, 1],
    [20, 0], [20, 1], [20, 2], [20, 4],
].map(([level, tag]) => Object.freeze({ level, tag, note: '' })));
const ITEMS = Object.freeze({
    hasSword: true, hasGhostSword: false, hasShield: true, hasFire: false,
    hasWand: false, hasFireWand: false, canSwim: false, hasSpear: false,
    hasDarkShield: false, hasDarkSuit: false, hasDarkSword: false, hasFeather: false,
    hasTorch: false,
});
const seamFor = ({ beam, rockSet }) => ({
    items: { ...ITEMS },
    beam,
    rock_set: rockSet,
    hits_max: 3,
    first_use: false,
    extended: false,
    time: 12241,
    primary: 0,
    secondary: 0,
    grass_cut: 192,
    cutscene: [false, false, false, false],
    menu_state: 0,
    music: { set: 'Room', index: 1 },
});
const SAVE = Object.freeze({ totem_parts: [], keys: [0], seal_parts: [0] });
const RNG = Object.freeze({ seed: 85136665, split: true, cosmetic: 1995363572, fp: 1341168923 });
const PINS = Object.freeze(['sound', 'dead_frames']);

const keysAt = (spans, t) => new Set(spans.filter(([, a, b]) => t >= a && t < b).map(([k]) => k));

/**
 * Route step 23's staging around fixed key spans (`[key, from, to)`), one tape.
 * ⛓ Exported for `fidelityDescent.js` (seedling fidelity DESCENT), whose fall
 * tapes are this staging with other keys, so the two slices play one staging.
 */
export function tapeOf({ name, boot, flags, ticks, spans, description }) {
    const perTick = Array.from({ length: ticks }, (_, t) => keysAt(spans, t));
    const folded = buildTape(perTick, boot, name, { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return parseTape({
        game: 'seedling',
        name,
        boot,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: PERSISTENCE.map((p) => ({ ...p })),
        equips: [],
        pins: [...PINS],
        save: { ...SAVE, keys: [...SAVE.keys], seal_parts: [...SAVE.seal_parts] },
        rng: { ...RNG },
        seam: seamFor(flags),
        tick_count: perTick.length,
        inputs: folded.inputs,
        tape_version: 8,
        description,
    });
}

/**
 * THE WITNESS TAPES. Fixed keys; each is played on the DELIVERED set (the
 * claim) and on the BUILT-IN map (the control).
 *
 *   `moonrock-fall`   L110 booted at (64,48), the tile above its only pit
 *                     (tile (4,4) = (64,64)); `down` held t0–t11, then still.
 *                     The control is vanilla's in the table, so the fall lands
 *                     at L0 (256,272), from the ceiling onto `stairsdown`, and
 *                     the descent fires the stairs → L2 (48,32). The variants
 *                     `approved` / `off-stairs` repoint it (the STOP's arms).
 *   `moonrock-fall-rockset`  the same with the rock already SET (vanilla after
 *                     the Shield): on the built-in map the arrival is inside the
 *                     rock, on the Teleporter that replaced the stairs.
 *   `moonrock-shield` L0 booted at (256,208), four tiles above
 *                     `stairsdown@256,272`, with the Shield's own write already
 *                     made (`beam: true`, `rock_set: false` — route step 23's
 *                     boot). `down` held t0–t59 (onto the stairs → L2 (48,32)),
 *                     then `up` held t90–t129 (L2's `stairsup@48,16` → L0).
 *                     DELIVERED: no rock, no freeze, two transitions, `{2,0}`
 *                     never written. BUILT-IN: the beam (451 dead frames), and
 *                     the rock lands Solid over the stairs.
 */
export const MOONROCK_TAPES = Object.freeze({
    fall: () => tapeOf({
        name: 'moonrock-fall',
        boot: { level: 110, x: 64, y: 48 },
        flags: { beam: false, rockSet: false },
        ticks: 150,
        spans: [['down', 0, 12]],
        description: 'seedling fidelity MOONROCK — L110 (Dungeon8_12) booted on the tile above its '
            + 'only pit (64,64); down t0–t11. The fall lands from the ceiling at L0 (256,272), on '
            + 'stairsdown, and the descent fires the stairs → L2 (48,32). Played on the delivered '
            + 'set, its variants and the built-in map. Authored by fidelityMoonrock.js.',
    }),
    fallRockSet: () => tapeOf({
        name: 'moonrock-fall-rockset',
        boot: { level: 110, x: 64, y: 48 },
        flags: { beam: false, rockSet: true },
        ticks: 150,
        spans: [['down', 0, 12]],
        description: 'seedling fidelity MOONROCK — the fall tape with the rock already SET '
            + '(beam false, rock_set true: vanilla after the Shield). On the built-in map the fall '
            + 'lands at L0 (256,272) inside the set rock, on the `moonrock_target` Teleporter that '
            + 'replaced the stairs. Authored by fidelityMoonrock.js.',
    }),
    shield: () => tapeOf({
        name: 'moonrock-shield',
        boot: { level: 0, x: 256, y: 208 },
        flags: { beam: true, rockSet: false },
        ticks: 160,
        spans: [['down', 0, 60], ['up', 90, 130]],
        description: 'seedling fidelity MOONROCK — L0 booted at (256,208) after the Shield '
            + '(beam true, rock_set false); down t0–t59 onto stairsdown@256,272, up t90–t129 onto '
            + 'L2\'s stairsup@48,16. On the delivered set (no moonrock) no beam fires and both '
            + 'stairs work; on the built-in map the rock beams, falls and covers the stairs. '
            + 'Authored by fidelityMoonrock.js.',
    }),
});

/** L2's stairs (`stairsup@48,16` → L0) and L0's (`stairsdown@256,272` → L2 (48,32)), from the map. */
export const MOONROCK_TARGET = Object.freeze({ level: 2, x: 48, y: 32 });
export const L0_STAIRS_TILE = Object.freeze({ level: 0, x: 256, y: 272 });
