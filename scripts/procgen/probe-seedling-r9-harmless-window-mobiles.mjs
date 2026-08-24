/**
 * ⛓⛓⛓ R9 SLICE 12c‴, ⚖ RULING 44(b) — **THE GAME'S OWN i-FRAME CLOCK, AND
 * THE TICK THE HIT LANDS ON.**
 *
 * ⛔⛔ WHY THIS FILE EXISTS, STATED AS THE HOLE IT PLUGS — and it is the same
 * hole `probe-seedling-r9-bob-press-mobiles.mjs` plugs, one mechanism further
 * in. `verify-seedling-bot-differential --win --record` recorded both arms of
 * the harmless-window pair and the model reproduced all 43 observations of
 * each. That is a real agreement and it is NOT the claim: an expectation
 * carries the PLAYER's positions and the PLAYER's own `hits` (trap 564). ⚖
 * Ruling 44(b) is a claim about the ENEMY's timer, and nothing the
 * differential carries can see it.
 *
 * ── ⛓⛓⛓ THE TWO QUESTIONS THIS ASKS, AND THE SECOND IS 12c‴'s BLOCKER ──
 *
 * **(1) IS THE WINDOW REAL IN THE GAME?** The pair's two arms differ by ONE
 * `primary` at tick 10. The press arm's `bob@112,48` must carry `hits` 1 and a
 * running `hits_timer` while the player walks through it; the control's must
 * carry `hits` 0 and a timer of 0 throughout, and hit the player twice. One
 * press, ten ticks of contact turned into nothing.
 *
 * **(2) WHICH TICK DOES THE HIT LAND ON — THE PRESS TICK, OR PRESS + 1?**
 * §29.5's blocker is that `previewWalk` applies a struck body's hit at the
 * PRESS tick where `levelRun.advance` applies it at press+1 (`pendingThrust`
 * fires at the TOP of the following tick). The two sides therefore read
 * `hitsTimer` one apart, a blanket refusal could not notice, and ⚖ ruling 44's
 * THRESHOLD can (trap 595). Until now nothing had asked the game which side is
 * right.
 *
 * ⛓ IT IS ANSWERED BY A DERIVATION, NOT BY A READING, and that is forced:
 * `--mobiles` is a WALL-CLOCK SAMPLE and not a tick log (its own header in
 * `seedling-bot-replay-win.py` says consecutive rows are ~7 ticks apart). But
 * `botMobiles` returns the game's own `tick` beside every body, and
 * `Enemy.hit` sets `hitsTimer = hitsTimerMax` once and `hitUpdate()` drains it
 * one per update — so ONE damaged sample inverts to the hit tick exactly:
 *
 *     hitTick = sampleTick - (ENEMY_HITS_TIMER - hits_timer)
 *
 * ⛔ AND IT IS SELF-CHECKING, which is what makes it a measurement rather than
 * a lucky frame: EVERY damaged sample yields that tick INDEPENDENTLY, and they
 * must all agree. A drifting answer would mean the timer froze (the body left
 * the screen) and the derivation would be unsound — so the disagreement is
 * asserted absent rather than assumed away.
 *
 * ⚠ THE SAMPLE'S OWN `tick` IS CALIBRATED FIRST. A derivation off the game's
 * clock is worth nothing if the two clocks differ by an offset, so the PLAYER's
 * x is compared against the model's at that same `tick` before the timer is
 * read — the same tape the differential just proved agrees, used here to pin
 * the origin.
 *
 * Run (⚖ ruling 16 — announced, then run):
 *   node scripts/procgen/probe-seedling-r9-harmless-window-mobiles.mjs
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
const { ENEMY_HITS_TIMER } = await import(join(MODULE, 'presses.js'));

const PRESS = 'r9-l6-harmless-press';
const CONTROL = 'r9-l6-harmless-control';
const TARGET = 'bob@112,48';

const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const tapeOf = (name) => parseTape(JSON.parse(
    readFileSync(join(MODULE, 'fixtures', 'tapes', `${name}.json`), 'utf8')));

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

/** The MODEL's column, recomputed from the same committed tape. */
function modelColumn(tape) {
    const run = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: { ...tape.boot },
        noclip: tape.noclip, noHazards: tape.noHazards, noDamage: tape.noDamage,
        grants: tape.grants, persistence: tape.persistence, despawn: tape.despawn ?? [],
        equips: tape.equips, pins: tape.pins, save: tape.save, rng: tape.rng,
        seam: tape.seam, roles: ROLES,
    });
    /**
     * ⛓ INDEX `k` IS THE STATE AFTER ADVANCE `k`, which is the convention the
     * game's own `tick` carries: `Bot.tick` counts frames the world has run.
     * Index 0 is the state BEFORE any tick, so the array is one longer than
     * the tape — the same shape the recorded observation stream has.
     */
    const col = [{ tick: 0, x: run.state.x, y: run.state.y, body: null }];
    for (let t = 0; t < tape.tick_count; t += 1) {
        run.advance(heldKeysAt(tape, t));
        const c = run.chasers.find((x) => x.id === TARGET) ?? null;
        col.push({
            tick: run.ticksCompleted,
            x: run.state.x,
            y: run.state.y,
            body: c ? { x: c.x, y: c.y, hits: c.hits, hitsTimer: c.hitsTimer } : null,
        });
    }
    return { run, col };
}

/**
 * ⛔⛔ THE ANCHOR IS `(^|::)`, NOT `::`, AND THE FIRST CUT GOT IT WRONG IN THE
 * ONE PLACE IT MATTERED. `getQualifiedClassName` returns `"Enemies::Bob"` for a
 * body in a package and a BARE `"Player"` for the one in the default package —
 * so a `/::Player$/` matched nothing, the clock calibration below found ZERO
 * rows, and its silence read exactly like a passing check on a question nobody
 * had asked (trap 569). The bob's own regex was right by accident of its
 * package.
 */
const isBob = (m) => /(^|::)Bob$/.test(m.cls || m.type || m.name || '');
const isPlayer = (m) => /(^|::)Player$/.test(m.cls || m.type || m.name || '');
const enemyOf = (m) => m.enemy ?? {};

function armOf(name) {
    const tape = tapeOf(name);
    const { run, col } = modelColumn(tape);
    console.log(`\n## driving ${name} on Windows Chrome with --mobiles …`);
    const got = replayOnWindows(name, tape);
    const windows = got.windows ?? [got];
    const frames = windows[windows.length - 1]?.mobiles ?? got.mobiles ?? [];
    return { name, tape, run, col, frames, status: got.status ?? {} };
}

const press = armOf(PRESS);
const control = armOf(CONTROL);

for (const arm of [press, control]) {
    check(`${arm.name}: the game reported a MOBILES stream at all`, arm.frames.length > 0,
        `${arm.frames.length} sample(s)`);
}
if (press.frames.length === 0 || control.frames.length === 0) {
    console.error('\n⛔ no mobiles stream — nothing below can be asserted');
    process.exit(1);
}

/**
 * ⛔⛔ THE CLOCKS ARE CALIBRATED BEFORE ANYTHING IS DERIVED FROM THEM. Every
 * sample whose `tick` is inside the tape is matched against the model's own
 * column at that index and the PLAYER's x compared. The differential has
 * already proved these two agree; what this establishes is that the game's
 * `tick` and the model's index share an ORIGIN, which is the assumption the
 * timer derivation below rests on and which nothing else has ever checked.
 */
const TOL = 1e-6;
for (const arm of [press, control]) {
    /**
     * ⛔⛔ STRICTLY INSIDE THE TAPE, AND THE BOUND IS `< tick_count` RATHER
     * THAN `< col.length`. The driver takes a FINAL sample after the tape has
     * finished (`seedling-bot-replay-win.py`: *"the last sample is taken AFTER
     * the tape finished"*), and `Bot.tick` has stopped counting by then while
     * the world has NOT stopped running — so those rows carry the tape's last
     * tick number against a player who has moved on. Measured: two rows at
     * tick 42 reading x 137.90 and 138.10 against the model's 136.75, which is
     * the game spending the poll's own frames. Including them made every
     * candidate shift fail and the calibration report a disagreement that was
     * really an off-the-end read.
     */
    const inTape = arm.frames.filter((f) => f.tick >= 0 && f.tick < arm.tape.tick_count);
    const rows = inTape.map((f) => {
        const p = (f.mobiles ?? []).find(isPlayer);
        return { tick: f.tick, game: p ? p.x : null, model: arm.col[f.tick].x };
    }).filter((r) => r.game !== null);
    /**
     * ⛓ AND THE OFFSET IS SEARCHED RATHER THAN ASSUMED TO BE ZERO. If the two
     * counters were one apart, every timer reading below would be one apart
     * too, and the derivation would report a model defect that is really a
     * convention. So the shift that makes the player's x agree is MEASURED,
     * and the check is that exactly one shift does.
     */
    const agreesAt = (shift) => rows.length > 0 && rows.every((r) => {
        const c = arm.col[r.tick + shift];
        return c !== undefined && Math.abs(r.game - c.x) < TOL;
    });
    const fits = [-2, -1, 0, 1, 2].filter(agreesAt);
    check(`${arm.name}: ⛓⛓ THE TWO CLOCKS SHARE AN ORIGIN — the player's x agrees at `
        + 'every sampled tick under EXACTLY ONE shift, and that shift is ZERO',
        rows.length > 0 && fits.length === 1 && fits[0] === 0,
        `${rows.length} sampled tick(s) inside the tape; shifts that fit `
        + `${JSON.stringify(fits)}; first row ${JSON.stringify(rows[0] ?? null)}`);
}

console.log('\n## THE GAME\'S OWN ENEMY READOUT, sample by sample');
for (const arm of [press, control]) {
    console.log(`   ── ${arm.name}`);
    for (const f of arm.frames) {
        for (const b of (f.mobiles ?? []).filter(isBob)) {
            const e = enemyOf(b);
            console.log(`      tick ${String(f.tick).padStart(3)}  (${b.x.toFixed(2)}, `
                + `${b.y.toFixed(2)})  hits ${e.hits}/${e.hits_max}  `
                + `hits_timer ${e.hits_timer}  anim ${JSON.stringify(b.anim)}`);
        }
    }
}

// ── (1) IS THE WINDOW REAL IN THE GAME? ───────────────────────────────
const damagedOf = (arm) => arm.frames.flatMap((f) => (f.mobiles ?? []).filter(isBob)
    .filter((b) => (enemyOf(b).hits ?? 0) > 0)
    .map((b) => ({ tick: f.tick, x: b.x, y: b.y, hits: enemyOf(b).hits,
        hitsMax: enemyOf(b).hits_max, timer: enemyOf(b).hits_timer, anim: b.anim })));
const pressDamaged = damagedOf(press);
const controlDamaged = damagedOf(control);

check('⛓⛓⛓ THE PRESS ARM: the game says a bob CARRIES DAMAGE, and exactly one does',
    pressDamaged.length > 0
        && press.frames.every((f) => (f.mobiles ?? []).filter(isBob)
            .filter((b) => (enemyOf(b).hits ?? 0) > 0).length <= 1),
    `${pressDamaged.length} damaged reading(s), hits ${[...new Set(pressDamaged.map((b) => b.hits))].join('/')}`);
/**
 * ⛓ THE TIMER'S SHAPE, NOT MERELY ITS PRESENCE. It must be RUNNING for the
 * ticks the window covers and EXPIRED after them — a sample reading 0 late in
 * the tape is the window ending on schedule, which is a claim, not a miss. The
 * boundary is derived from the samples themselves below (`hitTick`), so this
 * asserts only monotonic drain: no reading may be HIGHER than an earlier one.
 */
check('⛓⛓⛓ …and that i-frame DRAINS MONOTONICALLY to zero — the window runs and '
    + 'then ends, which is the whole of ⚖ ruling 44(b)\'s gate',
    pressDamaged.length > 1
        && pressDamaged.every((b, i) => i === 0 || b.timer <= pressDamaged[i - 1].timer)
        && pressDamaged.some((b) => b.timer > 0)
        && pressDamaged[pressDamaged.length - 1].timer === 0,
    JSON.stringify(pressDamaged.map((b) => ({ t: b.tick, timer: b.timer }))));
check('⛔⛔ THE CONTROL ARM: NO bob ever carries damage — nothing armed a timer',
    controlDamaged.length === 0,
    `${controlDamaged.length} damaged reading(s)`);
check('⛔⛔ …and the PLAYER pays for it: the game\'s own `hits` is 2 in the control '
    + 'and 0 in the press arm, from ONE key',
    (control.status.hits ?? null) === 2 && (press.status.hits ?? null) === 0,
    `control ${JSON.stringify(control.status.hits ?? null)}, press `
    + `${JSON.stringify(press.status.hits ?? null)}`);

// ── (2) WHICH TICK DOES THE HIT LAND ON? ──────────────────────────────
/**
 * ⛓ THE INVERSION. `Enemy.hit` writes `hitsTimer = hitsTimerMax` once and
 * `hitUpdate()` drains it one per update, so a sample at `tick` reading
 * `hits_timer` implies the write happened `ENEMY_HITS_TIMER - hits_timer`
 * updates earlier. Each damaged sample answers on its own.
 */
const derived = pressDamaged.filter((b) => b.timer > 0)
    .map((b) => ({ from: b.tick, timer: b.timer,
        hitTick: b.tick - (ENEMY_HITS_TIMER - b.timer) }));
const answers = [...new Set(derived.map((d) => d.hitTick))];
/**
 * ⛔⛔⛔ **ONE COUNTER, TWO CONVENTIONS — AND THE FIRST CUT OF THIS PROBE MIXED
 * THEM AND REPORTED A ONE-TICK MODEL DEFECT THAT DOES NOT EXIST.**
 *
 * `run.slashPresses[i].t` and `run.chaserPressHits[i].t` are `ticksCompleted`
 * read INSIDE the tick, i.e. the ZERO-BASED INDEX of the advance. `Bot.tick`,
 * the recorded observation stream's `t`, and `run.ticksCompleted` read AFTER
 * the call are the POST-tick COUNT — one higher. `previewWalk`'s own
 * `tick - 1` note is the same hazard from the other side.
 *
 * ⇒ everything below is stated in the GAME's convention, and the conversion is
 * named rather than folded into an offset.
 */
const asGameTick = (index) => (index === null ? null : index + 1);
const MODEL_PRESS_TICK = asGameTick(press.run.slashPresses[0]?.t ?? null);
const MODEL_HIT_TICK = asGameTick(
    press.run.chaserPressHits.find((h) => h.landed)?.t ?? null);

console.log(`\n## THE DERIVATION, sample by sample (${ENEMY_HITS_TIMER} - hits_timer `
    + 'ticks before the sample; all ticks in the GAME\'s own convention)');
for (const d of derived) {
    console.log(`   tick ${String(d.from).padStart(3)}  hits_timer ${String(d.timer).padStart(2)}`
        + `  ⇒ the hit landed at tick ${d.hitTick}`);
}

check('⛓⛓⛓ EVERY damaged sample derives the SAME hit tick — the timer never froze, '
    + 'so the inversion is sound',
    derived.length > 1 && answers.length === 1,
    `${derived.length} sample(s) ⇒ ${JSON.stringify(answers)}`);
check('⛓⛓⛓⛓ **THE GAME LANDS THE HIT AT PRESS + 1**, which is `levelRun.advance`\'s '
    + '`pendingThrust` fired at the TOP of the following tick — and NOT '
    + '`previewWalk`\'s `chasers.hit` at the press tick',
    answers.length === 1 && MODEL_PRESS_TICK !== null
        && answers[0] === MODEL_PRESS_TICK + 1,
    `the game says ${JSON.stringify(answers[0] ?? null)}; the press is at game tick `
    + `${MODEL_PRESS_TICK}, so press + 1 = ${MODEL_PRESS_TICK + 1}`);
check('⛓ …and the MODEL\'s own landed-hit row says the same tick',
    MODEL_HIT_TICK !== null && answers.length === 1 && MODEL_HIT_TICK === answers[0],
    `model ${MODEL_HIT_TICK}, game ${answers[0] ?? null}`);
/**
 * ⛔ THE DISCRIMINATOR SAID OUT LOUD. `previewWalk` applies its hit at the
 * PRESS tick; if that were the game's behaviour the derivation would answer
 * `MODEL_PRESS_TICK`. It does not — and the difference is exactly ONE, which
 * is the skew §29.5 measured as a SIX-TICK divergence in the decisions it
 * produces once ⚖ ruling 44's threshold started reading that value.
 */
check('⛔⛔ …and it is NOT the press tick, which is what `previewWalk` assumes',
    answers.length === 1 && answers[0] === MODEL_PRESS_TICK + 1,
    `press tick ${MODEL_PRESS_TICK}, the game's hit tick ${answers[0] ?? null} — a `
    + `difference of ${answers.length === 1 ? answers[0] - MODEL_PRESS_TICK : '?'}`);

/**
 * ⛓⛓⛓⛓ **AND THE STRONGEST ROW IS THE COLUMN ITSELF.** The derivation above
 * answers WHICH TICK; this answers whether the model's whole i-frame column is
 * the game's, value for value, at every tick the poller happened to sample
 * inside the tape. It is the row ⚖ ruling 44(b) actually needs, and no
 * expectation stream can carry it (trap 564): the differential compares the
 * PLAYER, and this is the BODY.
 */
const timerRows = press.frames
    .filter((f) => f.tick < press.tape.tick_count)
    .map((f) => {
        const b = (f.mobiles ?? []).filter(isBob)
            .find((m) => (enemyOf(m).hits ?? 0) > 0) ?? null;
        const m = press.col[f.tick].body;
        return { tick: f.tick, game: b ? enemyOf(b).hits_timer : null,
            model: m ? m.hitsTimer : null,
            gameHits: b ? enemyOf(b).hits : 0, modelHits: m ? m.hits : null,
            gameX: b ? Number(b.x.toFixed(2)) : null,
            modelX: m ? Number(m.x.toFixed(2)) : null };
    })
    .filter((r) => r.gameHits > 0 || r.modelHits > 0);
console.log('\n## THE BODY\'S OWN COLUMN, GAME vs MODEL, at every sampled tick');
for (const r of timerRows) {
    console.log(`   tick ${String(r.tick).padStart(3)}  hits_timer game ${r.game} / model `
        + `${r.model}   hits ${r.gameHits}/${r.modelHits}   x ${r.gameX}/${r.modelX}`);
}
check('⛓⛓⛓⛓ THE MODEL\'S i-FRAME COLUMN **IS** THE GAME\'S — `hits_timer`, `hits` '
    + 'and the body\'s own x agree at every sampled tick inside the tape',
    timerRows.length > 1
        && timerRows.every((r) => r.game === r.model && r.gameHits === r.modelHits
            && Math.abs((r.gameX ?? 0) - (r.modelX ?? 0)) < 0.01),
    `${timerRows.length} sampled tick(s); first disagreement `
    + `${JSON.stringify(timerRows.find((r) => r.game !== r.model
        || r.gameHits !== r.modelHits
        || Math.abs((r.gameX ?? 0) - (r.modelX ?? 0)) >= 0.01) ?? null)}`);

if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green — THE GAME AGREES: one press turns ten ticks of body '
    + 'contact into nothing, and the hit it does that with lands at PRESS + 1.');
