#!/usr/bin/env node
/**
 * plan-seedling-r6-wtalk — ⛓⛓⛓ W-TALK: THE WATCHER'S DIALOGUE, AND THE
 * FIRST LEDGER ROW A ROUTE CAN EARN BY WALKING AWAY.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 6c. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §16.7 item 1, with the
 * mechanics transcribed at §16.6/§16.6a and modelled in `endingChain.js`.
 *
 * ── WHAT THE WINDOW DOES ──────────────────────────────────────────────
 *
 * It boots into level 114 at (80, 96) — sixteen pixels dead south of
 * `watcher@72,72`'s entity point (80, 80) — and holds `up` for the whole
 * tape. The stance does three jobs at once and none of them needs steering:
 *
 *   1. it is INSIDE the 24 px talk circle on the room's first update, and
 *      `keyNeeded` is `!Game.checkPersistence(tag)` on a boot whose
 *      persistence array is all `true`, so the dialogue **opens with no key
 *      pressed at all**. That is the window's first claim: a Watcher
 *      auto-talks, and nothing in the tape asks it to;
 *   2. it clears the WATCHER'S LIVE SEED by 7 px on the y axis and misses
 *      it on x entirely (the seed box is `[65,75) x [73,87)`, the player's
 *      is `[78,82) x [94,99)`) — and that seed is a SOFT-LOCK, not a
 *      pickup (`endingChain.watcherSeedBox`);
 *   3. and the held key is INERT for the whole dialogue, because
 *      `NPC.talk()` raises `Game.freezeObjects` above the key test and
 *      `Mobile.mobileUpdate` reads it on the same frame. The player walks
 *      only on the frame the dialogue OPENS and on the frame it ENDS.
 *
 * The treatment is 40 `primary` releases at a cadence of 5 — two per page
 * of a twenty-page text, which is what `stepDialogue`'s two arms cost:
 * one release skips the typing to `length - 1`, the next finds
 * `currentCharacter >= length` and turns the page.
 *
 * ⛓ FIVE IS ONE ABOVE THE MEASURED FLOOR. `framesPerCharacter` is the
 * watcher's own `frames="3"` attribute, so a character lands every FOUR
 * frames and a cadence of 4 turns every page on the very frame the render
 * ticks `currentCharacter` over. Both cadences finish in 40 releases (the
 * script checks 4 and 5 and reports both); 5 is taken so the schedule is
 * not sitting on the fencepost it derives.
 *
 * ── ⛔⛔⛔ THE PAIR, AND WHY IT IS NOT A WALK-AWAY (trap 102, AMENDED) ──
 *
 * The obvious control for "the dialogue writes the flag" is "walk out of
 * range instead". **It writes the flag too** — `NPC.talk`'s out-of-range
 * arm is `talked = false; if (talking) talking = false;` and the `talking`
 * SETTER's false branch ends with `doneTalking()`, still guarded by a
 * `checkPersistence(tag)` that is still set.
 *
 * ⛔ AND THE SLICE FOUND THE SHARPER HALF: **there is no mid-dialogue walk
 * to take.** `talk()`'s `if (talking)` block raises `Game.freezeObjects` on
 * its FIRST line — above the key test and above the radius test — and the
 * NPC updates before the player, so from the dialogue's second frame onward
 * the player cannot move at all. The out-of-range arm is reachable from
 * exactly ONE frame: the one the dialogue OPENS on, which is live because
 * `startTalking()` runs BELOW the block that raises the freeze. A stance
 * that boots on the circle and steps outward on that frame earns `{114,0}`
 * **at tick 2, with zero pages read and no key pressed**
 * (`watcherL114.test.js` drives it). So a walk-away control would not
 * merely pay the same flag; it would pay it instantly and read nothing.
 *
 * ⇒ the control is the **LAST X RELEASE DELETED** — the one-primitive-fewer
 * prefix shape — and the tape ENDS INSIDE THE CIRCLE with the dialogue on
 * its twentieth page. `myCurrentText` is 19 of 20, `talking` is still true,
 * the freeze is still up, and the player is still standing where the boot
 * put them.
 *
 * ⛓⛓ AND THE MOVEMENT SPAN IS FROM A SEPARATE GENERATOR (§12). Both arms
 * hold `up` from tick 0; only the `to` differs, because the control is a
 * PREFIX. That single span is what turns a persistence-only difference into
 * a POSITIONAL one: the drive's dialogue ends, the freeze lifts, and the
 * held key walks the player 46 px north into the wall at y 50.05. The
 * control's freeze never lifts, so its player never leaves y 96. The two
 * observation streams diverge on the tick `doneTalking()` runs.
 *
 * ⛓ It also witnesses the OTHER half of trap 102 two-sided: the drive's
 * walk leaves the 24 px circle ~40 ticks AFTER the write, so the write's
 * recorded cause is `done` and the radius exit that follows it earns
 * nothing — `Watcher.update` gates `super.update()` on the tag it just
 * cleared.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r6-wtalk.mjs [--write]
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
const { TALK_RANGE, WATCHER } = await import(join(MODULE, 'endingChain.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));

/**
 * ⚠ THE BOOT BLOCK IS `new Game(level, x, y)`'s ARGUMENTS, not the entity
 * point — `spawnFromBoot` adds `(Tile.w/2, Tile.h/2)`. Tile (4,5)'s corner
 * is (72, 88); the spawn is (80, 96).
 */
const BOOT = { level: 114, x: 72, y: 88 };
/**
 * ⛔ NOTHING IS GRANTED, AND THAT IS A DECISION.
 *
 * Every X in this tape is a dialogue release. With a sword in the slot each
 * one would also be a `useItem` -> `slashing` -> a hit rect scheduled for a
 * FROZEN tick, which `levelRun` refuses by name (`genericHit` returns at its
 * first line under `Game.freezeObjects`, so the press would do nothing and
 * the tape would be claiming a swing the game swallows). W-blood is the
 * window that grants the sword, and it does so only after this dialogue has
 * cleared the tag its hits gate on.
 *
 * ⛓ `hasShield` is deliberately absent too: `Watcher.update`'s last line is
 * `visible = Player.hasShield`, which is render-side only (§13.8), so an
 * invisible Watcher talks, freezes and writes exactly like a visible one.
 */
const GRANTS = [];
const PINS = ['sound', 'dead_frames'];
/** L114 holds no water, lava, ice or waterfall tile — the list is honest. */
const NO_HAZARDS = [];

const HOLD_KEY = 'up';
/** One above the measured floor; see the docblock. */
const CADENCE = 5;
/** The first release edge. A span `[t, t+1)` releases on tick `t + 1`. */
const FIRST_PRESS = 1;
/** Ticks after the write for the freed walk to finish and settle. */
const WALK_TAIL = 60;
/** Ticks after the deleted release for the control to show the pin holding. */
const CONTROL_TAIL = 40;

const press = (t) => ({ key: 'primary', from: t, to: t + 1 });

const run = (inputs, tickCount) => {
    const r = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: BOOT,
        noclip: false,
        noHazards: NO_HAZARDS,
        noDamage: false,
        grants: GRANTS,
        persistence: [],
        equips: [],
        pins: PINS,
        save: { totem_parts: [], keys: [], seal_parts: [] },
        roles: ROLES,
    });
    const stream = [];
    for (let k = 0; k < tickCount; k += 1) {
        stream.push({
            t: k, x: r.state.x, y: r.state.y, level: r.level,
            page: r.watchers[0]?.page ?? null,
            talking: r.watchers[0]?.talking ?? null,
        });
        r.advance(heldKeysAt({ inputs }, k));
    }
    return { run: r, stream };
};

// ── PHASE 1: how many releases does the text cost, and at what cadence ──
//
// ⛔ DERIVED, NOT COUNTED BY HAND. The page count is a property of
// `endlineText`'s wrap at `lineLength` 28, and the RELEASE count is a
// property of `stepDialogue`'s two arms against `framesPerCharacter` 3.
// Asking the model is the alternative to counting twenty pages twice.
const probeFor = (cadence, n = 80) => {
    const inputs = [
        { key: HOLD_KEY, from: 0, to: 4000 },
        ...Array.from({ length: n }, (_, i) => press(FIRST_PRESS + i * cadence)),
    ];
    const r = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: BOOT,
        noclip: false,
        noHazards: NO_HAZARDS,
        noDamage: false,
        grants: GRANTS,
        persistence: [],
        equips: [],
        pins: PINS,
        save: { totem_parts: [], keys: [], seal_parts: [] },
        roles: ROLES,
    });
    for (let k = 0; k < 4000; k += 1) {
        r.advance(heldKeysAt({ inputs }, k));
        if (r.watcherTalks.length) {
            const doneAt = r.watcherTalks[0].t;
            // The release that turned the last page is the last one whose
            // edge landed at or before the write.
            const used = Math.floor((doneAt - 1 - FIRST_PRESS) / cadence) + 1;
            return { doneAt, used, talk: r.watcherTalks[0] };
        }
    }
    throw new Error(`plan: cadence ${cadence} never exhausted the dialogue in 4000 ticks`);
};

const floor4 = probeFor(4);
const chosen = probeFor(CADENCE);
if (floor4.used !== chosen.used) {
    throw new Error(`plan: cadence 4 needs ${floor4.used} releases and cadence `
        + `${CADENCE} needs ${chosen.used} — a cadence that changes the RELEASE count `
        + 'is not "one above the floor", it is a different schedule');
}

const RELEASES = chosen.used;
const PRESS_TICKS = Array.from({ length: RELEASES },
    (_, i) => FIRST_PRESS + i * CADENCE);
const LAST_PRESS = PRESS_TICKS[PRESS_TICKS.length - 1];
const WRITE_TICK = chosen.doneAt;

const TICK_COUNT = WRITE_TICK + WALK_TAIL;
const CONTROL_TICK_COUNT = LAST_PRESS + CONTROL_TAIL;

const INPUTS = [
    { key: HOLD_KEY, from: 0, to: TICK_COUNT },
    ...PRESS_TICKS.map(press),
];
/**
 * ⛔ THE LAST RELEASE DELETED — and NOT a walk-away (§16.6, trap 102). The
 * movement span is the same generator's, unchanged but for the `to`.
 */
const CONTROL_INPUTS = [
    { key: HOLD_KEY, from: 0, to: CONTROL_TICK_COUNT },
    ...PRESS_TICKS.slice(0, -1).map(press),
];

const tapeFor = (name, inputs, tickCount, description) => parseTape({
    tape_version: 7,
    game: 'seedling',
    name,
    description,
    boot: BOOT,
    noclip: false,
    // ⛔ FALSE ON BOTH ARMS, and the room has no damage source at all — so
    // this is the honest declaration rather than a crutch, and a hit of any
    // kind on either arm is a finding.
    noDamage: false,
    noHazards: NO_HAZARDS,
    grants: GRANTS,
    persistence: [],
    equips: [],
    pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: [] },
    // ⚠ NOT DECLARED. The split is default-off and this window has no
    // gameplay draw consumer — L114 holds no boss and no enemy — so the
    // stream position is nothing the model reads. W-owl is the window that
    // declares it.
    rng: { seed: 0, split: false },
    tick_count: tickCount,
    inputs,
});

const tape = tapeFor('r6-watcher-talk', INPUTS, TICK_COUNT,
    'R6 slice 6c: W-TALK. Boots into L114 at (80,96), sixteen pixels dead south of '
    + '`watcher@72,72` and INSIDE its 24 px talk circle, and holds `up` for the whole '
    + 'tape. The dialogue opens on the room\'s first update with no key pressed — '
    + '`Watcher.as:46` sets `keyNeeded = !Game.checkPersistence(tag)` and a fresh '
    + 'boot\'s persistence array is all true, so a placed Watcher AUTO-TALKS on '
    + 'proximity. `NPC.talk()` then raises `Game.freezeObjects` above its own key test '
    + 'on every later frame, so the held key is inert for the whole dialogue and the '
    + 'player moves on exactly two frames: the one that opens it and the one that ends '
    + 'it. 40 `primary` releases at a cadence of 5 turn twenty pages (two per page — '
    + 'one skips the typing to `length - 1`, the next finds `currentCharacter >= '
    + 'length`), and the twentieth page exhausts `myText`, which runs `talking = false` '
    + '-> the setter -> `Watcher.doneTalking()` -> the `{114,0}` CLEAR. The freeze '
    + 'lifts on that frame and the held key walks the player 46 px north into the wall '
    + 'at y 50.05 — which also takes them out of the talk radius ~40 ticks after the '
    + 'write, where `Watcher.update`\'s own `checkPersistence` gate now makes `talk()` '
    + 'unreachable. Throughout, the stance clears the WATCHER\'S LIVE SEED ([65,75) x '
    + '[73,87), held out for pages 9..19) by 7 px on y and misses it entirely on x: '
    + 'collecting that seed is not a lost pickup but a soft-lock — `Game.cutscene[2] = '
    + 'true` and a reboot into a level with no `seed` to grow, after which '
    + '`Game.as:956` spawns every later player input-dead.');

const control = tapeFor('r6-watcher-control', CONTROL_INPUTS, CONTROL_TICK_COUNT,
    'R6 slice 6c: the one-release-fewer control — the same tape with the FORTIETH and '
    + 'last X release deleted. ⛔ IT IS NOT A WALK-AWAY, and that is the finding it is '
    + 'built on: `NPC.talk`\'s out-of-range arm sets `talking = false`, whose setter '
    + 'ends with `doneTalking()`, so leaving the 24 px circle mid-dialogue EARNS '
    + '`{114,0}` exactly as finishing it does — a walk-away control would clear the '
    + 'flag it exists to withhold. So the tape ENDS INSIDE THE CIRCLE instead, with '
    + 'the dialogue on its twentieth and last page, `talking` still true, '
    + '`Game.freezeObjects` still up and the player still standing at the boot '
    + 'position. The movement span is byte-identical (one `up` from tick 0; only the '
    + '`to` differs, because the control is a PREFIX), so the divergence is entirely '
    + 'the missing release: `{114,0}` is never written, `persistence_cleared` stays '
    + 'empty, and the 46 px walk the drive\'s freed player takes never happens.');

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const a = run(tape.inputs, tape.tick_count);
const c = run(control.inputs, control.tick_count);

// ── the drive ────────────────────────────────────────────────────────
const talks = a.run.watcherTalks;
check(talks.length === 1 && talks[0].cause === 'done'
    && talks[0].page === talks[0].pages,
    '⛓⛓⛓ THE DIALOGUE IS EXHAUSTED — twenty pages turned, and the cause is `done`',
    JSON.stringify(talks));
check(talks.length === 1 && talks[0].flag.level === 114 && talks[0].flag.tag === 0
    && talks[0].flag.value === false,
    '⛓⛓⛓ `{114,0}` — a CLEAR, written by `Watcher.doneTalking()`',
    JSON.stringify(talks[0]?.flag));
const cleared = a.run.earnedClears;
check(cleared.length === 1 && cleared[0].level === 114 && cleared[0].tag === 0,
    '⛓⛓ …and it reaches `earnedClears`, which is what the differential compares '
    + 'against the game\'s own `persistence_cleared`',
    JSON.stringify(cleared));
check(a.run.frozenFramesOwed === 0,
    '⛔ ZERO FROZEN FRAMES OWED — a dialogue frame is a TAPE TICK, not a dead one '
    + '(`Game.update`\'s `else if (inventory) inventory.open = false` lowers the flag '
    + 'every frame while `Game.talking`)',
    `frozenFramesOwed ${a.run.frozenFramesOwed} across ${tape.tick_count} ticks`);

// The dialogue opened with NO key pressed: the first release edge is at
// FIRST_PRESS + 1, and the stream is already talking before it.
const openedAt = a.stream.find((o) => o.talking === true)?.t;
check(openedAt !== undefined && openedAt <= FIRST_PRESS,
    '⛔⛔ THE DIALOGUE OPENS ON PROXIMITY, BEFORE ANY RELEASE — `keyNeeded` is false',
    `talking first observed at tick ${openedAt}; the first release edge is at `
    + `${FIRST_PRESS + 1}`);

// The stance, against the live seed.
const seedTicks = a.run.watcherSeedLive;
const minClear = Math.min(...seedTicks.map((s) => Math.max(s.clearanceX, s.clearanceY)));
check(seedTicks.length > 0
    && seedTicks[0].page === WATCHER.seedIndexMin
    && seedTicks[seedTicks.length - 1].page === WATCHER.seedIndexMax
    && minClear > 0,
    '⛔⛔⛔ THE LIVE SEED REALLY WAS THERE — pages 9..19, and the stance cleared it '
    + 'every tick. The POSITIVE witness for a refusal no shipped tape can reach',
    `${seedTicks.length} ticks with the seed out, pages `
    + `${seedTicks[0]?.page}..${seedTicks[seedTicks.length - 1]?.page}, minimum `
    + `clearance ${minClear} px; player box `
    + `${JSON.stringify(playerBoxAt(80, 96))} against seed box `
    + `${JSON.stringify(a.run.watchers[0]?.seedBox)}`);

// The freeze: the player moves on exactly two frames of the dialogue.
const movedDuringDialogue = [];
for (let i = 1; i <= WRITE_TICK && i < a.stream.length; i += 1) {
    if (a.stream[i].y !== a.stream[i - 1].y) movedDuringDialogue.push(i);
}
check(movedDuringDialogue.length === 2
    && movedDuringDialogue[0] === 1
    && movedDuringDialogue[1] === WRITE_TICK,
    '⛔⛔ THE HELD KEY IS INERT FOR THE WHOLE DIALOGUE — the player moves on the '
    + 'OPENING frame and on the ENDING one, and on nothing between them',
    `moved on observations ${movedDuringDialogue.join(', ')}; the write is at tick `
    + `${WRITE_TICK}`);

// …and then walks.
const endY = a.stream[a.stream.length - 1].y;
check(endY < 60,
    '⛓⛓ AND THE FREED KEY WALKS — 46 px north, into the wall',
    `y ${a.stream[0].y} at the boot, ${a.stream[WRITE_TICK]?.y} at the write, `
    + `${endY} at the end of the tape`);
const leftAt = a.stream.find((o) => o.t > WRITE_TICK
    && Math.hypot(80 - o.x, 80 - o.y) > TALK_RANGE)?.t;
check(leftAt !== undefined && leftAt > WRITE_TICK,
    '⛓ …out of the 24 px circle, WELL AFTER the write — so the radius exit earned '
    + 'nothing and the write\'s cause really is the dialogue',
    `left the circle at tick ${leftAt}, ${leftAt - WRITE_TICK} ticks after the write; `
    + `\`watcherTalks\` still has exactly ${talks.length} entry`);
check(a.run.damage.hits === 0 && a.run.playerHits.length === 0,
    '⛓ ZERO DAMAGE — L114 has no damage source, asserted rather than assumed',
    `hits ${a.run.damage.hits}, ${a.run.playerHits.length} contact(s)`);

// ── the control ──────────────────────────────────────────────────────
check(c.run.watcherTalks.length === 0 && c.run.watcherFlags.length === 0
    && c.run.earnedClears.length === 0,
    '⛔⛔⛔ THE CONTROL NEVER WRITES `{114,0}` — one release short of twenty pages',
    `watcherTalks ${JSON.stringify(c.run.watcherTalks)}, earnedClears `
    + `${JSON.stringify(c.run.earnedClears)}`);
const cw = c.run.watchers[0];
check(cw.talking === true && cw.page === cw.pages - 1 && cw.cleared === false,
    '⛓⛓ …and it ENDS INSIDE THE CIRCLE, still talking, on the LAST page — the '
    + 'walk-away control trap 102 forbids would have cleared the flag instead',
    `page ${cw.page} of ${cw.pages}, talking ${cw.talking}, distance `
    + `${cw.distance.toFixed(2)} against a talk range of ${cw.talkRange}`);
const cEndY = c.stream[c.stream.length - 1].y;
check(cEndY === a.stream[1].y,
    '⛓⛓ THE CONTROL\'S PLAYER NEVER LEAVES THE OPENING FRAME\'S POSITION',
    `control ends at y ${cEndY}; the drive's opening frame left it at `
    + `${a.stream[1].y} and its freed walk ended at ${endY}`);

// ── the pair's shape ─────────────────────────────────────────────────
const movement = (t) => t.inputs.filter((s) => s.key === HOLD_KEY);
check(movement(tape).length === 1 && movement(control).length === 1
    && movement(tape)[0].from === movement(control)[0].from,
    '⛔ THE MOVEMENT SPANS ARE FROM A SEPARATE GENERATOR AND ARE IDENTICAL',
    `drive ${JSON.stringify(movement(tape))} vs control `
    + `${JSON.stringify(movement(control))} — only the \`to\` differs, because the `
    + `control is a PREFIX (${control.tick_count} against ${tape.tick_count})`);
const drivePresses = tape.inputs.filter((s) => s.key === 'primary');
const ctlPresses = control.inputs.filter((s) => s.key === 'primary');
check(drivePresses.length === RELEASES && ctlPresses.length === RELEASES - 1
    && JSON.stringify(drivePresses.slice(0, -1)) === JSON.stringify(ctlPresses),
    '⛓ ONE PRIMITIVE FEWER, and every earlier release is byte-identical',
    `${drivePresses.length} releases against ${ctlPresses.length}; the deleted one is `
    + `${JSON.stringify(drivePresses[drivePresses.length - 1])}`);
let firstDiff = -1;
for (let i = 0; i < c.stream.length; i += 1) {
    if (a.stream[i].x !== c.stream[i].x || a.stream[i].y !== c.stream[i].y) {
        firstDiff = i; break;
    }
}
check(firstDiff === -1 || firstDiff > LAST_PRESS,
    '⛓ the two arms are position-identical until the missing release',
    firstDiff === -1 ? 'identical for the whole control'
        : `first positional difference at tick ${firstDiff}; the deleted release edge `
        + `is at ${LAST_PRESS + 1} and the write at ${WRITE_TICK}`);

for (const k of checks) {
    console.log(`${k.ok ? '  ok ' : 'FAIL '}${k.name}\n       ${k.detail}`);
}
console.log('');
console.log(`pages ${talks[0]?.pages}; releases ${RELEASES} at cadence ${CADENCE} `
    + `(cadence 4 needs ${floor4.used} and finishes at ${floor4.doneAt}); first press `
    + `${PRESS_TICKS[0]}, last ${LAST_PRESS}`);
console.log(`{114,0} written at tick ${WRITE_TICK}; drive ${tape.tick_count} ticks, `
    + `control ${control.tick_count}`);

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
