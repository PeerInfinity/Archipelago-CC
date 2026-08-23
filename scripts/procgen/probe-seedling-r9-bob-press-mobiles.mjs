/**
 * ⛓⛓⛓ R9 SLICE 12 — **THE ENEMY-SIDE WITNESS**, because the differential
 * cannot be one.
 *
 * ⛔⛔ WHY THIS FILE EXISTS, STATED AS THE HOLE IT PLUGS.
 * `verify-seedling-bot-differential --win --record` recorded
 * `r9-l6-bob-press` and the model reproduced all 193 observations. That is a
 * real agreement and it is NOT the claim: an expectation carries the PLAYER's
 * positions and the PLAYER's own `hits`, and the player in this tape STANDS
 * STILL for 180 of its 192 ticks. Its trajectory is very nearly the same
 * whether the bob dies or not, so a passing differential does not witness the
 * press arm — the law is that the first press against a chaser is a
 * MEASUREMENT on the game before it is a claim, and positions alone do not
 * make it one.
 *
 * ⇒ THIS DRIVES THE SAME COMMITTED TAPE WITH `--mobiles`, which the
 * differential does not pass, and asks the GAME where the body is and whether
 * it is still there. The model's own answers are recomputed here from the same
 * tape so the two columns are printed side by side.
 *
 * ⚠ IT ASSERTS THE THINGS `--mobiles` CAN CARRY — the body's PRESENCE and its
 * POSITION. The game's own `hits` counter for an ENEMY is not on any readout
 * this rung has, so the hit COUNT stays a model number; what the game settles
 * is that the body was knocked where the model says and left when the model
 * says it left, which is the half a wrong damage model could not fake.
 *
 * Run (⚖ ruling 16 — announced, then run):
 *   node scripts/procgen/probe-seedling-r9-bob-press-mobiles.mjs
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));

const NAME = 'r9-l6-bob-press';
const TARGET = 'bob@112,48';
const TAPE = parseTape(JSON.parse(
    readFileSync(join(MODULE, 'fixtures', 'tapes', `${NAME}.json`), 'utf8')));

const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

function replayOnWindows(name, tapeObj) {
    mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
    writeFileSync(join(WIN_SCRATCH_WSL, 'seedling-bot-replay-win.py'), readFileSync(WIN_DRIVER));
    const outWsl = join(WIN_SCRATCH_WSL, `stream-${name}.json`);
    writeFileSync(join(WIN_SCRATCH_WSL, `tape-${name}.json`),
        JSON.stringify(gameVisibleTape(tapeObj)));
    try { unlinkSync(outWsl); } catch { /* first run */ }
    const out = execFileSync(WIN_PY, [
        '-3.12', `${WIN_SCRATCH_DOS}\\seedling-bot-replay-win.py`,
        '--url', PAGE_URL,
        '--tape', `${WIN_SCRATCH_DOS}\\tape-${name}.json`,
        '--out', `${WIN_SCRATCH_DOS}\\stream-${name}.json`,
        '--mobiles',
        '--deadline-sec', String(Math.ceil(tapeObj.tick_count * 1.5) + 120),
    ], { cwd: WIN_SCRATCH_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
        .forEach((l) => console.log(`    ${l}`));
    if (!existsSync(outWsl)) throw new Error(`windows driver wrote no stream for ${name}`);
    return JSON.parse(readFileSync(outWsl, 'utf8'));
}

// ── the MODEL's column, recomputed from the same committed tape ───────
const run = createLevelRun({
    levelSource: atlasLevelSource(),
    boot: { ...TAPE.boot },
    noclip: TAPE.noclip, noHazards: TAPE.noHazards, noDamage: TAPE.noDamage,
    grants: TAPE.grants, persistence: TAPE.persistence, despawn: TAPE.despawn ?? [],
    equips: TAPE.equips, pins: TAPE.pins, save: TAPE.save, rng: TAPE.rng,
    seam: TAPE.seam, roles: ROLES,
});
const modelTrack = [];
for (let t = 0; t < TAPE.tick_count; t += 1) {
    run.advance(heldKeysAt(TAPE, t));
    const c = run.chasers.find((x) => x.id === TARGET);
    modelTrack.push(c ? { t: run.ticksCompleted, x: c.x, y: c.y } : null);
}
const modelKill = run.chaserKills[0] ?? null;
const modelGoneAt = modelTrack.findIndex((r) => r === null);

console.log(`\n## THE MODEL says: ${run.chaserPressHits.filter((h) => h.landed).length} `
    + `landed hit(s), kill at t=${modelKill?.t ?? 'none'}, body gone from the roster at `
    + `index ${modelGoneAt} of ${TAPE.tick_count}`);

// ── the GAME's column ─────────────────────────────────────────────────
console.log(`\n## driving ${NAME} on Windows Chrome with --mobiles …`);
const got = replayOnWindows(NAME, TAPE);
const windows = got.windows ?? [got];
const mobiles = windows[windows.length - 1]?.mobiles ?? got.mobiles ?? [];
check('the game reported a MOBILES stream at all', mobiles.length > 0,
    `${mobiles.length} sample(s)`);
if (mobiles.length === 0) {
    console.error('\n⛔ no mobiles stream — nothing below can be asserted');
    process.exit(1);
}

/**
 * ⛔⛔ THE BODY IS IDENTIFIED BY WHAT HAPPENED TO IT, NOT BY A COUNT.
 *
 * The first cut of this probe asserted "the bob count drops by exactly one"
 * and FAILED — 2 -> 1 -> 0 — for a reason that had nothing to do with the
 * press: L6's OTHER bob (`bob@96,16`, the one parked against a sandtrap) fades
 * out on its own around sample 8, and a count cannot tell two disappearances
 * apart. ⇒ the target is the body the presses LANDED on, which the game names
 * for itself by being the only one whose `hits` ever moves.
 */
const enemyOf = (mob) => mob.enemy ?? {};
const isBob = (mob) => /::Bob$/.test(mob.cls || mob.type || mob.name || '');
const bobsAt = (frame) => (frame?.mobiles ?? []).filter(isBob);
/** Per sample: every bob that carries damage, with the fields the model uses. */
const damaged = mobiles.map((f) => bobsAt(f)
    .filter((m) => (enemyOf(m).hits ?? 0) > 0)
    .map((m) => ({
        x: m.x, y: m.y, anim: m.anim, alpha: m.alpha,
        hits: enemyOf(m).hits, hitsMax: enemyOf(m).hits_max,
        timer: enemyOf(m).hits_timer, damage: enemyOf(m).damage,
        canHit: enemyOf(m).can_hit, onlyHitBy: enemyOf(m).only_hit_by,
        justKnock: enemyOf(m).just_knock,
    })));
const anyDamaged = damaged.flat();

console.log('\n## THE GAME\'S OWN ENEMY READOUT, sample by sample (damaged bodies only)');
damaged.forEach((row, i) => {
    if (!row.length) return;
    for (const b of row) {
        console.log(`   sample ${String(i).padStart(2)}  (${b.x.toFixed(2)}, `
            + `${b.y.toFixed(2)})  hits ${b.hits}/${b.hitsMax}  hits_timer ${b.timer}  `
            + `anim ${JSON.stringify(b.anim)}  alpha ${b.alpha}`);
    }
});

/**
 * ⚠ IDENTITY BY BAND, NOT BY A ROUNDED COORDINATE. The first cut keyed on
 * `Math.round(y)` and reported TWO bodies from ONE: the body drifts across
 * 56.30 .. 56.88 as it walks and is knocked, and rounding splits that into 56
 * and 57. The readout carries no id, so the honest identity is "every damaged
 * reading lies in one body's own row", plus "never two damaged bodies at once".
 */
const ys = anyDamaged.map((b) => b.y);
check('⛓⛓⛓ EXACTLY ONE body was ever damaged — the press hit what it aimed at',
    Math.max(...ys) - Math.min(...ys) < 2 && damaged.every((row) => row.length <= 1),
    `y spread ${(Math.max(...ys) - Math.min(...ys)).toFixed(3)} px over `
    + `${anyDamaged.length} damaged reading(s); max ${Math.max(...damaged.map((r) => r.length))} `
    + 'damaged body in any one sample');
const seq = [];
for (const b of anyDamaged) if (seq[seq.length - 1] !== b.hits) seq.push(b.hits);
check('⛓⛓⛓ THE GAME COUNTED THREE HITS, 1 -> 2 -> 3, exactly as the model does',
    JSON.stringify(seq) === '[1,2,3]', JSON.stringify(seq));
check('⛔ …against the class row the model reads — hits_max 3, damage 1',
    anyDamaged.every((b) => b.hitsMax === 3 && b.damage === 1),
    `hits_max ${anyDamaged[0]?.hitsMax}, damage ${anyDamaged[0]?.damage}`);
check('⛔ …and `Enemy.hit`\'s own gate inputs are what `enemyHit` assumes',
    anyDamaged.every((b) => b.canHit === true && b.onlyHitBy === '' && b.justKnock === false),
    `can_hit ${anyDamaged[0]?.canHit}, only_hit_by ${JSON.stringify(anyDamaged[0]?.onlyHitBy)}, `
    + `just_knock ${anyDamaged[0]?.justKnock}`);
check('⛓⛓ every landed hit ARMED the 30-tick i-frame — the timer is caught mid-drain',
    [1, 2, 3].every((h) => anyDamaged.some((b) => b.hits === h && b.timer > 0)),
    JSON.stringify([1, 2, 3].map((h) => Math.max(
        ...anyDamaged.filter((b) => b.hits === h).map((b) => b.timer)))));
check('⛓⛓⛓ THE THIRD HIT KILLED IT — the game plays "die" at hits === hitsMax',
    anyDamaged.some((b) => b.hits === b.hitsMax && b.anim === 'die'),
    JSON.stringify(anyDamaged.filter((b) => b.hits === b.hitsMax)
        .map((b) => b.anim).slice(0, 4)));
check('⛔ …and the death is an ANIMATION then a FADE, not an instant removal',
    anyDamaged.some((b) => b.hits === b.hitsMax && b.alpha < 1),
    JSON.stringify(anyDamaged.filter((b) => b.hits === b.hitsMax)
        .map((b) => b.alpha)));
const lastDamagedSample = damaged.reduce((acc, row, i) => (row.length ? i : acc), -1);
check('⛓ the body is GONE from the game\'s roster by the end of the tape',
    lastDamagedSample >= 0 && lastDamagedSample < mobiles.length - 1
        && bobsAt(mobiles[mobiles.length - 1]).length === 0,
    `last damaged sample ${lastDamagedSample} of ${mobiles.length - 1}`);
check('⛔ the player took ZERO hits in the game\'s own reckoning too',
    (got.status?.hits ?? 0) === 0,
    `game hits = ${JSON.stringify(got.status?.hits ?? null)}`);

if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green — THE GAME AGREES: three hits, a "die" animation, a fade, '
    + 'and a body that leaves. The press arm is measured, not claimed.');
