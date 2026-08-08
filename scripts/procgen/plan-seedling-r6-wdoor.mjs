#!/usr/bin/env node
/**
 * plan-seedling-r6-wdoor — ⛓⛓⛓ W-DOOR: THE ENDING'S WALL, OPENED IN ONE
 * APPROACH.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 6c. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §16.7 item 2, with §14.9's
 * clock and §8.7's mechanism, modelled in `endingChain.stepFinalDoor`.
 *
 * ── WHAT THE WINDOW DOES ──────────────────────────────────────────────
 *
 * It boots into level 113 at (120, 88) — three tiles south of
 * `finaldoor@112,0` — with the STAGED SAVE STATE the rung was ruled on:
 * sixteen seal identities in `save.seal_parts` and `{114,0}` declared
 * CLEARED, which is exactly what W-talk earns. Then it holds `up` and does
 * nothing else for the whole tape.
 *
 * ```
 *   tick  0..35   the walk north, 54 px
 *   tick  36      inside 32 px of (128,16) -> `seenSeal`, a SealController,
 *                 and 181 DEAD frames in one lump
 *   tick  37      the overlay is gone, `mySealController` is null, and the
 *                 SAME approach reaches the second arm -> play("open")
 *   tick  93      `animEnd` -> `FP.world.remove` — which only QUEUES the
 *                 entity, so the Player still sweeps against it this frame
 *   tick  94      `updateLists()` has run: `{113,0}` CLEARED and the body
 *                 leaves the type list. The player's LAST pinned observation
 *   tick 95..105  the held key walks into the cell the door occupied
 * ```
 *
 * ── ⛔ THE THREE FENCEPOSTS, EACH ONE A NUMBER SOMETHING ELSE HAD ─────
 *
 * 1. **THE CEREMONY IS 181 DEAD FRAMES, NOT 180 TICKS.**
 *    `SealController`'s CONSTRUCTOR sets `Game.freezeObjects = true` and
 *    the class never touches `Game.talking`, so `Game.update`'s
 *    `else if (inventory) inventory.open = false` never runs and nothing
 *    lowers the flag between frames. Every frame of it is DEAD: the tape's
 *    counter does not advance, `Bot.autoAdvance` refuses to dispatch into
 *    it (`freezeUp` is `Game.talking || helpUp`), and the tape's own X
 *    releases can never reach `Input.released`. So the overlay ALWAYS runs
 *    its full length — 60 fade + 60 wait + 60 more, and the third phase is
 *    the one nobody expects because `alpha` is back at its peak for all of
 *    it — and the span is a lump in `frozenFramesOwed`.
 *    ⇒ **`dead_frames` is the second, independent witness of this window**,
 *    and it is a much sharper one than a position: 181 against a load
 *    fade's ~19.
 *
 * 2. **ONE APPROACH, NOT TWO.** `SealController.removed()` nulls
 *    `parent.mySealController` from `updateLists()`, which `Engine.update`
 *    runs immediately after `world.update()` — so the door's very next
 *    update finds the second arm reachable with the player still standing
 *    inside the circle. §2.5's "the door only opens on a LATER approach" is
 *    refuted here, at tick 37, one tick after the ceremony.
 *
 * 3. ⛔⛔ **THE PLAY FRAME IS THE ANIMATION'S FIRST UPDATE — a fencepost
 *    this slice CORRECTED IN SHIPPED CODE.** `World.update` is
 *    `while (e) { if (e.active) e.update(); if (e._graphic) e._graphic.
 *    update(); e = e._updateNext; }`, so the same pass that runs
 *    `sprFinalDoor.play("open")` advances the Spritemap immediately
 *    afterwards. `animEnd` fires on graphic update 57, which is **56 ticks
 *    after the play tick**, not 57 — and `stepFinalDoor` started its count
 *    at 0. One tick of a wall that had already gone.
 *
 * 4. ⛔⛔⛔ **AND THE WALL SURVIVES `animEnd` BY ONE MORE TICK — THE GAME
 *    REFUTED THE FIRST RECORDING ON EXACTLY THIS.** `FP.world.remove(this)`
 *    only QUEUES the entity; `Engine.update` is
 *    `FP._world.update(); FP._world.updateLists();` and the Player sweeps
 *    inside the FIRST. So the door is in the type list for the whole frame
 *    its animation ends on. The first recording diverged at observation 94
 *    — model 33.50, game 34.50 — and the step sequence either side was
 *    IDENTICAL (1.55, 1.30, 1.05, 0.80, 1.35), which is what said the model
 *    had taken exactly one extra step and nothing else was wrong. R5 slice 5
 *    found the same fencepost as the third of `ShieldBoss`'s three; this
 *    class has no `destroy` and no fade, so for it the fencepost is the
 *    WHOLE removal.
 *
 * ── ⛓⛓ THE PAIR: THE DOOR'S OTHER CONDITION ─────────────────────────
 *
 * The control is the same tape with `{114,0}` NOT DECLARED — one boot
 * field, and the one W-talk exists to earn. `FinalDoor.update`'s first line
 * is `var talkedToWatcher:Boolean = !Game.checkPersistence(0, 114)`, the
 * only cross-level persistence read in the game, and its own comment names
 * the pair: *"0 is the tag for the Watcher's text, while 114 is the room
 * that it refers to."*
 *
 * ⛓ WHAT THE CONTROL SHOWS IS NOT "NOTHING HAPPENS". The approach is
 * identical, the ceremony fires on the SAME tick and costs the SAME 181
 * dead frames — the overlay is unconditional, and it even carries a
 * different string ("Face the Watcher and return" against "Your path to
 * redemption lies here") — and then the second arm is simply never
 * reachable. `{113,0}` stays SET, the wall stays up, and the player stands
 * against it at y 34.5 for the rest of the tape while the drive's walks 14
 * px into the doorway. Both arms are the SAME LENGTH: this is the first R6
 * pair that is not a prefix, because the control has no missing tail —
 * only a missing flag.
 *
 * ⚠ THE TAPE STOPS BEFORE THE TELEPORTER. The door covers `teleporter@112,0`
 * and `@128,0`, both to L115, and the drive's freed walk would reach one 16
 * ticks after the removal. It is cut at 12, and the plan asserts the margin
 * — because L115's two arrival tiles are **water**, and a tape that landed
 * there would spend its last observations drowning.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r6-wdoor.mjs [--write]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const WRITE = process.argv.includes('--write');

const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { serializeTape, parseTape, heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));
const { FINAL_DOOR, WATCHER_FLAG, finalDoorOpenUpdates } = await import(join(MODULE, 'endingChain.js'));
const { sealControllerTicks } = await import(join(MODULE, 'sealCeremony.js'));

/**
 * ⚠ THE BOOT BLOCK IS `new Game(level, x, y)`'s ARGUMENTS — the spawn adds
 * `(Tile.w/2, Tile.h/2)`, so tile (7,5)'s corner (112,80) becomes (120,88).
 * Column 7 is the only one that reaches the door from the south: L113's
 * rows 0 and 1 are wall but for the two L114 teleporters at columns 1-2,
 * and row 2 is open only at columns 6..8.
 */
const BOOT = { level: 113, x: 112, y: 80 };
/**
 * ⛔ THE STAGED ENDING, AND IT IS A RULING (kickoff §1.1). R6's claim is
 * "given this save state, the real game's ending is beatable"; the sixteen
 * real seal ceremonies and the honest item chain are R7's line.
 *
 * ⚠ SIXTEEN IDENTITIES IN COLLECTION ORDER, not a count and not a set.
 * `SealController.hasAllSealParts()` is `Main.hasSealPart(SEALS - 1) != -1`
 * — the LAST SLOT — so what the door reads is whether slot 15 is filled.
 */
const SEAL_PARTS = Array.from({ length: 16 }, (_, i) => i);
const GRANTS = [];
const PINS = ['sound', 'dead_frames'];
/** L113 holds no water, lava, ice or waterfall tile — the list is honest. */
const NO_HAZARDS = [];
const HOLD_KEY = 'up';
/** Ticks of freed walk after the removal. See the docblock's ⚠. */
const WALK_TAIL = 12;

const run = (tickCount, { persistence }) => {
    const r = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: BOOT,
        noclip: false,
        noHazards: NO_HAZARDS,
        noDamage: false,
        grants: GRANTS,
        persistence,
        equips: [],
        pins: PINS,
        save: { totem_parts: [], keys: [], seal_parts: SEAL_PARTS },
        roles: ROLES,
    });
    const inputs = [{ key: HOLD_KEY, from: 0, to: tickCount }];
    const stream = [];
    for (let k = 0; k < tickCount; k += 1) {
        stream.push({ t: k, x: r.state.x, y: r.state.y, level: r.level });
        r.advance(heldKeysAt({ inputs }, k));
    }
    return { run: r, stream };
};

const TALKED = [Object.freeze({
    level: WATCHER_FLAG.level,
    tag: WATCHER_FLAG.tag,
    note: 'the Watcher\'s dialogue — what `r6-watcher-talk` earns, declared here',
})];

// ── PHASE 1: the schedule, measured rather than chosen ────────────────
//
// ⛔ EVERY TICK BELOW IS READ OFF THE MODEL. The trigger depends on the
// walk (an accelerating held key against a 32 px CIRCLE about (128,16)),
// the open on the ceremony's own length, and the removal on the anim
// accumulator at the clamped elapsed. Writing any of them down would be
// three constants that stop describing the run the moment one changes.
//
// ⚠ THE PROBE STOPS AT THE TRANSITION, and it has to: the freed walk
// reaches `teleporter@112,0` and L115's two arrival tiles are WATER, so a
// probe that ran on would DROWN — `drownTimer` is never reset off-hazard
// and eleven cumulative ticks end the run. That refusal is what tells the
// plan where its own ceiling is.
const probe = (() => {
    const r = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: BOOT,
        noclip: false,
        noHazards: NO_HAZARDS,
        noDamage: false,
        grants: GRANTS,
        persistence: TALKED,
        equips: [],
        pins: PINS,
        save: { totem_parts: [], keys: [], seal_parts: SEAL_PARTS },
        roles: ROLES,
    });
    const held = new Set([HOLD_KEY]);
    for (let k = 0; k < 400 && r.transitions.length === 0; k += 1) r.advance(held);
    return { run: r };
})();
const ceremony = probe.run.doorCeremonies[0];
const openEvent = probe.run.doorEvents.find((e) => e.what === 'open');
const removedEvent = probe.run.doorEvents.find((e) => e.what === 'removed');
if (!ceremony || !openEvent || !removedEvent) {
    throw new Error(`plan: the door did not run its chain — ceremonies `
        + `${JSON.stringify(probe.run.doorCeremonies)}, events `
        + `${JSON.stringify(probe.run.doorEvents)}`);
}
const TRANSITION = probe.run.transitions[0];
if (!TRANSITION) {
    throw new Error('plan: the freed walk never reached the teleporter the door covers '
        + '— the margin this tape is cut with cannot be asserted');
}

const TICK_COUNT = removedEvent.t + WALK_TAIL;
if (TICK_COUNT >= TRANSITION.t) {
    throw new Error(`plan: a tape of ${TICK_COUNT} ticks runs past the transition at `
        + `${TRANSITION.t}, and L115's two arrival tiles are WATER — the last `
        + 'observations would be a drown, not a door');
}

const INPUTS = [{ key: HOLD_KEY, from: 0, to: TICK_COUNT }];

const tapeFor = (name, persistence, description) => parseTape({
    tape_version: 7,
    game: 'seedling',
    name,
    description,
    boot: BOOT,
    noclip: false,
    // ⛔ FALSE ON BOTH ARMS. L113 has no damage source at all, so this is
    // the honest declaration and a hit on either arm is a finding.
    noDamage: false,
    noHazards: NO_HAZARDS,
    grants: GRANTS,
    persistence,
    equips: [],
    pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: SEAL_PARTS },
    // ⚠ NOT DECLARED — L113 has no gameplay draw consumer.
    rng: { seed: 0, split: false },
    tick_count: TICK_COUNT,
    inputs: INPUTS,
});

const tape = tapeFor('r6-final-door', TALKED,
    'R6 slice 6c: W-DOOR. Boots into L113 three tiles south of `finaldoor@112,0` with '
    + 'the STAGED save state the rung was ruled on — sixteen seal identities in '
    + '`save.seal_parts` and `{114,0}` declared cleared, which is what `r6-watcher-talk` '
    + 'earns — and holds `up` for the whole tape. At tick 36 the walk crosses into the '
    + '32 px CIRCLE about the door\'s entity point (128,16), which fires a '
    + '`SealController` unconditionally: its CONSTRUCTOR sets `Game.freezeObjects` and '
    + 'the class never touches `Game.talking`, so all 181 of its frames are DEAD — the '
    + 'tape\'s counter does not advance, `Bot.autoAdvance` refuses to dispatch into them, '
    + 'and no tape can supply the X release that would cut it short. One tick later the '
    + 'overlay\'s `removed()` has nulled `parent.mySealController` and the SAME approach '
    + 'reaches the second arm — §2.5\'s "only on a LATER approach" refuted — so '
    + '`sprFinalDoor.play("open")` runs at tick 37. `animEnd` fires on graphic update 57, '
    + 'which is 56 ticks later because the play frame IS update 1, and `removed()` writes '
    + 'the `{113,0}` CLEAR at tick 93 — the same tick the 32x32 body stops colliding. '
    + 'The held key then walks 14 px into the cell the door occupied. ⚠ The tape stops '
    + 'twelve ticks after the removal, four short of `teleporter@112,0`: L115\'s two '
    + 'arrival tiles are water, and this window is about the door.');

const control = tapeFor('r6-final-door-control', [],
    'R6 slice 6c: the unspoken-Watcher control — the same tape with `{114,0}` NOT '
    + 'declared. `FinalDoor.update`\'s first line is '
    + '`var talkedToWatcher:Boolean = !Game.checkPersistence(0, 114)`, the only '
    + 'cross-level persistence read in the game, and it is the second of the door\'s two '
    + 'conditions (the sixteen seals, which this tape still has, are the first). What '
    + 'the control shows is not "nothing happens": the walk is identical, the approach '
    + 'crosses the circle on the SAME tick, and the `SealController` fires anyway and '
    + 'costs the same 181 dead frames — it is unconditional, and it even carries a '
    + 'different string ("Face the Watcher and return" against "Your path to redemption '
    + 'lies here"). What never becomes reachable is the second arm. `{113,0}` stays SET, '
    + 'the 32x32 body stays in the solids list, and the player stands against it at '
    + 'y 34.5 for the rest of the tape. SAME LENGTH as the drive, not a prefix: the '
    + 'control is missing a flag, not a tail.');

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const a = run(tape.tick_count, { persistence: tape.persistence });
const c = run(control.tick_count, { persistence: control.persistence });

// ── the drive ────────────────────────────────────────────────────────
check(a.run.doorCeremonies.length === 1
    && a.run.doorCeremonies[0].frames === sealControllerTicks(),
    '⛔ ONE CEREMONY, AND ITS FRAMES ARE DEAD — 60 fade + 60 wait + 60 more, derived '
    + 'by simulating `SealController.update` rather than by adding three constants',
    JSON.stringify(a.run.doorCeremonies));
check(a.run.frozenFramesOwed === sealControllerTicks(),
    '⛓⛓⛓ …and it is the WHOLE dead-frame bill of the window — the second, independent '
    + 'witness, and a much sharper one than a position',
    `frozenFramesOwed ${a.run.frozenFramesOwed} against a load fade of ~19`);
check(openEvent.t === ceremony.t + 1,
    '⛔⛔ ONE APPROACH, NOT TWO — §2.5 refuted. `SealController.removed()` nulls '
    + '`parent.mySealController` from `updateLists()`, so the door\'s VERY NEXT update '
    + 'reaches the second arm with the player still inside the circle',
    `ceremony at tick ${ceremony.t}, open at ${openEvent.t}`);
check(removedEvent.t === openEvent.t + finalDoorOpenUpdates() - 1,
    '⛔⛔⛔ THE PLAY FRAME IS THE ANIMATION\'S FIRST UPDATE — `animEnd` fires on graphic '
    + `update ${finalDoorOpenUpdates()}, which is ${finalDoorOpenUpdates() - 1} ticks `
    + 'after the play tick. `stepFinalDoor` counted from 0 and this slice corrected it',
    `open ${openEvent.t} -> removed ${removedEvent.t} (${removedEvent.t - openEvent.t} `
    + `ticks; the anim is ${finalDoorOpenUpdates()} updates)`);
const flags = a.run.finalDoorFlags;
check(flags.length === 1 && flags[0].level === 113 && flags[0].tag === 0
    && flags[0].value === false,
    '⛓⛓⛓ `{113,0}` — a CLEAR, written by `removed()`',
    JSON.stringify(flags));
check(a.run.earnedClears.length === 1 && a.run.earnedClears[0].level === 113
    && a.run.earnedClears[0].tag === 0,
    '⛓⛓ …and it reaches `earnedClears`, which is what the differential compares against '
    + 'the game\'s own `persistence_cleared`',
    JSON.stringify(a.run.earnedClears));
const endY = a.stream[a.stream.length - 1].y;
check(removedEvent.wallOpensAt === removedEvent.t + 1
    && a.stream[removedEvent.t + 1].y === a.stream[removedEvent.t].y
    && a.stream[removedEvent.t + 2].y < a.stream[removedEvent.t + 1].y,
    '⛔⛔⛔ THE WALL SURVIVES `animEnd` BY ONE TICK — `FP.world.remove` only QUEUES, '
    + 'and `updateLists()` runs AFTER `world.update()`, in which the Player has '
    + 'already swept. The game refuted the first recording on exactly this',
    `y ${a.stream[removedEvent.t].y} at animEnd (${removedEvent.t}), unchanged at `
    + `${removedEvent.t + 1}, and ${a.stream[removedEvent.t + 2].y} at `
    + `${removedEvent.t + 2}`);
check(a.run.finalDoors[0].removed === true && endY < 32 && endY > 18,
    '⛓⛓ THE WALL IS GONE AND THE HELD KEY WALKS INTO IT — inside the door\'s own '
    + '[112,144) x [0,32) footprint, and short of the teleporter it covered',
    `y ${a.stream[removedEvent.t].y} at the removal, ${endY} at the end of the tape; `
    + `the door's box was ${JSON.stringify({ y: 0, bottom: 32 })} and `
    + `teleporter@112,0 needs y < 18`);
check(a.run.transitions.length === 0
    && TRANSITION.t - tape.tick_count >= 4,
    '⚠ AND IT STOPS SHORT OF L115, whose two arrival tiles are WATER',
    `the tape is ${tape.tick_count} ticks; the transition would fire at `
    + `${TRANSITION.t} (margin ${TRANSITION.t - tape.tick_count})`);
check(a.run.damage.hits === 0 && a.run.playerHits.length === 0,
    '⛓ ZERO DAMAGE — L113 has no damage source, asserted rather than assumed',
    `hits ${a.run.damage.hits}, ${a.run.playerHits.length} contact(s)`);

// ── the control ──────────────────────────────────────────────────────
check(c.run.doorCeremonies.length === 1
    && c.run.doorCeremonies[0].t === a.run.doorCeremonies[0].t
    && c.run.doorCeremonies[0].frames === a.run.doorCeremonies[0].frames,
    '⛓⛓⛓ THE CEREMONY IS UNCONDITIONAL — same tick, same 181 dead frames, no flag',
    `control ${JSON.stringify(c.run.doorCeremonies)} against drive `
    + `${JSON.stringify(a.run.doorCeremonies)}`);
check(c.run.doorEvents.length === 0 && c.run.finalDoorFlags.length === 0
    && c.run.earnedClears.length === 0,
    '⛔⛔⛔ …AND THE DOOR NEVER OPENS. `{113,0}` is never written',
    `events ${JSON.stringify(c.run.doorEvents)}, earnedClears `
    + `${JSON.stringify(c.run.earnedClears)}`);
check(c.run.finalDoors[0].removed === false
    && c.run.finalDoors[0].seenSeal === true,
    '⛓ the body is still in the solids list, and `seenSeal` is still latched',
    JSON.stringify(c.run.finalDoors));
const cEndY = c.stream[c.stream.length - 1].y;
check(cEndY === a.stream[removedEvent.t].y,
    '⛓⛓ THE CONTROL\'S PLAYER IS PINNED AGAINST THE DOOR for the whole tail',
    `control ends at y ${cEndY}; the drive was at ${a.stream[removedEvent.t].y} on the `
    + `removal tick and reached ${endY}`);

// ── the pair's shape ─────────────────────────────────────────────────
check(JSON.stringify(tape.inputs) === JSON.stringify(control.inputs)
    && tape.tick_count === control.tick_count,
    '⛔ THE INPUTS AND THE LENGTH ARE BYTE-IDENTICAL — the arms differ in ONE BOOT '
    + 'FIELD and in nothing else. The first R6 pair that is not a prefix',
    `${JSON.stringify(tape.inputs)}, ${tape.tick_count} ticks on both; drive `
    + `persistence ${JSON.stringify(tape.persistence)} against control `
    + `${JSON.stringify(control.persistence)}`);
check(JSON.stringify(tape.save) === JSON.stringify(control.save),
    '⛓ …and the SEALS are identical too, so the control is not "the save is short"',
    `seal_parts ${JSON.stringify(tape.save.seal_parts)} on both`);
let firstDiff = -1;
for (let i = 0; i < c.stream.length; i += 1) {
    if (a.stream[i].x !== c.stream[i].x || a.stream[i].y !== c.stream[i].y) {
        firstDiff = i; break;
    }
}
check(firstDiff === removedEvent.t + 2,
    '⛔⛔⛔ THE ARMS ARE POSITION-IDENTICAL FOR TWO TICKS PAST `animEnd` — the body '
    + 'collides for all 56 updates of the animation AND for the frame the removal is '
    + 'QUEUED on, because `Engine.update` runs `world.update()` (in which the Player '
    + 'sweeps) before `updateLists()` (in which the door leaves the type list)',
    `first positional difference at tick ${firstDiff}; \`animEnd\` is at `
    + `${removedEvent.t}, the wall opens at ${removedEvent.wallOpensAt}, and the play `
    + `tick was ${openEvent.t}`);

for (const k of checks) {
    console.log(`${k.ok ? '  ok ' : 'FAIL '}${k.name}\n       ${k.detail}`);
}
console.log('');
console.log(`ceremony ${ceremony.t} (+${ceremony.frames} dead) -> open ${openEvent.t} `
    + `-> removed ${removedEvent.t}; door at (${FINAL_DOOR.box.w}x${FINAL_DOOR.box.h}) `
    + `entity (128,16), seeDistance ${FINAL_DOOR.seeDistance}`);
console.log(`both arms ${tape.tick_count} ticks; the covered teleporter would fire at `
    + `${TRANSITION.t}`);

if (checks.some((k) => !k.ok)) {
    console.error('\n⛔ at least one check FAILED — nothing written');
    process.exit(1);
}

if (WRITE) {
    for (const t of [tape, control]) {
        const path = join(MODULE, 'fixtures', 'tapes', `${t.name}.json`);
        writeFileSync(path, `${serializeTape(t)}\n`);
        console.log(`wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the tapes)');
}
