/**
 * ⛓⛓⛓ R9 SLICE 12b — **THE SWORD DASH'S DRIVEN WITNESS.**
 *
 * ⚖ Ruling 31(a) is the user's own condition on the dash: *"the dash is
 * TRANSCRIBED into the player physics and verified against the game (a driven
 * dash witness — two presses inside 20 ticks, the displacement digit for
 * digit — before any solver relies on it)"*. This is that witness, and it is
 * REQUIRED rather than a confirmation, for a reason slice 12b measured:
 *
 * ⛔⛔ **THE COMMITTED ROSTER CANNOT SEE THE DASH AT ALL.** Kickoff §22.9
 * derived an "8-tape free oracle" from tape INPUTS — 41 tapes hold a `primary`
 * pair inside `SLASH_TIMER_MAX`, which reproduces exactly. Carried through the
 * RUN, all 41 die on one of three filters: 640 `primary` entries -> 374 survive
 * `acting` (`lockSnap | frozenTimer | cutsceneWalk`) -> 149 have a sword in the
 * primary slot -> and all 149 are ORDINARY swings. Zero dashes, zero swallowed
 * presses. `r5-bobboss-arm`, named there as the sharpest instrument at 72
 * presses, holds no sword — its own committed description says "no tap can be
 * a swing". So the roster is a REGRESSION witness and the game is the only
 * oracle this mechanism has.
 *
 * ── WHAT THE TAPE ASKS THE GAME, IN THE ORDER IT ASKS ─────────────────
 *
 * A flat westward-to-eastward corridor in L0, sword in hand, `right` held for
 * the whole run so every press lands on a MOVING player — the impulse is the
 * claim and at rest it is exactly zero (`point_normalize` no-ops at zero
 * length), which is why four of §22.9's eight would have been blind to it even
 * had they fired.
 *
 *   T+0   ORDINARY SWING — `slashTimer` <- 20.
 *   T+2   **DASH 1**. `knockback(2, Point(x - v.x, y - v.y))` = +2 along
 *         travel. ⚠ k = 2 and not k = 1 because `Input.pressed` is a RISING
 *         EDGE: a press costs two ticks of the key, so consecutive presses do
 *         not exist for any controller.
 *   T+4   **SWALLOWED** — inside dash 1's animation, `slashDashed` up and
 *         `_slashing` up, so both arms of `set slashing` are refused and there
 *         is no else. It must cost NOTHING: no impulse, no window, no timer
 *         write.
 *   T+8   **DASH 2** — proof that `slashDashed` is cleared by `slashEnd`, the
 *         ANIMATION-COMPLETE callback, and not by a timer. The re-arm period
 *         is the animation (5 ticks) PLUS ONE, because `slashEnd` fires from
 *         `sprites()`, BELOW `input()`.
 *   T+14  **DASH 3**.
 *   T+20  **ORDINARY SWING AGAIN** — and this one is the discriminator. The
 *         dash does NOT refresh `slashTimer` (only the `else if` writes 20),
 *         so the window measured from T+0 has run out and this press is a
 *         plain swing with NO displacement. A model that refreshed the timer
 *         on a dash would still read 6 ticks of window here and would DASH,
 *         moving the player 2 px the game does not move them.
 *
 * ⇒ four claims, one tape: (i) the impulse and its −0.25/tick decay, (ii)
 * `slashEnd`'s tick, (iii) the non-refresh of `slashTimer`, (iv) the
 * anim-complete re-arm. (iii) is the only fixture anywhere that can kill the
 * "refreshed timer" mutant.
 *
 * ⛓ THE PLAYER-SIDE EXPECTATION IS THE RIGHT ORACLE HERE, WHICH IS TRAP 564
 * INVERTED. Slice 12 learned that a green `--win --record` says almost nothing
 * about an ENEMY, because the expectation carries the PLAYER's positions. This
 * claim IS the player's own displacement, so the differential's own stream is
 * exactly the instrument — no `--mobiles` probe needed, and saying so is the
 * other half of that lesson.
 *
 * ⛓ THE ARITHMETIC HAS A PRIOR GAME WITNESS. `r5Totem.controlRefutation`
 * measured the game's deltas decaying by exactly −0.25/tick from 2.20, where
 * 2.20 = 0.20 of coasting plus 2.00 of knockback (`r5-l43-wand-control`, R5
 * slice 23). The same impulse, arrived at from the other end.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r9-l0-sword-dash.mjs
 *   node scripts/procgen/plan-seedling-r9-l0-sword-dash.mjs --check
 *
 * Then record (the game is the only oracle):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r9-l0-sword-dash
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
// ⛓ R9 slice 12e″: the from-rest claim is `WALK_SPEED + SLASH_DASH_FORCE`, and
// the walk half is the game's own `moveSpeeds[0]` rather than a typed 0.8.
const { WALK_SPEED } = await import(join(MODULE, 'playerPhysicsV1.js'));
const {
    DASH_CHAIN, SLASH_ANIM_DASH, SLASH_ANIM_TICKS, SLASH_DASH_FORCE, SLASH_TIMER_MAX,
} = await import(join(MODULE, 'combatVerbs.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const NAME = 'r9-l0-sword-dash';
/**
 * ⛓ THE ROOM IS DERIVED, NOT PICKED. A sweep of every 16 px cell of eleven
 * chaser-free rooms, in both horizontal directions, for the longest run that
 * takes no wall, no transition and no hit in 70 ticks: L0's southern corridor
 * tops it at 81.85 px, and this cell walks 81.50 px over the tape's own length
 * with clearance to spare. The dash needs open ground precisely because it
 * MOVES the player — a witness that ran into a wall would pin x and lose the
 * claim on the tick it mattered.
 */
const BOOT = Object.freeze({ level: 0, x: 176, y: 208 });

const levelSource = atlasLevelSource();
const run = createLevelRun({
    levelSource,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    // ⚠ Nothing in this room can damage the player, so the flag is false to
    // keep the run HONEST rather than to survive anything: under `noDamage`
    // the run relaxes census work this tape has no need of either way, and a
    // witness that had to be protected would be a witness about the shield.
    noDamage: false,
    grants: [],
    persistence: [],
    despawn: [],
    equips: [],
    pins: [...PIN_NAMES],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null,
    // A sword is what a press needs; the rest of the campaign is irrelevant.
    seam: { items: { hasSword: true } },
    roles: ROLES,
});

const EAST = new Set(['right']);
const EAST_PRESS = new Set(['right', 'primary']);
const perTick = [];
/** The player's own centre at tick 0 — `BOOT` is the TILE, 8 px to its west. */
const startX = run.state.x;
/** …and its centre on the other axis, which a dash along travel must not move. */
const startY = run.state.y;

/**
 * ⛓ THE WARM-UP IS DERIVED FROM THE WALK, NOT CHOSEN. `right` is held until
 * `vx` stops RISING — the top of `Player.input`'s acceleration ramp, which is
 * a property of the controller rather than a number picked to look tidy. The
 * dash's claim is an impulse ON a moving player; landing it mid-ramp would
 * still be correct and would be harder to read.
 */
let opening = 0;
for (let t = 0; t < 40; t += 1) {
    const before = run.state.vx;
    perTick.push(EAST);
    run.advance(EAST);
    if (run.state.vx <= before) { opening = perTick.length; break; }
}

/**
 * ⛓⛓ THE PRESS SCHEDULE IS `DASH_CHAIN`'s, PLUS TWO PRESSES THAT MUST DO
 * NOTHING. `combatVerbs.DASH_CHAIN` derives the offsets by running the
 * transcription under a controller's own rules (the rising edge, and
 * `slashEnd` firing below the press); this tape drives exactly them, so the
 * fixture and the constant cannot disagree about what the chain IS.
 */
const SWALLOW_AT = DASH_CHAIN.swallowed[0];
const DISCRIMINATOR_AT = SLASH_TIMER_MAX;
const PRESS_OFFSETS = [0, ...DASH_CHAIN.at, SWALLOW_AT, DISCRIMINATOR_AT]
    .sort((a, b) => a - b);
const pressTicks = new Set(PRESS_OFFSETS.map((k) => opening + k));
/**
 * ⛓ A TAIL LONG ENOUGH TO SPEND THE LAST SWING AND WATCH THE DECAY LAND. The
 * −0.25/tick decay from a +2 impulse takes eight ticks to be reabsorbed, and
 * the last press's own animation is five; the tape must outlive both or the
 * arithmetic is only half observed.
 */
const TAIL = Math.ceil(SLASH_DASH_FORCE / 0.25) + SLASH_ANIM_TICKS[SLASH_ANIM_DASH];
const LAST = opening + DISCRIMINATOR_AT + TAIL;

const trace = [];
for (let t = perTick.length; t <= LAST; t += 1) {
    const held = pressTicks.has(t) ? EAST_PRESS : EAST;
    const before = { x: run.state.x, vx: run.state.vx };
    perTick.push(held);
    const r = run.advance(held);
    trace.push({ t, before, x: run.state.x, vx: run.state.vx, press: pressTicks.has(t) });
    if (r.transition) throw new Error(`${NAME}: the run crossed to level `
        + `${r.transition.to_level} at tick ${t}. The witness must stay in one room.`);
}

const rows = run.slashPresses;
const dashRows = rows.filter((p) => p.outcome === 'dash');
const at = (k) => rows.find((p) => p.t === opening + k);
const deltaAt = (t) => {
    const row = trace.find((r) => r.t === t);
    return row ? row.x - row.before.x : null;
};

check('⛓⛓⛓ the schedule is `DASH_CHAIN`\'s own — three dashes, and the game '
    + 'has never been asked about any of them',
    dashRows.length === DASH_CHAIN.max
        && JSON.stringify(dashRows.map((p) => p.t - opening)) === JSON.stringify([...DASH_CHAIN.at]),
    `dashes at k = ${dashRows.map((p) => p.t - opening).join(', ')} `
    + `(DASH_CHAIN.at = ${DASH_CHAIN.at.join(', ')})`);
check('⛓ the opening press is an ORDINARY swing',
    at(0)?.outcome === 'slash', `outcome = ${at(0)?.outcome}`);
/**
 * ⛓ R9 SLICE 12e″ — RE-STATED, AND THE CLAIM IS NOW SPLIT WHERE THE MODEL
 * SPLITS IT. `set slashing` names the FORCE and refuses the direction, because
 * the direction is the velocity `useItem` reads — below this tick's movement
 * arms — and the setter runs above the step. So the SETTER's row asserts the
 * magnitude, and the direction is asserted by the DISPLACEMENT rows below: a
 * dash that pointed anywhere but along travel would not show a +2-minus-
 * friction jump in x followed by a −0.25/tick decay, and this corridor's `y`
 * never moves at all.
 */
check(`⛓⛓ each dash names ${SLASH_DASH_FORCE} and NO direction — the impulse is `
    + 'DEFERRED to the velocity `useItem` reads',
    dashRows.every((p) => p.impulse.force === SLASH_DASH_FORCE
        && p.impulse.dvx === undefined && p.impulse.dvy === undefined),
    JSON.stringify(dashRows.map((p) => p.impulse)));
check('⛓ …and the player never leaves the corridor\'s own line — every dash '
    + 'resolved ALONG TRAVEL and NOTHING across it',
    run.state.y === startY,
    `y ${startY} -> ${run.state.y} over ${perTick.length} ticks`);
check('⛔ the press inside a dash\'s own animation is SWALLOWED, and costs nothing',
    at(SWALLOW_AT)?.outcome === 'swallowed' && at(SWALLOW_AT)?.impulse === null,
    `k = ${SWALLOW_AT}: outcome ${at(SWALLOW_AT)?.outcome}, impulse `
    + `${JSON.stringify(at(SWALLOW_AT)?.impulse)}`);
check('⛔⛔ the press at k = SLASH_TIMER_MAX is an ORDINARY SWING — the dash '
    + 'did NOT refresh the timer',
    at(DISCRIMINATOR_AT)?.outcome === 'slash' && at(DISCRIMINATOR_AT)?.impulse === null,
    `k = ${DISCRIMINATOR_AT}: outcome ${at(DISCRIMINATOR_AT)?.outcome}. A model that `
    + 'refreshed `slashTimer` on a dash would read a live window here and DASH.');
/**
 * ⛓⛓⛓ THE DISPLACEMENT CLAIM IS THE DECAY, NOT THE JUMP — and the first cut of
 * this check got it wrong in a way worth keeping.
 *
 * It asserted the dashed tick's step exceeded the previous one by
 * `SLASH_DASH_FORCE`. It does not: it exceeds it by 1.75, because
 * `Mobile.friction` (0.25) runs BEFORE `input()` and therefore before the
 * impulse, so the tick spends a quarter pixel on its way to gaining two. The
 * jump is the impulse MINUS one tick of friction, which is an arithmetic
 * accident of where the two live rather than a statement about the dash.
 *
 * What IS the dash's own signature — and what the GAME can be asked about
 * without knowing anything about `set slashing` — is the decay that follows:
 * the player is above `moveSpeed`, so `input()`'s `if (v.x < moveSpeed)` adds
 * nothing and friction alone runs the velocity down by EXACTLY 0.25 a tick
 * until the floor catches it. That is `r5Totem.controlRefutation`'s measured
 * shape (−0.25/tick from 2.20 = 0.20 coasting + 2.00 knockback), reached from
 * the other end.
 */
const FRICTION = 0.25;
check(`⛓⛓⛓ each dash is followed by a run of steps decaying by EXACTLY `
    + `${FRICTION} px/tick — the game-checkable signature`,
    dashRows.every((p) => {
        for (let i = 1; i <= 4; i += 1) {
            const d = deltaAt(p.t + i - 1);
            const next = deltaAt(p.t + i);
            if (d === null || next === null) return false;
            if (Math.abs((d - next) - FRICTION) > 1e-9) return false;
        }
        return true;
    }),
    dashRows.map((p) => `t${p.t}: `
        + [0, 1, 2, 3, 4].map((i) => deltaAt(p.t + i)?.toFixed(3)).join(' ')).join(' | '));
check(`⛓ …and the impulse itself is the jump PLUS the friction that preceded it`,
    dashRows.every((p) => Math.abs((deltaAt(p.t) - deltaAt(p.t - 1))
        - (SLASH_DASH_FORCE - FRICTION)) < 1e-9),
    dashRows.map((p) => `t${p.t}: ${(deltaAt(p.t) - deltaAt(p.t - 1)).toFixed(3)} `
        + `= ${SLASH_DASH_FORCE} - ${FRICTION}`).join('; '));
check('⛔ the corridor stayed OPEN — no wall pinned the claim',
    trace.every((r) => r.x !== r.before.x || r.before.vx === 0),
    // ⚠ From the player's own STARTING CENTRE, not from `BOOT.x`: a boot is a
    // tile coordinate and the constructor centres the player 8 px into it, so
    // differencing against `BOOT.x` overstates the travel by exactly that.
    `travelled ${(run.state.x - startX).toFixed(2)} px from x ${startX}`);
check('⛔ the player took no hits and never left the room',
    run.playerHits.length === 0 && run.playerDeaths.length === 0
        && run.transitions.length === 0,
    `${run.playerHits.length} hit(s), ${run.transitions.length} transition(s)`);

const folded = buildTape(perTick, BOOT, NAME,
    { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = {
    game: 'seedling',
    name: NAME,
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
    seam: { items: { hasSword: true } },
    tick_count: perTick.length,
    inputs: folded.inputs,
    tape_version: 8,
};

const description = '⛓⛓⛓ R9 SLICE 12b — THE SWORD DASH\'S DRIVEN WITNESS, and the '
    + 'dash has no other one: the committed roster CANNOT reach the branch. Kickoff '
    + '§22.9 derived an "8-tape free oracle" from tape INPUTS (41 tapes hold a `primary` '
    + 'pair inside `SLASH_TIMER_MAX` — which reproduces); carried through the RUN all 41 '
    + 'die on one of three filters — 640 entries -> 374 survive `acting` -> 149 hold a '
    + 'sword -> 149 ORDINARY swings, zero dashes. So the game is the only oracle. The '
    + 'player holds `right` down a clear L0 corridor (DERIVED as the longest hit-free '
    + 'straight run over eleven chaser-free rooms) so every press lands on a MOVING '
    + 'player — at rest the impulse is exactly zero, `point_normalize` being a no-op at '
    + `zero length. The schedule is \`combatVerbs.DASH_CHAIN\`'s own: an ordinary swing, `
    + `then DASHES at k = ${DASH_CHAIN.at.join('/')} (k=2 and not k=1 because `
    + '`Input.pressed` is a RISING EDGE and a press costs two ticks of the key), a press '
    + `at k = ${SWALLOW_AT} that must be SWALLOWED WHOLE (inside a dash's animation both `
    + 'arms of `set slashing` are refused and there is no else), and a press at '
    + `k = ${SLASH_TIMER_MAX} that must be an ORDINARY SWING — the discriminator, because `
    + 'the dash does NOT refresh `slashTimer` and a model that thought it did would dash '
    + 'here and move the player 2 px the game does not. Four claims: the impulse and its '
    + '−0.25/tick decay, `slashEnd`\'s tick, the non-refresh, and the anim-complete '
    + 're-arm (`slashDashed` is cleared by the Spritemap callback, and the re-arm period '
    + 'is the animation PLUS ONE because `slashEnd` fires from `sprites()`, below '
    + '`input()`). ⛓ The player-side expectation IS the right oracle here — trap 564 '
    + 'inverted: the claim is the PLAYER\'s own displacement. Prior game witness for the '
    + 'arithmetic: `r5Totem.controlRefutation`, −0.25/tick from 2.20 = 0.20 coasting + '
    + '2.00 knockback. Authored by scripts/procgen/plan-seedling-r9-l0-sword-dash.mjs.';

function tapeJson(obj, note = description) {
    const parsed = parseTape({ ...obj, description: note });
    return `${JSON.stringify({ ...parsed, description: note, note: '' }, null, 4)}\n`;
}

const path = join(TAPES, `${NAME}.json`);
const json = tapeJson(tape);
if (CHECK) {
    const same = existsSync(path) && readFileSync(path, 'utf8') === json;
    check('⛓ the committed tape is what this script produces today', same,
        same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
} else {
    writeFileSync(path, json);
    console.log(`\nwrote ${path.slice(REPO.length + 1)}`);
}

console.log(`\n## ${NAME}: ${perTick.length} ticks, opening press at ${opening}, `
    + `${dashRows.length} dash(es) at k = ${dashRows.map((p) => p.t - opening).join('/')}, `
    + `${rows.filter((p) => p.outcome === 'swallowed').length} swallowed, `
    + `travel ${(run.state.x - startX).toFixed(2)} px`);
console.log('\n## THE SEALED TRAJECTORY — the model\'s per-tick answer, before the game sees it');
for (const r of trace) {
    const row = rows.find((p) => p.t === r.t);
    console.log(`  t=${String(r.t).padStart(3)}${row ? ` ${row.outcome.toUpperCase().padEnd(9)}` : '          '}`
        + ` x ${r.before.x.toFixed(3)} -> ${r.x.toFixed(3)}  (d ${(r.x - r.before.x).toFixed(3)})`
        + `  vx ${r.vx.toFixed(3)}`);
}

// ══════════════════════════════════════════════════════════════════════
//  ⛓⛓⛓ R9 SLICE 12e″ — THE SECOND WITNESS: THE DASH FROM A STANDSTILL
//  (⚖ ruling 50, LICENSED by the user 2026-08-25)
// ══════════════════════════════════════════════════════════════════════
/**
 * ⛔⛔⛔ **THE TAPE ABOVE CANNOT ASK THIS QUESTION, AND THAT IS WHY IT
 * EXISTS.** `r9-l0-sword-dash` holds `right` for its whole run so every press
 * lands on a MOVING player — deliberately, because the impulse was the claim
 * and at zero length `point_normalize` no-ops. R9 slice 12e′ then measured
 * what that blind spot cost: on `r9-solve-3`'s 151-tick re-solve the GAME
 * bought **2.80 px** on t=114 where the model bought **0.80**, and 37 ticks
 * later the two were in different rooms. The mechanism is a WITHIN-TICK
 * ORDERING — `useItem(Main.primary)` is `Player.input()`'s LAST act, below
 * the movement arms that have already written `v` — so a dash pressed at rest
 * with a direction key STARTING that tick is worth `SLASH_DASH_FORCE` in
 * full, and the model was reading the velocity the tick started with.
 *
 * ── WHAT THIS TAPE ASKS THE GAME, AND IT IS TWO QUESTIONS ONE KEY APART ──
 *
 *   k = 0                   ORDINARY SWING at a standstill, no direction key.
 *                           It opens the 20-tick window and must move nothing.
 *   k = DASH_CHAIN.at[0]    **THE CLAIM.** A DASH press with the direction key
 *                           STARTING on that same tick, from a dead stop. The
 *                           game's `v` is already `(+moveSpeed, 0)` when
 *                           `useItem` reads it, so the impulse points EAST and
 *                           the tick moves `moveSpeed + SLASH_DASH_FORCE`.
 *   (the key is released immediately) — so what follows is the impulse's own
 *                           −0.25/tick decay with nothing else in it.
 *   the standstill          DERIVED, not counted: hold nothing until `vx` is
 *                           back to exactly 0.
 *   the second DASH         **THE CONTROL.** The first `DASH_CHAIN` offset at
 *                           or after that standstill which still sits inside
 *                           `slashTimer` — pressed with NO direction key. Here
 *                           `v` really is (0,0) when `useItem` reads it, both
 *                           of `knockback`'s guards reject, and the game moves
 *                           the player by NOTHING.
 *
 * ⇒ the two presses differ by ONE KEY and by 2 px. A model that reads the
 * pre-key velocity pays nothing for BOTH; a model that pays for both has
 * broken the zero-length no-op. Only the game's own answer separates them,
 * which is why this tape is licensed and driven rather than reasoned about.
 */
const REST_NAME = 'r9-l0-sword-dash-rest';
/**
 * ⛓ THE SAME DERIVED CORRIDOR, from its western end. The room is the one the
 * sweep at the top of this file chose (L0's southern corridor, the longest
 * hit-free straight run over eleven chaser-free rooms); this witness needs far
 * less of it — one dash is 9 px — so it boots on the same tile and walks the
 * same line, and the corridor claim above covers it a fortiori.
 */
const REST_BOOT = BOOT;
const restRun = createLevelRun({
    levelSource,
    boot: REST_BOOT,
    noclip: false,
    noHazards: [],
    noDamage: false,
    grants: [],
    persistence: [],
    despawn: [],
    equips: [],
    pins: [...PIN_NAMES],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: null,
    seam: { items: { hasSword: true } },
    roles: ROLES,
});
const REST_START = { x: restRun.state.x, y: restRun.state.y };
const restHeld = [];
const restTrace = [];
const restStep = (held) => {
    const before = { x: restRun.state.x, y: restRun.state.y, vx: restRun.state.vx };
    restHeld.push(held);
    restRun.advance(held);
    restTrace.push({ t: restHeld.length - 1, before, x: restRun.state.x,
        y: restRun.state.y, vx: restRun.state.vx, held: [...held].sort().join('+') || '-' });
};
const NO_KEYS = new Set();
const DASH_AT = DASH_CHAIN.at[0];
// k = 0 the opening swing; then nothing until the dash, because `Input.pressed`
// is a RISING EDGE and the key must be down again to press again — which is
// the whole reason `DASH_CHAIN.at` starts at 2 rather than 1.
restStep(new Set(['primary']));
for (let k = 1; k < DASH_AT; k += 1) restStep(NO_KEYS);
restStep(EAST_PRESS);
/**
 * ⛓ THE COAST IS DERIVED. Nothing held until the player is at a dead stop —
 * `Mobile.friction` runs the surplus down by `DEFAULT_FRICTION` a tick and
 * snaps the last sub-0.05 remainder to zero — with a bound that is the
 * arithmetic's own (`SLASH_DASH_FORCE / 0.25` plus the walk speed's share)
 * rather than a number picked to be big enough.
 */
const COAST_BOUND = Math.ceil((SLASH_DASH_FORCE + 1) / 0.25) + 2;
let coasted = 0;
while (restRun.state.vx !== 0) {
    if (coasted > COAST_BOUND) {
        throw new Error(`${REST_NAME}: the player was still moving `
            + `(vx ${restRun.state.vx}) after ${coasted} coasting ticks, past the `
            + `${COAST_BOUND} the decay arithmetic allows. The control press must land `
            + 'on a player who is genuinely at rest, so this is a STOP.');
    }
    restStep(NO_KEYS);
    coasted += 1;
}
const STILL_AT = restHeld.length;
/**
 * ⛓ THE CONTROL'S TICK IS DERIVED TOO: the first `DASH_CHAIN` offset at or
 * after the standstill that is still inside the swing's own window. Outside
 * `slashTimer` the press would be an ORDINARY SWING and the row would prove
 * nothing about the dash arm at all.
 */
const CONTROL_AT = DASH_CHAIN.at.find((k) => k >= STILL_AT && k < SLASH_TIMER_MAX);
if (CONTROL_AT === undefined) {
    throw new Error(`${REST_NAME}: the player comes to rest at k = ${STILL_AT}, and no `
        + `\`DASH_CHAIN\` offset (${DASH_CHAIN.at.join(', ')}) lands at or after it while `
        + `\`slashTimer\` is still up (< ${SLASH_TIMER_MAX}). The no-key control cannot be `
        + 'placed, so this is a STOP rather than a press moved to fit.');
}
for (let k = restHeld.length; k < CONTROL_AT; k += 1) restStep(NO_KEYS);
restStep(new Set(['primary']));
// The same tail the moving witness takes: the decay must land and the last
// animation must complete inside the tape.
for (let k = 0; k < TAIL; k += 1) restStep(NO_KEYS);

const restRows = restRun.slashPresses;
const restAt = (k) => restRows.find((p) => p.t === k);
const restDelta = (t) => {
    const row = restTrace.find((r) => r.t === t);
    return row ? row.x - row.before.x : null;
};

check('⛓ the opening press is an ORDINARY swing at a standstill, and moves nothing',
    restAt(0)?.outcome === 'slash' && restDelta(0) === 0,
    `outcome ${restAt(0)?.outcome}, dx ${restDelta(0)}`);
check(`⛓⛓⛓ the press at k = ${DASH_AT} is the DASH ARM, taken from a DEAD STOP with the `
    + 'direction key STARTING that same tick',
    restAt(DASH_AT)?.outcome === 'dash'
        && restTrace[DASH_AT].before.vx === 0
        && restTrace[DASH_AT].held === 'primary+right'
        && restTrace[DASH_AT - 1].held === '-',
    `outcome ${restAt(DASH_AT)?.outcome}, pre-tick vx ${restTrace[DASH_AT].before.vx}, `
    + `held ${restTrace[DASH_AT - 1].held} then ${restTrace[DASH_AT].held}`);
/**
 * ⛔⛔⛔ **THE CLAIM, AND IT IS AN ARITHMETIC RATHER THAN A NUMBER.** The tick
 * moves `moveSpeed` (the key's own acceleration, written by `input()` before
 * `useItem` runs) PLUS `SLASH_DASH_FORCE` (the impulse, along the velocity
 * that key just wrote). Friction takes nothing, because the player was at rest
 * and `Mobile.friction` shortens a zero vector to zero. ⛓ It is 2.80 px, and
 * that is the GAME's own t=114 digit on `r9-solve-3` (R9 kickoff §33.6) — but
 * it is asserted from `WALK_SPEED + SLASH_DASH_FORCE` so the row cannot decay
 * into a typed constant.
 */
check(`⛓⛓⛓ …and that tick moves WALK_SPEED + ${SLASH_DASH_FORCE} = `
    + `${WALK_SPEED + SLASH_DASH_FORCE} px — the GAME's own t=114 digit on r9-solve-3`,
    Math.abs(restDelta(DASH_AT) - (WALK_SPEED + SLASH_DASH_FORCE)) < 1e-9,
    `dx ${restDelta(DASH_AT)?.toFixed(3)} (walk ${WALK_SPEED} + force ${SLASH_DASH_FORCE}). `
    + 'Before R9 slice 12e″ this model moved 0.800 here — the walk alone.');
check(`⛓⛓ …and what follows is the impulse's own −${FRICTION}/tick decay, with the key `
    + 'RELEASED so nothing else is in it',
    [1, 2, 3, 4].every((i) => {
        const d = restDelta(DASH_AT + i - 1);
        const next = restDelta(DASH_AT + i);
        return d !== null && next !== null && Math.abs((d - next) - FRICTION) < 1e-9;
    }),
    [0, 1, 2, 3, 4].map((i) => restDelta(DASH_AT + i)?.toFixed(3)).join(' '));
check(`⛔⛔⛔ THE CONTROL: the press at k = ${CONTROL_AT} is the DASH ARM too, at rest with `
    + 'NO direction key — and it moves the player by NOTHING',
    restAt(CONTROL_AT)?.outcome === 'dash'
        && restTrace[CONTROL_AT].before.vx === 0
        && restTrace[CONTROL_AT].held === 'primary'
        && restDelta(CONTROL_AT) === 0,
    `outcome ${restAt(CONTROL_AT)?.outcome}, held ${restTrace[CONTROL_AT].held}, `
    + `pre-tick vx ${restTrace[CONTROL_AT].before.vx}, dx ${restDelta(CONTROL_AT)}. `
    + 'THIS is the zero-length no-op, and it is the case the GAME is inert in too.');
check('⛓ the two presses differ by ONE KEY and by exactly the impulse',
    Math.abs((restDelta(DASH_AT) - restDelta(CONTROL_AT))
        - (WALK_SPEED + SLASH_DASH_FORCE)) < 1e-9,
    `${restDelta(DASH_AT)?.toFixed(3)} vs ${restDelta(CONTROL_AT)?.toFixed(3)}`);
check('⛔ the corridor stayed OPEN and the line stayed straight — no wall pinned the '
    + 'claim and nothing moved across travel',
    restRun.state.y === REST_START.y && restRun.state.x > REST_START.x,
    `(${REST_START.x}, ${REST_START.y}) -> (${restRun.state.x}, ${restRun.state.y})`);
check('⛔ the player took no hits and never left the room',
    restRun.playerHits.length === 0 && restRun.playerDeaths.length === 0
        && restRun.transitions.length === 0,
    `${restRun.playerHits.length} hit(s), ${restRun.transitions.length} transition(s)`);

const restFolded = buildTape(restHeld, REST_BOOT, REST_NAME,
    { noclip: false, noDamage: false, noHazards: [], grants: [] });
const restDescription = '⛓⛓⛓ R9 SLICE 12e″ — THE DASH FROM A STANDSTILL, which '
    + '`r9-l0-sword-dash` is deliberately blind to: that tape holds `right` for its whole '
    + 'run so every press lands on a MOVING player. R9 slice 12e′ measured what the blind '
    + 'spot cost — on `r9-solve-3`\'s 151-tick re-solve the GAME bought 2.80 px on t=114 '
    + 'where the model bought 0.80, and 37 ticks later the two were in different rooms. '
    + 'The mechanism is a WITHIN-TICK ORDERING: `useItem(Main.primary)` is '
    + '`Player.input()`\'s LAST act, BELOW the movement arms that have already written '
    + '`v`, so `set slashing`\'s `knockback(2, Point(x - v.x, y - v.y))` points along the '
    + 'POST-key velocity. This tape asks the game two questions one key apart, from a dead '
    + `stop with the sword: an ordinary swing at k = 0, a DASH at k = ${DASH_AT} with the `
    + 'direction key STARTING that same tick (the claim: the tick moves WALK_SPEED + '
    + `SLASH_DASH_FORCE = ${WALK_SPEED + SLASH_DASH_FORCE} px, then decays by exactly `
    + `${FRICTION}/tick with the key released), and — after a DERIVED coast back to a dead `
    + `stop — a second DASH at k = ${CONTROL_AT} with NO direction key, which must move the `
    + 'player by NOTHING because `v` really is (0,0) when `useItem` reads it and '
    + '`point_normalize` no-ops at zero length. A model reading the PRE-key velocity pays '
    + 'nothing for both; a model that has broken the zero-length no-op pays for both; only '
    + 'the game separates them. Same DERIVED L0 corridor as `r9-l0-sword-dash`. Authored '
    + 'by scripts/procgen/plan-seedling-r9-l0-sword-dash.mjs.';
const restTape = {
    game: 'seedling',
    name: REST_NAME,
    boot: REST_BOOT,
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: [...PIN_NAMES],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 1, split: false },
    seam: { items: { hasSword: true } },
    tick_count: restHeld.length,
    inputs: restFolded.inputs,
    tape_version: 8,
};
const restPath = join(TAPES, `${REST_NAME}.json`);
const restJson = tapeJson(restTape, restDescription);
if (CHECK) {
    const same = existsSync(restPath) && readFileSync(restPath, 'utf8') === restJson;
    check(`⛓ the committed ${REST_NAME} is what this script produces today`, same,
        same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
} else {
    writeFileSync(restPath, restJson);
    console.log(`wrote ${restPath.slice(REPO.length + 1)}`);
}

console.log(`\n## ${REST_NAME}: ${restHeld.length} ticks · swing k=0 · DASH k=${DASH_AT} `
    + `(key STARTING, from rest) · at rest again by k=${STILL_AT} · CONTROL dash `
    + `k=${CONTROL_AT} (no key)`);
console.log('\n## THE SEALED TRAJECTORY — the model\'s per-tick answer, BEFORE the game '
    + 'sees it. A differing digit under `--win --record` is a STOP, not a re-record.');
for (const r of restTrace) {
    const row = restRows.find((p) => p.t === r.t);
    console.log(`  t=${String(r.t).padStart(3)} ${r.held.padEnd(14)}`
        + `${row ? row.outcome.toUpperCase().padEnd(10) : ''.padEnd(10)}`
        + ` x ${r.before.x.toFixed(3)} -> ${r.x.toFixed(3)}  (d ${(r.x - r.before.x).toFixed(3)})`
        + `  vx ${r.vx.toFixed(3)}`);
}

if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
