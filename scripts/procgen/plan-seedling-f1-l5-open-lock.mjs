#!/usr/bin/env node
/**
 * plan-seedling-f1-l5-open-lock — ⛓⛓⛓ SEEDLING FIDELITY F1 D2: L5's OPEN-LOCK
 * ARRIVAL, THE SOLVER'S OWN WALK UP TO ITS REFUSAL, AS A TAPE THE GAME CAN
 * REPLAY.
 *
 * Every L5 visit after the first arrives with `{5,0}` already set. The JS
 * runtime's L5 staging (`Game(5, 80, 32)`) with that clear added is handed to
 * `solveSegment` with the arrival's exit goal (`wasmArrival.arrivalSolverGoal`,
 * imported read-only). The ladder baits `bob@48,80`, then `bob@16,80`, then
 * KILLS `bob@16,80` from the ceiling: the player holds `button@48,48` and the
 * four traps fire. The hold kills `bob@48,80` but not `bob@16,80`, which takes
 * two arrows and ends at (58.87, 84.14), in column 3 between the lanes, where
 * no armed lane reaches it. The bound runs out and the solve refuses
 * (`BODY_OUT_OF_LANE`).
 *
 * This tape is that walk: the solve's own held keys up to the refusal, on
 * `r8-solve-5`'s staging (the same boot) with `{5,0}` set and untimed. The
 * script asserts that replaying the tape reproduces the solve run, then the
 * game is asked (`check-seedling-bot-differential --record --only=<name>`)
 * whether the body really does survive there.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-f1-l5-open-lock.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-f1-l5-open-lock.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULES = join(REPO, 'frontend', 'modules');
const MODULE = join(MODULES, 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {

    const { createJsRuntime } = await import(join(MODULE, 'jsRuntimeCore.js'));
    const { arrivalSolverGoal } = await import(join(MODULE, 'wasmArrival.js'));
    const { createRunForStaging, createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { indexLevels, levelSourceFromAtlas } = await import(join(MODULE, 'atlasSource.js'));
    const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));

    const NAME = 'f1-l5-open-lock-bait';

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    const MAP = JSON.parse(readFileSync(join(MODULES, 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
    const RECS = indexLevels(MAP);
    const SRC = levelSourceFromAtlas(RECS);
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [5, 80, 32] }]);
    rt.tick();
    const staging = {
        ...rt.session.staging,
        persistence: [...rt.session.staging.persistence, { level: 5, tag: 0 }],
    };
    const arrival = arrivalSolverGoal({ kind: 'exit', level: 5, tiles: [[3, 7]], name: 'l5-exit' },
        { staging, levelSource: SRC, record: RECS.get(5) });

    // ── the solve, its held keys captured tick by tick ──────────────────────
    const run = createRunForStaging(staging, SRC, { scratchPersistence: true });
    const held = [];
    const solveRows = [];
    const advance = run.advance.bind(run);
    run.advance = (h) => {
        held.push(new Set(h));
        const out = advance(h);
        solveRows.push(JSON.stringify([run.state.x, run.state.y,
            run.entities('chasers').map((c) => [c.id, c.x, c.y, c.hits])]));
        return out;
    };
    let refusal = null;
    try {
        solveSegment({ run, goals: [arrival.goal], name: 'f1-l5-open-lock', boot: staging.boot });
    } catch (e) {
        refusal = e;
    }
    check('⛓⛓ the open-lock arrival DECLINES, and by the new name', refusal !== null
        && /BODY_OUT_OF_LANE/.test(refusal.message) && !/ALREADY OPEN/.test(refusal.message),
        refusal ? String(refusal.message).split(' — ')[0] : 'it solved');
    const survivor = run.entities('chasers');
    check('⛓ one body is left, bob@16,80, alive with two hits',
        survivor.length === 1 && survivor[0].id === 'bob@16,80' && survivor[0].hits === 2,
        JSON.stringify(survivor.map((c) => [c.id, c.x, c.y, c.hits])));
    check('⛓ and the player took no hit', run.playerHits.length === 0,
        JSON.stringify(run.playerHits.map((h) => h.t)));

    // ── the tape: r8-solve-5's staging (the same boot), {5,0} set, the held keys ──
    const base = loadTape('r8-solve-5');
    const folded = buildTape(held, base.boot, NAME,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const description = '⛓⛓⛓ SEEDLING FIDELITY F1 D2 — L5\'s OPEN-LOCK ARRIVAL, THE SOLVER\'S OWN '
        + 'WALK UP TO ITS REFUSAL. `r8-solve-5`\'s staging with `{5,0}` already set (every L5 visit '
        + 'after the first). The ladder baits `bob@48,80` and `bob@16,80`, then holds '
        + '`button@48,48` to kill `bob@16,80` from the ceiling. The hold kills `bob@48,80`, but '
        + '`bob@16,80` takes two arrows and ends at (58.87, 84.14), in column 3 between the lanes, '
        + 'where no armed lane reaches it. The solve refuses at the bound (`BODY_OUT_OF_LANE`) on '
        + `tick ${held.length}. Authored by scripts/procgen/plan-seedling-f1-l5-open-lock.mjs.`;
    const tape = {
        ...base,
        name: NAME,
        persistence: [{ level: 5, tag: 0 }],
        tick_count: held.length,
        inputs: folded.inputs,
        description,
    };
    delete tape.note;

    // ── the replay reproduces the solve run, tick for tick ──────────────────
    {
        let rn = null;
        const rows = [];
        const st = createTapeStepper(tape, {
            levelSource: atlasLevelSource(),
            onTick: (t, s, h, x) => { rn = x; },
        });
        let r = st.next();
        while (!r.done) {
            if (r.value.observation.t > 0) {
                rows.push(JSON.stringify([rn.state.x, rn.state.y,
                    rn.entities('chasers').map((c) => [c.id, c.x, c.y, c.hits])]));
            }
            r = st.next();
        }
        const first = rows.findIndex((x, i) => x !== solveRows[i]);
        check('⛓⛓ the tape replays the solve run exactly (player and every body, every tick)',
            first < 0 && rows.length === solveRows.length,
            first < 0 ? `${rows.length} ticks` : `first difference at t${first + 1}`);
    }

    const parsed = parseTape(tape);
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
    console.log(`## ${NAME}: ${held.length} ticks`);

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
