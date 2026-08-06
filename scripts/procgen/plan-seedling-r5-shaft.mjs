#!/usr/bin/env node
/**
 * plan-seedling-r5-shaft — THE EIGHTEEN PRESSES MEET THE GAME.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 9, step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §22.
 *
 * ── WHY THIS SCRIPT IS THE ONE THAT MATTERS ───────────────────────────
 *
 * `SHAFT_PLAN` has been a plan since §19.8 and a CORRECT plan since §20.3,
 * and slice 8 said the quiet part out loud: **its minimality certificate
 * is one stratum.** The hand plan and the blind BFS both ran through the
 * same unaimed press model, so "eighteen is the minimum" is a statement
 * two instruments that share a derivation agree on
 * ([[feedback_verifier_shared_assumption]]).
 *
 * The game is the first independent check that plan will ever meet, and
 * this is where it meets it. Every fact below is one an aimed-world model
 * would fake:
 *
 *   · three lock-buttons HELD AT CLOSE, not merely touched;
 *   · every block's position PINNED, not just the named one's — `runFire`'s
 *     effect check is an exact set both ways, which is what catches a press
 *     that moved something the plan did not name;
 *   · L39's ledger at NINE writes and EIGHT net clears, with {39,7}
 *     cleared and then RE-SET by the final press;
 *   · and the last press's THREE SIMULTANEOUS GLIDES.
 *
 * ── ⛓ IT BOOTS WHERE `r5-totem-entrance` COMES TO REST ────────────────
 *
 * That tape ends at tile (9,25), which §21.6 measured as the only
 * reachable stance touching `rope@96,384`. This one boots into L39 with
 * {39,8} declared — the flag the entrance button earned — and starts from
 * the arrival, so the two are a chain rather than two unrelated windows.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-shaft.mjs
 *   node scripts/procgen/plan-seedling-r5-shaft.mjs --write
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { synthesizeLegs } = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const {
    ROPE_PULL, SHAFT_PAIR, SHAFT_PLAN, SHAFT_LEDGER, TOTEM_PART_2, assertPlanContinuity,
} = await import(join(MODULE, 'r5Shaft.js'));

const WRITE = process.argv.includes('--write');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };

/** L39's arrival from L38, tile (9,38). */
const BOOT = Object.freeze({ level: 39, x: 144, y: 608 });
/** ⛓ The flag `r5-totem-entrance` EARNS — declared here, so this is a chain. */
const PERSISTENCE = Object.freeze([Object.freeze({
    level: 39,
    tag: 8,
    note: '`buttonroom@32,48` in L38 — the entrance write `r5-totem-entrance` makes for '
        + 'real. Declared here so the shaft window boots into the room that tape opens, '
        + 'rather than into one no walk can enter.',
})]);

const world = buildLevelWorld(levelSource(39), {
    roles: ROLES, inventory: held, cleared: [8],
});
const centre = (t) => ({ x: t.tx * TILE_SIZE + TILE_SIZE / 2, y: t.ty * TILE_SIZE + TILE_SIZE / 2 });

// ── 1. the rope, and the stance slice 8 corrected ────────────────────
console.log('## the rope pull');
{
    const rope = world.solids.find((s) => s.ropeId === `rope@${ROPE_PULL.rope.x},${ROPE_PULL.rope.y}`);
    if (!rope) throw new Error(`L39 has no rope at (${ROPE_PULL.rope.x},${ROPE_PULL.rope.y})`);
    const s = centre(ROPE_PULL.stance);
    console.log(`   rope@${ROPE_PULL.rope.x},${ROPE_PULL.rope.y} spans `
        + `[${rope.rect.x},${rope.rect.right}) x [${rope.rect.y},${rope.rect.bottom}) `
        + `-> shrinks to [${rope.shrunkRect.x},${rope.shrunkRect.right})`);
    console.log(`   stance tile (${ROPE_PULL.stance.tx},${ROPE_PULL.stance.ty}) = `
        + `(${s.x},${s.y}) — §21.6's correction; slice 7's (7,25) is unreachable`);
}

// ── 2. the legs: the rope, then the eighteen ─────────────────────────
const targets = [
    /**
     * ⛔ THE EQUIP, AND IT IS THE FIRST THING THE LEG DOES.
     *
     * `useItem(Main.primary)` reads the SELECTED SLOT and a fresh run's is
     * 0 — the sword. §20.5 called "one weapon, one equip, for the whole
     * visit" a convenience; it is an obligation. Without this the whole
     * verb runs, the press lands, a THRUST is scheduled, and the effect
     * check reports the rope unmoved with a paragraph about rect geometry.
     * Slot 1 is `fire` (`tapeFormat.INVENTORY_ITEM_IDS`).
     */
    { ...centre(ROPE_PULL.stance), equip: { slot: 1 } },
    {
        ...centre(ROPE_PULL.stance),
        fire: { rope: { x: ROPE_PULL.rope.x, y: ROPE_PULL.rope.y } },
    },
    /**
     * ⛓⛓⛓ R5 SLICE 13 — EVERY PRESS IS THREADED, AND THAT IS WHAT KEEPS THE
     * LEDGER AT NINE.
     *
     * §24.8's shaft died at press 5 because `spinner@224,112` was standing in
     * block 2's glide corridor. There were two ways out and only one of them
     * leaves `SHAFT_LEDGER` alone: KILLING L39's three spinners would write
     * {39,3}/{39,4}/{39,6} and turn a nine-write ledger into a twelve-write
     * one, re-opening every assertion §24.7 closed. So the route waits
     * instead — which is possible at all only because `runRange = 0` makes
     * the billiard player-independent, so "when is this corridor clear" has
     * an answer that can be COMPUTED rather than re-recorded until it works.
     */
    ...SHAFT_PLAN.map((step) => ({
        ...centre(step.stance),
        fire: {
            moves: step.moves.map((m) => ({
                from: { tx: m.from[0], ty: m.from[1] },
                to: { tx: m.to[0], ty: m.to[1] },
            })),
            thread: 'L39\'s three spinners are billiards (`spinner.js`) and a block\'s '
                + 'own solids list carries "Enemy", so one standing in the glide corridor '
                + 'WEDGES the block permanently. Timing rather than killing, because a '
                + 'kill writes the spinner\'s tag and `SHAFT_LEDGER` is nine writes.',
        },
    })),
    /**
     * ⛓⛓⛓ R5 SLICE 13 — THE FIRST CEREMONY, AND IT IS IN THIS WINDOW BY
     * OBLIGATION.
     *
     * §24.7: the rope drops a rock onto `teleporter@144,624 -> L38` and
     * `REFUSED_CLEAR_RESPONSES.arm` forbids a tape from DECLARING a fallrock
     * tag — so nothing can boot into L39 after the pull. **The window that
     * pulls the rope is the window that must finish the room**, and the
     * collect therefore rides this tape rather than getting its own.
     *
     * ⛓ THE STANCE IS SAFE BY CONSTRUCTION, NOT BY LUCK, and slice 13's
     * enumeration is what makes that sentence cheap: every damage path in
     * the game reaches the player through `Player.hit`, which is gated on
     * `!Game.freezeObjects` (`crusher.PLAYER_DAMAGE_PATHS`). The single
     * exception is `LavaTrap`, which is in Dungeon 7 and 8. ⇒ the 150 frozen
     * frames cannot hurt the player HERE whatever L39's three spinners do,
     * and — unlike a crusher — a spinner is a `Mobile`, so it does not move
     * during them either. The claim is POSITIONAL and it is discharged by
     * the walk arriving at all.
     */
    /**
     * ⛔⛔ AND THE WAY NORTH IS NOT THE COLUMN THE PRESSES OPEN — the final
     * press SEALS it.
     *
     * Press 18 parks block 1 on `button@144,112 {tset 4}` at (9,7), which
     * is the cell `cover t0` occupies and the only opening in row 7 of
     * column 9. So the block that HOLDS the third wandlock open is standing
     * in the corridor those wandlocks lead to, and the route has to go
     * round: west along row 9 is shut too (block 3 is on (7,9)), so it
     * drops to row 10, comes back west, climbs the (5,7)-(6,7) gap to row
     * 6, runs east under the cross to (9,6), and only then goes north
     * through `wandlock@144,64 / @144,48 / @144,32` — the three the three
     * held buttons just opened.
     *
     * ⚠ WAYPOINTS RATHER THAN ONE A*, and the reason is measured: a single
     * goal from (9,9) to (5,1) is refused as *"different connected
     * components"*. The corridor exists at whole-tile resolution and the
     * planner's own lattice cannot see it in one hop, so the route names the
     * turns. Each one is a cell this map shows free with the run's live
     * activators and live blocks.
     */
    { ...centre({ tx: 10, ty: 10 }) },
    { ...centre({ tx: 5, ty: 10 }) },
    { ...centre({ tx: 6, ty: 7 }) },
    { ...centre({ tx: 9, ty: 6 }) },
    { ...centre({ tx: 9, ty: 2 }) },
    {
        ...centre(TOTEM_PART_2.stance),
        collect: {
            pickup: { x: TOTEM_PART_2.pickup.x, y: TOTEM_PART_2.pickup.y },
            aim: { ...TOTEM_PART_2.aim },
        },
    },
];

console.log(`\n## the plan: 1 rope pull + ${SHAFT_PLAN.length} presses`);
SHAFT_PLAN.forEach((step, i) => {
    console.log(`   ${String(i + 1).padStart(2)}  stance (${step.stance.tx},${step.stance.ty})  `
        + `${step.moves.map((m) => `(${m.from})->(${m.to})`).join(' + ')}`);
});

let out = null;
let failure = null;
try {
    out = synthesizeLegs([{ level: 39, targets }], {
        levelSource,
        boot: { ...BOOT },
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [{ level: 39, items: [...HELD] }],
            persistence: PERSISTENCE.map((p) => ({ ...p })),
            // ⛔ VERSION 4, BY PRESENCE. Without this the emitted tape drops
            // the equip and every press replays as a SWORD press.
            equips: [],
            // ⛓⛓ R5 SLICE 13: THE PLAN ASKS FOR `combat` BY NAME. Every
            // `moves` press needs it — "is there an unmodelled enemy in this
            // room" cannot be asked without a census, and an absent one is a
            // refusal rather than a pass (§25.3). L39's three spinners ARE
            // modelled now (`spinner.js`), so with the census present the
            // refusal narrows to nothing here and the presses are certifiable
            // against the billiard's actual trajectory.
            roles: [...ROLES],
        },
        name: 'r5-shaft',
        lattice: 8,
        allowGrazes: true,
        maxTicksPerTarget: 2000,
    });
} catch (e) {
    failure = e.message;
}

if (!out) {
    console.log(`\n⛔ THE DRIVE FAILED, and the failure is the finding:\n\n   ${failure}\n`);
    process.exit(1);
}

// ── 3. ⛔ THE FADE, WHICH THE PLAN NEVER PRICED INTO THE TAPE ─────────
/**
 * `runFire` waits for the GLIDE — `run.pushesSettled`, 32 ticks — and that
 * is the whole of what a press verb can know. What it cannot know is that
 * the three blocks the last press parks are now HOLDING three lock-buttons
 * and that a `Lock` fades at 0.01 alpha per tick: **101 continuous ticks**
 * (§14's measurement, and R3's `l71-hold-101-shut` / `-102-open` pair).
 *
 * §20.8 priced those 101 ticks in the tape budget and the plan did not
 * carry them, so the first drive of the shaft ended one tick after the
 * last glide with all three wandlocks still solid and an empty ledger —
 * eighteen presses that each "worked" and a room that never opened. The
 * same shape as §20.2's collateral, one abstraction up: the verb's local
 * success is not the leg's.
 */
const LOCK_FADE_TAIL = 130;

// ── 4. what the run says ─────────────────────────────────────────────
const tape = parseTape(serializeTape({
    ...out.tape,
    tick_count: out.tape.tick_count + LOCK_FADE_TAIL,
    description: '⛓⛓ THE SHAFT — eighteen fire presses, three blocks and four holds. '
        + '`SHAFT_PLAN` has been a plan since §19.8 and a CORRECT plan since §20.3, and '
        + 'both of its certificates ran through the same unaimed press model. This is the '
        + 'first independent check it has ever met. The choreography: block 1 up column 9 '
        + 'onto `button t1` (which opens BOTH group-1 responders — `cover t1` lets block 2 '
        + 'in and `wandlock@48,160` lets block 3 out); block 2 down column 12 and TWO '
        + 'tiles past its destination onto `button t2`, holding `cover t2` for block 3\'s '
        + 'whole crossing; block 3 out of its pocket, east along row 9 and ONE tile past '
        + 'its own destination onto `button t0`; and then a SINGLE press from the middle '
        + 'of the cross that sends all three onto the three lock-buttons at once — every '
        + 'push a pure axis, so the `bothRange` diagonal §19.8 needed is not needed '
        + 'anywhere. ⛓ The rope is pulled with FIRE rather than the sword: `genericHit`\'s '
        + 'rope arm takes no `t`, a sword press would consult the `blockedLine` oracle and '
        + 'then waive it, and this way the whole visit needs one weapon and one equip.',
}));
const run = runTape(tape, { levelSource });
const end = run.ticks[run.ticks.length - 1];
console.log(`\n## the drive`);
console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} spans — ends L${end.level} `
    + `(${end.x.toFixed(2)},${end.y.toFixed(2)}) tile `
    + `(${Math.floor(end.x / TILE_SIZE)},${Math.floor(end.y / TILE_SIZE)})`);
console.log(`   fires: ${out.fires.length}`);
for (const f of out.fires) {
    console.log(`      t${f.from}..${f.to}  ${f.threadedBy ? `thread +${f.threadedBy}  ` : ''}`
        + `${JSON.stringify(f.expect ?? f.moved ?? '')}`);
}
/**
 * ⛓⛓ THE THREAD, AS A NUMBER — because a declaration that never waits is a
 * declaration that never did anything.
 *
 * `fire.thread` is on all eighteen presses and the honest question about it
 * is whether the corridor was ever actually occupied. If every wait were 0
 * the plan would be identical to the one §24.8 recorded and the model would
 * be claiming a fix it had not exercised — [[feedback_silent_watcher_vacuous_negative]]
 * with the sign flipped. So the waits are printed and then ASSERTED.
 */
const threaded = out.fires.filter((f) => f.threadedBy > 0);
console.log(`   threaded: ${threaded.length} of ${out.fires.length} press(es) waited, `
    + `${out.fires.reduce((n, f) => n + (f.threadedBy ?? 0), 0)} idle tick(s) in total`);

// ── 4. the claims an aimed-world model would fake ────────────────────
console.log('\n## the claims');
const checks = [];
const check = (ok, name, detail) => { checks.push({ ok, name, detail }); };
check(out.fires.length === SHAFT_PLAN.length + 1,
    `⛓ ${SHAFT_PLAN.length + 1} fire presses landed — the rope and the eighteen`,
    `${out.fires.length}`);
check(threaded.length > 0,
    '⛓⛓ THE THREAD IS NOT VACUOUS — at least one press waited for its corridor',
    `${threaded.length} press(es) waited: `
    + `${threaded.map((f) => `#${f.index - 1} +${f.threadedBy}`).join(', ') || 'NONE'}. `
    + 'A schedule where every wait is 0 is the schedule §24.8 already recorded, and '
    + 'declaring `thread` on it would be asserting a fix nobody exercised.');
/**
 * ⛓ THE LEDGER, from the RUN's own earned clears rather than from a count
 * of presses. §20.4's finding is that a plain `Lock` writes persistence
 * BOTH ways — `turnOff()` false and `returnToNormal()` TRUE — and that
 * {39,7} is cleared to let block 3 out of its pocket and RE-SET by the
 * final press, which moves block 1 off `button t1`. So the claim is about
 * the NET set, and the write that is taken back has to be ABSENT from it
 * rather than merely unmentioned.
 */
/**
 * ⛔ NOT `earnedClears`, AND THE SHAFT IS WHERE THAT STOPPED BEING
 * ACADEMIC. A banked clear is cashed when the level it names is next
 * BUILT, so a run that opens three locks and never leaves the room reports
 * an EMPTY `earnedClears` — indistinguishable from a run whose locks never
 * opened. The WRITES are the claim.
 */
/**
 * ⛔⛔ AND THE THIRD WRITER IS THE ONE THAT REFUTED THE PLAN — R5 slice 11.
 *
 * This list was `lockWrites` + `ropePulls` when it was written, because
 * those were the two writers slice 9 knew about. The game's ledger came
 * back with a fourth flag in it, **{39,10}**, and slice 10 found the
 * mechanism: the rope's group-6 publication drops `fallrock@144,624`, and
 * `FallRock.fall()`'s FIRST line is `Game.setPersistence(tag, false)`.
 *
 * `run.rockFalls` has carried that since slice 10 and NOTHING READ IT, so
 * this script's ledger claim went on passing while omitting the flag the
 * refutation turned on. ⇒ **the model's prediction and the check that
 * asserts it were in different files, and only one of them was updated.**
 * A forward prediction nobody asserts is a note.
 */
const writes = [
    ...(run.lockWrites ?? []).map((w) => ({ ...w.flag, value: w.value })),
    ...(run.ropePulls ?? []).map((r) => ({ ...r.flag, value: false })),
    ...(run.rockFalls ?? []).filter((r) => r.flag).map((r) => ({ ...r.flag, value: false })),
];
const net = new Map();
for (const w of writes) net.set(`${w.level}:${w.tag}`, w.value);
const cleared = [...net.entries()].filter(([, v]) => v === false).map(([k]) => k).sort();
console.log(`   writes:        [${writes.map((w) => `${w.level}:${w.tag}=${w.value}`).join(' ')}]`);
console.log(`   net cleared:   [${cleared.join(' ')}]`);
const wantNet = SHAFT_LEDGER.filter((f) => f.net && f.level === 39 && f.tag !== 8)
    .map((f) => `${f.level}:${f.tag}`).sort();
const taken = SHAFT_LEDGER.filter((f) => !f.net).map((f) => `${f.level}:${f.tag}`);
check(JSON.stringify(cleared) === JSON.stringify(wantNet),
    '⛓⛓ THE LEDGER IS THE NET SET, and the write that is taken back is ABSENT',
    JSON.stringify(cleared) === JSON.stringify(wantNet)
        ? `[${cleared.join(' ')}] — and [${taken.join(' ')}] is written and then RE-SET by `
            + 'the final press, which moves block 1 off `button t1` and leaves group 1 '
            + 'quiet with nothing in the lock'
        : `the run cleared [${cleared.join(' ')}] and \`SHAFT_LEDGER\` declares `
            + `[${wantNet.join(' ')}] (net) with [${taken.join(' ')}] taken back`);
for (const t of taken) {
    check(!cleared.includes(t),
        `⛓ {${t}} is NOT in the end-of-run ledger — it was cleared and taken back`,
        '`returnToNormal()` writes it TRUE again, and no rung before slice 7 modelled '
        + 'either direction');
}

// ── ⛓⛓ THE FORWARD PREDICTIONS, R5 slice 11 ──────────────────────────
//
// §23 corrected the model on three counts and the corrections were carried
// as PROSE. They are claims here, before the tape is written, because a
// recording made against an unasserted prediction proves nothing: §22.7's
// whole lesson is that the check has to exist on the model side first.
const rockFall = (run.rockFalls ?? [])[0];
check(!!rockFall && rockFall.flag?.tag === 10 && rockFall.flag?.level === 39,
    '⛔⛔ THE ROPE DROPS A ROCK — {39,10}, written by the PUBLICATION and not by a landing',
    rockFall
        ? `fallrock ${rockFall.id} at tick ${rockFall.t}, flag {${rockFall.flag?.level},`
            + `${rockFall.flag?.tag}}`
        : 'the run reports NO rock fall — the rope\'s group-6 publication is not '
            + 'reaching `FallRock.set activate`');
const ropeTick = (run.ropePulls ?? [])[0]?.t;
check(rockFall && ropeTick !== undefined && rockFall.t === ropeTick,
    '⛓⛓ …AT PULL TIME, on the same tick as the rope — not 60+46 ticks later',
    `the pull is t${ropeTick} and the rock's flag is written at t${rockFall?.t}. `
    + '`fall()` writes the flag FIRST and only then sets `waitToFallTimer = 60`, so a '
    + 'model that banked the write at the landing would be 106 ticks late and would '
    + 'still have "passed" a ledger check, because a set has no timestamps.');
check(rockFall?.deadFrames === 197,
    '⛓⛓ THE FREEZE IS 197 FRAMES — 60 wait + 46 fall + 90 camera + 1 release',
    `${rockFall?.deadFrames}. ⛔ 46 AND NOT 45: the closed form `
    + '`n(n+1)/2 * 0.6 >= 2160` is 45.99, so a model that divided and floored is a '
    + 'frame short. Transcribed as the loop.');
check(run.frozenFramesOwed === 197,
    '⛓ …and the run BANKS them, so the dead-frame budget can spend them',
    `frozenFramesOwed = ${run.frozenFramesOwed}. A frozen frame advances no tape tick, `
    + 'so the whole fall resolves inside one model tick — which is why the readout and '
    + 'the stream are two different instruments and only one of them saw this.');
/**
 * ⛔ AND THE ROCK LANDS ON THE WAY HOME. Asserted as a JOIN between two of
 * the world's own rosters rather than by eye: the rock the run dropped, by
 * id, against the teleporter list. "They share an @x,y in the .oel" and
 * "the census put them in the same cell" are different claims, and the
 * second is the one a route is planned against.
 */
const droppedRock = (world.fallRocks ?? []).find((r) => r.id === rockFall?.id);
const homeDoor = (world.teleporters ?? [])
    .find((t) => droppedRock && t.x === droppedRock.x && t.y === droppedRock.y);
check(!!droppedRock && !!homeDoor,
    '⛔ THE ROCK IS ON THE SOUTH TELEPORTER — after the pull, the way back out is a Solid',
    droppedRock && homeDoor
        ? `${droppedRock.id} and \`teleporter@${homeDoor.x},${homeDoor.y} -> L${homeDoor.to}\` `
            + 'are the same cell. That is why `REFUSED_CLEAR_RESPONSES.arm` makes this a '
            + 'ONE-WINDOW room: a tape may not DECLARE a fallrock tag, so the window that '
            + 'pulls pays the 197 frames and must also do everything after them.'
        : `rock ${droppedRock?.id ?? 'MISSING'}, teleporter ${homeDoor ? 'found' : 'NOT '
            + 'in the same cell'}`);

/**
 * ⛓⛓ THE THREE LOCK-BUTTONS ARE HELD AT CLOSE, and this is the claim an
 * aimed-world model fakes most easily.
 *
 * §20.2's failure was a plan every one of whose presses "worked" and which
 * nonetheless ended with two of three buttons held, because press 17 shoved
 * a second block off one. So the claim is not "eighteen presses landed" —
 * it is where the three blocks ARE when the tape stops, taken from the
 * run's live pushable rects rather than from the plan that placed them.
 */
/**
 * ⚠ AND IT IS A COMPOSITION OF TWO CHECKS, NOT ONE READING, because
 * `runTape` does not expose the live pushable rects — it forwards ledgers,
 * not geometry. The two halves that DO establish it:
 *
 *   `assertPlanContinuity`  the PLAN's steps chain (no step starts a block
 *                           from a cell the previous one did not leave it
 *                           on) and it ends with a block on each of the
 *                           three lock-buttons;
 *   `runFire`'s exact set   every press in the RUN moved exactly the blocks
 *                           its leg named — in BOTH directions, so a press
 *                           that also shoved a fourth block is a failure by
 *                           name, which is the check §20.2 exists to have.
 *
 * Continuity plus an exact set per press is the end state. Stating the
 * composition is the point: a single `expect(blocks).toEqual(...)` here
 * would look stronger and be reading the plan back to itself.
 */
let endCells = null;
let continuityError = null;
try { endCells = assertPlanContinuity(); } catch (e) { continuityError = e.message; }
const WANT_HELD = ['9,7', '11,9', '7,9'];
check(!!endCells && WANT_HELD.every((c) => endCells.includes(c)) && endCells.length === 3,
    '⛓⛓ THREE LOCK-BUTTONS HELD AT CLOSE — the claim §20.2\'s plan failed and this one makes',
    continuityError
        ? `the plan does not chain: ${continuityError}`
        : `blocks end on [${[...endCells].sort().join(' ')}] — and the run drove all `
            + `${out.fires.length - 1} presses through \`runFire\`'s exact-set effect `
            + 'check, which fails by name on a press that moves a block its leg did not '
            + 'name. §19.8\'s plan ended with TWO of three held and every one of its '
            + 'presses still "worked", which is why the claim is the END STATE.');

/**
 * ⛓⛓⛓ THE FIRST CEREMONY — one of five, and the stopping condition's first
 * unit.
 *
 * §24.9 recorded *"NO CEREMONY WAS OBSERVED"* and listed why: parts 0, 1, 3
 * and 4 are behind the burn, the key and the crushers, and part 2 is behind
 * a shaft whose walk was blocked at (12,5). The block is unwedged, so this
 * is the first of the five.
 *
 * ⚠ THE CLAIM IS THE CEREMONY, NOT THE ITEM. `BossTotemPart.removed()` is
 * `Player.hasTotemPartSet(part, true)` — a SAVE-FILE array — and
 * `Bot.itemReadout` has no field for it (§20.8). So "the part is banked" is
 * not observable from `botStatus` with zero further AS3, and what IS
 * observable is the 150 frozen frames, the pickup leaving the level, and the
 * run's own `collected` record. Phrased over those.
 */
{
    const ceremonies = run.collected.filter((c) => c.level === TOTEM_PART_2.level);
    console.log('\n## the ceremony');
    console.log(`   ${ceremonies.length} collect(s): `
        + `${ceremonies.map((c) => `t${c.t} item=${c.item ?? 'null'} frames=${c.frames}`).join(', ') || 'NONE'}`);
    check(ceremonies.length === 1,
        '⛓⛓⛓ ONE COLLECT CEREMONY — totempart 2, the FIRST of the five this rung stops at',
        `${ceremonies.length} — §24.9 recorded "NO CEREMONY WAS OBSERVED" and named the `
        + 'shaft as part 2\'s blocker. This is that blocker gone.');
    check(ceremonies.length === 1 && ceremonies[0].item === null,
        '⛓ …and it banks NO inventory property — a totem part is save-file state',
        `item = ${ceremonies[0]?.item ?? 'null'}. \`BossTotemPart.removed()\` writes `
        + '`Player.hasTotemPartSet`, which `Bot.itemReadout` cannot see (§20.8), so the '
        + 'CEREMONY is the claim and the item is not.');
    const endTile = { tx: Math.floor(end.x / TILE_SIZE), ty: Math.floor(end.y / TILE_SIZE) };
    check(endTile.tx === TOTEM_PART_2.tile.tx + 1 && endTile.ty === TOTEM_PART_2.tile.ty,
        '⛓ …and the walk ends standing in the part\'s own cell',
        `(${endTile.tx},${endTile.ty}) — the approach aims STRAIGHT DOWN from (5,1) `
        + `because the rect straddles x = 80 and (4,1) is wall (\`TOTEM_PART_2.aim\`)`);
}

/**
 * ⛓⛓⛓ THE SHUT-BEFORE CONTROL, WHICH §24.9 SAID NOTHING HAD EVER GENERATED.
 *
 * `SHAFT_PAIR` has named `r5-shaft-control` and its pin at (9,5) since slice
 * 7 and no script emitted it, so the shaft's whole claim — *"the eighteen
 * presses open the way"* — has only ever had one arm. A walk that reaches
 * (9,9) proves nothing until a walk WITHOUT the presses fails to.
 *
 * ⚠ IT KEEPS THE ROPE PRESS, and that is not a leak. The pin at (9,5) is
 * below the lowest WandLock and the rope's shrink is what lets the player
 * into the shaft at all; a control that could not even enter the room would
 * be blocked by the wrong thing and would prove the wrong negative. So the
 * FIRST `primary` span stays and the eighteen block presses go — one field
 * apart, and the field is the choreography.
 */
const ropePressSpan = tape.inputs.find((sp) => sp.key === 'primary');
const controlTape = parseTape(serializeTape({
    ...tape,
    name: SHAFT_PAIR.control,
    inputs: tape.inputs.filter((sp) => sp.key !== 'primary' || sp === ropePressSpan),
    description: '⛓⛓ THE SHUT-BEFORE CONTROL for `r5-shaft`: the identical tape with the '
        + 'EIGHTEEN block presses deleted and the rope pull kept, because the rope is what '
        + 'opens the shaft and a control blocked at the door would be testing the door. '
        + 'Every walk span is byte-identical. The three covers stay shut, so the walk '
        + 'cannot cross row 9 and comes to rest pinned in the column below the lowest '
        + 'WandLock — and the ledger it earns is the rope\'s alone. A press arm that '
        + 'reaches the middle of the cross proves the choreography only if this one does '
        + 'not.',
}));
{
    const cRun = runTape(controlTape, { levelSource });
    const cEnd = cRun.ticks[cRun.ticks.length - 1];
    const cTile = { tx: Math.floor(cEnd.x / TILE_SIZE), ty: Math.floor(cEnd.y / TILE_SIZE) };
    console.log('\n## the control arm');
    console.log(`   ${controlTape.tick_count} ticks, ${controlTape.inputs.length} spans — `
        + `ends (${cEnd.x.toFixed(2)},${cEnd.y.toFixed(2)}) tile (${cTile.tx},${cTile.ty}) `
        + `against the pin (${SHAFT_PAIR.pinnedAt.tile.tx},${SHAFT_PAIR.pinnedAt.tile.ty})`);
    // ⛔⛔ R5 SLICE 13: `spinnerWrites` IS IN THIS SUM, and leaving it out is
    // the §24.7 defect one mechanic later — "a forward prediction nobody
    // asserts is a note". The game reported {39,4} on this arm before the
    // model could; it can now, and the sum has to ask.
    const cLedger = [...new Set([
        ...cRun.lockWrites.filter((w) => w.flag.value === false).map((w) => `${w.flag.level}:${w.flag.tag}`),
        ...cRun.ropePulls.map((w) => `${w.flag.level}:${w.flag.tag}`),
        ...cRun.rockFalls.filter((w) => w.flag).map((w) => `${w.flag.level}:${w.flag.tag}`),
        ...cRun.spinnerWrites.map((w) => `${w.flag.level}:${w.flag.tag}`),
    ])].sort();
    if (cRun.spinnerWrites.length > 0) {
        console.log(`   spinner writes: ${cRun.spinnerWrites
            .map((w) => `t${w.t} ${w.id} {${w.flag.level},${w.flag.tag}} by ${w.cause}`).join(', ')}`);
    }
    console.log(`   ledger: [${cLedger.join(' ')}]`);
    // ⚠ WHY it stopped where it did, not just where. A control that fell in
    // a pit or crossed a door would be blocked by the wrong thing, and
    // "somewhere the presses did not reach" would read the same either way.
    let rest = cRun.ticks.length - 1;
    while (rest > 0 && cRun.ticks[rest - 1].x === cEnd.x && cRun.ticks[rest - 1].y === cEnd.y) {
        rest -= 1;
    }
    const rows = new Set(cRun.ticks.map((t) => Math.floor(t.y / TILE_SIZE)));
    console.log(`   levels [${[...new Set(cRun.ticks.map((t) => t.level))].join(' ')}], `
        + `${cRun.transitions.length} transition(s), ${cRun.transports.length} pit fall(s); `
        + `stationary since t${cRun.ticks[rest].t}; rows reached `
        + `${Math.min(...rows)}..${Math.max(...rows)}`);
    /**
     * ⛓⛓⛓ THE CLAIM IS THE NEGATIVE, NOT THE RESTING CELL. §24.9's
     * `pinnedAt: (9,5)` was a prediction about where a pressless walk would
     * STOP, and a control does not work like that — it replays the whole
     * input tape into a shut world, so after the first blocker the remaining
     * spans keep shoving it and the last cell is an artefact of the last
     * span. What the room decides is the ROW it cannot cross.
     */
    check(cRun.ticks.every((t) => !(Math.floor(t.x / TILE_SIZE) === SHAFT_PAIR.neverEnters.tx
        && Math.floor(t.y / TILE_SIZE) === SHAFT_PAIR.neverEnters.ty)),
        '⛓⛓⛓ THE CONTROL NEVER ENTERS (9,9) — the middle of the cross the press arm '
        + 'ENDS in — on any tick',
        '⛔ Without this arm "the walk reached the middle of the cross" is a sentence '
        + 'about a walk and not about eighteen presses.');
    check(Math.min(...rows) === SHAFT_PAIR.highestRowReached,
        `⛓⛓ …and the highest row it touches is ${SHAFT_PAIR.highestRowReached}, two below `
        + 'the crossing — the three covers hold the whole of row 9',
        `reached row ${Math.min(...rows)}; block 1 is still on its spawn at (9,11), which `
        + 'is what stops it there');
    check(cTile.tx === SHAFT_PAIR.pinnedAt.tile.tx && cTile.ty === SHAFT_PAIR.pinnedAt.tile.ty,
        '⛓ …and it comes to rest where the drive says, which is NOT where §24.9 predicted',
        `ended (${cTile.tx},${cTile.ty}) against the banked `
        + `(${SHAFT_PAIR.pinnedAt.tile.tx},${SHAFT_PAIR.pinnedAt.tile.ty}); the slice-7 `
        + `prediction was (${SHAFT_PAIR.predictedPin.tile.tx},`
        + `${SHAFT_PAIR.predictedPin.tile.ty}) and is REFUTED. Reported data, not the `
        + 'claim — it is here to catch drift.');
    check(!cLedger.includes('39:0') && !cLedger.includes('39:1') && !cLedger.includes('39:2'),
        '⛓ …and NONE of the three lock-buttons opens without the presses',
        `[${cLedger.join(' ')}] — {39,0}/{39,1}/{39,2} are exactly the flags a held button `
        + 'writes, and a control that opened one would mean something else was pressing it');
    check(cLedger.join(' ') === [...SHAFT_PAIR.controlEarned].sort().join(' '),
        '⛓ …and what it DOES earn is the rope\'s two writes, the rock included',
        `[${cLedger.join(' ')}] against [${[...SHAFT_PAIR.controlEarned].sort().join(' ')}]. `
        + '⛔ The slice-7 list omitted {39,10}: it predates slice 10\'s finding that a '
        + 'rope publication also calls `FallRock.fall()`.');
}

let bad = 0;
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);

if (WRITE) {
    for (const t of [tape, controlTape]) {
        const path = join(MODULE, 'fixtures', 'tapes', `${t.name}.json`);
        writeFileSync(path, serializeTape(t));
        console.log(`\n   wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the tape)');
}
