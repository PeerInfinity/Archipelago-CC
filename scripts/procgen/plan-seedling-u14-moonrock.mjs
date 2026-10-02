#!/usr/bin/env node
/**
 * plan-seedling-u14-moonrock — ⛓⛓⛓ U14-swim D1: `Moonrock.update`, WITNESSED ON
 * THE GAME.
 *
 * `Scenery/Moonrock.as` (whole, 201 lines). L0 places one, `moonrock@240,256
 * {tag 0}`. `Shield.removed()` arms `Moonrock.beam` (= `Main.beam`, a save
 * field), and the first L0 frame after it — while `!Game.moonrockSet` — runs:
 *
 * ```
 *   if ((beam && canBeam) || trigger) Game.freezeObjects = true;   // ① last frame's canBeam
 *   canBeam = FP.distance(x + 26, fallTo + 26, p.x, p.y) > 52 * 3/4;
 *   if ((beam && canBeam) || trigger) playersDirection(int(p.x > x + 26) * 2);
 *   if (beam && canBeam) { cameraTarget = rock; beamTime-- (300 = Main.FPS 60 * 5);
 *                          at 0: beam = false; trigger = true; }
 *   if (trigger) { y += 20; if (y >= fallTo) { y = fallTo; type = "Solid"; shake = 60;
 *                  cameraTimer = 90; Game.moonrockSet = true; trigger = false; } }
 *   else-branch (moonrockSet): snap an overlapping player to the rock's top; replace
 *     a Stairs under it with a Teleporter to `moonrock_target` and clear that room's
 *     tag 0; cameraTimer-- ; at 0: resetCamera, freezeObjects = false,
 *     playersDirection(-1).
 * ```
 *
 * ⛓ THE FRAMES (the rock is added after the Player — `Game.as:2345` against
 * `:2227` — and `World.addUpdate` prepends, so it updates BEFORE the player;
 * `Bot.update` reads the flag at the TOP of the frame, above both):
 *
 *   F1 (tape tick 0)  live. `canBeam` was false, so no freeze; the beam starts
 *                     (300 → 299) and the player moves.
 *   F2 (tick 1)       LIVE for the tape (the gate read false) and FROZEN for the
 *                     player: ① raises the flag before the player's update.
 *   F3 … F453         DEAD: 298 more beam frames (F3–F300), the fall F300–F362
 *                     (63 frames: −1000 + 20·63 = 260 ≥ 256), the 90-frame camera
 *                     hold F363–F452, and the release F453 — on which the rock
 *                     lowers the flag BEFORE the player updates, so the player
 *                     takes one step nobody observes, under the keys still held.
 *   ⇒ 451 dead frames, one live frozen tick, one ghost step.
 *
 * ⚠ `slash()`'s timer runs above `super.update()`, so the 20-frame double-tap
 * window drains through every one of those frames: a second press at t2 is a
 * fresh swing, NOT a dash (U13's refutation at t3 was exactly this).
 *
 * Two arms, both booted as route step 23 boots (`r9-solve-13-v2`'s MEASURED
 * latch, through the producer's `segmentBootFromLatch` — staged here as data):
 *   `u14-moonrock-beam` — `beam: true, rock_set: false`, the step's own boot.
 *     Sword at t0, released t1, sword again at t2; `right` held t0–t9; still to
 *     t20. Predicted per tick from the AS3 alone (`predictBeam`, which does not
 *     import the model).
 *   `u14-moonrock-set` — `beam: false, rock_set: true`, booted at (200,272)
 *     (the player at (208,280)) and walking right for 40 ticks into the SET
 *     rock, a 48x48 Solid at [240,288)×[256,304): the box may not enter x 240
 *     (`x + 2 <= 240`) — the game stops at 237.95 — where a model without the
 *     rock walks on.
 *
 * ⛔ THE KEYS ARE A FIXED SCHEDULE and the tapes were emitted, and recorded on
 * the game, BEFORE `moonrock.js` existed (witness first); `--check` re-derives
 * them after.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-u14-moonrock.mjs           (write)
 *   node scripts/procgen/plan-seedling-u14-moonrock.mjs --check   (compare)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();

/**
 * Route step 23's staging, VERBATIM from the producer's derivation of
 * `r9-solve-13-v2`'s measured latch (`latch-r9-solve-13-v2-390e3d2d5658`, the
 * game's own `save.*`, `rng.*` and `fp.seed` at that segment's L0 arrival).
 * Only `beam`/`rock_set` and the boot position differ between the two arms.
 */
const PERSISTENCE = Object.freeze([
    [3, 0], [5, 0], [8, 0], [8, 1], [10, 0], [11, 0], [15, 0], [15, 2], [15, 3],
    [16, 0], [16, 3], [16, 4], [16, 6], [16, 7], [17, 29], [18, 0], [19, 0], [19, 1],
    [20, 0], [20, 1], [20, 2], [20, 4],
].map(([level, tag]) => Object.freeze({ level, tag, note: '' })));
const ITEMS = Object.freeze({
    hasSword: true, hasGhostSword: false, hasShield: true, hasFire: false,
    hasWand: false, hasFireWand: false, canSwim: false, hasSpear: false,
    hasDarkShield: false, hasDarkSuit: false, hasDarkSword: false, hasFeather: false,
    hasTorch: false,
});
const seamFor = ({ beam, rockSet }) => ({
    items: { ...ITEMS },
    beam,
    rock_set: rockSet,
    hits_max: 3,
    first_use: false,
    extended: false,
    time: 12241,
    primary: 0,
    secondary: 0,
    grass_cut: 192,
    cutscene: [false, false, false, false],
    menu_state: 0,
    music: { set: 'Room', index: 1 },
});
const SAVE = Object.freeze({ totem_parts: [], keys: [0], seal_parts: [0] });
const RNG = Object.freeze({ seed: 85136665, split: true, cosmetic: 1995363572, fp: 1341168923 });
const PINS = Object.freeze(['sound', 'dead_frames']);

function stage(boot, flags) {
    return createLevelRun({
        levelSource,
        boot,
        noclip: false,
        noHazards: [],
        noDamage: false,
        grants: [],
        persistence: PERSISTENCE.map((p) => ({ ...p })),
        despawn: [],
        equips: [],
        pins: [...PINS],
        save: { ...SAVE, keys: [...SAVE.keys], seal_parts: [...SAVE.seal_parts] },
        rng: { ...RNG },
        seam: seamFor(flags),
    });
}

function tapeJson(name, boot, flags, perTick, description) {
    const folded = buildTape(perTick, boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        game: 'seedling',
        name,
        boot,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: PERSISTENCE.map((p) => ({ ...p })),
        equips: [],
        pins: [...PINS],
        save: { ...SAVE, keys: [...SAVE.keys], seal_parts: [...SAVE.seal_parts] },
        rng: { ...RNG },
        seam: seamFor(flags),
        tick_count: perTick.length,
        inputs: folded.inputs,
        tape_version: 8,
    };
    const parsed = parseTape({ ...tape, description });
    return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
}

function emit(name, json) {
    const path = join(TAPES, `${name}.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${name} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
}

/** Drive the MODEL with the fixed keys; a refusal is returned, not thrown. */
function driveModel(boot, flags, perTick) {
    const run = stage(boot, flags);
    const at = [{ t: 0, x: run.state.x, y: run.state.y, level: run.level }];
    try {
        for (const held of perTick) {
            run.advance(held);
            at.push({ t: run.ticksCompleted, x: run.state.x, y: run.state.y, level: run.level });
        }
    } catch (e) {
        return { run, at, refused: e.message.split('\n')[0] };
    }
    return { run, at, refused: null };
}

/**
 * ⛓ THE AS3 PREDICTION, from `Moonrock.as` alone — no model import. Frames are
 * numbered from F1, the first frame the world updates (tape tick 0). Returns the
 * frame each phase ends on and the dead-frame count the tape owes.
 */
function predictBeam({ rockX, fallTo, playerX }) {
    const BEAM = 60 * 5;          // `Main.FPS * 5` — `Main.as:27` is 60, not 30
    const FALL_RATE = 20;
    const HOLD = 90;
    let y = -1000;
    let beamTime = BEAM;
    let beamEnds = null;
    let landsAt = null;
    const rockY = [];
    for (let f = 1; landsAt === null; f += 1) {
        let trigger = beamEnds !== null;
        if (beamEnds === null) {
            beamTime -= 1;
            if (beamTime <= 0) { beamEnds = f; trigger = true; }
        }
        if (trigger) {
            y += FALL_RATE;
            if (y >= fallTo) { y = fallTo; landsAt = f; }
        }
        rockY.push(y);
    }
    const releaseAt = landsAt + HOLD + 1;
    return {
        beamFrames: BEAM,
        beamEnds,
        fallFrames: landsAt - beamEnds + 1,
        landsAt,
        releaseAt,
        // F2 is the live frozen tick; F3 … release are dead.
        dead: releaseAt - 2,
        facing: (playerX > rockX + 26 ? 1 : 0) * 2,
        rockY,
    };
}

const NO_KEYS = new Set();
const keysAt = (spans, t) => new Set(spans.filter(([, a, b]) => t >= a && t < b).map(([k]) => k));

let beamResult = null;
{
    const NAME = 'u14-moonrock-beam';
    const BOOT = Object.freeze({ level: 0, x: 48, y: 192 });
    const FLAGS = Object.freeze({ beam: true, rockSet: false });
    const TICKS = 20;
    const SPANS = [['primary', 0, 1], ['right', 0, 10], ['primary', 2, 3]];
    const perTick = Array.from({ length: TICKS }, (_, t) => keysAt(SPANS, t));
    const description = '⛓⛓⛓ U14-swim D1 — THE MOONROCK BEAM, WITNESSED. L0 booted exactly as route '
        + 'step 23 boots (r9-solve-13-v2\'s measured latch: `beam: true`, `rock_set: false`, the '
        + 'shield, the Red Key), at (56,200). Sword pressed t0, released t1, pressed again t2; '
        + '`right` held t0–t9; nothing to t20. `Moonrock.update` (`Scenery/Moonrock.as:66-153`) '
        + 'updates before the Player: F1 (t0) is live and starts the 300-frame beam (`Main.FPS` 60 '
        + '* 5); F2 (t1) is a live tape tick with a frozen player; then 451 DEAD frames — the rest '
        + 'of the beam, the 63-frame fall from y −1000 to 256, the 90-frame camera hold — and a '
        + 'release frame on which the player steps once, unobserved, under `right`. `slash()`\'s '
        + '20-frame double-tap window drains through the freeze, so t2\'s press is a fresh swing, '
        + 'not a dash. The landing sets `rockSet`, `Game.shake = 60`, and replaces '
        + '`stairsdown@256,272` with a teleporter to `moonrock_target`, clearing {2,0}. Fixed keys. '
        + 'Authored by scripts/procgen/plan-seedling-u14-moonrock.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, FLAGS, perTick, description));
    const p = predictBeam({ rockX: 240, fallTo: 256, playerX: 56 });
    console.log(`  predicted: beam ends F${p.beamEnds}; fall ${p.fallFrames} frames, lands F${p.landsAt}; `
        + `release F${p.releaseAt}; ${p.dead} dead frames after the live frozen tick t1; `
        + `facing ${p.facing} through the span`);
    check('⛓ the AS3 arithmetic: 300 beam + 63 fall + 90 hold, minus the two LIVE frames F1 and F2',
        p.dead === 451 && p.fallFrames === 63 && p.landsAt === 362 && p.releaseAt === 453,
        `dead ${p.dead}, fall ${p.fallFrames}, lands F${p.landsAt}, release F${p.releaseAt}`);
    beamResult = { NAME, BOOT, FLAGS, perTick, predicted: p, ...driveModel(BOOT, FLAGS, perTick) };
    const { run, at, refused } = beamResult;
    console.log(`  model: ${refused ? `REFUSED — ${refused.slice(0, 200)}` : 'walks it'}; `
        + `x t0..t5 ${at.slice(0, 6).map((a) => a.x).join(' ')}`);
    check('the model walks the tape (no refusal)', refused === null, refused ?? '');
    const mr = run.moonrock ?? { events: [] };
    const ev = (what) => mr.events.filter((e) => e.what === what);
    const rel = ev('released')[0];
    check('⛓⛓ the model\'s span is the AS3 reading: beam starts on t0\'s frame, the freeze on t1 '
        + '(a live tape tick), and the release after the predicted dead frames',
    ev('beam-started')[0]?.t === 0 && ev('frozen')[0]?.t === 1 && rel?.deadFrames === p.dead,
    `beam-started t${ev('beam-started')[0]?.t}, frozen t${ev('frozen')[0]?.t}, `
        + `released after ${rel?.deadFrames} dead frames (predicted ${p.dead})`);
    check('⛓ the facing the beam writes is the predicted one (the player is LEFT of the rock: 0)',
        ev('beam-started')[0]?.facing === p.facing, `${ev('beam-started')[0]?.facing}`);
    check('⛓ the swing pressed at t0 is BURNED by the freeze, and t2\'s press is a fresh swing: '
        + 'no dash (t3 is the game\'s 59.25, not 61.25)',
    ev('swing-burned').length === 1 && at[3]?.x === 59.25, `x t3 ${at[3]?.x}`);
    check('⛓ the rock lands at its placement and the run ends with beam false, rockSet true',
        ev('landed')[0]?.y === 256 && mr.beam === false && mr.rockSet === true,
        `landed y ${ev('landed')[0]?.y}; beam ${mr.beam}, rockSet ${mr.rockSet}`);
    check('⛓ the stairs under the set rock are replaced and {2,0} is cleared (the game\'s latch '
        + 'carries it)', (run.earnedClears ?? []).some((c) => c.level === 2 && c.tag === 0),
    JSON.stringify((run.earnedClears ?? []).filter((c) => c.level === 2)));
    check('⛓ the model\'s clock owes the span: frozenFramesOwed is the dead count',
        run.frozenFramesOwed === p.dead, `${run.frozenFramesOwed}`);
}

{
    const NAME = 'u14-moonrock-set';
    const BOOT = Object.freeze({ level: 0, x: 200, y: 272 });
    const FLAGS = Object.freeze({ beam: false, rockSet: true });
    const TICKS = 40;
    const perTick = Array.from({ length: TICKS }, () => new Set(['right']));
    const description = '⛓⛓⛓ U14-swim D1 — THE SET MOONROCK IS A SOLID. L0 booted with route step '
        + '23\'s staging but `beam: false, rock_set: true` — a visit after the landing — at '
        + '(208,280), holding `right` for 40 ticks. `Moonrock`\'s ctor places a set rock AT `fallTo` '
        + 'with `type = "Solid"` (`Scenery/Moonrock.as:50-54`): a 48x48 box at [240,288)×[256,304), '
        + 'so the walk stops at x 238 (the player\'s 4x5 box ends at x + 2). Its first update finds '
        + '`cameraTimer` 0 and lowers the freeze nobody raised; it also replaces the stairs under it '
        + 'and clears {2,0}. No beam: `beam` is false. Fixed keys. Authored by '
        + 'scripts/procgen/plan-seedling-u14-moonrock.mjs.';
    emit(NAME, tapeJson(NAME, BOOT, FLAGS, perTick, description));
    const { run, at, refused } = driveModel(BOOT, FLAGS, perTick);
    const maxX = Math.max(...at.map((a) => a.x));
    console.log(`  model: ${refused ? `REFUSED — ${refused.slice(0, 200)}` : 'walks it'}; max x ${maxX}; `
        + `last ${JSON.stringify(at.at(-1))}`);
    check('the model walks the tape (no refusal)', refused === null, refused ?? '');
    // The AS3 bound is the box's right edge, x + 2 <= 240; the game stops at
    // 237.95, one sub-pixel step short of it (`moveX` refuses the whole step).
    check('⛓ the walk is BLOCKED by the set rock — the box never enters x 240', maxX + 2 <= 240,
        `model max x ${maxX}`);
    const mr = run.moonrock ?? { events: [] };
    check('⛓ no beam, no freeze: a set rock\'s first update only runs the release arm',
        !mr.events.some((e) => e.what === 'frozen') && run.frozenFramesOwed === 0
            && mr.rockSet === true && mr.beam === false,
        `events ${mr.events.map((e) => e.what).join(',')}; frozen ${run.frozenFramesOwed}`);
    check('⛓ and the stairs under it are replaced on that update, clearing {2,0}',
        (run.earnedClears ?? []).some((c) => c.level === 2 && c.tag === 0),
        JSON.stringify((run.earnedClears ?? []).filter((c) => c.level === 2)));
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
