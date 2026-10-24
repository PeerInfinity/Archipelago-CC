#!/usr/bin/env node
/**
 * plan-seedling-hammer-d-ghostwall — ⛓⛓⛓ SEEDLING HAMMER-PHASE D, D2: THE GHOST SWORD PRESSES A SPINNER THROUGH A WALL.
 *
 * `Player.slash` asks `collideLine("Solid", x, y, e.x, e.y)` before it hits, and waives it for the ghost sword
 * (`|| hasGhostSword`, `Player.as:917`). The model waives it too (`levelRun.applyThrust`'s ghost arm; C2's per-weapon
 * row, `GHOST_SPINNER_PRESS_ROW.lineOfSight: false`), but no witness had ever SEEN the waiver: C2's L18 walk pressed
 * with a clear line, so its mutant M3 (the line asked for a ghost swing) was blind. This is the walled stance.
 *
 *   hammer-d-l39-ghostwall   L39 from the L38 door (144,608) — divergence leg 375's arrival, its wandlock flag
 *                            `{39,8}` declared — on C1's witness staging (`crusherStaging`: `r8-solve-11`'s staging
 *                            re-booted) with the sword AND the ghost sword. The walk climbs the shaft, cuts
 *                            `rope@96,384` with a ghost press, climbs to the shaft's mouth, then walks (the solver's
 *                            own `previewWalk`) to the pocket at STANCE beside the dark Blue Wall block (x 176–207,
 *                            y 160–191). It stands, aims right and presses at PRESS_AT: the first in-reach test lands on
 *                            `spinner@224,112` from beyond the sword's reach, and the line from the player's point to
 *                            the body's entity point crosses that wall. Then it stands out the window.
 *
 * Measured in the model (and `--check` asserts it): the landing is the press's FIRST landed test, from > 16 and ≤ 24 px,
 * 2 damage; `run.collideLineSolid` from the player's point to the body's entity point at that test names a Solid TILE;
 * no player hit; the rope is cut on the way. The GAME is then asked (`probe-seedling-dash-window.mjs --tape-file`, the
 * player's stream and `Bot.slashTests`; `probe-seedling-u9-shield-mobiles.mjs --tape-file --class=Spinner`, the bodies'
 * `hits`): if the game's body takes no hit at the landing tick, the line is NOT waived and the model is wrong.
 *
 * ⛔ NOT the roster: a witness kept beside its samples (`fixtures/hammer-d-ghostwall-witness/`, C1's
 * `static-sword-witness/` shape). The walk is CHOSEN, not derived — the stance and the press tick were found by
 * `CC/docs/cloud-reports/seedling-hammer-d-evidence/d2-search.mjs`; the walk to the stance is the solver's preview.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-hammer-d-ghostwall.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-hammer-d-ghostwall.mjs --check    # exit 1 on drift
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { crusherStaging } from './plan-seedling-crusher-witness.mjs';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
export const WITNESS_DIR = join(MODULE, 'fixtures', 'hammer-d-ghostwall-witness');

export const NAME = 'hammer-d-l39-ghostwall';
export const TARGET = 'spinner@224,112';
/** Leg 375's arrival (in_L38_144_0) and its gating flag (the wandlock in the shaft). */
export const BOOT = Object.freeze({ level: 39, x: 144, y: 608 });
export const EARNED = Object.freeze([Object.freeze({ level: 39, tag: 8 })]);
/** The rope across the shaft is cut from below it; the shaft's mouth. */
export const ROPE_STOP_Y = 404;
export const MOUTH_Y = 296;
/** The pocket beside the dark Blue Wall block, the facing, and the press tick (d2-search: first test lands). */
export const STANCE = Object.freeze({ x: 168, y: 184 });
export const FACE = 'right';
export const PRESS_AT = 573;
/** Ticks stood after the press (the window and the i-frame's start; the body's knockback seen). */
export const TAIL = 16;

/** The witness's staging: C1's (`crusherStaging`) at leg 375's arrival, the sword and the ghost sword held. */
export async function ghostWallStaging() {
    const staging = await crusherStaging({ boot: { ...BOOT }, keys: [], items: ['hasSword', 'hasGhostSword'] });
    staging.persistence = [...staging.persistence, ...EARNED.map((r) => ({ ...r, note: '' }))];
    return staging;
}

/** The keys, derived on the model from the staging (the walk to the stance is `previewWalk`'s). */
export async function ghostWallKeys(staging) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { previewWalk } = await import(join(MODULE, 'solverBot.js'));
    const { DEFAULT_TOLERANCE } = await import(join(MODULE, 'botDriverV1.js'));
    const run = createRunForStaging(staging, atlasLevelSource());
    const keys = [];
    const push = (k) => { keys.push(k); run.advance(k); };
    while (run.state.y > ROPE_STOP_Y && keys.length < 1000) push(new Set(['up']));
    push(new Set(['up']));
    push(new Set(['primary']));
    for (let n = 0; n < 12; n += 1) push(new Set());
    while (run.state.y > MOUTH_Y && keys.length < 2000) push(new Set(['up']));
    const walk = previewWalk(run, [{ ...STANCE }], DEFAULT_TOLERANCE);
    if (walk.truncated) throw new Error(`plan-seedling-hammer-d-ghostwall: the walk to the stance truncated: ${JSON.stringify(walk.truncated)}`);
    const out = [...keys, ...walk.samples.map((s) => new Set(s.held ?? []))];
    if (out.length > PRESS_AT - 1) throw new Error(`plan-seedling-hammer-d-ghostwall: the walk arrives at ${out.length}, after the aim`);
    while (out.length < PRESS_AT - 1) out.push(new Set());
    out.push(new Set([FACE]));
    out.push(new Set(['primary']));
    for (let n = 0; n < TAIL; n += 1) out.push(new Set());
    return out;
}

/**
 * The model's account of the walk: the landings, the player hits, and — at the first landing — the line the test
 * asked. The test runs INSIDE the landing tick, so neither the state before that tick's advance nor the state after it
 * is necessarily the one it saw; of the four (player, body) pairings, the one whose `distanceRectPoint` IS the
 * recorded reach is the test's (`pairing`), and the line is asked there. All four pairings' lines are reported.
 */
export async function ghostWallAccount(staging, keys) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { distanceRectPoint } = await import(join(MODULE, 'presses.js'));
    const { SPINNER } = await import(join(MODULE, 'spinner.js'));
    const run = createRunForStaging(staging, atlasLevelSource());
    let line = null;
    let ropeCutBy = null;
    const bodyOf = (id) => {
        const b = run.entities('spinnerBodies').find((x) => x.id === id);
        return b ? { rect: { ...b.rect }, x: b.rect.x + SPINNER.originX, y: b.rect.y + SPINNER.originY } : null;
    };
    for (const k of keys) {
        const before = (run.spinnerPressHits ?? []).filter((h) => h.landed).length;
        const p0 = { x: run.state.x, y: run.state.y };
        const b0 = bodyOf(TARGET);
        run.advance(k);
        if (ropeCutBy === null && run.state.y < 380) ropeCutBy = run.ticksCompleted;
        const landed = (run.spinnerPressHits ?? []).filter((h) => h.landed);
        if (line === null && landed.length > before) {
            const h = landed[0];
            const p1 = { x: run.state.x, y: run.state.y };
            const b1 = bodyOf(h.id);
            const pairings = [['player before, body before', p0, b0], ['player before, body after', p0, b1],
                ['player after, body before', p1, b0], ['player after, body after', p1, b1]].map(([name, p, b]) => ({
                name, player: p, body: { x: b.x, y: b.y }, reach: distanceRectPoint(p.x, p.y, b.rect),
                solid: run.collideLineSolid(p.x, p.y, b.x, b.y) }));
            const exact = pairings.filter((q) => Math.abs(q.reach - h.reach) < 1e-9);
            line = { t: h.t, pairings, pairing: exact.length >= 1 ? exact[0] : null, exact: exact.map((q) => q.name) };
        }
    }
    const tests = (run.spinnerPressHits ?? []).filter((h) => h.id === TARGET);
    return { run, line, ropeCutBy, tests, landed: tests.filter((h) => h.landed),
        hits: run.playerHits?.length ?? null };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const CHECK = process.argv.includes('--check');
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { GHOST_SWORD_REACH } = await import(join(MODULE, 'ghostSword.js'));
    const { SLASH_REACH } = await import(join(MODULE, 'presses.js'));
    const { GHOST_SPINNER_PRESS } = await import(join(MODULE, 'ghostSpinnerPress.js'));
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    check('the per-weapon press is ON (`GHOST_SPINNER_PRESS`; the walk is the model run\'s, which reads no switch)',
        GHOST_SPINNER_PRESS.enabled === true, `enabled ${GHOST_SPINNER_PRESS.enabled}`);
    const staging = await ghostWallStaging();
    const keys = await ghostWallKeys(staging);
    const a = await ghostWallAccount(staging, keys);
    check('the ghost press cuts `rope@96,384` and the walk climbs past it', a.ropeCutBy !== null, `above y 380 at t${a.ropeCutBy}`);
    check(`⛓⛓⛓ ONE landing on ${TARGET}, a ghost press at t${PRESS_AT}, its FIRST landed test, 2 damage`,
        a.landed.length === 1 && a.landed[0].weapon === 'ghostsword' && a.landed[0].hits === 2
            && a.landed[0].t > PRESS_AT && a.landed[0].t <= PRESS_AT + 7,
        JSON.stringify(a.landed.map((h) => ({ t: h.t, hits: h.hits, weapon: h.weapon, reach: Number(h.reach.toFixed(3)) }))));
    check(`⛓⛓ from beyond the sword's reach (${SLASH_REACH}) and within the ghost's (${GHOST_SWORD_REACH})`,
        a.landed[0]?.reach > SLASH_REACH && a.landed[0]?.reach <= GHOST_SWORD_REACH,
        `distanceRectPoint ${a.landed[0]?.reach.toFixed(3)}`);
    const q = a.line?.pairing ?? null;
    check('⛓ the test\'s own (player, body) pairing is found: its `distanceRectPoint` is the recorded reach',
        q !== null, `exact: ${JSON.stringify(a.line?.exact)}; reaches ${a.line?.pairings.map((x) => `${x.name} `
            + `${x.reach.toFixed(3)}`).join(' · ')}`);
    check('⛓⛓⛓ THE LINE IS WALLED: from the player\'s point to the body\'s entity point, at the test, it crosses a '
        + 'Solid TILE — and so it does at all four pairings around the landing tick',
        typeof q?.solid?.tag === 'string' && q.solid.tag.startsWith('tile:')
            && a.line.pairings.every((x) => String(x.solid?.tag ?? '').startsWith('tile:')),
        `${JSON.stringify(q?.player)} → ${JSON.stringify(q?.body)} meets ${JSON.stringify(q?.solid)}`);
    check('⛓ no hit on the player', a.hits === 0, `hits ${a.hits}`);

    const built = buildStagedTape({ staging, perTick: keys, name: NAME });
    const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE D, D2 — THE GHOST SWORD PRESSES A SPINNER THROUGH A WALL (the line '
        + '`Player.slash` waives for the ghost sword, `Player.as:917`). L39 from the L38 door (144,608): divergence leg '
        + "375's arrival, its wandlock flag {39,8} declared, on C1's witness staging (`r8-solve-11`'s, re-booted) with the "
        + 'sword AND the ghost sword. The walk climbs the shaft, cuts rope@96,384 with a ghost press, climbs to the '
        + `mouth, walks to (${STANCE.x},${STANCE.y}) beside the dark Blue Wall block, aims ${FACE} and presses at t${PRESS_AT}: `
        + `the landing at t${a.landed[0]?.t} on ${TARGET} is from ${a.landed[0]?.reach.toFixed(2)} px (past the sword's 16) `
        + `and the line from (${q?.player.x.toFixed(2)},${q?.player.y.toFixed(2)}) to the body's entity point `
        + `(${q?.body.x.toFixed(2)},${q?.body.y.toFixed(2)}) crosses ${q?.solid?.tag}. hits 0 → 2; no hit `
        + `on the player. ${keys.length} t. Not a roster tape (kept beside its samples). Authored by `
        + 'scripts/procgen/plan-seedling-hammer-d-ghostwall.mjs.';
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
    console.log(`## ${NAME}: ${keys.length} ticks, landing ${a.landed.map((h) => `t${h.t} hits ${h.hits} from `
        + `${h.reach.toFixed(2)} px`).join(' · ')}, the line (${q?.name}) meets ${q?.solid?.tag} at `
        + `${JSON.stringify(q?.solid?.at)}`);
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}
