#!/usr/bin/env node
/**
 * plan-seedling-u12-pull — ⛓⛓⛓ U12-swim D1: `Pull.update`, WITNESSED ON THE GAME.
 *
 * `Puzzlements/Pull.as` writes every overlapping Player/Enemy/Solid's position
 * directly, every frame: `e.x += force*cos(dir); e.y -= force*sin(dir)`. L12
 * places fourteen of them, force 1, around its ONE pit tile (36,43), every push
 * pointing into the funnel. Until U12 no model stepped them (`combat.js`:
 * "routed around since R1"), so the planner priced each as an avoid volume and
 * step 24's pit was unreachable by construction (U11 § D1).
 *
 * ⛔ THE KEYS ARE A FIXED SCHEDULE and each tape is emitted BEFORE the model is
 * driven, so this script authored and the game recorded both witnesses while
 * the model still had no pull step (witness first), and `--check` re-derives
 * them after.
 *
 * The prediction, from the AS3 alone (`predictRide`, independent of
 * `levelRun`): the pulls update BEFORE the player (`loadlevel` adds them after
 * it and `World.addUpdate` prepends), in REVERSE `.oel` order, each testing the
 * box the one before it left. So the ride is 1 px/tick south, and TWO px on
 * the ticks the player's 4x5 box straddles two cells of the current.
 *
 * Two arms (step 24's grants — the sword latched, the shield, `save.keys[0]`):
 *   `u12-pull-carry` — boot ON `pull@576,640` (the funnel's one northern gap,
 *     tile (36,40)) and stand, no key held. The current carries the player
 *     south down column 36 into the pit: 1 px/tick, 2 px on t 7–8 and
 *     t 21–22, the edge where `getState` first reads the pit, twenty fall-out
 *     ticks (the push still landing while the box touches `pull@576,672`), the
 *     swap to L21 and the fall from the ceiling.
 *   `u12-pull-cross` — boot on `pull@560,720` (tile (35,45), pushing EAST) and
 *     walk UP, across the current: the walk is north, the drift east, +1 px a
 *     tick on top of the player's own step, until the box enters column 36,
 *     whose currents push NORTH, and the pit takes the player.
 *
 * ⛔ NO BODY ARM: L12's one `Enemy` is `puncher@416,256`, which never leaves
 * its own cell and is a sealed room away from the funnel, and no `Solid` of
 * L12 overlaps a pull (checked below) — the model refuses either by name.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-u12-pull.mjs           (write)
 *   node scripts/procgen/plan-seedling-u12-pull.mjs --check   (compare)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

const { parseTape, PIN_NAMES } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { createPulls, pullModelled, pullsDrainingInto, pushBody } = await import(join(MODULE, 'pull.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();
const NO_KEYS = new Set();
/** Step 24's derived grant (the survey's `saveGrant`): the Red Key, the shield; the sword latched. */
const ITEMS = Object.freeze({ hasSword: true, hasShield: true });
const SAVE = Object.freeze({ totem_parts: [], keys: [0], seal_parts: [] });
/** L12's one pit, the goal of survey step 24. */
const PIT = Object.freeze({ tx: 36, ty: 43 });

function stage(boot) {
    return createLevelRun({
        levelSource,
        boot,
        noclip: false,
        noHazards: [],
        noDamage: false,
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { ...SAVE, keys: [...SAVE.keys] },
        rng: null,
        seam: { items: { ...ITEMS } },
        roles: ROLES,
    });
}

function tapeJson(name, boot, perTick, description) {
    const folded = buildTape(perTick, boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        game: 'seedling',
        name,
        boot,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { ...SAVE, keys: [...SAVE.keys] },
        rng: { seed: 1, split: false },
        seam: { items: { ...ITEMS } },
        tick_count: perTick.length,
        inputs: folded.inputs,
        tape_version: 8,
    };
    const parsed = parseTape({ ...tape, description });
    return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
}

function emit(name, json) {
    const path = join(TAPES, `${name}.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${name} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
}

/** Drive the MODEL with the fixed keys; a refusal is returned, not thrown. */
function driveModel(boot, perTick) {
    const run = stage(boot);
    const at = [{ t: 0, x: run.state.x, y: run.state.y, level: run.level }];
    try {
        for (const held of perTick) {
            run.advance(held);
            at.push({ t: run.ticksCompleted, x: run.state.x, y: run.state.y, level: run.level });
        }
    } catch (e) {
        return { run, at, refused: e.message.split('\n')[0] };
    }
    return { run, at, refused: null };
}

const pulls = createPulls(levelSource(12).entities);

// ── the geometry: (b) and (d), and the funnel ───────────────────────────
{
    const world = stage({ level: 12, x: 576, y: 640 }).world;
    check('L12 places 14 pulls, all force 1', pulls.length === 14 && pulls.every((p) => p.force === 1),
        `${pulls.length}`);
    const cellOf = (p) => `${Math.floor(p.x / TILE_SIZE)},${Math.floor(p.y / TILE_SIZE)}`;
    const cells = new Set(pulls.map(cellOf));
    const intoOpen = pulls.map((p) => {
        const ax = Math.round(p.cosTerm);
        const ay = -Math.round(p.sinTerm);
        const k = `${Math.floor(p.x / TILE_SIZE) + ax},${Math.floor(p.y / TILE_SIZE) + ay}`;
        return { id: p.id, k, ok: cells.has(k) || k === `${PIT.tx},${PIT.ty}` };
    });
    check('⛓ (b) every push points INTO another pull cell or the pit — no pull on L12 pushes '
        + 'toward a solid, so the embedded-push arm is unreachable here (and refused by name)',
    intoOpen.every((r) => r.ok), intoOpen.filter((r) => !r.ok).map((r) => `${r.id}->${r.k}`).join(' '));
    const unmodelled = pulls.map((p) => ({ id: p.id, m: pullModelled(p, world) }))
        .filter((r) => !r.m.modelled);
    check('⛓ (d) no solid of L12 overlaps a pull box (strict AABB) — `Pull` moves no Solid here',
        unmodelled.length === 0, unmodelled.map((r) => `${r.id}: ${r.m.why}`).join('; '));
    const rides = pullsDrainingInto(pulls, PIT);
    check('⛓⛓ all 14 currents DRAIN INTO the pit (36,43) — the funnel is a ride',
        rides.length === 14, `${rides.length}`);
}

/**
 * The AS3 prediction for a STANDING player: the pulls, in update order, then a
 * player with no input and no velocity, who does not move. Ends at the first
 * tick the player's probe point `(x, y + 1)` is inside the pit TILE (the edge
 * is `getState`'s, in the model's pit transport).
 */
function predictRide(start) {
    const out = [];
    let p = { ...start };
    for (let t = 1; t <= 200; t += 1) {
        const r = pushBody(pulls, p, playerBoxAt);
        p = { x: r.x, y: r.y };
        out.push({ t, x: p.x, y: p.y, by: r.by.length });
        if (Math.floor((p.y + 1) / TILE_SIZE) === PIT.ty) break;
    }
    return out;
}

// ── u12-pull-carry ───────────────────────────────────────────────────
{
    const NAME = 'u12-pull-carry';
    /** On `pull@576,640`: the Player ctor's +8 puts the player at (584,648), the cell's centre. */
    const BOOT = Object.freeze({ level: 12, x: 576, y: 640 });
    const TICKS = 100;
    const perTick = Array.from({ length: TICKS }, () => NO_KEYS);
    const description = '⛓⛓⛓ U12-swim D1 — A PULL CURRENT CARRIES A STANDING PLAYER INTO L12\'s PIT. '
        + 'L12, booted ON `pull@576,640` — tile (36,40), the funnel\'s one northern gap between '
        + '`tree@544,640` and `dungeonspire@592,640` — with step 24\'s grants (the sword, the shield, '
        + '`save.keys[0]`) and no key held for 100 ticks. `Pull.update` (`Puzzlements/Pull.as`) '
        + 'writes `e.x += force*cos(dir); e.y -= force*sin(dir)` on every overlapping body, every '
        + 'frame, before the player updates (`loadlevel` adds the pulls after the Player and '
        + '`World.addUpdate` prepends), in reverse `.oel` order with each pull testing the box the '
        + 'one before it moved. Column 36\'s three pulls push SOUTH: 1 px a tick, and 2 px on '
        + 't 7–8 and t 21–22, where the 4x5 box straddles two of them. The pit edge, twenty fall-out '
        + 'ticks (the push still landing while the box touches `pull@576,672`), the swap to L21 and '
        + 'the fall from the ceiling follow. Fixed keys. Authored by '
        + 'scripts/procgen/plan-seedling-u12-pull.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, perTick, description));
    const ride = predictRide({ x: BOOT.x + TILE_SIZE / 2, y: BOOT.y + TILE_SIZE / 2 });
    const doubles = ride.filter((r) => r.by === 2).map((r) => r.t);
    console.log(`  predicted ride: ${ride.length} ticks to the pit tile (y ${ride.at(-1).y}); `
        + `double pushes at t ${doubles.join(',')}`);
    const { run, at, refused } = driveModel(BOOT, perTick);
    check('the model walks the tape (no refusal)', refused === null, refused ?? '');
    const agree = ride.filter((r) => at[r.t] && at[r.t].x === r.x && at[r.t].y === r.y);
    check('⛓⛓⛓ the model rides the current exactly as the AS3 reading predicts, tick for tick, '
        + 'to the pit tile', agree.length === ride.length,
    `${agree.length}/${ride.length}; first miss ${JSON.stringify(ride.find((r) => !agree.includes(r)) ?? null)}`
        + ` model ${JSON.stringify(at[(ride.find((r) => !agree.includes(r)) ?? { t: 0 }).t] ?? null)}`);
    const fall = refused ? null : run.transitions.find((t) => t.from_level === 12);
    check('⛓ and falls through it to L21', fall?.to_level === 21, JSON.stringify(fall ?? null));
    console.log(`## ${NAME}: ${perTick.length} ticks; the swap at t ${fall?.t ?? '—'}`
        + `${refused ? ` — REFUSED: ${refused.slice(0, 200)}` : ''}`);
}

// ── u12-pull-cross ───────────────────────────────────────────────────
{
    const NAME = 'u12-pull-cross';
    /** On `pull@560,720` (tile (35,45), pushing EAST): the player at (568,728). */
    const BOOT = Object.freeze({ level: 12, x: 560, y: 720 });
    const TICKS = 100;
    const UP = new Set(['up']);
    const perTick = Array.from({ length: TICKS }, (_, i) => (i < 40 ? UP : NO_KEYS));
    const description = '⛓⛓⛓ U12-swim D1 — WALKING ACROSS A PULL CURRENT: THE DRIFT IS PERPENDICULAR '
        + 'TO THE WALK. L12, booted on `pull@560,720` — tile (35,45), whose push is EAST — with step '
        + '24\'s grants, holding `up` for 40 ticks and then nothing to t 100. The walk is north along '
        + 'column 35, whose four pulls all push east: every tick the box overlaps one, `Pull.update` '
        + 'adds +1 to x BEFORE the player\'s own step, so the path leans east by a pixel a tick on '
        + 'top of the walk. Once the box enters column 36 the currents there push NORTH (rows 44-45) '
        + 'or SOUTH (rows 40-42), every one of them toward (36,43), and the pit takes the player to '
        + 'L21. No push on L12 points into a solid, so no push is undone. Fixed keys. Authored by '
        + 'scripts/procgen/plan-seedling-u12-pull.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, perTick, description));
    const { run, at, refused } = driveModel(BOOT, perTick);
    check('the model walks the tape (no refusal)', refused === null, refused ?? '');
    const east = at.slice(1, 9).map((a, i) => +(a.x - at[i].x).toFixed(6));
    console.log(`  model x step t1-8: ${east.join(' ')}`);
    const fall = refused ? null : run.transitions.find((t) => t.from_level === 12);
    check('⛓ the cross ends in the pit, to L21', fall?.to_level === 21, JSON.stringify(fall ?? null));
    console.log(`## ${NAME}: ${perTick.length} ticks; the swap at t ${fall?.t ?? '—'}`
        + `${refused ? ` — REFUSED: ${refused.slice(0, 200)}` : ''}`);
}

if (failures > 0) {
    console.log(`\n${failures} FAIL`);
    process.exit(1);
}
console.log('\nALL PASS');
