#!/usr/bin/env node
/**
 * plan-seedling-hammer-bw-bombstand — ⛓⛓⛓ SEEDLING HAMMER-PHASE BW, D2: THE PRESS KILL'S STAND, PRICED AGAINST THE
 * LOBBER, ON THE GAME.
 *
 * Fidelity MOVINGWAIT's hand-over: with `MOVING_WAIT` ON, leg 381 (L40, the L42 arrival) paces out the latched hold of
 * `buttonroom@272,208` and then kills `spinner@192,128` by press. `deriveStrike` picks the stance (248,184) at t1099;
 * the walk arrives about t1127 and stands until the press, and `bombpusher@112,128#7`, launched at t1125 at the
 * arriving player, explodes on the stance at t1156 (the game agrees on the tick). With `PRESS_KILL_BOMBS` ON the
 * derivation asks the lobber's forecast of the stand, refuses (248,184) by name and strikes from (232,184).
 *
 * The staging is fidelity's (`l40buttonStaging`, the survey's construction re-pointed at the atlas arrival (848,16)),
 * solved by `solveSegment` with `MOVING_WAIT` and `PRESS_KILL_BOMBS` ON, at the contact defaults (`strikeIframeLapse`
 * and `bombBlastBody` ON since their flips). The ON solve RETURNS at t1667 with no refusal and no hit, and the
 * witness tape is that whole walk: `#11`'s blast lands on `spinner@192,160` (fidelity's BOMB BLAST ON BODIES), and the
 * walk is fidelity WANDHOLD's game witness `wandhold-l42-371-paced`, key for key.
 *
 * `--check` asserts, in the model: the pre-lapse control below; ON at the defaults the solve returns at t1667, takes no
 * hit, its first press lands on `spinner@192,128`, it is `wandhold-l42-371-paced` key for key, and the committed tape is
 * byte-identical; and OFF at the defaults is the same walk as ON. The GAME is asked with
 * `probe-seedling-bombpusher.mjs --file=<tape> --out=<rows>` (p4f, headless, damage on), and `--samples=<rows>`
 * compacts its rows into `<NAME>.game.json` beside the tape.
 *
 * ⚖ THE INTERIM PIN IS RETIRED (hammer-phase PDS, 2026-10-24; ⚖ user, *"Yes, I approve launching all of these"*,
 * the planner's brief: "retire BW-bombstand's `strikeIframeLapse` INTERIM pin — its retirement condition is met on
 * main"). The producer runs at the contact defaults. With the lapse ON the stand no longer meets `#7`, so `PRESS_KILL_BOMBS`
 * refuses nothing on this staging: OFF and ON walk the same 1667 keys (measured, a `--check` row). BW's refusal is
 * the PRE-LAPSE walk's, and the control row below keeps it. The new walk was re-witnessed on the game (p4f, headless,
 * damage on): the model meets the game's rows at every sampled tick (`hammerPressBombs.test.js`).
 *   ⛓ KEPT — the pre-lapse control (`strikeIframeLapse` OFF, `PRESS_KILL_BOMBS` OFF): the stand on (248,184) takes
 *     `#7` on t1157's ledger row. It is BW's reason, and the only walk in this staging where the forecast refuses a
 *     stand.
 *   ⛓ RETIRED — "ON, `bombBlastBody` OFF: the solve stops on `#10`'s blast on `bob@272,112`". It was the reason the old
 *     tape was cut at t1293. The tape is no longer cut, and that stop is fidelity BOMBBLAST's own row
 *     (`bombBlastBody` OFF), not this witness's.
 *   ⛓ RETIRED — "the INTERIM pin's witness, lapse ON: returns at t1667". It is now the witness itself (the ON row).
 * The pin's history follows.
 * ⚖ PINNED `strikeIframeLapse` OFF — an INTERIM (hammer-phase planner, with fidelity planning-8's OK, 2026-10-15).
 * This staging witnesses BW's stand under the PRE-LAPSE walk, so `bombStandSolve` and `bombStandAccount` run with the
 * lapse OFF whatever the default. Fidelity's lapse flip (`7a20beb2fd`) changed the walk and its re-pin list missed this
 * producer (it is not in CI). With the lapse ON the OFF stand no longer takes `#7`, and the ON solve stops at t1339 on
 * `#11`'s Explosion reaching `spinner@192,160`: a bomb blast on a BODY, the interaction fidelity's held row (wave-18
 * BOMB BLAST ON BODIES, leg 381) will model. ⛔ RETIRE THIS PIN with that row: `--check`'s lapse-ON row records the
 * t1339 stop as the witness that row flips (⚖ model the game interaction, don't plan around it).
 * ⛓ FLIPPED (fidelity planning-12, wave-28 stack, 2026-10-23): `bombBlastBody` is ON by default (⚖ user, WANDHOLD
 * "Flip both ON"), and the lapse-ON row now RETURNS at t1667 with no refusal and 0 hits (#11 kills `spinner@192,160`
 * at t1339; fidelity BOMBBLAST D4 measured the same). The pin's retirement is hammer's call; until then the two
 * pre-flip rows are ⛓ controls that name `bombBlastBody` OFF: the tape witnesses the stop on #10's blast on
 * `bob@272,112`, which the ON arm walks through.
 *
 * ⛔ NOT the roster: a witness kept beside its samples (`fixtures/hammer-bw-bombstand-witness/`, hammer-phase G1's
 * shape).
 *
 * Run (each solve takes 15–40 s on a cloud box; --check runs three: the pre-lapse control, ON, and OFF):
 *   node scripts/procgen/plan-seedling-hammer-bw-bombstand.mjs                     # write the tape
 *   node scripts/procgen/plan-seedling-hammer-bw-bombstand.mjs --check             # exit 1 on drift
 *   node scripts/procgen/plan-seedling-hammer-bw-bombstand.mjs --samples=<rows>    # compact the probe's game rows
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
export const WITNESS_DIR = join(MODULE, 'fixtures', 'hammer-bw-bombstand-witness');

export const NAME = 'hammer-bw-l42-381-bombstand';
export const BOOT = Object.freeze({ level: 40, x: 848, y: 16 });
export const BODY = 'spinner@192,128';
/** The witness's length: the ON solve returns here (the pre-PDS tape was cut at t1293, before `#10`'s blast on a Bob). */
export const CUT = 1667;

/** Leg 381's atlas staging (fidelity's `l40buttonStaging`). */
export async function bombStandStaging() {
    const { l40buttonStaging } = await import(join(HERE, 'plan-seedling-l40button-witness.mjs'));
    return l40buttonStaging({ ...BOOT });
}

/**
 * One `solveSegment` with `MOVING_WAIT` ON and `PRESS_KILL_BOMBS` = `enabled`: the executed keys and the outcome.
 * `lapse` pins `strikeIframeLapse` and `blastBody` pins `bombBlastBody` when given; otherwise the defaults' (the
 * INTERIM pin is retired, above).
 * ⚖ THE STRIKE FLOOR IS PINNED OFF HERE (hammer-phase SFF, 2026-10-23). `STRIKE_ETA_FLOOR` ships ON since SFF, and
 * this witness is a walk the game played under the floor OFF: its solve is planned as it was recorded, so the tape
 * stays byte-identical. ⛔ Re-recording it ON would rewrite a game-witnessed tape from the model alone.
 */
export async function bombStandSolve(staging, enabled, { lapse, blastBody } = {}) {
    const { solveSegment, withMovingWait, withStrikeEtaFloor } = await import(join(MODULE, 'solverBot.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const { withPressKillBombs } = await import(join(MODULE, 'pressKillCost.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { L40BUTTON_GOAL } = await import(join(HERE, 'plan-seedling-l40button-witness.mjs'));
    const run = createRunForStaging(staging, atlasLevelSource());
    // the executed keys, as the run took them (a plain `Error` carries no `perTick`)
    const keys = [];
    const advance = run.advance;
    run.advance = (held) => { keys.push(new Set(held)); return advance.call(run, held); };
    let message = null;
    const pins = { ...(lapse === undefined ? {} : { strikeIframeLapse: lapse }),
        ...(blastBody === undefined ? {} : { bombBlastBody: blastBody }) };
    withStrikeEtaFloor(false, () => withContactFidelity(pins, () => withMovingWait(true, () => withPressKillBombs(enabled, () => {
        try {
            solveSegment({ run, goals: [JSON.parse(JSON.stringify(L40BUTTON_GOAL))], name: NAME, boot: staging.boot,
                dashMode: 'all' });
        } catch (e) {
            message = String(e?.message ?? e);
        }
    }))));
    return { keys, message, hits: run.ledger('playerHits').map((h) => ({ t: h.t, source: h.source, id: h.id })) };
}

/** The model's account of a prefix: the hits, the press landings, the bombs' blasts (`lapse` pins the lapse when given). */
export async function bombStandAccount(staging, keys, { lapse } = {}) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const run = createRunForStaging(staging, atlasLevelSource());
    withContactFidelity(lapse === undefined ? {} : { strikeIframeLapse: lapse }, () => { for (const k of keys) run.advance(k); });
    return {
        hits: run.ledger('playerHits').map((h) => ({ t: h.t, source: h.source, id: h.id })),
        landed: (run.spinnerPressHits ?? []).filter((h) => h.landed).map((h) => ({ t: h.t, id: h.id, hits: h.hits })),
        blasts: (run.ledger('bombEvents') ?? []).filter((e) => e.what === 'blast')
            .map((e) => ({ t: e.t, id: e.id, at: e.at, hitPlayer: e.hitPlayer })),
    };
}

/**
 * The last sampled tick: the walk's last tick (`CUT`) is the game's Totem Part pickup freeze, where the game clears the
 * lobber's bomb rows and the model's observation does not follow (measured at PDS: every tick 1..1666 agrees, t1667
 * does not; fidelity WANDHOLD's witness of this walk stops at 1666 for the same reason).
 */
export const SAMPLED_UPTO = CUT - 1;

/** The probe's game rows (`--out`), compacted: per tick the player, hits, camera, Bomb rows and the lobber's anim. */
function compactSamples(path) {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const samples = raw.game.filter((g) => g.t >= 1 && g.t <= SAMPLED_UPTO).map((g) => ({
        t: g.t, p: [g.player.x, g.player.y], hits: g.hits, cam: g.camera, anim: g.pusher?.anim ?? null,
        bombs: g.bombs.map((b) => [b.x, b.y, b.vx, b.vy]) }));
    return { name: NAME, page: raw.page, upto: SAMPLED_UPTO,
        disagreements: (raw.disagreements ?? []).filter((d) => Number(/^t (\d+):/.exec(d)?.[1]) <= SAMPLED_UPTO),
        recordedBy: 'scripts/procgen/probe-seedling-bombpusher.mjs --file=<tape> --out, compacted by '
            + 'plan-seedling-hammer-bw-bombstand.mjs --samples',
        note: 'the GAME\'s player, hits, camera, Bomb rows and lobber anim at each sampled tick 1..upto', samples };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const SAMPLES = process.argv.find((a) => a.startsWith('--samples='))?.slice(10) ?? null;
    if (SAMPLES) {
        const out = compactSamples(SAMPLES);
        mkdirSync(WITNESS_DIR, { recursive: true });
        const path = join(WITNESS_DIR, `${NAME}.game.json`);
        writeFileSync(path, `${JSON.stringify(out)}\n`);
        console.log(`wrote ${path.slice(REPO.length + 1)} (${out.samples.length} samples)`);
        return;
    }
    const CHECK = process.argv.includes('--check');
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const staging = await bombStandStaging();
    if (CHECK) {
        // ⛓ KEPT — the pre-lapse control: BW's reason (the stand the lobber's forecast refuses)
        const pre = await bombStandSolve(staging, false, { lapse: false });
        const h = pre.hits.find((x) => x.source === 'bomb');
        check('⛓ the pre-lapse control (strikeIframeLapse OFF, PRESS_KILL_BOMBS OFF): the press kill\'s stand takes '
            + 'bombpusher@112,128#7 on t1157\'s ledger row', h?.id === 'bombpusher@112,128#7' && h?.t === 1157,
        JSON.stringify(pre.hits));
    }
    const on = await bombStandSolve(staging, true);
    check('ON at the defaults (lapse ON, bombBlastBody ON): the solve returns at t1667 with no refusal and no hit',
        on.keys.length === CUT && on.message === null && on.hits.length === 0,
        `${on.keys.length} executed; ${(on.message ?? 'no refusal').slice(0, 200)}; hits ${JSON.stringify(on.hits)}`);
    const keys = on.keys.slice(0, CUT);
    const a = await bombStandAccount(staging, keys);
    check('⛓⛓ ON: the walk takes no hit', a.hits.length === 0, JSON.stringify(a.hits));
    const first = a.landed[0];
    check(`⛓⛓ ON: the first press lands on ${BODY}`, first?.id === BODY, JSON.stringify(a.landed.slice(0, 3)));
    const keyOf = (set) => [...set].sort().join('+');
    if (CHECK) {
        const { heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));
        const w = JSON.parse(readFileSync(join(MODULE, 'fixtures', 'bomb-witness', 'wandhold-l42-371-paced.json'), 'utf8'));
        const wt = parseTape(JSON.stringify(w.tape));
        const same = keys.length === wt.tick_count && keys.every((k, i) => keyOf(k) === keyOf(heldKeysAt(wt, i)));
        check('⛓ ON: the walk is fidelity WANDHOLD\'s game witness wandhold-l42-371-paced, key for key', same,
            `${keys.length} vs ${wt.tick_count} ticks`);
        const off = await bombStandSolve(staging, false);
        check('⛓ OFF at the defaults walks the same keys as ON (with the lapse the stand meets no bomb, so the forecast '
            + 'refuses nothing here)', off.keys.length === on.keys.length
            && off.keys.every((k, i) => keyOf(k) === keyOf(on.keys[i])), `${off.keys.length} vs ${on.keys.length}`);
    }

    const built = buildStagedTape({ staging, perTick: keys, name: NAME });
    const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE BW, D2 — THE PRESS KILL\'S STAND SEES THE LOBBER\'S BOMBS '
        + '(`PRESS_KILL_BOMBS` ON, `MOVING_WAIT` ON, the contact defaults since hammer-phase PDS retired the lapse pin). '
        + 'Leg 381\'s atlas staging (fidelity\'s `l40buttonStaging`, the L42 arrival (848,16)); `solveSegment`\'s whole '
        + `walk, ${CUT} ticks (= wandhold-l42-371-paced). Pre-lapse, OFF's strike stood on (248,184) and #7 hit it at `
        + 't1156; at the defaults OFF walks the same keys as ON. ON '
        + `landings ${a.landed.map((h) => `t${h.t} ${h.id} hits ${h.hits}`).join(' · ')}; blasts `
        + `${a.blasts.map((b) => `t${b.t} ${b.id.split('#')[1]} (${b.at.x},${b.at.y})${b.hitPlayer ? ' HIT' : ''}`)
            .join(' · ')}; player hits ${a.hits.length}. Not a roster tape (kept beside its samples). Authored by `
        + 'scripts/procgen/plan-seedling-hammer-bw-bombstand.mjs.';
    const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
    parseTape(JSON.parse(json));
    const path = join(WITNESS_DIR, `${NAME}.tape.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${NAME} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        mkdirSync(WITNESS_DIR, { recursive: true });
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
    console.log(`## ${NAME}: ${keys.length} ticks; ${description}`);
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}
