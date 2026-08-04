#!/usr/bin/env node
/**
 * plan-seedling-r5-swim — ARMED WATER: the pair, and the swim term's stratum.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 4, step 4. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §15.10.
 *
 * Three tapes, two claims:
 *
 *   r5-swim-cross / r5-swim-drown   ⛓ WATER IS ARMED. One field apart, and
 *                                   byte-identical in every observation —
 *                                   `checkDrowning` does not touch movement
 *                                   until it latches — so the entire
 *                                   evidence is `drown_timer`, 0 against 4.
 *                                   That is what `DROWN_EXPECTED` exists for.
 *   r5-swim-latch                   ⛓ THE SWIM TERM, INCLUDING THE LATCH.
 *                                   Swim, stop in the water past the
 *                                   channel's own length, swim again — and
 *                                   the resumed step is 0.700 against the
 *                                   0.450 of a mid-cycle tick. The
 *                                   difference is 0.250, which is
 *                                   `Player.as:530`'s addend exactly, and
 *                                   both numbers are the game's positions.
 *
 * ⚠ THE LATCH IS INVISIBLE TO THE READOUT. `Sfx.onComplete` zeroes
 * `_position`, so `botStatus.sound_pin` reports a COMPLETED channel as
 * `{playing:false, frames:0}` — the same thing it reports for one that never
 * played. A claim phrased over the readout would be satisfied by a run that
 * never entered the water. So the claim is phrased over the MOVEMENT.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-swim.mjs            # plan + report
 *   node scripts/procgen/plan-seedling-r5-swim.mjs --write    # write the tapes
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { serializeTape, parseTape, HAZARD_STATES } = await import(join(MODULE, 'tapeFormat.js'));
const { assertWindowEndsAtRest } = await import(join(MODULE, 'director.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { SWIM_BOOST_SPEED } = await import(join(MODULE, 'swimSoundClock.js'));
const {
    DROWN_EXPECTED, DROWN_TIMER_MAX, L48_APPROACH, L48_WATER, SWIM_LATCH, SWIM_PAIR,
} = await import(join(MODULE, 'r5Swim.js'));

const WRITE = process.argv.includes('--write');
const source = atlasLevelSource();

// ── 1. the water column, confirmed against the extract ────────────────
{
    const w = buildLevelWorld(source(L48_WATER.level), {
        roles: ROLES, inventory: { hasFire: true },
    });
    const typeAt = (tx, ty) => w.walkableTiles.find((t) => t.tx === tx && t.ty === ty)?.t;
    console.log(`## L${L48_WATER.level}'s water column`);
    const rows = [];
    for (let ty = L48_WATER.topRow; ty <= L48_WATER.bottomRow; ty += 1) {
        rows.push(`(${L48_WATER.column},${ty})=${typeAt(L48_WATER.column, ty)}`);
        if (typeAt(L48_WATER.column, ty) !== HAZARD_STATES.water) {
            throw new Error(`tile (${L48_WATER.column},${ty}) is type `
                + `${typeAt(L48_WATER.column, ty)}, not water — the declared column is stale`);
        }
    }
    console.log(`   ${rows.join(' ')}`);
    // ...and the tile ABOVE it is not, so a swim north has a wall of its own.
    const above = typeAt(L48_WATER.column, L48_WATER.topRow - 1);
    console.log(`   the tile above the column, (${L48_WATER.column},`
        + `${L48_WATER.topRow - 1}), is type ${above} — not water, so the column ENDS`);
    if (above === HAZARD_STATES.water) {
        throw new Error('the column does not end where the declaration says it does');
    }
}

const tapeBase = (name, grants, inputs, tickCount, description) => ({
    game: 'seedling',
    tape_version: 5,
    name,
    description,
    boot: { ...SWIM_PAIR.boot },
    noclip: false,
    noDamage: true,
    noHazards: [...SWIM_PAIR.noHazards],
    grants,
    persistence: [],
    equips: [],
    pins: [...SWIM_PAIR.pins],
    inputs,
    tick_count: tickCount,
});

// ── 2. ⛓ THE PAIR, one field apart ────────────────────────────────────
const PAIR_INPUTS = [
    ...L48_APPROACH.map((s) => ({ ...s })),
    { key: 'up', from: 6, to: SWIM_PAIR.upTo },
    { key: 'down', from: SWIM_PAIR.downFrom, to: SWIM_PAIR.downTo },
];
const cross = tapeBase(SWIM_PAIR.cross,
    [{ level: 47, items: ['fire', 'conch'] }], PAIR_INPUTS, SWIM_PAIR.tickCount,
    '⛓ THE ARMED-WATER PAIR, arm 1 of 2 — the conch HELD. `noHazards` is '
    + '["waterfall"] ONLY: water is LIVE for the first time on the whole arc, and this '
    + 'arm swims seven ticks of it and comes back. `checkDrowning`\'s water arm is '
    + '`eff == 1 && !canSwim`, so the conch takes its early return and `drownTimer` stays '
    + '0. ⚠ Its control is this tape with `conch` removed from `grants` and NOTHING else '
    + 'changed — and the two streams are BYTE-IDENTICAL, because drowning does not touch '
    + 'movement until it latches at eleven cumulative ticks. The whole difference between '
    + 'the arms is a counter inside the game, which is why the control needs a named '
    + 'declaration in `r5Swim.DROWN_EXPECTED` to be allowed to fail the harness\'s '
    + '`drownTimer === 0` check.');
const drown = tapeBase(SWIM_PAIR.drown,
    [{ level: 47, items: ['fire'] }], PAIR_INPUTS, SWIM_PAIR.tickCount,
    '⛓ THE ARMED-WATER PAIR, arm 2 of 2 — the conch WITHHELD, and this is the arm that '
    + 'proves the water is real. Identical to `r5-swim-cross` in every field but '
    + '`grants`, and identical in every observation too. `checkDrowning` writes '
    + '`drownTimer = drownTimerMax` on the first contact tick and decrements on every '
    + 'later one, so seven ticks of live water leave it at 4 — a number that could not '
    + 'exist if `noHazards` still carried "water", if the walk never reached the tile, or '
    + 'if the item were held anyway. ⚠ SEVEN, NOT ELEVEN: at eleven `drowning` latches '
    + 'and `drown()` spins the player to `die()`, and a dead player\'s stream is a '
    + 'respawn, not a comparison. `r5Swim.DROWN_EXPECTED` declares the band this must '
    + 'land in, two-sidedly — a drowning control that reports 0 is a RED.');

// ── 3. ⛓ THE LATCH ───────────────────────────────────────────────────
const latch = tapeBase(SWIM_LATCH.name,
    [{ level: 47, items: ['fire', 'conch'] }],
    [
        ...L48_APPROACH.map((s) => ({ ...s })),
        { key: 'up', from: SWIM_LATCH.phaseA.from, to: SWIM_LATCH.phaseA.to },
        { key: 'up', from: SWIM_LATCH.phaseC.from, to: SWIM_LATCH.phaseC.to },
    ], SWIM_LATCH.tickCount,
    '⛓ THE SWIM TERM\'S LIVE STRATUM, including the CHANNEL-LIFECYCLE LATCH. Three '
    + 'phases in one leg up L48\'s water column: swim 164 ticks (the channel plays, '
    + 'completes and REPLAYS every 47 frames because `v` is non-zero, and between the six '
    + 'boosted frames of each cycle the step is a flat 0.450); STOP for 90 ticks in the '
    + 'water (the channel completes and is NOT replayed — `Player.as:531` gates the '
    + 'replay on `v.length > 0` — so it sits closed at position 0 and the boost LATCHES); '
    + 'then swim again, and the first tick steps 0.700. ⛓ 0.700 − 0.450 = 0.250, which is '
    + '`Player.as:530`\'s addend exactly, and both numbers are the GAME\'S OWN POSITIONS '
    + 'one tick apart. ⚠ The claim is phrased over the MOVEMENT because it cannot be '
    + 'phrased over the readout: `Sfx.onComplete` zeroes `_position`, so `sound_pin` '
    + 'reports a completed channel as {playing:false, frames:0} — identical to one that '
    + 'never played at all.');

// ── 4. model them, and check every declared number ────────────────────
const report = (t) => {
    const rest = assertWindowEndsAtRest(t);
    if (rest.length > 0) throw new Error(`${t.name} not at rest:\n  ${rest.join('\n  ')}`);
    parseTape(serializeTape(t));
    const run = runTape(t, { levelSource: source });
    const end = run.ticks.at(-1);
    return { run, end, final: run.final };
};

console.log('\n## the pair — ONE FIELD APART (`grants`), and byte-identical');
const c = report(cross);
const d = report(drown);
const sameStream = JSON.stringify(c.run.ticks) === JSON.stringify(d.run.ticks);
console.log(`   cross  ends L${c.end.level} (${c.end.x},${c.end.y}) drownTimer `
    + `${c.final.drown.timer}`);
console.log(`   drown  ends L${d.end.level} (${d.end.x},${d.end.y}) drownTimer `
    + `${d.final.drown.timer}`);
console.log(`   the two observation streams are ${sameStream ? 'BYTE-IDENTICAL' : 'DIFFERENT'}`
    + ' — which is why `drown_timer` is not merely the best evidence but the only evidence');
if (!sameStream) {
    throw new Error('the two arms produced different streams. Drowning does not touch '
        + 'movement until it latches, so a difference here means one arm latched — check '
        + 'the contact budget.');
}
if (c.final.drown.timer !== 0) {
    throw new Error(`the conch arm's drownTimer is ${c.final.drown.timer}, not 0 — `
        + '`checkDrowning`\'s early return is gated on `canSwim` and the grant must reach it');
}
const contact = DROWN_TIMER_MAX - d.final.drown.timer + 1;
console.log(`   the drowning arm stood ${contact} tick(s) on live water `
    + `(timer ${d.final.drown.timer} of ${DROWN_TIMER_MAX})`);
if (d.final.drown.timer !== SWIM_PAIR.drownTimer) {
    throw new Error(`the drowning arm's timer is ${d.final.drown.timer}, not the declared `
        + `${SWIM_PAIR.drownTimer}`);
}
const decl = DROWN_EXPECTED[SWIM_PAIR.drown];
if (!decl) throw new Error(`${SWIM_PAIR.drown} is not declared in DROWN_EXPECTED — the `
    + 'harness asserts drownTimer === 0 on every undeclared tape and this one must fail it');
if (contact < decl.minTicks || contact > decl.maxTicks) {
    throw new Error(`${contact} contact ticks is outside the declared band `
        + `[${decl.minTicks},${decl.maxTicks}]`);
}
for (const [label, r] of [['cross', c], ['drown', d]]) {
    if (r.final.vx !== 0 || r.final.vy !== 0) {
        throw new Error(`the ${label} arm ends MOVING — v=(${r.final.vx},${r.final.vy})`);
    }
    if (r.final.terrain === HAZARD_STATES.water) {
        throw new Error(`the ${label} arm ends STANDING IN WATER. The drowning arm's timer `
            + 'would keep running past the tape, which is a claim about where the '
            + 'recording stopped rather than about the walk.');
    }
}
console.log(`   both arms end at rest on terrain ${c.final.terrain} (row `
    + `${Math.floor(c.end.y / TILE_SIZE)}) — out of the water, so the timer stops where `
    + 'the tape says it does');

// ── 5. ⛓ THE LATCH, measured from the modelled positions ──────────────
console.log('\n## the latch — the swim term, seen in the movement');
const l = report(latch);
// ⚠ OBSERVATION t IS THE STATE AFTER t TICKS (RECORD-THEN-ACT), so the
// displacement PRODUCED BY tick t is the difference between observations
// t+1 and t. Off by one the other way and this reads the tick before.
const stepAt = (t) => l.run.ticks[t + 1].y - l.run.ticks[t].y;
const steady = -stepAt(SWIM_LATCH.steadyTick);
const latched = -stepAt(SWIM_LATCH.latchedTick);
console.log(`   phase A, tick ${SWIM_LATCH.steadyTick} (mid-cycle, channel open past `
    + `frame 5): step ${steady.toFixed(3)} px`);
console.log(`   phase C, tick ${SWIM_LATCH.latchedTick} (the channel completed 90 ticks `
    + `ago and was never replayed): step ${latched.toFixed(3)} px`);
console.log(`   ⛓ the difference is ${(latched - steady).toFixed(3)} px, and `
    + `\`SWIM_BOOST_SPEED\` is ${SWIM_BOOST_SPEED}`);
if (Math.abs(steady - SWIM_LATCH.steadyStep) > 1e-9) {
    throw new Error(`the mid-cycle step is ${steady}, not the declared `
        + `${SWIM_LATCH.steadyStep} — either the tick is not mid-cycle or the water speed `
        + 'moved');
}
if (Math.abs((latched - steady) - SWIM_BOOST_SPEED) > 1e-9) {
    throw new Error(`the latched step exceeds the steady one by ${latched - steady}, not `
        + `${SWIM_BOOST_SPEED}. The whole claim is that a completed, un-replayed channel `
        + 'reads 0 and the boost latches — if this is not the addend, it is not the boost.');
}
if (l.final.vx !== 0 || l.final.vy !== 0) {
    throw new Error(`the latch leg ends MOVING — v=(${l.final.vx},${l.final.vy})`);
}
console.log(`   terminal L${l.end.level} (${l.end.x},${l.end.y}) row `
    + `${Math.floor(l.end.y / TILE_SIZE)}, still inside the column `
    + `[${L48_WATER.topRow},${L48_WATER.bottomRow}]`);
if (Math.floor(l.end.y / TILE_SIZE) < L48_WATER.topRow) {
    throw new Error('the latch leg swam out of the top of the column');
}

if (WRITE) {
    const dir = join(MODULE, 'fixtures', 'tapes');
    for (const t of [cross, drown, latch]) {
        writeFileSync(join(dir, `${t.name}.json`), serializeTape(t));
        console.log(`   wrote ${join(dir, `${t.name}.json`)}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the three tapes)');
}
