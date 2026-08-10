// Seedling HONEST-PLAYTHROUGH overlay — the rulings `seedlingSemantics.js`
// deliberately refuses (R7 slice 4, kickoff §3.5 + §4 slice 4).
//
// `seedlingSemantics.js` is a TRANSCRIPTION: where the source gives no
// item-shaped rule it says `manual` and splits the region rather than invent
// one. That is right for a transcription and useless for an AP logic graph — a
// `manual` crossing is a wall AP can never cross, and a target unreachable in
// our logic is a defect in the logic until proven otherwise at source (the
// user's standing instruction, kickoff §3.5).
//
// This module is the other half: for every `manual` family, either a rule read
// off the game's own source, or a REFUSAL that says so in the artifact. It is
// OPINIONATED where the transcription is not, and every row carries `cite`
// (the source it was read from) and `why` (what the reading was), because the
// generator stamps them into the artifact's provenance block.
//
// ── THE PUZZLE POLICY (⚖ user, 2026-08-09, R7 design session) ───────────────
//
//   An item-dependent puzzle's ITEM dependency is the rule.
//   A pure-choreography puzzle is FREE in logic — the choreography is the tape
//   generator's burden, never a pseudo-terrain.
//
// So a button-and-lock room is `open` here: AP's fill may route through it, and
// producing the button presses is M2's problem. A block that only FIRE can push
// keeps its fire requirement, because no amount of choreography substitutes for
// the item.
//
// ── THE TWO LAWS (R7 §12.9 item 3, source-verified below) ───────────────────
//
//   1. A `ButtonRoom` re-publishes its group at every `check()`, so a
//      room-latched opening is PERMANENT — a durable gate.
//   2. A GROUPED `Lock` (tSet >= 0) writes persistence and never reads it, so
//      its persistence write is INERT and must never become a rules row.
//
// ── DIRECTION OF TRAVEL (the firewall, §6.3) ────────────────────────────────
//
// This module may read the physics model's tables; the physics model imports
// nothing from here. It is analyzer-side, and the artifact it feeds is
// generated one way.
//
// Headless-safe: no top-level await, no literal node: imports.

import { allOf, anyOf, flag, key } from './seedlingSemantics.js';

/**
 * ⛔ THE WEAPON DISJUNCTION, and it is the ONE conservative approximation in
 * this module — named rather than buried.
 *
 * `Player.genericHit` is reached by the sword slash (`Player.as:895`, under
 * `hasSword`) and by the spear thrust (`Player.as:960`, under `hasSpear`), and
 * `Enemy.hit` takes damage from either. So "the room can be cleared" is at
 * least this — and for a room holding an enemy that needs MORE (a boss with an
 * activation gate, an enemy only one weapon reaches) it is too weak.
 *
 * ⚠ THE BOUND, stated: this is a lower bound on the requirement, so a rules row
 * built on it can be too PERMISSIVE and never too strict. A segment that
 * reaches such a room and cannot clear it REFUTES the row — which is what
 * `REFUTATION_LOG` exists to record (a finding, not a quiet edit).
 */
export const A_WEAPON = anyOf(flag('hasSword'), flag('hasSpear'));

/** Semantics helpers, matching seedlingSemantics' own shorthand. */
const OPEN = (cite, why) => ({ kind: 'open', cite, why });
const GATED = (condition, cite, why) => ({ kind: 'gated', condition, cite, why });
const WALL = (cite, why) => ({ kind: 'wall', cite, why });

/**
 * ⛔⛔⛔ THE FIRST FINDING OF THIS SLICE, AND IT REFUTES THE BRIEF.
 *
 * The slice-4 brief asked for `wandlock -> wand SHOT`. **A `WandLock` has no
 * wand logic at all.** `Puzzlements/WandLock.as` is nine lines: it extends
 * `Lock` and passes a different Spritemap. Nothing else. And the shot cannot
 * reach it either — `Projectiles/WandShot.as:checkEntity` handles exactly two
 * cases, `_e is Enemy` and `_e is MagicalLock`, and dies on anything else.
 *
 * ⇒ a `wandlock` is a `lock` wearing a different picture, and its rule is the
 * `lock` rule: kill-lock when `tSet == -1`, choreography otherwise. The wand
 * belongs to `magicallock`, which the transcription already gates correctly.
 *
 * `seedlingSemantics.js`'s own note ("wand-shot puzzle") is misleading for the
 * same reason, but its CLASSIFICATION (`manual`, no rule) was never wrong, so
 * that table is left alone.
 */
export const WANDLOCK_IS_A_LOCK = Object.freeze({
    cite: 'Puzzlements/WandLock.as (whole file) + Projectiles/WandShot.as:checkEntity',
    why: 'WandLock extends Lock and overrides only the sprite; WandShot.checkEntity '
        + 'handles Enemy and MagicalLock and nothing else, so a wand shot cannot open one.',
});

/**
 * The `Activators` family, ruled by its `tSet`.
 *
 * `Lock.check()` removes the lock when `tag >= 0 && tSet < 0 &&
 * !Game.checkPersistence(tag)` — so an UNGROUPED lock honours persistence and a
 * GROUPED one does not, which is law 2 above, read straight off the guard.
 * `Lock.checkEnemies()` sets `activate` when `tSet == -1 && totalEnemies() == 0`
 * — so `tSet == -1` is a KILL-LOCK and `tSet == -2` (the value `ShieldLock`
 * passes) is neither.
 */
const LOCK_FAMILY = new Set(['lock', 'wandlock', 'grasslock', 'rocklock']);

/**
 * ⛓⛓ EVERY CROSS-LEVEL PERSISTENCE WRITE, as a set of `"<level>:<tag>"`.
 *
 * `ButtonRoom.as:93` — `Game.setPersistence(t, persist, room)` — lets a button
 * in ONE room clear a persistence tag in ANOTHER. Four sites in the game; two
 * of them move a BLOCKING entity (`probe-seedling-r7-map-triggers.mjs` is the
 * census). ⛔ It was missed on the first pass because the overlay ruled each
 * entity from the entity alone, and this mechanism is not visible from there —
 * the opener is in a different level.
 */
export function buildCrossLevelOpeners(mapDoc) {
    const out = new Set();
    for (const level of mapDoc?.levels ?? []) {
        for (const e of level.entities ?? []) {
            if (e.type !== 'buttonroom') continue;
            const room = Number(e.attrs?.room);
            if (!Number.isInteger(room) || room < 0) continue;
            out.add(`${room}:${e.attrs.tset}`);
        }
    }
    return out;
}

function lockRuling(entity, ctx) {
    const tSet = Number(entity.attrs?.tset);
    const tag = entity.attrs?.tag;
    if (tSet === -1) {
        // ⛔ A KILL-LOCK IS NOT ALWAYS A KILL-LOCK. `Lock.check()` honours
        // persistence whenever `tSet < 0`, so a lock whose tag is cleared by a
        // ButtonRoom in ANOTHER LEVEL opens from that button too — and the
        // button half is pure choreography, which the policy makes free. The
        // weapon rule would be too STRICT here, which is the one direction a
        // rules row must not be (it seals the map rather than admitting a
        // hand-authoring row).
        if (ctx?.crossLevelOpeners?.has(`${ctx.level}:${tag}`)) {
            return OPEN(
                'Puzzlements/ButtonRoom.as:93 (`Game.setPersistence(t, persist, room)`) '
                + '+ Puzzlements/Lock.as:check (the `tSet < 0` persistence guard)',
                `a kill-lock whose tag is ALSO cleared by a ButtonRoom in another level, so `
                + '`Or(a weapon, that button)` — and the button half is choreography, which '
                + 'makes the whole disjunction free. The census is '
                + '`probe-seedling-r7-map-triggers.mjs`.');
        }
        return GATED(A_WEAPON,
            'Puzzlements/Lock.as:checkEnemies + Game.as:1811-1839 (totalEnemies) '
            + '+ Player.as:895,960 (genericHit\'s two callers)',
            'a KILL-LOCK: it opens when the room holds no enemy of the 25 counted '
            + 'classes, which needs a weapon. DURABLE — `Lock.check()` honours '
            + `persistence while tSet < 0 (this one carries tag ${tag}).`);
    }
    if (tSet >= 0) {
        return OPEN(
            'Puzzlements/Button.as:activateAll + Puzzlements/Lock.as:check (the '
            + '`tSet < 0` guard) + Puzzlements/ButtonRoom.as:check',
            'a GROUPED lock: opened by its group\'s Button/ButtonRoom, which any body '
            + 'presses — pure choreography, FREE under the puzzle policy. ⛔ LAW 2: its '
            + '`turnOff()` persistence write is INERT (check() reads persistence only '
            + 'while tSet < 0), so it is never a rules row.');
    }
    // tSet <= -2 reaches here only for a hand-constructed lock; ShieldLock is
    // classified by tag, not by this path.
    return null;
}

/**
 * The per-tag overlay. Every entry replaces a `manual` row in
 * `ENTITY_SEMANTICS` — nothing here contradicts a row the transcription already
 * gave a rule to, which `seedlingPlaythroughOverlay.test.js` asserts.
 */
export const PLAYTHROUGH_ENTITY_OVERLAY = Object.freeze({
    // --- choreography: free in logic, per the ruled policy --------------------
    cover: OPEN('Puzzlements/Cover.as:20,34,48',
        'a Cover clears while something sits under it — choreography, no item.'),
    chest: OPEN('Chest.as:62-104',
        'a Chest is a Solid until opened, and opening it needs no item — it is a '
        + 'collide-line one pixel below the bottom edge. Choreography.'),
    pushableblock: OPEN('Puzzlements/PushableBlock.as + Player.as:1092-1098',
        'the PLAIN block is moved by walking into it. No item, so no rule.'),

    // --- moving solids: they move, so the cell is not permanently blocked -----
    crusher: OPEN('Puzzlements/Crusher.as', 'a moving hazard sweeps and returns; timing is the tape generator\'s burden, not a wall.'),
    pulser: OPEN('Puzzlements/Pulser.as', 'a moving hazard, as Crusher.'),
    spinningaxe: OPEN('Puzzlements/SpinningAxe.as', 'a moving hazard, as Crusher.'),
    lavachain: OPEN('Puzzlements/LavaChain.as', 'a moving hazard, as Crusher.'),
    bombpusher: OPEN('Puzzlements/BombPusher.as', 'a moving hazard, as Crusher.'),
    beamtower: WALL('Puzzlements/BeamTower.as', 'the TOWER itself is a stationary Solid; only its beam moves.'),

    // --- rocks that are not there yet ----------------------------------------
    fallrock: OPEN('Scenery/FallRock.as (parked at y = -16, type "")',
        'a FallRock is off-map with no type until its trigger fires — it blocks '
        + 'nothing where the .oel places it, and where it LANDS is per-visit run state.'),
    fallrocklarge: OPEN('Scenery/FallRockLarge.as', 'as fallrock.'),

    // --- bosses whose BODY is the door (layer 3) ------------------------------
    shieldboss: GATED(flag('hasSword'),
        'Enemies/ShieldBoss.as (type "ShieldBoss", which Mobile.as:17 lists in '
        + '`solids`) + Player.as:895',
        'the ShieldBoss body is a real wall until it dies, and killing it needs a '
        + 'weapon. The spear is not an option here: it is D6 and this is D2, so the '
        + 'sword is the only reachable arm — stated as the sword rather than as the '
        + 'disjunction so the row cannot be read as licensing a spear-first route.'),
    bosstotem: GATED(allOf(flag('hasTotemPartsAll'), A_WEAPON),
        'Enemies/BossTotem.as:715-721 (hit() passes through only while '
        + '`fullyActivated && activationRestTime <= 0`) + the five totempart pickups',
        'the totem must be ACTIVATED by the five parts before any hit registers, and '
        + 'then it takes damage from either weapon. ⛔ NOT the wand: `hit()` filters on '
        + 'activation state, not on `t`.'),
    finalboss: GATED(A_WEAPON,
        'Enemies/FinalBoss.as:231-236 (startDeath) + R6 §19.7 (the 109-tick death schedule)',
        'the Owl dies to shoves and its corpse becomes a Solid; a shove needs a weapon.'),
    finaldoor: GATED({ seals: 16 },
        'Puzzlements/FinalDoor.as + End/4.oel:131',
        'the FinalDoor opens on all sixteen seals plus the {114,0} clear — the seal '
        + 'count is the item half and the only half a rules row can carry.'),

    // --- ⛓⛓⛓ THE NPC THAT IS A DOOR ----------------------------------------
    //
    // `NPCs/Karlore.as:added()` — **`if (Player.hasFire) FP.world.remove(this)`**.
    // Sardol stands on tile (7,17) of L48, the ONE cell joining the arrival
    // from L47 to the rest of the room, and his own dialogue says what he is:
    // *"Coming so quickly to the north. But you are unprepared, fool. … Turn
    // and come back in due time."* He is the door to Dungeon 5 and his key is
    // FIRE.
    //
    // ⛔ THIS ONE ROW IS WHY 34 REGIONS WERE UNREACHABLE. The transcription
    // classifies every NPC as an unconditional `wall` — right for the twelve
    // that are scenery, wrong for the one that is a gate — and D5, D6, D7 and
    // D8 all hang off it. It was misdiagnosed twice before the source settled
    // it: first as a 4-connectivity resolution defect, then as a physics-model
    // one. Neither survived reading `added()`.
    //
    // ⛓ THE SWEEP THAT BOUNDS IT, so this is a census and not an anecdote:
    // every `.as` in the game was searched for a self-removal conditioned on a
    // `Player` flag. **Karlore is the only BLOCKING one.** `BobBoss` shares
    // the `hasFire` test but is an Enemy (type "Enemy", absent from
    // `Mobile.solids`); `BossKey` and `BossTotemPart` are pickups vanishing
    // once collected. No other solid in the game opens on an item this way.
    karlore: GATED(flag('hasFire'),
        'NPCs/Karlore.as:26-33 (`added()` -> `if (Player.hasFire) FP.world.remove(this)`) '
        + '+ Dungeon5 entrance geometry, L48 tile (7,17)',
        'an NPC that is a DOOR: Sardol seals the north entrance until the player holds '
        + 'Fire, and removes himself entirely once they do. Bounded sweep: he is the only '
        + 'blocking entity in the game with an item-conditional self-removal.'),

    // --- the moonrock: a wall the SHIELD builds ------------------------------
    moonrock: WALL('Scenery/Moonrock.as:88-118 -> Game.moonrockSet -> Main.rockSet '
        + '(R7 §8.2 item 2, §8.8 item 5)',
        'CONSERVATIVE BY CHOICE. Once `rockSet` is written the dropped rock is a 48x48 '
        + 'Solid that is not otherwise there, and `rockSet` is written on the way to the '
        + 'shield — i.e. early. A rules row that assumed the OPEN state would be a row '
        + 'the second half of the run refutes, so the wall is the honest reading and the '
        + 'cost is at most a split on L0.'),

    // --- refusals that STAY refusals ----------------------------------------
    // The pixel-mask families. The physics model has their exact outlines
    // (`seedlingDemo/levelWorld.ENTITY_CLASSES` + `seedlingPixelMasks.js`,
    // byte-verified against the real game over 121 tapes), and the generator
    // resolves them THROUGH the model rather than approximating here — see
    // `pixelMaskTags`. Listed so the census can prove nothing was forgotten.
});

/**
 * ⛔ THE ONE ROW THAT OVERRULES A TRANSCRIBED RULING RATHER THAN FILLING A
 * REFUSAL — an ALLOWLIST, so a second one can never appear silently.
 *
 * `seedlingSemantics` classifies every NPC as an unconditional `wall`, which is
 * right for the twelve that are scenery. `karlore` is the thirteenth and the
 * source contradicts the table outright: `added()` removes him on `hasFire`.
 * Overruling a transcription is a stronger act than filling one of its
 * refusals, so it is enumerated here and the test asserts that every OTHER
 * overlay row replaces a `manual` one.
 */
export const OVERRULES_TRANSCRIPTION = Object.freeze({
    karlore: 'the transcription calls every NPC an unconditional wall; `Karlore.added()` '
        + 'removes this one on `Player.hasFire`, so the table is wrong about exactly one '
        + 'of the thirteen and right about the rest.',
});

/**
 * Tags whose outline is a per-pixel mask. The overlay does not rule on them:
 * the generator asks the physics model, which has the real bitmaps.
 */
export const PIXEL_MASK_TAGS = Object.freeze([
    'building', 'building1', 'building2', 'building3', 'building4',
    'building5', 'building6', 'building7', 'building8',
    'treelarge', 'opentree', 'snowhill', 'tentaclebeast',
]);

/**
 * The overlay's ruling for one placed entity, or null to keep the
 * transcription's. Signature matches `buildSeedlingRegionGrid`'s
 * `entityOverride` hook.
 */
export function overlayEntitySemantics(entity, base, ctx = null) {
    const tag = entity?.type;
    if (tag === undefined) return null;
    if (LOCK_FAMILY.has(tag)) {
        const ruled = lockRuling(entity, ctx);
        return ruled ? { ...base, ...ruled } : null;
    }
    const row = PLAYTHROUGH_ENTITY_OVERLAY[tag];
    if (!row) return null;
    return { ...base, ...row };
}

/**
 * ⛔ THE THREE TRAP ROOMS — never-enter, and the ruling is §6.1's.
 *
 * L57 (TentacleBeast) and L69 (LightBoss) have NO EXIT until their boss dies
 * (`TentacleBeast.as:213`, `LightBossController.as:104` create the exit
 * teleporter on death), so a planner that wanders in unprepared soft-locks the
 * run. L82 (LavaBoss) is the third by ruling. §8.1 measured the exclusion's
 * cost as a PAIR against a positive control: NONE — no item, no key, no goal
 * target is lost in either the never-enter or the never-touch arm.
 *
 * The rules artifact encodes this by refusing to emit the CONNECTIONS into
 * them: AP's fill can then never route a collectible through a room there are
 * no collectibles in.
 */
export const NEVER_ENTER_LEVELS = Object.freeze([57, 69, 82]);

export const NEVER_ENTER_CITE = Object.freeze({
    57: 'Enemies/TentacleBeast.as:213 — the exit teleporter is created on death',
    69: 'Enemies/LightBossController.as:104 — the exit teleporter is created on death',
    82: 'R7 §6.1 ruling + §8.1 (the paired flood: excluding all three costs NOTHING '
        + 'against a positive control that does register a loss)',
});

/**
 * ⛓ L40's SUBREGION RULE, delivered by slice 3 (§12.9 item 1) and used here
 * rather than re-derived.
 *
 * The east half of L40 has exactly ONE door — `wandlock@512,480` at tile
 * (32,30) — and `wandlock@448,432 {tag 9}` opens nothing. Slice 3's measured
 * route reaches it by holding `button@480,384 {t 2}` with the iceturret's
 * CORPSE while the block makes the long journey, which costs a kill and thirty
 * four FIRE presses; links 1-3 cost a burnable tree, which is FIRE again.
 *
 * ⇒ the ITEM dependency is fire and a weapon; the rest is choreography, which
 * the policy makes free. The generic `lockRuling` would have said `open` (a
 * grouped lock), so this row is STRICTLY STRONGER than the general rule, which
 * is the shape a hand ruling is allowed to take.
 */
export const L40_EAST_RULE = Object.freeze({
    level: 40,
    door: 'wandlock@512,480',
    tile: [32, 30],
    condition: allOf(flag('hasFire'), A_WEAPON),
    cite: 'R7 kickoff §12.2-12.4 (probe-seedling-r7-l40-holder.mjs, 12 claims) '
        + '+ Dungeon4/2.oel',
    why: 'the second holder is a BLOCK (`pushableblockfire@480,480`, 34 fire presses to '
        + 'the t5 button) and the corpse takes t2 in two — so the half costs FIRE and a '
        + 'kill, and nothing else an item can buy.',
});

/**
 * ⛓ THE D7 APPROACH DOOR — the one exit whose dropped approach cost distorts the
 * sphere order, hand-ruled where the general charge is refused (R7 slice 5).
 *
 * `level_12/out_teleporter_32_848` is the teleporter to L83 and the only way
 * into Dungeon 7. It sits on a CAVE tile at (2,53); the only approach is from
 * the south through (2,54), which carries a `bosslock {keyType 4}` and a
 * `magicallock` stacked in one cell. The exit binds to the component that
 * reaches it — R7 slice 5's analyzer fix — but the binding does not carry the
 * charge, and the general charge is measured to seal the map, so this door
 * carries it by hand.
 *
 * THREE INDEPENDENT SOURCES AGREE ON THE SAME GATE, which is why this one is
 * hand-ruled and the other twenty are logged:
 *   - the map: the stacked locks at L12 (2,54), read by the analyzer itself as
 *     `key 4 AND (Wand OR Fire Wand)`;
 *   - `region1.oel:2969-2971` (R7 §2.4's "with the wand gates the D7 approach");
 *   - `worlds/seedling/Rules.py`, whose `Dark Shield` wants
 *     `Conch + Fire + Ghost Spear + Wand + Yellow Key` — the same gate from the
 *     far side.
 *
 * And the symptom it fixes is in the sphere log: without it AP takes the DARK
 * SHIELD in sphere 1.12, before Fire, the Conch, the Wand and the Ghost Spear.
 * Strictly stronger than the computed row, which is the only shape a hand
 * ruling may take.
 */
export const CHARGED_DOORS = Object.freeze([
    Object.freeze({
        level: 12,
        exitId: 'out_teleporter_32_848',
        condition: allOf(key(4), anyOf(flag('hasWand'), flag('hasFireWand'))),
        cite: 'Dungeon-side region1.oel:2969-2971 + the stacked bosslock{keyType 4} + magicallock '
            + 'at L12 (2,54) + worlds/seedling/Rules.py Dark Shield',
        why: 'the door to L83 stands on a cave tile whose only approach crosses the stacked '
            + 'key-4-and-wand lock, so using it costs what the lock costs.',
    }),
    // ⛓⛓⛓ THE ENDGAME DOOR — the same defect standing on the GOAL.
    //
    // `finaldoor@112,0 {tag 0}` is a 32x32 Solid at L113 (7,0)..(8,1)
    // (`Scenery/FinalDoor.as:23-27`), and the two teleporters to L115 sit ON
    // (7,0) and (8,0). So the door is not BETWEEN anything — it is UNDER the
    // exits, the binding dropped its cost, and AP took The Seed in sphere 5.3
    // holding TWELVE of the sixteen seals. The goal itself was ungated.
    Object.freeze({
        level: 113,
        exitId: 'out_teleporter_112_0',
        condition: { seals: 16 },
        cite: 'Scenery/FinalDoor.as:52-64 (`SealController.hasAllSealParts() && talkedToWatcher`) '
            + '+ End/2.oel finaldoor@112,0 sitting under the L115 teleporters',
        why: 'the FinalDoor opens on all sixteen seals; the teleporters to the Seed room stand on '
            + 'its own cells, so the seal count has to ride on the exits.',
    }),
    Object.freeze({
        level: 113,
        exitId: 'out_teleporter_128_0',
        condition: { seals: 16 },
        cite: 'Scenery/FinalDoor.as:52-64 + End/2.oel finaldoor@112,0',
        why: 'the second of the two cells the FinalDoor covers.',
    }),
]);

/**
 * ⚠ THE COMPLETION CONDITION, STATED — and the branch that is NOT the goal.
 *
 * The goal is the BLOODLESS Seed: `seed@(4,4)` in L115, whose own text is *"You
 * have taken a step towards morality"*. Reaching it is the FinalDoor's
 * condition, which is TWO terms:
 *
 *   1. `SealController.hasAllSealParts()` — all sixteen seals. Carried, as the
 *      `CHARGED_DOORS` rows above.
 *   2. `talkedToWatcher = !Game.checkPersistence(0, 114)` — the Watcher's speech
 *      in L114 must have been heard. NOT carried as an item, and it does not
 *      need to be: L113's teleporters to L114 are free and on the near side of
 *      the door, so anyone who can stand at the door can already have talked to
 *      him. Named here rather than modelled, because "topologically implied" is
 *      a claim a later map change could quietly break.
 *
 * ⛔ THE BLOODY BRANCH IS A NAMED NON-GOAL. `NPCs/Watcher.as:97-103` adds a
 * SECOND Seed — *"covered in the blood of the Watcher"* — when the Watcher is
 * killed. It is a real second ending and rules v1 does not model it: it would
 * be an alternate completion reachable without any seals at all, which would
 * make every seal optional and collapse the collect-everything goal this rung
 * exists to produce. Excluded deliberately, not overlooked (R7 §13.2d class H
 * first raised it).
 */
export const COMPLETION = Object.freeze({
    goal: 'the bloodless Seed, L115 seed@(4,4)',
    witness: 'the credits — menu_state 2',
    carried: ['all sixteen seals, via CHARGED_DOORS on L113\'s two exits to L115'],
    implied: ['the Watcher\'s speech in L114 — free and on the near side of the FinalDoor'],
    excludedBranch: 'the BLOODY seed (NPCs/Watcher.as:97-103) — a second ending reachable with no '
        + 'seals, which would make every seal optional. A named non-goal.',
    cite: 'Scenery/FinalDoor.as:52-64 + NPCs/Watcher.as:97-103 + End/4.oel:131',
});

/**
 * ⛔⛔ LOCATION GUARDS — the gate that is not a door (R7 slice 5).
 *
 * Terrain analysis can only ever produce CROSSING rules, so an item guarded by
 * something standing in the same room with it is unguarded in the compiled
 * graph. Slice 4 met the symptom and named it from the other side: §13.6 found
 * that the overlay's `bosstotem` row "never reached a compiled rules row, so the
 * L43 Wand is not gated on the five totem parts". The reason is geometric — the
 * BossTotem is at L43 tile (9,10) and the Wand at (9,14), both inside the same
 * 98-cell arena `r8c7`, with the stairs from L40 in it too. There is no crossing
 * for the rule to live on. It has to be the LOCATION's own rule.
 *
 * ⛓ THE SPHERE LOG IS WHAT MADE THE SECOND ONE VISIBLE. AP's first order took
 * `Level 012 - Witch` in sphere 1.2 and the Wand in 1.12 — the Dark Sword ten
 * steps before the item the Witch demands for it.
 *
 * Every row is a source read, and every row makes the logic STRICTER, which is
 * the direction a guard may only move with a citation behind it.
 */
export const LOCATION_GUARDS = Object.freeze({
    'wand@L43': Object.freeze({
        condition: allOf({ flag: 'hasTotemPartsAll' }, A_WEAPON),
        cite: 'Enemies/BossTotem.as hit() (`fullyActivated && activationRestTime <= 0`) '
            + '+ Dungeon4/Boss.oel:238 — the Wand and the totem share one arena',
        why: 'the BossTotem must be activated by all five parts before any hit registers, and it '
            + 'takes damage from either weapon; the Wand lies in its arena, so this is a location '
            + 'guard and not a crossing.',
    }),
    'darksword@L12': Object.freeze({
        condition: flag('hasWand'),
        cite: 'NPCs/Witch.as:47-52 — `doneTalking()` spawns the DarkSword only under '
            + '`Main.hasWand && !Main.hasDarkSword`',
        why: 'the Witch trades the Dark Sword FOR the Wand. The trade is a dialogue in a room '
            + 'nothing gates, so no crossing can ever carry it.',
    }),
    'fire@L32': Object.freeze({
        condition: A_WEAPON,
        cite: 'Enemies/BobBoss.as:185-199 — the THIRD BobBoss\'s death is what adds the Fire; '
            + 'the fight is started by `FallRockLarge.as:115-117`',
        why: 'Fire is a boss DROP in an arena you walk into freely, so the fight is the gate and '
            + 'the location is the only place to hang it.',
    }),
});

/** The guard on one ledger row, or null. */
export function locationGuard(ledgerId) {
    return LOCATION_GUARDS[ledgerId] ?? null;
}

/**
 * ⛔⛔⛔ THE IGNEOUS TILE IS FREE, AND SLICE 4's HAND RULING ON IT PUT THE DARK
 * SUIT BEHIND ITSELF (R7 slice 5 — the refutation log's first real customer).
 *
 * §13.5 ruled the Igneous-to-Lava tile (type 31) DARK SUIT, reasoning that "the
 * honest STATIC reading is the worst case — the tile has already converted".
 * Three source facts say otherwise, and one topological fact says it cannot be
 * right whatever the source says:
 *
 *   1. **It starts walkable and takes work to convert.** `Tile.as:390-424`:
 *      the countdown only runs while the player's centre is within
 *      `sqrt(w²+h²)/2` ≈ 11.3 px, it needs `igneousCounterMax` = 8 render
 *      frames to set `igneousBreakApart`, and then one whole `sprIgneousLava`
 *      animation (8 frames apiece) before `t = 17`. Walking across costs
 *      nothing.
 *   2. **The conversion never survives the room.** `t` is an instance field on
 *      a `Tile` ENTITY, and `loadlevel` rebuilds every Tile from the .oel at
 *      every level entry (`Game.as:1966-2010`, and the build is in `begin()` —
 *      trap 112). Nothing writes it to `levelPersistence`. So a return visit
 *      finds igneous, not lava.
 *   3. **The walk order is choreography**, which the ruled puzzle policy makes
 *      FREE in logic; it is the tape generator's burden.
 *
 * ⛓ AND THE TOPOLOGY IS THE WITNESS. The four igneous tiles of L77 are the
 * "dry corridor" R4 §8.4 measured; with them ruled DARK SUIT, the only route to
 * L79 crosses lava, the Dark Suit is the only item beyond L76, and AP's own
 * fill refuses seven locations. A rule that makes an item a prerequisite for
 * itself is refuted by that alone — the standing instruction is that our logic
 * is wrong before the game is unbeatable.
 */
export const IGNEOUS_IS_FREE = Object.freeze({
    tileType: 31,
    semantics: Object.freeze({ kind: 'open', label: 'igneous' }),
    cite: 'Scenery/Tile.as:83-85,390-424 + Game.as:1966-2010 (loadlevel rebuilds every Tile)',
    why: 'the tile is walkable until eight frames of standing next to it plus a whole '
        + 'animation convert it, and the conversion is per-Tile state a level entry rebuilds — '
        + 'so no reachability question ever meets the converted tile.',
});

/** Tile-type rulings this overlay makes on top of the transcription. */
export const PLAYTHROUGH_TILE_OVERLAY = Object.freeze({
    [IGNEOUS_IS_FREE.tileType]: IGNEOUS_IS_FREE,
});

/** `tileOverride` for `buildSeedlingRegionGrid`: our ruling, or null to keep the table's. */
export function overlayTileSemantics(tileType) {
    return PLAYTHROUGH_TILE_OVERLAY[tileType]?.semantics ?? null;
}

/**
 * ⛓⛓⛓ THE LAVATRAP IS A TRANSPORT, NOT A HAZARD — and it is the last structural
 * door in the map (R7 slice 5).
 *
 * `Enemies/LavaTrap.as` reads as a monster and behaves as a one-way lift:
 *
 *   :22   `chompRange = 32` — it launches when the player's centre is within
 *         32 px and nothing typed "Solid" stands on the line between them
 *         (`:82-90`).
 *   :56-60 while reeled in, `attached.x/y` are driven along the tongue and
 *         **`attached.onGround = false`** — and `Player.state`'s pit branch is
 *         `if (onGround)` (`Player.as:718`), so the ride crosses a pit that
 *         would otherwise kill.
 *   :61-72 at the end of the tongue: **`if (Player.hasDarkSuit)` you are
 *         released standing on the trap's own tile; otherwise `die()`.**
 *
 * ⇒ every LavaTrap is a **one-way edge onto its own tile from every tile within
 * 32 px, gated on the DARK SUIT**. L108 is built out of exactly that: a column
 * of platforms with a pit between each pair and a trap on every second one, and
 * the three hops (8,3)->(8,5), (8,6)->(8,8), (8,9)->(8,11) are each 32 px to the
 * pixel. Without this row the Fire Wand is unreachable and no tile-granular
 * flood can ever say why, because the crossing is not terrain.
 *
 * ⚠ THE BOUND, NAMED and NOT patched: the same disc is LETHAL without the suit,
 * so every tile within 32 px of a trap should also be gated on the Dark Suit.
 * Rules v1 does not gate the disc — R4 §8.4 already found the L77/L78 corridors
 * "covered end to end" by these discs, and turning that into a rule is a
 * strictness change big enough to seal a dungeon, which is the one direction a
 * rules row must not move without a driven segment behind it. Logged here and
 * in the artifact as a PERMISSIVENESS finding, the same treatment §13.6 gave
 * `Health` and `Shards`.
 */
export const LAVATRAP_PULL = Object.freeze({
    tag: 'lavatrap',
    chompRange: 32,
    condition: flag('hasDarkSuit'),
    cite: 'Enemies/LavaTrap.as:22,56-72,82-90 + Player.as:718 (the pit branch is `if (onGround)`)',
    why: 'the tongue reels the player onto the trap\'s own tile with onGround false, so it '
        + 'crosses a pit; the Dark Suit is what makes the arrival survivable rather than a death.',
});

/**
 * Every LavaTrap pull in one level: the trap's tile, and the tiles it can grab
 * the player from. Distances are CENTRE TO CENTRE in pixels, the game's own
 * measure (`LavaTrap.as:29` centres the entity in its tile, `:81` uses
 * `FP.distance` on the two centres, and `:83` compares with `<=`).
 *
 * The line-of-sight test (`collideLine("Solid", ...)`) is NOT applied: it needs
 * the per-pixel solid set, and leaving it out can only ADD pulls, which is the
 * permissive direction. Named here rather than folded into the result.
 */
export function lavaTrapPulls(level, tileSize = 16) {
    const out = [];
    for (const e of level?.entities ?? []) {
        if (e.type !== LAVATRAP_PULL.tag) continue;
        const tx = Math.floor(e.x / tileSize);
        const ty = Math.floor(e.y / tileSize);
        const cx = tx * tileSize + tileSize / 2;
        const cy = ty * tileSize + tileSize / 2;
        const from = [];
        const reach = Math.ceil(LAVATRAP_PULL.chompRange / tileSize);
        for (let y = ty - reach; y <= ty + reach; y += 1) {
            for (let x = tx - reach; x <= tx + reach; x += 1) {
                if (x < 0 || y < 0 || x >= level.width || y >= level.height) continue;
                if (x === tx && y === ty) continue;
                const dx = (x * tileSize + tileSize / 2) - cx;
                const dy = (y * tileSize + tileSize / 2) - cy;
                // `FP.distance` is Euclidean and `d` is coerced to int before
                // the comparison, so the boundary is a floor, not a round.
                if (Math.floor(Math.sqrt(dx * dx + dy * dy)) > LAVATRAP_PULL.chompRange) continue;
                from.push([x, y]);
            }
        }
        out.push({ tile: [tx, ty], from });
    }
    return out.sort((a, b) => (a.tile[1] - b.tile[1]) || (a.tile[0] - b.tile[0]));
}

/**
 * ⛔ THE REFUTATION LOG — the mechanism §4 slice 4 asks for, built NOW rather
 * than when the first refutation arrives.
 *
 * "A rules row a future segment refutes is a FINDING, not a quiet edit." A row
 * is refuted when a driven segment reaches its gate holding everything the row
 * asks for and cannot cross. The entry records the row, the segment that
 * refuted it, and what the game did instead — and the generator stamps the
 * whole list into the artifact, so a preset carrying refuted rows says so on
 * its face.
 *
 * EMPTY AT v1, deliberately: no segment has driven any of these gates yet. The
 * test asserts the SHAPE against a fixture rather than the emptiness, so the
 * mechanism cannot rot while it waits.
 */
export const REFUTATION_LOG = Object.freeze([
    Object.freeze({
        row: 'level_76/the Igneous-to-Lava crossing, ruled Has(Dark Suit) at R7 §13.5',
        refutedBy: 'Generate.py --seed 1 on rules v1 (R7 slice 5) + the offline fixpoint that agrees with it',
        observed: 'the row makes the DARK SUIT a prerequisite for itself: L76 is the only way into '
            + 'D7, its every crossing carried the row, and the suit is the only collectible beyond it. '
            + 'AP refused 7 locations, all of them downstream of Level 079 - Darksuit. At source the '
            + 'tile is walkable until eight frames of proximity convert it and a level entry rebuilds '
            + 'it (Tile.as:83-85,390-424) — see IGNEOUS_IS_FREE.',
        cite: 'Scenery/Tile.as:83-85,390-424 + Game.as:1966-2010 + R7 kickoff §14',
    }),
]);

/** The shape every refutation entry must have. Exported for the test and the generator. */
export const REFUTATION_FIELDS = Object.freeze([
    'row',        // which rules row: `${level}/${exit_or_subregion}`
    'refutedBy',  // the segment/tape that drove it
    'observed',   // what the game did instead
    'cite',       // the evidence
]);

/** True when `entry` is a well-formed refutation row. */
export function isRefutation(entry) {
    return !!entry && typeof entry === 'object'
        && REFUTATION_FIELDS.every((f) => typeof entry[f] === 'string' && entry[f].length > 0);
}

/**
 * The condition vocabulary this overlay adds beyond the transcription's, and
 * the Rule Builder tree each resolves to. `hasTotemPartsAll` and the seal count
 * are not engine FLAGS — they are counts over progressive AP items — so
 * `resolveCondition` cannot reach them through `games/seedling.json`'s
 * flag table and the generator supplies them here.
 */
export const OVERLAY_CONDITIONS = Object.freeze({
    hasTotemPartsAll: { rule: 'Has', args: { item_name: 'Totem Shard', count: 5 } },
});

export const SEAL_ITEM_NAME = 'Seal';
export const SEAL_TOTAL = 16;

/** Resolve an overlay-only condition node, or null when it is not one of ours. */
export function resolveOverlayCondition(condition) {
    if (condition == null) return null;
    if (condition.seals !== undefined) {
        return { rule: 'Has', args: { item_name: SEAL_ITEM_NAME, count: condition.seals } };
    }
    if (condition.flag !== undefined && OVERLAY_CONDITIONS[condition.flag]) {
        return OVERLAY_CONDITIONS[condition.flag];
    }
    return null;
}

export { flag, key, anyOf, allOf };
