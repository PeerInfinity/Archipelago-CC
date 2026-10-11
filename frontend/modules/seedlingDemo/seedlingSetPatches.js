/**
 * seedlingDemo/seedlingSetPatches — **THE DELIVERED SET'S PATCHES, NAMED ONCE**
 * (seedling fidelity MOONROCK).
 *
 * ⚖ The user (2026-10-04): *"Instead of having the moon rock event create a
 * backup entrance, maybe it would make more sense to change it so that the moon
 * rock event is never triggered, and the entrance that would normally be reached
 * from falling into the moon rock is instead reached directly from the fall from
 * the room above it."* APPROVED the same day, as two edits to the delivered set:
 *
 *   1. `moonrock-removed` — L0 (`OverWorld1`) loses its `<moonrock>` (240,256,
 *      tag 0). With no `Moonrock` entity nothing reads `Main.beam`
 *      (`Pickups/Shield.as:46` still writes it), `Game.moonrockSet` is never set,
 *      L0's `stairsdown@256,272` → L2 (48,32) is never swapped for the
 *      `moonrock_target` Teleporter, `{2,0}` is never written, and L2's
 *      `moonrockpile@40,16` (`Scenery/MoonrockPile.as:28-31`: there iff `{2,0}`
 *      is cleared) never appears — so L2's `stairsup@48,16` → L0 stays open.
 *   2. `l110-fall-to-l2` — L110 (`Dungeon8_12`, the ONE room with
 *      `fallthrough=0`) has its `<control>` at (64,64) repointed: `fallthrough 2,
 *      xOff -48, yOff -32`, so its only pit (tile (64,64)) lands at L2 (48,32).
 *
 * ⛔⛔ **EDIT 2 IS NOT IN THE TABLE — MEASURED ON THE GAME, IT DEFEATS ITS OWN
 * PURPOSE** (`probe-seedling-moonrock.mjs`, `fixtures/moonrock-oracle.json`,
 * p4f). A fall arrives FROM THE CEILING (`Player.check()` puts the player at
 * the camera top, `Player.update()` drops it to its tile) and `Teleporter.update`
 * fires on any overlap with no `fallFromCeiling` guard:
 *   · repointed to L2 (48,32): the descent crosses L2's `stairsup@48,16`, and
 *     the player is in L2 for 34 ticks and then in **L0 (256,256)** — the fall
 *     ends in L0, not L2;
 *   · NOT repointed (edit 1 alone): the fall lands on L0's `stairsdown@256,272`
 *     tile, and the descent fires those stairs — **L2 (48,32)**, the
 *     `moonrock_target`, 39 ticks later. Vanilla does the same with the rock
 *     unset AND with it set (then through the rock's Teleporter, writing
 *     `{2,0}`): the fall always reached L2 (48,32) by L0's stairs tile;
 *   · repointed to L2 (64,32) instead (`PATCH_L110_FALL_OFF_STAIRS`): the
 *     descent misses the stairs and the fall ends in L2 (64,32), directly.
 * The approved coordinates therefore go back to the user; both repoints are
 * exported below, NAMED and UNAPPLIED, so the choice is one line in the table.
 *
 * ⚖ The user (2026-10-10): *"This might require a change to the AS3, to make
 * the path not close except in vanilla mode. Please investigate this."* — and
 * then *"Yes please"* to a third edit of the delivered set, no AS3:
 *
 *   3. `l37-fallrock-removed` — L37 (`OverWorld/region2`) loses its
 *      `<fallrock>` (288,32, tset 0, tag 4). L38's arrival from L37 (its
 *      `teleporter@288,0` → L38 (144,288)) lands ON L38's
 *      `buttonroom@144,288` (tset 4, flip 1, room 37), which writes `{37,4}`
 *      cleared (`ButtonRoom.as:93`), and a cleared `{37,4}` builds L37's rock
 *      FALLEN, a Solid (`FallRock.as:42-45`), in L37's 1-tile column-18
 *      corridor. So after the first entry into L38, L37's door to L38 and L38's
 *      return landing (288,16) were sealed from the rest of L37, while the
 *      rules price `level_37 <-> level_38` free both ways. With no rock, the
 *      button's write reaches nothing (nothing else in L37 has tset 0, and no
 *      other L38 button writes tset 4 into 37), and the corridor stays open in
 *      both directions, as the rules already say. The button itself stays.
 *
 * ── ⛔ WHERE THIS APPLIES, AND WHERE IT DOES NOT ─────────────────────────────
 *
 * ONE caller: `levelSetExporter.vanillaRecordSet`, the single source of the
 * vanilla DELIVERY. Everything downstream of it inherits the patch without a
 * line of its own (the AP rewrite, `seedlingLevelSetDelivery`, the wasm
 * engine's `deliveredSet`, the JS page's real-room mount, the vanilla-map
 * playback map). Measured at `0aab89b4d8`: only `seedling_playthrough` reaches
 * it among the presets (the vanilla arm, and the atlas arm's 11 retags); the
 * four atlas presets allocate 0 retags, deliver no set, and run the BUILT-IN
 * map — Moonrock and L37's fallrock included — so they stay VANILLA.
 *
 * NOT applied to: `flashPanel/atlases/seedling-map.json` itself (the faithful
 * extract of the game's OEL), `levelSource.loadAtlas()` (the model's built-in
 * map, which every committed tape is recorded against), generated sets
 * (`seedlingGeneratedSet` → `buildLevelSet`), and the atlas arms.
 *
 * ── THE CONTRACT ─────────────────────────────────────────────────────────────
 *
 * `applySetPatches(levels)` takes the map document's `levels` (records with
 * `{level, entities: [{type, x, y, attrs}]}`) and returns a NEW array: every
 * patched record is a copy, every other record is the input's own object, and
 * the input is never mutated. Each patch names its BEFORE and its AFTER:
 *   · the record already in the AFTER state is left alone — the applier is
 *     IDEMPOTENT, so a patched document can be patched again;
 *   · the record in the BEFORE state is patched;
 *   · a record in NEITHER state REFUSES BY NAME — the extract moved under the
 *     patch, and guessing which entity was meant would deliver a room nobody
 *     approved.
 */

export class SetPatchError extends Error {
    constructor(message) { super(message); this.name = 'SetPatchError'; }
}
const fail = (m) => { throw new SetPatchError(m); };

/** The ids, so a reader can name what was applied without carrying the bodies. */
export const SET_PATCH_IDS = Object.freeze({
    moonrockRemoved: 'moonrock-removed',
    l110FallToL2: 'l110-fall-to-l2',
    l110FallOffStairs: 'l110-fall-off-stairs',
    l37FallrockRemoved: 'l37-fallrock-removed',
});

/**
 * ⚖ THE PATCHES (the user, 2026-10-04). Every value is the extract's own spelling
 * (attrs are strings in `seedling-map.json`), so a match is an exact compare.
 *
 * `op: 'remove'` deletes the one entity `match` names; `op: 'set-attrs'` rewrites
 * the named attrs of the one entity `match` names (the BEFORE is `match.attrs`,
 * the AFTER is `match.attrs` overlaid with `attrs`).
 */
export const PATCH_MOONROCK_REMOVED = Object.freeze({
    id: SET_PATCH_IDS.moonrockRemoved,
    level: 0,
    op: 'remove',
    match: Object.freeze({ type: 'moonrock', x: 240, y: 256, attrs: Object.freeze({ tag: '0' }) }),
    why: 'the moonrock event never fires: no rock, no `moonrock_target` Teleporter over '
        + 'L0\'s stairs, no `{2,0}` write, so L2\'s `moonrockpile` never appears and its '
        + 'stairs back to L0 stay open',
});

export const PATCH_L37_FALLROCK_REMOVED = Object.freeze({
    id: SET_PATCH_IDS.l37FallrockRemoved,
    level: 37,
    op: 'remove',
    match: Object.freeze({ type: 'fallrock', x: 288, y: 32, attrs: Object.freeze({ tset: '0', tag: '4' }) }),
    why: 'L38\'s arrival from L37 presses `buttonroom@144,288`, which clears `{37,4}`; with no '
        + 'fallrock in L37 that write builds nothing, so L37\'s column-18 corridor to and from L38 '
        + 'stays open after the first entry',
});

/** L110's control, repointed so its pit's fall arrives at L2 (`x`, `y`) — `xOff`/`yOff` solved from (64,64). */
const l110RepointTo = (id, x, y, why) => Object.freeze({
    id,
    level: 110,
    op: 'set-attrs',
    match: Object.freeze({ type: 'control', x: 64, y: 64,
        attrs: Object.freeze({ fallthrough: '0', xOff: '-256', yOff: '-272' }) }),
    // arrival = floor((pit - (64 + xOff)) / 16) * 16 over pit ∈ [64,80) ⇒ xOff = -x, yOff = -y.
    attrs: Object.freeze({ fallthrough: '2', xOff: String(-x), yOff: String(-y) }),
    why,
});

export const PATCH_L110_FALL_TO_L2 = l110RepointTo(SET_PATCH_IDS.l110FallToL2, 48, 32,
    'L110\'s only pit (tile 64,64) lands at L2 (48,32) — the `moonrock_target` — '
    + 'directly, instead of on L0\'s stairs tile (256,272) under the rock');

export const PATCH_L110_FALL_OFF_STAIRS = l110RepointTo(SET_PATCH_IDS.l110FallOffStairs, 64, 32,
    'L110\'s only pit lands at L2 (64,32), one tile right of the `moonrock_target`, so the '
    + 'fall-from-ceiling descent does not cross L2\'s `stairsup@48,16`');

/**
 * ⚖ THE TABLE THE DELIVERY CARRIES. Edits 1 and 3: edit 2 is STOPPED (the
 * header above) — `PATCH_L110_FALL_TO_L2` and `PATCH_L110_FALL_OFF_STAIRS` stand
 * ready for the user's choice.
 */
export const SEEDLING_SET_PATCHES = Object.freeze([
    PATCH_MOONROCK_REMOVED,
    PATCH_L37_FALLROCK_REMOVED,
]);

const sameAttrs = (have, want) => Object.entries(want)
    .every(([k, v]) => String(have?.[k]) === String(v));
const at = (e, m) => e?.type === m.type && Number(e.x) === m.x && Number(e.y) === m.y;
const describe = (m) => `${m.type}@${m.x},${m.y} ${JSON.stringify(m.attrs)}`;

/**
 * One patch against one record: `{record, applied}` where `record` is a copy
 * when the patch changed it, the input otherwise.
 */
function applyOne(patch, record) {
    const entities = Array.isArray(record?.entities) ? record.entities : fail(
        `seedlingSetPatches: ${patch.id} — level ${patch.level}'s record has no \`entities\` array`);
    const before = entities.filter((e) => at(e, patch.match) && sameAttrs(e.attrs, patch.match.attrs));
    if (patch.op === 'remove') {
        if (before.length === 0) {
            // ALREADY APPLIED iff no entity of the type stands at the placement.
            if (entities.some((e) => at(e, patch.match))) {
                fail(`seedlingSetPatches: ${patch.id} — level ${patch.level} holds a `
                    + `${patch.match.type}@${patch.match.x},${patch.match.y} that is not `
                    + `${describe(patch.match)}; the extract moved under the patch`);
            }
            return { record, applied: false };
        }
        if (before.length > 1) {
            fail(`seedlingSetPatches: ${patch.id} — level ${patch.level} holds ${before.length} `
                + `${describe(patch.match)}; the patch names exactly one`);
        }
        return { record: { ...record, entities: entities.filter((e) => e !== before[0]) }, applied: true };
    }
    if (patch.op === 'set-attrs') {
        const after = { ...patch.match.attrs, ...patch.attrs };
        const done = entities.filter((e) => at(e, patch.match) && sameAttrs(e.attrs, after));
        if (before.length === 0) {
            if (done.length === 1) return { record, applied: false };
            fail(`seedlingSetPatches: ${patch.id} — level ${patch.level} holds no `
                + `${describe(patch.match)} (the BEFORE) and no ${patch.match.type}@`
                + `${patch.match.x},${patch.match.y} ${JSON.stringify(after)} (the AFTER); `
                + 'the extract moved under the patch');
        }
        if (before.length > 1) {
            fail(`seedlingSetPatches: ${patch.id} — level ${patch.level} holds ${before.length} `
                + `${describe(patch.match)}; the patch names exactly one`);
        }
        return {
            record: {
                ...record,
                entities: entities.map((e) => (e === before[0]
                    ? { ...e, attrs: { ...e.attrs, ...patch.attrs } } : e)),
            },
            applied: true,
        };
    }
    return fail(`seedlingSetPatches: ${patch.id} has an unknown op ${JSON.stringify(patch.op)}`);
}

/**
 * The map document's `levels`, with every patch applied. A NEW array; patched
 * records are copies; the input is not mutated. Idempotent. A patch whose level
 * is missing, or whose entity is in neither its BEFORE nor its AFTER state,
 * refuses by name.
 *
 * @param {Array<object>} levels  the map document's `levels`
 * @param {ReadonlyArray<object>} [patches]  defaults to `SEEDLING_SET_PATCHES`
 * @returns {Array<object>}
 */
export function applySetPatches(levels, patches = SEEDLING_SET_PATCHES) {
    if (!Array.isArray(levels)) fail('seedlingSetPatches: applySetPatches needs the map document\'s `levels` array');
    const out = levels.slice();
    for (const patch of patches) {
        const hits = [];
        out.forEach((r, i) => { if (r?.level === patch.level) hits.push(i); });
        if (hits.length !== 1) {
            fail(`seedlingSetPatches: ${patch.id} — the levels hold ${hits.length} record(s) for `
                + `level ${patch.level}; the patch names exactly one`);
        }
        out[hits[0]] = applyOne(patch, out[hits[0]]).record;
    }
    return out;
}

/**
 * A map DOCUMENT with its `levels` patched (every other field the input's own) —
 * for a node caller that hands a whole document to `levelSourceFromAtlas` /
 * `indexLevels` and must see the DELIVERED rooms (a playthrough-set model run, a
 * game witness on the delivered set).
 */
export function patchedMapDocument(mapDoc, patches = SEEDLING_SET_PATCHES) {
    return { ...mapDoc, levels: applySetPatches(mapDoc?.levels, patches) };
}
