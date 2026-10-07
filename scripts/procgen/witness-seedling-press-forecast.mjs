#!/usr/bin/env node
/**
 * witness-seedling-press-forecast — ⛓⛓ SEEDLING HAMMER-PHASE A D1: the hit-aware forecast against the run, model vs
 * model, exact.
 *
 * For every press LANDING on a spinner in a walk, `run.spinnerForecastWithPress` is taken at the AIM tick (the tick
 * before the press, i.e. before the press exists) with the press's own facing and the player's points at the test
 * ticks, and its rows are compared with the bodies the run actually has, byte for byte (`JSON.stringify` of every
 * rect, and each body's `{id, hits, hitsTimer, destroy}`), from the aim tick to the NEXT landing (its rects
 * inclusive: a hit at T moves rects from T + 1 on, while its own `hits`/`hitsTimer` are in row T, so the body state is
 * compared up to the row before it) or the horizon, the walk's end or a level change. Its tests are compared with the
 * run's own `spinnerPressHits` rows for the same ticks, and its `landing` with the landing.
 *
 * The walks: `--tapes` replays every committed tape (`fixtures/tapes/index.json`) and witnesses each that lands a
 * press on a spinner; `--residues=` solves `r9-solve-18`'s staging at those hammer residues (the
 * `sweep-seedling-l18-residues` shape) and witnesses each solve. Pure node; no browser, no box lock, writes nothing.
 *
 * Run:
 *   node scripts/procgen/witness-seedling-press-forecast.mjs --tapes
 *   node scripts/procgen/witness-seedling-press-forecast.mjs --residues=0-44
 *   node scripts/procgen/witness-seedling-press-forecast.mjs --tapes --residues=40 --horizon=700
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** `--residues=4,15,18-22` → [4, 15, 18, 19, 20, 21, 22]. */
function parseResidues(arg, period) {
    const out = [];
    for (const part of arg.split(',').map((s) => s.trim()).filter(Boolean)) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(part);
        if (!m) throw new Error(`--residues: cannot read "${part}"`);
        for (let r = Number(m[1]); r <= Number(m[2] ?? m[1]); r += 1) {
            if (r >= period) throw new Error(`--residues: ${r} is not a residue mod ${period}`);
            out.push(r);
        }
    }
    return out;
}

const bodyKey = (b) => ({ id: b.id, hits: b.hits, hitsTimer: b.hitsTimer, destroy: b.destroy });

/**
 * ⛓ The witness of one walk, in two replays of the same keys (the run is deterministic): the first records what
 * happened (the player's point and level at the top of every tick, the bodies after every advance, the presses and
 * the landings), the second takes the forecast at each landing's aim tick and compares.
 *
 * @param {Function} makeRun  `() => run` at tick 0
 * @param {Function} keysAt  `(t) => Set` for t < ticks
 * @param {number} ticks
 * @param {number} horizon  rows per forecast at most
 * @param {number} [aimBack]  how many ticks before the press the forecast is taken (1: the aim tick; 0: the press)
 * @returns {{landings: number, rows: number, tests: number, mismatches: string[]}}
 */
export function witnessWalk(makeRun, keysAt, ticks, horizon, aimBack = 1) {
    const top = [];
    const after = [];
    let run = makeRun();
    for (let t = 0; t < ticks; t += 1) {
        top[t] = { x: run.state.x, y: run.state.y, level: run.level, n: run.ticksCompleted };
        run.advance(keysAt(t));
        after[t] = { level: run.level, bodies: run.entities('spinnerBodies') ?? [] };
    }
    const hits = run.ledger('spinnerPressHits') ?? [];
    const presses = run.slashPresses.filter((p) => p.outcome === 'slash' || p.outcome === 'dash');
    const landings = hits.filter((h) => h.landed);
    const plans = [];
    for (const [k, L] of landings.entries()) {
        const press = presses.filter((p) => p.t < L.t && p.t >= L.t - 5 && p.level === L.level).pop();
        if (!press) {
            plans.push({ L, error: `the landing at t${L.t} on ${L.id} has no slash/dash press in the 5 ticks before it` });
            continue;
        }
        const aim = Math.max(0, press.t - aimBack);
        const next = landings.slice(k + 1).find((x) => x.t > L.t);
        let end = Math.min(ticks - 1, aim + horizon - 1, next ? next.t : Infinity);
        for (let t = aim; t <= end; t += 1) {
            if (after[t].level !== L.level || top[t].level !== L.level) { end = t - 1; break; }
        }
        // ⚠ the next landing's own hit is in its row's body state (not its rects), and it is not this forecast's
        plans.push({ L, press, aim, end, bodiesEnd: next && end === next.t ? end - 1 : end });
    }
    const mismatches = [];
    const scoped = [];
    let rows = 0;
    let tests = 0;
    run = makeRun();
    const byAim = new Map();
    for (const p of plans) {
        if (p.error) { mismatches.push(p.error); continue; }
        if (!byAim.has(p.aim)) byAim.set(p.aim, []);
        byAim.get(p.aim).push(p);
    }
    for (let t = 0; t < ticks; t += 1) {
        for (const p of byAim.get(t) ?? []) {
            const where = `landing t${p.L.t} on ${p.L.id} (press t${p.press.t} ${p.press.outcome}, aim t${p.aim})`;
            const before = mismatches.length;
            const n = p.end - p.aim + 1;
            const f = run.spinnerForecastWithPress(n, {
                pressAt: p.press.t, direction: p.press.direction, id: p.L.id,
                positions: (x) => (x < ticks ? top[x] : null),
            });
            if (!f.landing || f.landing.t !== p.L.t) {
                mismatches.push(`${where}: the forecast's landing is ${JSON.stringify(f.landing)} (${f.why})`);
            }
            for (let i = 0; i < n; i += 1) {
                const want = after[p.aim + i].bodies;
                const gotR = JSON.stringify(f.rows[i]);
                const wantR = JSON.stringify(want.map((b) => b.rect));
                const own = p.aim + i <= p.bodiesEnd;
                const gotB = own ? JSON.stringify(f.bodies[i]) : '';
                const wantB = own ? JSON.stringify(want.map(bodyKey)) : '';
                rows += 1;
                if (gotR !== wantR || gotB !== wantB) {
                    mismatches.push(`${where}: row ${i} (t${p.aim + i}) differs — forecast ${gotR} ${gotB} `
                        + `vs run ${wantR} ${wantB}`);
                    break;
                }
            }
            const lo = p.press.t + 1;
            const hi = Math.min(p.end, p.press.t + 5);
            const want = hits.filter((h) => h.t >= lo && h.t <= hi && h.level === p.L.level)
                .map((h) => JSON.stringify([h.t, h.id, h.landed, h.killed, h.reach, h.hits, h.hitsTimer]));
            const got = f.tests.filter((h) => h.t >= lo && h.t <= hi)
                .map((h) => JSON.stringify([h.t, h.id, h.landed, h.killed, h.reach, h.hits, h.hitsTimer]));
            tests += got.length;
            if (JSON.stringify(got) !== JSON.stringify(want)) {
                mismatches.push(`${where}: the tests differ — forecast ${got.join(' ')} vs run ${want.join(' ')}`);
            }
            // ⚠ A source the forecast NAMES as unmodelled (a shield bump) is attributed, not excused: the walk is
            // re-witnessed from the press tick (after any bump at the aim tick) by `report`, and must be exact.
            if (mismatches.length > before && f.unmodelled.length > 0) {
                scoped.push({ where, unmodelled: f.unmodelled, press: p.press.t });
                mismatches.splice(before);
            }
        }
        run.advance(keysAt(t));
    }
    return { landings: landings.length, rows, tests, mismatches, scoped };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const argv = process.argv.slice(2);
    const valueOf = (flag) => {
        const a = argv.find((x) => x.startsWith(`${flag}=`));
        return a ? a.slice(flag.length + 1) : null;
    };
    const HORIZON = Number(valueOf('--horizon') ?? 700);
    const { fixtureNames, loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { SPINNER } = await import(join(MODULE, 'spinner.js'));
    const source = atlasLevelSource();

    let failed = 0;
    let walks = 0;
    let scopedWalks = 0;
    const report = (name, r, again) => {
        walks += 1;
        let ok = r.mismatches.length === 0;
        let tag = ok ? 'PASS' : 'FAIL';
        if (ok && r.scoped.length > 0) {
            // ⛓ the attributed landings, re-witnessed from the press tick: exact there, or a FAIL
            const r0 = again();
            ok = r0.mismatches.length === 0 && r0.scoped.length === 0;
            tag = ok ? 'SCOPE' : 'FAIL';
            if (ok) scopedWalks += 1;
            for (const s of r.scoped) {
                console.log(`      ⚠ ${s.where}: the forecast names ${s.unmodelled.join(', ')} as unmodelled and `
                    + `the aim-tick rows differ; from the press tick (t${s.press}) the walk is `
                    + `${ok ? 'EXACT' : 'NOT exact'}`);
            }
            r = { ...r0, mismatches: [...r0.mismatches, ...r0.scoped.map((s) => `${s.where}: still differs`)] };
        }
        if (!ok) failed += 1;
        console.log(`${tag.padEnd(5)} ${name}: ${r.landings} landing(s), ${r.rows} row(s), ${r.tests} test(s)`);
        for (const m of r.mismatches.slice(0, 5)) console.log(`      ⛔ ${m}`);
    };

    if (argv.includes('--tapes')) {
        for (const name of fixtureNames()) {
            const tape = loadTape(name);
            const st = stagingFromTape(tape);
            if (st.noclip) continue;
            let r;
            try {
                // ⚠ The replay's own walk first: a tape that lands nothing on a spinner is not a row.
                const probe = createRunForStaging(st, source);
                for (let t = 0; t < tape.tick_count; t += 1) probe.advance(heldKeysAt(tape, t));
                if (!(probe.ledger('spinnerPressHits') ?? []).some((h) => h.landed)) continue;
                r = witnessWalk(() => createRunForStaging(st, source), (t) => heldKeysAt(tape, t),
                    tape.tick_count, HORIZON);
            } catch (e) {
                r = { landings: 0, rows: 0, tests: 0, scoped: [],
                    mismatches: [`replay threw: ${String(e.message).slice(0, 200)}`] };
            }
            report(`tape ${name}`, r, () => witnessWalk(() => createRunForStaging(st, source),
                (t) => heldKeysAt(tape, t), tape.tick_count, HORIZON, 0));
        }
    }
    const residuesArg = valueOf('--residues');
    if (residuesArg) {
        const NAME = 'r9-solve-18';
        const STAGING = stagingFromTape(loadTape(NAME));
        const PERIOD = SPINNER.hammerPeriod;
        const RESIDUE = ((STAGING.seam.time % PERIOD) + PERIOD) % PERIOD;
        const shiftTo = (r) => ((((r - RESIDUE) % PERIOD) + PERIOD) % PERIOD) - PERIOD;
        for (const res of parseResidues(residuesArg, PERIOD)) {
            const seam = { ...STAGING.seam, time: STAGING.seam.time + shiftTo(res) };
            const makeRun = (persistence) => createRunForStaging(
                { ...STAGING, seam, persistence, equips: [] }, source);
            let solved;
            try {
                solved = await twoPassSolve({
                    makeRun, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], name: NAME,
                    boot: STAGING.boot, persistence: STAGING.persistence.filter((c) => c.at === undefined),
                    gameTick: async () => { throw new Error('no game oracle here'); },
                });
            } catch (e) {
                console.log(`skip  residue ${res}: refused (${e.code ?? 'error'}) — not a walk`);
                continue;
            }
            const keys = solved.out.perTick;
            report(`residue ${res}`, witnessWalk(() => makeRun(solved.persistence), (t) => keys[t], keys.length,
                HORIZON), () => witnessWalk(() => makeRun(solved.persistence), (t) => keys[t], keys.length,
                HORIZON, 0));
        }
    }
    console.log(`\n${walks - failed}/${walks} walk(s) exact (${scopedWalks} of them from the press tick, `
        + 'a named unmodelled source at the aim tick)');
    if (failed > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
