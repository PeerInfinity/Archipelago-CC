#!/usr/bin/env node
/**
 * plan-seedling-hammer-g1-ghostkill — ⛓⛓⛓ SEEDLING HAMMER-PHASE G1, D2: THE KILL RUNG'S GHOST PRESS KILL, ON THE GAME.
 *
 * The combat ladder's kill rung, in its lock-less spinner arm, asked `derivePressKill` only for a `sword` primary.
 * `GHOST_KILL_RUNG` (`ghostSpinnerPress.js`, OFF) lets it ask for the ghost's press too. This is the witness of what
 * the rung then plans: C1's staging A (P1's committed boot view `fixtures/hammer-p1-l40-south-boot.json`: L40's south
 * door (480,896), goal the chest (880,816)) with the ghost sword granted (`seam.items.hasGhostSword`, the sword kept),
 * solved by `solveSegment` with the switch ON. The solve still REFUSES — on the chaser `bob@736,752`, after the kills —
 * and its executed prefix is the walk: the ghost press kills `spinner@880,848` and then `spinner@816,848`, every landing
 * a ghost press. On the way the chaser hits the player three times and the third kills (the respawn at the door is the
 * game's own `Player.die`); that is the model's plan, witnessed as it is.
 *
 * Measured in the model (and `--check` asserts it): OFF the rung refuses at t0 by name; ON the solve gets past it and
 * its prefix lands only ghost presses, kills both bodies, and removes each from `spinnerBodies`. The GAME is then asked
 * (`probe-seedling-dash-window.mjs --tape-file`: the player's stream; `probe-seedling-u9-shield-mobiles.mjs
 * --tape-file --class=Spinner`: the bodies' positions, `hits` and `hits_timer`).
 *
 * ⛔ NOT the roster: a witness kept beside its samples (`fixtures/hammer-g1-ghostkill-witness/`, hammer-phase D's
 * `hammer-d-ghostwall-witness/` shape). The bomb lobber `bombpusher@112,128` (wave 13) does not reach this room.
 *
 * Run (the solve takes 2–3 minutes):
 *   node scripts/procgen/plan-seedling-hammer-g1-ghostkill.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-hammer-g1-ghostkill.mjs --check    # exit 1 on drift
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
export const WITNESS_DIR = join(MODULE, 'fixtures', 'hammer-g1-ghostkill-witness');
export const BOOT_VIEW = join(MODULE, 'fixtures', 'hammer-p1-l40-south-boot.json');

export const NAME = 'hammer-g1-l40-ghostkill';
export const GOAL = Object.freeze({ kind: 'collect-placement', placement: Object.freeze({ x: 880, y: 816 }) });
export const TARGETS = Object.freeze(['spinner@880,848', 'spinner@816,848']);
/** The rung's refusal of a ghost primary, OFF (its own words). */
export const GATE = 'the kill this rung derives is a SWORD press';

/** Staging A with the ghost sword granted (the sword kept: the ghost swing needs it). */
export async function ghostKillStaging() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(BOOT_VIEW, 'utf8'))));
    staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
    return staging;
}

/** One `solveSegment` from the staging; a refusal returns its executed prefix (`e.perTick`) and its message. */
export async function ghostKillSolve(staging, enabled) {
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { withGhostKillRung } = await import(join(MODULE, 'ghostSpinnerPress.js'));
    const run = createRunForStaging(staging, atlasLevelSource());
    return withGhostKillRung(enabled, () => {
        try {
            const out = solveSegment({ run, goals: [JSON.parse(JSON.stringify(GOAL))], name: NAME, boot: staging.boot,
                dashMode: 'all' });
            return { verdict: 'SOLVED', perTick: out.perTick, message: null };
        } catch (e) {
            return { verdict: 'REFUSED', perTick: e.perTick ?? [], message: String(e?.message ?? e) };
        }
    });
}

/** The model's account of a walk: the landings, each body's removal tick, the player's hits and deaths. */
export async function ghostKillAccount(staging, keys) {
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
        hits: run.playerHits.map((h) => ({ t: h.t, id: h.id, died: h.died })),
        deaths: (run.ledger('playerDeaths') ?? []).map((d) => ({ t: d.t, id: d.id, respawn: d.respawn })) };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const CHECK = process.argv.includes('--check');
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { GHOST_SPINNER_PRESS } = await import(join(MODULE, 'ghostSpinnerPress.js'));
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    check('the per-weapon press is ON (`GHOST_SPINNER_PRESS`, its default)', GHOST_SPINNER_PRESS.enabled === true,
        `enabled ${GHOST_SPINNER_PRESS.enabled}`);
    const staging = await ghostKillStaging();
    const off = await ghostKillSolve(staging, false);
    check('OFF: the kill rung refuses the ghost primary at t0, by name', off.verdict === 'REFUSED'
        && off.perTick.length === 0 && off.message.includes(GATE), `${off.verdict} at ${off.perTick.length}`);
    const on = await ghostKillSolve(staging, true);
    const keys = on.perTick.map((k) => new Set(k));
    check('⛓ ON: the solve gets past the gate (its prefix is the walk; the rung\'s refusal is not in its message)',
        keys.length > 0 && !(on.message ?? '').includes(GATE), `${on.verdict} at ${keys.length}`);
    const a = await ghostKillAccount(staging, keys);
    check('⛓⛓ every landing is a ghost press, and every press the walk made is the ghost sword\'s',
        a.landed.length > 0 && a.landed.every((h) => h.weapon === 'ghostsword')
            && a.presses.every((w) => w === 'ghostsword'), `${a.landed.length} landing(s), weapons `
            + `${JSON.stringify([...new Set(a.presses)])}`);
    for (const id of TARGETS) {
        const kill = a.landed.find((h) => h.id === id && h.killed);
        check(`⛓⛓⛓ the ghost press kills ${id}, and the body leaves \`spinnerBodies\``,
            kill !== undefined && Number.isInteger(a.removed[id]) && a.removed[id] > kill.t,
            `killed at t${kill?.t} (hits ${kill?.hits}, ${kill?.reach.toFixed(3)} px), removed at t${a.removed[id]}`);
    }

    const built = buildStagedTape({ staging, perTick: keys, name: NAME });
    const k1 = a.landed.find((h) => h.id === TARGETS[0] && h.killed);
    const k2 = a.landed.find((h) => h.id === TARGETS[1] && h.killed);
    const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE G1, D2 — THE KILL RUNG\'S GHOST PRESS KILL (`GHOST_KILL_RUNG` ON). '
        + "C1's staging A (P1's boot view: L40's south door (480,896), goal the chest (880,816)) with the ghost sword "
        + 'granted, the sword kept; `solveSegment`\'s executed prefix with the switch ON (the solve then refuses on the '
        + `chaser bob@736,752). Landings ${a.landed.map((h) => `t${h.t} ${h.id} hits ${h.hits}`
            + `${h.killed ? ' (kill)' : ''}`).join(' · ')}, all ghost presses; ${TARGETS[0]} killed at t${k1?.t} and `
        + `removed at t${a.removed[TARGETS[0]]}, ${TARGETS[1]} at t${k2?.t} / t${a.removed[TARGETS[1]]}. Player hits `
        + `${a.hits.map((h) => `t${h.t} ${h.id}${h.died ? ' (death)' : ''}`).join(' · ') || 'none'}. ${keys.length} t. `
        + 'Not a roster tape (kept beside its samples). Authored by scripts/procgen/plan-seedling-hammer-g1-ghostkill.mjs.';
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
