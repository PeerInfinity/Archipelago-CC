#!/usr/bin/env node
/**
 * plan-seedling-hammer-sf-strikefloor — ⛓⛓⛓ SEEDLING HAMMER-PHASE SF: THE ADMISSIBLE STRIKE FLOOR PLUS THE MEASURED
 * ETA (`solverBot.STRIKE_ETA_FLOOR`, OFF), ON THE GAME.
 *
 * `deriveStrike`'s ETA floor OFF is `ceil(cheb / WALK_SPEED)`, which a walk beats (an axis runs at up to 1.6 px/tick,
 * and the tolerance shortens it): the bounded pass skips reachable strikes and spends its forty on pairs too slow to
 * make. ON the floor is admissible and the bounded pass reads each previewed cell's measured ETA. This is the witness
 * of what that plans: C1's staging A (P1's committed boot view `fixtures/hammer-p1-l40-south-boot.json`: L40's south
 * door (480,896), goal the chest (880,816)) with the GHOST sword granted (the sword kept: G1's witness staging),
 * solved by `solveSegment` with the switch ON. The solve still REFUSES (on the chaser `bob@736,752`, as OFF does); its
 * executed prefix is the walk, and the press kill on `spinner@880,848` lands where OFF's floor never let the scan look.
 *
 * ⚠ WHY THE GHOST AND NOT THE SWORD. The sword's ON plan (1,695 t, the kill at t1682 against OFF's t3100) parts from
 * the game at t658, before its strikes move: the model lands a `bob@736,752` contact there (knockback dy −3) that the
 * game does not make. That is the chaser's contact, not the press (fidelity's; the SF report). The ghost's plan takes
 * the same three chaser hits and the game plays it tick for tick.
 *
 * Measured in the model (and `--check` asserts it): OFF and ON both refuse on `bob@736,752`; both land the kill's first
 * strike on `spinner@880,848` at t511, then ON's strikes move (OFF's floor skipped them) and ON kills the body sooner. The GAME is then
 * asked (`probe-seedling-dash-window.mjs --tape-file`: the player's stream and `Bot.slashTests`;
 * `probe-seedling-u9-shield-mobiles.mjs --tape-file --class=Spinner`: the bodies' positions, `hits` and `hits_timer`).
 *
 * ⛔ NOT the roster: a witness kept beside its samples (`fixtures/hammer-sf-strikefloor-witness/`, G1's shape).
 *
 * Run (each solve takes a few minutes):
 *   node scripts/procgen/plan-seedling-hammer-sf-strikefloor.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-hammer-sf-strikefloor.mjs --check    # exit 1 on drift
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
export const WITNESS_DIR = join(MODULE, 'fixtures', 'hammer-sf-strikefloor-witness');
export const BOOT_VIEW = join(MODULE, 'fixtures', 'hammer-p1-l40-south-boot.json');

export const NAME = 'hammer-sf-l40-strikefloor';
export const GOAL = Object.freeze({ kind: 'collect-placement', placement: Object.freeze({ x: 880, y: 816 }) });
export const TARGET = 'spinner@880,848';
/** The obstacle both solves refuse on (the chaser the press kill does not fight). */
export const OBSTACLE = 'bob@736,752';

/** Staging A with the ghost sword granted, the sword kept (G1's witness staging, `ghostKillStaging`'s). */
export async function strikeFloorStaging() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(BOOT_VIEW, 'utf8'))));
    staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
    return staging;
}

/** One `solveSegment` from the staging; a refusal returns its executed prefix (`e.perTick`) and its message. */
export async function strikeFloorSolve(staging, enabled) {
    const { solveSegment, withStrikeEtaFloor } = await import(join(MODULE, 'solverBot.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const run = createRunForStaging(staging, atlasLevelSource());
    return withStrikeEtaFloor(enabled, () => {
        try {
            const out = solveSegment({ run, goals: [JSON.parse(JSON.stringify(GOAL))], name: NAME, boot: staging.boot,
                dashMode: 'all' });
            return { verdict: 'SOLVED', perTick: out.perTick, message: null, obstacle: null };
        } catch (e) {
            return { verdict: 'REFUSED', perTick: e.perTick ?? [], message: String(e?.message ?? e),
                obstacle: e.obstacle?.id ?? null };
        }
    });
}

/** The model's account of a walk: the landings, each body's removal tick, the player's hits. */
export async function strikeFloorAccount(staging, keys) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const run = createRunForStaging(staging, atlasLevelSource());
    const removed = {};
    let live = new Set((run.entities('spinnerBodies') ?? []).map((b) => b.id));
    for (const k of keys) {
        run.advance(k);
        const now = new Set((run.entities('spinnerBodies') ?? []).map((b) => b.id));
        for (const id of live) if (!now.has(id)) removed[id] = run.ticksCompleted;
        live = now;
    }
    const landed = (run.spinnerPressHits ?? []).filter((h) => h.landed);
    return { run, landed, removed, presses: (run.presses ?? []).map((p) => p.weapon),
        hits: run.playerHits.map((h) => ({ t: h.t, id: h.id, died: h.died })) };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const CHECK = process.argv.includes('--check');
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { STRIKE_ETA_FLOOR } = await import(join(MODULE, 'solverBot.js'));
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    check('the switch ships OFF (`STRIKE_ETA_FLOOR`; this script turns it on for its ON solve only)',
        STRIKE_ETA_FLOOR.enabled === false, `enabled ${STRIKE_ETA_FLOOR.enabled}`);
    const staging = await strikeFloorStaging();
    const off = await strikeFloorSolve(staging, false);
    const on = await strikeFloorSolve(staging, true);
    for (const [name, r] of [['OFF', off], ['ON', on]]) {
        check(`${name}: the solve refuses on the chaser ${OBSTACLE}, past the press kill`,
            r.verdict === 'REFUSED' && r.obstacle === OBSTACLE, `${r.verdict} at t${r.perTick.length} on ${r.obstacle}`);
    }
    const keys = on.perTick.map((k) => new Set(k));
    const a = await strikeFloorAccount(staging, keys);
    const b = await strikeFloorAccount(staging, off.perTick.map((k) => new Set(k)));
    const landings = (acc) => acc.landed.filter((h) => h.id === TARGET).map((h) => h.t);
    const kill = (acc) => acc.landed.find((h) => h.id === TARGET && h.killed) ?? null;
    check(`⛓⛓ ON's press kill moved: its landings on ${TARGET} are not OFF's (the first, at the kill's start, is shared)`,
        landings(a).length > 0 && landings(a)[0] === landings(b)[0]
            && JSON.stringify(landings(a)) !== JSON.stringify(landings(b)),
        `ON t${landings(a).join(', t')} · OFF t${landings(b).join(', t')}`);
    check(`⛓⛓⛓ ON kills ${TARGET} sooner than OFF, and the body leaves \`spinnerBodies\``,
        kill(a) !== null && (kill(b) === null || kill(a).t < kill(b).t) && Number.isInteger(a.removed[TARGET]),
        `ON killed t${kill(a)?.t} (removed t${a.removed[TARGET]}), OFF t${kill(b)?.t}`);

    const built = buildStagedTape({ staging, perTick: keys, name: NAME });
    const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE SF — THE ADMISSIBLE STRIKE FLOOR PLUS THE MEASURED ETA '
        + "(`STRIKE_ETA_FLOOR` ON). C1's staging A (P1's boot view: L40's south door (480,896), goal the chest "
        + "(880,816)) with the ghost sword granted, the sword kept; `solveSegment`'s executed prefix with the switch ON "
        + `(the solve then refuses on the chaser ${OBSTACLE}, as OFF does). Landings ${a.landed.map((h) => `t${h.t} ${h.id} hits ${h.hits}`
            + `${h.killed ? ' (kill)' : ''}`).join(' · ')}; ${TARGET} killed at t${kill(a)?.t} and removed at `
        + `t${a.removed[TARGET]} (OFF: killed at t${kill(b)?.t}). Player hits `
        + `${a.hits.map((h) => `t${h.t} ${h.id}${h.died ? ' (death)' : ''}`).join(' · ') || 'none'}. ${keys.length} t. `
        + 'Not a roster tape (kept beside its samples). Authored by scripts/procgen/plan-seedling-hammer-sf-strikefloor.mjs.';
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
