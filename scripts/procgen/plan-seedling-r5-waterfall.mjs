#!/usr/bin/env node
/**
 * plan-seedling-r5-waterfall — `climbsArmedWaterfall`'s LIVE WITNESS.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 4, step 5. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §15.10, which lists this
 * as the one planner rule with no live witness at all.
 *
 * ── WHY BOTH ARMS ─────────────────────────────────────────────────────
 * The rule is a REFUSAL — an armed waterfall is a one-way DOWNWARD tile —
 * so a run in which a feather-holder climbs is not evidence for it. It is
 * equally consistent with a game where nothing was pushing down. The pair
 * is one field apart in `grants` and the arms answer different questions:
 * the exempting one says the exemption works, the REFUSING one says there
 * was something to be exempt from.
 *
 * ⛔ `noHazards` IS EMPTY ON BOTH — the first tape on the arc with no
 * coercion at all. It has to be: the tiles above and below L0's waterfall
 * are WATER, so a featherless probe under one is also a swimmer, and
 * coercing water would have coerced the very thing being stood on. The
 * conch is therefore in BOTH arms and is not the field they differ in.
 *
 * ⚠⚠ AND THIS CORRECTS A RECORDED NUMBER. `botDriverV2`'s own docblock
 * says a featherless player holding UP on this tile for 120 ticks moves
 * "3.33 px DOWN" — measured at R4, when the swim term was hard-coded to
 * zero. `hazardFlagsFor`'s `inWater` is `eff == 1 || eff == 25`, so a
 * waterfall runs the water speed table AND the `soundPosition("Swim")`
 * boost, and under the real term the same arm goes 24 px UP and then
 * STALLS at the face. The rule survives: 0.45 + 0.25 is still under 0.8.
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-waterfall.mjs            # plan
 *   node scripts/procgen/plan-seedling-r5-waterfall.mjs --write    # emit
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
const { climbsArmedWaterfall } = await import(join(MODULE, 'botDriverV2.js'));
const { WATERFALL_PAIR } = await import(join(MODULE, 'r5Swim.js'));

const WRITE = process.argv.includes('--write');
const source = atlasLevelSource();

// ── 1. the tile, and the water around it ──────────────────────────────
const world = buildLevelWorld(source(WATERFALL_PAIR.level), { roles: ROLES });
const typeAt = (tx, ty) => world.walkableTiles.find((t) => t.tx === tx && t.ty === ty)?.t;
const { tx, ty } = WATERFALL_PAIR.tile;
console.log(`## L${WATERFALL_PAIR.level}'s waterfall at (${tx},${ty})`);
console.log(`   the tile itself: type ${typeAt(tx, ty)}; below (${tx},${ty + 1}): `
    + `${typeAt(tx, ty + 1)}; above (${tx},${ty - 1}): ${typeAt(tx, ty - 1)}`);
if (typeAt(tx, ty) !== HAZARD_STATES.waterfall) {
    throw new Error(`(${tx},${ty}) is type ${typeAt(tx, ty)}, not a waterfall`);
}
// ⛔ AND THIS IS WHY `noHazards` IS EMPTY. A coercion that kept the probe
// alive on the water below would have coerced the waterfall too, or forced
// the pair to differ in two fields instead of one.
for (const dy of [-1, 1]) {
    if (typeAt(tx, ty + dy) !== HAZARD_STATES.water) {
        throw new Error(`the tile ${dy < 0 ? 'above' : 'below'} the waterfall is type `
            + `${typeAt(tx, ty + dy)}, not water — the reason both arms carry the conch is `
            + 'that they are swimmers, and if that stopped being true the pair should '
            + 'differ in a different field');
    }
}
console.log('   ⛔ water above AND below — which is why both arms hold the conch and '
    + '`noHazards` is EMPTY');

// The planner's own rule, asked directly, so the fixtures below are a
// witness for THE SHIPPED PREDICATE rather than for a re-derivation of it.
const step = { from: { tx, ty: ty + 1 }, to: { tx, ty } };
const armed = { noHazards: [], inventory: { canSwim: true, hasFeather: false }, lattice: 16 };
const exempt = { ...armed, inventory: { canSwim: true, hasFeather: true } };
console.log(`   climbsArmedWaterfall(up into it, featherless) = `
    + `${climbsArmedWaterfall(world, step.from, step.to, armed)}`);
console.log(`   climbsArmedWaterfall(up into it, feather held) = `
    + `${climbsArmedWaterfall(world, step.from, step.to, exempt)}`);
if (!climbsArmedWaterfall(world, step.from, step.to, armed)
    || climbsArmedWaterfall(world, step.from, step.to, exempt)) {
    throw new Error('the shipped predicate does not say what this pair is a witness for');
}

// ── 2. the two arms ───────────────────────────────────────────────────
const tapeFor = (name, items, description) => ({
    game: 'seedling',
    tape_version: 5,
    name,
    description,
    boot: { ...WATERFALL_PAIR.boot },
    noclip: false,
    noDamage: true,
    noHazards: [...WATERFALL_PAIR.noHazards],
    grants: [{ level: WATERFALL_PAIR.level, items }],
    persistence: [],
    equips: [],
    pins: [...WATERFALL_PAIR.pins],
    inputs: [{ key: 'up', from: WATERFALL_PAIR.holdFrom, to: WATERFALL_PAIR.holdTo }],
    tick_count: WATERFALL_PAIR.tickCount,
});

const shut = tapeFor(WATERFALL_PAIR.shut, ['conch'],
    '⛓ `climbsArmedWaterfall`\'s REFUSAL ARM — the half without which the rule and NO '
    + 'rule look the same. Holds UP for 178 ticks under L0\'s `waterfall@208,112`. It '
    + 'swims the 24 px of water below, reaches the waterfall\'s bottom edge and STALLS '
    + 'there, oscillating on the face with `onWaterfall` true: `Player.input()`\'s last '
    + 'act is `v.y += 0.8` and the exemption is `!hasFeather || v.y >= 0`. ⛔ `noHazards` '
    + 'is EMPTY — no coercion anywhere, the first tape on the arc like that — because the '
    + 'tiles above and below the waterfall are WATER and coercing them would have coerced '
    + 'the thing being stood on. The conch is in BOTH arms for that reason; the feather is '
    + 'the one field apart. ⚠ And the swim term is LIVE here: `inWater` is '
    + '`eff == 1 || eff == 25`, so this arm gets the +0.25 boost on the waterfall itself '
    + 'and still cannot climb it.');
const climb = tapeFor(WATERFALL_PAIR.climb, ['conch', 'feather'],
    '⛓ `climbsArmedWaterfall`\'s EXEMPTING ARM — `hasFeather` held, and NOTHING else '
    + 'changed. The same 178 ticks that stall `r5-waterfall-shut` on the face carry this '
    + 'arm 116 px up, through `waterfall@208,112` and out onto the ground above it. '
    + '`Player.input()` skips the `v.y += 0.8` for upward motion when the feather is held, '
    + 'which is the whole of the planner\'s one DIRECTED edge rule — a rule that until now '
    + 'had no live witness at all: R3 stood on this tile with it COERCED and R4 armed it '
    + 'while the swim term was hard-coded to zero.');

for (const t of [shut, climb]) {
    const rest = assertWindowEndsAtRest(t);
    if (rest.length > 0) throw new Error(`${t.name} not at rest:\n  ${rest.join('\n  ')}`);
    parseTape(serializeTape(t));
}

const runOf = (t) => {
    const run = runTape(t, { levelSource: source });
    const end = run.ticks.at(-1);
    return { run, end, net: WATERFALL_PAIR.startY - end.y, row: Math.floor(end.y / TILE_SIZE) };
};
const s = runOf(shut);
const c = runOf(climb);
console.log('\n## the pair — ONE FIELD APART (`grants`)');
console.log(`   shut   ends L${s.end.level} y=${s.end.y.toFixed(3)} row ${s.row} — `
    + `${s.net.toFixed(3)} px up from the boot, and it is PINNED on the face`);
console.log(`   climb  ends L${c.end.level} y=${c.end.y.toFixed(3)} row ${c.row} — `
    + `${c.net.toFixed(3)} px up, through the tile and out`);
if (s.row !== WATERFALL_PAIR.shutRow) {
    throw new Error(`the refusing arm ends in row ${s.row}, not the declared `
        + `${WATERFALL_PAIR.shutRow}. Past it means the waterfall did not push; short of `
        + 'it means the arm never reached the face and the refusal is unproven.');
}
if (c.row !== WATERFALL_PAIR.climbRow) {
    throw new Error(`the exempting arm ends in row ${c.row}, not the declared `
        + `${WATERFALL_PAIR.climbRow}`);
}
if (!(c.net > s.net * 4)) {
    throw new Error(`the two arms are too close: ${c.net} against ${s.net}. A pair whose `
        + 'arms differ by a little is a pair whose difference could be anything.');
}
// ⛓ AND THE REFUSING ARM REALLY TOUCHED THE TILE. Without this the arm is
// indistinguishable from one that never got there — the same shape as a
// drowning control that never reached the water.
const onFace = s.run.ticks.filter((o) => Math.floor(o.y / TILE_SIZE) === WATERFALL_PAIR.shutRow);
console.log(`   the refusing arm spent ${onFace.length} observation(s) in the waterfall's `
    + 'own row — it reached the face and was held there, rather than never arriving');
if (onFace.length < 20) {
    throw new Error(`the refusing arm was only in row ${WATERFALL_PAIR.shutRow} for `
        + `${onFace.length} observation(s). A refusal proved by a walk that never got `
        + 'there is not a refusal.');
}
for (const [label, r] of [['shut', s], ['climb', c]]) {
    if (r.run.final.vx !== 0 || r.run.final.vy !== 0) {
        throw new Error(`the ${label} arm ends MOVING — v=(${r.run.final.vx},${r.run.final.vy})`);
    }
    if (r.run.final.drown.timer !== 0) {
        throw new Error(`the ${label} arm's drownTimer is ${r.run.final.drown.timer} — both `
            + 'arms hold the conch, so a moving timer means the grant did not reach '
            + '`checkDrowning`');
    }
}

if (WRITE) {
    const dir = join(MODULE, 'fixtures', 'tapes');
    for (const t of [shut, climb]) {
        writeFileSync(join(dir, `${t.name}.json`), serializeTape(t));
        console.log(`   wrote ${join(dir, `${t.name}.json`)}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the two tapes)');
}
