#!/usr/bin/env node
/**
 * probe-seedling-r7-l6-bait — CAN L6 BE CROSSED AT ALL, AND BY WHOM? R7
 * slice 6e.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §18.6 (the USER's own
 * route for L6, supplied from play) and §4 slice 6. Chain data:
 * `frontend/modules/seedlingDemo/playthroughWalk.js`, chain `act2-to-l8`.
 *
 * ── ⛔⛔ THE QUESTION THE ROUTE TURNED OUT TO ASK ──────────────────────
 *
 * §18.6's route is right about the GAME and the MODEL refuses it BY NAME.
 * L6 is walled three ways and the walls are three different mechanisms:
 *
 *   row 2      `Water` at columns 6-8 (tiles (6,2), (7,2), (8,2)).
 *   rows 1, 3  the `sandtrap` PAIRS at columns 4 and 10. Their 16x16 boxes
 *              only reach rows 1 and 3, so ROW 2 PASSES UNDER THEM — and a
 *              walk that tries row 1 oscillates at x~56 forever on
 *              `sandtrap@64,16`'s knockback (measured, `synthesizeLegs`
 *              stalls and says so).
 *   the detour `bob@96,16` at (6,1) and `bob@112,48` at (7,3) sit in EXACTLY
 *              the two cells the weave needs.
 *
 * A `bob` is `combat.contactPricing`'s **`mover`** — §16.4 refuses the class
 * because `Bob.update` steers straight at the player with no pathfinding and
 * `Enemy.hitPlayer` collides against the body where it IS — so `levelRun`
 * THROWS rather than pricing a contact it cannot compute. With both bodies at
 * their placements the model therefore has NO crossing at all: row 1 is
 * blocked for player centres in x (96,112) and row 3 for x (112,128), at
 * every y either row allows.
 *
 * ⇒ so the honest question is not "which detour" but **which body has to be
 * gone, and does the GAME remove it?**
 *
 * ── ⛓⛓⛓ THE ANSWER: THE ROOM KILLS THEM ITSELF ───────────────────────
 *
 * Two source facts, and neither is about the player:
 *
 *  1. `Enemy.update`'s `case 1: //Water -> destroy = true`. A chaser whose
 *     straight line crosses the water DROWNS. `Bob` has no wall test at all
 *     (`Bob.as:59`'s `collideLine` guard is commented out), so it will.
 *  2. `Bob.as:39` — `solids.push("Enemy")`. A **sandtrap is a WALL for a
 *     bob**, though not for the player, whose own solids list does not
 *     include enemies at all.
 *
 * ⇒ THE STANCE IS THE WHOLE SOLVE, and it is one tile: **row 1, column 3**.
 * From there `bob@112,48`'s straight line runs north-west across the water
 * and it drowns, while `bob@96,16` walks west along row 1 and PARKS against
 * `sandtrap@64,16` forever, eight pixels short of ever reaching the player.
 * No weapon, no player kill, no swimming.
 *
 * ── THE ARMS ──────────────────────────────────────────────────────────
 *
 *   bait   the SOLVE. A* to row 1 column 3 (26 ticks), then stand.
 *   stay   CONTROL 1 — never leave the arrival. `bob@112,48` is 86 px away
 *          and `Bob.runRange` is 80, so it never wakes and never drowns.
 *          This separates "the route causes the drowning" from "bobs drown".
 *   south  CONTROL 2 — the same column one ROW down. The bob's line to a
 *          player in row 2 crosses row 2 WEST of the water, so it lives.
 *          This is what makes the stance's ROW load-bearing rather than
 *          decorative.
 *   cross  the whole segment shape: the block, then the planned crossing,
 *          driven to the L7 arrival — and then REPLAYED BY THE MODEL with
 *          the one drowned body declared, byte against byte.
 *
 * ⚠ REAL-GPU WINDOWS CHROME, one page per arm (§17.4's measured price; two
 * arms on one page would let arm 1's state walk into arm 2).
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/probe-seedling-r7-l6-bait.mjs
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
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
const { L6_BOB_DROWN } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/playthroughWalk.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

/** The L6 arrival, which is where `teleporter@48,112` in L5 puts the player. */
const BOOT = Object.freeze({ level: 6, x: 32, y: 16 });
/** The two bodies, by the LEVEL RECORD's own identity — see the v10 docblock. */
const DROWNED = 'bob@112,48';
const PARKED = 'bob@96,16';

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

function tapeFor(label, inputs, ticks) {
    return {
        tape_version: TAPE_VERSION,
        game: 'seedling',
        name: `probe-l6-${label}`,
        boot: { ...BOOT },
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
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

/** `[{key|null, ticks}]` -> half-open spans, the tape's own spelling. */
function spansOf(steps) {
    const spans = [];
    let t = 0;
    for (const s of steps) {
        if (s.key) spans.push({ key: s.key, from: t, to: t + s.ticks });
        t += s.ticks;
    }
    return { spans, ticks: t };
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

const bobsIn = (got) => (got.mobiles?.[got.mobiles.length - 1]?.mobiles ?? [])
    .filter((m) => /Bob/.test(m.cls || m.type || ''));

/**
 * The arms' choreographies. `bait` is `L6_BOB_DROWN`'s OWN spans, read off the
 * committed block rather than retyped — the block and the probe that
 * witnessed it must not be able to drift apart, and the direction of the
 * dependency is the one that keeps the block the artifact.
 */
const BAIT = Object.freeze({
    spans: L6_BOB_DROWN.spans.map((s) => ({ ...s })),
    ticks: L6_BOB_DROWN.ticks,
});
/**
 * ⚠ THE CROSSING'S WAYPOINTS LIVE HERE AND IN THE CHAIN'S OWN LEG, and that
 * duplication is safe for one reason: the chain DERIVES its spans from these
 * targets on every `--check`, so a drift is a byte difference in a committed
 * tape rather than a probe that quietly measured a different walk. Row 3 is
 * the detour, because row 3 is the row the drowned body was standing in.
 */
const CROSS_TARGETS = [
    { x: 56, y: 40 }, { x: 88, y: 40 }, { x: 88, y: 56 }, { x: 152, y: 56 },
    { x: 152, y: 40 }, { x: 216, y: 40 },
];
const CROSS_EXIT = { x: 224, y: 32 };
const ARMS = [
    {
        label: 'bait',
        why: '⛓ THE SOLVE — row 1, column 3. `bob@112,48` crosses the water to reach it '
            + 'and drowns; `bob@96,16` parks against `sandtrap@64,16` and never arrives',
        spans: BAIT.spans, ticks: BAIT.ticks,
        want: { bobs: 1, alive: PARKED },
    },
    {
        label: 'stay',
        why: 'CONTROL 1 — never leave the arrival. `bob@112,48` is 86 px away and '
            + '`Bob.runRange` is 80, so it never wakes: the drowning is the ROUTE\'s, '
            + 'not something bobs do on their own',
        steps: [{ key: null, ticks: L6_BOB_DROWN.ticks }],
        want: { bobs: 2 },
        control: true,
    },
    {
        label: 'south',
        why: 'CONTROL 2 — the same column one ROW down. The bob\'s line to a player in '
            + 'row 2 crosses row 2 WEST of the water, so it lives: the stance\'s ROW is '
            + 'load-bearing rather than decorative',
        steps: [{ key: 'down', ticks: 12 }, { key: 'right', ticks: 14 },
            { key: null, ticks: L6_BOB_DROWN.ticks - 26 }],
        want: { bobs: 2 },
        control: true,
    },
];

console.log('## L6 — the two detour cells, and who removes them\n');
const drivenBait = new Map();
for (const arm of ARMS) {
    console.log(`\n── ${arm.label}: ${arm.why}`);
    const { spans, ticks } = arm.spans
        ? { spans: arm.spans, ticks: arm.ticks } : spansOf(arm.steps);
    const got = replayOnWindows(arm.label, tapeFor(arm.label, spans, ticks));
    const stream = got.stream.ticks;
    const end = stream[stream.length - 1];
    const bobs = bobsIn(got);
    drivenBait.set(arm.label, got);

    const jumps = respawnJumps(stream);
    check(`⛔ ${arm.label}: the player never died`, jumps.length === 0,
        jumps.length === 0 ? `${stream.length} observations, no jump to the boot tile`
            : `respawn-shaped jump(s) at t=[${jumps.join(' ')}] — every other finding in `
                + 'this arm is VACUOUS until this is green');

    check(`⛓ ${arm.label}: ${arm.want.bobs} Bob body/bodies left after `
        + `${ticks} ticks`,
    bobs.length === arm.want.bobs,
    `${bobs.length} in the last mobile sample: `
        + `${bobs.map((b) => `(${b.x.toFixed(1)},${b.y.toFixed(1)})`).join(' ') || 'none'}`
        + ` — ends at (${end.x}, ${end.y}) in level ${end.level}`);
}

/**
 * ⛓⛓⛓ AND THE CLAIM THE WHOLE FEATURE RESTS ON: with the ONE drowned body
 * declared, the MODEL replays the GAME's own crossing byte for byte.
 *
 * ⛔ THE COMPARISON IS OFFSET BY ONE ON PURPOSE. The driver pushes an
 * observation for tick 0 BEFORE dispatching any input, so the game's stream
 * is `tick_count + 1` long and `game[i + 1]` is the state after the model's
 * `i`th `advance` — the same alignment `verify-seedling-bot-differential`
 * uses. Comparing index for index would report every tick as divergent and
 * the LAST one as agreeing, which is exactly what it did the first time.
 */
{
    console.log('\n── cross: the block, then the planned crossing, then the MODEL');
    const atlas = JSON.parse(JSON.stringify(loadAtlas()));
    const l6 = atlas.levels.find((l) => l.level === 6);
    l6.entities = l6.entities.filter((e) => `${e.type}@${e.x},${e.y}` !== DROWNED);
    const withoutDrowned = levelSourceFromAtlas(atlas);

    const baitSpans = BAIT.spans;
    const baitTicks = BAIT.ticks;
    const plan = synthesizeLegs([
        { level: 6, targets: CROSS_TARGETS.map((t) => ({ ...t })), exit: { ...CROSS_EXIT } },
        { level: 7, targets: [] },
    ], {
        levelSource: withoutDrowned,
        boot: {
            level: L6_BOB_DROWN.endsAt.level,
            x: L6_BOB_DROWN.endsAt.x,
            y: L6_BOB_DROWN.endsAt.y,
        },
        name: 'probe-l6-cross',
        relax: {
            noclip: false, noDamage: false, noHazards: [], grants: [], equips: [],
            pins: ['dead_frames'], persistence: [],
            roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
        },
    });
    const inputs = [
        ...baitSpans,
        ...plan.tape.inputs.map((s) => ({ key: s.key, from: s.from + baitTicks, to: s.to + baitTicks })),
    ];
    const ticks = baitTicks + plan.tape.tick_count;
    console.log(`   crossing planned: ${plan.tape.tick_count} ticks, transitions `
        + `[${plan.transitions.map((t) => t.t + baitTicks).join(' ')}], total ${ticks}`);

    const got = replayOnWindows('cross', tapeFor('cross', inputs, ticks));
    const game = got.stream.ticks;
    const end = game[game.length - 1];
    check('⛓ cross: the GAME reaches the L7 arrival', end.level === 7,
        `ends at (${end.x}, ${end.y}) in level ${end.level}`);
    check('⛔ cross: the player never died', respawnJumps(game).length === 0,
        `${game.length} observations`);
    check('⛓ cross: BOTH bodies are gone by the L7 arrival', bobsIn(got).length === 0,
        `${bobsIn(got).length} left — `
        + `${PARKED} follows the player east along row 2 and drowns at column 6 DURING `
        + 'the crossing, which the model never has to be told because the route never '
        + 'touches its placement box');

    const run = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: { ...BOOT },
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        // ⛓ THE ONE FIELD. `at` is the block's own end tick, which is where
        // the `bait` arm above asked the game and got 1 body left.
        despawn: [{ level: 6, id: DROWNED, at: baitTicks, note: 'drowned' }],
        equips: [],
        pins: ['dead_frames'],
        roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
    });
    let diverged = null;
    for (let t = 0; t < ticks; t += 1) {
        const held = new Set(inputs.filter((s) => s.from <= t && t < s.to).map((s) => s.key));
        run.advance(held);
        const g = game[t + 1];
        if (!g) break;
        if (diverged === null && (g.level !== run.level
            || g.x !== run.state.x || g.y !== run.state.y)) {
            diverged = `t=${g.t}: game L${g.level}(${g.x},${g.y}) vs model `
                + `L${run.level}(${run.state.x},${run.state.y})`;
        }
    }
    check('⛓⛓⛓ cross: the MODEL reproduces the GAME byte for byte, with ONE body '
        + 'declared removed', diverged === null,
    diverged ?? `all ${ticks} ticks agree, ending L${run.level} `
        + `(${run.state.x}, ${run.state.y}) — the whole case for the v10 field, and the `
        + 'same one-field-whole-cause test v9 had to pass');
    const hits = run.playerHits;
    /**
     * ⛔⛔ ZERO HITS IS A REQUIREMENT HERE, NOT A NICETY, and the first cut of
     * this route learned it the expensive way. A diagonal departure from the
     * stance grazes BOTH column-4 sandtraps: two hits in the model, and the
     * GAME added a third from `bob@96,16` — the live chaser the model has
     * parked at its placement — for a silent death at t=198 (trap 142). The
     * model's damage budget is the game's MINUS whatever a mover adds, so a
     * route through a room with a live one has to spend none of it.
     */
    check('⛔ cross: the route takes NO damage at all in the model', hits.length === 0,
        hits.map((h) => `${h.id} at t=${h.t} (hits ${h.hits}/${h.hitsMax})`).join('; ')
        || 'no contact with either sandtrap pair — the margin the first waypoint buys');
}

console.log(`\n${failures === 0 ? '⛓ ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
