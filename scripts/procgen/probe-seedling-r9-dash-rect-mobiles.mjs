/**
 * ⛓⛓⛓ R9 SLICE 12c — **THE DASH RECT'S ENEMY-SIDE WITNESS**, because the
 * differential cannot be one.
 *
 * ⛔⛔ THE HOLE THIS PLUGS, STATED AS A HOLE. `verify-seedling-bot-
 * differential --win --record` checks an expectation built from the PLAYER's
 * observations. `r9-l6-sword-dash-hit`'s claim is not about the player: it is
 * that a press `set slashing` took the DASH arm swings a **24 x 20.8** rect
 * with a **24 px** reach, and lands a hit at `distanceRectPoint` 20.236 — a
 * distance an ORDINARY swing's 16 px reach cannot touch. The player walks the
 * same 22 ticks either way. ⇒ trap 564, and the cure is the same one slice 12
 * used: drive the committed tape with `--mobiles` and ask the GAME what
 * happened to the body.
 *
 * ── WHAT THE GAME IS ASKED, AND WHY EACH ANSWER IS A DISCRIMINATOR ────
 *
 * 1. **DID THE BODY TAKE A HIT AT ALL.** This is the whole tape. A model that
 *    swung the ordinary rect for a dash press predicts `hits` stays 0; the
 *    model here predicts 1. One boolean, and the game settles it.
 * 2. **EXACTLY ONE.** The dash's window runs five hit ticks and two of them
 *    still cover the body — both refused by `Enemy.hit`'s 30-tick i-frame. A
 *    model that double-counted (§23.15's `slashRepeats` append, repaired in
 *    this slice) or that ignored the i-frame would predict more.
 * 3. **AND IT DID NOT DIE.** `hits_max` is 3. A tape whose body died would be
 *    a tape about `startDeath`, not about a rect.
 * 4. **THE KNOCKBACK.** `swordForce` throws the body clear, which is why hit
 *    ticks 3, 4 and 5 of the same window reach nothing.
 *
 * ⚠ WHAT IT DOES NOT ASSERT, NAMED: a per-TICK correspondence. `--mobiles`
 * samples, it does not stream every tick, so the model's tick numbers are
 * printed beside the game's samples for a reader and the ASSERTIONS are about
 * the shape — one damaged body, one hit, alive, knocked east.
 *
 * Run (⚖ ruling 16 — announced, then run):
 *   node scripts/procgen/probe-seedling-r9-dash-rect-mobiles.mjs
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

const { gameVisibleTape, heldKeysAt, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { SWORD_FORCE } = await import(join(MODULE, 'combatVerbs.js'));
const { ENEMY_HITS_MAX, SLASH_REACH, SLASH_REACH_DASH } = await import(
    join(MODULE, 'presses.js'));

const NAME = 'r9-l6-sword-dash-hit';
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
    modelTrack.push(c ? { t: run.ticksCompleted, x: c.x, y: c.y, hits: c.hits,
        hitsTimer: c.hitsTimer } : null);
}
const landed = run.chaserPressHits.filter((h) => h.landed);
const dashPress = run.slashPresses.find((p) => p.outcome === 'dash');
console.log(`\n## THE MODEL says: the DASH at t=${dashPress?.t} swings 24 x 20.8 and lands `
    + `${landed.length} hit at t=${landed[0]?.t}, reach ${landed[0]?.reach.toFixed(3)} `
    + `(> ${SLASH_REACH}, <= ${SLASH_REACH_DASH}); the body survives at `
    + `${landed[0]?.hits}/${ENEMY_HITS_MAX} and is thrown by swordForce ${SWORD_FORCE}.`);
console.log('## the model\'s body column, tick by tick:');
for (const r of modelTrack) {
    if (!r) continue;
    console.log(`   t=${String(r.t).padStart(2)} (${r.x.toFixed(3)}, ${r.y.toFixed(3)}) `
        + `hits ${r.hits} hitsTimer ${r.hitsTimer}`);
}

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
 * ⛔ THE BODY IS IDENTIFIED BY WHAT HAPPENED TO IT, NOT BY A COUNT — slice 12's
 * own lesson (trap 565): L6's other bob fades out on its own and a count cannot
 * tell two disappearances apart. The target is the body the press LANDED on,
 * which the game names for itself by being the only one whose `hits` moves.
 */
const enemyOf = (mob) => mob.enemy ?? {};
const isBob = (mob) => /::Bob$/.test(mob.cls || mob.type || mob.name || '');
const bobsAt = (frame) => (frame?.mobiles ?? []).filter(isBob);
const damaged = mobiles.map((f) => bobsAt(f)
    .filter((m) => (enemyOf(m).hits ?? 0) > 0)
    .map((m) => ({
        x: m.x, y: m.y, anim: m.anim, alpha: m.alpha,
        hits: enemyOf(m).hits, hitsMax: enemyOf(m).hits_max,
        timer: enemyOf(m).hits_timer,
    })));
const anyDamaged = damaged.flat();

console.log('\n## THE GAME\'S OWN ENEMY READOUT, sample by sample (damaged bodies only)');
damaged.forEach((row, i) => {
    for (const b of row) {
        console.log(`   sample ${String(i).padStart(2)}  (${b.x.toFixed(2)}, ${b.y.toFixed(2)})  `
            + `hits ${b.hits}/${b.hitsMax}  hits_timer ${b.timer}  anim ${JSON.stringify(b.anim)}  `
            + `alpha ${b.alpha}`);
    }
});

/**
 * ⛔⛔⛔ **CLAIM 1 — THE HIT HAPPENED AT ALL, AND THIS IS THE WHOLE TAPE.**
 * The landed reach is 20.236: above `SLASH_REACH` and below `SLASH_REACH_DASH`.
 * A model swinging the ORDINARY rect for a dash press predicts `hits` never
 * leaves 0. The game answers a boolean.
 */
check('⛔⛔⛔ THE GAME REGISTERED A HIT — a distance only the DASH rect reaches',
    anyDamaged.length > 0,
    `${anyDamaged.length} damaged reading(s); the model's landed reach is `
    + `${landed[0]?.reach.toFixed(3)}, which an ordinary ${SLASH_REACH} px swing cannot touch`);
if (anyDamaged.length === 0) {
    console.error('\n⛔ THE GAME SAW NO HIT — the dash rect is not what the model says. '
        + 'This IS the finding; do not re-seal.');
    process.exit(1);
}
const ys = anyDamaged.map((b) => b.y);
check('⛓⛓ EXACTLY ONE body was ever damaged — the press hit what it aimed at',
    Math.max(...ys) - Math.min(...ys) < 2 && damaged.every((row) => row.length <= 1),
    `y spread ${(Math.max(...ys) - Math.min(...ys)).toFixed(3)} px over `
    + `${anyDamaged.length} damaged reading(s)`);
const seq = [];
for (const b of anyDamaged) if (seq[seq.length - 1] !== b.hits) seq.push(b.hits);
check('⛔⛔ EXACTLY ONE HIT — the dash window\'s later rects are refused by the 30-tick '
    + 'i-frame, and nothing double-counted',
    JSON.stringify(seq) === '[1]', JSON.stringify(seq));
check(`⛓ …and the body SURVIVED — 1 of ${ENEMY_HITS_MAX}, no "die" animation, no fade`,
    anyDamaged.every((b) => b.hitsMax === ENEMY_HITS_MAX && b.hits < b.hitsMax
        && b.anim !== 'die' && b.alpha === 1),
    `hits ${anyDamaged[0]?.hits}/${anyDamaged[0]?.hitsMax}, `
    + `anims ${JSON.stringify([...new Set(anyDamaged.map((b) => b.anim))])}, `
    + `alphas ${JSON.stringify([...new Set(anyDamaged.map((b) => b.alpha))])}`);
check('⛓⛓ the hit ARMED the 30-tick i-frame — the timer is caught mid-drain',
    anyDamaged.some((b) => b.timer > 0),
    `timers ${JSON.stringify(anyDamaged.map((b) => b.timer))}`);
/**
 * ⛓⛓ THE KNOCKBACK, which is why hit ticks 3..5 of the same window reach
 * nothing. The model throws the body EAST by `swordForce`; the game's damaged
 * readings must show it further east than the undamaged one before it.
 */
const firstDamagedSample = damaged.findIndex((row) => row.length > 0);
const beforeBobs = bobsAt(mobiles[Math.max(0, firstDamagedSample - 1)]);
check(`⛓⛓ the body was THROWN EAST by swordForce (${SWORD_FORCE}) — which is why the `
    + 'window\'s later rects reach nothing',
    beforeBobs.length > 0
        && Math.max(...anyDamaged.map((b) => b.x)) > Math.min(...beforeBobs.map((b) => b.x)),
    `before ${JSON.stringify(beforeBobs.map((b) => Number(b.x.toFixed(2))))} -> damaged `
    + `${JSON.stringify(anyDamaged.map((b) => Number(b.x.toFixed(2))))}`);
check('⛔ the player took ZERO hits in the game\'s own reckoning too',
    (got.status?.hits ?? 0) === 0,
    `game hits = ${JSON.stringify(got.status?.hits ?? null)}`);

if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED — any digit differing IS the finding. `
        + 'STOP; do not re-seal.');
    process.exit(1);
}
console.log('\nall checks green — THE GAME AGREES: a press that DASHED reached a body '
    + `${landed[0].reach.toFixed(3)} px away, which an ordinary ${SLASH_REACH} px swing `
    + 'cannot, hit it ONCE, and threw it clear. The dash RECT is measured, not claimed.');
