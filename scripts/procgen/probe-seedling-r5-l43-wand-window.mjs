#!/usr/bin/env node
/**
 * probe-seedling-r5-l43-wand-window — ⛓⛓⛓ THE TERMINAL WAND WINDOW,
 * DRIVEN IN THE MODEL BEFORE A RECORDING IS SPENT.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 23 step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §37. The plan it drives is
 * §36.9's (`r5Totem.L43_WAND_WINDOW`); the tick table it lands on is §34.3's
 * (`r5Totem.L43_BOSS_WAKE.ticks`), banked by
 * `probe-seedling-r5-l43-boss-wake.mjs` three slices earlier.
 *
 * ── WHY A PROBE AND NOT STRAIGHT TO A TAPE ────────────────────────────
 *
 * Every R5 recording that was refuted at first contact was refuted by a
 * mechanism the model had no category for, and the two that were byte-exact
 * on the first try were the two whose schedule had been driven offline
 * first. This drives the whole window through `createLevelRun` — the same
 * object `tapeRunner` drives — and prints the schedule, so the tape can be
 * authored against numbers instead of against arithmetic.
 *
 * ── ⛔⛔ THE THING THIS PROBE EXISTS TO CATCH ─────────────────────────
 *
 * **THE CLAMP IS A FLOOR AT y 212 AND THE WAND SITS AT 232.** A window that
 * collects the wand and stands still never triggers the assignment at all,
 * and would report a green "the clamp holds" having tested nothing. The
 * window therefore has to spend the 31 live ticks between the rocks' freeze
 * draining (A+185) and `fullyActivated` (A+215) going NORTH — through the
 * space the boss's own wall occupied until it woke — and be caught by the
 * clamp on the way back down. `run.bossClamps` is the witness and an EMPTY
 * list is a FAILURE, not a pass.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l43-wand-window.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { L43_BOSS_WAKE, L43_WAND_WINDOW } = await import(join(MODULE, 'r5Totem.js'));
const { bossWakeTable, wandFadeFreezeTicks } = await import(join(MODULE, 'bossTotem.js'));

const checks = [];
const check = (ok, name, detail) => {
    checks.push({ ok, name, detail });
    console.log(`   ${ok ? '✓' : '⛔'} ${name}\n      ${detail}`);
};

/**
 * ⛓ The boot cell: tile (9,13), one row NORTH of the wand and SOUTH of the
 * boss's wall.
 *
 * ⚠ A `boot` BLOCK IS `new Game(level, x, y)`'s ARGUMENTS, not the entity
 * point: `spawnFromBoot` adds `(Tile.w/2, Tile.h/2)`. So the tile CORNER
 * (144,208) is what puts the player at the CENTRE (152,216). Writing the
 * centre here spawns a whole tile east and south — which for this window is
 * the difference between walking into the wand's 3x8 press rect and walking
 * straight past it, with no error anywhere.
 */
const BOOT = { level: 43, x: 144, y: 208 };
/** The wand's press rect, from the world build: [150,153) x [228,236). */
const WAND_RECT = { x: 150, right: 153, y: 228, bottom: 236 };

/**
 * Drive one arm.
 *
 * @param {number[]} totemParts  the v6 `save.totem_parts` this arm presents
 * @param {object[]} inputs      the tape spans
 */
function drive(totemParts, inputs, tickCount) {
    const run = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: BOOT,
        noclip: false,
        noHazards: ['water', 'pit', 'lava', 'ice', 'waterfall'],
        noDamage: true,
        grants: [{ level: 43, items: ['sword', 'fire', 'conch', 'feather'] }],
        persistence: [],
        equips: [],
        pins: ['sound', 'dead_frames'],
        save: { totem_parts: totemParts, keys: [], seal_parts: [] },
        roles: ROLES,
    });
    const held = (t) => new Set(inputs.filter((s) => t >= s.from && t < s.to)
        .map((s) => s.key));
    const stream = [];
    for (let t = 0; t < tickCount; t += 1) {
        stream.push({ t, x: run.state.x, y: run.state.y, level: run.level });
        run.advance(held(t));
    }
    return { run, stream };
}

console.log('## L43 — the terminal wand window, driven in the model\n');
console.log(`   boot ${JSON.stringify(BOOT)}   wand rect ${JSON.stringify(WAND_RECT)}\n`);

// ── 1. the arithmetic the window is planned against ──────────────────
const table = bossWakeTable(186);
check(table.clampOnset === L43_BOSS_WAKE.ticks.clampOnset,
    'the wake table is slice 20\'s, re-derived',
    `activation ${table.activation}, ramp ${table.rampStarts}, `
    + `fullyActivated ${table.fullyActivated}, CLAMP ${table.clampOnset}, `
    + `rest drained ${table.restDrained}, WALK ${table.walkStarts}`);
check(wandFadeFreezeTicks() === 99,
    'the wand FADE is 99 frozen frames, not 100',
    `${wandFadeFreezeTicks()} frames of \`Game.freezeObjects = alpha < 1\`; the `
    + 'hundredth alpha step leaves the flag FALSE, so it is a live frame');

// ── 2. the DRIVE, in three phases ────────────────────────────────────
//
// The spans are authored here rather than by a driver verb because the
// window is three straight-line moves and one dialogue, and a planner that
// searched for it would be searching a 7-tile room.
const DOWN_TO_WAND = 10;         // (9,13) -> the wand's rect, ~10 px at 1.2 px/tick
/**
 * ⛓ THE DIALOGUE IS INPUT-BOUNDED AND THE TAPE PAYS FOR IT, which no other
 * R5 ceremony is. `NPC.update` advances on `Input.released(Key.X)`, so the
 * releases are the tape's own — nine presses at a two-tick cadence, and the
 * ceremony completes in 17 frames.
 *
 * ⚠ THE CADENCE IS SAFE FROM THE DASH FOR A REASON THAT IS NOT THE CADENCE.
 * A second press inside `slashTimerMax` (20) knocks the player along their
 * OWN VELOCITY (§14.4), and two ticks is well inside it — but the armed arm
 * is FROZEN for the whole span, and by the time the control's presses land
 * its velocity has drained. What makes it safe is the standing still.
 */
const TALK = [];
for (let i = 0; i < 9; i += 1) {
    TALK.push({ key: 'primary', from: DOWN_TO_WAND + i * 2, to: DOWN_TO_WAND + i * 2 + 1 });
}
/**
 * ⛓ THE NORTHWARD RUN — the 31 live ticks between the rocks' freeze
 * draining (A+185) and `fullyActivated` (A+215), which is the ONLY span in
 * which the clamp can be witnessed at all.
 */
const NORTH_FROM = 28;
const NORTH_TO = 60;
const TICKS = 120;
const INPUTS = [
    { key: 'down', from: 0, to: DOWN_TO_WAND },
    ...TALK,
    { key: 'up', from: NORTH_FROM, to: NORTH_TO },
];

let armed = null;
try {
    armed = drive([0, 1, 2, 3, 4], INPUTS, TICKS);
} catch (e) {
    check(false, 'the armed arm drives', e.message);
}

if (armed) {
    const { run, stream } = armed;
    check(run.collected.length === 1 && run.collected[0].item === 'wand',
        'the wand is COLLECTED, for real',
        JSON.stringify(run.collected));
    check(run.wandFades.length === 1,
        'the approach FADE fired once, before the contact',
        JSON.stringify(run.wandFades));
    check(run.rockFalls.length === 3,
        'the publication dropped all THREE tset-0 rocks',
        run.rockFalls.map((r) => `${r.id} ${r.deadFrames}f`).join(', '));
    const totalRockFrames = run.rockFalls[0]?.deadFrames ?? 0;
    check(run.rockFalls.every((r) => r.deadFrames === totalRockFrames),
        '…and they share ONE span, not three',
        `each ${totalRockFrames} frames; three sequential drops would have charged `
        + `${run.rockFalls.reduce((a, r) => a + r.deadFrames, 0)}`);
    check(run.bossesWoken.length === 1,
        'the boss WOKE, and only because the Wand left the world',
        JSON.stringify(run.bossesWoken));
    check(run.bossClamps.length > 0,
        '⛓⛓⛓ THE CLAMP FIRED — and an empty list here is the failure this probe exists for',
        run.bossClamps.length === 0 ? 'NO CLAMP: the walk never got north of y 212'
            : `${run.bossClamps.length} tick(s), first at tape tick `
            + `${run.bossClamps[0].t} (sinceActivation ${run.bossClamps[0].sinceActivation}), `
            + `y ${run.bossClamps[0].from.toFixed(2)} -> ${run.bossClamps[0].to}`);
    if (run.bossClamps.length > 0) {
        const first = run.bossClamps[0];
        check(first.sinceActivation === L43_BOSS_WAKE.ticks.clampOnset,
            '…on exactly the tick the table says',
            `sinceActivation ${first.sinceActivation} vs `
            + `L43_BOSS_WAKE.ticks.clampOnset ${L43_BOSS_WAKE.ticks.clampOnset}`);
        const band = L43_WAND_WINDOW.boundaryBand;
        const last = run.bossesWoken[0].sinceActivation;
        check(last >= band.from && last <= band.to,
            'the window ENDS inside the 118-tick boundary band',
            `A+${last} against [A+${band.from}, A+${band.to}]`);
    }
    const north = Math.min(...stream.slice(NORTH_FROM).map((o) => o.y));
    check(north < 212,
        'the walk really did get north of the clamp — through the boss\'s old wall',
        `northernmost y ${north.toFixed(2)}, the wall was [180,212)`);
    const end = stream[stream.length - 1];
    check(end.level === 43, 'the window is TERMINAL — it never leaves L43',
        `ends at (${end.x.toFixed(2)}, ${end.y.toFixed(2)}) in level ${end.level}`);
    console.log(`\n   spans: ${JSON.stringify(INPUTS)}`);
    console.log(`   tick_count: ${TICKS}`);
    console.log(`   frozenFramesOwed: ${run.frozenFramesOwed}`);
}

// ── 3. THE CONTROL — one boot field apart ────────────────────────────
console.log('\n## the CONTROL — the same tape, `save.totem_parts: []`\n');
let ctrl = null;
try {
    ctrl = drive([], INPUTS, TICKS);
} catch (e) {
    check(false, 'the control arm drives', e.message);
}
if (ctrl && armed) {
    check(ctrl.run.collected.length === 0,
        '⛔ the wand is INERT — `Wand.update`\'s body never runs',
        `collected ${JSON.stringify(ctrl.run.collected)}`);
    check(ctrl.run.wandFades.length === 0 && ctrl.run.rockFalls.length === 0
        && ctrl.run.bossesWoken.length === 0,
        '…so there is no fade, no rock, no wake and no clamp — a quiet room',
        `fades ${ctrl.run.wandFades.length}, rocks ${ctrl.run.rockFalls.length}, `
        + `woken ${ctrl.run.bossesWoken.length}, clamps ${ctrl.run.bossClamps.length}`);
    let firstDiff = -1;
    for (let i = 0; i < armed.stream.length; i += 1) {
        const a = armed.stream[i];
        const b = ctrl.stream[i];
        if (a.x !== b.x || a.y !== b.y || a.level !== b.level) { firstDiff = i; break; }
    }
    check(firstDiff > 0,
        '⛓⛓ the two arms are a byte-identical PREFIX and part at ONE place',
        firstDiff < 0 ? 'they never part — the pair discriminates nothing'
            : `first divergence at tick ${firstDiff}: armed y `
            + `${armed.stream[firstDiff].y.toFixed(2)} vs control y `
            + `${ctrl.stream[firstDiff].y.toFixed(2)}`);
    const ctrlNorth = Math.min(...ctrl.stream.slice(NORTH_FROM).map((o) => o.y));
    check(ctrlNorth >= 212,
        '⛔ and the control is STOPPED BY THE WALL the wake removes',
        `control northernmost y ${ctrlNorth.toFixed(2)} against the boss box's `
        + 'bottom edge 212 — the same number the clamp assigns, one mechanism apart');
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${failed.length === 0 ? '✓ ALL CHECKS PASSED' : `⛔ ${failed.length} FAILED`}`
    + ` (${checks.length} checks)`);
if (failed.length > 0) {
    for (const f of failed) console.log(`   ⛔ ${f.name}`);
    process.exitCode = 1;
}
