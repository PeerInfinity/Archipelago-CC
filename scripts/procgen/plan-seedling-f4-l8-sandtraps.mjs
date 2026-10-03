#!/usr/bin/env node
/**
 * plan-seedling-f4-l8-sandtraps — Seedling fidelity F4, D1: L8's two sandtraps die to
 * `arrowtrap@96,16`'s column, measured on the game, as a committed witness tape.
 *
 * The tape is the solver's own L8 solve: `r8-solve-8`'s staging (the arrival at (144,48),
 * the same boot block) with the two clears declared at the ticks the GAME removes the
 * bodies: `{8,0}@248` and `{8,1}@648`. Both were read off the running game, tick by tick,
 * with `botMobiles()` (the body leaves the world and `persistence_cleared` carries the tag
 * on the same observation), and both agree with the JS arc's probe O (`{8,0}` at t248 on
 * the solver's 478-tick prefix, `{8,1}` at t648). The committed `r8-solve-8` declares 246
 * and 645 for the same walk: its truncation measurement let the game run on past the end
 * of each truncated tape before reading the flag.
 *
 * The keys are the solver's, not hand-built: `solveSegment` on that staging, the
 * `out_teleporter_96_192` goal the JS arc maps the arrival to (`wasmArrival`, imported
 * read-only). The script asserts that the JS arc's own staging (no `{5,0}`, its own seam)
 * solves to the same keys, that the walk takes zero hits and crosses to L9, and that the
 * model's replay of the written tape is the solve's run, tick for tick.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-f4-l8-sandtraps.mjs           # write the tape
 *   node scripts/procgen/plan-seedling-f4-l8-sandtraps.mjs --check   # exit 1 on drift
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

/** ⛔ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, createTapeStepper, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { indexLevels, levelSourceFromAtlas } = await import(join(MODULE, 'atlasSource.js'));
    // The JS arc's modules, imported read-only: its staging and its arrival goal.
    const { createJsRuntime } = await import(join(MODULE, 'jsRuntimeCore.js'));
    const { arrivalSolverGoal } = await import(join(MODULE, 'wasmArrival.js'));

    const NAME = 'f4-l8-sandtraps';
    /** ⛓ GAME-SOURCED (see the header): the observation each body is gone on. */
    const GAME = Object.freeze({ tag0: 248, tag1: 648 });
    const GOAL = { kind: 'exit', level: 8, tiles: [[6, 12]], name: 'out_teleporter_96_192' };

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    const MAP = JSON.parse(readFileSync(join(REPO, 'frontend', 'modules', 'flashPanel', 'atlases',
        'seedling-map.json'), 'utf8'));
    const RECS = indexLevels(MAP);
    const SRC = levelSourceFromAtlas(RECS);
    const declared = [
        { level: 8, tag: 0, at: GAME.tag0 },
        { level: 8, tag: 1, at: GAME.tag1 },
    ];
    const solve = (staging) => {
        const m = arrivalSolverGoal(GOAL, { staging, levelSource: SRC, record: RECS.get(8) });
        const run = createRunForStaging(staging, SRC);
        const out = solveSegment({ run, goals: [m.goal], name: NAME, boot: staging.boot });
        return { run, out };
    };
    const keyOf = (s) => [...s].sort().join('+');

    // ── the solve, on r8-solve-8's staging ──────────────────────────────
    const base = loadTape('r8-solve-8');
    const boot = base.persistence.filter((p) => p.at === undefined);
    const persistence = [
        ...boot.map((p) => ({ level: p.level, tag: p.tag, note: p.note })),
        {
            level: 8, tag: 0, at: GAME.tag0,
            note: 'GAME-sourced (fidelity F4 D1): `sandtrap@96,80` takes its third arrow on t230, '
                + 'plays "die" for 19 updates and leaves the world on t248, and `removed()` writes '
                + 'the tag on the same tick (botMobiles + persistence_cleared, every tick)',
        },
        {
            level: 8, tag: 1, at: GAME.tag1,
            note: 'GAME-sourced (fidelity F4 D1): `sandtrap@96,128` takes its third arrow on t630 '
                + 'and leaves the world on t648, with its tag',
        },
    ];
    const staging = { ...stagingFromTape(base), persistence };
    const { run: solved, out } = solve(staging);
    check('⛓ the solve takes ZERO hits', solved.playerHits.length === 0,
        JSON.stringify(solved.playerHits.map((h) => ({ t: h.t, source: h.source }))));
    const crossed = solved.transitions.at(-1);
    check('⛓ the solve crosses to L9', crossed?.to_level === 9,
        JSON.stringify(solved.transitions.map((x) => `${x.t}:L${x.to_level}`)));

    // ── the same keys from the JS arc's own staging ─────────────────────
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [8, 144, 48] }]);
    rt.tick();
    const js = solve({ ...rt.session.staging, persistence: [...rt.session.staging.persistence, ...declared] });
    const firstDiff = out.perTick.findIndex((s, k) => keyOf(s) !== keyOf(js.out.perTick[k] ?? []));
    check('⛓ the JS arc\'s staging solves to the SAME keys (the boot extras do not reach L8)',
        js.out.perTick.length === out.perTick.length && firstDiff === -1,
        `${out.perTick.length} vs ${js.out.perTick.length} ticks, first difference ${firstDiff}`);

    const folded = buildTape(out.perTick, base.boot, NAME,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const description = '⛓⛓⛓ SEEDLING FIDELITY F4 — L8\'s SANDTRAPS DIE TO THE ARROWS, ON THE GAME. '
        + 'The solver\'s own L8 solve (`r8-solve-8`\'s staging, the `out_teleporter_96_192` goal): '
        + 'shove `pushableblock@112,48`, hold `button@64,48` while `arrowtrap@96,16` fires down '
        + 'x = 96, shove `pushableblock@96,112`, hold again, leave to L9. The game lands three '
        + 'arrows on `sandtrap@96,80` (t164, t197, t230: `Enemy.hit` with 30 i-frames that only '
        + 'the body\'s own update runs down), plays "die" (six frames at rate 10, 19 updates, the '
        + 'first on the killing tick) and removes it on t248, when `removed()` writes {8,0}. '
        + '`sandtrap@96,128` the same: t564, t597, t630, gone with {8,1} on t648. Both clears are '
        + 'GAME-sourced; `r8-solve-8` declares 246 and 645 for the same bodies. Authored by '
        + 'scripts/procgen/plan-seedling-f4-l8-sandtraps.mjs.';
    const tape = {
        ...base,
        name: NAME,
        persistence,
        tick_count: out.perTick.length,
        inputs: folded.inputs,
        description,
    };
    delete tape.note;

    // ── the model's replay of the written tape is the solve's run ───────
    const obs = [];
    const st = createTapeStepper(parseTape(tape), { levelSource: SRC });
    for (let r = st.next(); !r.done; r = st.next()) obs.push(r.value.observation);
    const fresh = createRunForStaging(staging, SRC);
    const driven = [{ x: fresh.state.x, y: fresh.state.y, level: fresh.level }];
    for (const held of out.perTick) {
        fresh.advance(held);
        driven.push({ x: fresh.state.x, y: fresh.state.y, level: fresh.level });
    }
    check('⛓ the replay crosses to L9 on the solve\'s tick',
        obs.find((o) => o.level === 9)?.t === crossed?.t,
        `replay ${obs.find((o) => o.level === 9)?.t}, solve ${crossed?.t}`);
    const d = obs.findIndex((o, k) => o.x !== driven[k]?.x || o.y !== driven[k]?.y || o.level !== driven[k]?.level);
    check('⛓ the replay is the solve\'s keys driven on a fresh run, every tick',
        d === -1 && obs.length === driven.length, `first difference ${d}, ${obs.length}/${driven.length} observations`);

    const parsed = parseTape(tape);
    const json = `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
    const OUT = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? null;
    const path = OUT ?? join(TAPES, `${NAME}.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${NAME} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
    console.log(`## ${NAME}: ${out.perTick.length} ticks, crosses t${crossed?.t}, `
        + `declared {8,0}@${GAME.tag0} {8,1}@${GAME.tag1}`);
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}
