#!/usr/bin/env node
/**
 * plan-seedling-r2-wallflyer — ⛓⛓⛓ R2-swim D1: THE WALLFLYER, WITNESSED ON THE
 * GAME BEFORE THE RUN STEPPED IT.
 *
 * J0(a)'s census refused *"the player is standing inside wallflyer@48,112 in
 * level 22 … on a tape that does NOT declare `noDamage`"*: `contactPricing`
 * priced the class `mover`. `wallFlyer.js` transcribes `Enemies/WallFlyer.as`
 * (the rest, the `collideLine` trigger, the 4 px/tick flight that stops at the
 * first solid, `Enemy.hitPlayer` with `e = this`, `knockback`'s `v = -v`).
 *
 *   `r2-wallflyer-contact` — L22 (`Dungeon3/1.oel`), boot (80,112) ⇒ the player
 *     at (88,120), on the y 120 row both `wallflyer@48,112` (resting on
 *     `rock@32,112`, its ray east) and `wallflyer@144,112` (on `rock@160,112`,
 *     its ray west) look down. `noDamage` FALSE, no keys for 60 ticks. Both
 *     launch on t 1; the west one reaches the player first and hits it on t 8
 *     (force 3, east); the east one's contact on t 13 lands inside the
 *     player's i-frame. Mid-flight each re-triggers DOWN off `rock@96,96`'s
 *     underside when the player crosses its new ray.
 *
 *   `r2-wallflyer-suit` — the same, with the DARK SUIT through the seam: the
 *     t 8 contact retaliates `e.hit(1, p, 1, "Suit")` into the flyer (hits 1,
 *     i-frame 30), whose `knockback` override REVERSES it (west); it re-launches
 *     east off its own rock on t 12.
 *
 * ⛔ THE KEYS ARE A FIXED SCHEDULE (none) and the tapes are emitted from it
 * alone, so the authoring does not depend on the model. Both were recorded on
 * the game (`check-seedling-bot-differential.mjs --record --only=…`) and the
 * bodies probed (`probe-seedling-u9-shield-mobiles.mjs --class=WallFlyer`)
 * before `stepWallFlyersNow` was committed; at the base the run steps no
 * wallflyer, so it reads no hit at t 8. `--check` re-derives the tapes and the
 * model's events.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r2-wallflyer.mjs           (write)
 *   node scripts/procgen/plan-seedling-r2-wallflyer.mjs --check   (compare)
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
const BOOT = Object.freeze({ level: 22, x: 80, y: 112 });
const TICKS = 60;

function stage(seam) {
    return createLevelRun({
        levelSource, boot: { ...BOOT }, noclip: false, noHazards: [], noDamage: false,
        grants: [], persistence: [], despawn: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null,
        seam: structuredClone(seam), roles: ROLES,
    });
}

function tapeJson(name, seam, perTick, description) {
    const folded = buildTape(perTick, BOOT, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        game: 'seedling', name, boot: { ...BOOT }, noclip: false, noDamage: false, noHazards: [],
        grants: [], persistence: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false }, seam: structuredClone(seam),
        tick_count: perTick.length, inputs: folded.inputs, tape_version: 8,
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

function drive(seam, perTick) {
    const run = stage(seam);
    let t = 0;
    try {
        for (const held of perTick) { run.advance(held); t += 1; }
    } catch (e) {
        return { run, refused: `t ${t + 1}: ${e.message.split('\n')[0]}` };
    }
    return { run, refused: null };
}

const perTick = Array.from({ length: TICKS }, () => NO_KEYS);
const evs = (run, kind) => run.wallFlyers.events.filter((e) => e.kind === kind)
    .map((e) => `${e.id.slice('wallflyer@'.length)}@${e.t}`);

// ── r2-wallflyer-contact ─────────────────────────────────────────────
{
    const NAME = 'r2-wallflyer-contact';
    const SEAM = Object.freeze({ items: {} });
    emit(NAME, tapeJson(NAME, SEAM, perTick,
        'R2-swim D1: L22, boot (80,112) — the player at (88,120) on the y 120 row that '
        + '`wallflyer@48,112` (ray east) and `wallflyer@144,112` (ray west) look down; '
        + '`noDamage` false, no keys for 60 ticks. Both launch on t 1; the west one hits the '
        + 'player on t 8 (force 3, east); the east one\'s t 13 contact lands in the i-frame.'));
    const { run, refused } = drive(SEAM, perTick);
    check(`${NAME}: the run takes all ${TICKS} ticks`, refused === null, refused ?? '');
    if (!refused) {
        const hits = run.playerHits.map((h) => `${h.source}:${h.id}@${h.t}`);
        check(`${NAME}: one player hit, by wallflyer@48,112 on t 8`,
            JSON.stringify(hits) === JSON.stringify(['wallflyer:wallflyer@48,112@8']), JSON.stringify(hits));
        check(`${NAME}: both row flyers launch on t 1`,
            ['48,112@1', '144,112@1'].every((x) => evs(run, 'launch').includes(x)),
            JSON.stringify(evs(run, 'launch')));
        const kb = run.playerHits[0]?.knockback;
        check(`${NAME}: the knockback is east, force 3`, kb?.dx === 3 && kb?.dy === 0, JSON.stringify(kb));
    }
}

// ── r2-wallflyer-suit ────────────────────────────────────────────────
{
    const NAME = 'r2-wallflyer-suit';
    const SEAM = Object.freeze({ items: { hasDarkSuit: true } });
    emit(NAME, tapeJson(NAME, SEAM, perTick,
        'R2-swim D1: `r2-wallflyer-contact` with the DARK SUIT through the seam. The t 8 '
        + 'contact retaliates `e.hit(1, p, 1, "Suit")` into `wallflyer@48,112` (hits 1, '
        + 'i-frame 30), whose `knockback` override REVERSES it; it re-launches east off '
        + 'its own rock on t 12.'));
    const { run, refused } = drive(SEAM, perTick);
    check(`${NAME}: the run takes all ${TICKS} ticks`, refused === null, refused ?? '');
    if (!refused) {
        const h = run.playerHits[0];
        check(`${NAME}: the t 8 hit retaliates into wallflyer@48,112 (hits 1, i-frame 30, reversed)`,
            h?.t === 8 && h?.retaliation?.hits === 1 && h?.retaliation?.hitsTimer === 30
                && h?.retaliation?.reversed === true, JSON.stringify(h?.retaliation));
        check(`${NAME}: the reversed flyer re-launches east on t 12`,
            evs(run, 'launch').includes('48,112@12'), JSON.stringify(evs(run, 'launch')));
    }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
