#!/usr/bin/env node
/**
 * plan-seedling-hammer-b2-fight — ⛓⛓⛓ SEEDLING HAMMER-PHASE B2 D2: THE FIGHT's SOLVE, HANDED TO THE GAME.
 *
 * With `HAMMER_FIGHT` on, the press kill's whole work order is ONE space-time search (`solverBot.deriveFight`: best
 * first over the player's exact state, the tick and the bodies' fight state, each press a step whose child carries the
 * forecast forked at it; the goal every body dead and the escape horizon survived past it) and the executor holds the
 * certificate's keys — aims, presses and trains included — tick for tick. The tape is that solve: `r9-solve-18`'s
 * committed staging (frozen at hammer-phase A's base, as B1's witness reads it) at its own hammer residue 40 —
 * `seam.time` one hammer period earlier (9940 → 9895: the residue sweep's r40 row) and nothing else moved — solved by
 * `twoPassSolve` exactly as `solve-seedling-r9-campaign` calls it, the switch ON for the solve only. With the switch
 * OFF the same staging solves to the committed walk (518 ticks); ON it is shorter. The game is the witness: the
 * differential plays it, and the model must reproduce every tick with no hit on the player.
 *
 * ⚠ `tick0` is left off: it is a game MEASUREMENT of the boot's tick-0 fields, and the committed one is for the
 * committed clock (A's planner's reason). ⚠ A generated level (900) is no roster tape, so the room is L18's.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-hammer-b2-fight.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-hammer-b2-fight.mjs --check    # exit 1 on drift
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
    const { withHammerFight } = await import(join(MODULE, 'solverBot.js'));

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
        const NAME = `hammer-b2-l18-fight${RESIDUE}`;
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
        const off = await withHammerFight(false, solve);
        const r = await withHammerFight(true, solve);
        const press = (r.out.records ?? []).filter((x) => x.arm === 'press');
        const fights = press.flatMap((x) => x.fights ?? []);
        const found = fights.filter((f) => f.ok);
        const left = press.reduce((s, x) => s + (x.fightsLeft ?? 0), 0);
        const landings = press.flatMap((x) => x.landings);
        const run = makeRun(r.persistence);
        for (const held of r.out.perTick) run.advance(held);
        const timed = r.persistence.filter((c) => c.at !== undefined);

        check(`⛓ the clock is at residue ${RESIDUE}, moved by ${shift} from the committed ${was}`,
            ((seam.time % P) + P) % P === RESIDUE, `seam.time ${staging.seam.time} → ${seam.time}`);
        check('⛓⛓ with the switch OFF this staging solves to the committed walk\'s length',
            off.out.perTick.length === OFF_TICKS, `${off.out.perTick.length} ticks`);
        check('⛓⛓ with it ON the walk is shorter, and the whole fight is ONE certificate, followed to its end',
            r.out.perTick.length < OFF_TICKS && fights.length === 1 && found.length === 1 && left === 0,
            `${r.out.perTick.length} ticks; ${fights.length} search(es), ${found.length} found, ${left} left; `
                + `goal +${found[0]?.goal}, ${found[0]?.expansions} expansion(s)`);
        check('⛓ every landing the walk makes is one of the six the fight needs (two bodies × hitsMax)',
            landings.length === 2 * SPINNER.hitsMax, landings.map((l) => `${l.id}@${l.t}`).join(' '));
        check('⛓ the walk takes ZERO hits and crosses to L19',
            run.playerHits.length === 0 && run.transitions.map((x) => x.to_level).join() === '19',
            `hits ${run.playerHits.length}; transitions ${JSON.stringify(run.transitions)}`);

        const tape = buildTape(r.out.perTick, staging.boot, NAME,
            { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const description = '⛓⛓⛓ SEEDLING HAMMER-PHASE B2 D2 — THE FIGHT\'s SOLVE ON THE GAME. '
            + `\`${BASE}\`'s committed staging (frozen at hammer-phase A's base) at its own hammer residue ${RESIDUE} `
            + `(\`seam.time\` ${staging.seam.time} → ${seam.time}, one hammer period earlier — the residue sweep's r${RESIDUE} `
            + 'row; nothing else moved), solved by `twoPassSolve` as `solve-seedling-r9-campaign` '
            + `calls it with \`HAMMER_FIGHT\` ON. Off, this staging solves in ${OFF_TICKS} ticks (the committed walk); `
            + `on, the whole fight — both bodies, ${landings.length} landings — is one certificate found at the kill's `
            + 'admission and held tick for tick (no certificate left), and the walk solves in '
            + `${r.out.perTick.length} ticks with no hit, ${timed.map((c) => `{${c.level},${c.tag}}@${c.at}`).join(' ')} `
            + 'model-sourced. Authored by scripts/procgen/plan-seedling-hammer-b2-fight.mjs.';
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
            + `one fight certificate (goal +${found[0]?.goal}), landings ${landings.map((l) => l.t).join('/')}, `
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
