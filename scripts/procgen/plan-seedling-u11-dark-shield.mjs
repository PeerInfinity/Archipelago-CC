#!/usr/bin/env node
/**
 * plan-seedling-u11-dark-shield — ⛓⛓⛓ U11-swim D3: THE DARK SHIELD'S
 * `shieldBump` HIT, WITNESSED ON THE GAME.
 *
 * `Player.shieldBump` (`Player.as:1691-1708`) with the DARK shield:
 *
 *     if (hasDarkShield && o.hitsTimer <= 0) o.hit(shieldForce, Point(x, y), darkShieldDamage, "Shield");
 *     else o.knockback(shieldForce, new Point(x, y));
 *
 * `Enemy.hit` deals 0.5, arms the body's 30-tick i-frame, knocks it back
 * (unless its `knockback` is an empty override) and LATCHES `hitByDarkStuff`,
 * which lets the NEXT damaging hit through that i-frame. The bump itself can
 * never use the latch — its own gate is `o.hitsTimer <= 0` — so the latch's
 * observable is a SWORD hit inside the i-frame the shield opened.
 *
 * ⛔ THE KEYS ARE A FIXED SCHEDULE and the tape is emitted BEFORE the model is
 * driven, so this script authored the witnesses while the model still refused
 * the dark shield by name (witness-first), and `--check` re-derives them after.
 *
 * Two arms:
 *   `u11-dark-shield-bob` — U9's shove boot on L4 (64,32), the shield, the dark
 *     shield and a sword through the seam: `down` for 40 ticks into
 *     `bob@64,64`, one press on t 19, 58 ticks (it ends before t 61, where the
 *     contact's throw starts the player's fall into L4's lethal pit). The bump HITS the bob on t 16
 *     (`hits` 0.5, i-frame 30, thrown south); the press's first test on t 19
 *     lands THROUGH that i-frame (the latch) — `hits` 1.5 — and the bob, which
 *     a refused swing would leave to fall into L4's pit, comes back and
 *     contacts the player on t 57.
 *   `u11-dark-shield-puncher` — U9's puncher boot on L12 (384,256), shield and
 *     dark shield, `right` for 40 ticks then still: the bump HITS
 *     `puncher@416,256` on t 13 (`hits` 0.5) and shoves nothing (the empty
 *     `knockback` override), and inside the puncher's i-frame the player walks
 *     through it untouched — where the plain shield takes the contact on t 15
 *     and the punch on t 35.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-u11-dark-shield.mjs           (write)
 *   node scripts/procgen/plan-seedling-u11-dark-shield.mjs --check   (compare)
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
const NO_KEYS = new Set();

function stage(boot, items) {
    return createLevelRun({
        levelSource,
        boot,
        noclip: false,
        noHazards: [],
        // ⚠ FALSE — under `noDamage` the run steps no chaser.
        noDamage: false,
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null,
        seam: { items: { ...items } },
        roles: ROLES,
    });
}

function tapeJson(name, boot, items, perTick, description) {
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
        seam: { items: { ...items } },
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
function driveModel(boot, items, perTick) {
    const run = stage(boot, items);
    try {
        for (const held of perTick) run.advance(held);
    } catch (e) {
        return { run, refused: e.message.split('\n')[0] };
    }
    return { run, refused: null };
}

// ── u11-dark-shield-bob ──────────────────────────────────────────────
{
    const NAME = 'u11-dark-shield-bob';
    /** L4 (`Dungeon1/2.oel`), U9's shove boot: three tiles north of `bob@64,64`. */
    const BOOT = Object.freeze({ level: 4, x: 64, y: 32 });
    const ITEMS = Object.freeze({ hasShield: true, hasDarkShield: true, hasSword: true });
    const DOWN = new Set(['down']);
    const DOWN_PRESS = new Set(['down', 'primary']);
    /** Held index 18 is observation tick 19: inside the i-frame the t 16 hit opened. */
    const PRESS_AT = 18;
    /**
     * 58, not more: the t 57 contact throws the player east into L4's lethal
     * pit at (88,72). `checkFallingInPit` starts its 20-frame lerp on t 61
     * (`receiveInput = false`, which the differential reads as
     * `saw_input_refused`) and `die()`s on t 80, respawning at (72,40) —
     * measured on the first, 100-tick recording, which the model matched to
     * 1e-2 through t 78 before refusing the lethal pit by name. So the tape
     * ends one tick after the contact, before the fall begins.
     */
    const perTick = Array.from({ length: 58 },
        (_, i) => (i === PRESS_AT ? DOWN_PRESS : (i < 40 ? DOWN : NO_KEYS)));
    const description = '⛓⛓⛓ U11-swim D3 — THE DARK SHIELD HITS A BOB, AND ITS LATCH LETS A SWORD '
        + 'THROUGH THE I-FRAME. L4, U9\'s shove boot (64,32), three tiles north of `bob@64,64`, with '
        + 'the shield, the DARK shield and a sword through the seam and `noDamage` FALSE. The '
        + 'player walks DOWN for 40 ticks and presses once on t 19, then stands to t 58. '
        + '`shieldBump` with `hasDarkShield` calls `Enemy.hit(shieldForce 5, playerPoint, '
        + 'darkShieldDamage 0.5, "Shield")` on a body whose `hitsTimer <= 0`: the bob takes 0.5 on '
        + 't 16, a 30-tick i-frame and a knockback, and `hitByDarkStuff` latches; every later touch '
        + 'inside that i-frame is the plain knockback. The press\'s first test (t 19) lands THROUGH '
        + 'the i-frame because of the latch (hits 1.5), and the bob — which a refused swing would '
        + 'leave to fall into L4\'s pit by t 50 — comes back and contacts the player on t 57. '
        + 'The tape ends at t 58, before t 61, where that contact\'s throw starts the player\'s '
        + 'fall into the same lethal pit. Fixed keys. Authored by scripts/procgen/plan-seedling-u11-dark-shield.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, ITEMS, perTick, description));
    const { run, refused } = driveModel(BOOT, ITEMS, perTick);
    check('the model WALKS the dark shield (no refusal)', refused === null, refused ?? '');
    const rows = refused ? [] : run.ledger('shieldBumps');
    const hit = rows.find((r) => r.hit);
    check('⛓⛓⛓ the bump HITS `bob@64,64` on t 16: 0.5 dealt, a 30-tick i-frame, and a shove',
        hit?.t === 16 && hit.landed === true && hit.hits === 0.5 && hit.hitsTimer === 30
        && hit.shoved === true, JSON.stringify(hit ?? null));
    check('⛓ every later touch of that i-frame is the plain knockback (one HIT row only)',
        rows.filter((r) => r.hit).length === 1, JSON.stringify(rows.map((r) => [r.t, r.hit ? 'hit' : 'shove'])));
    const press = refused ? [] : run.chaserPressHits.filter((h) => h.landed);
    check('⛓⛓⛓ the press LANDS on t 19 through the i-frame (the `hitByDarkStuff` latch): hits 1.5',
        press.length === 1 && press[0].t === 19 && press[0].hits === 1.5,
        JSON.stringify((refused ? [] : run.chaserPressHits).map((h) => `${h.t}:${h.landed ? 'L' : 'm'}`)));
    check('⛓ and the bob comes back: its contact lands on t 57',
        !refused && run.playerHits.length === 1 && run.playerHits[0].t === 57,
        JSON.stringify((refused ? [] : run.playerHits).map((h) => `${h.source}@${h.t}`)));
    console.log(`## ${NAME}: ${perTick.length} ticks${refused ? ` — REFUSED: ${refused.slice(0, 160)}` : ''}`);
}

// ── u11-dark-shield-puncher ──────────────────────────────────────────
{
    const NAME = 'u11-dark-shield-puncher';
    /** L12, U9's puncher boot: two tiles west of `puncher@416,256`. */
    const BOOT = Object.freeze({ level: 12, x: 384, y: 256 });
    const ITEMS = Object.freeze({ hasShield: true, hasDarkShield: true });
    const EAST = new Set(['right']);
    const perTick = Array.from({ length: 60 }, (_, i) => (i < 40 ? EAST : NO_KEYS));
    const description = '⛓⛓⛓ U11-swim D3 — THE DARK SHIELD HITS A PUNCHER: DAMAGE WITH NO SHOVE. '
        + 'L12, U9\'s puncher boot (384,256), the shield and the DARK shield through the seam and '
        + '`noDamage` FALSE; `right` for 40 ticks, then still for 20. `shieldBump` calls '
        + '`Enemy.hit(5, playerPoint, 0.5, "Shield")` on `puncher@416,256` on t 13: it takes 0.5 '
        + 'and a 30-tick i-frame, and `Puncher.knockback` is an EMPTY override, so nothing moves. '
        + 'Inside that i-frame the player walks through the puncher untouched — where the plain '
        + 'shield (`u9-shield-puncher`) takes the contact on t 15 and the punch on t 35. Fixed keys. '
        + 'Authored by scripts/procgen/plan-seedling-u11-dark-shield.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, ITEMS, perTick, description));
    const { run, refused } = driveModel(BOOT, ITEMS, perTick);
    check('the model WALKS the dark shield (no refusal)', refused === null, refused ?? '');
    const rows = refused ? [] : run.ledger('shieldBumps');
    const hit = rows.find((r) => r.hit);
    check('⛓⛓⛓ the bump HITS `puncher@416,256` on t 13: 0.5 dealt, a 30-tick i-frame, NO shove',
        hit?.t === 13 && hit.landed === true && hit.hits === 0.5 && hit.hitsTimer === 30
        && hit.shoved === false, JSON.stringify(hit ?? null));
    check('⛓ and the player takes no hit in the whole tape',
        !refused && run.playerHits.length === 0,
        JSON.stringify((refused ? [] : run.playerHits).map((h) => `${h.source}@${h.t}`)));
    console.log(`## ${NAME}: ${perTick.length} ticks${refused ? ` — REFUSED: ${refused.slice(0, 160)}` : ''}`);
}

if (failures > 0) {
    console.log(`\n${failures} FAIL`);
    process.exit(1);
}
console.log('\nALL PASS');
