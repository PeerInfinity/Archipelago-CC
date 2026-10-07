#!/usr/bin/env node
/**
 * plan-seedling-hammer-a-escape — ⛓⛓⛓ SEEDLING HAMMER-PHASE A D2: THE ESCAPE's SOLVE, HANDED TO THE GAME.
 *
 * At base (`994e3fac52`) `r9-solve-18`'s staging refuses `HAMMER_SAFETY` at hammer residues 21 and 15 — two of the
 * live playthrough's own refusals (`seam.time` 11496 and 11490). At 21 a press lands on `spinner@112,48` and the
 * knocked-back body corners the player a few ticks later; at 15 a re-press inside the slash timer DASHES the player
 * into the body ("There is no step out." both). With `HAMMER_ESCAPE` ON the press kill admits a press only
 * with an escape out of its own landing (`levelRun.spinnerForecastWithPress` + `spaceTimeReach`) and follows it. Each
 * tape is that solve: the committed staging with `seam.time` moved to its residue (nothing else changes), solved by
 * `twoPassSolve` exactly as `solve-seedling-r9-campaign` calls it, the switch ON for the solve only. The game is the
 * witness: the differential plays it and the model must reproduce every tick, with no hit on the player.
 *
 * ⛓ WHY THESE TWO. Both are live refusals, and both witness the SEARCH, not only the admission: with the kernel's
 * prune switched off residue 21 re-plans to another walk (its t262 escape moves 38 ticks, found breadth first) and
 * residue 15 refuses again. Residue 15 also carries the dash: its train is previewed with the dash's impulse.
 *
 * ⛓ THE BASE IS FROZEN (`fixtures/witness-bases/r9-solve-18.hammer-a.json`, the committed segment at this slice's
 * base, byte for byte), so a later re-record of the campaign chain cannot move this witness's `--check`.
 *
 * ⚠ `tick0` is left off: it is a game MEASUREMENT of the boot's tick-0 fields, and the committed one is for the
 * committed clock.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-hammer-a-escape.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-hammer-a-escape.mjs --check    # exit 1 on drift
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
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { SPINNER } = await import(join(MODULE, 'spinner.js'));
    const { withHammerEscape } = await import(join(MODULE, 'solverBot.js'));

    const BASE = 'r9-solve-18';
    /** Live refusals' residues (the playthrough's `seam.time` 11496 and 11490), each refused at base. */
    const RESIDUES = [21, 15];
    const TELEPORTER = { x: 176, y: 112 };

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    const base = parseTape(readFileSync(join(MODULE, 'fixtures', 'witness-bases', 'r9-solve-18.hammer-a.json'),
        'utf8'));
    const staging = stagingFromTape(base);

    /** One witness: the staging at `RESIDUE`, solved with the switch on, written (or checked). */
    async function witness(RESIDUE) {
        const NAME = `hammer-a-l18-escape${RESIDUE}`;
        const P = SPINNER.hammerPeriod;
        const was = ((staging.seam.time % P) + P) % P;
        const shift = ((((RESIDUE - was) % P) + P) % P) - P;
        const seam = { ...staging.seam, time: staging.seam.time + shift };
        const makeRun = (persistence) => createRunForStaging(
            { ...staging, seam, persistence, equips: [] }, atlasLevelSource());
        const solve = () => twoPassSolve({
            makeRun,
            goals: [{ kind: 'reach-exit', exit: TELEPORTER }],
            name: NAME,
            boot: staging.boot,
            persistence: staging.persistence.filter((c) => c.at === undefined),
            gameTick: async () => { throw new Error('no game oracle: L18\'s clear is model-sourced'); },
        });
        let refusedOff = null;
        try { await withHammerEscape(false, solve); } catch (e) { refusedOff = e; }
        const r = await withHammerEscape(true, solve);
        const press = (r.out.records ?? []).filter((x) => x.arm === 'press');
        const escapes = press.flatMap((x) => x.escapes ?? []);
        const run = makeRun(r.persistence);
        for (const held of r.out.perTick) run.advance(held);
        const timed = r.persistence.filter((c) => c.at !== undefined);

        check(`⛓ the clock is at residue ${RESIDUE}, moved by ${shift} from the committed ${was}`,
            ((seam.time % P) + P) % P === RESIDUE, `seam.time ${staging.seam.time} → ${seam.time}`);
        check('⛓⛓ with the switch OFF this staging REFUSES HAMMER_SAFETY', refusedOff?.code === 'HAMMER_SAFETY',
            refusedOff ? String(refusedOff.message).split('. ').slice(-1)[0] : 'it solved');
        check('⛓⛓ with it ON the press kill took an escape at every landing', escapes.length > 0
            && escapes.length === press.flatMap((x) => x.landings).length, `${escapes.length} escape(s)`);
        check('⛓ the walk takes ZERO hits and crosses to L19',
            run.playerHits.length === 0 && run.transitions.map((x) => x.to_level).join() === '19',
            `hits ${run.playerHits.length}; transitions ${JSON.stringify(run.transitions)}`);

        const tape = buildTape(r.out.perTick, staging.boot, NAME,
            { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE A D2 — THE ESCAPE\'s SOLVE ON THE GAME. '
            + `\`${BASE}\`'s committed staging (frozen at the slice's base) with \`seam.time\` ${staging.seam.time} → `
            + `${seam.time} (hammer residue ${was} → ${RESIDUE}, a live playthrough refusal; nothing else moved), solved by `
            + '`twoPassSolve` as `solve-seedling-r9-campaign` calls it with `HAMMER_ESCAPE` ON. Off, this staging '
            + 'refuses HAMMER_SAFETY ("There is no step out."); on, every press is taken with an escape out of its own '
            + `landing (${escapes.length}) and the walk solves in ${r.out.perTick.length} ticks with no hit, `
            + `${timed.map((c) => `{${c.level},${c.tag}}@${c.at}`).join(' ')} model-sourced. `
            + 'Authored by scripts/procgen/plan-seedling-hammer-a-escape.mjs.';
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
        console.log(`## ${NAME}: ${r.out.perTick.length} ticks, residue ${RESIDUE}, ${escapes.length} escape(s) `
            + `(moving ${escapes.map((e) => e.moves).join('/')}), `
            + `${timed.map((c) => `{${c.level},${c.tag}}@${c.at}`).join(' ')}`);
    }
    for (const r of RESIDUES) await witness(r);

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
