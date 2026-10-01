#!/usr/bin/env node
/**
 * plan-seedling-u11-facing — ⛓⛓⛓ U11-swim D2: THE PLAYER'S FACING DURING A
 * KNOCKBACK'S I-FRAME, WITNESSED ON THE GAME.
 *
 * `Player.hit` arms `hitsTimer` and then calls `knockback`, whose
 * `if (hitsTimer > 0) directionFace = direction` therefore ALWAYS parks the
 * facing the hit found; `sprites()` (after the move) then writes
 * `direction = directionFace` every tick of the i-frame, and `hitUpdate`'s
 * recovery hands it back. So a press inside the i-frame swings the way the
 * player faced when hit — not the way the knockback is carrying them. The
 * model's `stepV2` derived `direction` from the post-move velocity, i.e. the
 * knockback's own heading (U10 § D2's control found it: west in the model,
 * east in the game).
 *
 * ⛔ THE KEYS ARE A FIXED SCHEDULE, not a preview's output, so the tape is the
 * same bytes whichever facing the model holds — the witness was authored and
 * recorded BEFORE the fix, and `--check` re-derives it after.
 *
 * Two arms:
 *   `u11-facing-knockback` — L4, U9's shove boot (64,32) with a SWORD (no
 *     shield): `down` for 20 ticks into `bob@64,64`, the contact at t 20
 *     knocks the player north, the press is on the NEXT tick (t 21), then the
 *     player stands. The game swings DOWN (the parked facing) and lands on the
 *     bob, which is thrown south; a swing UP misses and the bob's second
 *     contact lands at t 44. VISIBLE TO THE PLAYER STREAM from t 44.
 *   `u11-facing-puncher` — L12, U10's control boot (400,248): the kill arm's
 *     preview keys (a one-tick lean east, then a press, at t 1-2 and t 34-35),
 *     50 ticks — U10's FIRST
 *     recording, extended past the punch. The punch at t 34 is absorbed by
 *     the wall west of the player, so the player stream cannot see the facing;
 *     the puncher's `hits` (2 in the game from t 35) is the observable, read by
 *     `probe-seedling-u9-shield-mobiles.mjs --class=Puncher`.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-u11-facing.mjs           (write)
 *   node scripts/procgen/plan-seedling-u11-facing.mjs --check   (compare)
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
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();
const ITEMS = Object.freeze({ hasSword: true });
const NO_KEYS = new Set();
const PRESS = new Set(['primary']);

function stage(boot) {
    return createLevelRun({
        levelSource,
        boot,
        noclip: false,
        noHazards: [],
        // ⚠ FALSE — under `noDamage` the run steps no chaser and takes no hit.
        noDamage: false,
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
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
        save: { totem_parts: [], keys: [], seal_parts: [] },
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

/** Drive `run` with `heldAt(i)` for `n` ticks; returns the per-tick held sets. */
function drive(run, n, heldAt) {
    const perTick = [];
    for (let i = 0; i < n; i += 1) {
        const held = heldAt(i);
        perTick.push(held);
        run.advance(held);
    }
    return perTick;
}

// ── u11-facing-knockback ─────────────────────────────────────────────
{
    const NAME = 'u11-facing-knockback';
    /** L4 (`Dungeon1/2.oel`), U9's shove boot: three tiles north of `bob@64,64`. */
    const BOOT = Object.freeze({ level: 4, x: 64, y: 32 });
    const DOWN = new Set(['down']);
    /** Held index 20 is observation tick 21: the tick AFTER the contact. */
    const PRESS_AT = 20;
    const run = stage(BOOT);
    const perTick = drive(run, 80,
        (i) => (i < PRESS_AT ? DOWN : (i === PRESS_AT ? PRESS : NO_KEYS)));
    const hits = run.playerHits.map((h) => `${h.source}@${h.t}`);
    check('⛓ the bob\'s contact lands at t 20 and knocks the player NORTH, parking the facing DOWN',
        run.playerHits[0]?.t === 20 && run.playerHits[0]?.source === 'chaser', JSON.stringify(hits));
    const press = run.slashPresses[0];
    check('⛓⛓⛓ the press inside the i-frame swings DOWN (direction 3, the parked `directionFace`), '
        + 'not UP (the knockback\'s heading)',
        run.slashPresses.length === 1 && press.direction === 3,
        JSON.stringify(run.slashPresses.map((p) => [p.t, p.direction, p.outcome])));
    const landed = run.chaserPressHits.filter((h) => h.landed);
    check('⛓ it lands on `bob@64,64` (one hit, t 22 — the press\'s first hit test)',
        landed.length === 1 && landed[0].id === 'bob@64,64' && landed[0].t === 21,
        JSON.stringify(run.chaserPressHits.map((h) => `${h.t}:${h.landed ? 'L' : 'm'}`)));
    check('⛔ and the bob does NOT reach the player again inside the tape (an UP swing misses '
        + 'and the second contact lands at t 44)',
        run.playerHits.length === 1, JSON.stringify(hits));
    const description = '⛓⛓⛓ U11-swim D2 — THE FACING DURING A KNOCKBACK\'S I-FRAME. L4, U9\'s '
        + 'shove boot (64,32), three tiles north of `bob@64,64`, with a SWORD (no shield) and '
        + '`noDamage` FALSE. The player walks DOWN for 20 ticks; the bob\'s contact at t 20 '
        + 'knocks it NORTH, and `Player.hit` -> `knockback` parks `directionFace = direction` '
        + '(DOWN). The press is on the next tick (t 21): `sprites()` has pinned `direction` to '
        + 'the parked facing, so the swing goes DOWN and lands on the bob (hits 1), throwing it '
        + 'south. A model that derives the facing from the knockback\'s velocity swings UP, '
        + 'misses, and takes the bob\'s second contact at t 44 — the first tick the player '
        + 'stream can tell the two apart. Fixed keys (down x20, primary at t 21, still x59). '
        + 'Authored by scripts/procgen/plan-seedling-u11-facing.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, perTick, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, hits ${JSON.stringify(hits)}, press `
        + `${JSON.stringify(run.slashPresses.map((p) => [p.t, p.direction]))}, landed `
        + `${JSON.stringify(landed.map((h) => h.t))}`);
}

// ── u11-facing-puncher ───────────────────────────────────────────────
{
    const NAME = 'u11-facing-puncher';
    /** L12, U10's control boot: inside `puncher@416,256`'s leash, the wall to the west. */
    const BOOT = Object.freeze({ level: 12, x: 400, y: 248 });
    /**
     * The kill arm's own preview keys at this boot (`previewWalk` with the
     * strike policy, `standFor` 50), written out: a one-tick lean EAST before
     * each press (held indices 0 and 33), the presses at 1 and 34.
     */
    const EAST = new Set(['right']);
    const KEYS = new Map([[0, EAST], [1, PRESS], [33, EAST], [34, PRESS]]);
    const run = stage(BOOT);
    const perTick = drive(run, 50, (i) => KEYS.get(i) ?? NO_KEYS);
    const hits = run.playerHits.map((h) => `${h.source}@${h.t}`);
    check('⛓ the punch lands at t 34', run.playerHits[0]?.t === 34
        && run.playerHits[0]?.source === 'punch', JSON.stringify(hits));
    check('⛓⛓⛓ the press inside the punch\'s i-frame swings EAST (direction 0, the parked '
        + 'facing), not WEST (the knockback\'s heading)',
        run.slashPresses.length === 2 && run.slashPresses[1].direction === 0,
        JSON.stringify(run.slashPresses.map((p) => [p.t, p.direction])));
    const landed = run.chaserPressHits.filter((h) => h.landed);
    const pun = run.chasers.find((c) => c.id === 'puncher@416,256');
    check('⛓ both presses land: the puncher reads `hits` 2 at the end',
        landed.length === 2 && pun?.hits === 2,
        `${JSON.stringify(landed.map((h) => h.t))}, hits ${pun?.hits}`);
    const description = '⛓⛓⛓ U11-swim D2 — THE FACING DURING A KNOCKBACK\'S I-FRAME, U10\'s '
        + 'control extended past the punch. L12 at (400,248), inside `puncher@416,256`\'s leash, '
        + 'with a sword and `noDamage` FALSE; the kill arm\'s preview keys at this boot (a '
        + 'one-tick lean east, then a press, at t 1-2 and t 34-35), 50 ticks. The punch at '
        + 't 34 parks the facing EAST; the press on '
        + 't 35 swings EAST and lands (the puncher reads `hits` 2 from t 36). The punch\'s '
        + 'knockback is absorbed by the wall west of the player, so the PLAYER stream is the '
        + 'same under either facing: the observable is the puncher\'s `hits`, read by '
        + '`probe-seedling-u9-shield-mobiles.mjs --class=Puncher`. Authored by '
        + 'scripts/procgen/plan-seedling-u11-facing.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, perTick, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, hits ${JSON.stringify(hits)}, press `
        + `${JSON.stringify(run.slashPresses.map((p) => [p.t, p.direction]))}, puncher hits ${pun?.hits}`);
}

if (failures > 0) {
    console.log(`\n${failures} FAIL`);
    process.exit(1);
}
console.log('\nALL PASS');
