#!/usr/bin/env node
/**
 * probe-seedling-r7-l4-block — THE BLOCK IS THE DOOR, AND THE BOB IS HOLDING
 * IT SHUT. R7 slice 6c.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §16.6 (where the
 * honest chain stops, measured) and §4 slice 6c. Verb under test:
 * `botDriverV2.runShove`.
 *
 * ── ⛔ THE WALL SLICE 6b MEASURED ─────────────────────────────────────
 *
 * From `new Game(0, 80, 128)` with an empty save, `synthesizeLegs` plans
 * L0 -> L2 (183) -> L3 (230) -> L4 (475) and then refuses:
 *
 *   no walkable tile path in level 4 from tile (1,1) to (4,1) — the two are
 *   in different connected components
 *
 * L4's tile layer walls column 2 at every row but **(2,4)**, and
 * `pushableblock@32,64` stands in it. **The block IS the door.** It is the
 * `walk` family — `PushableBlock` has no `hit()` at all, so no press of any
 * weapon moves it (and a player who has not reached L10 has no weapon) — it
 * is shoved by LEANING, which is the one verb a weaponless player has.
 *
 * ── ⛓ AND THE ROOM IS L5's PUZZLE WITH THE PIECES MOVED ───────────────
 *
 * Past the block: `bob@64,64`, `button@16,64 {tset 0}` in the arrival
 * pocket, and two `arrowtrap`s at (48,16) and (64,16) — the second CO-SITED
 * with the stairs to L5. So the room hands the player a chaser it cannot
 * kill, a block the chaser can hold shut (`PushableBlock`'s ctor pushes
 * "Enemy" onto its own solids list — a body in the glide corridor stops the
 * block dead), and the two traps that answer the button the player arrives
 * standing next to.
 *
 * ⛔⛔ THE MODEL CANNOT ADJUDICATE ANY OF THAT. `levelWorld` collects no
 * enemies — they do not block the PLAYER, so the blocking census never
 * gathered them — so offline the shove always succeeds and the hold is
 * ceremony. Which is exactly why this is a PROBE with a PAIR and not a unit
 * test, and why `KILL_ARM_POLICY.Bob` stays `refused` (§16.4): the model
 * owns the mechanism and the geometry, the GAME adjudicates the kill.
 *
 * ── THE PAIR ──────────────────────────────────────────────────────────
 *
 *   hold     arrive -> stand on `button@16,64` for 200 ticks -> lean EAST.
 *            If the reading is right: the traps kill the bob, the block
 *            glides (2,4) -> (4,4), and the walk reaches the L5 stairs.
 *   brief    the CONTROL — the same arrival, the same stance, the same lean,
 *            and the hold is **1 tick**. The traps still ARM (a trap fires
 *            on its very first update), so one volley falls and no more; the
 *            bob lives, and it is standing in the cell the block has to move
 *            into.
 *
 * ⛓ THE CONTROL IS A NUMBER, NOT A PRESENCE. Dropping the hold entirely
 * would drop the button from the leg's contact exemptions with it, and A*
 * refuses to end a route on a `proximity-hazard` cell — so a "no hold" arm
 * cannot be PLANNED at all, and the difference between the arms would be a
 * different walk rather than a different wait. `1` keeps the route, the
 * stance, the braking ticks and the lean identical and leaves exactly one
 * bit: how long the traps were firing. (A control that cannot be built is
 * the experiment failing quietly — R5 slice 22's lesson, one verb over.)
 *
 * A crossing in the `hold` arm alone is a door that was going to open; a
 * stall in the `brief` arm alone is a room that was never passable. Only
 * the pair is evidence.
 *
 * ⚠ REAL-GPU WINDOWS CHROME, ALWAYS — see `seedling-bot-replay-win.py`'s
 * docblock. One page per arm, because two arms on one page would let arm 1's
 * cleared flags walk into arm 2.
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/probe-seedling-r7-l4-block.mjs
 *   node scripts/procgen/probe-seedling-r7-l4-block.mjs --hold=300
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
    existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';
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
const HOLD_TICKS = Number(arg('hold', '200'));

/**
 * ⛓ THE ARRIVAL, from the game's own extract: L3's `teleporter@128,48`
 * carries `playerx 16 / playery 16`, so a walk from L3 lands in L4's tile
 * (1,1) — which is the tile the slice-6b refusal names as the source of the
 * component it could not leave.
 */
const BOOT = Object.freeze({ level: 4, x: 16, y: 16 });
/** `button@16,64` — tile (1,4), the west pocket's floor, one cell from the block. */
const PRESS = Object.freeze({ x: 24, y: 72 });
/** `pushableblock@32,64` — tile (2,4), the only opening in column 2. */
const BLOCK = Object.freeze({ x: 32, y: 64 });
/**
 * ⛔ WHERE THE BLOCK STOPS, AND WHY IT IS NOT ONE TILE FURTHER.
 *
 * (5,4) is `Pit`. A third shove destroys the block there — which would open
 * the corridor just as well and would put the player one lean from falling
 * in after it. Two tiles is what the route needs: the block clears (2,4) and
 * vacates (3,4), and the walk goes north up column 3 to the stairs.
 */
const BLOCK_TO = Object.freeze({ tx: 4, ty: 4 });
/** `stairsdown@64,16` — tile (4,1), with `arrowtrap@64,16` CO-SITED on it. */
const EXIT = Object.freeze({ x: 64, y: 16 });

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

/** One tape on real-GPU Windows Chrome. The driver stays dumb. */
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

const levelSource = atlasLevelSource();
const RELAX = Object.freeze({
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: ['dead_frames'],
    roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
});

/**
 * ⛓ BOTH ARMS ARE PLANNED, and the ONE bit between them is the hold.
 *
 * Hand-cutting the control would make it a different walk — different
 * approach, different braking ticks, a different tick the lean starts on —
 * and then a stall would be evidence about the hand-cut rather than about
 * the bob. The planner authors both; `withHold` is the single term.
 */
function planL4(holdTicks) {
    const targets = [
        { x: PRESS.x, y: PRESS.y, hold: { presser: { x: 16, y: 64 }, ticks: holdTicks } },
        {
            x: PRESS.x,
            y: PRESS.y,
            shove: { block: { ...BLOCK }, dir: 'E', to: { ...BLOCK_TO } },
        },
    ];
    return synthesizeLegs([
        { level: 4, targets, exit: { ...EXIT } },
        { level: 5, targets: [] },
    ], { levelSource, boot: { ...BOOT }, relax: RELAX, name: `probe-l4-${holdTicks}` });
}

function tapeFor(label, plan) {
    return parseTape({
        tape_version: TAPE_VERSION,
        game: 'seedling',
        name: `probe-l4-${label}`,
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
        tick_count: plan.tape.tick_count,
        inputs: plan.tape.inputs,
    });
}

/**
 * ⛔ THE SILENT-DEATH DETECTOR (trap 142). A death is a world reconstruction
 * at `Main.playerPositionX/Y` — for a booted tape, the boot tile — and
 * `status.hits` reads the NEW Player, so it cannot see it. The tell is a
 * jump to the boot tile with NO level change.
 *
 * ⚠ THIS ARM CROSSES A LEVEL ON PURPOSE, so the levels-visited list is
 * reported rather than pinned to one, and the jump test is what carries the
 * claim.
 */
function deathFindings(out) {
    const ticks = out.stream?.ticks ?? [];
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
    return { jumps, levels: [...new Set(ticks.map((o) => o.level))] };
}

/**
 * The trace, folded to the two questions this room asks — and it carries
 * both answers directly, which is better than the probe deserved.
 *
 * ⛓ `botMobiles` lists EVERY `Mobile` in the world, so `PushableBlock` is in
 * it beside the bobs: the block's live position is a GAME readout, not an
 * inference from "the player got through". That makes the shove's effect
 * observable on the game's side with the same coordinates the model uses.
 *
 * ⚠ AND THE FOLD MUST BE SCOPED TO L4. The first cut counted bobs over the
 * whole trace and reported the HOLD arm ending with THREE — which is true
 * and is about L5, the room the arm walked into. A cross-level trace folded
 * without its level is a census of the wrong room.
 * [[feedback_census_refusal_is_scoped_to_its_target]]
 */
function foldTrace(out) {
    const trace = Array.isArray(out.mobiles) ? out.mobiles : [];
    // tick -> level, from the observation stream: the trace samples carry a
    // tick and nothing else that says where they were taken.
    const levelAt = new Map((out.stream?.ticks ?? []).map((o) => [o.t, o.level]));
    const inL4 = trace.filter((s) => (levelAt.get(s.tick) ?? 4) === 4);
    const pick = (s, re) => (s.mobiles || []).filter((m) => re.test(m.cls || ''));
    const bobs = inL4.map((s) => ({ t: s.tick, n: pick(s, /Bob/).length,
        hits: pick(s, /Bob/).map((b) => b.enemy?.hits ?? '?').join('/') }));
    const blocks = inL4.map((s) => pick(s, /PushableBlock$/)[0]).filter(Boolean);
    const last = blocks[blocks.length - 1] ?? null;
    // ⚠ Samples are a wall-clock SAMPLE (~7 ticks apart), so "gone by" is the
    // first SAMPLE with no bob in it and is never a tick count. A duration
    // read off samples would be a poller measuring a transient.
    const seen = bobs.filter((b) => b.n > 0);
    const goneAt = seen.length
        ? (bobs.find((b) => b.t > seen[0].t && b.n === 0)?.t ?? null) : null;
    return {
        samples: inL4.length,
        bobsMax: bobs.reduce((n, b) => Math.max(n, b.n), 0),
        bobsEnd: bobs.length ? bobs[bobs.length - 1].n : null,
        goneAt,
        blockEnd: last ? { x: last.x, y: last.y, tx: Math.floor(last.x / 16), ty: Math.floor(last.y / 16) } : null,
        text: `${inL4.length} L4 sample(s); bobs max ${bobs.reduce((n, b) => Math.max(n, b.n), 0)} `
            + `-> ${bobs.length ? bobs[bobs.length - 1].n : '?'} at the last L4 sample`
            + `${goneAt === null ? '' : `, first empty at t~${goneAt}`}`
            + `; hits trace [${bobs.filter((b) => b.n > 0).map((b) => b.hits).join(' ')}]`
            + `; block last at ${last ? `(${last.x},${last.y}) = tile `
                + `(${Math.floor(last.x / 16)},${Math.floor(last.y / 16)})` : 'NOT SEEN'}`,
    };
}

console.log('## L4 — the block is the door, and the button is the key\n');

const plans = { hold: planL4(HOLD_TICKS), brief: planL4(1) };
for (const [label, plan] of Object.entries(plans)) {
    const s = plan.shoves[0];
    console.log(`   ${label}: ${plan.tape.tick_count} ticks, `
        + `${plan.tape.inputs.length} spans; shove contact t+${s.contactTick}, `
        + `lean ${s.leanTicks}, (${s.from.tx},${s.from.ty}) -> (${s.to.tx},${s.to.ty})`);
}
check('⛓ THE MODEL PLANS BOTH ARMS AND CANNOT TELL THEM APART — offline the shove '
    + 'succeeds either way, because `levelWorld` carries NO ENEMIES',
plans.hold.shoves.length === 1 && plans.brief.shoves.length === 1
    && plans.hold.transitions.length === 1 && plans.brief.transitions.length === 1,
`both plans cross L4 -> L5 (hold at t=${plans.hold.transitions[0]?.t}, brief at `
    + `t=${plans.brief.transitions[0]?.t}) — so a difference in the GAME is a fact `
    + 'about the bob and not about the route');

const arms = {};
for (const [label, plan] of Object.entries(plans)) {
    const t0 = Date.now();
    arms[label] = replayOnWindows(`l4-${label}`, tapeFor(label, plan),
        Math.ceil(plan.tape.tick_count * 1.5) + 120);
    const { status } = arms[label];
    const fold = foldTrace(arms[label]);
    arms[label].fold = fold;
    console.log(`    ${label}: ${plan.tape.tick_count} ticks in `
        + `${((Date.now() - t0) / 1000).toFixed(0)}s`);
    console.log(`    ${label}: level ${status.level} pos `
        + `(${status.x.toFixed(2)}, ${status.y.toFixed(2)}) hits ${status.hits}`);
    console.log(`    ${label}: ${fold.text}`);
    const d = deathFindings(arms[label]);
    arms[label].death = d;
    check(`⛔ ${label} NEVER RESPAWNED — no jump to the boot tile without a level change`,
        d.jumps.length === 0,
        d.jumps.length === 0 ? `${arms[label].stream.ticks.length} ticks, levels visited `
            + `[${d.levels.join(' ')}]`
            : `respawn-shaped jump(s) at t=[${d.jumps.join(' ')}] — every other finding `
                + 'in this arm is VACUOUS until this is green');
}

const reached = (l) => arms[l].status.level === 5;

check('⛓⛓⛓ THE HOLD ARM CROSSES INTO L5 — the traps kill the bob, the lean moves the '
    + 'block out of column 2, and the walk reaches the stairs WITH NO WEAPON',
reached('hold'),
reached('hold')
    ? `level ${arms.hold.status.level}, levels visited [${arms.hold.death.levels.join(' ')}]`
        + ' — L4 is not a wall, and the honest chain reaches L5'
    : `it did NOT: level ${arms.hold.status.level} at `
        + `(${arms.hold.status.x.toFixed(2)},${arms.hold.status.y.toFixed(2)}); `
        + `${arms.hold.fold.text}. Re-cut the hold off the mobile trace — if the bob is `
        + 'still alive the hold is short, and if it is dead the block met something else');

check('⛔ THE CONTROL STALLS — with a one-tick hold the bob lives, and a body in the glide '
    + 'corridor stops the block dead (`PushableBlock`\'s ctor pushes "Enemy" onto its '
    + 'own solids list)', !reached('brief'),
!reached('brief')
    ? `level ${arms.brief.status.level} at `
        + `(${arms.brief.status.x.toFixed(2)},${arms.brief.status.y.toFixed(2)}); `
        + `${arms.brief.fold.text}`
    : '⛔ it crossed TOO — the bob does not hold the door, so the hold arm proves '
        + 'nothing about the button and the route can drop it');

check('⛓⛓ THE BLOCK IS THE DOOR, AND THE GAME SAYS SO IN COORDINATES — `botMobiles` '
    + 'lists `PushableBlock` beside the bobs, so the shove\'s effect is a READOUT',
arms.hold.fold.blockEnd?.tx === 4 && arms.hold.fold.blockEnd?.ty === 4
    && arms.brief.fold.blockEnd?.tx === 3 && arms.brief.fold.blockEnd?.ty === 4,
`hold left it on ${JSON.stringify(arms.hold.fold.blockEnd)} (the model planned (4,4)); `
    + `brief left it on ${JSON.stringify(arms.brief.fold.blockEnd)} — one tile, then a `
    + 'body in the corridor');

check('⛓ THE BOB DIES IN THE HOLD ARM AND LIVES IN THE CONTROL — the one bit between '
    + 'the two tapes is the hold, so this is the traps',
arms.hold.fold.bobsMax === 1 && arms.hold.fold.bobsEnd === 0
    && arms.brief.fold.bobsMax === 1 && arms.brief.fold.bobsEnd === 1,
`hold: ${arms.hold.fold.text}\n      brief: ${arms.brief.fold.text}`);

check('the presser is safe — the block stands between the button and the bob, so the '
    + 'hold costs no health', arms.hold.status.hits === 0,
`hits ${arms.hold.status.hits} over ${plans.hold.tape.tick_count} ticks`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
