#!/usr/bin/env node
/**
 * probe-seedling-r5-spinner — THE BILLIARD, AND THE TWO ARMS THAT COME BACK.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 13 step 0. Brief:
 * the R5 kickoff §25.3 / §26.
 *
 * ── WHAT SLICE 12 LEFT ────────────────────────────────────────────────
 *
 * The wedge was diagnosed and not built: `Spinner` blocks a
 * `PushableBlock*` (its ctor pushes "Enemy" onto its own solids list) and it
 * MOVES, so the model's glide predictions in L39 and L40 were unearned and
 * `runFire` refused every `moves` press in a room with live enemies. Three
 * diagnostic tapes established it and were WITHDRAWN per §22.7, because a
 * fixture whose model is refuted is either a permanent red or a silenced one.
 *
 * ── ⛔⛔ AND THE DRIVER THAT AUTHORED THEM CANNOT AUTHOR THEM AGAIN ────
 *
 * That is not a setback, it is the fix reporting itself. `synthesizeLegs`
 * now refuses press 5's declared move — *"the declared blocks ended at
 * [pushableblockfire@208,80->12,5] rather than [...->12,6]"*, which is
 * exactly what the game did — and one leg later it would refuse the
 * walk-proof into a cell it now knows is sealed. Re-synthesising would
 * produce DIFFERENT tapes wearing the same names.
 *
 * ── ⛓⛓ SO TWO OF THE THREE ARE RECONSTRUCTED, AND CHECKED ────────────
 *
 * `r5-press-glide` and `r5-press-repeat` are pure, documented span
 * transforms of `r5-press-delay`, which IS committed and IS byte-exact
 * against the game. Both transforms invert (`r5Shaft.SPINNER_WEDGE.
 * reconstruction`), and the results are checked against `tick_count`s the
 * GAME measured in the slice-12 session — numbers that predate this
 * arithmetic, so a transform with a span wrong lands on a different total.
 *
 * ⛔ `r5-press-axes` DOES NOT COME BACK. Its final leg is an eleven-tick
 * walk-proof that the `glide` construction REPLACED, so its span's `to`
 * survives in no artefact. Named rather than guessed: a fabricated span
 * called "byte-exact" would be the circularity this whole ladder is built to
 * avoid. Its finding is subsumed — `glide` is the same tape held longer and
 * diverges on the same tick at the same y.
 *
 * ── ⛓ R5RETIRE (W37): THE RETIRED PROBE'S PAIR LIVES HERE NOW ─────────
 *
 * `probe-seedling-r5-press-axes` (which authored `r5-press-delay` and its
 * control) is retired. This probe now re-emits `r5-press-delay-control` (a
 * pure transform of the root), holds `r5-press-delay` canonical as a ROOT that
 * nothing derives, and carries the retired probe's surviving claims: the
 * pair's two-sided walk-proof on the model and the `PRESS_AXES` blocker
 * deduction. See §1b.
 *
 * ── THE FREE HALF OF THE ACCEPTANCE, BEFORE ANY RECORDING ─────────────
 *
 * `--record` prints the FIRST diverging tick with BOTH streams' values on
 * it, so each refuted arm left behind one exact game-side observation. Two
 * survive in `SPINNER_WEDGE.probes[].gameY`, to the full double:
 *
 *   r5-press-glide    t157   y = 83.83122648907042
 *   r5-press-repeat   t143   y = 90.98122648907042
 *
 * A model that reproduces those two is reproducing the game at exactly the
 * ticks the old one failed on, for nothing. Byte-exactness over the whole
 * stream is the recording's job and it is 20 seconds.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-spinner.mjs
 *   node scripts/procgen/probe-seedling-r5-spinner.mjs --write
 *   node scripts/procgen/probe-seedling-r5-spinner.mjs --check
 *       (exit 1 unless the three committed tapes it derives — glide, repeat and
 *        delay-control — are, byte for byte, what this probe derives)
 *   node scripts/procgen/check-seedling-bot-differential.mjs --record --win \
 *       --only=r5-press-glide,r5-press-repeat
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';


import { argvHelp } from './argvHelp.js';
import { emitFixtures } from './producerFixtureBytes.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { SPINNER_WEDGE, PRESS_AXES } = await import(join(MODULE, 'r5Shaft.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const {
    SPINNER, createSpinnerState, spinnerRect, stepSpinners,
} = await import(join(MODULE, 'spinner.js'));

const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');
const levelSource = atlasLevelSource();
const tapePath = (n) => join(MODULE, 'fixtures', 'tapes', `${n}.json`);

const checks = [];
const check = (ok, name, detail) => {
    checks.push({ ok, name, detail });
    console.log(`   ${ok ? '✓' : '✗'} ${name}`);
    if (detail) console.log(`      ${detail}`);
};
const probe = (name) => {
    const p = SPINNER_WEDGE.probes.find((q) => q.tape === name);
    if (!p) throw new Error(`no banked probe named ${name}`);
    return p;
};

// ── 0. the trajectory, on its own, before any tape ────────────────────
//
// The cheapest possible sanity check on the transcription: simulate L39's
// three spinners forward with no player at all and report where they go.
// If the motion were player-coupled this could not be done, and the fact
// that it can is `runRange = 0`.
console.log('## the billiard, simulated with no route input at all');
{
    const world = buildLevelWorld(levelSource(39), {
        roles: ROLES,
        inventory: { hasSword: true, hasFire: true, canSwim: true, hasFeather: true },
        cleared: [8],
    });
    const st = createSpinnerState(world);
    const collides = (rect) => world.collidesSolid(rect, {});
    const tileTypeAt = (x, y) => world.nearestWalkableTile(x, y)?.t;
    const start = [...st.byId.values()].map((s) => ({ id: s.id, x: s.x, y: s.y }));
    let bounces = 0;
    const seen = new Map(start.map((s) => [s.id, new Set()]));
    for (let t = 0; t < 900; t += 1) {
        const before = [...st.byId.values()].map((s) => `${s.vx.toFixed(4)},${s.vy.toFixed(4)}`);
        stepSpinners(st, { collides, tileTypeAt });
        const after = [...st.byId.values()].map((s) => `${s.vx.toFixed(4)},${s.vy.toFixed(4)}`);
        for (let i = 0; i < after.length; i += 1) if (before[i] !== after[i]) bounces += 1;
        for (const s of st.byId.values()) {
            seen.get(s.id).add(`${Math.floor(s.x / TILE_SIZE)},${Math.floor(s.y / TILE_SIZE)}`);
        }
    }
    for (const s of st.byId.values()) {
        const from = start.find((q) => q.id === s.id);
        console.log(`   ${s.id}: (${from.x},${from.y}) -> (${s.x.toFixed(2)},${s.y.toFixed(2)}) `
            + `over ${seen.get(s.id).size} cell(s)${s.removed ? ' — REMOVED' : ''}`);
    }
    check(bounces > 0, '⛓ the spinners REFLECT — the geometry is doing something',
        `${bounces} axis flip(s) in 900 ticks across ${st.byId.size} spinner(s)`);
    check([...st.byId.values()].every((s) => !s.removed),
        '⛓ none of L39\'s three reaches water, lava or a pit in 900 ticks',
        'a terrain death WRITES ITS TAG (`spinner.SPINNER_TERRAIN_WRITE`), so a shaft '
        + 'ledger of nine would silently become ten');
    check([...st.byId.values()].every((s) => Math.abs(Math.hypot(s.vx, s.vy) - SPINNER.moveSpeed) < 1e-9),
        '⛓⛓ |v| is STILL exactly moveSpeed after 900 ticks',
        '`friction()`\'s floor is `moveSpeed`, not 0 — the override is what makes this a '
        + 'billiard rather than something that coasts to a stop');
    const boxes = [...st.byId.values()].map(spinnerRect);
    check(boxes.every((b) => b.w === 7 && b.h === 7),
        '⛓ the body is the 7x7 `setHitbox(7, 7, 4, 4)` puts on it',
        `[${boxes.map((b) => `${b.x.toFixed(2)},${b.y.toFixed(2)}`).join('] [')}]`);
}

// ── 1. the reconstruction ─────────────────────────────────────────────
console.log('\n## the two arms that come back, from the committed pair');
const delay = parseTape(readFileSync(tapePath('r5-press-delay'), 'utf8'));
const R = SPINNER_WEDGE.reconstruction;

const press5Delay = [...delay.inputs].reverse().find((s) => s.key === 'primary');
const glide = parseTape(serializeTape({
    ...delay,
    name: 'r5-press-glide',
    inputs: delay.inputs.map((s) => (s.from >= press5Delay.from
        ? { ...s, from: s.from - R.delayTicks, to: s.to - R.delayTicks } : s)),
    tick_count: delay.tick_count - R.delayTicks,
    description: '⛓⛓ THE GLIDE, MEASURED WITH THE PLAYER AS A DIPSTICK — and RECONSTRUCTED '
        + `from \`r5-press-delay\` by removing its ${R.delayTicks}-tick shift, because the `
        + 'driver that authored it is now correct and therefore refuses to. Identical to '
        + 'the delayed arm up to and including press 5, then holds `down` for 260 ticks. A '
        + 'player pressed against a block gliding at 0.5 px/tick follows it in 1 px steps '
        + 'every other tick, so the y trace dates the glide, measures its speed and says '
        + 'where it stopped. ⛔⛔ THE PRESS IS WEDGED: `spinner@224,112` stands in the '
        + 'corridor, the block parks ~7 px into a 16 px move, and `hit()`\'s '
        + '`if (v.length > 0) return` swallows everything after. This is the arm that '
        + 'REFUTED the pre-slice-13 model, at t157.',
}));
check(glide.tick_count === probe('r5-press-glide').tickCount,
    '⛓⛓ the glide reconstruction lands on the tick count THE GAME measured',
    `${glide.tick_count} against the recorded ${probe('r5-press-glide').tickCount} `
    + '(observation count - 1, from the slice-12 session — a number that predates this '
    + 'arithmetic, so a span transformed wrong would miss it)');

const press5 = [...glide.inputs].reverse().find((s) => s.key === 'primary');
const repeatEnd = press5.from + R.repeatPresses * R.repeatGap + R.repeatTail;
const repeat = parseTape(serializeTape({
    ...glide,
    name: 'r5-press-repeat',
    inputs: [
        ...glide.inputs.filter((s) => s.from < press5.from),
        // `down` from BEFORE the first press and never released, so the
        // player's face stays against the block and its y is a continuous
        // readout of where the block's north edge is.
        { key: 'down', from: press5.from - 2, to: repeatEnd },
        ...Array.from({ length: R.repeatPresses }, (_, i) => ({
            key: 'primary',
            from: press5.from + i * R.repeatGap,
            to: press5.from + i * R.repeatGap + 1,
        })),
    ].sort((a, b) => a.from - b.from || a.key.localeCompare(b.key)),
    tick_count: repeatEnd + 4,
    description: `⛓⛓ SIX PRESSES, ${R.repeatGap} TICKS APART, WITH \`down\` HELD — the `
        + 'two-sided test of whether the thing in the corridor is STATIC or MOVING, '
        + 'RECONSTRUCTED from `r5-press-delay`. A static blocker gives the same y for the '
        + 'whole tape; a wandering spinner would let a later press through and the y would '
        + 'step down. ⛔ IT DOES NOT: the block jams ~14 px in at t143 and the FIVE LATER '
        + 'PRESSES ARE ALL SWALLOWED, because a blocked block keeps `v` non-zero forever '
        + '(`input()` re-derives it from `tile`, `moveY` resets `tile` to the current '
        + 'cell) and `PushableBlockFire.hit`\'s first line is `if (v.length > 0) return`. '
        + 'A wedged block can never be un-wedged by pressing it.',
}));
check(repeat.tick_count === probe('r5-press-repeat').tickCount,
    '⛓⛓ the repeat reconstruction lands on ITS recorded tick count too',
    `${repeat.tick_count} against ${probe('r5-press-repeat').tickCount}`);
check(repeat.inputs.filter((s) => s.key === 'primary').length === R.repeatPresses + 1,
    `⛓ ${R.repeatPresses} presses plus press 4`,
    `${repeat.inputs.filter((s) => s.key === 'primary').length} \`primary\` spans`);

// ⛓⛓ AND THE INVERSE, WHICH IS WHAT MAKES THE FORWARD TRANSFORM EVIDENCE.
// Re-applying the shift to the reconstruction must give back the committed
// tape BYTE FOR BYTE — otherwise "it inverts" is a sentence about a diagram.
{
    const p5 = [...glide.inputs].reverse().find((s) => s.key === 'primary');
    const back = serializeTape(parseTape(serializeTape({
        ...glide,
        name: delay.name,
        inputs: glide.inputs.map((s) => (s.from >= p5.from
            ? { ...s, from: s.from + R.delayTicks, to: s.to + R.delayTicks } : s)),
        tick_count: glide.tick_count + R.delayTicks,
        description: delay.description,
    })));
    check(back === serializeTape(delay),
        '⛓⛓ THE TRANSFORM INVERTS, BYTE FOR BYTE — shifting the reconstruction back gives '
        + 'the committed tape',
        'which is the difference between "these are the same spans" and "these look like '
        + 'the same spans"');
}

// ── 1b. the committed pair: `r5-press-delay` (ROOT) and its control ───
//
// ⛓⛓ R5RETIRE (W37): FOLDED FROM `probe-seedling-r5-press-axes`, which is
// retired. That probe authored `r5-press-delay` and `r5-press-delay-control`
// with `synthesizeLegs`, and its drive has refused press 5's declared move
// since the spinner wedge was modelled (the block ends at (12,5), as the GAME's
// undelayed arms did) — so it could re-emit neither.
//
//   · `r5-press-delay` is a ROOT: a byte-exact game recording whose author is
//     gone. Nothing derives it. This probe holds it CANONICAL (it re-serialises
//     to its own bytes) and every reconstruction above inverts back to it.
//   · `r5-press-delay-control` is a PURE TRANSFORM of the root — the same tape
//     with both `primary` spans deleted, every walk span identical — so it is
//     re-emitted here, byte for byte, and `--check` covers it.
//
// ⚠ BOTH ARE IN THE RE-PIN'S SPELLING, not `serializeTape`'s: the version-5
// `dead_frames` re-pin wrote `pins` on ONE line (41 committed tapes carry it;
// `plan-seedling-pushblock-witness.mjs` emits the same way). `pinsOneLine` is
// that spelling, and it is the only difference — measured: 8 bytes per tape.
console.log('\n## the committed pair — the root and its shut-before control');
const pinsOneLine = (text) => text.replace(/"pins": \[\s*"dead_frames"\s*\]/, '"pins": ["dead_frames"]');
const delayText = readFileSync(tapePath('r5-press-delay'), 'utf8');
check(pinsOneLine(serializeTape(parseTape(delayText))) === delayText,
    '⛓ `r5-press-delay` is a canonical ROOT — it re-serialises to its own bytes',
    'no producer derives it (its author refuses press 5 now); it is the recording every '
    + 'arm in this probe is a transform of');
const delayControl = parseTape(serializeTape({
    ...delay,
    name: 'r5-press-delay-control',
    inputs: delay.inputs.filter((s) => s.key !== 'primary'),
    description: '⛓ THE SHUT-BEFORE CONTROL for `r5-press-delay`: identical tape, both '
        + '`primary` spans deleted, every walk span the same. The block stands where it '
        + 'spawned, so the player is stopped in row 4 by the cell press 4 would have '
        + 'emptied and never reaches row 5 at all.',
}));
check(delay.inputs.filter((s) => s.key === 'primary').length === 2
        && delayControl.inputs.filter((s) => s.key === 'primary').length === 0
        && delayControl.inputs.length === delay.inputs.length - 2,
    '⛓ the pair is ONE FIELD APART: two presses in the root, none in the control, every '
    + 'other span the same',
    `${delay.inputs.length} spans against ${delayControl.inputs.length}`);
{
    // ⛓⛓ The two-sided walk-proof on the MODEL (r5-press-axes §3, re-aimed at
    // the committed pair): the press arm enters BOTH cells the presses vacate,
    // and the control enters NEITHER. `r5Acceptance.pressPairFindings` asks the
    // same of the GAME's streams.
    const enters = (run, tx, ty) => run.ticks.some((t) => Math.floor(t.x / TILE_SIZE) === tx
        && Math.floor(t.y / TILE_SIZE) === ty);
    const pressRun = runTape(delay, { levelSource });
    const controlRun = runTape(delayControl, { levelSource });
    check(enters(pressRun, 13, 5) && enters(pressRun, 12, 5),
        '⛓ the model\'s press arm enters BOTH vacated cells, (13,5) and (12,5)',
        'press 4 lands, and 120 ticks later press 5 does too — the spinner is elsewhere');
    check(!enters(controlRun, 13, 5) && !enters(controlRun, 12, 5),
        '⛓⛓ the model\'s control enters NEITHER — the cells are sealed without the presses',
        'a walk-proof is only evidence if the shut arm fails it');
}
{
    // ⛓ The deduction §24.8's banked number supports (r5-press-axes §0): the
    // shaft's stuck position puts the blocker's top edge at y = 80, in column
    // 12 — cell (12,5), where press 4 PUT the block. Pure arithmetic on
    // `r5Shaft.PRESS_AXES`; nothing else asserts it.
    const box = playerBoxAt(PRESS_AXES.stuck.x, PRESS_AXES.stuck.y);
    const edge = Math.ceil(box.bottom);
    check(edge === PRESS_AXES.blockerTopEdge
            && edge / TILE_SIZE === PRESS_AXES.blockerCell.ty
            && Math.floor(box.x / TILE_SIZE) === PRESS_AXES.blockerCell.tx
            && Math.floor((box.right - 1e-9) / TILE_SIZE) === PRESS_AXES.blockerCell.tx,
        `⛓ the shaft's stuck box puts the blocker in (${PRESS_AXES.blockerCell.tx},`
        + `${PRESS_AXES.blockerCell.ty}) — press 4 landed, press 5 did not`,
        `box [${box.x}, ${box.right}) x [${box.y}, ${box.bottom}); the next 1 px step crosses `
        + `y = ${edge}`);
}

// ── 2. the model, against the game's own numbers ──────────────────────
console.log('\n## the model against the two game-side observations the refutation left behind');
for (const tape of [glide, repeat]) {
    const p = probe(tape.name);
    const run = runTape(tape, { levelSource });
    const tick = run.ticks.find((k) => k.t === p.divergesAt);
    const end = run.ticks[run.ticks.length - 1];
    check(tick && tick.y === p.gameY,
        `⛓⛓ ${tape.name} t${p.divergesAt}: the model is on the GAME's y, to the double`,
        `model ${tick ? tick.y : 'MISSING'} against game ${p.gameY}`
        + `${tick && tick.y !== p.gameY ? ` — dy ${(tick.y - p.gameY).toFixed(6)}` : ''}`);
    console.log(`      …and it ends t${end.t} at (${end.x.toFixed(2)}, ${end.y.toFixed(2)}) `
        + `tile (${Math.floor(end.x / TILE_SIZE)},${Math.floor(end.y / TILE_SIZE)})`);
}

// ⛓ AND THE WEDGE IS THE MODEL'S OWN VERDICT, not a y coincidence: the
// block ends in the cell press 5 was supposed to EMPTY.
{
    const run = runTape(repeat, { levelSource });
    const blocks = [...run.pushables.entries()]
        .filter(([, b]) => !b.removed)
        .map(([id, b]) => `${id}->${Math.floor(b.rect.x / TILE_SIZE)},${Math.floor(b.rect.y / TILE_SIZE)}`);
    check(blocks.some((b) => b.endsWith('->12,5')),
        '⛓⛓ after SIX presses the block is still in (12,5) — the cell press 5 was to empty',
        `[${blocks.join(' ')}]`);
}

// ── 3. what a recording would add ─────────────────────────────────────
console.log('\n## what is still owed');
console.log('   ⛔ `r5-press-axes` is NOT reconstructible — its eleven-tick walk-proof span '
    + 'survives in no artefact. Subsumed by `r5-press-glide`, which diverges on the same '
    + `tick (${probe('r5-press-axes').divergesAt}) at the same y.`);
console.log('   ⚠ the two checks above are ONE TICK EACH. Byte-exactness over the whole '
    + 'stream needs the recording:');
console.log('     node scripts/procgen/check-seedling-bot-differential.mjs --record --win '
    + '--only=r5-press-glide,r5-press-repeat');

const bad = checks.filter((c) => !c.ok).length;
const outputs = [
    ...[glide, repeat].map((t) => ({ path: tapePath(t.name), text: serializeTape(t) })),
    { path: tapePath(delayControl.name), text: pinsOneLine(serializeTape(delayControl)) },
];
if (!emitFixtures(outputs, { write: WRITE, check: CHECK })) {
    console.log('\n(dry run — pass --write to emit the two tapes, --check to compare them)');
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);
console.log(`\n${checks.length}/${checks.length} claims PASS`);
