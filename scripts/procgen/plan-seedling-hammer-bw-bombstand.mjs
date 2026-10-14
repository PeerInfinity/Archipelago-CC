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
 * solved by `solveSegment` with `MOVING_WAIT` and `PRESS_KILL_BOMBS` ON. The ON solve does not finish: at t1294
 * `#10` — aimed at the player walking to the next strike — explodes on the chaser `bob@272,112`, the Explosion's
 * unstaged `"Enemy"` arm (fidelity's wave 16), which `levelRun` refuses by name. The witness tape is the executed
 * prefix CUT ONE TICK BEFORE that blast (`CUT`), so the model replays it whole.
 *
 * `--check` asserts, in the model: OFF the player is hit by `#7` on t1157's ledger row standing on (248,184); ON the
 * prefix takes no hit, its first press lands on `spinner@192,128`, and the committed tape is byte-identical. The GAME
 * is asked with `probe-seedling-bombpusher.mjs --file=<tape> --out=<rows>` (p4f, headless, damage on), and
 * `--samples=<rows>` compacts its rows into `<NAME>.game.json` beside the tape.
 *
 * ⛔ NOT the roster: a witness kept beside its samples (`fixtures/hammer-bw-bombstand-witness/`, hammer-phase G1's
 * shape).
 *
 * Run (each solve takes 3–4 minutes on a cloud box; --check runs two):
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
/** The executed prefix is cut here: `#10`'s blast on `bob@272,112` is the advance that completes t1294. */
export const CUT = 1293;

/** Leg 381's atlas staging (fidelity's `l40buttonStaging`). */
export async function bombStandStaging() {
    const { l40buttonStaging } = await import(join(HERE, 'plan-seedling-l40button-witness.mjs'));
    return l40buttonStaging({ ...BOOT });
}

/** One `solveSegment` with `MOVING_WAIT` ON and `PRESS_KILL_BOMBS` = `enabled`: the executed keys and the outcome. */
export async function bombStandSolve(staging, enabled) {
    const { solveSegment, withMovingWait } = await import(join(MODULE, 'solverBot.js'));
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
    withMovingWait(true, () => withPressKillBombs(enabled, () => {
        try {
            solveSegment({ run, goals: [JSON.parse(JSON.stringify(L40BUTTON_GOAL))], name: NAME, boot: staging.boot,
                dashMode: 'all' });
        } catch (e) {
            message = String(e?.message ?? e);
        }
    }));
    return { keys, message, hits: run.ledger('playerHits').map((h) => ({ t: h.t, source: h.source, id: h.id })) };
}

/** The model's account of a prefix: the hits, the press landings, the bombs' blasts. */
export async function bombStandAccount(staging, keys) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const run = createRunForStaging(staging, atlasLevelSource());
    for (const k of keys) run.advance(k);
    return {
        hits: run.ledger('playerHits').map((h) => ({ t: h.t, source: h.source, id: h.id })),
        landed: (run.spinnerPressHits ?? []).filter((h) => h.landed).map((h) => ({ t: h.t, id: h.id, hits: h.hits })),
        blasts: (run.ledger('bombEvents') ?? []).filter((e) => e.what === 'blast')
            .map((e) => ({ t: e.t, id: e.id, at: e.at, hitPlayer: e.hitPlayer })),
    };
}

/** The probe's game rows (`--out`), compacted: per tick the player, hits, camera, Bomb rows and the lobber's anim. */
function compactSamples(path) {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const samples = raw.game.filter((g) => g.t >= 1 && g.t <= CUT).map((g) => ({
        t: g.t, p: [g.player.x, g.player.y], hits: g.hits, cam: g.camera, anim: g.pusher?.anim ?? null,
        bombs: g.bombs.map((b) => [b.x, b.y, b.vx, b.vy]) }));
    return { name: NAME, page: raw.page, upto: CUT, disagreements: raw.disagreements ?? null,
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
        const off = await bombStandSolve(staging, false);
        const h = off.hits.find((x) => x.source === 'bomb');
        check('OFF (MOVING_WAIT ON): the press kill\'s stand takes bombpusher@112,128#7 on t1157\'s ledger row',
            h?.id === 'bombpusher@112,128#7' && h?.t === 1157, JSON.stringify(off.hits));
    }
    const on = await bombStandSolve(staging, true);
    check('⛓ ON: the solve runs past the press kill\'s first landing (it stops on #10\'s blast on bob@272,112, the '
        + 'unstaged "Enemy" arm)', on.keys.length > CUT && /bombpusher@112,128#10 .* reaches the chaser bob@272,112/
        .test(on.message ?? ''), `${on.keys.length} executed; ${(on.message ?? 'no refusal').slice(0, 160)}`);
    const keys = on.keys.slice(0, CUT);
    const a = await bombStandAccount(staging, keys);
    check('⛓⛓ ON: the prefix takes no hit', a.hits.length === 0, JSON.stringify(a.hits));
    const first = a.landed[0];
    check(`⛓⛓ ON: the first press lands on ${BODY}`, first?.id === BODY, JSON.stringify(a.landed.slice(0, 3)));

    const built = buildStagedTape({ staging, perTick: keys, name: NAME });
    const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE BW, D2 — THE PRESS KILL\'S STAND SEES THE LOBBER\'S BOMBS '
        + '(`PRESS_KILL_BOMBS` ON, `MOVING_WAIT` ON). Leg 381\'s atlas staging (fidelity\'s `l40buttonStaging`, the '
        + `L42 arrival (848,16)); \`solveSegment\`'s executed prefix cut at t${CUT}, one tick before #10 explodes on `
        + 'bob@272,112 (the unstaged "Enemy" arm). OFF the strike stood on (248,184) and #7 hit it at t1156; ON '
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
