#!/usr/bin/env node
/**
 * plan-seedling-r4 — ⛓⛓⛓ R4-swim: THE WITNESSES, RECORDED ON THE GAME BEFORE
 * THE MODEL STEP.
 *
 *   `r4-iceturret-bobs` (D2) — L40 (`Dungeon3/…`), boot (400,448) ⇒ the player
 *     at (408,456) in the bob room west of `iceturret@472,400`, `noDamage`
 *     false, 150 ticks still. `bob@352,448` and `bob@352,416` chase and fall
 *     into the room's pits (t 53, t 67); the turret, on screen from t 0, fires
 *     a volley every 45 ticks (t 4, 49, 94, 139) whose blasts break on the walls.
 *     At the base the run refuses AT BOOT by name ("holds a bridged chaser AND
 *     [IceTurret], whose runtime `type` is rewritten at run time"). The flip is
 *     `"Enemy"` → `"Solid"`, and both are on every bridged chaser's `solids`,
 *     so the census question the refusal asked has one answer; the box the
 *     chaser meets is the stepped turret's.
 *
 * ⛔ THE KEYS ARE A FIXED SCHEDULE and the tapes are emitted from it alone.
 * Each was recorded on the game (`check-seedling-bot-differential.mjs --record
 * --only=…`) before its model step was committed. `--check` re-derives them.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r4.mjs           (write)
 *   node scripts/procgen/plan-seedling-r4.mjs --check   (compare)
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
function stage(boot, seam) {
    return createLevelRun({
        levelSource, boot: { ...boot }, noclip: false, noHazards: [], noDamage: false,
        grants: [], persistence: [], despawn: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null,
        seam: structuredClone(seam), roles: ROLES,
    });
}

function tapeJson(name, boot, seam, perTick, description) {
    const folded = buildTape(perTick, boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        game: 'seedling', name, boot: { ...boot }, noclip: false, noDamage: false, noHazards: [],
        grants: [], persistence: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false }, seam: structuredClone(seam),
        tick_count: perTick.length, inputs: folded.inputs,
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

function drive(boot, seam, perTick) {
    let run;
    let t = 0;
    try {
        run = stage(boot, seam);
        for (const held of perTick) { run.advance(held); t += 1; }
    } catch (e) {
        return { run, refused: `t ${t + 1}: ${e.message.split('\n')[0]}` };
    }
    return { run, refused: null };
}

// ── r4-iceturret-bobs (D2) ───────────────────────────────────────────
{
    const NAME = 'r4-iceturret-bobs';
    const BOOT = Object.freeze({ level: 40, x: 400, y: 448 });
    const SEAM = Object.freeze({ items: {} });
    const perTick = Array.from({ length: 150 }, () => new Set());
    emit(NAME, tapeJson(NAME, BOOT, SEAM, perTick,
        'R4-swim D2: L40, boot (400,448) — the player at (408,456) in the bob room west of '
        + '`iceturret@472,400`, damage on, 150 ticks still. `bob@352,448` and `bob@352,416` '
        + 'chase and fall into the room\'s pits (t 53, t 67); the turret, on screen, fires a '
        + 'volley on t 4, 49, 94 and 139 and its blasts break on the walls. The base refused '
        + 'AT BOOT (a bridged chaser beside a type-rewriting enemy); both sides of the '
        + 'turret\'s flip are on every bridged chaser\'s `solids`.'));
    const { run, refused } = drive(BOOT, SEAM, perTick);
    check(`${NAME}: the run takes all 150 ticks`, refused === null, refused ?? '');
    if (!refused) {
        const deaths = run.chaserTerrainDeaths.map((d) => `${d.id}:${d.cause}@${d.t}`);
        check(`${NAME}: the two bobs fall into pits on t 53 and t 67`, JSON.stringify(deaths)
            === JSON.stringify(['bob@352,448:pit@53', 'bob@352,416:pit@67']), JSON.stringify(deaths));
        const volleys = run.volleys.map((v) => v.t);
        check(`${NAME}: the turret fires on t 4, 49, 94 and 139`,
            JSON.stringify(volleys) === JSON.stringify([4, 49, 94, 139]), JSON.stringify(volleys));
        check(`${NAME}: no hit lands`, run.playerHits.length === 0, JSON.stringify(run.playerHits));
    }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
