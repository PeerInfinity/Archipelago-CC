#!/usr/bin/env node
/**
 * solve-seedling-r8-tail — THE BATTERY'S TAIL, through the TWO-PASS
 * AUTHORING LOOP. R8 slice 4, kickoff §12.10.1/§12.10.3.
 *
 * Slice 3b closed the battery at 2 of 4 and reported the other two rather
 * than recording them (armB, on purpose): L5 needed machinery nobody had
 * built and L8 needed a tick the model refuses to compute. Both are here.
 *
 * ── THE TWO ROOMS, AND WHICH ORACLE EACH ONE IS ALLOWED ───────────────
 *
 *   r8-solve-5  L5 — MODEL-sourced. Three arrow kills take
 *               `Game.totalEnemies()` to zero; `chaserKillLockOpens` has the
 *               removal tick and `activators.opensOnTick` has `lock@48,112`'s
 *               own 101-step fade. The model owns both terms, so the loop
 *               declares their sum and the GAME then adjudicates by replaying
 *               the tape byte for byte.
 *   r8-solve-8  L8 — GAME-sourced. §11.4 REFUSES to compute a static
 *               `"Enemy"` body's arrow death, precisely so that ONE writer
 *               owns each persistence slot. So the tick is read off the
 *               GAME's own `persistence_cleared`, by TRUNCATION: the smallest
 *               tape length whose end-of-run readout carries the tag, with
 *               the arm one tick below it showing the tag ABSENT. A poll
 *               cannot answer this — `botStatus` is sampled on wall clock, so
 *               it measures a band; a truncation is a boundary.
 *
 * ⛔ NOTHING HERE TOUCHES `r7-act2-5`. Its committed `at: 737` is the END OF
 * A PHASES BLOCK measured by a truncated arm — an UPPER BOUND, as §11.5
 * recorded — and no re-record licence exists this rung. The solver tape
 * declares its own honest tick beside it.
 *
 * Run (model-side; L5 needs no game):
 *   node scripts/procgen/solve-seedling-r8-tail.mjs --only=5
 *   node scripts/procgen/solve-seedling-r8-tail.mjs --only=5 --check
 *
 * L8 needs the game oracle, which drives the Windows replay harness:
 *   node scripts/procgen/solve-seedling-r8-tail.mjs --only=8 --game
 *
 * Then record the fixtures (the game is the only oracle):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-solve-5
 */

import { dirname, join } from 'node:path';
import {
    existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const TAPES = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'tapes');
const TRACES = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'traces');

const CHECK = process.argv.includes('--check');
const USE_GAME = process.argv.includes('--game');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=5,8')
    .slice(7).split(',').map(Number);

const { parseTape, requiredTapeVersion, gameVisibleTape, TAPE_VERSION } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { PLAYTHROUGH_CHAINS } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/playthroughWalk.js'));
const { createLevelRun } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelRun.js'));
const { atlasLevelSource } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));
const { twoPassSolve } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/twoPassSolve.js'));
const { buildTape } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV1.js'));
const { ROLES } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelWorld.js'));
const { keysToSpans } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/mover.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

// ── the Windows replay harness, for the GAME-sourced oracle ───────────
const PAGE_URL = 'http://localhost:8000/frontend/modules/flashPanel/wasm/'
    + 'seedling-bot/game.html';
const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

function replayOnWindows(name, tapeObj) {
    mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
    writeFileSync(join(WIN_SCRATCH_WSL, 'seedling-bot-replay-win.py'),
        readFileSync(WIN_DRIVER));
    const outWsl = join(WIN_SCRATCH_WSL, `stream-${name}.json`);
    writeFileSync(join(WIN_SCRATCH_WSL, `tape-${name}.json`),
        JSON.stringify(gameVisibleTape(parseTape(tapeObj))));
    try { unlinkSync(outWsl); } catch { /* first run */ }
    let out;
    try {
        out = execFileSync(WIN_PY, [
            '-3.12', `${WIN_SCRATCH_DOS}\\seedling-bot-replay-win.py`,
            '--url', PAGE_URL,
            '--tape', `${WIN_SCRATCH_DOS}\\tape-${name}.json`,
            '--out', `${WIN_SCRATCH_DOS}\\stream-${name}.json`,
            '--deadline-sec', String(Math.ceil(tapeObj.tick_count * 1.5) + 120),
        ], { cwd: WIN_SCRATCH_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        const said = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`${e.message}${said ? `\n${said}` : ''}`);
    }
    out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
        .forEach((l) => console.log(`      ${l}`));
    if (!existsSync(outWsl)) throw new Error(`windows driver wrote no stream for ${name}`);
    return JSON.parse(readFileSync(outWsl, 'utf8'));
}

const clearedIn = (st) => (st.persistence_cleared || [])
    .map((r) => `${r.level ?? r.l},${r.tag ?? r.t}`);

/**
 * ⛓⛓⛓ THE GAME-SOURCED ORACLE — A BOUNDARY, NOT A HIT.
 *
 * The measured quantity is stated operationally so it cannot drift: **the
 * SMALLEST tape length `N` whose end-of-run `persistence_cleared` carries the
 * tag**, with `N - 1` showing it ABSENT. Both halves are run: an arm that
 * only ever showed the tag PRESENT would be measuring "cleared by now", which
 * is the upper bound R7's own declarations already were (§11.5).
 *
 * ⛔ THE PREFIX IS THE MEASURING PASS'S OWN WALK, truncated. Every arm boots
 * the same v8 block and replays the same key stream, so the game's own
 * determinism is what makes the truncations comparable.
 *
 * ⚠ AND THE SEARCH IS BOUNDED AND ITS BOUND IS NAMED. `lo` starts at the tick
 * the hold began (the walk before it cannot have killed anything) and `hi` at
 * the prefix end, which the first arm CONFIRMS carries the tag before any
 * bisection happens — a bisection over an interval whose top is not known to
 * contain the answer is a search for something that may not be there.
 */
function makeGameOracle(tapeTemplate) {
    return async ({ perTick, pending, persistence, name }) => {
        const spans = keysToSpans(perTick);
        const tapeAt = (n, label) => ({
            ...tapeTemplate,
            name: `${name}-probe-${label}`,
            tape_version: TAPE_VERSION,
            persistence: persistence.filter((p) => p.at !== undefined
                ? p.at < n : true).map((p) => ({ ...p })),
            tick_count: n,
            inputs: spans.filter((s) => s.from < n)
                .map((s) => ({ ...s, to: Math.min(s.to, n) })),
        });
        const carries = (n, label) => {
            const got = replayOnWindows(`${name}-${label}`, tapeAt(n, label));
            const cleared = clearedIn(got.status);
            const has = cleared.includes(`${pending.level},${pending.tag}`);
            console.log(`      truncation ${n}: persistence_cleared `
                + `[${cleared.join(' ') || 'nothing'}] -> ${has ? 'CARRIES' : 'absent'}`);
            return has;
        };
        let hi = perTick.length;
        if (!carries(hi, `hi${hi}`)) {
            throw new Error(`the GAME does not clear {${pending.level},${pending.tag}} `
                + `within the whole ${hi}-tick prefix. The hold's bound (${pending.bound}) `
                + 'is a CLAIM about the mechanism, so this is the claim being wrong — not '
                + 'a window to lengthen without saying why.');
        }
        let lo = 0;
        while (hi - lo > 1) {
            const mid = Math.floor((lo + hi) / 2);
            if (carries(mid, `m${mid}`)) hi = mid; else lo = mid;
        }
        return {
            at: hi,
            evidence: `the GAME's own persistence_cleared: a ${hi}-tick truncation of this `
                + `walk CARRIES {${pending.level},${pending.tag}} and a ${lo}-tick one does `
                + 'NOT — a boundary, measured on both sides',
        };
    };
}

// ── the goals, derived from the chain's own units (the battery's rule) ─
const chain = PLAYTHROUGH_CHAINS.find((c) => c.id === 'act2-the-sword');
const perSegment = chain.segments.map(() => ({ units: [] }));
{
    let seg = 0;
    for (const unit of chain.walk.units) {
        perSegment[Math.min(seg, perSegment.length - 1)].units.push(unit);
        if (unit.leg?.exit) seg += 1;
    }
}
function goalsFor(segNo) {
    const goals = [];
    for (const unit of perSegment[segNo - 1].units) {
        if (!unit.leg) continue;
        for (const target of unit.leg.targets ?? []) {
            if (target.collect) {
                goals.push({ kind: 'collect-placement', placement: { ...target.collect.pickup } });
            }
            if (target.chest) {
                goals.push({ kind: 'collect-placement', placement: { ...target.chest.chest } });
            }
        }
        if (unit.leg.exit) goals.push({ kind: 'reach-exit', exit: { ...unit.leg.exit } });
    }
    return goals;
}

const levelSource = atlasLevelSource();

/** `tapeJson` — the plan scripts' convention: serialize FROM a parsed tape. */
function tapeJson(obj, description) {
    const parsed = parseTape(obj);
    return `${JSON.stringify({
        tape_version: requiredTapeVersion(parsed),
        game: 'seedling',
        name: obj.name,
        description,
        boot: parsed.boot,
        noclip: parsed.noclip,
        noDamage: parsed.noDamage,
        noHazards: parsed.noHazards,
        grants: parsed.grants,
        persistence: parsed.persistence,
        equips: parsed.equips,
        pins: parsed.pins,
        save: parsed.save,
        rng: parsed.rng,
        seam: parsed.seam,
        tick_count: parsed.tick_count,
        inputs: parsed.inputs,
    }, null, 4)}\n`;
}

function emit(path, json, what) {
    if (CHECK) {
        const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
        check(`${what} is byte-identical to what this solver derives`, have === json,
            have === null ? 'the file does not exist'
                : have === json ? `${json.length} bytes`
                    : '⛔ DRIFT — the committed artifact is not what the solver produces today');
        return;
    }
    writeFileSync(path, json);
    console.log(`  wrote ${path} (${json.length} bytes)`);
}

const ROWS = Object.freeze([
    Object.freeze({
        segNo: 5,
        source: 'model',
        why: 'L5 — the KILL-LOCK. `lock@48,112` is `tset == -1`, so no button in the game '
            + 'answers it; the ceiling kills all three bobs, `Game.totalEnemies()` reaches '
            + 'zero, and the tick is `chaserKillLockOpens`\'s removal plus '
            + '`activators.opensOnTick`\'s 101-step fade. Both terms are the model\'s own.',
    }),
    Object.freeze({
        segNo: 8,
        source: 'game',
        why: 'L8 — two `SandTrap` bodies under `arrowtrap@96,16`\'s column. §11.4 REFUSES '
            + 'to compute their arrow death so that ONE writer owns each slot, so both '
            + 'ticks are read off the GAME\'s own `persistence_cleared` by truncation.',
    }),
]);

mkdirSync(TRACES, { recursive: true });
const summary = [];
for (const row of ROWS) {
    if (!ONLY.includes(row.segNo)) continue;
    const name = `r8-solve-${row.segNo}`;
    const committedName = `r7-act2-${row.segNo}`;
    const committed = parseTape(JSON.parse(
        readFileSync(join(TAPES, `${committedName}.json`), 'utf8')));
    /**
     * ⛔ THE ROOM'S OWN TIMED CLEARS ARE STRIPPED, and the boot-time ones are
     * not. A timed `at` row in THIS room is exactly the thing the loop is
     * supposed to derive; a boot-time clear from an earlier room is somebody
     * else's measurement riding in the boot block, which the seam machinery
     * reads and this loop has no business re-deriving.
     */
    const base = committed.persistence.filter((p) => p.at === undefined || p.at === null);
    const stripped = committed.persistence.filter((p) => p.at !== undefined && p.at !== null);
    console.log(`\n## ${name} (${row.source}-sourced)`);
    console.log(`   stripped ${stripped.length} committed timed clear(s): `
        + `[${stripped.map((p) => `{${p.level},${p.tag}}@${p.at}`).join(', ') || 'none'}] — `
        + 'the loop derives its own');
    const makeRun = (persistence) => createLevelRun({
        levelSource, boot: committed.boot, noclip: false, noHazards: committed.noHazards,
        noDamage: false, grants: committed.grants, persistence, despawn: [],
        equips: committed.equips, pins: committed.pins ?? [], save: committed.save ?? null,
        rng: committed.rng ?? null, seam: committed.seam ?? null,
        // ⛔ THE REPLAY'S OWN CENSUS, BY NAME (trap 158).
        roles: ROLES,
    });
    const template = {
        game: 'seedling',
        boot: committed.boot,
        noclip: false,
        noDamage: false,
        noHazards: committed.noHazards,
        grants: committed.grants,
        equips: committed.equips,
        pins: committed.pins,
        save: committed.save,
        rng: committed.rng,
        seam: committed.seam,
    };
    const gameTick = row.source === 'game'
        ? (USE_GAME ? makeGameOracle(template) : null)
        : null;
    if (row.source === 'game' && !gameTick) {
        console.log('   ⛔ SKIPPED — this room\'s tick may only come from the GAME (§11.4), '
            + 'and `--game` was not passed. The model may NOT substitute here.');
        continue;
    }
    const r = await twoPassSolve({
        makeRun, goals: goalsFor(row.segNo), name, boot: committed.boot,
        persistence: base, gameTick, log: (m) => console.log(m),
    });
    const run = makeRun(r.persistence);
    for (const held of r.out.perTick) run.advance(held);
    const hits = run.playerHits.length;
    const deaths = run.playerDeaths.length;
    check(`${name}: ZERO hits and ZERO deaths (the standing zero-hit policy)`,
        hits === 0 && deaths === 0, `hits ${hits}, deaths ${deaths}`);
    check(`${name}: every declaration is ${row.source}-sourced`,
        r.declarations.every((d) => d.source === row.source),
        r.declarations.map((d) => `{${d.level},${d.tag}}@${d.at} (${d.source})`).join(', '));
    check(`${name}: the prefix agreement ran for every declaration`,
        r.prefixChecks.length === r.declarations.length,
        `${r.prefixChecks.length} check(s) over `
        + `[${r.prefixChecks.map((c) => c.comparedTicks).join(', ')}] tick(s)`);
    const folded = buildTape(r.out.perTick, committed.boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        ...template,
        name,
        persistence: r.persistence,
        tick_count: r.out.perTick.length,
        inputs: folded.inputs,
        tape_version: 9,
    };
    const description = `⛓ R8 SLICE 4 — THE LIVE SOLVER's own solution to battery segment `
        + `${row.segNo}, authored through the TWO-PASS AUTHORING LOOP `
        + `(\`twoPassSolve\`, kickoff §12.10.3). ${row.why} `
        + `The loop took ${r.passes.length} pass(es) `
        + `[${r.passes.map((p) => p.kind).join(' -> ')}] and declared `
        + `${r.declarations.map((d) => `{${d.level},${d.tag}} at ${d.at}`).join(', ')} — `
        + `${row.source}-sourced, then VERIFIED: pass N and pass N+1 press identical keys `
        + `on every tick below the declared one `
        + `(${r.prefixChecks.map((c) => c.comparedTicks).join(', ')} compared), because a `
        + 'clear cannot reach the world before its own tick. '
        + `Boot: ${committedName}'s committed v8 block, staged per kickoff §3.5, with that `
        + `tape's own timed clear(s) STRIPPED. GOALS derived from the chain's own units; `
        + 'the hand-authored stances, waypoints and hold ticks were NOT handed over. '
        + `Solver: ${r.out.perTick.length} ticks, ${r.out.trace.rows.length} decision(s); `
        + `hand answer ${committedName}: ${committed.tick_count} ticks. ⛔ `
        + `${committedName}'s own \`at\` is NOT touched — §11.5 showed it is the end of a `
        + 'phases block and therefore an UPPER BOUND, and no re-record licence exists this '
        + 'rung. Authored by scripts/procgen/solve-seedling-r8-tail.mjs; trace sidecar in '
        + 'fixtures/traces/.';
    emit(join(TAPES, `${name}.json`), tapeJson(tape, description), name);
    emit(join(TRACES, `${name}.trace.json`),
        `${JSON.stringify(r.out.trace, null, 4)}\n`, `${name} trace`);
    summary.push({
        name, solver: r.out.perTick.length, hand: committed.tick_count,
        passes: r.passes.length, declarations: r.declarations,
    });
}

console.log('\n## solver vs hand, tick for tick (INFORMATION, not a gate)');
for (const s of summary) {
    const d = s.solver - s.hand;
    console.log(`  ${s.name.padEnd(14)} solver ${String(s.solver).padStart(4)} | `
        + `hand ${String(s.hand).padStart(4)} | ${d === 0 ? '==' : (d > 0 ? `+${d}` : d)}`
        + `  | ${s.passes} pass(es), declared `
        + `${s.declarations.map((x) => `{${x.level},${x.tag}}@${x.at}`).join(' ')}`);
}

if (CHECK) {
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
}
process.exit(failures ? 1 : 0);
