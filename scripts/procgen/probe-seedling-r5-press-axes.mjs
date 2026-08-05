#!/usr/bin/env node
/**
 * probe-seedling-r5-press-axes — WHICH PRESS DID THE GAME REFUSE, AND WHY?
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 12 step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §24.8 / §24.9.
 *
 * ── WHAT §24.8 LEFT, AND WHAT IT ALREADY DECIDES ──────────────────────
 *
 * The re-recorded shaft parts at t852 with the player unable to leave
 * y 76.34 at tile (12,4). `playerBoxAt(199.44, 76.34).bottom` is 79.34 and
 * the sweep steps 1 px, so the blocker's top edge is at y = 80 — row 5 —
 * and it overlaps x [197.44, 201.44). ⇒ THE BLOCKING SOLID IS IN CELL
 * (12,5), which is where press 4 PUT block 2 and where press 5 was supposed
 * to move it from. A block still standing at its spawn (13,5) spans
 * [208, 224) and could not block that walk at all.
 *
 * ⛓⛓ SO PRESS 4 LANDED IN THE GAME AND PRESS 5 DID NOT, and that is
 * derivable from the banked number rather than from a new recording. This
 * probe exists for the half that is not: WHY.
 *
 * ── WHAT THE SOURCE READ RULED OUT BEFORE ANY RECORDING ───────────────
 *
 * §24.8 named two candidate mechanisms and the design session named two
 * more. Three of the four are refuted by reading the two files side by
 * side, and the refutations are asserted in `pushables.test.js`:
 *
 *   the v-guard         `PushableBlockFire.hit`'s `if (v.length > 0)
 *                       return` IS in the model (`hitPushableFromPoint`
 *                       returns `moved: false` for a block with velocity),
 *                       and both sides read the value the block's OWN
 *                       `input()` set this tick, because both step the
 *                       block before the player.
 *   the press spacing   press 4 fires at t738 and press 5 at t809 — 71
 *                       ticks, against a 32-tick glide that ends 33 ticks
 *                       after the first hit tick. `runFire` waits on
 *                       `run.pushesSettled` and CANNOT emit a press inside
 *                       a glide. Suspect A is refuted by the plan's own
 *                       tick numbers.
 *   the angle           the AS3 aims from the player's raw entity `(x, y)`
 *                       at the block's CENTRE, and so does the model. From
 *                       (199.44, 72.24) at a block on (12,5) the angle is
 *                       89.98° — |sin| 0.9993 vs |cos| 0.0355, which is
 *                       nowhere near the 0.1 `bothRange` band. Pure SOUTH,
 *                       in both.
 *   the radius cut      `FP.distanceRects(..., e.y - originY, ...)` uses
 *                       the PLAYER's originY for the BLOCK, shifting the
 *                       block's rect 2 px UP for the test — which makes
 *                       the gap SMALLER for a block to the south (2.76 px
 *                       against a 16 px cut). Not marginal either way.
 *
 * ⇒ nothing in the press ITSELF distinguishes press 5 from press 4, so the
 * next question is whether press 5 fails IN ISOLATION or only in the
 * shaft's context (2,375 ticks, a rope pull, a 197-frame freeze and four
 * earlier presses). That is one short tape.
 *
 * ── THE TAPE ──────────────────────────────────────────────────────────
 *
 * ⛓ It BOOTS INTO THE BLOCK ROOM. `Bot.as:811` re-boots with
 * `new Game(bootLevel, bootX, bootY)` whenever the tape's boot block
 * disagrees with where the player is, so the probe does not need the rope,
 * the corridor or the freeze — the whole context the shaft tape drags
 * along. ~400 ticks against 2,375.
 *
 *   1  equip fire                            (slot 1; a fire leg needs it)
 *   2  press at (14,5)   block 2 (13,5)->(12,5)      = SHAFT_PLAN press 4
 *   3  WALK-PROOF W      stand in (13,5)             — press 4 landed
 *   4  walk to (12,4)                                  press 5's stance
 *   5  press at (12,4)   block 2 (12,5)->(12,6)      = SHAFT_PLAN press 5
 *   6  WALK-PROOF S      stand in (12,5)             — press 5 landed
 *
 * ⛓⛓ AND THE CONTROL IS THE SAME TAPE WITH THE PRESSES DELETED — every
 * walk span identical, both `primary` spans removed. A walk-proof that
 * succeeds in the control proves nothing about a press, so the pair is
 * what makes the two-sided claim: BLOCKED in the control, ENTERED in the
 * press arm, at both proofs.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-press-axes.mjs
 *   node scripts/procgen/probe-seedling-r5-press-axes.mjs --write
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
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { PRESS_AXES } = await import(join(MODULE, 'r5Shaft.js'));

const WRITE = process.argv.includes('--write');
/**
 * ⚠ THE THREE DIAGNOSTIC ARMS ARE NOT WRITTEN BY DEFAULT, per §22.7. The
 * model is REFUTED on them — a wandering spinner wedges the block — so
 * committing them would be a permanent red or a silenced one. `--write`
 * emits only the pair that is byte-exact in BOTH arms; `--write-probes`
 * puts the withdrawn three back for a diagnosis session, and whoever does
 * that has to delete them again.
 */
const WRITE_PROBES = process.argv.includes('--write-probes');
const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
const centre = (tx, ty) => ({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });

// ── 0. the deduction §24.8's number already supports ──────────────────
console.log('## the blocker, from the banked stuck position');
{
    const box = playerBoxAt(PRESS_AXES.stuck.x, PRESS_AXES.stuck.y);
    console.log(`   player box at (${PRESS_AXES.stuck.x}, ${PRESS_AXES.stuck.y}) = `
        + `[${box.x}, ${box.right}) x [${box.y}, ${box.bottom})`);
    console.log(`   the next 1 px step puts its bottom at ${(box.bottom + 1).toFixed(2)}, so the `
        + `blocker's top edge is y = ${PRESS_AXES.blockerTopEdge} — row `
        + `${PRESS_AXES.blockerTopEdge / TILE_SIZE}`);
    console.log('   and it overlaps the player\'s x span, so it is in column '
        + `${Math.floor(box.x / TILE_SIZE)} — i.e. cell (12,5), where press 4 PUT the block. `
        + '⇒ press 4 landed, press 5 did not.');
}

// ── 1. the legs ───────────────────────────────────────────────────────
const world = buildLevelWorld(levelSource(39), { roles: ROLES, inventory: held, cleared: [8] });
const blockAt = (tx, ty) => (world.pushables ?? []).find(
    (p) => Math.floor(p.x / TILE_SIZE) === tx && Math.floor(p.y / TILE_SIZE) === ty);
if (!blockAt(13, 5)) throw new Error('L39 has no pushable on (13,5) — the probe is aimed at nothing');

const BOOT = { level: 39, ...centre(PRESS_AXES.press4.stance[0], PRESS_AXES.press4.stance[1]) };
const targets = [
    { ...centre(...PRESS_AXES.press4.stance), equip: { slot: 1 } },
    {
        ...centre(...PRESS_AXES.press4.stance),
        fire: {
            moves: [{ from: { tx: 13, ty: 5 }, to: { tx: 12, ty: 5 } }],
            enemyRoom: 'L39 holds three spinners and the model tracks no enemy '
                + 'position — but this press has been checked against the GAME: '
                + '`r5-press-delay` and its control are BYTE-EXACT recordings '
                + '(`r5Shaft.SPINNER_WEDGE`). The undelayed arms are the evidence for '
                + 'the refusal this declaration waives, and they are WITHDRAWN.',
        },
    },
    // WALK-PROOF W — the cell press 4 vacated.
    { ...centre(13, 5) },
    { ...centre(...PRESS_AXES.press5.stance) },
    {
        ...centre(...PRESS_AXES.press5.stance),
        fire: {
            moves: [{ from: { tx: 12, ty: 5 }, to: { tx: 12, ty: 6 } }],
            enemyRoom: 'L39 holds three spinners and the model tracks no enemy '
                + 'position — but this press has been checked against the GAME: '
                + '`r5-press-delay` and its control are BYTE-EXACT recordings '
                + '(`r5Shaft.SPINNER_WEDGE`). The undelayed arms are the evidence for '
                + 'the refusal this declaration waives, and they are WITHDRAWN.',
        },
    },
    // WALK-PROOF S — the cell press 5 vacates, and the one the game could
    // not enter at t852.
    { ...centre(12, 5) },
];

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
            persistence: [{
                level: 39,
                tag: 8,
                note: 'parity with `r5-shaft`: the entrance write. Inert in this room, '
                    + 'declared so the two tapes build the same world.',
            }],
            equips: [],
        },
        name: 'r5-press-axes',
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

const pressTape = parseTape(serializeTape({
    ...out.tape,
    description: '⛓⛓ PRESS 4 AND PRESS 5, ISOLATED. §24.8 measured the shaft parting at '
        + 't852 with the player unable to leave tile (12,4) — the blocker\'s top edge is '
        + 'y=80 and it overlaps the player\'s x span, so block 2 is standing in (12,5): '
        + 'press 4 landed and press 5 did not. Nothing in the press itself tells the two '
        + 'apart (same block, same weapon, same 32x32 rect, angles 0.00 and 89.98 with a '
        + '0.1 bothRange band), so this tape asks whether press 5 fails on its own or only '
        + 'inside the shaft\'s 2,375 ticks. It BOOTS INTO THE ROOM — no rope, no corridor, '
        + 'no 197-frame freeze — presses west, WALKS INTO THE VACATED CELL to prove the '
        + 'push landed, then presses south and walks into that one. Its control is this '
        + 'tape with both presses deleted and every walk span identical.',
}));

// ⛓⛓ THE CONTROL IS ONE FIELD APART, AND THE FIELD IS THE PRESSES. Every
// walk span is byte-identical; the two `primary` spans are gone. A
// walk-proof that lands in the control would prove the cell was open all
// along — which is exactly the negative this pair has to exclude.
const controlTape = parseTape(serializeTape({
    ...pressTape,
    name: 'r5-press-axes-control',
    inputs: pressTape.inputs.filter((s) => s.key !== 'primary'),
    description: '⛓ THE SHUT-BEFORE CONTROL for `r5-press-axes`: the same tape with both '
        + '`primary` spans removed and every walk span identical. Both walk-proofs must be '
        + 'BLOCKED here — the block is standing where it spawned and where press 4 would '
        + 'have put it. A proof that succeeds in this arm says the cell was never sealed '
        + 'and the press arm proves nothing.',
}));

/**
 * ⛓⛓ THE THIRD TAPE — AND IT USES THE PLAYER AS A DIPSTICK.
 *
 * The press arm's walk-proof holds `down` for eleven ticks and then stops,
 * because the DRIVER stops when the model reaches its target. That is
 * exactly long enough to see a disagreement and far too short to see WHY —
 * and it is the same artefact §24.8 read as "the block is PARKED, not
 * gliding": the game's y went constant at the tick the walk's input span
 * ENDED, not at the tick the block stopped.
 *
 * So this tape replaces the walk-proof with `down` HELD for
 * `GLIDE_PROBE_TICKS`, and the player's y trace becomes a measurement of
 * the block's south face, tick by tick:
 *
 *   · the tick the player first descends past y = 77 is the tick the
 *     block's top edge left y = 80 — i.e. WHEN the glide started;
 *   · the rate the player descends at is the block's speed (the sweep is
 *     1 px and the gap opens 0.5 px per tick, so the player follows in
 *     1 px steps every other tick — a 0.5 px/tick glide read through a
 *     1 px quantum);
 *   · and where it stops is where the block stopped.
 *
 * ⚠ Its MODEL arm is boring on purpose: the model's block is already at
 * (12,6) when the walk starts, so the model descends to y = 93 (the
 * block's top edge 96, less the player box's 3 px) and sits there. Every
 * tick of difference is the game telling us about the glide.
 */
const GLIDE_PROBE_TICKS = 260;
const glideTape = (() => {
    const press5 = [...pressTape.inputs].reverse().find((s) => s.key === 'primary');
    const walk = pressTape.inputs.find((s) => s.key === 'down' && s.from > press5.from);
    const kept = pressTape.inputs.filter((s) => s.from < walk.from);
    const end = walk.from + GLIDE_PROBE_TICKS;
    return parseTape(serializeTape({
        ...pressTape,
        name: 'r5-press-glide',
        inputs: [...kept, { key: 'down', from: walk.from, to: end }],
        tick_count: end + 4,
        description: '⛓⛓ THE GLIDE, MEASURED WITH THE PLAYER AS A DIPSTICK. Identical to '
            + '`r5-press-axes` up to and including press 5, then holds `down` for '
            + `${GLIDE_PROBE_TICKS} ticks instead of walking to a target. A player pressed `
            + 'against a block gliding at 0.5 px/tick follows it in 1 px steps every other '
            + 'tick, so the y trace dates the start of the glide, measures its speed and '
            + 'says where it stopped — none of which the eleven-tick walk-proof can see. '
            + '⚠ §24.8 read "the game\'s y is constant for seven ticks" as "the block is '
            + 'PARKED"; the y went constant when the walk\'s INPUT SPAN ended.',
    }));
})();

/**
 * ⛓⛓ THE TIME-SHIFTED GLIDE — the same tape, `DELAY` ticks later.
 *
 * The cleanest possible discriminator between a static blocker and a
 * moving one: identical inputs, identical player path, identical press,
 * shifted in absolute time by inserting idle ticks before press 5. A
 * static solid in (12,6) stops the block in the SAME place; anything that
 * moves stops it somewhere else, or not at all.
 */
const DELAY = 120;
const delayTape = (() => {
    const press5 = [...glideTape.inputs].reverse().find((s) => s.key === 'primary');
    const shifted = glideTape.inputs.map((s) => (s.from >= press5.from
        ? { ...s, from: s.from + DELAY, to: s.to + DELAY } : s));
    return parseTape(serializeTape({
        ...glideTape,
        name: 'r5-press-delay',
        inputs: shifted,
        tick_count: glideTape.tick_count + DELAY,
        description: `⛓⛓ \`r5-press-glide\`, ${DELAY} TICKS LATER. Identical inputs and an `
            + 'identical player path, with idle ticks inserted before press 5 so the press '
            + 'lands at a different absolute time. A STATIC solid in (12,6) stops the block '
            + 'in the same place; a MOVING one does not. This is the discriminator, and it '
            + 'is one field apart from the tape it is compared with.',
    }));
})();

/**
 * ⛓ AND THE DELAYED ARM'S OWN SHUT-BEFORE CONTROL — one field apart, the
 * field being the two presses. This is the pair that gets COMMITTED: the
 * delayed arm is byte-exact against the game, so it is the first fixture
 * on the arc that proves a FIRE press moves a block a whole tile, and the
 * control is what makes "the walk entered (12,5)" mean anything.
 */
const delayControlTape = parseTape(serializeTape({
    ...delayTape,
    name: 'r5-press-delay-control',
    inputs: delayTape.inputs.filter((s) => s.key !== 'primary'),
    description: '⛓ THE SHUT-BEFORE CONTROL for `r5-press-delay`: identical tape, both '
        + '`primary` spans deleted, every walk span the same. The block stands where it '
        + 'spawned, so the player is stopped in row 4 by the cell press 4 would have '
        + 'emptied and never reaches row 5 at all.',
}));

/**
 * ⛓⛓ THE FOURTH TAPE — IS THE OBSTRUCTION TRANSIENT?
 *
 * The glide probe says the block stops ~7 px into a 16 px move and stays
 * there for 250 ticks. `moveY` returning a blocker is the only thing in
 * `PushableBlockFire.update` that can do that, so SOMETHING is standing in
 * (12,6) — and the model's census has nothing there.
 *
 * ⛔⛔ THE CANDIDATE IS THE SPINNER, AND THE CENSUS ENTRY THAT HIDES IT IS
 * TRUE. `levelWorld`'s `spinner: notSolid(...)` says "damage only", which
 * is correct for every mover on this arc so far — `Mobile.solids` is
 * `["Solid","Tree","Rock","Rope","ShieldBoss"]` and `Player` only ever
 * pushes `"LavaBoss"` onto it, so an Enemy has never blocked anything.
 * ⛔ But `PushableBlock`/`PushableBlockFire`'s constructors do
 * `solids.push("Enemy", "Player")`. **A pushable block is the only mover
 * in the game that collides with enemies**, and `spinner@224,112` is a
 * `Mobile` with `v = (cos(-π/4), sin(-π/4))` and a `friction()` override
 * that keeps `|v| >= moveSpeed` — it never stops moving.
 *
 * ⇒ a "not solid" verdict is not solid **FOR ONE MOVER'S `solids` LIST**,
 * and this tape is the two-sided test of that: it presses SIX times, 42
 * ticks apart, holding `down` throughout. A static blocker gives the same
 * y forever; a wandering enemy lets one of the six through, and the y
 * trace steps down when it does.
 */
const REPEAT_PRESSES = 6;
const REPEAT_GAP = 42;
const repeatTape = (() => {
    const press5 = [...pressTape.inputs].reverse().find((s) => s.key === 'primary');
    const kept = pressTape.inputs.filter((s) => s.from < press5.from);
    const presses = Array.from({ length: REPEAT_PRESSES }, (_, i) => ({
        key: 'primary', from: press5.from + i * REPEAT_GAP, to: press5.from + i * REPEAT_GAP + 1,
    }));
    const end = press5.from + REPEAT_PRESSES * REPEAT_GAP + 40;
    return parseTape(serializeTape({
        ...pressTape,
        name: 'r5-press-repeat',
        // ⚠ `down` is held from BEFORE the first press and never released,
        // so the player's face stays against the block and its y trace is
        // a continuous readout of where the block's north edge is.
        inputs: [...kept, { key: 'down', from: press5.from - 2, to: end }, ...presses]
            .sort((a, b) => a.from - b.from || a.key.localeCompare(b.key)),
        tick_count: end + 4,
        description: `⛓⛓ SIX PRESSES, ${REPEAT_GAP} TICKS APART, WITH \`down\` HELD. Asks `
            + 'whether the thing standing in (12,6) is STATIC or MOVING. The model\'s '
            + 'census has nothing there at all; the candidate is `spinner@224,112`, which '
            + 'is `notSolid` in the census — a verdict measured against `Mobile.solids`, '
            + 'the list the PLAYER carries. `PushableBlockFire`\'s constructor pushes '
            + '"Enemy" and "Player" onto its own copy, so a block is the one mover in the '
            + 'game that an enemy blocks. A static blocker gives the same y for the whole '
            + 'tape; a wandering spinner lets a later press through and the y steps down.',
    }));
})();

// ── 2. what the model says each arm does ──────────────────────────────
const report = (name, tape) => {
    const run = runTape(tape, { levelSource });
    const end = run.ticks[run.ticks.length - 1];
    const enters = (tx, ty) => run.ticks.some((t) => Math.floor(t.x / TILE_SIZE) === tx
        && Math.floor(t.y / TILE_SIZE) === ty);
    console.log(`\n## ${name}`);
    console.log(`   ${tape.tick_count} ticks, ${tape.inputs.length} spans — ends `
        + `L${end.level} (${end.x.toFixed(2)},${end.y.toFixed(2)}) tile `
        + `(${Math.floor(end.x / TILE_SIZE)},${Math.floor(end.y / TILE_SIZE)})`);
    console.log(`   walk-proof W — enters (13,5): ${enters(13, 5) ? 'YES' : 'NO'}`);
    console.log(`   walk-proof S — enters (12,5): ${enters(12, 5) ? 'YES' : 'NO'}`);
    return { run, enters };
};
const press = report('r5-press-axes (the press arm)', pressTape);
const control = report('r5-press-axes-control (presses deleted)', controlTape);
const glide = report('r5-press-glide (down HELD after press 5)', glideTape);
report('r5-press-repeat (six presses, down HELD)', repeatTape);
report(`r5-press-delay (the glide probe, ${DELAY} ticks later)`, delayTape);
report('r5-press-delay-control (its shut-before arm)', delayControlTape);

console.log('\n## the press ticks, so the recording can be read against them');
for (const f of out.fires) console.log(`   t${f.from}..${f.to}`);

// ── 3. the claims, on the MODEL, before anything is recorded ──────────
const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });
check(press.enters(13, 5) && press.enters(12, 5),
    '⛓ the press arm enters BOTH vacated cells',
    'which is what the game is being asked about');
check(!control.enters(13, 5) && !control.enters(12, 5),
    '⛓⛓ the control enters NEITHER — the cells are sealed without the presses',
    'a walk-proof is only evidence if the shut arm fails it');
check(out.fires.length === 2, '⛓ exactly two presses', `${out.fires.length}`);
{
    const last = glide.run.ticks[glide.run.ticks.length - 1];
    check(Math.abs(last.y - 93) < 1,
        '⛓ the glide probe\'s MODEL arm rests against the block at (12,6) — y ≈ 93',
        `y = ${last.y.toFixed(2)}; every tick the GAME differs from this is the glide `
        + 'the model finished early');
}

let bad = 0;
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);

if (WRITE || WRITE_PROBES) {
    const emit = WRITE_PROBES
        ? [pressTape, controlTape, glideTape, repeatTape, delayTape, delayControlTape]
        : [delayTape, delayControlTape];
    for (const t of emit) {
        const path = join(MODULE, 'fixtures', 'tapes', `${t.name}.json`);
        writeFileSync(path, serializeTape(t));
        console.log(`\n   wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the tapes)');
}
