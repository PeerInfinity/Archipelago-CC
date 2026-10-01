#!/usr/bin/env node
/**
 * plan-seedling-u7-puncher — ⛓⛓⛓ U7-swim: THE PUNCHER'S DRIVEN WITNESSES.
 *
 * The puncher is a stepped chaser since U7-swim D1 (`chasers.CHASERS.puncher`,
 * `spinner.MODELLED_ENEMY_CLASSES.Puncher`). Its parity could not be gated on
 * the fourteen committed tapes that enter a puncher room: every one declares
 * `noDamage`, under which the run steps no chaser at all, and the D1 mutants
 * (`runRange` halved, speed doubled) left all 365 rows identical — so those
 * tapes witness nothing about the chase. These tapes retire `noDamage` on
 * purpose and are recorded on the GAME (`check-seedling-bot-differential
 * --record --only=<name>`); the model must agree per tick.
 *
 *   u7-puncher-punch   L12, two tiles west of `puncher@416,256`, standing
 *                      still: the chase closes, the attack is decided at
 *                      `attackRange` 10, the 11-update wind-up runs, and the
 *                      `r = 8` box throws the player west by `punchForce` 5.
 *                      The tape ends after the SECOND punch and before the
 *                      third (which would kill: `hitsMax` 3).
 *   u7-puncher-kill    the same boot with a sword: the player faces east and
 *                      presses whenever the body is in `slash()`'s reach and
 *                      the 31-tick cadence allows — three landed hits, NO
 *                      knockback on any of them (`Puncher.knockback` is an
 *                      empty override), the 31-tick "die" animation, the fade
 *                      and the removal. A struck puncher's pending punch is
 *                      refused by its own `hitsTimer`.
 *
 * The stances are CHOSEN, not derived — a witness is not a solve.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-u7-puncher.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-u7-puncher.mjs --check    # exit 1 on drift
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
const {
    animTicks, CHASERS, PUNCHER_PUNCH_FORCE, chaserBoxAt, deathTicks,
} = await import(join(MODULE, 'chasers.js'));
const { distanceRectPoint, SLASH_REACH } = await import(join(MODULE, 'presses.js'));
const { removalTicksAfterHit } = await import(join(MODULE, 'enemyDamage.js'));
const { ENEMY_CLASSES } = await import(join(MODULE, 'combat.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();
/** L12's one puncher — `region1.oel` `<puncher x="416" y="256"/>`. */
const TARGET = 'puncher@416,256';
/** Two tiles west of it on the row-16 corridor: d = 32 at boot, inside the leash. */
const BOOT = Object.freeze({ level: 12, x: 384, y: 256 });
const WIND_UP = animTicks(CHASERS.puncher.attack.anim.frames, CHASERS.puncher.attack.anim.rate);

function stage(items = {}) {
    return createLevelRun({
        levelSource,
        boot: BOOT,
        noclip: false,
        noHazards: [],
        // ⚠ FALSE — under `noDamage` the run steps no chaser (the header).
        noDamage: false,
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null,
        seam: { items },
        roles: ROLES,
    });
}

function tapeJson(name, perTick, items, description) {
    const folded = buildTape(perTick, BOOT, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        game: 'seedling',
        name,
        boot: BOOT,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false },
        seam: { items },
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

// ── u7-puncher-punch ─────────────────────────────────────────────────
{
    const NAME = 'u7-puncher-punch';
    const TICKS = 120;
    const run = stage({});
    const NO_KEYS = new Set();
    const perTick = [];
    for (let i = 0; i < TICKS; i += 1) {
        perTick.push(NO_KEYS);
        run.advance(NO_KEYS);
    }
    const punches = run.playerHits.filter((h) => h.source === 'punch');
    check('⛓⛓⛓ TWO punches land, hits 1 -> 2, and the player is ALIVE at the end',
        punches.length === 2 && JSON.stringify(punches.map((h) => h.hits)) === '[1,2]'
            && run.playerDeaths.length === 0,
        JSON.stringify(punches.map((h) => ({ t: h.t, hits: h.hits, kb: h.knockback }))));
    check('⛔ the first punch throws the player WEST by punchForce, x only (a 0-degree hit)',
        punches[0]?.knockback && Math.abs(Math.hypot(punches[0].knockback.dx, punches[0].knockback.dy)
            - PUNCHER_PUNCH_FORCE) < 1e-3 && punches[0].knockback.dx < 0 && punches[0].knockback.dy === 0,
        JSON.stringify(punches[0]?.knockback ?? null));
    check('⛓ no body CONTACT is billed — the puncher stops against the player (`solids` has "Player")',
        run.playerHits.every((h) => h.source === 'punch'),
        JSON.stringify([...new Set(run.playerHits.map((h) => h.source))]));
    const description = '⛓⛓⛓ U7-swim D2 — THE PUNCH, DRIVEN. L12, two tiles west of '
        + '`puncher@416,256` (d = 32, inside `runRange` 80), standing still with NO item and '
        + '`noDamage` FALSE (under the flag the run steps no chaser, and every committed tape '
        + 'that enters a puncher room carries it — the reason this tape exists). The model '
        + 'predicts: the chase closes at ~0.69 px/tick and stops against the player\'s box '
        + '(`solids.push("Enemy", "Player")`); the attack is decided at `attackRange` 10 and '
        + `the chase yields to it; the ${WIND_UP}-update wind-up ends in \`attackPlayer\`, whose `
        + '`r = 8` box off the west edge throws the player by `punchForce` 5 — punch 1 at '
        + `t ${punches[0]?.t}, punch 2 at t ${punches[1]?.t} against the corridor's west wall `
        + '(`hits` 2). The third would kill (`hitsMax` 3), so the tape stops short of it. '
        + 'Authored by scripts/procgen/plan-seedling-u7-puncher.mjs.';
    emit(NAME, tapeJson(NAME, perTick, {}, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, punches at t ${punches.map((h) => h.t).join(', ')}`);
}

// ── u7-puncher-kill ──────────────────────────────────────────────────
{
    const NAME = 'u7-puncher-kill';
    const ITEMS = { hasSword: true };
    const CADENCE = 31;
    const HITS_TO_KILL = ENEMY_CLASSES.puncher.kill.hits;
    const run = stage(ITEMS);
    const NO_KEYS = new Set();
    const EAST = new Set(['right']);
    const PRESS = new Set(['primary']);
    const perTick = [];
    const bodyOf = () => {
        const c = run.chasers.find((x) => x.id === TARGET);
        return c ? chaserBoxAt(c.tag, c.x, c.y) : null;
    };
    const landedRows = () => run.chaserPressHits.filter((h) => h.landed);
    let presses = 0;
    let last = -99;
    for (let i = 0; i < 400; i += 1) {
        if (landedRows().length >= HITS_TO_KILL) break;
        const b = bodyOf();
        const reach = b ? distanceRectPoint(run.state.x, run.state.y, b) : Infinity;
        // ⚠ ONE tick of `right` first: `slash()` swings the way the player FACES,
        // and the boot faces down.
        const held = i === 0 ? EAST
            : (reach <= SLASH_REACH && i - last >= CADENCE && presses < HITS_TO_KILL ? PRESS : NO_KEYS);
        if (held === PRESS) { presses += 1; last = i; }
        perTick.push(held);
        run.advance(held);
        if (run.playerDeaths.length > 0) break;
    }
    const OWED = removalTicksAfterHit('Puncher', deathTicks('puncher'));
    for (let i = 0; i < OWED + 8; i += 1) {
        perTick.push(NO_KEYS);
        run.advance(NO_KEYS);
    }
    const landed = landedRows();
    const kills = run.chaserKills;
    check('⛓⛓⛓ THREE presses LAND on the live puncher, 1 -> 2 -> 3 of `hitsMax` 3',
        landed.length === HITS_TO_KILL && JSON.stringify(landed.map((h) => h.hits)) === '[1,2,3]',
        JSON.stringify(landed.map((h) => ({ t: h.t, hits: h.hits, killed: h.killed }))));
    check('⛔ NO hit shoves it — `Puncher.knockback` is an empty override',
        landed.every((h) => h.knockback === null),
        JSON.stringify(landed.map((h) => h.knockback)));
    check('⛓ ONE death, billed to the PRESS, one tick after the blow',
        kills.length === 1 && kills[0].by === 'press' && kills[0].t === landed[2]?.t + 1,
        JSON.stringify(kills));
    check('⛓⛓ the corpse is GONE by the end — the 31-tick animation, the fade, the removal',
        !run.chasers.some((c) => c.id === TARGET), `removalTicksAfterHit = ${OWED}`);
    const punches = run.playerHits.filter((h) => h.source === 'punch');
    check('the player is alive at the end', run.playerDeaths.length === 0,
        `${punches.length} punch(es) landed: ${JSON.stringify(punches.map((h) => h.t))}`);
    const description = '⛓⛓⛓ U7-swim D3 — THE DEATH, DRIVEN. `KILL_ARM_POLICY.Puncher` flipped '
        + '`refused` -> `modelled` this slice; this is the witness. The `u7-puncher-punch` '
        + 'boot (L12, two tiles west of `puncher@416,256`) with a sword: one tick of `right` '
        + 'to face east, then a press whenever the body is in `slash()`\'s reach and the '
        + `31-tick cadence allows. Three LANDED hits (t ${landed.map((h) => h.t).join(', ')}) `
        + 'and NO knockback on any of them — `Puncher.knockback` is an empty override, so '
        + 'the body stays at the player\'s side through the whole exchange. The killing blow '
        + `starts the ${deathTicks('puncher')}-update "die" animation (ten frames at rate 10), `
        + `then the fade: ${OWED} ticks from the blow to the removal. `
        + `${punches.length} punch(es) land on the player`
        + `${punches.length ? ` (t ${punches.map((h) => h.t).join(', ')})` : ''}; a wind-up `
        + 'that ends while the puncher\'s own `hitsTimer` runs throws nothing. L12 holds no '
        + '`tset -1` lock, and that nil is scanned. Authored by '
        + 'scripts/procgen/plan-seedling-u7-puncher.mjs.';
    emit(NAME, tapeJson(NAME, perTick, ITEMS, description));
    console.log(`## ${NAME}: ${perTick.length} ticks, ${landed.length} landed, kill at t `
        + `${kills[0]?.t}, punches ${JSON.stringify(punches.map((h) => h.t))}`);
}

if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
