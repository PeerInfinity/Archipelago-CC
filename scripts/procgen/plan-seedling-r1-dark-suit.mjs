#!/usr/bin/env node
/**
 * plan-seedling-r1-dark-suit — ⛓⛓⛓ R1-swim D1/D2: THE DARK SUIT'S RETALIATION
 * AND THE DARK STUFF'S KILL, WITNESSED ON THE GAME.
 *
 * `Player.hit(e, f, p, d)` (`Player.as:1374-1400`), inside the three-term gate
 * and ABOVE `hits += d`:
 *
 *     if (e && hasDarkSuit) e.hit(darkSuitForce 1, new Point(x, y), darkSuitDamage 1, "Suit");
 *
 * A body contact (`Enemy.hitPlayer`, `p.hit(this, 3, …)`) passes `e`, so the
 * attacker takes `Enemy.hit(1, playerPoint, 1, "Suit")` — 1 dealt, a 30-tick
 * i-frame, a knockback of 1 away from the player, and the `hitByDarkStuff`
 * latch — and THEN the player takes its own hit. The bob's next contact is
 * gated on the bob's OWN `hitsTimer <= 0` (`Enemy.hitPlayer`), so the
 * retaliation's i-frame, not the player's 20-tick one, decides when it lands.
 *
 * ⛔ THE KEYS ARE A FIXED SCHEDULE and the tape is emitted BEFORE the model is
 * driven, so this script authored the witness while the model still refused
 * the dark suit by name (witness-first), and `--check` re-derives it after.
 *
 *   `r1-dark-suit-kill` (D2) — the same boot, `down` held for 135 ticks, the
 *     seam's `hits_max` 4: the third retaliation (t 87) KILLS the bob,
 *     `startDeath("Suit")`, and the corpse leaves the world 36 ticks later.
 *
 *   `r1-dark-shield-kill` (D2) — L22 (64,144), the shield and the dark shield,
 *     `down` held: six dark-shield hits on `bob@96,144`, 0.5 each, the sixth
 *     (t 476) KILLS it, `startDeath("Shield")`.
 *
 *   `r1-dark-suit-bob` — L4 (64,32), U9's shove boot three tiles north of
 *     `bob@64,64`, the DARK SUIT only through the seam and `noDamage` FALSE:
 *     `down` for 20 ticks, then still to t 75. The bob's contact on t 20 is
 *     retaliated (bob `hits` 1, i-frame 30, shoved south by 1); without the
 *     suit the model's bob contacts again on t 44 (the player's i-frame ended),
 *     with it the bob's own i-frame holds it off until t 50, the second
 *     retaliation (`hits` 2). The tape ends before the third contact (t 80 at
 *     the earliest), which would kill both a 3-heart player and the bob.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r1-dark-suit.mjs           (write)
 *   node scripts/procgen/plan-seedling-r1-dark-suit.mjs --check   (compare)
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

function stage(boot, seam) {
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
        seam: structuredClone(seam),
        roles: ROLES,
    });
}

function tapeJson(name, boot, seam, perTick, description) {
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
        seam: structuredClone(seam),
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
function driveModel(boot, seam, perTick) {
    const run = stage(boot, seam);
    let t = 0;
    try {
        for (const held of perTick) {
            run.advance(held);
            t += 1;
        }
    } catch (e) {
        return { run, refused: `t ${t + 1}: ${e.message.split('\n')[0]}` };
    }
    return { run, refused: null };
}

const hitsOf = (run, refused) => (refused ? [] : run.playerHits);
const fmt = (rows) => JSON.stringify(rows.map((h) => `${h.source}@${h.t}`
    + (h.retaliation ? `:R${h.retaliation.hits}/${h.retaliation.hitsTimer}` : '')));

// ── r1-dark-suit-bob ─────────────────────────────────────────────────
{
    const NAME = 'r1-dark-suit-bob';
    /** L4 (`Dungeon1/2.oel`), U9's shove boot: three tiles north of `bob@64,64`. */
    const BOOT = Object.freeze({ level: 4, x: 64, y: 32 });
    const SEAM = Object.freeze({ items: { hasDarkSuit: true } });
    const DOWN = new Set(['down']);
    const perTick = Array.from({ length: 75 }, (_, i) => (i < 20 ? DOWN : NO_KEYS));
    const description = '⛓⛓⛓ R1-swim D1 — THE DARK SUIT RETALIATES INTO A BOB. L4, U9\'s shove boot '
        + '(64,32), three tiles north of `bob@64,64`, with the DARK SUIT alone through the seam and '
        + '`noDamage` FALSE; `down` for 20 ticks, then still to t 75. `Player.hit(e, …)` with '
        + '`hasDarkSuit` calls `e.hit(darkSuitForce 1, playerPoint, darkSuitDamage 1, "Suit")` '
        + 'inside its own gate and above `hits += d`: the bob\'s contact on t 20 costs the bob 1 '
        + '(`hits` 1, a 30-tick i-frame, a shove of 1 south, `hitByDarkStuff` latched) and then '
        + 'the player its own hit. `Enemy.hitPlayer` is gated on the BOB\'s `hitsTimer`, so the '
        + 'second contact lands on t 50 (bob `hits` 2), where without the suit it lands on t 44 '
        + 'when the player\'s 20-tick i-frame ends. The tape ends before the third contact. '
        + 'Fixed keys. Authored by scripts/procgen/plan-seedling-r1-dark-suit.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, SEAM, perTick, description));
    const { run, refused } = driveModel(BOOT, SEAM, perTick);
    check('the model WALKS the dark suit (no refusal)', refused === null, refused ?? '');
    const hits = hitsOf(run, refused);
    check('⛓⛓⛓ the bob\'s contact on t 20 is RETALIATED: bob hits 1, a 30-tick i-frame, a shove',
        hits[0]?.t === 20 && hits[0].source === 'chaser' && hits[0].retaliation?.landed === true
        && hits[0].retaliation.hits === 1 && hits[0].retaliation.hitsTimer === 30
        && hits[0].retaliation.shoved === true, fmt(hits));
    check('⛓⛓⛓ the bob\'s own i-frame holds its second contact to t 50 (bob hits 2), not t 44',
        hits.length === 2 && hits[1].t === 50 && hits[1].retaliation?.hits === 2, fmt(hits));
    check('⛓ the player is hurt twice and lives (hits 2 of 3)',
        hits.length === 2 && hits[1].hits === 2 && !hits[1].died, fmt(hits));
    // The "before": the same keys without the suit — the model's own contact ticks.
    const plain = driveModel(BOOT, { items: {} }, perTick);
    check('⛓ without the suit the second contact is t 44 (the player\'s i-frame, not the bob\'s)',
        plain.refused === null && plain.run.playerHits.map((h) => h.t).join() === '20,44',
        fmt(hitsOf(plain.run, plain.refused)));
    console.log(`## ${NAME}: ${perTick.length} ticks${refused ? ` — REFUSED: ${refused.slice(0, 200)}` : ''}`);
}

// ── r1-dark-suit-kill (D2) ───────────────────────────────────────────
{
    const NAME = 'r1-dark-suit-kill';
    const BOOT = Object.freeze({ level: 4, x: 64, y: 32 });
    /** `hits_max` 4 — the third contact would otherwise kill the PLAYER too. */
    const SEAM = Object.freeze({ items: { hasDarkSuit: true }, hits_max: 4 });
    const DOWN = new Set(['down']);
    /**
     * `down` for the WHOLE tape. With `r1-dark-suit-bob`'s keys (still from t 21)
     * the third contact, on t 122, throws the player north into L4's
     * `stairsdown` at (64,16) — the game swapped to L5 on t 125, so the kill's
     * death staging happened in a world the stream had left. Held `down`, the
     * player keeps walking back into the bob and stays in the room.
     */
    const perTick = Array.from({ length: 135 }, () => DOWN);
    const description = '⛓⛓⛓ R1-swim D2 — THE DARK SUIT KILLS A BOB. L4 (64,32), three tiles north '
        + 'of `bob@64,64`, the DARK SUIT through the seam with `hits_max` 4 (so the player outlives '
        + 'three contacts) and `noDamage` FALSE; `down` held for 135 ticks. Each contact is '
        + 'retaliated with `Enemy.hit(1, playerPoint, 1, "Suit")`: t 20 (`hits` 1), t 50 (2) and '
        + 't 87 (3 = `hitsMax`), where `startDeath("Suit")` — `Bob.startDeath`, `play("die")` — '
        + 'starts the death staging: the "die" anim\'s `endAnim` sets `destroy`, `Mobile.death` '
        + 'fades it, and it leaves the world 36 ticks after the kill. The player still takes the '
        + 'third hit (3 of 4) and no fourth contact comes. Fixed keys. Authored by '
        + 'scripts/procgen/plan-seedling-r1-dark-suit.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, SEAM, perTick, description));
    const { run, refused } = driveModel(BOOT, SEAM, perTick);
    check('the model WALKS the suit kill (no refusal)', refused === null, refused ?? '');
    const hits = hitsOf(run, refused);
    check('⛓⛓⛓ three retaliated contacts, t 20 / 50 / 87, the bob\'s hits 1 / 2 / 3; the player 3 of 4',
        hits.map((h) => `${h.t}:${h.retaliation?.hits}:${h.hits}`).join() === '20:1:1,50:2:2,87:3:3',
        fmt(hits));
    check('⛓⛓⛓ the third KILLS: `startDeath("Suit")` and the kill ledger, `by: \'suit\'` on t 87',
        !refused && hits[2]?.retaliation?.killed === true
        && JSON.stringify(run.chaserKills) === JSON.stringify([{ t: 87, level: 4, id: 'bob@64,64', by: 'suit', hits: 3 }]),
        JSON.stringify(refused ? null : run.chaserKills));
    check('⛓ the corpse leaves the world by the tape\'s end (36 ticks after the kill)',
        !refused && run.chasers.length === 0, JSON.stringify(refused ? null : run.chasers));
    console.log(`## ${NAME}: ${perTick.length} ticks${refused ? ` — REFUSED: ${refused.slice(0, 200)}` : ''}`);
}

// ── r1-dark-shield-kill (D2) ─────────────────────────────────────────
{
    const NAME = 'r1-dark-shield-kill';
    /** L22, west of `bob@96,144`; L4's bob falls into its pit before a sixth bump. */
    const BOOT = Object.freeze({ level: 22, x: 64, y: 144 });
    const SEAM = Object.freeze({ items: { hasShield: true, hasDarkShield: true } });
    const DOWN = new Set(['down']);
    const perTick = Array.from({ length: 520 }, () => DOWN);
    const description = '⛓⛓⛓ R1-swim D2 — THE DARK SHIELD KILLS A BOB. L22 (64,144), west of '
        + '`bob@96,144`, the shield and the DARK shield through the seam and `noDamage` FALSE; '
        + '`down` held for 520 ticks against the south trees. `shieldBump` with `hasDarkShield` '
        + 'calls `Enemy.hit(5, playerPoint, darkShieldDamage 0.5, "Shield")` on a body whose own '
        + '`hitsTimer <= 0`: the bob takes 0.5 on t 120, 191, 260, 332 and 404, and the sixth '
        + '(t 476) reaches `hitsMax` 3 and calls `startDeath("Shield")` — `Bob.startDeath`, '
        + '`play("die")` — whose "die" anim\'s `endAnim` sets `destroy`; `Mobile.death` fades it '
        + 'and it leaves the world 36 ticks after the kill. The player is never hit. Fixed keys. '
        + 'Authored by scripts/procgen/plan-seedling-r1-dark-suit.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, SEAM, perTick, description));
    const { run, refused } = driveModel(BOOT, SEAM, perTick);
    check('the model WALKS the shield kill (no refusal)', refused === null, refused ?? '');
    const rows = refused ? [] : run.ledger('shieldBumps').filter((r) => r.hit);
    check('⛓⛓⛓ six dark-shield hits, t 120 / 191 / 260 / 332 / 404 / 476, 0.5 each; the sixth KILLS',
        rows.map((r) => `${r.t}:${r.hits}`).join() === '120:0.5,191:1,260:1.5,332:2,404:2.5,476:3'
        && rows[5]?.killed === true,
        JSON.stringify(rows.map((r) => `${r.t}:${r.hits}${r.killed ? 'K' : ''}`)));
    check('⛓⛓⛓ the kill ledger: `startDeath("Shield")`, `by: \'shield\'` on t 476',
        !refused && JSON.stringify(run.chaserKills)
            === JSON.stringify([{ t: 476, level: 22, id: 'bob@96,144', by: 'shield', hits: 3 }]),
        JSON.stringify(refused ? null : run.chaserKills));
    check('⛓ the player is never hit, and the corpse is gone by the tape\'s end',
        !refused && run.playerHits.length === 0 && run.chasers.length === 0,
        JSON.stringify(refused ? null : [run.playerHits.length, run.chasers]));
    console.log(`## ${NAME}: ${perTick.length} ticks${refused ? ` — REFUSED: ${refused.slice(0, 200)}` : ''}`);
}

if (failures > 0) {
    console.log(`\n${failures} FAIL`);
    process.exit(1);
}
console.log('\nALL PASS');
