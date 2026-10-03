#!/usr/bin/env node
/**
 * plan-seedling-f1c-l18-phase — ⛓⛓⛓ SEEDLING FIDELITY F1c D1: THE
 * HAMMER-PHASE RUNG's SOLVE, HANDED TO THE GAME.
 *
 * F1b's STOP: the campaign chain's re-record put L18 at hammer residue 42
 * (`Game.time mod 45`), where the press kill refused `HAMMER_SAFETY` — *"There
 * is no step out."* at (140.47, 52.24). F1c's rung (`solverBot.hammerPhaseRung`)
 * previews the approach one hammer period ahead and holds where the line would
 * corner it. This tape is that solve: `r9-solve-18`'s committed staging with
 * `seam.time` moved to residue 42 (nothing else changes; the RNG streams and
 * every other boot field are the committed ones), solved by `twoPassSolve`
 * exactly as `solve-seedling-r9-campaign` calls it. The game is the witness:
 * the differential plays it and the model must reproduce every tick, with no
 * hit on the player.
 *
 * ⚠ `tick0` is left off: it is a game MEASUREMENT of the boot's tick-0 fields,
 * and the committed one is for the committed clock.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-f1c-l18-phase.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-f1c-l18-phase.mjs --check    # exit 1 on drift
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

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {

    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { SPINNER } = await import(join(MODULE, 'spinner.js'));

    const NAME = 'f1c-l18-phase42';
    const BASE = 'r9-solve-18';
    /** The chain's L18 residue after F1b's window-5 re-solve (F1b D2: 17 → 42). */
    const RESIDUE = 42;
    const TELEPORTER = { x: 176, y: 112 };

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    /**
     * ⛓ FIDELITY F1c — THE BASE IS THE SEGMENT AS THIS WITNESS WAS CUT FROM IT.
     * F1c's D3 re-recorded the campaign chain, so `fixtures/tapes/r9-solve-18.json`
     * is a different walk now; the witness (game-recorded) is not. The segment
     * as committed at F1b's chain is kept byte for byte in
     * `fixtures/witness-bases/` (outside the tape roster) for this script.
     */
    const base = parseTape(readFileSync(join(MODULE, 'fixtures', 'witness-bases', 'r9-solve-18.f1b.json'), 'utf8'));
    const staging = stagingFromTape(base);
    const P = SPINNER.hammerPeriod;
    const was = ((staging.seam.time % P) + P) % P;
    const shift = ((((RESIDUE - was) % P) + P) % P) - P;
    const seam = { ...staging.seam, time: staging.seam.time + shift };
    const makeRun = (persistence) => createRunForStaging(
        { ...staging, seam, persistence, equips: [] }, atlasLevelSource());
    const r = await twoPassSolve({
        makeRun,
        goals: [{ kind: 'reach-exit', exit: TELEPORTER }],
        name: NAME,
        boot: staging.boot,
        persistence: staging.persistence.filter((c) => c.at === undefined),
        gameTick: async () => { throw new Error('no game oracle: L18\'s clear is model-sourced'); },
    });
    const stalls = (r.out.records ?? []).filter((x) => x.arm === 'press')
        .flatMap((x) => x.phaseStalls ?? []);
    const run = makeRun(r.persistence);
    for (const held of r.out.perTick) run.advance(held);
    const timed = r.persistence.filter((c) => c.at !== undefined);

    check(`⛓ the clock is at residue ${RESIDUE}, moved by ${shift} from the committed ${was}`,
        ((seam.time % P) + P) % P === RESIDUE, `seam.time ${staging.seam.time} → ${seam.time}`);
    check('⛓⛓ the solve STALLED for the hammer\'s phase at least once', stalls.length > 0,
        JSON.stringify(stalls));
    check('⛓ the walk takes ZERO hits and crosses to L19',
        run.playerHits.length === 0 && run.transitions.map((x) => x.to_level).join() === '19',
        `hits ${run.playerHits.length}; transitions ${JSON.stringify(run.transitions)}`);

    const tape = buildTape(r.out.perTick, staging.boot, NAME,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const description = '⛓⛓⛓ SEEDLING FIDELITY F1c D1 — THE HAMMER-PHASE RUNG\'s SOLVE ON THE GAME. '
        + `\`${BASE}\`'s committed staging with \`seam.time\` ${staging.seam.time} → ${seam.time} `
        + `(hammer residue ${was} → ${RESIDUE}, the campaign chain's after F1b; nothing else moved), `
        + 'solved by `twoPassSolve` as `solve-seedling-r9-campaign` calls it. Without the rung this '
        + 'staging refuses HAMMER_SAFETY ("There is no step out." at (140.47,52.24)); with it the '
        + `press kill holds ${stalls.map((s) => `${s.ticks} tick(s) from t${s.from}`).join(', ')} and `
        + `solves in ${r.out.perTick.length} ticks with no hit, ${timed.map((c) => `{${c.level},${c.tag}}@${c.at}`)
            .join(' ')} model-sourced. Authored by scripts/procgen/plan-seedling-f1c-l18-phase.mjs.`;
    const raw = {
        ...base,
        name: NAME,
        persistence: r.persistence,
        seam,
        tick_count: r.out.perTick.length,
        inputs: tape.inputs,
        description,
    };
    delete raw.tick0;
    delete raw.note;
    const parsed = parseTape(raw);
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
    console.log(`## ${NAME}: ${r.out.perTick.length} ticks, residue ${RESIDUE}, `
        + `${stalls.length} stall(s), ${timed.map((c) => `{${c.level},${c.tag}}@${c.at}`).join(' ')}`);

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
