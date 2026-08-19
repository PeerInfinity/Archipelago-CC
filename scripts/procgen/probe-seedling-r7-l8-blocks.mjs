#!/usr/bin/env node
/**
 * probe-seedling-r7-l8-blocks — L8: THE BLOCK IS THE DOOR, AND THE CEILING
 * IS THE WEAPON. R7 slice 6f.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §18.6 (the USER's
 * own route for L8, supplied from play) and §19.7 (the room measured
 * offline, the map this starts from). Chain data:
 * `frontend/modules/seedlingDemo/playthroughWalk.js`, chain `act2-to-l10`.
 *
 * ── THE ROOM, AND WHY IT IS FOUR MECHANISMS ───────────────────────────
 *
 *      0 ############   button@64,48    (4,3) {tset 0}
 *      1 ######.#...#   arrowtrap@96,16 (6,1) {tset 0, shoot 0}
 *      2 ####.#.#...#   sandtrap@96,80  (6,5) {tag 0}
 *      3 ####.......#   sandtrap@96,128 (6,8) {tag 1}
 *      4 ####...#####   pushableblock@112,48 (7,3)
 *      5 ######.#~~~#   pushableblock@96,112 (6,7)
 *      6 #~~~~~..~~~#   stairsup@144,32 (9,2)  <- the arrival is (9,3)
 *      7 #~~~~~..~~~#   teleporter@96,192 (6,12) -> L9
 *      8 #~~~~~.~~~~#
 *     ...                `~` = Water.
 *     12 ######.#####
 *
 *  · the EAST POCKET (8-10, 1-3) that the walk arrives into joins the room
 *    only through `pushableblock@112,48` at (7,3) — L4's shape, second
 *    instance: **the block is the door**.
 *  · **column 6 is the only way south**, at every row from 4 down, and BOTH
 *    sandtraps stand in it. A sandtrap's 16x16 box IS its whole tile, so
 *    the walk cannot pass one: it has to be gone.
 *  · the arrowtrap's lane is column 6 downward, so the room's own ceiling
 *    is the weapon — and `pushableblock@96,112` at (6,7) SHADOWS the second
 *    sandtrap until it is pushed into the water at (5,7).
 *  · nothing here models an Arrow killing an Enemy (§16.4, still refused).
 *    It does not have to: `SandTrap.check()` removes a body whose tag is
 *    cleared and `SandTrap.removed()` WRITES that clear
 *    (`Enemies/SandTrap.as:44-51, 88-92`), so each kill is a v9 `at`-clear
 *    — the mechanism slice 6d shipped.
 *
 * ── ⛔⛔ THE ARM THAT REFUTES THE USER'S FIRST MOVE, AND WHY IT MATTERS ─
 *
 * §18.6's route opens "push `pushableblock@112,48` LEFT onto `button@64,48`;
 * the arrows kill the first sandtrap; push the block UP off the switch".
 * That is right about the GAME and it is not something THIS PLANNER can
 * author, for a reason that has nothing to do with the block:
 *
 *   a shove's release is early by construction (§17.1) and the leg then
 *   WAITS for the block to settle. Measured here: the block lands on the
 *   button at t~102 of a 128-tick leg and the player spends the remaining
 *   26 ticks standing at x=96.2 — whose 4-px box overlaps the lane
 *   [98,110) by two tenths of a pixel. THREE volleys reach row 3 in that
 *   window.
 *
 * ⛓ AND THE USER'S ROUTE ALREADY MAKES THE PLAYER THE PRESSER FOR THE
 * SECOND KILL — "stand the switch until sandtrap 2 dies" — because a block
 * pushed NORTH off the button can never come back (row 1 column 4 is solid,
 * so nothing can stand north of it to push it south). So the solve here is
 * the user's route with ONE presser instead of two: park the block one tile
 * short of the button, out of the doorway, and let the PLAYER press for both
 * kills. Two shoves instead of three, and the player is never in the lane
 * while the trap is armed.
 *
 * ── THE ARMS ──────────────────────────────────────────────────────────
 *
 *   block-onto-button  ⛔ THE REFUTATION, driven: the user's own first move
 *                      as `synthesizeLegs` authors it (shove to (4,3), then
 *                      retreat west out of the lane). The GAME says what the
 *                      settle costs.
 *   kill1              the solve's first half: park the block at (5,3), walk
 *                      onto the button, hold. Asks the game for {8,0}.
 *   kill1-short        CONTROL — the same with the hold cut to 40 ticks. The
 *                      flag must NOT be cleared, or the hold is decoration.
 *   kill2              + sink `pushableblock@96,112` into the water, walk
 *                      back onto the button, hold. Asks for {8,1}.
 *   full               + the column-6 walk to `teleporter@96,192`, driven to
 *                      the L9 arrival, and then REPLAYED BY THE MODEL with
 *                      the two clears declared, byte against byte.
 *
 * ⚠ REAL-GPU WINDOWS CHROME, one page per arm (§17.4's measured price).
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/probe-seedling-r7-l8-blocks.mjs
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { gameVisibleTape, parseTape, TAPE_VERSION } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { atlasLevelSource, loadAtlas } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));
const { levelSourceFromAtlas } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/atlasSource.js'));
const { createLevelRun } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelRun.js'));
const { synthesizeLegs } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV2.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

/** The L8 arrival — `stairsdown@192,32` in L7 declares `playerx 144, playery 48`. */
const BOOT = Object.freeze({ level: 8, x: 144, y: 48 });
const BUTTON = Object.freeze({ x: 64, y: 48 });
const BLOCK_DOOR = 'pushableblock@112,48';
const BLOCK_SINK = 'pushableblock@96,112';
/**
 * ⛓ THE LANE, from `arrowTrap.arrowLane` on the RUN's own trap (whose `x` is
 * the ENTITY point 104, not the OEL 96): arrows spawn at 100/104/108 with
 * 4-px boxes, so the swept interval is [98,110) and a 4-px player box is in
 * it for centres in (96,112) — column 6 and nothing else.
 */
const LANE = Object.freeze({ x0: 98, x1: 110 });

const RELAX = Object.freeze({
    noclip: false, noDamage: false, noHazards: [], grants: [], equips: [],
    pins: ['dead_frames'],
    roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
});

/**
 * ⛔⛔⛔ A SHOVED BLOCK IS PER-VISIT RUNTIME STATE, AND A FRESH PLAN DOES
 * NOT HAVE IT — the defect this room found, and the reason this helper
 * MOVES as well as REMOVES.
 *
 * `synthesizeLegs` boots a fresh `createLevelRun` from the LEVEL RECORD, so
 * a block a previous group pushed is back at its `.oel` cell as far as the
 * next group is concerned. In L8 that is not a nuisance, it is a wrong
 * route twice over: the first cut planned the walk back to the button with
 * `pushableblock@112,48` still at (7,3) — so A* thought (5,3), where the
 * block really stands, was FREE — and the drive shoved the block NORTH out
 * of its own path, into (6,2). Measured: the second hold then reported
 * `[8,0]` alone and the exit leg walked into the live `sandtrap@96,128`
 * and DIED at t=1025.
 *
 * ⇒ every plan is made against the record EDITED by the shoves already
 * made. Nothing here reaches the tape: a segment is ONE run in the game and
 * one run in `tapeRunner`, and both move the block live. It is the PLANNER
 * that forgets, so it is the planner that is told.
 *
 * ⚠ A MOVE REWRITES THE PLACEMENT, so the edited entity's own id changes.
 * That is correct rather than convenient — the id IS the placement (§19.3)
 * — and it means a later shove must name the block by where it now is.
 */
function sourceEdited(edits) {
    if (edits.length === 0) return atlasLevelSource();
    const atlas = JSON.parse(JSON.stringify(loadAtlas()));
    for (const { level, id, to } of edits) {
        const l = atlas.levels.find((x) => x.level === level);
        const at = l.entities.findIndex((e) => `${e.type}@${e.x},${e.y}` === id);
        if (at < 0) throw new Error(`level ${level} has no ${id}`);
        if (to) {
            l.entities[at] = { ...l.entities[at], x: to.tx * 16, y: to.ty * 16 };
        } else {
            l.entities.splice(at, 1);
        }
    }
    return levelSourceFromAtlas(atlas);
}

function plan(label, legs, { boot, gone = [], persistence = [] }) {
    return synthesizeLegs(legs, {
        levelSource: sourceEdited(gone), boot: { ...boot }, name: `probe-l8-${label}`,
        relax: { ...RELAX, persistence: persistence.map((c) => ({ ...c })) },
    });
}
/** The record edits a plan's own shoves imply, for every plan after it. */
const editsOf = (p) => p.shoves.map((s) => ({
    level: s.level, id: s.id, to: s.destroys ? null : { tx: s.to.tx, ty: s.to.ty },
}));

function replayOnWindows(name, tapeObj) {
    mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
    writeFileSync(join(WIN_SCRATCH_WSL, 'seedling-bot-replay-win.py'),
        readFileSync(WIN_DRIVER));
    const outWsl = join(WIN_SCRATCH_WSL, `stream-${name}.json`);
    writeFileSync(join(WIN_SCRATCH_WSL, `tape-${name}.json`),
        JSON.stringify(gameVisibleTape(parseTape(tapeObj))));
    try { unlinkSync(outWsl); } catch { /* first run */ }
    let out;
    try {
        out = execFileSync(WIN_PY, [
            '-3.12', `${WIN_SCRATCH_DOS}\\seedling-bot-replay-win.py`,
            '--url', PAGE_URL,
            '--tape', `${WIN_SCRATCH_DOS}\\tape-${name}.json`,
            '--out', `${WIN_SCRATCH_DOS}\\stream-${name}.json`,
            '--mobiles',
            '--deadline-sec', String(Math.ceil(tapeObj.tick_count * 1.5) + 120),
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

function tapeFor(label, inputs, ticks, persistence = []) {
    return {
        tape_version: TAPE_VERSION,
        game: 'seedling',
        name: `probe-l8-${label}`,
        boot: { ...BOOT },
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence,
        despawn: [],
        equips: [],
        pins: ['dead_frames'],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 0, split: false },
        seam: null,
        tick_count: ticks,
        inputs,
    };
}

/**
 * ⛔ THE SILENT-DEATH DETECTOR (trap 142), carried in every arm. A death is a
 * world reconstruction at the boot tile with NO level change, and
 * `status.hits` cannot see it because the counter reads the NEW Player.
 */
function respawnJumps(ticks) {
    const bx = BOOT.x + 8;
    const by = BOOT.y + 8;
    const jumps = [];
    for (let i = 1; i < ticks.length; i += 1) {
        const a = ticks[i - 1];
        const b = ticks[i];
        if (b.level !== a.level) continue;
        if (b.x === bx && b.y === by && (Math.abs(a.x - bx) > 8 || Math.abs(a.y - by) > 8)) {
            jumps.push(b.t);
        }
    }
    return jumps;
}

const clearedIn = (st) => (st.persistence_cleared || [])
    .map((r) => `${r.level ?? r.l},${r.tag ?? r.t}`);
const trapsIn = (got) => (got.mobiles?.[got.mobiles.length - 1]?.mobiles ?? [])
    .filter((m) => /SandTrap/.test(m.cls || m.type || ''));
const blocksIn = (got) => (got.mobiles?.[got.mobiles.length - 1]?.mobiles ?? [])
    .filter((m) => /PushableBlock/.test(m.cls || m.type || ''));

/** Shift a plan's spans into the walk's own tick frame. */
const shift = (spans, at) => spans.map((s) => ({ key: s.key, from: s.from + at, to: s.to + at }));

// ── THE PIECES, ALL DERIVED ──────────────────────────────────────────
//
// ⚠ Every span below is A*'s. The two BUTTON approaches are planned against
// a record with `button@64,48` DELETED — L5's planning-only deletion
// (§15.3), for L5's reason: A* works in whole tiles and will not end on a
// cell it is told to avoid. The deletion never reaches the tape, the model's
// follow, or the game.
const PLANNING_ONLY_BUTTON = [{ level: 8, id: `button@${BUTTON.x},${BUTTON.y}` }];

console.log('## L8 — the block is the door, and the ceiling is the weapon\n');

/** 1. park the door-block at (5,3) and stand below the button. */
const legPark = plan('park', [{
    level: 8,
    targets: [
        { x: 136, y: 56, shove: { block: { x: 112, y: 48 }, dir: 'W', to: { tx: 5, ty: 3 } } },
        { x: 72, y: 72 },
    ],
}], { boot: BOOT });
console.log(`   legPark: ${legPark.tape.tick_count} ticks, ends `
    + `(${legPark.final.x.toFixed(2)},${legPark.final.y.toFixed(2)})`);

/** 2. the first press: one tile north, onto the button. */
const bootAfterPark = {
    level: legPark.final.level, x: legPark.final.x - 8, y: legPark.final.y - 8,
};
/** ⛓ the door-block's own new cell, from the plan that moved it. */
const PARKED = editsOf(legPark);
const press1 = plan('press1', [{ level: 8, targets: [{ x: 72, y: 56 }] }],
    { boot: bootAfterPark, gone: [...PARKED, ...PLANNING_ONLY_BUTTON] });
console.log(`   press1:  ${press1.tape.tick_count} ticks, ends `
    + `(${press1.final.x.toFixed(2)},${press1.final.y.toFixed(2)})`);

/**
 * ⛓ THE HOLDS ARE DECLARED WITH MARGIN, and the margin is the point.
 * `Enemy.hitsMax` is 3 and `hitsTimerMax` is 30, so three landed arrows
 * through i-frames is ~70 ticks before the die animation even starts; the
 * clear is written by `removed()`, at the END of a 6-frame death at 10 fps.
 * A hold that stopped at the kill would report a sandtrap that was about to
 * die. The `kill1-short` arm is what makes 220 a number rather than a habit.
 */
const HOLD1 = 220;
const HOLD1_SHORT = 40;
const HOLD2 = 260;

/** 3. from the button, down column 6, and the second block into the water. */
const bootAfterPress1 = {
    level: press1.final.level, x: press1.final.x - 8, y: press1.final.y - 8,
};
const legSink = plan('sink', [{
    level: 8,
    contacts: [`proximity-hazard:button@${BUTTON.x},${BUTTON.y}`],
    targets: [{
        x: 120, y: 120,
        shove: { block: { x: 96, y: 112 }, dir: 'W', to: { tx: 5, ty: 7 }, destroys: true },
    }],
}], { boot: bootAfterPress1, gone: [...PARKED], persistence: [{ level: 8, tag: 0 }] });
console.log(`   legSink: ${legSink.tape.tick_count} ticks, ends `
    + `(${legSink.final.x.toFixed(2)},${legSink.final.y.toFixed(2)}) — `
    + `${legSink.shoves.map((s) => `${s.id} ${s.dir}${s.destroys ? ' DESTROYED' : ''}`).join('; ')}`);

/** 4. back up column 6 and onto the button again. */
const bootAfterSink = {
    level: legSink.final.level, x: legSink.final.x - 8, y: legSink.final.y - 8,
};
const SUNK = editsOf(legSink);
const press2 = plan('press2', [{ level: 8, targets: [{ x: 72, y: 56 }] }], {
    boot: bootAfterSink,
    gone: [...PARKED, ...SUNK, ...PLANNING_ONLY_BUTTON],
    persistence: [{ level: 8, tag: 0 }],
});
console.log(`   press2:  ${press2.tape.tick_count} ticks, ends `
    + `(${press2.final.x.toFixed(2)},${press2.final.y.toFixed(2)})`);

/** 5. the column-6 walk to the teleporter, and the L9 arrival. */
const bootAfterPress2 = {
    level: press2.final.level, x: press2.final.x - 8, y: press2.final.y - 8,
};
const legExit = plan('exit', [
    {
        level: 8,
        contacts: [`proximity-hazard:button@${BUTTON.x},${BUTTON.y}`],
        targets: [],
        exit: { x: 96, y: 192 },
    },
    { level: 9, targets: [] },
], {
    boot: bootAfterPress2,
    gone: [...PARKED, ...SUNK],
    persistence: [{ level: 8, tag: 0 }, { level: 8, tag: 1 }],
});
console.log(`   legExit: ${legExit.tape.tick_count} ticks, transitions `
    + `[${legExit.transitions.map((t) => t.t).join(' ')}], ends L${legExit.final.level} `
    + `(${legExit.final.x.toFixed(2)},${legExit.final.y.toFixed(2)})`);

// ── the composed walks ───────────────────────────────────────────────
const T_PRESS1 = legPark.tape.tick_count;
const T_HOLD1_END = T_PRESS1 + press1.tape.tick_count + HOLD1;
const T_SINK = T_HOLD1_END;
const T_PRESS2 = T_SINK + legSink.tape.tick_count;
const T_HOLD2_END = T_PRESS2 + press2.tape.tick_count + HOLD2;
const T_END = T_HOLD2_END + legExit.tape.tick_count;

const WALK = [
    ...legPark.tape.inputs,
    ...shift(press1.tape.inputs, T_PRESS1),
    ...shift(legSink.tape.inputs, T_SINK),
    ...shift(press2.tape.inputs, T_PRESS2),
    ...shift(legExit.tape.inputs, T_HOLD2_END),
];
console.log(`\n   the walk: park[0,${T_PRESS1}) press1+hold1[${T_PRESS1},${T_HOLD1_END}) `
    + `sink[${T_SINK},${T_PRESS2}) press2+hold2[${T_PRESS2},${T_HOLD2_END}) `
    + `exit[${T_HOLD2_END},${T_END}) = ${T_END} ticks, ${WALK.length} spans`);

const clip = (to) => WALK.map((s) => ({ key: s.key, from: s.from, to: Math.min(s.to, to) }))
    .filter((s) => s.to > s.from);

// ── ⛔ THE REFUTATION ARM ────────────────────────────────────────────
{
    console.log('\n── block-onto-button: ⛔ §18.6\'s first move, as the PLANNER authors it');
    const p = plan('onto', [{
        level: 8,
        targets: [
            { x: 136, y: 56, shove: { block: { x: 112, y: 48 }, dir: 'W', to: { tx: 4, ty: 3 } } },
            { x: 88, y: 56 },
        ],
    }], { boot: BOOT });
    /**
     * ⛓ THE MODEL ALREADY NAMES THE WINDOW, and it names it without knowing
     * anything about damage: `stepArrowTrap` fires the volleys, and the
     * player's own box is in the lane for every tick between the first one
     * and the leg's last. What the model CANNOT say is what that costs —
     * `combat.PUZZLEMENT_HAZARDS.arrowtrap` prices the TRAP's own volume and
     * nothing prices an arrow in flight against the player (§16.8's named
     * bound). So the window is arithmetic and the cost is the game's.
     */
    const run = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: { ...BOOT },
        noclip: false, noDamage: false, noHazards: [], grants: [], persistence: [], equips: [],
        pins: ['dead_frames'], roles: [...RELAX.roles],
    });
    let firstVolley = null;
    let exposed = 0;
    for (let t = 0; t < p.tape.tick_count; t += 1) {
        const held = new Set(p.tape.inputs.filter((s) => s.from <= t && t < s.to)
            .map((s) => s.key));
        run.advance(held);
        if (firstVolley === null && (run.arrowVolleys ?? []).length > 0) firstVolley = t;
        const inLane = run.state.x + 2 > LANE.x0 && run.state.x - 2 < LANE.x1;
        if (firstVolley !== null && inLane) exposed += 1;
    }
    console.log(`   the MODEL: first volley t=${firstVolley}, `
        + `${(run.arrowVolleys ?? []).length} volleys, player in the lane for ${exposed} of `
        + `the ${p.tape.tick_count - firstVolley} ticks after it`);

    const got = replayOnWindows('onto', tapeFor('onto', p.tape.inputs, p.tape.tick_count));
    const stream = got.stream.ticks;
    const jumps = respawnJumps(stream);
    const hits = got.status.hits ?? null;
    check('⛔ block-onto-button: the GAME charges the settle wait — the player is HIT or '
        + 'DIES in the lane', jumps.length > 0 || (hits ?? 0) > 0,
    `hits ${hits}, respawn-shaped jump(s) [${jumps.join(' ') || 'none'}], `
        + `${blocksIn(got).length} block(s) left, ends `
        + `(${stream[stream.length - 1].x},${stream[stream.length - 1].y}) — this is the `
        + 'arm that makes the parked-block route a MEASUREMENT rather than a preference');
}

// ── the solve, in three truncations ──────────────────────────────────
const armCheck = (label, got, want) => {
    const stream = got.stream.ticks;
    const end = stream[stream.length - 1];
    const jumps = respawnJumps(stream);
    check(`⛔ ${label}: the player never died`, jumps.length === 0,
        jumps.length === 0 ? `${stream.length} observations, no jump to the boot tile`
            : `respawn-shaped jump(s) at t=[${jumps.join(' ')}] — every other finding in `
                + 'this arm is VACUOUS until this is green');
    check(`⛔ ${label}: the player took NO damage`, (got.status.hits ?? 0) === 0,
        `hits ${got.status.hits}`);
    const cleared = clearedIn(got.status);
    check(`⛓ ${label}: the GAME's own persistence_cleared is [${want.cleared.join(' ') || 'nothing'}]`,
        want.cleared.every((w) => cleared.includes(w))
        && (!want.exactly || cleared.length === want.cleared.length),
        `[${cleared.join(' ') || 'nothing'}]`);
    for (const no of want.notCleared ?? []) {
        check(`⛔ ${label}: {${no}} is NOT cleared`, !cleared.includes(no),
            `[${cleared.join(' ') || 'nothing'}] — the control that makes the hold a number`);
    }
    if (want.traps !== undefined) {
        check(`⛓ ${label}: ${want.traps} sandtrap body/bodies left`,
            trapsIn(got).length === want.traps,
            `${trapsIn(got).length}: ${trapsIn(got)
                .map((m) => `(${Math.round(m.x)},${Math.round(m.y)})`).join(' ') || 'none'}`);
    }
    if (want.blocks !== undefined) {
        check(`⛓ ${label}: ${want.blocks} pushable block(s) left`,
            blocksIn(got).length === want.blocks,
            `${blocksIn(got).length}: ${blocksIn(got)
                .map((m) => `(${Math.round(m.x)},${Math.round(m.y)})`).join(' ') || 'none'}`);
    }
    if (want.level !== undefined) {
        check(`⛓ ${label}: the GAME reaches level ${want.level}`, end.level === want.level,
            `ends (${end.x}, ${end.y}) in level ${end.level}`);
    }
    return end;
};

console.log(`\n── kill1-short: CONTROL — the hold cut to ${HOLD1_SHORT} ticks`);
{
    const to = T_PRESS1 + press1.tape.tick_count + HOLD1_SHORT;
    const got = replayOnWindows('kill1-short', tapeFor('kill1-short', clip(to), to));
    armCheck('kill1-short', got, { cleared: [], notCleared: ['8,0'], traps: 2, blocks: 2 });
}

console.log(`\n── kill1: the block parked, the player pressing, ${HOLD1} ticks of arrows`);
{
    const got = replayOnWindows('kill1', tapeFor('kill1', clip(T_HOLD1_END), T_HOLD1_END));
    armCheck('kill1', got, { cleared: ['8,0'], notCleared: ['8,1'], traps: 1, blocks: 2 });
}

console.log(`\n── kill2: + the second block into the water, + ${HOLD2} ticks of arrows`);
{
    const got = replayOnWindows('kill2', tapeFor('kill2', clip(T_HOLD2_END), T_HOLD2_END));
    armCheck('kill2', got, { cleared: ['8,0', '8,1'], traps: 0, blocks: 1 });
}

console.log('\n── full: + the column-6 walk to the teleporter, then the MODEL');
{
    const got = replayOnWindows('full', tapeFor('full', WALK, T_END));
    const end = armCheck('full', got, { cleared: ['8,0', '8,1'], level: 9 });
    console.log(`   the game ends at (${end.x}, ${end.y}) in level ${end.level}`);

    /**
     * ⛓⛓⛓ AND THE CLAIM THE WHOLE SEGMENT RESTS ON: with the two clears
     * declared AT THE TICKS THE GAME WROTE THEM, the MODEL replays the walk
     * byte for byte.
     *
     * ⛔ THE COMPARISON IS OFFSET BY ONE ON PURPOSE — the driver pushes an
     * observation for tick 0 before dispatching any input, so `game[i + 1]`
     * is the state after the model's `i`th `advance` (the same alignment
     * `verify-seedling-bot-differential` uses).
     */
    const run = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: { ...BOOT },
        noclip: false, noDamage: false, noHazards: [], grants: [],
        persistence: [
            { level: 8, tag: 0, at: T_HOLD1_END, note: 'sandtrap@96,80, killed by the arrows' },
            { level: 8, tag: 1, at: T_HOLD2_END, note: 'sandtrap@96,128, killed by the arrows' },
        ],
        despawn: [],
        equips: [],
        pins: ['dead_frames'],
        roles: [...RELAX.roles],
    });
    const game = got.stream.ticks;
    let diverged = null;
    for (let t = 0; t < T_END; t += 1) {
        const held = new Set(WALK.filter((s) => s.from <= t && t < s.to).map((s) => s.key));
        run.advance(held);
        const g = game[t + 1];
        if (!g) break;
        if (diverged === null && (g.level !== run.level
            || g.x !== run.state.x || g.y !== run.state.y)) {
            diverged = `t=${g.t}: game L${g.level}(${g.x},${g.y}) vs model `
                + `L${run.level}(${run.state.x},${run.state.y})`;
        }
    }
    check('⛓⛓⛓ full: the MODEL reproduces the GAME byte for byte, with the two clears '
        + 'declared at the ticks the game wrote them', diverged === null,
    diverged ?? `all ${T_END} ticks agree, ending L${run.level} `
        + `(${run.state.x}, ${run.state.y})`);
    check('⛔ full: the route takes NO damage at all in the model', run.playerHits.length === 0,
        run.playerHits.map((h) => `${h.id} at t=${h.t}`).join('; ')
        || 'the player is never in the lane while the trap is armed, and both sandtraps '
            + 'are gone before the column-6 walk');
}

// ── the numbers the chain needs, printed as data ─────────────────────
console.log('\n## the phases blocks, as the chain must carry them');
console.log(JSON.stringify({
    kill1: {
        startsAtOffset: T_PRESS1,
        steps: [{ label: 'press', ticks: press1.tape.tick_count },
            { label: 'hold', ticks: HOLD1 }],
        ticks: press1.tape.tick_count + HOLD1,
        spans: press1.tape.inputs,
        endsAt: { x: Math.round(press1.final.x - 8), y: Math.round(press1.final.y - 8) },
        endsAtExact: { x: press1.final.x, y: press1.final.y },
    },
    kill2: {
        startsAtOffset: T_PRESS2,
        steps: [{ label: 'press', ticks: press2.tape.tick_count },
            { label: 'hold', ticks: HOLD2 }],
        ticks: press2.tape.tick_count + HOLD2,
        spans: press2.tape.inputs,
        endsAt: { x: Math.round(press2.final.x - 8), y: Math.round(press2.final.y - 8) },
        endsAtExact: { x: press2.final.x, y: press2.final.y },
    },
    legs: {
        park: legPark.tape.tick_count,
        sink: legSink.tape.tick_count,
        exit: legExit.tape.tick_count,
        total: T_END,
    },
}, null, 2));

console.log(`\n${failures === 0 ? '⛓ ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
