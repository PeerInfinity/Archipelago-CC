#!/usr/bin/env node
/**
 * plan-seedling-hammer-b1-approach — ⛓⛓⛓ SEEDLING HAMMER-PHASE B1 D2: THE APPROACH's SOLVE, HANDED TO THE GAME.
 *
 * With `HAMMER_APPROACH` on, a press-kill tick with no strike in hand plans the approach to the next strike in
 * space-time (`solverBot.deriveApproach`: `spaceTimeReach`'s earliest mode, pruned by the hammer predicate, to the
 * first state from which the press train is a real strike with a certified way out of its landing) and the executor
 * holds the certificate's keys tick for tick. The tape is that solve: `r9-solve-18`'s committed staging (frozen at
 * hammer-phase A's base — B1 reads the same staging: only the solve-derived clear and the inputs differ from today's
 * tape) at its own hammer residue 40 — `seam.time` one hammer period earlier (9940 → 9895: the residue sweep's shift,
 * which moves a clock already at its residue by −45, so this IS the sweep's r40 row) and nothing else moved — solved by `twoPassSolve` exactly as `solve-seedling-r9-campaign`
 * calls it, the switch ON for the solve only. With the switch OFF the same staging solves to the committed walk (518
 * ticks); ON it is shorter. The game is the witness: the differential plays it, and the model must reproduce every
 * tick with no hit on the player.
 *
 * ⚠ `tick0` is left off: it is a game MEASUREMENT of the boot's tick-0 fields, and the committed one is for the
 * committed clock (A's planner's reason).
 *
 * Run:
 *   node scripts/procgen/plan-seedling-hammer-b1-approach.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-hammer-b1-approach.mjs --check    # exit 1 on drift
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
    const { withHammerApproach } = await import(join(MODULE, 'solverBot.js'));

    const BASE = 'r9-solve-18';
    /** The committed staging's own residue: the clock is not moved. */
    const RESIDUES = [40];
    /** The committed walk's length at residue 40 (`r9-solve-18`, hammer-phase A2's re-record): the switch OFF. */
    const OFF_TICKS = 518;
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
        const NAME = `hammer-b1-l18-approach${RESIDUE}`;
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
        const off = await withHammerApproach(false, solve);
        const r = await withHammerApproach(true, solve);
        const press = (r.out.records ?? []).filter((x) => x.arm === 'press');
        const escapes = press.flatMap((x) => x.escapes ?? []);
        const found = press.flatMap((x) => x.approaches ?? []).filter((a) => a.ok);
        const planned = press.flatMap((x) => x.cycles ?? []).filter((c) => c.approach !== undefined);
        const run = makeRun(r.persistence);
        for (const held of r.out.perTick) run.advance(held);
        const timed = r.persistence.filter((c) => c.at !== undefined);

        check(`⛓ the clock is at residue ${RESIDUE}, moved by ${shift} from the committed ${was}`,
            ((seam.time % P) + P) % P === RESIDUE, `seam.time ${staging.seam.time} → ${seam.time}`);
        check('⛓⛓ with the switch OFF this staging solves to the committed walk\'s length',
            off.out.perTick.length === OFF_TICKS, `${off.out.perTick.length} ticks`);
        check('⛓⛓ with it ON the walk is shorter, and every strike it pressed was planned in space-time',
            r.out.perTick.length < OFF_TICKS && planned.length > 0
            && planned.length >= press.flatMap((x) => x.landings).length,
            `${r.out.perTick.length} ticks; ${planned.length} planned strike(s), ${found.length} search(es) found one`);
        check('⛓ and every press still has an escape out of its own landing', escapes.length > 0
            && escapes.length === press.flatMap((x) => x.landings).length, `${escapes.length} escape(s)`);
        check('⛓ the walk takes ZERO hits and crosses to L19',
            run.playerHits.length === 0 && run.transitions.map((x) => x.to_level).join() === '19',
            `hits ${run.playerHits.length}; transitions ${JSON.stringify(run.transitions)}`);

        const tape = buildTape(r.out.perTick, staging.boot, NAME,
            { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE B1 D2 — THE APPROACH\'s SOLVE ON THE GAME. '
            + `\`${BASE}\`'s committed staging (frozen at hammer-phase A's base) at its own hammer residue ${RESIDUE} `
            + `(\`seam.time\` ${staging.seam.time} → ${seam.time}, one hammer period earlier — the residue sweep's r${RESIDUE} `
            + 'row; nothing else moved), solved by `twoPassSolve` as `solve-seedling-r9-campaign` '
            + `calls it with \`HAMMER_APPROACH\` ON. Off, this staging solves in ${OFF_TICKS} ticks (the committed walk); `
            + `on, every strike's approach is planned in space-time (${planned.length}) and held tick for tick, every `
            + `press is taken with an escape out of its own landing (${escapes.length}), and the walk solves in `
            + `${r.out.perTick.length} ticks with no hit, ${timed.map((c) => `{${c.level},${c.tag}}@${c.at}`).join(' ')} `
            + 'model-sourced. Authored by scripts/procgen/plan-seedling-hammer-b1-approach.mjs.';
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
        console.log(`## ${NAME}: ${r.out.perTick.length} ticks (OFF ${off.out.perTick.length}), residue ${RESIDUE}, `
            + `${planned.length} planned strike(s) at index ${planned.map((c) => c.approach).join('/')}, `
            + `${escapes.length} escape(s), ${timed.map((c) => `{${c.level},${c.tag}}@${c.at}`).join(' ')}`);
    }
    for (const r of RESIDUES) await witness(r);

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
