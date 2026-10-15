#!/usr/bin/env node
/**
 * plan-seedling-hammer-dd-walkkill — ⛓⛓⛓ SEEDLING HAMMER-PHASE DD: A PRESS KILL WHOSE TARGET DIED ON THE WALK, ON
 * THE GAME.
 *
 * The kill rung's chaser arm (`solveSegmentUnder`, `-> kill (<id>) by press`) walks to its stance and then dwells
 * until the body has left `strikeBodies`. The walk carries the strike policy, so its presses can kill the body first;
 * `runDwell` then refuses (*"ALREADY TRUE before a tick is spent"*). With `PRESS_KILL_DONE_ON_WALK` ON the arm reads
 * the press ledger, records the kill as done and returns to the ladder.
 *
 * The staging is survey step 50's (`bobsoldier2Staging`: L30, goals [collect Torchpickup (64,64), reach-exit
 * stairsup@224,160 → L32]) booted at (32,112) instead of (176,48). At the DEFAULTS this reproduces the shape fidelity
 * CEREMONYSHOVE measured on step 50 under `strikeIframeLapse` + `ceremonyShove` (neither is needed here): the exit's
 * keylock-stance walk climbs to `kill (bobsoldier@48,80) by press`, the walk to the stance kills the body, and OFF the
 * dwell refuses at t174. ON the solve reaches L32.
 *
 * `--check` asserts, in the model: OFF refuses with `runDwell`'s already-true sentence at t174 on that arm; ON solves,
 * its chaser record carries `killedOnWalk` (a sword press of the walk, `killed: true`), no player hit, and the
 * committed tape is byte-identical. The GAME is asked with `probe-seedling-chaser-mobiles.mjs --class=BobSoldier
 * --file=<tape> --player-hits --out=<rows>` (p4f, headless), and `--samples=<rows>` compacts its rows into
 * `<NAME>.game.json` beside the tape.
 *
 * ⛔ NOT the roster: a witness kept beside its samples (`fixtures/hammer-dd-walkkill-witness/`, hammer-phase G1's
 * shape).
 *
 * Run (each solve takes a few seconds):
 *   node scripts/procgen/plan-seedling-hammer-dd-walkkill.mjs                     # write the tape
 *   node scripts/procgen/plan-seedling-hammer-dd-walkkill.mjs --check             # exit 1 on drift
 *   node scripts/procgen/plan-seedling-hammer-dd-walkkill.mjs --samples=<rows>    # compact the probe's game rows
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';
argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
export const WITNESS_DIR = join(MODULE, 'fixtures', 'hammer-dd-walkkill-witness');
export const NAME = 'hammer-dd-l30-walkkill';
export const BOOT = Object.freeze({ level: 30, x: 32, y: 112 });
export const BODY = 'bobsoldier@48,80';
/** OFF, the tick `runDwell` refuses at (the walk to the stance is done; the body already left `strikeBodies`). */
export const OFF_REFUSAL_TICK = 174;

/** Survey step 50's staging (`bobsoldier2Staging`), booted at `BOOT`. */
export async function walkKillStaging() {
    const { bobsoldier2Staging } = await import(join(HERE, 'plan-seedling-bobsoldier2.mjs'));
    const staging = await bobsoldier2Staging();
    return { ...staging, boot: { ...staging.boot, ...BOOT } };
}

/**
 * The solve's `shouldStop`: stop once the kill rung's chaser arm has been entered more than `KILL_CHASER_CAP` times
 * (the `kill-chaser` site, once per entry; these solves enter it ONCE). An arm that returns to the ladder without
 * spending a tick re-enters itself forever, and a synchronous loop is one no test timeout can interrupt.
 */
export const KILL_CHASER_CAP = 16;
function armCap() {
    let entries = 0;
    return (site) => site === 'kill-chaser' && (entries += 1) > KILL_CHASER_CAP;
}

/** One `solveSegment` with `PRESS_KILL_DONE_ON_WALK` = `enabled`: the executed keys, the outcome and the records. */
export async function walkKillSolve(staging, enabled) {
    const { solveSegment, withPressKillDoneOnWalk } = await import(join(MODULE, 'solverBot.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { BOBSOLDIER2_STEP50 } = await import(join(HERE, 'plan-seedling-bobsoldier2.mjs'));
    const run = createRunForStaging(staging, atlasLevelSource());
    // the executed keys, as the run took them (a plain `Error` carries no `perTick`)
    const keys = [];
    const advance = run.advance;
    run.advance = (held) => { keys.push(new Set(held)); return advance.call(run, held); };
    let message = null;
    let records = null;
    withPressKillDoneOnWalk(enabled, () => {
        try {
            records = solveSegment({ run, goals: JSON.parse(JSON.stringify(BOBSOLDIER2_STEP50.goals)), name: NAME,
                boot: staging.boot, dashMode: 'all', shouldStop: armCap() }).records ?? [];
        } catch (e) {
            message = String(e?.message ?? e);
        }
    });
    return { keys, message, records, ticks: run.ticksCompleted, level: run.level,
        hits: run.ledger('playerHits').map((h) => ({ t: h.t, source: h.source, id: h.id })) };
}

/** The model's account of a tape's keys: the player hits and the body's sampled rows (`hits`, presence). */
export async function walkKillAccount(staging, keys) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const run = createRunForStaging(staging, atlasLevelSource());
    const body = [];
    for (const k of keys) {
        run.advance(k);
        const b = run.level === BOOT.level ? (run.entities('chasers') ?? []).find((c) => c.id === BODY) : null;
        body.push({ t: run.ticksCompleted, hits: b ? b.hits : null, strike: (run.entities('strikeBodies') ?? [])
            .some((c) => c.id === BODY) });
    }
    return { hits: run.ledger('playerHits').map((h) => ({ t: h.t, source: h.source, id: h.id })), body,
        level: run.level };
}

/**
 * The probe's every polled frame (`--frames`), compacted: the LAST frame at each tick (a pickup ceremony's frozen
 * frames share one tick number, and the first of them can still hold the previous tick's player): the level, the
 * player, its `hits`, and the BobSoldier rows. The run's end (`finished`) is kept as `end`.
 */
function compactSamples(path) {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const byTick = new Map();
    let end = null;
    for (const f of raw.frames) {
        if (f.status?.finished) end = { tick: f.status.tick, level: f.status.level, hits: f.status.hits };
        if (!Number.isInteger(f.tick) || f.tick < 1 || !f.player) continue;
        byTick.set(f.tick, f);
    }
    const samples = [...byTick.values()].sort((a, b) => a.tick - b.tick).map((f) => ({
        t: f.tick, level: f.status.level, p: [f.player.x, f.player.y], hits: f.status.hits,
        bodies: f.bodies.map((b) => [b.x, b.y, b.enemy?.hits ?? null]),
    }));
    return { name: NAME, page: raw.page ?? null, end,
        recordedBy: 'scripts/procgen/probe-seedling-chaser-mobiles.mjs --class=BobSoldier --file=<tape> '
            + '--player-hits --frames, compacted by plan-seedling-hammer-dd-walkkill.mjs --samples',
        note: 'the GAME\'s level, player, player hits and BobSoldier rows [x, y, hits] at the LAST frame of each tick',
        samples };
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
    const staging = await walkKillStaging();
    if (CHECK) {
        const off = await walkKillSolve(staging, false);
        check(`OFF: the dwell refuses at t${OFF_REFUSAL_TICK}, already true, on \`kill (${BODY}) by press\``,
            off.ticks === OFF_REFUSAL_TICK && /-> kill \(bobsoldier@48,80\) by press: the dwell's condition .* is ALREADY TRUE/
                .test(off.message ?? ''), `t${off.ticks}; ${(off.message ?? 'no refusal').slice(0, 160)}`);
    }
    const on = await walkKillSolve(staging, true);
    const rec = (on.records ?? []).find((r) => r.strategy === 'kill' && r.target === BODY);
    check('⛓ ON: the solve reaches L32', on.message === null && on.level === 32,
        `${on.keys.length} t; ${(on.message ?? 'solved').slice(0, 160)}`);
    check('⛓ ON: the chaser record says the walk killed it', rec?.arm === 'chaser' && rec?.ticks === 0
        && rec?.killedOnWalk?.weapon === 'sword', JSON.stringify(rec?.killedOnWalk ?? null));
    const a = await walkKillAccount(staging, on.keys);
    check('⛓⛓ ON: the plan takes no hit', a.hits.length === 0, JSON.stringify(a.hits));
    const built = buildStagedTape({ staging, perTick: on.keys, name: NAME });
    const left = a.body.find((r) => !r.strike)?.t ?? null;
    const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE DD — A PRESS KILL WHOSE TARGET DIED ON THE WALK '
        + '(`PRESS_KILL_DONE_ON_WALK` ON). Survey step 50\'s staging (`bobsoldier2Staging`) booted at '
        + `(${BOOT.x},${BOOT.y}); goals collect (64,64), reach-exit (224,160) → L32. The exit's keylock-stance walk climbs `
        + `to \`kill (${BODY}) by press\`; the walk to the stance kills the body (press t${rec?.killedOnWalk?.pressedAt}, `
        + `fired t${rec?.killedOnWalk?.firedAt}, it leaves \`strikeBodies\` at t${left}); OFF \`runDwell\` refuses at `
        + `t${OFF_REFUSAL_TICK} (already true); ON the arm records the kill as done and the solve reaches L32 in `
        + `${on.keys.length} ticks, player hits ${a.hits.length}. Not a roster tape (kept beside its samples). `
        + 'Authored by scripts/procgen/plan-seedling-hammer-dd-walkkill.mjs.';
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
        console.log(`wrote ${path.slice(REPO.length + 1)} (${on.keys.length} ticks)`);
    }
    if (failures > 0) process.exit(1);
}
