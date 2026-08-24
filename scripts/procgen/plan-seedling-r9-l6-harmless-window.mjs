/**
 * ⛓⛓⛓ R9 SLICE 12c‴, ⚖ RULING 44(b) — **THE HARMLESS WINDOW'S DRIVEN
 * WITNESS PAIR, AND THE GAME'S OWN `hitsTimer` CLOCK.**
 *
 * ⛔⛔ WHY A PAIR EXISTS AT ALL, STATED AS THE HOLE IT PLUGS.
 * ⚖ Ruling 44(b) says a struck enemy cannot deal contact damage for its whole
 * 30-tick i-frame (`Enemies/Enemy.as:211` gates `hitPlayer()` on the ENEMY's
 * own `hitsTimer <= 0`). Slice 12c″ taught the PLANNER that window and moved
 * L14 from 145 t to 128 t on the strength of it. And §29.7 measured the
 * roster's reach: of 146 committed tapes, **ZERO** carry a `contactsSuppressed`
 * row with `why === 'enemy hitsTimer'`. The one scratch calibration 12c″ ran
 * was the model agreeing with itself. ⇒ **the GAME had never been asked**, and
 * a mechanism the whole dash model now rests on was, on the roster, unwitnessed.
 *
 * ⛓ THE USER LICENSED THE PAIR (2026-08-24, option A) and 12c″ left it
 * unspent; this is it.
 *
 * ── THE DISCRIMINATOR, WHICH IS THE WHOLE REASON IT IS A PAIR ─────────
 *
 * Two tapes from the SAME boot with the SAME held keys, differing by exactly
 * ONE `primary` at tick 10:
 *
 *   · **the PRESS arm** — the swing lands on `bob@112,48` and arms its
 *     i-frame, and the player then walks THROUGH the body it just knocked
 *     (`"Enemy"` is not in `Mobile.solids`, `Mobile.as:17`) taking **no hits**,
 *     with ten ticks of contact suppressed by the ENEMY's own timer;
 *   · **the CONTROL** — the identical walk without that one press is hit
 *     **twice** by that same bob.
 *
 * One press turns ten ticks of body contact into ten ticks of nothing. A
 * single tape could not say that: a walk that takes no hits proves nothing
 * about WHY, and a walk that takes two proves nothing about the window.
 *
 * ── ⛓⛓⛓ AND IT IS THE CLOCK CALIBRATION FOR THE PREVIEW/DRIVE SKEW ───
 *
 * §29.5's blocker is that the preview applies a struck body's hit at the PRESS
 * tick where the drive applies it at press+1. The GAME's own answer is read out
 * of the `--mobiles` stream (`probe-seedling-r9-harmless-window-mobiles.mjs`):
 * `botMobiles` carries the game's `tick` beside each body's `hits_timer`, and
 * the timer is set to 30 by the hit and decremented once per update — so ONE
 * damaged sample settles the hit tick exactly:
 *
 *     hitTick = sampleTick - (ENEMY_HITS_TIMER - hits_timer)
 *
 * ⚠ AND IT HAS TO BE A DERIVATION RATHER THAN A READING, because `--mobiles`
 * is a WALL-CLOCK SAMPLE and not a tick log (its own header says consecutive
 * rows are ~7 ticks apart). The derivation is exact where the reading is not,
 * and every damaged sample yields the same tick independently — which is what
 * makes the claim self-checking rather than a single lucky frame.
 *
 * THE MODEL'S ANSWER, sealed here: the press is at tick **10**, the thrust
 * fires at tick **11** (`pendingThrust` is applied at the TOP of the tick
 * AFTER the press — `levelRun.js:13131`), and the body's `hitsTimer` is 30 at
 * the end of tick 11, `30 - (k - 11)` thereafter.
 *
 * ── ⛔⛔⛔ THE LENGTH IS DERIVED, AND THE FIRST DERIVATION WAS WRONG ───
 *
 * The obvious length — walk east until the press arm's own first player hit
 * and stop one tick short of it — is 60 ticks, and it is the WORST length
 * available. It was recorded, and the GAME refused both arms:
 * `r9-l6-harmless-press` came back `hits` 1 against the model's 0 with
 * `hits_timer` 18, and `r9-l6-harmless-control` came back `hits` **0** against
 * the model's 2. Every one of the 61 observations matched.
 *
 * ⛓ THE CAUSE IS NOT THE MODEL. `seedling-bot-replay-win.py:69` polls
 * `botStatus` every `poll_sec = 0.25` and the game runs at
 * `FP.assignedFrameRate` 30 (this recording measured 29.93), so the status the
 * differential compares is read up to ~8 ENGINE FRAMES AFTER the tape's last
 * observation — with the tape's last keys still held, because nothing
 * dispatches a release. A tape that ends one tick from an event spends those
 * frames on it. At 60 the press arm's margin is exactly ZERO: its next hit is
 * the corridor's `sandtrap@160,48` on the very next tick.
 *
 * ⛔⛔ AND THE CONTROL'S FAILURE IS THE INTERESTING ONE, BECAUSE IT IS
 * SILENT AND POINTS THE WRONG WAY. `verify-seedling-bot-differential`'s own
 * docblock argues the `hits` EQUALITY is safe where `hits_timer` is only a
 * bound: *"nothing moves it after the tape stops except a further hit, and
 * that would fail the equality loudly rather than quietly."* A further hit
 * moves it UP — loud. A further hit that is the KILLING one moves it back to
 * **ZERO**, because `Player.hit`'s `hits >= hitsMax` arm calls `die()`. The
 * control had taken 2 of `hitsMax` 3 and its third landed in those post-tape
 * frames, so the game reported 0 and the diagnostic read as *"the model
 * over-counted"* — a true sentence about the wrong subject. That is a fact
 * about the differential's reasoning, not about this tape, and it is recorded
 * where it was found.
 *
 * ⇒ THE LENGTH IS THE **SHORTEST** ONE THAT COMPLETES THE SEALED COLUMNS,
 * which is also the one with the LARGEST post-tape margin — the two are the
 * same number here because every event after the seal is one the tape does not
 * want. It is SEARCHED upward from the press tick, and the margin it buys is
 * MEASURED on both arms and asserted to clear the poller's own window with
 * room to spare. Measured: the seal completes at 42 ticks and the margins are
 * 18 (press) and 19 (control) against a ~8-frame poll.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r9-l6-harmless-window.mjs
 *   node scripts/procgen/plan-seedling-r9-l6-harmless-window.mjs --check
 *
 * Then record (the game is the only oracle — ⚖ ruling 16, announced first):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r9-l6-harmless-press
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r9-l6-harmless-control
 *
 * ⚠ AND THE DIFFERENTIAL IS NOT THE CLAIM (trap 564). A green `--win --record`
 * says the PLAYER walked where the model said. The BODY's column — its
 * position, its `hits`, and above all its `hits_timer` — is asked of the game
 * through `--mobiles` by the probe named above. The table this script prints is
 * what that probe is diffed against.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { ENEMY_HITS_TIMER } = await import(join(MODULE, 'presses.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const PRESS_NAME = 'r9-l6-harmless-press';
const CONTROL_NAME = 'r9-l6-harmless-control';
/** `r9-l6-bob-press`'s own boot — L6, sword in hand, `bob@112,48` to the east. */
const BOOT = Object.freeze({ level: 6, x: 80, y: 48 });
const TARGET = 'bob@112,48';
/**
 * ⛓ THE ONE TICK THE TWO ARMS DIFFER BY. Early enough that the swing lands
 * while the bob is still walking in — the press's own five hit ticks are
 * T+1..T+5 and the body has to be inside the rect on one of them — and late
 * enough that the player has the velocity `set slashing` reads. Asserted
 * below rather than argued: the press LANDS, and it lands at T+1.
 */
const PRESS_TICK = 10;

const levelSource = atlasLevelSource();
const newRun = () => createLevelRun({
    levelSource,
    boot: { ...BOOT },
    noclip: false,
    noHazards: [],
    /**
     * ⚠ FALSE, and it has to be — `r9-l6-bob-press`'s own note. Under
     * `noDamage` the run steps no chaser at all, so there would be no body to
     * strike, no contact to suppress and no hit for the control to take: the
     * pair would witness an empty room.
     */
    noDamage: false,
    grants: [],
    persistence: [],
    despawn: [],
    equips: [],
    pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null,
    seam: { items: { hasSword: true } },
    roles: ROLES,
});

const RIGHT = new Set(['right']);
/**
 * ⛔ THE PRESS ARM ADDS `primary` TO THE KEYS IT WAS ALREADY HOLDING, it does
 * not replace them. The two arms must differ by the PRESS and by nothing else;
 * a tick that dropped `right` would differ by a step as well, and the walk is
 * what carries the player into the body.
 */
const PRESSED = new Set(['right', 'primary']);
const keysFor = (withPress) => (t) => (withPress && t === PRESS_TICK ? PRESSED : RIGHT);

const drive = (withPress, ticks) => {
    const run = newRun();
    const held = [];
    const track = [];
    const keys = keysFor(withPress);
    for (let t = 0; t < ticks; t += 1) {
        const h = keys(t);
        held.push(h);
        run.advance(h);
        const c = run.chasers.find((x) => x.id === TARGET) ?? null;
        track.push(c ? { x: c.x, y: c.y, hits: c.hits, hitsTimer: c.hitsTimer } : null);
        if (run.playerDeaths.length > 0) break;
    }
    return { run, held, track };
};

/**
 * ⛓⛓ THE LENGTH, SEARCHED — and the search is for the SHORTEST walk that
 * completes the sealed columns, not the longest one that survives them. See
 * the header: every tick past the seal is a tick of margin given away to the
 * poller, and the first cut of this file gave away all of it.
 */
const SEARCH_CEILING = 400;
const sealHolds = (run) => {
    const sup = run.contactsSuppressed.filter((c) => c.why === 'enemy hitsTimer');
    return { hits: run.playerHits.length, sup };
};
const sealComplete = (L) => {
    const p = sealHolds(drive(true, L).run);
    const c = sealHolds(drive(false, L).run);
    return p.hits === 0 && p.sup.length === 10
        && p.sup[0].t === 32 && p.sup[9].t === 41
        && c.hits === 2 && c.sup.length === 0;
};
const TICKS = (() => {
    for (let L = PRESS_TICK + 1; L < SEARCH_CEILING; L += 1) if (sealComplete(L)) return L;
    return -1;
})();
check('⛓ the walk\'s length is SEARCHED — the SHORTEST walk that completes the '
    + 'sealed columns, because every tick past them is margin given away',
    TICKS > PRESS_TICK && TICKS < SEARCH_CEILING,
    `${TICKS} tick(s), found by scanning up from ${PRESS_TICK + 1}`);
check('⛔ …and one tick SHORTER does not complete them, so the number is a boundary '
    + 'and not a preference',
    TICKS > 0 && !sealComplete(TICKS - 1),
    `${TICKS - 1} ticks does not seal`);

/**
 * ⛓⛓⛓ THE POST-TAPE MARGIN, MEASURED ON BOTH ARMS — the thing the first
 * derivation had none of.
 *
 * `seedling-bot-replay-win.py:69` polls `botStatus` every `POLL_SEC` and the
 * engine runs at `FP.assignedFrameRate` (30 — `combatVerbs.animCompleteTicks`'s
 * own default, and the rate the recording of this very tape measured at 29.93
 * fps), so the status the differential compares against the model's terminal
 * counters is read up to `POLL_FRAMES` engine frames after the tape's last
 * observation, with the tape's last keys STILL HELD. The margin is how many of
 * those frames each arm can spend before its own `hits` moves.
 */
const POLL_SEC = 0.25;
const ENGINE_FPS = 30;
const POLL_FRAMES = Math.ceil(POLL_SEC * ENGINE_FPS);
const marginOf = (withPress) => {
    const run = newRun();
    const keys = keysFor(withPress);
    for (let t = 0; t < TICKS; t += 1) run.advance(keys(t));
    const at = run.playerHits.length;
    const last = keys(TICKS - 1);
    for (let m = 0; m < 4 * POLL_FRAMES; m += 1) {
        run.advance(last);
        if (run.playerHits.length !== at) return m;
    }
    return 4 * POLL_FRAMES;
};
const MARGIN = { press: marginOf(true), control: marginOf(false) };
check(`⛓⛓⛓ BOTH ARMS CLEAR THE POLLER'S OWN WINDOW — the status the differential `
    + `reads lands up to ${POLL_FRAMES} frame(s) past the tape, and each arm's `
    + `\`hits\` is unmoved for at least twice that`,
    MARGIN.press >= 2 * POLL_FRAMES && MARGIN.control >= 2 * POLL_FRAMES,
    `press ${MARGIN.press}, control ${MARGIN.control}, against ${POLL_FRAMES} `
    + `(= ${POLL_SEC}s x ${ENGINE_FPS}fps) and a requirement of ${2 * POLL_FRAMES}`);

const press = drive(true, TICKS);
const control = drive(false, TICKS);

const suppressionsOf = (run) => run.contactsSuppressed
    .filter((c) => c.why === 'enemy hitsTimer');

// ── ⛔⛔⛔ THE SEALED COLUMNS — §29.10 item 4, VERBATIM ─────────────────
const pressSup = suppressionsOf(press.run);
const controlSup = suppressionsOf(control.run);

check('⛓⛓⛓ THE PRESS ARM TAKES ZERO PLAYER HITS while walking through the body '
    + 'it has just knocked',
    press.run.playerHits.length === 0 && press.run.playerDeaths.length === 0,
    `${press.run.playerHits.length} hit(s), ${press.run.playerDeaths.length} death(s)`);
check('⛓⛓⛓ …and TEN ticks of contact are suppressed by the ENEMY\'s own i-frame, '
    + 't = 32..41, all `bob@112,48`',
    pressSup.length === 10
        && JSON.stringify(pressSup.map((c) => c.t)) === '[32,33,34,35,36,37,38,39,40,41]'
        && pressSup.every((c) => c.id === TARGET),
    JSON.stringify({ n: pressSup.length, t: pressSup.map((c) => c.t),
        ids: [...new Set(pressSup.map((c) => c.id))] }));
check('⛔⛔ THE CONTROL — the identical walk WITHOUT that one press — is hit TWICE '
    + 'by that same bob',
    control.run.playerHits.length === 2
        && control.run.playerHits.every((h) => h.id === TARGET && h.source === 'chaser'),
    JSON.stringify(control.run.playerHits.map((h) => ({ t: h.t, id: h.id, src: h.source }))));
check('⛔⛔ …and it suppresses NOTHING, because nothing ever armed a timer',
    controlSup.length === 0, `${controlSup.length} suppression(s)`);

// ── ⛓ THE PAIR IS A PAIR: one press, and nothing else, separates them ──
check('⛓⛓ the two arms differ by EXACTLY ONE TICK\'s keys, and that tick is the press',
    press.held.length === control.held.length
        && press.held.every((h, i) => (i === PRESS_TICK
            ? ([...h].sort().join('+') === 'primary+right'
                && [...control.held[i]].sort().join('+') === 'right')
            : [...h].sort().join('+') === [...control.held[i]].sort().join('+'))),
    `${press.held.length} tick(s), the only difference at ${PRESS_TICK}`);

// ── ⛓⛓⛓ THE CLOCK, WHICH IS WHAT SLICE 12c‴'s SKEW CURE CALIBRATES AGAINST ──
const landed = press.run.chaserPressHits.filter((h) => h.landed);
check('⛓⛓⛓ THE PRESS IS AT TICK 10 AND THE THRUST LANDS AT TICK 11 — press + 1, '
    + 'which is `pendingThrust` applied at the TOP of the following tick',
    press.run.slashPresses.length === 1
        && press.run.slashPresses[0].t === PRESS_TICK
        && press.run.slashPresses[0].outcome === 'slash'
        && landed.length === 1
        && landed[0].t === PRESS_TICK + 1,
    JSON.stringify({ press: press.run.slashPresses.map((p) => ({ t: p.t, o: p.outcome })),
        landed: landed.map((h) => ({ t: h.t, hitsTimer: h.hitsTimer })) }));
/**
 * ⛓ THE WHOLE DECAY, AS AN ARITHMETIC THE GAME CAN BE ASKED. `track[k]` is the
 * body's state at the END of advance index `k`, and the hit lands at index
 * `PRESS_TICK + 1`, so the timer reads `ENEMY_HITS_TIMER - (k - (PRESS_TICK+1))`
 * from there until it reaches 0. The probe inverts exactly this relation on the
 * game's own `hits_timer` and `tick`.
 */
const HIT_INDEX = PRESS_TICK + 1;
const decay = [];
for (let k = HIT_INDEX; k < TICKS; k += 1) {
    const want = Math.max(0, ENEMY_HITS_TIMER - (k - HIT_INDEX));
    decay.push({ k, want, got: press.track[k]?.hitsTimer ?? null });
}
check(`⛓⛓ the body's i-frame DRAINS ONE PER TICK from ${ENEMY_HITS_TIMER} at index `
    + `${HIT_INDEX} — the relation the probe inverts on the game's own readout`,
    decay.every((r) => r.got === r.want),
    `${decay.filter((r) => r.got === r.want).length}/${decay.length} indices agree; `
    + `first disagreement ${JSON.stringify(decay.find((r) => r.got !== r.want) ?? null)}`);
check('⛓ ONE hit and no kill — the pair is about the WINDOW, not about a death',
    press.run.chaserKills.length === 0 && press.track[TICKS - 1] !== null
        && press.track[TICKS - 1].hits === 1,
    `hits ${press.track[TICKS - 1]?.hits}, kills ${press.run.chaserKills.length}`);

const tapeOf = (name, held, why) => {
    const folded = buildTape(held, BOOT, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return {
        game: 'seedling',
        name,
        boot: { ...BOOT },
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        equips: [],
        pins: ['dead_frames'],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false },
        seam: { items: { hasSword: true } },
        tick_count: held.length,
        inputs: folded.inputs,
        tape_version: 8,
        why,
    };
};

const SHARED = '⛓⛓⛓ R9 SLICE 12c‴, ⚖ RULING 44(b) — ONE HALF OF THE HARMLESS-WINDOW '
    + 'WITNESS PAIR (user licence, 2026-08-24). Two tapes from L6\'s `r9-l6-bob-press` '
    + 'boot with IDENTICAL held keys, differing by exactly ONE `primary` at tick '
    + `${PRESS_TICK}. \`Enemy.hitPlayer\` (\`Enemies/Enemy.as:211\`) gates the `
    + 'player-damaging contact on the ENEMY\'s own `hitsTimer`, so a struck body is '
    + `harmless for its whole ${ENEMY_HITS_TIMER}-tick i-frame while it keeps steering, `
    + 'and `"Enemy"` is not in `Mobile.solids` so the player walks straight through it. '
    + 'Slice 12c″ taught the PLANNER that window and §29.7 then measured that ZERO of '
    + 'the 146 committed tapes had ever exercised it — the model was agreeing with '
    + 'itself. This pair asks the GAME. ';

const description = {
    [PRESS_NAME]: `${SHARED}⛓ THE PRESS ARM: the swing lands on ${TARGET} at tick `
        + `${PRESS_TICK + 1} (press + 1 — \`pendingThrust\` fires at the TOP of the `
        + `following tick), arms the ${ENEMY_HITS_TIMER}-tick timer, and the player then `
        + `walks THROUGH the body taking ZERO hits, with ${pressSup.length} ticks of `
        + `contact suppressed by that timer (t = ${pressSup[0]?.t}..`
        + `${pressSup[pressSup.length - 1]?.t}). ⛓ The walk\'s length (${TICKS} ticks) is `
        + 'SEARCHED, not chosen: it stops one tick before this arm\'s first player hit, '
        + 'which is `sandtrap@160,48` at the corridor\'s end and has nothing to do with '
        + 'the bob. ⚠ The differential carries the PLAYER\'s column only (trap 564); the '
        + 'BODY\'s — position, `hits`, and the `hits_timer` that settles WHICH TICK the '
        + 'hit landed on — is asked of the game by '
        + 'scripts/procgen/probe-seedling-r9-harmless-window-mobiles.mjs. Authored by '
        + 'scripts/procgen/plan-seedling-r9-l6-harmless-window.mjs.',
    [CONTROL_NAME]: `${SHARED}⛔ THE CONTROL ARM: the identical walk with the press `
        + `REMOVED. Nothing arms a timer, nothing is suppressed, and the same `
        + `${TARGET} hits the player TWICE. One press turns ten ticks of body contact `
        + 'into ten ticks of nothing — that difference IS ⚖ ruling 44(b), and a single '
        + 'tape could not state it: a walk that takes no hits proves nothing about WHY. '
        + 'Authored by scripts/procgen/plan-seedling-r9-l6-harmless-window.mjs.',
};

const tapeJson = (obj) => {
    const { why, ...rest } = obj;
    const d = description[obj.name];
    const parsed = parseTape({ ...rest, description: d });
    return `${JSON.stringify({ ...parsed, description: d, note: '' }, null, 4)}\n`;
};

const written = [];
for (const [name, held] of [[PRESS_NAME, press.held], [CONTROL_NAME, control.held]]) {
    const path = join(TAPES, `${name}.json`);
    const json = tapeJson(tapeOf(name, held));
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${name} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        written.push(path.slice(REPO.length + 1));
    }
}
if (written.length) console.log(`\nwrote ${written.join('\n      ')}`);

console.log(`\n## THE PAIR, ${TICKS} ticks each, differing by ONE press at tick ${PRESS_TICK}`);
console.log(`   ${PRESS_NAME}  : ${press.run.playerHits.length} player hit(s), `
    + `${pressSup.length} \`enemy hitsTimer\` suppression(s) `
    + `(t = ${pressSup.map((c) => c.t).join(',')}), all ${TARGET}`);
console.log(`   ${CONTROL_NAME}: ${control.run.playerHits.length} player hit(s) from `
    + `${TARGET} (t = ${control.run.playerHits.map((h) => h.t).join(',')}), `
    + `${controlSup.length} suppression(s)`);
console.log(`\n## THE CLOCK the \`--mobiles\` probe inverts: press at ${PRESS_TICK}, `
    + `thrust at ${HIT_INDEX}, \`hitsTimer\` ${ENEMY_HITS_TIMER} at index ${HIT_INDEX} `
    + `and ${ENEMY_HITS_TIMER} - (k - ${HIT_INDEX}) after it`);
if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
