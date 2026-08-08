#!/usr/bin/env node
/**
 * plan-seedling-r6-wblood — ⛓⛓⛓ W-BLOOD: FOUR SWORD HITS, A PICKUP THAT
 * SPAWNS ON THE PLAYER, AND A REBOOT THE TAPE DID NOT ORDER.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 6d. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §16.7 item 3 and §17.10
 * item 1, with the mechanics at §14.6/§14.8 and modelled in
 * `endingChain.js`.
 *
 * ── WHAT THE WINDOW DOES ──────────────────────────────────────────────
 *
 * It boots into L114 at (80, 96) — W-TALK'S OWN STANCE — with `{114,0}`
 * DECLARED CLEARED and a sword granted, taps `up` for one tick to face the
 * Watcher, and swings four times.
 *
 *   1. ⛔ **THE DECLARATION IS THE POINT, NOT A SHORTCUT.** `Watcher.hit()`
 *      opens with `!Game.checkPersistence(tag)`, so the hits count only
 *      once the tag is OFF — and the only thing that turns it off is
 *      `doneTalking()`. W-blood is W-talk's CONTINUATION: the same room,
 *      the same stance, the state W-talk earns declared rather than re-read
 *      (the staged-ending ruling, and the same shape W-door used).
 *   2. ⛔⛔ **AND THE SAME DECLARATION SILENCES THE DIALOGUE.**
 *      `Watcher.update` gates `super.update()` — i.e. `talk()` — on the
 *      same `checkPersistence`, so a cleared boot cannot talk at all: no
 *      pages, no freeze, and NO LIVE SEED (its arm needs the tag SET). Trap
 *      91's soft-lock is W-talk's alone, and this window's room is clean.
 *      One flag, two arms, opposite senses.
 *   3. ⛓ **FOUR PRESSES IS FOUR HITS AND IT IS DERIVED.** §13.2's five hit
 *      tests all land inside `hitsTimer = 25`, so tests 2..5 are refused —
 *      the script measures the cadence FLOOR (the first spacing at which a
 *      press's own FIRST test lands) and takes one above it, so the
 *      schedule is not sitting on the fencepost it derived.
 *   4. ⛓⛓ **THE FOURTH HIT SPAWNS THE SEED ON THE PLAYER** and the pickup
 *      collects itself: `Watcher.update` adds it at
 *      `int(p.x - 8) + 8, int(p.y - 8) + 8` and `Pickup.update`'s overlap
 *      test finds it on its very first update. No walk at all — the
 *      cheapest possible second witness of the Seed machinery, which is
 *      what §8.17.2 ruled W-blood in for.
 *
 * ── ⛔⛔⛔ THE TWO THINGS THAT COULD MAKE THE RECORD UNREADABLE ────────
 *
 * `Seed.removeSelf` is a 200-frame frozen cover fade and then
 * `FP.world = new Game(1, 64, 96, false)` with `Game.cutscene[1]` set. L1
 * holds `oracle@64,32`, and `Oracle.doneTalking()` under `cutscene[1]` is
 * `exitToMenu()` — so the branch §2.5 said had "no credits, no menu" ends
 * in one, and `R6_BLOOD_MENU_DERIVATION` is the derivation that says so.
 *
 * The scripted walk (`Game.as:955-960`, `v.y = -1` under friction 0.25 =
 * 0.75 px/tick, clamped at `p.y <= 64`) stops the player at **63.5**, which
 * is **23.5 px** from the Oracle's entity point (72,40) — INSIDE its 24 px
 * talk circle. §17.10 priced that as "a boundary, not a margin".
 *
 * ⛓⛓ IT IS A BOUNDARY WITH TWO INDEPENDENT LOCKS ON IT, and this slice
 * measured both:
 *
 *   · **`keyNeeded` IS TRUE FOR THE ORACLE.** `NPCs/NPC.as:41` declares it
 *     `true` and `Oracle` — unlike `Watcher`, which assigns
 *     `!Game.checkPersistence(tag)` — never touches it. So proximity alone
 *     does NOT open the dialogue; it takes an `Input.released(p.keys[6])`
 *     while in range.
 *   · **AND THE HARNESS CANNOT SUPPLY ONE.** `Bot.autoAdvance` is called
 *     only from inside the dead-frame gate and returns immediately unless
 *     `Game.talking || helpUp` — so it presses X into a dialogue that is
 *     already up and can never open one. Trap 92's hazard is real for a
 *     dialogue in progress and inert for a dialogue that has not started.
 *
 * ⇒ the tape may stand in the circle for as long as it likes, PROVIDED no
 * key is live after the reboot. `levelRun` refuses a span inside the
 * scripted walk outright (two throws: any hold, and an X release in range),
 * and `oracleApproach` is the positive witness that the circle really was
 * entered — trap 101's shape, this rung's second use of it.
 *
 * ── THE PAIR: THE FOURTH PRESS DELETED ────────────────────────────────
 *
 * The one-primitive-fewer PREFIX shape (W-totem's), and the primitive is
 * the fourth landing press. It has to be a prefix rather than an equal:
 * every later `primary` in the drive is a DIALOGUE release, and a dialogue
 * release in a room with no dialogue is a SWORD SWING — it would land the
 * fourth hit the control exists to withhold, thirty ticks late. So the
 * control ends after the third hit's tail, still in L114, with
 * `createdSeed` false and `Game.cutscene` untouched.
 *
 * ⇒ the discriminator is the LEVEL SEQUENCE (114 -> 1 against 114) plus
 * `cutscene[1]`, exactly as `R6_BLOOD_MENU_DERIVATION` requires — never "a
 * menu happened", which both branches of the ending can produce.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r6-wblood.mjs [--write]
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
const {
    BLOODY_SEED_TEXT, CUTSCENE_1_WALK, ORACLE, SEED_ARMS, WATCHER, coverFadeFrames,
} = await import(join(MODULE, 'endingChain.js'));
const { SLASH_HIT_TICKS } = await import(join(MODULE, 'presses.js'));

/**
 * ⚠ W-TALK'S BOOT BLOCK, UNCHANGED — tile (4,5)'s corner is (72,88) and
 * `spawnFromBoot` adds the half tile, so the spawn is (80,96), sixteen
 * pixels dead south of `watcher@72,72`'s entity point (80,80).
 */
const BOOT = { level: 114, x: 72, y: 88 };
/**
 * ⛔ THE DECLARATION IS W-TALK'S EARNINGS, and `UNTOUCHABLE_CLEARS` binds
 * only the DERIVED offer list, never a tape (§17.8).
 */
const PERSISTENCE = [{
    level: 114,
    tag: 0,
    note: 'the Watcher\'s dialogue — what `r6-watcher-talk` earns. `Watcher.hit()` '
        + 'gates on `!Game.checkPersistence(tag)`, so this is what makes the sword '
        + 'count at all; it also silences `talk()` and with it the live Seed.',
}];
const GRANTS = [{ level: 114, items: ['sword'] }];
const PINS = ['sound', 'dead_frames'];
/** Neither L114 nor L1 holds water, lava, ice or a waterfall. */
const NO_HAZARDS = [];

/** One tick of `up`: enough to face the Watcher, and 0.80 px of walk. */
const FACE_SPAN = { key: 'up', from: 0, to: 1 };
/** The first sword press. A span `[t, t+1)` fires its rect on `t + 1`. */
const FIRST_PRESS = 1;
/** Ticks after the third hit for the control to show the seed not spawning. */
const CONTROL_TAIL = 40;
/** Ticks after the walk's clamp for the drive to show the player parked. */
const WALK_TAIL = 40;

const press = (t) => ({ key: 'primary', from: t, to: t + 1 });

const freshRun = () => createLevelRun({
    levelSource: atlasLevelSource(),
    boot: BOOT,
    noclip: false,
    noHazards: NO_HAZARDS,
    noDamage: false,
    grants: GRANTS,
    persistence: PERSISTENCE,
    equips: [],
    pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: [] },
    roles: ROLES,
});

const run = (inputs, tickCount) => {
    const r = freshRun();
    const stream = [];
    for (let k = 0; k < tickCount; k += 1) {
        stream.push({
            t: k, x: r.state.x, y: r.state.y, level: r.level,
            hits: r.watchers[0]?.hits ?? null,
        });
        r.advance(heldKeysAt({ inputs }, k));
    }
    return { run: r, stream };
};

// ── PHASE 1: the press cadence, DERIVED FROM THE TIMER ────────────────
//
// ⛔ NOT `hitsTimerMax` READ OFF THE CLASS. The spacing a tape needs is not
// 25 but "25 plus wherever the decrement sits relative to the hit test",
// and the Watcher updates BEFORE the Player — so the timer set on tick N is
// already decremented once by the time tick N+1's rect fires. And §13.2's
// FIVE hit tests widen the answer again: a press one tick too early still
// lands, on its SECOND test rather than its first. The floor this measures
// is the tighter of the two questions — the first spacing at which a
// press's OWN FIRST TEST lands — because that is the one that makes "one
// press, one hit" a fact about presses rather than about repeats.
const probeCadence = (cadence) => {
    const inputs = [
        FACE_SPAN,
        ...Array.from({ length: 4 }, (_, i) => press(FIRST_PRESS + i * cadence)),
    ];
    const r = freshRun();
    for (let k = 0; k < 400; k += 1) {
        r.advance(heldKeysAt({ inputs }, k));
        if (r.seedSpawns.length) break;
    }
    const landed = r.watcherHits.filter((h) => h.landed);
    // Which of the five tests of each press was the one that landed?
    const tests = landed.map((h, i) => h.t - (FIRST_PRESS + i * cadence));
    return { landed, tests, spawns: r.seedSpawns, hits: r.watcherHits };
};

let floor = null;
for (let c = 1; c <= 40; c += 1) {
    const p = probeCadence(c);
    if (p.landed.length === 4 && p.tests.every((t) => t === 1)) { floor = c; break; }
}
if (floor === null) {
    throw new Error('plan: no press cadence in 1..40 lands all four hits on test 1');
}
const CADENCE = floor + 1;
const chosen = probeCadence(CADENCE);
const atFloor = probeCadence(floor);
const belowFloor = probeCadence(floor - 1);

const HIT_PRESSES = Array.from({ length: 4 }, (_, i) => FIRST_PRESS + i * CADENCE);
const THIRD_PRESS = HIT_PRESSES[2];
const FOURTH_PRESS = HIT_PRESSES[3];
const SPAWN = chosen.spawns[0];

// ── PHASE 2: the seed's dialogue, and how many releases it costs ──────
//
// ⛔ THE TEXT IS A CONSTRUCTOR LITERAL — the THIRD shape a ceremony's text
// can come from (`endingChain.BLOODY_SEED_TEXT`) — and the NPC it spawns
// takes `Pickup.DEF_TEXT_SPEED` 6 and `_lineLength` 32, neither of which is
// the placed Watcher's (3 and 28). So the page count and the release count
// are the pickup family's, not the dialogue's this room just ran.
const probeTalk = (cadence, from) => {
    const inputs = [
        FACE_SPAN,
        ...HIT_PRESSES.map(press),
        ...Array.from({ length: 30 }, (_, i) => press(from + i * cadence)),
    ];
    const r = freshRun();
    for (let k = 0; k < 800; k += 1) {
        r.advance(heldKeysAt({ inputs }, k));
        if (r.endingReboots.length) {
            const used = Math.floor((r.endingReboots[0].t - 1 - from) / cadence) + 1;
            return { reboot: r.endingReboots[0], used, fade: r.seedFades[0], run: r };
        }
    }
    throw new Error(`plan: the seed dialogue never finished at cadence ${cadence}`);
};

/** The first tick the seed exists — `FP.world.add` QUEUES (§17.4's twin). */
const TALK_FROM = SPAWN.liveAt + 2;
const TALK_CADENCE = 8;
const talkFloor = probeTalk(7, TALK_FROM);
const talk = probeTalk(TALK_CADENCE, TALK_FROM);
if (talkFloor.used !== talk.used) {
    throw new Error(`plan: talk cadence 7 needs ${talkFloor.used} releases and `
        + `${TALK_CADENCE} needs ${talk.used} — a cadence that changes the RELEASE `
        + 'count is not "one above the floor", it is a different schedule');
}
const RELEASES = talk.used;
const TALK_PRESSES = Array.from({ length: RELEASES },
    (_, i) => TALK_FROM + i * TALK_CADENCE);
const REBOOT_TICK = talk.reboot.t;

// ── PHASE 3: the scripted walk, and where it stops ────────────────────
const CLAMP_AT = (() => {
    const inputs = [FACE_SPAN, ...HIT_PRESSES.map(press), ...TALK_PRESSES.map(press)];
    const r = freshRun();
    let last = null;
    for (let k = 0; k < REBOOT_TICK + 400; k += 1) {
        r.advance(heldKeysAt({ inputs }, k));
        if (r.cutsceneWalk && last !== null && r.state.y === last) {
            return { t: k, y: r.state.y };
        }
        if (r.cutsceneWalk) last = r.state.y;
    }
    throw new Error('plan: the scripted walk never stopped');
})();

const TICK_COUNT = CLAMP_AT.t + WALK_TAIL;
const CONTROL_TICK_COUNT = THIRD_PRESS + CONTROL_TAIL;

const INPUTS = [
    FACE_SPAN,
    ...HIT_PRESSES.map(press),
    ...TALK_PRESSES.map(press),
];
/**
 * ⛔ THE FOURTH PRESS DELETED — AND EVERY LATER SPAN WITH IT, which is what
 * makes this a PREFIX rather than an equal. See the docblock: a dialogue
 * release in a room with no dialogue is a sword swing.
 */
const CONTROL_INPUTS = [
    FACE_SPAN,
    ...HIT_PRESSES.slice(0, 3).map(press),
];

const tapeFor = (name, inputs, tickCount, description) => parseTape({
    tape_version: 7,
    game: 'seedling',
    name,
    description,
    boot: BOOT,
    noclip: false,
    // ⛔ FALSE ON BOTH ARMS. Neither L114 nor L1 holds a damage source, so
    // this is the honest declaration and a hit of any kind is a finding.
    noDamage: false,
    noHazards: NO_HAZARDS,
    grants: GRANTS,
    persistence: PERSISTENCE,
    equips: [],
    pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: [] },
    // ⚠ NOT DECLARED, for W-talk's reason: the split is default-off and
    // neither room has a gameplay draw consumer. W-owl is the window that
    // declares it.
    rng: { seed: 0, split: false },
    tick_count: tickCount,
    inputs,
});

const tape = tapeFor('r6-watcher-blood', INPUTS, TICK_COUNT,
    'R6 slice 6d: W-BLOOD. Boots into L114 at (80,96) — `r6-watcher-talk`\'s own stance '
    + '— with `{114,0}` DECLARED CLEARED (what that tape earns) and a sword granted, '
    + 'taps `up` for one tick to face `watcher@72,72`, and swings four times at a '
    + `cadence of ${CADENCE}. The declaration is what makes the sword count: `
    + '`Watcher.hit()` opens with `!Game.checkPersistence(tag)`, so the hits are '
    + 'refused until the dialogue has been read out — and the SAME flag gates '
    + '`Watcher.update`\'s `super.update()`, so a cleared boot cannot talk, cannot '
    + 'freeze and cannot hold out the live Seed that makes W-talk\'s stance a soft-lock '
    + 'risk. One press buys exactly one hit (`hitsTimer = 25` refuses four of every '
    + 'press\'s five hit tests), and the fourth lands the trigger '
    + '`hits > dieFrames.length`: `Watcher.update` spawns a bloody `Seed` at '
    + '`int(p.x - 8) + 8, int(p.y - 8) + 8` — ON the player — which `FP.world.add` '
    + 'QUEUES, so it first updates (and is collected by pure overlap, `_attract` being '
    + 'false) on the tick after. Then the Seed machinery: 150 frozen frames of '
    + `\`Pickup.specialTimer\`, a ${RELEASES}-release two-page dialogue at the pickup `
    + 'family\'s own speed (6 frames/character, 32 columns), and `Seed.removeSelf` — '
    + 'which is an OVERRIDE that never reaches `removed()`, so the pickup grants '
    + `nothing and writes no flag, and instead draws a cover for ${coverFadeFrames()} `
    + 'FROZEN frames before `FP.world = new Game(1, 64, 96, false)` with '
    + '`Game.cutscene[1]` set. The tape survives a world swap it did not order, lands '
    + 'in L1 at (72,104), and is walked north by `Game.as:955-960` at 0.75 px/tick '
    + '(`v.y = -1` under friction 0.25) with `receiveInput = false` — no span of its '
    + `own from there on. The walk\'s velocity clamp stops it at y ${CLAMP_AT.y}, `
    + `${(CLAMP_AT.y - 40).toFixed(1)} px from \`oracle@64,32\`'s entity point and `
    + 'INSIDE its 24 px talk circle — which is safe only because `keyNeeded` is the '
    + 'NPC base\'s `true` (the Oracle never assigns it) and `Bot.autoAdvance` can only '
    + 'press into a dialogue that is already up.');

const control = tapeFor('r6-watcher-blood-control', CONTROL_INPUTS, CONTROL_TICK_COUNT,
    'R6 slice 6d: the one-press-fewer control — the same tape with the FOURTH and last '
    + 'sword press deleted, and every span after it, which is what makes this a PREFIX '
    + 'rather than an equal: every later `primary` in the drive is a DIALOGUE release, '
    + 'and a dialogue release in a room with no dialogue is a sword swing that would '
    + 'land the very hit this arm exists to withhold. Three hits is one short of '
    + '`hits > dieFrames.length` (`dieFrames` is `[7,8,9]`), so `Watcher.update`\'s '
    + '`createdSeed` latch never fires, no `Seed` is ever added to the world, no '
    + 'ceremony runs, no cover fades and no reboot happens. The arm ends where it '
    + 'started, in L114, with `Game.cutscene` untouched — and that level sequence is '
    + 'the pair\'s discriminator, because BOTH endings can produce a menu and neither '
    + 'can produce the other\'s room.');

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const a = run(tape.inputs, tape.tick_count);
const c = run(control.inputs, control.tick_count);

// ── the derivation ───────────────────────────────────────────────────
check(chosen.landed.length === 4 && chosen.tests.every((t) => t === 1),
    '⛔⛔ ONE PRESS IS ONE HIT, AND THE OTHER FOUR TESTS ARE REFUSED BY NAME',
    `${chosen.hits.length} hit tests reached the Watcher, ${chosen.landed.length} `
    + `landed — at ticks ${chosen.landed.map((h) => h.t).join(', ')}, each the FIRST `
    + `of its press's ${SLASH_HIT_TICKS}. The refusals read `
    + `"${chosen.hits.find((h) => !h.landed)?.why}"`);
check(atFloor.landed.length === 4 && belowFloor.tests.some((t) => t !== 1),
    `⛓ AND THE CADENCE IS ONE ABOVE A MEASURED FLOOR (${CADENCE} against ${floor})`,
    `at ${floor} all four still land on test 1; at ${floor - 1} they land on tests `
    + `${belowFloor.tests.join(', ')} — i.e. a press one tick early is rescued by its `
    + `own repeats, which is a claim about §13.2 and not about the timer. `
    + `\`hitsTimerMax\` is ${WATCHER.hitsTimerMax}`);

// ── the spawn ────────────────────────────────────────────────────────
const spawn = a.run.seedSpawns[0];
const endY = a.stream.find((o) => o.t === spawn.t)?.y;
check(spawn !== undefined && spawn.hits === WATCHER.dieFrames + 1,
    '⛓⛓⛓ THE FOURTH HIT SPAWNS THE BLOODY SEED — `hits > dieFrames.length`',
    JSON.stringify(spawn));
check(spawn !== undefined && spawn.ey === Math.trunc(endY - 8) + 8 && spawn.ey !== endY,
    '⛔ …AT `int(p.x - 8) + 8`, WHICH IS NOT `p.x` — the ctor takes `int`s',
    `the player is at y ${endY} and the seed's entity point is y ${spawn.ey}: `
    + `\`int(${endY} - 8) + 8\`. §14.8's "exactly (p.x, p.y)" is the arithmetic, `
    + 'not the types — witnessed here because the `up` tap leaves the stance on a '
    + 'fractional y');
check(spawn !== undefined && spawn.liveAt === spawn.t + 1,
    '⛓ …and `FP.world.add` QUEUES, so it first updates one tick later',
    `spawned at ${spawn.t}, live at ${spawn.liveAt}; the ceremony's own first tick is `
    + `the same one (no walk at all — \`_attract\` is false and the box is ON the `
    + 'player)');

// ── the ceremony, the fade and the reboot ────────────────────────────
const fade = a.run.seedFades[0];
check(fade !== undefined && fade.fadeFrames === coverFadeFrames(),
    '⛓⛓ `Seed.removeSelf()` IS A COVER FADE, NOT A REMOVAL — and its frames are DEAD',
    `${fade?.fadeFrames} frozen frames banked in \`frozenFramesOwed\` `
    + `(${a.run.frozenFramesOwed} total). The override never calls `
    + '`FP.world.remove`, so `removed()` never runs: no item, no persistence');
check(a.run.earnedClears.length === 0 && a.run.collected.length === 1
    && a.run.collected[0].item === null,
    '⛔ A COLLECTED PICKUP THAT GRANTS NOTHING AND CLEARS NOTHING',
    `earnedClears ${JSON.stringify(a.run.earnedClears)}, collected `
    + `${JSON.stringify(a.run.collected)} — which is why this window's ledger row is `
    + 'the LEVEL SEQUENCE and not a flag');
const reboot = a.run.endingReboots[0];
check(reboot !== undefined && reboot.toLevel === SEED_ARMS.bloody.reboot.level
    && reboot.cutscene === 1,
    '⛓⛓⛓ THE GAME REBOOTS THE WORLD — `FP.world = new Game(1, 64, 96, false)`',
    JSON.stringify(reboot));
check(a.run.transitions.length === 1 && a.run.transitions[0].to_level === 1,
    '⛓ …and it DOES produce a transition record, unlike a death — the level changed',
    JSON.stringify(a.run.transitions));

// ── the scripted walk ────────────────────────────────────────────────
const walk = a.stream.filter((o) => o.level === 1);
const steps = [];
for (let i = 1; i < walk.length; i += 1) {
    const d = +(walk[i - 1].y - walk[i].y).toFixed(10);
    if (d > 0) steps.push(d);
}
check(steps.length > 0 && steps.every((d) => d === 0.75),
    '⛔⛔ THE WALK IS 0.75 px/TICK — `v.y = -1` WITH FRICTION 0.25 BEFORE `moveY`',
    `${steps.length} steps, all ${steps[0]}; from y ${walk[0]?.y} to `
    + `${CLAMP_AT.y} in ${CLAMP_AT.t - REBOOT_TICK} ticks`);
check(CLAMP_AT.y === 63.5,
    `⛔ AND THE CLAMP'S 64 IS NEVER LANDED ON — the lattice stops at ${CLAMP_AT.y}`,
    `\`if (p.y <= ${CUTSCENE_1_WALK.clampY}) p.v.y = 0\` is a VELOCITY clamp: from `
    + `y 104 in 0.75 steps the values go 64.25 -> 63.5 and stop. §17.10's "EXACTLY 24 `
    + 'px from the Oracle" is the value the clamp NAMES, not the one it reaches');

// ── the Oracle ───────────────────────────────────────────────────────
const oa = a.run.oracleApproach;
const inRange = oa.filter((o) => o.inRange);
check(oa.length > 0 && inRange.length > 0,
    '⛔⛔⛔ THE WALK REALLY DOES END INSIDE THE ORACLE\'S CIRCLE — the POSITIVE witness',
    `${oa.length} ticks of the cutscene[1] world, ${inRange.length} of them in range; `
    + `closest ${Math.min(...oa.map((o) => o.distance)).toFixed(2)} px against a `
    + `talkRange of ${ORACLE.talkRange}, first in range at tick ${inRange[0]?.t}`);
const primaryAfter = tape.inputs.filter((s) => s.key === 'primary' && s.to > REBOOT_TICK);
check(primaryAfter.length === 0,
    '⛓⛓ …AND NOT ONE KEY EDGE AFTER THE REBOOT, which is the only reason that is safe',
    `the last \`primary\` span ends at `
    + `${Math.max(...tape.inputs.filter((s) => s.key === 'primary').map((s) => s.to))}, `
    + `the reboot is at tick ${REBOOT_TICK}. \`keyNeeded\` is the NPC base's TRUE for `
    + 'an Oracle, and `Bot.autoAdvance` only presses into a dialogue already up — two '
    + 'independent locks, and `levelRun` refuses a span here outright');

// ── the control ──────────────────────────────────────────────────────
const cw = c.run.watchers[0];
check(c.run.watcherHits.filter((h) => h.landed).length === 3
    && cw.hits === 3 && cw.createdSeed === false,
    '⛔⛔⛔ THREE HITS SPAWN NOTHING — one short of `hits > dieFrames.length`',
    `${c.run.watcherHits.length} hit tests, 3 landed, hits ${cw.hits} against a `
    + `trigger of ${WATCHER.dieFrames + 1}; createdSeed ${cw.createdSeed}`);
check(c.run.seedSpawns.length === 0 && c.run.endingReboots.length === 0
    && c.run.transitions.length === 0 && c.run.level === 114,
    '⛓⛓ …so the control ends where it started, in L114, with no reboot at all',
    `seedSpawns ${c.run.seedSpawns.length}, endingReboots `
    + `${c.run.endingReboots.length}, transitions ${c.run.transitions.length}, level `
    + `${c.run.level} against the drive's ${a.run.level}`);
check(c.run.frozenFramesOwed === 0 && c.run.collected.length === 0,
    '⛓ …and pays no frozen frames at all, against the drive\'s '
    + `${a.run.frozenFramesOwed}`,
    `control frozenFramesOwed ${c.run.frozenFramesOwed}, collected `
    + `${c.run.collected.length}`);

// ── the pair's shape ─────────────────────────────────────────────────
const drivePresses = tape.inputs.filter((s) => s.key === 'primary');
const ctlPresses = control.inputs.filter((s) => s.key === 'primary');
check(JSON.stringify(ctlPresses) === JSON.stringify(drivePresses.slice(0, 3))
    && JSON.stringify(control.inputs[0]) === JSON.stringify(tape.inputs[0]),
    '⛓ THE CONTROL IS A PREFIX — every span it has is byte-identical to the drive\'s',
    `${ctlPresses.length} presses against ${drivePresses.length}; the first deleted `
    + `one is ${JSON.stringify(drivePresses[3])} and the tape is ${control.tick_count} `
    + `ticks against ${tape.tick_count}`);
let firstDiff = -1;
for (let i = 0; i < c.stream.length; i += 1) {
    if (a.stream[i].x !== c.stream[i].x || a.stream[i].y !== c.stream[i].y) {
        firstDiff = i; break;
    }
}
check(firstDiff === -1,
    '⛓ …and the two arms are position-identical for the whole control',
    firstDiff === -1
        ? `identical for all ${c.stream.length} of the control's observations — the `
        + 'divergence is entirely in what the fourth press STARTS, which is a chain '
        + 'that ends in another room'
        : `first positional difference at tick ${firstDiff}`);

for (const k of checks) {
    console.log(`${k.ok ? '  ok ' : 'FAIL '}${k.name}\n       ${k.detail}`);
}
console.log('');
console.log(`hit presses ${HIT_PRESSES.join(', ')} at cadence ${CADENCE} (floor ${floor}); `
    + `seed at tick ${SPAWN.t}, live ${SPAWN.liveAt}`);
console.log(`${RELEASES} dialogue releases at ${TALK_PRESSES.join(', ')} (cadence `
    + `${TALK_CADENCE}, floor 7); reboot at ${REBOOT_TICK}; clamp at ${CLAMP_AT.t} `
    + `(y ${CLAMP_AT.y})`);
console.log(`drive ${tape.tick_count} ticks / ${a.run.frozenFramesOwed} frozen frames + `
    + `150 phase A; control ${control.tick_count} ticks / 0`);
console.log(`text: ${JSON.stringify(BLOODY_SEED_TEXT.slice(0, 60))}…, `
    + `${THIRD_PRESS}/${FOURTH_PRESS} third/fourth press`);

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
