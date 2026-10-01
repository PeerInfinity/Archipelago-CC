#!/usr/bin/env node
/**
 * plan-seedling-u10-puncher-dwell — ⛓⛓⛓ U10-swim D2: THE GAME WITNESS FOR
 * PRICING THE PUNCHER'S PUNCH BY THE FORECAST INSTEAD OF THE PAD.
 *
 * Until U10 the danger map priced a puncher's reach as `threatPad` 8 (the
 * punch box's depth) at EVERY tick, whether or not a wind-up ended on it. U7
 * measured that this refuses every one of the 17 stances the chaser kill arm
 * derives on L12 ("the WAIT is dangerous at tick 954"), and did not ship the
 * relaxation because a relaxation of pricing needs a game witness. These are
 * that witness, two arms, both stood at a stance with a sword and driven by
 * the keys the ladder's own preview holds (`previewWalk` with the strike
 * policy and a standing tail):
 *
 *   u10-puncher-dwell          (392,280) — the forecast ADMITS it: no forecast
 *                              tick's punch box meets the previewed player and
 *                              no body overlaps it, over a dwell longer than the
 *                              kill plus the key wait (60 + 80). The STATIC PAD
 *                              refuses the same stance. Predicted: player `hits`
 *                              0, the puncher killed by three presses and gone.
 *   u10-puncher-dwell-refused  (400,248) — the positive control: the forecast
 *                              REFUSES it by the punch at a named tick, and the
 *                              punch lands on the player at that tick.
 *
 * The stances are CHOSEN from a scan of L12's leash, not derived — a witness
 * is not a solve.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-u10-puncher-dwell.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-u10-puncher-dwell.mjs --check    # exit 1 on drift
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
const { previewWalk, strikePolicyFor } = await import(join(MODULE, 'solverBot.js'));
const { chaserDanger, dangerDuringTransit } = await import(join(MODULE, 'dangerMap.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();
/** L12's one puncher — `region1.oel` `<puncher x="416" y="256"/>`. */
const TARGET = 'puncher@416,256';
const ITEMS = Object.freeze({ hasSword: true });
/**
 * The key wait the keylock stance owes — `keyTimer` 60 then the fade 80 (swim
 * U4 § D1, `opensOnKeyTick`). ⚠ Typed here as the witness's own floor and
 * nothing else: the dwell below is longer than both the kill and it, so the
 * witness covers the whole wait the stance would need.
 */
const KEY_WAIT = 60 + 80;

function stage(boot) {
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

/**
 * The ladder's own preview of standing at `boot` for `standFor` ticks with the
 * strike policy armed, and the two pricings of it: the forecast's (the punch,
 * per tick) and the static pad's (the same samples with each body's `punch`
 * field withheld, which is the pre-U10 reading).
 */
function previewAt(boot, standFor) {
    const run = stage(boot);
    const walk = previewWalk(run, [], 0, { strike: strikePolicyFor(run, {}), standFor });
    let forecast = null;
    let pad = null;
    let deathAt = null;
    for (const sm of walk.samples) {
        const t = sm.tick - walk.startTick;
        if (deathAt === null && sm.chasers && !sm.chasers.some((b) => b.id === TARGET)) deathAt = t;
        const box = playerBoxAt(sm.x, sm.y);
        if (forecast === null) {
            const d = dangerDuringTransit(run, sm.tick, box, sm.arrows, sm.chasers);
            if (d.danger) forecast = { t, why: d.sources.map((s) => `${s.kind}:${s.id} (${s.why})`).join('; ') };
        }
        if (pad === null && sm.chasers) {
            const bare = sm.chasers.map(({ punch, ...b }) => b);
            const d = chaserDanger(run, box, 0, bare, { perTick: true });
            if (d.length) pad = { t, why: d.map((s) => s.why).join('; ') };
        }
    }
    return { walk, forecast, pad, deathAt, held: walk.samples.map((s) => s.held ?? new Set()) };
}

/** Drive the MODEL with the preview's own keys — the claim the game must reproduce. */
function drive(boot, held) {
    const run = stage(boot);
    for (const h of held) {
        run.advance(h);
        if (run.playerDeaths.length > 0) break;
    }
    return run;
}

// ── u10-puncher-dwell (the forecast admits it) ───────────────────────
{
    const NAME = 'u10-puncher-dwell';
    const BOOT = Object.freeze({ level: 12, x: 392, y: 280 });
    const STAND = 200;
    const p = previewAt(BOOT, STAND);
    check('⛓⛓⛓ the FORECAST admits the stance: no punch box and no body meets the previewed '
        + 'player at any tick of the dwell', p.forecast === null,
        p.forecast ? `t ${p.forecast.t}: ${p.forecast.why}` : `${p.walk.samples.length} samples clear`);
    check('⛔ the STATIC PAD refuses the same stance — the pricing this witness relaxes',
        p.pad !== null, p.pad ? `t ${p.pad.t}: ${p.pad.why}` : 'the pad admitted it too: the witness is vacuous');
    check(`the dwell outlasts both the kill and the key wait (${KEY_WAIT})`,
        p.deathAt !== null && STAND >= KEY_WAIT && STAND >= p.deathAt,
        `the forecast removes ${TARGET} at t ${p.deathAt}; stand ${STAND}`);
    const run = drive(BOOT, p.held);
    check('⛓⛓⛓ the MODEL, driven by those keys, takes ZERO hits (punch or contact)',
        run.playerHits.length === 0, JSON.stringify(run.playerHits.map((h) => `${h.source}@${h.t}`)));
    const landed = run.chaserPressHits.filter((h) => h.landed);
    check('⛓ three presses land and the puncher is gone by the end',
        landed.length === 3 && !run.chasers.some((c) => c.id === TARGET),
        JSON.stringify(landed.map((h) => h.t)));
    const description = '⛓⛓⛓ U10-swim D2 — THE DWELL THE FORECAST ADMITS, DRIVEN. L12 at '
        + `(${BOOT.x},${BOOT.y}), inside \`puncher@416,256\`'s 80 px leash, with a sword and `
        + '`noDamage` FALSE, holding the keys the chaser kill arm\'s own preview holds '
        + `(\`previewWalk\` with the strike policy and a ${STAND}-tick standing tail). The `
        + 'forecast prices the puncher\'s punch per tick (`chaserForecastNow`\'s `punch` row) '
        + 'and finds no tick whose punch box, or body, meets the player; the STATIC pad '
        + `(\`threatPad\` 8 at every tick) refuses the same stance at t ${p.pad?.t}. The model `
        + `predicts: presses land at t ${landed.map((h) => h.t).join(', ')}, the puncher is `
        + `removed by t ${p.deathAt}, and the player takes ZERO hits over a dwell longer than `
        + `both the kill and the key wait (${KEY_WAIT}). Authored by `
        + 'scripts/procgen/plan-seedling-u10-puncher-dwell.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, p.held, description));
    console.log(`## ${NAME}: ${p.held.length} ticks, presses landed at t `
        + `${landed.map((h) => h.t).join(', ')}, removed by t ${p.deathAt}, hits ${run.playerHits.length}`);
}

// ── u10-puncher-dwell-refused (the positive control) ────────────────
{
    const NAME = 'u10-puncher-dwell-refused';
    const BOOT = Object.freeze({ level: 12, x: 400, y: 248 });
    const STAND = 50;
    const p = previewAt(BOOT, STAND);
    check('⛓⛓⛓ the FORECAST refuses the stance BY THE PUNCH at a named tick',
        p.forecast !== null && /the punch/.test(p.forecast.why),
        p.forecast ? `t ${p.forecast.t}: ${p.forecast.why}` : 'admitted: no positive control');
    /**
     * ⛔ THE ARM ENDS ON THE PUNCH'S OWN TICK. Measured on the first recording
     * (50 ticks): the preview's next press (t 34, the punch's tick) swings WEST
     * in the model and lands EAST in the game — the player's facing after a
     * knockback, a Player-model question outside this slice's region, said in
     * the U10 report's residue. The claim this arm carries is the punch, so it
     * stops before a press the model cannot yet adjudicate.
     */
    const held = p.held.slice(0, p.forecast?.t ?? p.held.length);
    const run = drive(BOOT, held);
    const first = run.playerHits[0];
    check('⛓⛓⛓ the MODEL, driven by those keys, is PUNCHED at exactly that tick',
        first && first.source === 'punch' && first.t === p.forecast?.t,
        JSON.stringify(run.playerHits.map((h) => `${h.source}@${h.t}`)));
    check('the player is alive at the end', run.playerDeaths.length === 0, '');
    const description = '⛓⛓⛓ U10-swim D2 — THE POSITIVE CONTROL: A DWELL THE FORECAST '
        + `REFUSES, DRIVEN. L12 at (${BOOT.x},${BOOT.y}), inside \`puncher@416,256\`'s leash, `
        + 'with a sword and `noDamage` FALSE, holding the chaser kill arm\'s preview keys. The '
        + `forecast refuses the stance by the punch at t ${p.forecast?.t}; the model predicts the `
        + `punch lands there (player hits: ${run.playerHits.map((h) => `${h.source}@${h.t}`).join(', ')}). `
        + 'The admitted arm (`u10-puncher-dwell`) is only a witness if the same pricing also '
        + 'says "punch" where the game punches. Authored by '
        + 'scripts/procgen/plan-seedling-u10-puncher-dwell.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, held, description));
    console.log(`## ${NAME}: ${held.length} ticks, forecast punch at t ${p.forecast?.t}, `
        + `hits ${JSON.stringify(run.playerHits.map((h) => `${h.source}@${h.t}`))}`);
}

if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
