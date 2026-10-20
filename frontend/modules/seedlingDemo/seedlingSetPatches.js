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
 * ⚖ The user (2026-10-18), on fidelity's measure-only ROCKMOVE (should the
 * trigger-sealed rocks be removed, or moved one tile off the door?): **"Remove
 * bundle"** — three more rooms where a trigger drops a `fallrock` onto the one
 * way through, while the rules price every `fallrock` OPEN (an `overlay_rows`
 * `open` row; no rules event names a rock). Removing the rock makes the game
 * match the rules, and the rules do not change (the regeneration moves only
 * `provenance.set_patches`). No move works in any of them: each rock sits in a
 * one-tile neck, and every neighbouring tile seals the same neck or lands on an
 * arrival (ROCKMOVE's game witnesses). L43's three wand-dropped rocks are LEFT:
 * in the AP delivery the wand is an `apitem`, and no rock falls.
 *
 *   4–5. `l74-fallrock-removed` + `l74-button-removed` — L74 (`Dungeon7/3`):
 *      L73's `teleporter@64,0` lands ON `button@288,128` (tset 0), which drops
 *      `fallrock@288,144` (tset 0, tag 2) onto `teleporter@288,144` → L73, the
 *      only door back; the rules price `level_74 <-> level_73` free.
 *   6. `l39-fallrock-removed` — L39 (`Dungeon4/1`): cutting `rope@96,384`
 *      (tset 6, tag 9), which the 1-wide shaft requires, drops
 *      `fallrock@144,624` (tset 6, tag 10) onto `teleporter@144,624` → L38, so
 *      the rules' L39 → L38 exit was never usable after the cut. The ROPE STAYS:
 *      it gates the shaft, and it still drives `pulser@64,96` (tset 6).
 *   7–8. `l29-fallrock-removed` + `l29-button-removed` — L29 (`Dungeon3/8`):
 *      `button@112,128` (tset 0), on the one-tile neck between the south half
 *      (L22's door) and the north half (the L31 stairs and the boss key), drops
 *      `fallrock@112,112` (tset 0, tag 0) into the neck, severing the halves
 *      both ways; the rules hold the room as one region.
 * The BUTTON goes with the rock in L74 and L29: the rock is the only tset-0
 * responder in either room (and no `buttonroom` in any level writes into 29 or
 * 74), so a button left behind presses a group nothing answers, and the solver
 * refuses a `hold` on it. L39's tset 6 keeps its pulser, so its rope stays.
 * The measurement: `CC/docs/cloud-reports/seedling-fidelity-rockmove.md` (D1
 * census, D2 game witnesses, D3 solver legs, D5 table) and its evidence dir.
 * Game witness: `probe-seedling-rock-remove.mjs`.
 *
 * ⚖ The user (2026-10-19, relayed by fidelity: "Level-data patch") — the first
 * `move` row:
 *
 *   9. `l32-bossrock-moved` — L32 (Bob's arena) has its `fallrocklarge@64,128`
 *      (tset 0, tag 1, `bossrock 1`, `thirdboss 1`) moved to (88,128). Under R4
 *      Bob is always fought and Fire comes from the server, not the kill; after
 *      the fight the rock falls onto `stairsdown@72,136` → L30, and the room's
 *      other way out (the `burnabletree@64,0` over the `control` pit) needs
 *      Fire. So a player without Fire was stuck in L32, while the rules price
 *      the stairs free. At (88,128) the landed rock spans [88,120)×[128,160),
 *      clear of the stairs' [72,88)×[136,152) — the smallest move (24 px) that
 *      clears them. The arm test (`p.y < fallTo − 16 − 8`) reads y alone, so
 *      the trigger, the fight and the kill are vanilla's. ⚠ THE MODEL
 *      FOLLOWS ONLY WITH fidelity APFLIP: here `bobBossFight.bobBossRockRect()`
 *      is still the constant (64,128), and APFLIP's switched
 *      `levelRun.bobArenaRockRect()` is what reads the rock's own world row.
 *      Measured: fidelity APFLIP D1 (`seedling-fidelity-apflip.md`, the cloud
 *      reports); game witness `probe-seedling-l32-rock-move.mjs`.
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
    l74FallrockRemoved: 'l74-fallrock-removed',
    l74ButtonRemoved: 'l74-button-removed',
    l39FallrockRemoved: 'l39-fallrock-removed',
    l29FallrockRemoved: 'l29-fallrock-removed',
    l29ButtonRemoved: 'l29-button-removed',
    l32BossrockMoved: 'l32-bossrock-moved',
});

/**
 * ⚖ THE PATCHES (the user, 2026-10-04). Every value is the extract's own spelling
 * (attrs are strings in `seedling-map.json`), so a match is an exact compare.
 *
 * `op: 'remove'` deletes the one entity `match` names; `op: 'set-attrs'` rewrites
 * the named attrs of the one entity `match` names (the BEFORE is `match.attrs`,
 * the AFTER is `match.attrs` overlaid with `attrs`); `op: 'move'` re-places the
 * one entity `match` names at `to: {x, y}`, its attrs untouched (the BEFORE is
 * `match` at its placement, the AFTER is `match`'s type and attrs at `to`).
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

/** One `remove` row of the ROCKMOVE bundle (⚖ 2026-10-18): the one entity `type@x,y` with `attrs`, in `level`. */
const removeRow = (id, level, type, x, y, attrs, why) => Object.freeze({
    id, level, op: 'remove', match: Object.freeze({ type, x, y, attrs: Object.freeze(attrs) }), why,
});

export const PATCH_L74_FALLROCK_REMOVED = removeRow(SET_PATCH_IDS.l74FallrockRemoved, 74, 'fallrock', 288, 144,
    { tset: '0', tag: '2' },
    'L73\'s door lands on L74\'s `button@288,128`, which dropped this rock onto `teleporter@288,144` → L73, '
    + 'the only door back; with no rock L74 ↔ L73 stays open both ways, as the rules price it');

export const PATCH_L74_BUTTON_REMOVED = removeRow(SET_PATCH_IDS.l74ButtonRemoved, 74, 'button', 288, 128,
    { tset: '0' },
    'the L73 arrival tile\'s button: its group (tset 0) had one responder, the removed fallrock@288,144, and '
    + 'no other level writes into 74, so it would press a group nothing answers');

export const PATCH_L39_FALLROCK_REMOVED = removeRow(SET_PATCH_IDS.l39FallrockRemoved, 39, 'fallrock', 144, 624,
    { tset: '6', tag: '10' },
    'cutting `rope@96,384` (tset 6), which the 1-wide shaft requires, dropped this rock onto '
    + '`teleporter@144,624` → L38; with no rock the L38 door stays open after the cut. The rope stays '
    + '(it gates the shaft and drives `pulser@64,96`)');

export const PATCH_L29_FALLROCK_REMOVED = removeRow(SET_PATCH_IDS.l29FallrockRemoved, 29, 'fallrock', 112, 112,
    { tset: '0', tag: '0' },
    '`button@112,128` dropped this rock into the one-tile neck between the south half (L22\'s door) and the '
    + 'north half (the L31 stairs, the boss key), severing them both ways; with no rock the room is the one '
    + 'region the rules hold');

export const PATCH_L29_BUTTON_REMOVED = removeRow(SET_PATCH_IDS.l29ButtonRemoved, 29, 'button', 112, 128,
    { tset: '0' },
    'the neck\'s button: its group (tset 0) had one responder, the removed fallrock@112,112, and no other '
    + 'level writes into 29, so it would press a group nothing answers');

/** The five ROCKMOVE rows, in the table's order (⚖ 2026-10-18 "Remove bundle"). */
export const ROCKMOVE_REMOVE_BUNDLE = Object.freeze([
    PATCH_L74_FALLROCK_REMOVED,
    PATCH_L74_BUTTON_REMOVED,
    PATCH_L39_FALLROCK_REMOVED,
    PATCH_L29_FALLROCK_REMOVED,
    PATCH_L29_BUTTON_REMOVED,
]);

/**
 * ⚖ 2026-10-19 "Level-data patch": Bob's arena rock moves 24 px right, off L32's stairs (header, edit 9).
 * The landed box at (88,128) is [88,120)×[128,160); the stairs are [72,88)×[136,152).
 */
export const PATCH_L32_BOSSROCK_MOVED = Object.freeze({
    id: SET_PATCH_IDS.l32BossrockMoved,
    level: 32,
    op: 'move',
    match: Object.freeze({ type: 'fallrocklarge', x: 64, y: 128,
        attrs: Object.freeze({ tset: '0', tag: '1', bossrock: '1', thirdboss: '1' }) }),
    to: Object.freeze({ x: 88, y: 128 }),
    why: 'after Bob\'s fight this rock fell onto `stairsdown@72,136` → L30, and the only other way out '
        + '(the burnable tree over the pit) needs Fire, which under R4 comes from the server, not the kill; '
        + 'landed at (88,128) it clears the stairs, so a player without Fire leaves L32 by them, as the rules '
        + 'price it. The trigger, the fight and the kill are unchanged (the arm test reads y alone)',
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
 * ⚖ THE TABLE THE DELIVERY CARRIES. Edits 1, 3, 4–8 and 9: edit 2 is STOPPED (the
 * header above) — `PATCH_L110_FALL_TO_L2` and `PATCH_L110_FALL_OFF_STAIRS` stand
 * ready for the user's choice.
 */
export const SEEDLING_SET_PATCHES = Object.freeze([
    PATCH_MOONROCK_REMOVED,
    PATCH_L37_FALLROCK_REMOVED,
    ...ROCKMOVE_REMOVE_BUNDLE,
    PATCH_L32_BOSSROCK_MOVED,
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
    if (patch.op === 'move') {
        const to = patch.to ?? fail(`seedlingSetPatches: ${patch.id} — a \`move\` names no \`to\``);
        const dest = { ...patch.match, x: to.x, y: to.y };
        const done = entities.filter((e) => at(e, dest) && sameAttrs(e.attrs, patch.match.attrs));
        if (before.length === 0) {
            // ALREADY APPLIED iff exactly one matching entity stands at `to` and none of the type at the source.
            if (done.length === 1 && !entities.some((e) => at(e, patch.match))) return { record, applied: false };
            fail(`seedlingSetPatches: ${patch.id} — level ${patch.level} holds no ${describe(patch.match)} `
                + `(the BEFORE) and ${done.length} ${describe(dest)} (the AFTER); the extract moved under the patch`);
        }
        if (before.length > 1) {
            fail(`seedlingSetPatches: ${patch.id} — level ${patch.level} holds ${before.length} `
                + `${describe(patch.match)}; the patch names exactly one`);
        }
        if (entities.some((e) => at(e, dest))) {
            fail(`seedlingSetPatches: ${patch.id} — level ${patch.level} already holds a `
                + `${dest.type}@${dest.x},${dest.y}; a move onto it would stack two`);
        }
        return {
            record: { ...record, entities: entities.map((e) => (e === before[0] ? { ...e, x: to.x, y: to.y } : e)) },
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
