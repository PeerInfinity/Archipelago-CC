#!/usr/bin/env node
/**
 * plan-seedling-l14-swordless — ⛓⛓⛓ SEEDLING FIDELITY L14: THE SWORDLESS
 * CROSSING OF L14, SOLVED BY THE DETOUR RUNG AND HANDED TO THE GAME.
 *
 * ⚖ The user, 2026-10-04: *"Make an attempt to find a swordless strategy that
 * gets through. If we can't do it in one session, then count L14 as requiring a
 * weapon. But we shouldn't hardcode it. We should derive the requirements from
 * what the solver can do."*
 *
 * The staging is a LIVE wasm arrival: route D's swordless L13 → L14 crossing,
 * captured by the JS arc's l16-budget slice (`capture-vm-old.json` read 4, kept
 * on the scratch branch `fidelity-scratch/planning-2-evidence`, never merged).
 * It is written out below field by field — `wasmArrival.stagingFromWasmArrival`'s
 * own output for that read — so this script reads no uncommitted file.
 *
 * At main `a2d10de28` the solver DECLINED it in ~1 s: *"the combat ladder is
 * EXHAUSTED"* — six bobs, no trap, no pit, no sword. The DETOUR rung
 * (`solverBot.deriveChaserDetour`, asked only after every other rung refused)
 * bends the corridor through two via cells over the top of the pack and walks
 * onto `stairsdown@32,64` with no hit. The game is the witness: the
 * differential plays this tape and the model must reproduce every tick.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-l14-swordless.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-l14-swordless.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

export const NAME = 'l14-swordless-detour';

/** `stagingFromWasmArrival` of `capture-vm-old.json` read 4 (L14 at (160,64), swordless). */
export const L14_ARRIVAL_STAGING = Object.freeze({
    boot: { level: 14, x: 160, y: 64 },
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [{ level: 86, tag: 0 }],
    despawn: [],
    equips: [],
    pins: ['sound', 'dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 338773056, split: false, cosmetic: 0, fp: 438111729 },
    seam: {
        items: {
            hasSword: false, hasGhostSword: false, hasShield: false, hasFire: false,
            hasWand: false, hasFireWand: false, canSwim: false, hasSpear: false,
            hasDarkShield: false, hasDarkSuit: false, hasDarkSword: false, hasFeather: false,
            hasTorch: false,
        },
        beam: false,
        rock_set: false,
        hits_max: 3,
        time: 5704,
        primary: 0,
        secondary: 0,
        cutscene: [false, false, false, false],
        menu_state: 0,
    },
});

/** `arrivalSolverGoal` of the capture's goal `level_14 -> level_15__r1c5`. */
export const L14_GOAL = Object.freeze({ kind: 'reach-exit', exit: { x: 32, y: 64 } });

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    const staging = JSON.parse(JSON.stringify(L14_ARRIVAL_STAGING));
    const levelSource = atlasLevelSource();
    const run = createRunForStaging(staging, levelSource, { scratchPersistence: true });
    const out = solveSegment({
        run, goals: [{ ...L14_GOAL }], name: NAME, boot: staging.boot, prefix: [], dashMode: 'none',
    });
    const rows = out.trace?.rows ?? [];
    const detour = rows.find((r) => r.strategy?.rung === 'detour')?.strategy ?? null;
    check('⛓⛓ the solve took the DETOUR rung', detour !== null,
        detour ? `vias ${JSON.stringify(detour.vias)}, ${detour.previews} preview(s)` : 'no detour row');
    check('⛓ the walk takes ZERO hits and crosses to L15',
        run.playerHits.length === 0 && run.playerDeaths.length === 0
            && run.transitions.map((x) => x.to_level).join() === '15',
        `hits ${run.playerHits.length}; deaths ${run.playerDeaths.length}; `
            + `transitions ${JSON.stringify(run.transitions)}`);

    const tape = buildTape(out.perTick, staging.boot, NAME,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const description = '⛓⛓⛓ SEEDLING FIDELITY L14 — THE SWORDLESS CROSSING, ON THE GAME. A live wasm '
        + 'arrival (route D, L13 → L14 at (160,64), no weapon; `capture-vm-old.json` read 4) solved by '
        + '`solveSegment` (dashMode none). Every rung up to KILL refuses it — six bobs, no trap, no pit, '
        + `no sword — and the DETOUR rung bends the corridor through ${detour
            ? detour.vias.map((v) => `(${v.x},${v.y})`).join(' → ') : '?'} over the pack onto `
        + `\`stairsdown@32,64\`: ${out.perTick.length} ticks, no hit. `
        + 'Authored by scripts/procgen/plan-seedling-l14-swordless.mjs.';
    const raw = {
        tape_version: 11,
        game: 'seedling',
        ...staging,
        tick0: null,
        hold: false,
        tick_count: out.perTick.length,
        inputs: tape.inputs,
        name: NAME,
        description,
    };
    const parsed = parseTape(raw);
    const replay = runTape(parsed, { levelSource });
    check(`the model replays the tape (${out.perTick.length + 1} observations, crosses to L15)`,
        replay.ticks.length === out.perTick.length + 1
            && replay.transitions.map((x) => x.to_level).join() === '15',
        `${replay.ticks.length} observations, transitions ${JSON.stringify(replay.transitions)}`);
    const json = `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
    const path = join(TAPES, `${NAME}.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${NAME} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
    console.log(`## ${NAME}: ${out.perTick.length} ticks, vias `
        + `${detour ? detour.vias.map((v) => `(${v.x},${v.y})`).join(' → ') : '-'}`);

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
