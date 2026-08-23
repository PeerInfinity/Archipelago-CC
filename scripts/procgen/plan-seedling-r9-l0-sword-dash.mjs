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

const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
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
    pins: ['dead_frames'],
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
check(`⛓⛓ each dash is +${SLASH_DASH_FORCE} along travel and NOTHING across it`,
    dashRows.every((p) => p.impulse.dvx === SLASH_DASH_FORCE && p.impulse.dvy === 0),
    JSON.stringify(dashRows.map((p) => p.impulse)));
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
    pins: ['dead_frames'],
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

function tapeJson(obj) {
    const parsed = parseTape({ ...obj, description });
    return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
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
if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
