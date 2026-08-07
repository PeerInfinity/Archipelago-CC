#!/usr/bin/env node
/**
 * plan-seedling-r5-l43-wand — ⛓⛓⛓ THE TERMINAL WAND WINDOW, AND THE
 * CLEANEST SHUT-BEFORE CONTROL ON THE ARC.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 23 step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §37; the plan is §36.9's
 * (`r5Totem.L43_WAND_WINDOW`) and the tick table is §34.3's
 * (`r5Totem.L43_BOSS_WAKE.ticks`).
 *
 * ── WHAT THE WINDOW DOES ──────────────────────────────────────────────
 *
 * It boots into level 43 at tile (9,13), one row north of the Wand and one
 * row south of the boss's wall, PRESENTING all five totem parts through the
 * slice-23 AS3 batch's version-6 `save` block. Then, in one visit:
 *
 *   1. walk DOWN ten ticks into `wand@144,224`'s 3x8 press rect — during
 *      which the approach FADE has already frozen the game for 99 frames,
 *      because `Wand.update`'s gate is the player's Y and not a collision;
 *   2. take the ceremony: 150 `specialTimer` frames and a two-page dialogue
 *      the TAPE advances (nine `primary` presses at a two-tick cadence),
 *      because this is the only INPUT-BOUNDED ceremony in R5;
 *   3. `removed()` fires — `hasWand`, the persistence clear, and the loop
 *      that sets `activate = true` on every tset-0 `Activators` in the room:
 *      all THREE of L43's `fallrock`s, in ONE 186-frame freeze;
 *   4. the boss WAKES, because the Wand has left the world;
 *   5. run NORTH through the space the boss's own wall occupied, in the 31
 *      live ticks between the freeze draining (A+185) and `fullyActivated`
 *      (A+215);
 *   6. and get CLAMPED — `p.y := 212`, an ASSIGNMENT at the top of
 *      `BossTotem.update`, at A+216 exactly.
 *
 * ── ⛔⛔⛔ WHY STEP 5 IS THE WINDOW AND NOT A FLOURISH ────────────────
 *
 * **THE CLAMP IS A FLOOR AT y 212 AND THE WAND SITS AT 232.** A window that
 * collected the wand and stood still would never trigger the assignment at
 * all, and would report a green "the clamp holds" having tested nothing.
 * The northward run is what makes the claim falsifiable.
 *
 * ── ⛓⛓⛓ THE PAIR — ONE BOOT FIELD APART ─────────────────────────────
 *
 * The control is the SAME TAPE with `save.totem_parts: []`. Nothing else
 * differs: same boot, same spans, same grants, same pins.
 *
 * That is a control of a kind this arc has not had before. §36.6 could not
 * delete the kill (the shooter's clock is a function of whether it died);
 * §33.7 could not hole the choreographies (the player ends up inside a
 * body). Here the TREATMENT IS UNCHANGED and only the WORLD'S GATE moves —
 * `Wand.update`'s whole body, contact test included, is behind
 * `Player.hasAllTotemParts()`. The control therefore:
 *
 *   - is byte-identical for ticks 0..9 and parts at tick 10, the CONTACT
 *     tick, because in one arm the world freezes there and in the other it
 *     does not;
 *   - collects nothing, fades nothing, drops no rock, wakes no boss and
 *     takes no clamp — `frozenFramesOwed` 0 against the drive's 285;
 *   - and is stopped going north at y **214.05** by the boss's wall, whose
 *     bottom edge is 212 — ⛓⛓ THE SAME NUMBER THE CLAMP ASSIGNS, ONE
 *     MECHANISM APART. A collision in the control, an assignment in the
 *     drive.
 *
 * ⚠ AND THE FIRST CUT OF THIS PAIR HAD A CONTROL THAT COLLECTED THE WAND.
 * The model gated the FADE on `hasAllTotemParts()` and not the CONTACT, and
 * `Wand.update` gates both — `super.update()` (i.e. `Pickup.update`, the
 * only caller of `collide("Player", …)`) is the ELSE of the alpha ramp
 * INSIDE the same `if`. The control woke the boss and reproduced the clamp
 * tick for tick. **A control that does the thing it exists to refute is not
 * a weak control; it is not a control.**
 *
 * Usage:
 *   node scripts/procgen/plan-seedling-r5-l43-wand.mjs [--write]
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
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { L43_BOSS_WAKE, L43_WAND_WINDOW } = await import(join(MODULE, 'r5Totem.js'));

/**
 * ⚠ THE BOOT BLOCK IS `new Game(level, x, y)`'s ARGUMENTS, not the entity
 * point — `spawnFromBoot` adds `(Tile.w/2, Tile.h/2)`. Tile (9,13)'s CORNER
 * is (144,208) and its CENTRE is (152,216); writing the centre here spawns
 * a whole tile east and walks straight past the wand's 3 px press rect,
 * with no error anywhere.
 */
const BOOT = { level: 43, x: 144, y: 208 };
const GRANTS = [{ level: 43, items: ['sword', 'fire', 'conch', 'feather'] }];
const PINS = ['sound', 'dead_frames'];

const DOWN_TO_WAND = 10;
const TALK_PRESSES = 4;
/**
 * ⛔⛔⛔ THE PRESS CADENCE IS 31, AND IT IS NOT A STYLE CHOICE — IT IS WHAT
 * MAKES THE PAIR AN EXPERIMENT.
 *
 * The first cut used TWO, and the control's recording refuted it: the two
 * arms share a tape, and nine `primary` presses at a two-tick cadence mean
 * two different things in it. In the DRIVE they land on the ceremony's
 * frozen ticks and advance an input-bounded dialogue. In the CONTROL —
 * where the boot field is shut, so there IS no ceremony — they land on LIVE
 * ticks, and `Player.as:784`'s `if (slashTimer > 0 && _s && !slashDashed)`
 * fires `knockback(2, new Point(x - v.x, y - v.y))`: **a sword DASH**. The
 * game's stream showed it as a -0.25/tick decay from 2.20, which is the
 * coasting 0.20 plus knockback's 2.00.
 *
 * ⇒ **an input whose MEANING depends on the world is not a shared
 * treatment**, and "the same tape, one boot field apart" was true of the
 * BYTES and false of the EXPERIMENT.
 *
 * 31 is §14.9's own proven-inert number: `slashTimerMax` is 20, so a press
 * 31 ticks after the last one always finds `slashTimer` at 0 and can never
 * become a dash. Every press is then a bare slash that reaches nothing —
 * L43 holds no Grass, no breakable and no `onlyHitBy: "Sword"` target
 * within the 16 px rect — and is inert in the arm where it is not the
 * treatment, BY CONSTRUCTION.
 *
 * ⚠ "Press at rest" is NOT the fix, however tempting: the knockback's
 * direction is `(x - v.x, y - v.y)`, which at v = 0 is the player's own
 * position — a degenerate vector to normalise, and a claim with no driven
 * witness behind it. The cadence has one.
 */
const TALK_CADENCE = 31;
const TALK_FROM = DOWN_TO_WAND + 4;
/**
 * ⛓ THE NORTHWARD RUN IS PLACED RELATIVE TO THE COLLECT, NOT TO THE PRESS
 * SCHEDULE — measured at 109 with this cadence, so A+186 (the first live
 * tick after the rocks' freeze) is tape tick 110.
 *
 * ⛔ The first cut derived it from the press schedule instead and
 * `levelRun` REFUSED the run by name: the boss started WALKING at tick 258,
 * past `L43_WAND_WINDOW.boundaryBand`'s ceiling. That refusal is the guard
 * working — a window whose boundary drifts past A+334 is one that ends in a
 * room holding an unmodelled mover.
 *
 *   collect        tape 109        A+185 resolved inside this tick
 *   first live     tape 110   =    A+186
 *   CLAMP          tape 140   =    A+216
 *   boss WALKS     tape 259   =    A+335   <- the ceiling
 *   the band       tape [141, 258]
 */
const COLLECT_AT = 109;
const NORTH_FROM = COLLECT_AT + 3;
const NORTH_TO = NORTH_FROM + 32;
const TICK_COUNT = 200;

const INPUTS = [
    { key: 'down', from: 0, to: DOWN_TO_WAND },
    ...Array.from({ length: TALK_PRESSES }, (_, i) => ({
        key: 'primary',
        from: TALK_FROM + i * TALK_CADENCE,
        to: TALK_FROM + i * TALK_CADENCE + 1,
    })),
    { key: 'up', from: NORTH_FROM, to: NORTH_TO },
];

const tapeFor = (name, totemParts, description) => parseTape({
    tape_version: 6,
    game: 'seedling',
    name,
    description,
    boot: BOOT,
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'pit', 'lava', 'ice', 'waterfall'],
    grants: GRANTS,
    persistence: [],
    equips: [],
    pins: PINS,
    save: { totem_parts: totemParts, keys: [], seal_parts: [] },
    tick_count: TICK_COUNT,
    inputs: INPUTS,
});

const tape = tapeFor('r5-l43-wand', [0, 1, 2, 3, 4],
    'R5 slice 23: the TERMINAL wand window. Boots into L43 with all five totem '
    + 'parts PRESENTED through the v6 save block, takes the wand, and is caught by '
    + "BossTotem's clamp (p.y := 212, an ASSIGNMENT) at A+216 on the way north.");
const control = tapeFor('r5-l43-wand-control', [],
    'R5 slice 23: the shut-before control — the SAME tape with '
    + '`save.totem_parts: []`. `Wand.update`\'s whole body, contact test included, '
    + 'is behind `Player.hasAllTotemParts()`, so the pickup is inert, the boss stays '
    + 'a wall, and the northward run is stopped by a COLLISION at 214.05 where the '
    + 'drive is stopped by an ASSIGNMENT at 212.');

function drive(t) {
    const run = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: t.boot,
        noclip: t.noclip,
        noHazards: t.noHazards,
        noDamage: t.noDamage,
        grants: t.grants,
        persistence: t.persistence,
        equips: t.equips,
        pins: t.pins,
        save: t.save,
        roles: ROLES,
    });
    const held = (k) => new Set(t.inputs.filter((s) => k >= s.from && k < s.to)
        .map((s) => s.key));
    const stream = [];
    for (let k = 0; k < t.tick_count; k += 1) {
        stream.push({ t: k, x: run.state.x, y: run.state.y, level: run.level });
        run.advance(held(k));
    }
    return { run, stream };
}

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

const a = drive(tape);
const c = drive(control);

check(a.run.collected.length === 1 && a.run.collected[0].item === 'wand',
    'the drive COLLECTS the wand, for real',
    `${JSON.stringify(a.run.collected)} — and the ceremony's dialogue frames are the `
    + "tape's own presses, because this is R5's only input-bounded ceremony");
check(a.run.wandFades.length === 1 && a.run.wandFades[0].deadFrames === 99,
    'the approach FADE costs 99 frozen frames, and it fires BEFORE the contact',
    `${JSON.stringify(a.run.wandFades)} — \`Game.freezeObjects = alpha < 1\` is `
    + 'written AFTER the step, so the hundredth alpha step leaves the flag false and '
    + 'is a LIVE frame. The records\' `fadeTicks: 100` is the step count, not the cost.');
check(a.run.rockFalls.length === 3
    && new Set(a.run.rockFalls.map((r) => r.deadFrames)).size === 1,
    'the publication drops all THREE tset-0 rocks in ONE 186-frame span',
    `${a.run.rockFalls.map((r) => `${r.id} ${r.deadFrames}f`).join(', ')} — three `
    + `sequential drops would have charged ${a.run.rockFalls.reduce((s, r) => s + r.deadFrames, 0)}, `
    + 'and the rocks fall together with the EARLIEST camera expiry ending the freeze '
    + 'for all of them');
check(a.run.frozenFramesOwed === 285,
    'the window owes 285 frozen frames, and they are two spans not one',
    `${a.run.frozenFramesOwed} = 99 (the fade) + 186 (the rocks). The 150 `
    + '`specialTimer` frames and the dialogue are the ceremony\'s own and are counted '
    + 'by `collected`.');
check(a.run.bossesWoken.length === 1,
    'the boss WAKES, and only because the Wand left the world',
    `${JSON.stringify(a.run.bossesWoken)} — \`classCount(Wand) <= 0\` is the whole `
    + 'trigger, and `removeSelf()` is the ceremony\'s LAST act');
check(a.run.bossClamps.length > 0
    && a.run.bossClamps[0].sinceActivation === L43_BOSS_WAKE.ticks.clampOnset,
    '⛓⛓⛓ THE CLAMP FIRES AT A+216 EXACTLY, and it is an ASSIGNMENT',
    a.run.bossClamps.length === 0
        ? '⛔ NO CLAMP AT ALL — the walk never got north of 212, and a window that '
        + 'collected the wand and stood still would report this as a pass'
        : `${a.run.bossClamps.length} clamped tick(s); the first is tape tick `
        + `${a.run.bossClamps[0].t}, sinceActivation ${a.run.bossClamps[0].sinceActivation}, `
        + `y ${a.run.bossClamps[0].from.toFixed(2)} -> ${a.run.bossClamps[0].to} — a `
        + `${(a.run.bossClamps[0].to - a.run.bossClamps[0].from).toFixed(2)} px teleport `
        + 'in one tick, which is the sharpest witness this room can produce');
const northMost = Math.min(...a.stream.slice(NORTH_FROM).map((o) => o.y));
check(northMost < 212,
    'the drive really runs NORTH through the space the wall occupied',
    `northernmost y ${northMost.toFixed(2)}; the unwoken boss's box is [180,212) and `
    + 'an activated one is `type = "Enemy"`, which is not in `Mobile.solids`');
const last = a.run.bossesWoken[0]?.sinceActivation ?? -1;
check(last >= L43_WAND_WINDOW.boundaryBand.from && last <= L43_WAND_WINDOW.boundaryBand.to,
    'the window ENDS inside the 118-tick boundary band',
    `A+${last} against [A+${L43_WAND_WINDOW.boundaryBand.from}, `
    + `A+${L43_WAND_WINDOW.boundaryBand.to}] — floored by the CLAMP and ceilinged by `
    + 'the boss WALKING, neither of which is the freeze or the laser');
check(a.stream[a.stream.length - 1].level === 43,
    'the window is TERMINAL — it never leaves L43',
    `ends at (${a.stream[a.stream.length - 1].x.toFixed(2)}, `
    + `${a.stream[a.stream.length - 1].y.toFixed(2)}) in level 43. South is sealed on `
    + 'the publishing tick by `fallrock@176,384`; north is a `magicallock` behind a '
    + 'projectile this model does not have.');

// ── the control ──────────────────────────────────────────────────────
check(c.run.collected.length === 0 && c.run.wandFades.length === 0
    && c.run.rockFalls.length === 0 && c.run.bossesWoken.length === 0
    && c.run.bossClamps.length === 0,
    '⛔ THE CONTROL IS A QUIET ROOM — nothing at all happens',
    `collected ${c.run.collected.length}, fades ${c.run.wandFades.length}, rocks `
    + `${c.run.rockFalls.length}, woken ${c.run.bossesWoken.length}, clamps `
    + `${c.run.bossClamps.length}, frozen frames ${c.run.frozenFramesOwed}`);
let firstDiff = -1;
for (let i = 0; i < a.stream.length; i += 1) {
    if (a.stream[i].x !== c.stream[i].x || a.stream[i].y !== c.stream[i].y
        || a.stream[i].level !== c.stream[i].level) { firstDiff = i; break; }
}
check(firstDiff === DOWN_TO_WAND,
    '⛓⛓ the arms are byte-identical to the CONTACT TICK and part exactly there',
    firstDiff < 0
        ? '⛔ they never part — the pair discriminates nothing'
        : `first divergence at tick ${firstDiff} (the contact is tick `
        + `${DOWN_TO_WAND}): drive y ${a.stream[firstDiff].y.toFixed(2)} against `
        + `control y ${c.stream[firstDiff].y.toFixed(2)}. One arm's world freezes `
        + 'there and the other\'s does not.');
const ctrlNorth = Math.min(...c.stream.slice(NORTH_FROM).map((o) => o.y));
check(ctrlNorth > 212 && ctrlNorth < 216,
    '⛓⛓ and the control is stopped by the WALL at the clamp\'s own number',
    `control northernmost y ${ctrlNorth.toFixed(2)}. The boss box's bottom edge is `
    + '212 and the player\'s origin is 2 px, so a COLLISION parks it at 214.05 where '
    + 'an ASSIGNMENT parks the drive at 212 — one number, two mechanisms, and the '
    + 'pair is what tells them apart.');

console.log('## r5-l43-wand — the terminal wand window\n');
let bad = 0;
for (const k of checks) {
    console.log(`   ${k.ok ? '✓' : '⛔'} ${k.name}`);
    if (k.detail) console.log(`      ${k.detail}`);
    if (!k.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);
console.log(`\n✓ ${checks.length} claims`);

if (WRITE) {
    for (const t of [tape, control]) {
        const path = join(MODULE, 'fixtures', 'tapes', `${t.name}.json`);
        writeFileSync(path, serializeTape(t));
        console.log(`   wrote ${path}`);
    }
} else {
    console.log('\n(dry run — pass --write to emit the tapes, then record with --win)');
}
