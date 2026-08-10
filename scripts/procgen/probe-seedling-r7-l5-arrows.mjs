#!/usr/bin/env node
/**
 * probe-seedling-r7-l5-arrows — CAN THE SWORD BE REACHED AT ALL? R7 slice 6.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §4 slice 6 (the
 * first honest segments, sphere 0). Order:
 * `frontend/modules/flashPanel/atlases/seedling-sphere-order.json` (0.1 is
 * `Level 010 - Sword`).
 *
 * ── ⛔ THE QUESTION, AND WHY IT IS THE WHOLE SLICE'S GATE ─────────────
 *
 * Every location in sphere 0 is behind the sword. L10 has exactly two
 * approaches and both are weapon-shaped on their face:
 *
 *   L3 -> L11 -> L10   `breakablerock@96,112 {3,0}` sits on the corridor to
 *                      the L11 teleporter, and a rock breaks to a SLASH.
 *   L3 -> L4 -> L5 -> L6 -> L7 -> L8 -> L9 -> L10
 *                      `lock@48,112 {5,0}` sits ON the L5->L6 teleporter's
 *                      own cell, `tSet == -1` — a KILL-LOCK, and
 *                      `Game.totalEnemies()` counts `Bob` (Game.as:1811).
 *
 * A player with no sword cannot slash and cannot kill. If both readings are
 * right the game is unbeatable from its own initial state, which §3.5's ⚖
 * ruling says is a defect in OUR logic until the source says otherwise.
 *
 * ⛓ THE SOURCE SAYS OTHERWISE, and this probe is what makes it a
 * measurement. `ArrowTrap.as:48-63` fires three `Arrow`s downward at speed
 * 5 every 10 updates while activated, and `Arrow.as:18,51-52` lists
 * **"Enemy"** among its hitables and calls `Enemy.hit(v.length, ...)`. L5's
 * four arrowtraps and its `button@48,48` share `tSet 0`. So the intended
 * solve is: **stand on the button and let the traps do the killing.** The
 * three `bob`s die to arrows, `totalEnemies()` reaches 0, `checkEnemies()`
 * arms the lock, and 100 alpha steps later `turnOff()` writes
 * `Game.setPersistence(0, false)` — the durable clear the walk then crosses.
 *
 * ⚠ NOTHING OFFLINE MODELS THIS. `combat.js` prices an arrowtrap as damage
 * to the PLAYER (`seedlingDamageSites.Arrow`); no module in the tree models
 * an Arrow killing an Enemy. So the planner cannot plan this fight and the
 * GAME has to answer — which is the standing rule anyway.
 *
 * ── THE PAIR ──────────────────────────────────────────────────────────
 *
 *   stand    boots ON the button. If the reading is right: {5,0} cleared.
 *   off      boots one tile EAST of it, same length, same everything else.
 *            The traps never arm, the bobs live, {5,0} stays set.
 *
 * A clear from the `stand` arm alone is a lock that was going to open; a
 * hold from the `off` arm alone is a fight that was never winnable. Only
 * the pair is evidence.
 *
 * ⚠ REAL-GPU WINDOWS CHROME, ALWAYS. WSL's own Chromium is SwiftShader and
 * runs Seedling about seven times slower (`seedling-bot-replay-win.py`'s
 * docblock measures it: ~0.5 fps vs ~3.6). A 700-tick standing fight is
 * minutes there and the better part of half an hour here, so this probe
 * shells out to the same dumb Windows driver the differential's `--win`
 * channel uses — one page per arm, because two arms on one page would let
 * arm 1's cleared flags walk into arm 2.
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/probe-seedling-r7-l5-arrows.mjs
 *   node scripts/procgen/probe-seedling-r7-l5-arrows.mjs --ticks=600
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
    existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = 'seedling_bot_ap';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { parseTape, TAPE_VERSION } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { synthesizeLegs } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV2.js'));
const { atlasLevelSource } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));

const arg = (name, dflt) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : dflt;
};
const TICKS = Number(arg('ticks', '700'));

/**
 * ⛓ THE STANCE IS THE BUTTON, and the boot block is its centre MINUS the
 * constructor's half-tile — `Game`'s ctor adds `Tile.w/2` to both, exactly
 * as `plan-seedling-r5-l60-kill.mjs` does it.
 *
 * `button@48,48` -> centre (56,56) -> boot (48,48).
 *
 * ⚠ The button's own column is the ONE column with no trap above it (row 1
 * is `#U###a#`: the traps are at x 16 and 80, and the row-3 pair straddles
 * the button at x 32 and 64). The puzzle is built so the presser is safe,
 * which is also why this stance can be held for 700 ticks without `hits`
 * moving — asserted below rather than assumed.
 */
const STANCE = { x: 48, y: 48 };
/** One tile EAST: off the button, same room, same everything. */
const OFF = { x: 64, y: 48 };
/** The real approach — L4's `stairsdown@64,16` drops the player at (80,32). */
const ARRIVAL = { x: 80, y: 32 };

/**
 * ⛔ THE ARROW LANES, read off `ArrowTrap.as:24,48-63` rather than guessed.
 *
 * A trap constructed at `.oel` (X, Y) centres at `X + 8`, and `shoot()` adds
 * three Arrows at `x - 4`, `x`, `x + 4` with velocity `(0, 5)` — straight
 * DOWN, always, whatever the `shoot` attribute says (that attribute is
 * `shootDefault`, which inverts WHEN it fires, not WHERE). So each trap
 * paints one 8 px-wide column below itself, and in L5 the four traps put
 * lanes in tile columns 1, 2, 4 and 5:
 *
 *      col   trap            lane x      covers
 *       1    @16,16          20..28      rows 2-6   <- both left bobs START here
 *       5    @80,16          84..92      rows 2-6   <- the L4 arrival column
 *       2    @32,48          36..44      rows 4-6
 *       4    @64,48          68..76      rows 4-6
 *
 * ⛓ AND COLUMN 3 IS NOT A LANE. The button sits at (48,48) with no trap
 * above it and a SOLID at (48,64) directly below, so the presser is safe and
 * so is anything standing under the button. `bob@48,80` starts in that
 * shadow — which is why "stand on the button and wait" is not the solve.
 */
const LANES = Object.freeze([
    { col: 1, x: [20, 28], from: 32 }, { col: 5, x: [84, 92], from: 32 },
    { col: 2, x: [36, 44], from: 64 }, { col: 4, x: [68, 76], from: 64 },
]);

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

/**
 * One tape on real-GPU Windows Chrome, staged where `py.exe` can see it.
 * The same shape `verify-seedling-bot-differential.mjs` uses — the driver
 * stays dumb, every decision stays here.
 */
function replayOnWindows(name, tapeObj, deadlineSec) {
    mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
    writeFileSync(join(WIN_SCRATCH_WSL, 'seedling-bot-replay-win.py'),
        readFileSync(WIN_DRIVER));
    const outWsl = join(WIN_SCRATCH_WSL, `stream-${name}.json`);
    writeFileSync(join(WIN_SCRATCH_WSL, `tape-${name}.json`), JSON.stringify(tapeObj));
    try { unlinkSync(outWsl); } catch { /* first run */ }
    const progressWsl = join(WIN_SCRATCH_WSL, `progress-${name}.json`);
    try { unlinkSync(progressWsl); } catch { /* first run */ }
    console.log(`    progress: tail ${progressWsl}`);
    let out;
    try {
        out = execFileSync(WIN_PY, [
            '-3.12', `${WIN_SCRATCH_DOS}\\seedling-bot-replay-win.py`,
            '--url', PAGE_URL,
            '--tape', `${WIN_SCRATCH_DOS}\\tape-${name}.json`,
            '--out', `${WIN_SCRATCH_DOS}\\stream-${name}.json`,
            '--progress', `${WIN_SCRATCH_DOS}\\progress-${name}.json`,
            '--mobiles',
            '--deadline-sec', String(deadlineSec),
        ], { cwd: WIN_SCRATCH_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        const said = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`${e.message}${said ? `\n${said}` : ''}`);
    }
    out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
        .forEach((l) => console.log(`    ${l}`));
    if (!existsSync(outWsl)) throw new Error(`windows driver wrote no stream for ${name}`);
    return JSON.parse(readFileSync(outWsl, 'utf8'));
}

function tapeFor(label, boot, inputs, ticks) {
    return parseTape({
        tape_version: TAPE_VERSION,
        game: 'seedling',
        name: `probe-l5-${label}`,
        boot: { level: 5, ...boot },
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        equips: [],
        pins: ['dead_frames'],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 0, split: false },
        seam: null,
        tick_count: ticks,
        inputs,
    });
}

/**
 * ⛔ THE ARMS ARE CHOREOGRAPHIES, and the first two are the ones that show
 * why a third is needed.
 *
 * ⚠ `stand` is NOT the solve and this probe says so with a measurement.
 * `Bob.update` steers straight at the player whenever `FP.distance <=
 * runRange` (80) — no pathfinding, no wall test (the `collideLine` guard is
 * commented out at `Bob.as:59`) — so a bob whose straight line to the player
 * runs into a Solid simply presses against it forever. From the button, the
 * bob at (56,88) has `solid@48,64` between it and the presser and parks in
 * column 3's shadow, which is the ONE column no trap covers.
 *
 * ⇒ the solve is the user's: **bait the bobs out of the shadow and into a
 * lane, then step back onto the button.** The bait is a stance the bobs'
 * straight line reaches THROUGH a lane, held long enough for them to travel
 * it, before the presser returns and the traps arm.
 */
const ARMS = [
    {
        label: 'off',
        why: 'the CONTROL — one tile east of the button, nothing pressed, nothing armed',
        boot: OFF, inputs: [], ticks: TICKS,
    },
    {
        label: 'stand',
        why: 'the NAIVE arm — boot ON the button and wait. Named as a measurement of '
            + 'why the puzzle needs a bait, not as a candidate',
        boot: STANCE, inputs: [], ticks: TICKS,
    },
    {
        label: 'bait',
        why: '⛓ THE SOLVE, as the game intends it and as the trace re-cut it: walk '
            + 'DOWN the arrival column so the shadowed bob at (56,88) — the one the '
            + 'naive arm leaves pressed against `solid@48,64`\'s south face, in the one '
            + 'column no trap covers — steers EAST out of the shadow and into lane 4; '
            + 'dwell while it travels at its 0.5 px/tick; then walk back up the '
            + 'arrival column and west onto the button. From the button the bob\'s '
            + 'straight line runs into the solid\'s EAST face at x ~ 68, which is lane '
            + '4\'s own left edge — so it stays in the lane while the traps fire',
        boot: ARRIVAL,
        planned: true,
    },
];

/**
 * ⛓ THE BAIT'S NUMBERS, and every one of them is read off something.
 *
 * `bait` is the stance that pulls the shadowed bob east: column 5, row 5, the
 * arrival column's bottom. `via` is row 3 of the same column — the walk back
 * up — and `press` is the button. `dwell` is the bob's travel time: it moves
 * at `Bob.moveSpeed` 0.5 px/tick and has ~32 px of shadow to clear, so 200
 * ticks is that with room, and the arm is measured rather than tuned (the
 * mobile trace prints where it got to).
 *
 * `hold` is the fight: `ArrowTrap.shootTimerMax` is 10, so a volley lands
 * every 10 ticks; `Arrow`'s damage is `v.length` = 5 against `Bob.hitsMax`
 * 3, so ONE arrow kills; then `Lock.activationStep` drains alpha at 0.01 per
 * update — **100 more ticks before `turnOff()` writes the clear**. A hold
 * that stopped at the kill would report a lock that was about to open.
 */
/**
 * ⛔⛔ AND THE FIRST CUT OF THESE NUMBERS KILLED THE PLAYER, SILENTLY.
 *
 * `stance` was (88,96) with a 200-tick dwell. The three bobs converged on a
 * player that was standing still with `noDamage: false`, landed three
 * contacts through the 30-tick i-frames, and at t~180 the run reported
 * `level 5, (88,40)` — **the boot position, in the same level**. That is a
 * death and a `Game` reconstruction at `Main.playerPositionX/Y`, and nothing
 * in the arm's report said so: `status.hits` reads the NEW Player, so it was
 * 0. The walk-back then pressed `up` from the arrival tile instead of from
 * the bait stance and drove straight into `stairsup@80,16`, which is the L4
 * bounce the trace shows.
 *
 * ⇒ two changes, and the second one matters more than the first:
 *   1. the bait is a DRIVE-BY. 40 ticks is all the shadowed bob needs — it
 *      moves 0.5 px/tick and has ~16 px of shadow to clear — and the walk
 *      back is 77 more ticks of it following. Standing still in a room with
 *      three chasers is what cost the first cut.
 *   2. `deathFindings` below asserts the run never left L5 and never
 *      respawned, so a death can never again be read as "the mechanism did
 *      not fire". A silent death makes every other assertion in the arm
 *      vacuous.
 */
/**
 * ⛓⛓ AND THE TRACE RE-CUT IT AGAIN, into TWO PHASES — because the naive arm
 * turned out to be doing two thirds of the work already.
 *
 * `stand`'s mobile trace, folded on the bob count:
 *
 *     t=  0  bobs=3  [(56,88) h0, (24,88) h0, (24,72) h0]
 *     t=115  bobs=2  [(56,84) h0, (21,87) **h2**]
 *     t=187  bobs=1  [(56,84) h0]
 *
 * ⇒ **the left pair dies to the traps on its own**, and the `h2` is the
 * receipt: they start in tile column 1, which is `arrowtrap@16,16`'s own lane
 * (x 20/24/28), and standing on the button rains arrows onto them where they
 * already are. It is not drowning and it is not the player — `hits` stays 0
 * for all 700 ticks and the pair is dead by t=187.
 *
 * So only ONE bob ever needed baiting, and the first cut sent the player down
 * into all three at once and got it killed at t=187 during the walk back.
 * The phases fix that by ORDER: press first, let the traps clear the pair,
 * and only then go and fetch the survivor, with two thirds of the room's
 * damage already gone.
 *
 *   press  arrival -> button                       (planned)
 *   clear  hold 240 — the left pair dies at ~187, plus margin
 *   bait   button -> (72,96), the survivor's east side   (planned)
 *   dwell  40 — it moves 0.5 px/tick and needs ~16 px to clear the shadow
 *   back   (72,96) -> button                        (planned)
 *   hold   260 — ONE arrow kills (damage `v.length` 5 vs `Bob.hitsMax` 3),
 *          then `Lock.activationStep` drains alpha at 0.01/update, so the
 *          clear lands 100 ticks after the kill and not before
 */
const BAIT = Object.freeze({
    stance: { x: 72, y: 96 },
    press: { x: 56, y: 56 },
    clear: 240,
    dwell: 40,
    hold: 260,
});

/**
 * ⛔⛔ THE PLANNER AUTHORS THE MOVEMENT, AND IT NEEDS TWO OVERRIDES TO DO IT.
 * Both are named here rather than worked around silently, because both are
 * MODEL DEBTS this probe is measuring the shape of.
 *
 * 1. `button@48,48` carries the `proximity-hazard` role, so its tile is not a
 *    walkable A* goal — correct for a walk that must not press things by
 *    accident, wrong for a walk whose whole purpose is to press this one. The
 *    `hold` primitive is the vocabulary for that and it REFUSES here:
 *
 *      "button@48,48 presses group t=0, which NO responder in level 5
 *       answers — the level's responders are [lock@48,112(t=-1)]"
 *
 *    ⛓ THAT REFUSAL IS RIGHT AND IT NAMES THE DEBT. `ArrowTrap extends
 *    Activators` and its `update()` calls `shoot()` on `activate`, so a trap
 *    IS a responder — `ACTIVATOR_RESPONDERS` does not list it. And even with
 *    it listed, nothing in the tree models an Arrow's flight or
 *    `Enemy.hit(v.length)`, so the model can never watch this lock open.
 *
 * 2. ⇒ the planner is handed a level record with the button REMOVED, purely
 *    so A* will end on its tile. The GAME still has the button, which is the
 *    entire experiment; the model was never going to see the consequence
 *    either way. Planning-only, one entity, one level.
 *
 * ⚠ So this probe's tape is authored by the planner and adjudicated by the
 * GAME alone. That is the standing rule anyway — it is written down here
 * because for once the model cannot even offer a second opinion.
 */
function planL5(targets, boot) {
    const base = atlasLevelSource();
    const source = (n) => {
        const rec = base(n);
        if (n !== 5) return rec;
        return {
            ...rec,
            entities: rec.entities.filter(
                (e) => !((e.name || e.type) === 'button' && e.x === 48 && e.y === 48)),
        };
    };
    return synthesizeLegs([{ level: 5, targets }], {
        levelSource: source,
        boot,
        name: 'probe-l5-plan',
        relax: {
            noclip: false,
            noDamage: false,
            noHazards: [],
            grants: [],
            persistence: [],
            equips: [],
            pins: ['dead_frames'],
        },
    });
}

/**
 * Splice a DWELL into a planned input list: everything from `at` onward
 * shifts by `ticks`, and the gap is empty, so the player stands where the
 * plan left it.
 *
 * ⚠ Spans are half-open, so a span STRADDLING the cut would be silently
 * lengthened rather than paused — this refuses instead of guessing.
 */
function dwellAt(inputs, at, ticks) {
    for (const s of inputs) {
        if (s.from < at && s.to > at) {
            throw new Error(`dwell at ${at} straddles ${s.key} [${s.from},${s.to}) — `
                + 'cut the dwell at a tick no span is live across');
        }
    }
    return inputs.map((s) => (s.from >= at
        ? { ...s, from: s.from + ticks, to: s.to + ticks } : { ...s }));
}

const clearedIn = (st) => (st.persistence_cleared || [])
    .map((r) => `${r.level ?? r.l},${r.tag ?? r.t}`);

/**
 * ⛔ THE SILENT-DEATH DETECTOR, and it is the instrument this probe was
 * missing rather than a nicety.
 *
 * A death in Seedling is a world reconstruction at `Main.playerPositionX/Y`,
 * which for a booted tape is the boot tile. So the tell is a tick that JUMPS
 * back to the boot position with no input that could have walked there —
 * and the giveaway is that it happens WITHOUT a level change, which is what
 * separates it from an ordinary transition.
 *
 * ⚠ `status.hits` cannot see it: the reconstruction makes a fresh Player and
 * the counter reads 0 afterwards. The first cut of the bait arm died and
 * reported `hits 0`, which read exactly like a clean run that failed to open
 * the lock.
 */
function deathFindings(label, out, boot) {
    const ticks = out.stream?.ticks ?? [];
    const bx = boot.x + 8;
    const by = boot.y + 8;
    const jumps = [];
    for (let i = 1; i < ticks.length; i += 1) {
        const a = ticks[i - 1];
        const b = ticks[i];
        if (b.level !== a.level) continue;
        if (b.x === bx && b.y === by && (Math.abs(a.x - bx) > 8 || Math.abs(a.y - by) > 8)) {
            jumps.push(b.t);
        }
    }
    const levels = [...new Set(ticks.map((o) => o.level))];
    return { jumps, levels, label };
}

/** Which lane, if any, a point is standing in. */
const laneOf = (x, y) => LANES.find((l) => x >= l.x[0] - 4 && x <= l.x[1] + 4 && y >= l.from);

/**
 * The enemy trace, folded to the one question the choreography asks: where
 * did each Bob go, and was it ever in a lane?
 *
 * ⚠ The trace is a wall-clock SAMPLE (~7 ticks apart), so this reports
 * WHETHER a lane was occupied and never for how long. A duration read off
 * samples would be a poller measuring a transient.
 */
function foldMobiles(trace) {
    if (!Array.isArray(trace) || !trace.length) return 'NO TRACE';
    const bobsAt = (s) => (s.mobiles || []).filter((m) => /Bob/.test(m.cls || m.type || ''));
    const first = bobsAt(trace[0]);
    const last = bobsAt(trace[trace.length - 1]);
    const everInLane = new Set();
    for (const s of trace) {
        for (const b of bobsAt(s)) if (laneOf(b.x, b.y)) everInLane.add(`${Math.round(b.x)}`);
    }
    return `${first.length} bob(s) at start -> ${last.length} at end; `
        + `last seen ${last.map((b) => `(${Math.round(b.x)},${Math.round(b.y)})`).join(' ') || '—'}; `
        + `${everInLane.size} distinct bob-x ever inside a lane`;
}

{
    console.log('## L5 — the kill-lock the sword sits behind, and the arrows that open it\n');
    const arms = {};
    // ⛓ THE BAIT ARM IS PLANNED, not typed — the first cut was hand-written
    // spans and it walked the player back up L5's OTHER staircase into L4 and
    // bounced between the two for four hundred ticks. A hand-cut span in a
    // room with two staircases is a route claim nobody checked.
    //
    // ⚠ TWO planner calls, not one with three targets, so the dwell's cut
    // tick is the FIRST leg's own length rather than a guess about which span
    // belongs to which target.
    const at = (p) => ({ level: 5, x: p.x - 8, y: p.y - 8 });
    const legs = [
        { label: 'press', plan: planL5([BAIT.press], { level: 5, ...ARRIVAL }) },
        { label: 'clear', idle: BAIT.clear },
        { label: 'bait', plan: planL5([BAIT.stance], at(BAIT.press)) },
        { label: 'dwell', idle: BAIT.dwell },
        { label: 'back', plan: planL5([BAIT.press], at(BAIT.stance)) },
        { label: 'hold', idle: BAIT.hold },
    ];
    let cursor = 0;
    const baitInputs = [];
    for (const leg of legs) {
        if (leg.idle) { cursor += leg.idle; continue; }
        baitInputs.push(...dwellAt(leg.plan.tape.inputs, 0, cursor));
        cursor += leg.plan.tape.tick_count;
    }
    const baitTicks = cursor;
    console.log(`   the plan: ${legs.map((l) => `${l.label} ${l.idle ?? l.plan.tape.tick_count}`)
        .join(' + ')} = ${baitTicks}`);
    console.log(`   spans: ${JSON.stringify(baitInputs)}`);
    for (const arm of ARMS) {
        if (arm.planned) { arm.inputs = baitInputs; arm.ticks = baitTicks; }
        const t0 = Date.now();
        arms[arm.label] = replayOnWindows(`l5-${arm.label}`,
            tapeFor(arm.label, arm.boot, arm.inputs, arm.ticks),
            Math.ceil(arm.ticks * 1.5) + 120);
        const { status, mobiles } = arms[arm.label];
        console.log(`    ${arm.label}: ${arm.ticks} ticks in `
            + `${((Date.now() - t0) / 1000).toFixed(0)}s — ${arm.why}`);
        console.log(`    ${arm.label}: cleared [${clearedIn(status).join(' ')}] `
            + `hits ${status.hits} pos (${status.x.toFixed(2)}, ${status.y.toFixed(2)})`);
        console.log(`    ${arm.label}: ${foldMobiles(mobiles)}`);
        const d = deathFindings(arm.label, arms[arm.label], arm.boot);
        check(`⛔ ${arm.label} STAYED ALIVE IN L5 — no respawn, no level left`,
            d.jumps.length === 0 && d.levels.length === 1 && d.levels[0] === 5,
            d.jumps.length || d.levels.length !== 1
                ? `respawn-shaped jump(s) at t=[${d.jumps.join(' ')}], levels visited `
                    + `[${d.levels.join(' ')}] — every other finding in this arm is `
                    + 'VACUOUS until this is green'
                : `${arms[arm.label].stream.ticks.length} ticks, all in L5, no jump to the `
                    + 'boot tile');
    }

    const cleared = (l) => clearedIn(arms[l].status).includes('5,0');

    check('⛓⛓⛓ THE BAIT ARM OPENS {5,0} — the arrows kill the bobs, `totalEnemies()` '
        + 'reaches 0 and the kill-lock turns off, with NO WEAPON', cleared('bait'),
    cleared('bait') ? `persistence_cleared carries 5,0 — the sword is REACHABLE from the `
        + 'game\'s own initial state and rules v1\'s `True_` on L5 -> L6 is right for a '
        + 'reason it does not state'
        : `it did NOT: cleared [${clearedIn(arms.bait.status).join(' ')}] — re-cut the `
            + 'choreography off the mobile trace above before concluding anything');
    check('⛔ THE CONTROL HOLDS IT — off the button, the traps never arm', !cleared('off'),
        cleared('off') ? 'the lock opened WITHOUT the button, so no arm proves anything '
            + 'about the button' : `cleared [${clearedIn(arms.off.status).join(' ')}]`);
    check('⚠ THE NAIVE ARM DOES NOT — standing on the button alone leaves a bob in the '
        + 'one column no trap covers', !cleared('stand'),
    cleared('stand') ? 'it DID open, so the bait is unnecessary and the choreography '
        + 'above is over-built — simplify before shipping a segment'
        : `cleared [${clearedIn(arms.stand.status).join(' ')}] — ${foldMobiles(arms.stand.mobiles)}`);
    check('the presser is safe — the button column has no trap above it',
        arms.stand.status.hits === 0,
        `hits ${arms.stand.status.hits} of hitsMax over ${TICKS} ticks on the button`);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
