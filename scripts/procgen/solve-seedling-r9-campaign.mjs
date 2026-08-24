#!/usr/bin/env node
/**
 * solve-seedling-r9-campaign — **THE TRUE-START SOLVER CHAIN**: every room of
 * Seedling's sphere order from `new Game(0,80,128)` to the arrival the chain
 * currently ends at, driven by the live solver, each segment booting its
 * predecessor's MEASURED LATCH. ⚖ Ruling 11 (user, 2026-08-20), R9 slice 6.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────
 *
 * ⚖ *"As we work our way through Seedling, I'll want to construct a sequence
 * of tapes to play back our solutions from the beginning of the game, and so
 * if there are tapes from our solutions so far that don't work, then I'll want
 * to fix them. And I'll want the tapes to be recorded from the solver, not
 * constructed manually."*
 *
 * The census (`census-seedling-campaign.mjs`, R9 §13.3) turned that into a fix
 * list: the solver battery's rooms are in sphere order and CONTINUE pairwise
 * as far as `r8-solve-4`, and from there every successor's declared latch was
 * measured after a walk of a different length. This script is the fix.
 *
 * ⛔ THE ROOM LIST IS NOT REPEATED HERE. It was, for six slices — sixteen
 * lines of `name / level / to / note` that had to be grown by hand every time
 * the chain grew, which is the seventh copy of the one fact ⚖ ruling 38 (1)
 * removes. The list is `frontend/modules/seedlingDemo/campaignChain.js`, and
 * the table with each room's measured tick count is GENERATED into
 * `docs/json/developer/procgen/seedling-bot.md`'s `campaign-chain` region by
 * `generate-procgen-reference.mjs`.
 *
 * ── ⛔⛔ WHY THE LATCHES ARE MEASURED PER SEGMENT AND NOT IN ONE CONTINUATION
 *
 * The brief asked for ONE continuation run through the Windows driver's
 * `--tapes`, harvesting every latch from it. **That cannot author this chain,
 * and the reason is an ordering fact rather than a preference**: segment k's
 * tape declares segment k−1's latch, so segment k's tape does not exist until
 * segment k−1 has run — and `--tapes` takes the whole list up front. A run
 * driven with provisional boots would harvest latches from a game whose clock
 * and stream were pinned by numbers nobody had measured yet.
 *
 * ⛓ AND THE LATCH A CONTINUATION PRODUCES IS NOT THE ONE THE GATE ASKS FOR.
 * `playthroughAcceptance.chainFindings` replays every segment on its OWN FRESH
 * PAGE and asserts `boot(k+1) == latch(k)` over all 46 signature rows; so does
 * the differential's `--record`. A latch harvested from a continuation is only
 * equal to that when the continuation is already stream-identical to the fresh
 * replay — which is the thing being authored. ⇒ this script keeps `solve-
 * seedling-r8-d2-chain.mjs`'s `latchOf`: ONE fresh-page run per segment, in
 * order, on the artifact that will be committed. The CONTINUATION is the
 * CLAIM, and it is made where it belongs — `?tapes=r9-campaign` on both sides.
 *
 * ── ⛔ ONE PRODUCER PER TAPE (trap 169) ──────────────────────────────────
 *
 * This script OWNS `r8-solve-5`, `-6`, `-7`, `-8`, `-9`, `-10`, `r9-solve-3`
 * and the four new legs, because the boot each needs is its predecessor's
 * MEASURED LATCH and the producers that used to author them derive a boot from
 * `r7-act2-N`'s committed staged block instead. Two derivations of one file is
 * trap 169's birthplace, so ownership MOVES rather than being shared:
 * `solve-seedling-r8-battery.mjs` and `solve-seedling-r8-tail.mjs` name the
 * rows they handed over, and `solve-seedling-r9-l3.mjs` is retired to a
 * one-line pointer. Segments 1–4 are PROMOTED: their boots already ARE their
 * predecessors' latches (the census measured CONTINUES on all three pairs) and
 * segment 1's is the game's own boot, so the battery keeps them and this chain
 * gives them a RELATION rather than a rewrite.
 *
 * ── ⛔⛔ THERE IS NO CONCATENATED TAPE — ⚖ RULING 37 (user, 2026-08-23) ──
 *
 * *"the plan was to use the tools to play the individual campaign tapes in
 * sequence, not combine them into one tape."* This script used to emit a
 * SEVENTEENTH artifact, `r9-campaign.json`: all sixteen rooms solved again in
 * ONE run, so the segments had something to be tick-for-tick identical to. It
 * is gone, and with it the `--headline` flag (the cheap model-only ask), the
 * `sum(segment ticks) === headline.tick_count` row and the cut derivation off
 * its arrivals.
 *
 * ⛓ WHAT REPLACED THE CLAIM, AND WHY IT IS NOT A LOSS. The one-run tape was a
 * REDUNDANT witness and was measured to be one before it was deleted: the
 * sixteen segments played alone by the model and concatenated are its 3616
 * observations with no differing index. What ENDS-MEET meant — two different
 * runs of one walk agreeing — is asserted where the second run actually
 * happens: `?tapes=r9-campaign` on the JS page and on the real recompiled game,
 * every boundary admitted against the LIVE world's own latch. The arithmetic
 * kept here is `sum(segment ticks) === PLAYTHROUGH_CHAINS.r9-campaign.endsAt`,
 * which compares THIS RUN's solves against the COMMITTED tapes and is a claim
 * about two derivations rather than one.
 *
 * Run (model-side; the latch runs need Windows Chrome and a dev server):
 *   node scripts/procgen/solve-seedling-r9-campaign.mjs
 *   node scripts/procgen/solve-seedling-r9-campaign.mjs --check   # no browser
 *
 * Then record (the game is the only oracle) — ⛔ ALWAYS `--only=`, and ⛔ NOT
 * `r8-solve-1..4`, which this chain promoted and did not re-author:
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-solve-5,r8-solve-6,r8-solve-7,r8-solve-8,r8-solve-9,\
 * r8-solve-10,r9-solve-11,r9-solve-3,r9-solve-2,r9-solve-0,r9-solve-13,\
 * r9-solve-14
 */

import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { committedTick0, tick0ParseFields, despawnField, tick0Field }
    from './tick0Carry.js';
import { createWalkReport } from './walkReport.js';
/**
 * ⛔ THE ONE DECLARATION (⚖ ruling 38 (1), R9 slice 12d). A static import
 * rather than the dynamic `await import(MODULE, …)` the runtime modules below
 * use: this one is inert data with no imports of its own, so it needs no path
 * computed at load and reads like what it is.
 */
import { CAMPAIGN_SEGMENTS } from
    '../../frontend/modules/seedlingDemo/campaignChain.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');
const TRACES = join(MODULE, 'fixtures', 'traces');

/**
 * ⛓ R9 slice 12c′, ⚖ ruling 43 — **THIS PRODUCER'S OWN WALK REPORT**, written
 * only when `--walk-report=<path>` is passed and silent otherwise, so this
 * script's `--check` stdout (and therefore its standing `--check` md5) is
 * byte-identical with the flag absent. `rerecord-seedling-campaign.mjs` S0
 * reads it to MEASURE which committed walks today's solver re-solves
 * differently — never to predict one.
 */
const WALK_REPORT = createWalkReport({
    producer: 'solve-seedling-r9-campaign.mjs',
    tapesDir: TAPES,
    /**
     * ⛓ THE FLAG TOKEN IS FOUND **HERE**, not only inside the helper. The
     * instruments index publishes "the flags it reads out of `argv`" by
     * scanning each instrument's own text, and a flag parsed one module away
     * is a flag its table would omit — about the very producers ⚖ ruling 43's
     * mode depends on. `walkReport.js` still owns the PARSE (a bare
     * `--walk-report` is refused by name there).
     */
    arg: process.argv.find((a) => a === '--walk-report'
        || a.startsWith('--walk-report=')),
});


const CHECK = process.argv.includes('--check');

const {
    parseTape, requiredTapeVersion, assertTapeWithinRuntimeBudget, gameVisibleTape,
    heldKeysAt,
} = await import(join(MODULE, 'tapeFormat.js'));
/** ⛓ ONE spelling of "what does this tape hold at tick k" — the format's own. */
const heldAt = (tape, k) => heldKeysAt(tape, k);
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { segmentBootFromLatch, seamLatchFindings } =
    await import(join(MODULE, 'r7Acceptance.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
const { declaredSeamTimeAfter } = await import(join(MODULE, 'gameClock.js'));

const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * ⛔⛔⛔ THE SUCCESSOR'S BOOT IS THE **GAME'S** LATCH, NOT THE MODEL'S.
 * `SEAM_BOOT_SPEC` marks the three RNG streams `modelled: false` — the model
 * TRANSPORTS them and does not simulate them — so a boot the model invented
 * for them would be a number nobody measured. ONE fresh-page run per segment,
 * on the artifact that will be committed.
 */
/**
 * ⛓ THE LATCH IS A PURE FUNCTION OF THE TAPE, so a re-run of this producer over
 * an UNCHANGED segment must not spend the GPU again. The cache key is the md5
 * of the exact bytes handed to the driver; a byte that moves invalidates it,
 * which is the only property that makes reuse honest. ⛔ Cleared by deleting
 * `/mnt/c/playwright/latch-*.json`.
 */
function latchOf(label, tapeObj) {
    mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
    const payload = JSON.stringify(gameVisibleTape(parseTape(tapeObj)));
    const key = createHash('md5').update(payload).digest('hex').slice(0, 12);
    const cached = join(WIN_SCRATCH_WSL, `latch-${label}-${key}.json`);
    if (existsSync(cached)) {
        console.log(`    ${label}: latch REUSED from ${key} (the tape's bytes are `
            + 'unchanged, and a latch is a pure function of them)');
        return JSON.parse(readFileSync(cached, 'utf8'));
    }
    writeFileSync(join(WIN_SCRATCH_WSL, 'seedling-bot-replay-win.py'),
        readFileSync(WIN_DRIVER));
    const outWsl = join(WIN_SCRATCH_WSL, `stream-${label}.json`);
    writeFileSync(join(WIN_SCRATCH_WSL, `tape-${label}.json`),
        JSON.stringify(gameVisibleTape(parseTape(tapeObj))));
    try { unlinkSync(outWsl); } catch { /* first run */ }
    const t0 = Date.now();
    let out;
    try {
        out = execFileSync(WIN_PY, [
            '-3.12', `${WIN_SCRATCH_DOS}\\seedling-bot-replay-win.py`,
            '--url', PAGE_URL,
            '--tape', `${WIN_SCRATCH_DOS}\\tape-${label}.json`,
            '--out', `${WIN_SCRATCH_DOS}\\stream-${label}.json`,
            '--deadline-sec', String(Math.ceil(tapeObj.tick_count * 1.5) + 180),
        ], { cwd: WIN_SCRATCH_WSL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        const said = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
        throw new Error(`${e.message}${said ? `\n${said}` : ''}`);
    }
    out.replace(/\r/g, '').split('\n')
        .filter((l) => l && !/wsl\.localhost|CMD\.EXE|UNC paths/i.test(l))
        .forEach((l) => console.log(`    ${l}`));
    if (!existsSync(outWsl)) throw new Error(`windows driver wrote no stream for ${label}`);
    const got = JSON.parse(readFileSync(outWsl, 'utf8'));
    // ⛔ THE DURATION IS A WALL CLOCK, SO IT IS NOT PRINTED UNDER `--check`.
    // ⚖ Ruling 8 publishes a producer's `--check` stdout md5 as a byte-inertia
    // fingerprint, and R9 slice 9 caught this line moving one of them with
    // MACHINE LOAD alone (`plan-seedling-r7-ends-meet`, 227s vs 292s vs 223s,
    // the only differing byte in the whole output). A fingerprint that moves
    // with the machine is not a fingerprint. The line still prints on the
    // RECORD path, where it is progress rather than a claim.
    console.log(`    drove ${label}: ${got.stream.ticks.length} observations, `
        + `${got.status.dead_frames} dead${CHECK ? '' : `, ${((Date.now() - t0) / 1000).toFixed(0)}s`}`);
    if (!got.seam) throw new Error(`${label}: the driver returned no seam block`);
    writeFileSync(cached, JSON.stringify(got.seam));
    return got.seam;
}

/**
 * ⛔ A latch that is not a calm arrival, or that `segmentBootFromLatch` refuses
 * (partial, no `beginEntry`, an unrepresentable field), is a STOP: the
 * successor's boot could not reproduce it, and authoring one anyway would put
 * a state nobody measured into a committed tape (⚖ ruling 11).
 */
function segmentBootFrom(label, latch) {
    const calm = seamLatchFindings(latch, { requireCalm: true });
    const notCalm = calm.filter((r) => !r.ok);
    check(`${label} ends at a CALM ARRIVAL in the GAME`, notCalm.length === 0,
        notCalm.length === 0
            ? `${calm.length - 1} signature rows latched at tick ${latch.seam['latch.tick']}`
            : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));
    if (notCalm.length) {
        throw new Error(`${label}: refusing to author a segment from a latch that is not `
            + 'a calm arrival — the boot could not reproduce it');
    }
    const blocks = segmentBootFromLatch(latch);
    return {
        boot: blocks.boot,
        state: {
            persistence: blocks.persistence ?? [],
            equips: blocks.equips ?? [],
            pins: blocks.pins ?? [],
            save: blocks.save ?? null,
            rng: blocks.rng ?? null,
            seam: blocks.seam ?? null,
        },
    };
}

const levelSource = atlasLevelSource();

/** A room's own placement, from the atlas — never a coordinate typed by hand. */
const placement = (level, type) => {
    const e = (levelSource(level).entities ?? []).find((x) => x.type === type);
    if (!e) throw new Error(`L${level} has no ${type}`);
    return { x: e.x, y: e.y };
};
/** The exit to a named level, from the atlas — `attrs.to` is the game's own. */
const exitTo = (level, to) => {
    const hits = (levelSource(level).entities ?? []).filter(
        (x) => (x.type === 'stairsup' || x.type === 'stairsdown' || x.type === 'teleporter')
            && Number(x.attrs?.to) === to);
    if (hits.length !== 1) {
        throw new Error(`L${level} has ${hits.length} exits to L${to}; the goal would be `
            + 'ambiguous');
    }
    return { x: hits[0].x, y: hits[0].y };
};

const collect = (level, type) => ({ kind: 'collect-placement', placement: placement(level, type) });
const reach = (level, to) => ({ kind: 'reach-exit', exit: exitTo(level, to) });

/**
 * ⛔⛔ THE SEGMENT LIST IS NOT DECLARED HERE ANY MORE — ⚖ ruling 38 item (1),
 * R9 slice 12d. It lives in `frontend/modules/seedlingDemo/campaignChain.js`,
 * the ONE declaration every consumer derives from, and this file's `SEGMENTS`
 * is now a RECONSTRUCTION of it: each row's goals are `collects` turned into
 * `collect-placement` on that room's own atlas entity, then `reach-exit`
 * toward `to`. Every coordinate is still read out of the atlas by
 * `placement`/`exitTo`; not one stance, waypoint or hold tick is handed to the
 * solver, which is ruling 11's *"recorded from the solver, not constructed
 * manually"* in its operational form.
 *
 * ⛓ THE DEPENDENCY RUNS THIS WAY ONLY, and that is a fact about this file:
 * it solves the whole campaign at module scope and drives Windows Chrome, so
 * nothing can import IT. `campaignChain.js` has no imports at all and is
 * browser-safe, so the browser consumers read the same list the tapes are
 * authored from. `survey-seedling-route.mjs` derives the same level sequence
 * from the sphere order independently, and its rows are compared against
 * these below.
 */
const SEGMENTS = CAMPAIGN_SEGMENTS.map((s) => Object.freeze({
    ...s,
    goals: [
        ...(s.collects ?? []).map((type) => collect(s.level, type)),
        reach(s.level, s.to),
    ],
}));

/** ⛓ The head of the chain: the committed true start, read off disk. */
const HEAD_NAME = SEGMENTS[0].name;
const HEAD_RAW = JSON.parse(readFileSync(join(TAPES, `${HEAD_NAME}.json`), 'utf8'));
const HEAD = parseTape(HEAD_RAW);

/**
 * Each segment's COMMITTED length, read off disk — `null` for a segment this
 * run is authoring for the first time, which is what `--grow` passes through.
 * ⛔ A missing tape is reported as a mismatch by the row that reads this, not
 * skipped: "the tape is not there yet" and "the tape disagrees" must not print
 * the same thing.
 */
const committedTicks = SEGMENTS.map((s) => {
    const path = join(TAPES, `${s.name}.json`);
    return existsSync(path)
        ? parseTape(JSON.parse(readFileSync(path, 'utf8'))).tick_count : null;
});

const stateOf = (t) => ({
    persistence: t.persistence, equips: t.equips, pins: t.pins ?? [],
    save: t.save ?? null, rng: t.rng ?? null, seam: t.seam ?? null,
});

const runFrom = (boot, state) => createLevelRun({
    levelSource,
    boot,
    noclip: false,
    noHazards: [],
    noDamage: false,
    grants: [],
    despawn: [],
    persistence: state.persistence,
    equips: state.equips,
    pins: state.pins,
    save: state.save,
    rng: state.rng,
    seam: state.seam,
    // ⛔ THE REPLAY'S OWN CENSUS, BY NAME (trap 158).
    roles: ROLES,
});

/** The per-segment claims every walk on this chain owes. */
function claimArrival(name, run, to) {
    const hits = run.playerHits.length;
    const deaths = run.playerDeaths.length;
    check(`${name}: ZERO hits and ZERO deaths`, hits === 0 && deaths === 0,
        `hits ${hits}, deaths ${deaths}`);
    const t = run.transitions[run.transitions.length - 1];
    check(`${name}: ends at the L${to} ARRIVAL (§3.5)`, Boolean(t) && t.to_level === to,
        JSON.stringify(run.transitions.map((x) => `${x.t}:L${x.to_level}`)));
    check(`${name}: the arrival is CALM (v = 0 at the latch)`,
        run.state.vx === 0 && run.state.vy === 0, `v=(${run.state.vx},${run.state.vy})`);
    return t;
}


/**
 * ⛓⛓⛓ **THE GAME-SOURCED TICK, TRANSPORTED RATHER THAN RE-MEASURED** — and the
 * guard is what makes that legal.
 *
 * L8's two kill locks are `SandTrap` bodies dying to `arrowtrap@96,16`'s
 * column, and §11.4 REFUSES to compute that death so that ONE writer owns each
 * slot: `twoPassSolve` demands a `gameTick` oracle and will not let the model
 * substitute. `solve-seedling-r8-tail.mjs` answers it with a BINARY SEARCH over
 * truncated probe tapes driven on real-GPU Windows Chrome — a dozen runs per
 * clear. On a 15-room headline that is hours of game per authoring pass.
 *
 * ⛔ AND IT WOULD BE MEASURING SOMETHING ALREADY MEASURED. `r8-solve-8`
 * declares `{8,0}@246` and `{8,1}@645`, and those two numbers came out of the
 * game through exactly that search. The question this oracle answers is not
 * "when does the trap kill the body" but "is THIS walk the walk that number
 * was measured on" — which is checkable offline, key for key.
 *
 * ⇒ the oracle answers `offset + committed.at` **only when the walk it is
 * being asked about is byte-identical to the committed walk up to that tick**,
 * and REFUSES BY NAME otherwise. A refusal is a STOP that names the real cure
 * (`solve-seedling-r8-tail.mjs --game`), never a guess. ⛔ It is not a model
 * substitution: the number is the GAME's, and the guard is the statement that
 * it is still the same measurement.
 */
function makeRebasedOracle(owners) {
    return async ({ perTick, pending, name }) => {
        const owner = owners.find((o) => o.rows.some(
            (r) => r.level === pending.level && r.tag === pending.tag));
        if (!owner) {
            throw new Error(`${name}: {${pending.level},${pending.tag}} (${pending.why}) has `
                + 'no committed GAME-sourced measurement to transport. The cure is '
                + '`solve-seedling-r8-tail.mjs --game`, whose binary search asks the game '
                + 'directly; this oracle only carries a number the game already gave.');
        }
        const row = owner.rows.find(
            (r) => r.level === pending.level && r.tag === pending.tag);
        const at = owner.offset + row.at;
        // ⛔ THE GUARD. Every tick of the owning segment's span, up to the
        //    clear, must be the SAME HELD SET the committed walk pressed.
        let firstDiff = -1;
        for (let k = 0; k <= row.at && k < owner.tape.tick_count; k += 1) {
            const a = [...heldAt(owner.tape, k)].sort().join('+');
            const b = [...(perTick[owner.offset + k] ?? [])].sort().join('+');
            if (a !== b) { firstDiff = k; break; }
        }
        if (firstDiff !== -1) {
            throw new Error(`${name}: the walk this oracle was asked about is NOT the walk `
                + `{${pending.level},${pending.tag}}@${row.at} was measured on — they part `
                + `at ${owner.name} tick ${firstDiff} (committed holds `
                + `[${[...heldAt(owner.tape, firstDiff)].sort().join(', ')}], this walk holds `
                + `[${[...(perTick[owner.offset + firstDiff] ?? [])].sort().join(', ')}]). `
                + 'Transporting the number would be inventing a measurement. Re-measure '
                + 'with `solve-seedling-r8-tail.mjs --game`.');
        }
        return {
            at,
            evidence: `the GAME's own \`persistence_cleared\`, measured on ${owner.name} `
                + `at tick ${row.at} by \`solve-seedling-r8-tail.mjs --game\`'s binary `
                + `search over truncated probe tapes, and TRANSPORTED here by `
                + `${owner.offset} because this walk is byte-identical to that one for `
                + `${Math.min(row.at + 1, owner.tape.tick_count)} tick(s) — held set for `
                + 'held set, checked above',
        };
    };
}

/** The committed timed rows of the segments that own a game-sourced clear. */
function ownersFrom(offsets) {
    return SEGMENTS.map((seg, i) => {
        const path = join(TAPES, `${seg.name}.json`);
        if (!existsSync(path)) return null;
        const tape = parseTape(JSON.parse(readFileSync(path, 'utf8')));
        const rows = (tape.persistence ?? []).filter((c) => c.at !== undefined);
        if (!rows.length) return null;
        if (offsets[i] === null || offsets[i] === undefined) return null;
        return { name: seg.name, tape, rows, offset: offsets[i] };
    }).filter(Boolean);
}

// ── the segments, each booted from its predecessor's MEASURED latch ────
const results = [];
let carried = null;

/**
 * ⛔ THE SEGMENTS COME FIRST, AND THAT IS THE GAME-SOURCED TICK'S DOING. The
 * headline's `{8,0}`/`{8,1}` are rebased by the OFFSET of the segment that owns
 * them, and an offset is a segment's tick count — so the segments must be
 * solved before the headline can be asked. ⚠ Under `--headline` there are no
 * measured latches to solve them from, so the offsets come from the COMMITTED
 * tick counts instead, and the run says so.
 */
for (let i = 0; i < SEGMENTS.length; i += 1) {
    const seg = SEGMENTS[i];
    const last = i === SEGMENTS.length - 1;
    if (seg.promoted) {
        /**
         * ⛓ A PROMOTED SEGMENT IS NOT SOLVED HERE. Its boot already IS its
         * predecessor's latch (the census measured CONTINUES on every pair up
         * to `r8-solve-4`, and segment 1's boot is the game's own), so
         * re-authoring it would spend a re-record licence on a relation.
         * `solve-seedling-r8-battery.mjs` keeps it; this chain reads the
         * committed tape for the cut and DRIVES that exact artifact for the
         * successor's boot.
         */
        const raw = JSON.parse(readFileSync(join(TAPES, `${seg.name}.json`), 'utf8'));
        const t = parseTape(raw);
        results.push({ seg, run: null, out: { perTick: { length: t.tick_count } },
            boot: t.boot, state: stateOf(t), promotedRaw: raw, to: seg.to });
        /**
         * ⛔ AND A LATCH IS ONLY DRIVEN WHEN SOMETHING NEEDS IT. A PROMOTED
         * successor reads its boot off its own committed tape, so measuring
         * the predecessor's latch here would spend a browser run to learn a
         * number nobody consumes. That the three promoted seams really do
         * hold is MEASURED, not assumed — the census admits all three pairs on
         * the JS tier and R9 §14.2's wasm prefix run admits `boundary 1/11`,
         * `2/11` and `3/11` on the real game, `seam` and `rng` both.
         */
        if (!CHECK && !last && !SEGMENTS[i + 1].promoted) {
            carried = segmentBootFrom(seg.name, latchOf(seg.name, raw));
        }
        continue;
    }
    /**
     * ⚠ UNDER `--check` THE SUCCESSOR READS ITS OWN COMMITTED BOOT rather than
     * re-driving the game for it: the producer check asks "is this artifact
     * what the solver derives", and re-measuring a latch that has not changed
     * would spend a browser run to learn the numbers the tape already carries.
     * A latch that HAS changed shows up as a byte diff, which is the check.
     */
    if (CHECK) {
        const committed = parseTape(JSON.parse(
            readFileSync(join(TAPES, `${seg.name}.json`), 'utf8')));
        carried = { boot: committed.boot, state: stateOf(committed) };
    }
    const { boot, state } = carried;
    let run = runFrom(boot, state);
    const before = { hasSword: run.inventory.hasSword, seals: run.chestOpens.length };
    /**
     * ⛔ A ROOM WHOSE CLEAR THE MODEL MAY NOT COMPUTE GOES THROUGH THE TWO-PASS
     * LOOP, not `solveSegment` — L5's `{5,0}` is model-sourced and L8's
     * `{8,0}`/`{8,1}` are GAME-sourced (§11.4). Every other room has no timed
     * row at all and `solveSegment` is the whole answer.
     */
    const committedPath = join(TAPES, `${seg.name}.json`);
    const needsTwoPass = existsSync(committedPath)
        && (parseTape(JSON.parse(readFileSync(committedPath, 'utf8'))).persistence ?? [])
            .some((c) => c.at !== undefined);
    let out;
    let solvedPersistence = state.persistence;
    if (needsTwoPass) {
        const latchRows = state.persistence.filter((c) => c.at === undefined);
        const r = await twoPassSolve({
            makeRun: (persistence) => runFrom(boot, { ...state, persistence }),
            goals: seg.goals,
            name: seg.name,
            boot,
            persistence: latchRows,
            gameTick: makeRebasedOracle(ownersFrom(SEGMENTS.map(() => 0))),
            log: (m) => console.log(m),
        });
        out = r.out;
        solvedPersistence = r.persistence;
        /**
         * ⛔ THE REPLAY RUN IS BUILT FROM THE **SOLVED** PERSISTENCE, not from
         * the boot's. `createLevelRun` takes timed clears AT CONSTRUCTION, so a
         * run staged before the loop derived `{5,0}@…` is a run that refuses
         * the very kill lock the loop just declared — `undeclaredKillLock`,
         * measured on the first launch of this path.
         */
        run = runFrom(boot, { ...state, persistence: solvedPersistence });
        for (const held of out.perTick) run.advance(held);
    } else {
        out = solveSegment({ run, goals: seg.goals, name: seg.name, boot });
    }
    claimArrival(seg.name, run, seg.to);
    results.push({ seg, run, out, boot, state: { ...state, persistence: solvedPersistence },
        before, to: seg.to });
    if (!CHECK && !last) {
        const provisional = {
            game: 'seedling', name: seg.name, boot,
            noclip: false, noDamage: false, noHazards: [], grants: [],
            persistence: solvedPersistence, equips: state.equips, pins: state.pins,
            save: state.save, rng: state.rng, seam: state.seam,
            tick_count: out.perTick.length,
            inputs: buildTape(out.perTick, boot, seg.name,
                { noclip: false, noDamage: false, noHazards: [], grants: [] }).inputs,
            // ⛓ DERIVED, never typed: a segment that carries a timed `at` row
            //   is a v9 tape and `parseTape` refuses it under a v8 header —
            //   which is how this line was found, on the first launch.
            tape_version: solvedPersistence.some((c) => c.at !== undefined) ? 9 : 8,
        };
        carried = segmentBootFrom(seg.name, latchOf(seg.name, provisional));
    }
}

// ── the chain's own arithmetic ────────────────────────────────────────
/**
 * ⛓⛓⛓ **THE ENDS-MEET ROW, AFTER ⚖ RULING 37.** It used to be `sum(segment
 * ticks) === headline.tick_count` — this run's solves against a SEVENTEENTH
 * artifact this run also produced. The headline is retired, so the second
 * derivation is the COMMITTED chain: `playthroughWalk` sums the tapes on disk
 * into `endsAt`, and that number was written by earlier runs of this script.
 *
 * ⛔ IT IS NOT VACUOUS AND THE DIFFERENCE MATTERS. `endsAt === sum(committed
 * tick_counts)` is true by construction inside one process (⚖ ruling 32 D);
 * what this compares is THIS RUN's own solve lengths against the committed
 * ones, which is exactly the claim that reds when a walk moves and its tape
 * does not. Under `--check` that is the byte comparison's arithmetic twin;
 * under a real run it is the reason a re-record is noticed.
 */
const segTicks = results.map((r) => r.out.perTick.length);
const segSum = segTicks.reduce((a, b) => a + b, 0);
/**
 * ⛔⛔ THE SECOND DERIVATION IS READ OFF DISK HERE, NOT IMPORTED FROM
 * `PLAYTHROUGH_CHAINS` — and the reason is a LOAD ORDER, found by `--grow`'s
 * own rehearsal rather than reasoned about.
 *
 * `playthroughWalk` derives `endsAt` by calling `loadTape` for every declared
 * segment AT MODULE SCOPE. So the moment the declaration names a room whose
 * tape does not exist yet — which is precisely the state a GROWTH passes
 * through, between the append and this script writing the tape — importing it
 * throws ENOENT, and the producer that is supposed to CREATE that tape cannot
 * start. §23c.7(a) predicted that shape in the other direction (*"a chain room
 * the producer never solves ENOENTs at load"*); this is the same edge on the
 * growth path, and the cure is not to take the dependency.
 *
 * ⛓ NOTHING IS LOST. The claim was never about `PLAYTHROUGH_CHAINS`: it is
 * THIS RUN's solved lengths against the COMMITTED tapes, and `committedTicks`
 * reads those tapes directly. A segment with no committed tape is SKIPPED BY
 * NAME rather than counted as a disagreement — "not recorded yet" and
 * "recorded and different" must not print the same thing.
 */
const fresh = SEGMENTS.filter((_, i) => committedTicks[i] === null).map((s) => s.name);
const committedSum = committedTicks.filter((n) => n !== null)
    .reduce((a, b) => a + b, 0);
const solvedSum = segTicks.filter((_, i) => committedTicks[i] !== null)
    .reduce((a, b) => a + b, 0);
if (fresh.length) {
    console.log(`## ⛓ ENDS-MEET is SCOPED: ${fresh.join(', ')} ha${fresh.length === 1
        ? 's' : 've'} no committed tape yet (a GROWTH is in flight), so the arithmetic `
        + 'runs over the segments that do have one. The new tape\'s own length is proved '
        + 'by the differential, which is what a first recording is for.');
}
check('⛓ sum(segment ticks) === the COMMITTED tapes\' own sum'
    + (fresh.length ? ` — over the ${SEGMENTS.length - fresh.length} recorded segment(s)`
        : ''),
solvedSum === committedSum,
`${segTicks.join(' + ')} = ${segSum}; recorded ${solvedSum} against committed `
    + `${committedSum}`);
check('⛓ every RECORDED segment\'s solved length is its committed tape\'s own',
    segTicks.every((n, i) => committedTicks[i] === null || n === committedTicks[i]),
    `${segTicks.join(',')} against ${committedTicks.map((n) => n ?? '—').join(',')}`);

console.log(`\n## the chain: ${segSum} ticks over ${SEGMENTS.length} rooms`);
SEGMENTS.forEach((s, i) => console.log(`   ${String(i + 1).padStart(2)} ${s.name.padEnd(13)} `
    + `L${String(s.level).padEnd(3)} -> L${String(s.to).padEnd(3)} ${String(segTicks[i]).padStart(5)} t`));
const cuts = segTicks.slice(0, -1).map(((run) => (n) => { run += n; return run; })(0));
console.log(`## PLAYTHROUGH_CHAINS.r9-campaign: cuts [${cuts.join(', ')}], `
    + `endsAt ${segSum}`);


/**
 * ⛓⛓⛓ THE FREE ORACLE, ASSERTED SEGMENT BY SEGMENT — `gameClock.
 * declaredSeamTimeAfter` computes the `seam.time` a successor MUST declare
 * from this segment's own counting, and every number on the right came out of
 * the GAME (`botSeam()` at a `Game.begin()` entry). ⛔ THE CHAIN COMPOUNDS: a
 * pairwise census computes each successor from the CURRENT declaration, and
 * once segment 5 moves, everything downstream of it moves too. §14.0.6 sealed
 * these numbers before the game was asked.
 *
 * ⚠ Segment 1 is the TRUE START and declares no `seam` at all, so its clock
 * refuses by name and the first oracle row is UNASKABLE — reported, never
 * silently skipped.
 */
{
    const rows = [];
    for (let i = 0; i < results.length - 1; i += 1) {
        const here = results[i];
        const next = results[i + 1];
        const declared = here.state.seam?.time;
        const wants = next.state.seam?.time;
        if (declared === undefined || wants === undefined) {
            rows.push(`${here.seg.name} -> ${next.seg.name}: UNASKED (no declared clock)`);
            continue;
        }
        const run = here.run ?? runFrom(here.boot, here.state);
        if (!here.run) {
            const t = parseTape(here.promotedRaw);
            for (let k = 0; k < t.tick_count; k += 1) run.advance(heldAt(t, k));
        }
        const predicted = declaredSeamTimeAfter({
            declaredTime: declared,
            deadFramesOwed: run.deadFramesOwed,
            tickCount: here.out.perTick.length,
        });
        check(`⛓ the free oracle: ${next.seg.name} declares seam.time ${wants}`,
            predicted === wants,
            `${declared} + ${run.deadFramesOwed} − LOAD_FADE_FRAMES + `
            + `${here.out.perTick.length} = ${predicted}`);
        rows.push(`${next.seg.name}=${wants}`);
    }
    console.log(`## the clock column: ${rows.join(' ')}`);
}

const goalLedgerRows = ['sword@L10', 'chest@L11'];
{
    const sword = results.find((r) => r.seg.name === 'r8-solve-10');
    const chest = results.find((r) => r.seg.name === 'r9-solve-11');
    check('⛓ segment 10 flips `hasSword` NOT-HELD -> HELD (the ledger\'s `sword@L10`)',
        sword?.before?.hasSword === false && sword?.run?.inventory.hasSword === true,
        `${sword?.before?.hasSword} -> ${sword?.run?.inventory.hasSword}`);
    // ⛔ `chestOpens` is the run's OWN ledger of chests it OPENED — one row per
    //    open, which is what `goalEarnedWitness` reads as a seal slot gained.
    //    `saveState.sealSlotsEarned` is a VIEW over the same array; the ledger
    //    is the array, so the claim reads the array.
    const opened = chest?.run?.chestOpens ?? [];
    check('⛓ segment 11 OPENS the chest (the ledger\'s `chest@L11`)',
        opened.length > (chest?.before?.seals ?? 0)
            && opened.every((c) => c.level === 11),
        `${chest?.before?.seals} -> ${opened.length}: ${JSON.stringify(opened)}`);
}

// ── emit ──────────────────────────────────────────────────────────────
const DESCRIPTION_HEAD = '⛓⛓⛓ R9 SLICE 6 — SEGMENT %N% of `r9-campaign`, THE TRUE-START '
    + 'SOLVER CHAIN (⚖ ruling 11, user 2026-08-20: "a sequence of tapes to play back our '
    + 'solutions from the beginning of the game … recorded from the solver, not '
    + 'constructed manually"). ';
const DESCRIPTION_TAIL = ' ⛔ ITS BOOT IS %PRED%\'s MEASURED LATCH — every field read out '
    + 'of the running game by `botSeam()` and turned into blocks by '
    + '`segmentBootFromLatch`, not a staged declaration: the save arrays, the persistence '
    + 'set, the three RNG streams and `seam.time`. Two of those rows are `modelled: '
    + 'false` by `SEAM_BOOT_SPEC` on purpose, which is exactly why a Windows-driver run '
    + 'and not a model line produces them. GOALS come from the atlas (`placement` / '
    + '`exitTo`); no stance, waypoint or hold tick was handed to the solver. Authored by '
    + 'scripts/procgen/solve-seedling-r9-campaign.mjs; trace sidecar in fixtures/traces/.';

function descriptionFor(r, i) {
    const pred = SEGMENTS[i - 1]?.name ?? '(none)';
    return DESCRIPTION_HEAD.replace('%N%', String(i + 1))
        + `${r.seg.why}. Solver: ${r.out.perTick.length} ticks, `
        + `${r.out.trace.rows.length} decision(s), ${r.out.replans} re-plan(s), ZERO hits.`
        + DESCRIPTION_TAIL.replace('%PRED%', pred);
}

function tapeJson(obj, description, label) {
    const declaredVersion = (obj.persistence ?? []).some((r) => r.at !== undefined) ? 9 : 8;
    // ⛓ R9 slice 8: the tick-0 latch is CARRIED, never authored — read off
    // the committed tape, which is the artifact (⚖ ruling 17). Spread AFTER
    // `declaredVersion`, which the field invalidates: a tick-0 block below
    // v11 is refused BY DEFINITION, so a producer that carried the block and
    // not the version would refuse its own committed tape.
    const tick0 = committedTick0(TAPES, label);
    const parsed = parseTape({
        ...obj, tape_version: declaredVersion, ...tick0ParseFields(tick0, obj),
    });
    const budget = assertTapeWithinRuntimeBudget({ ...obj, tape_version: declaredVersion },
        label);
    console.log(`## ${label} budget: ${budget.spans} span(s), `
        + `${Math.round(budget.bytes / 1024)} KB, ${parsed.tick_count} ticks`);
    return `${JSON.stringify({
        tape_version: requiredTapeVersion(parsed),
        game: 'seedling',
        name: label,
        description,
        boot: parsed.boot,
        noclip: parsed.noclip,
        noDamage: parsed.noDamage,
        noHazards: parsed.noHazards,
        grants: parsed.grants,
        persistence: parsed.persistence,
        ...despawnField(tick0, parsed),
        equips: parsed.equips,
        pins: parsed.pins,
        save: parsed.save,
        rng: parsed.rng,
        seam: parsed.seam,
        ...tick0Field(tick0, parsed),
        tick_count: parsed.tick_count,
        inputs: parsed.inputs,
    }, null, 4)}\n`;
}

function emit(path, json, what) {
    // ⛓ R9 slice 12c′ — the walk report is taken HERE, above the write, so the
    // committed side is read BEFORE `--check`-less runs overwrite it.
    WALK_REPORT.note(path, json);
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

mkdirSync(TRACES, { recursive: true });
for (let i = 0; i < results.length; i += 1) {
    const r = results[i];
    if (r.seg.promoted) {
        console.log(`## ${r.seg.name}: PROMOTED, not re-authored — `
            + `${r.out.perTick.length} ticks read from the committed tape`);
        continue;
    }
    const obj = {
        game: 'seedling', name: r.seg.name, boot: r.boot,
        noclip: false, noDamage: false, noHazards: [], grants: [],
        persistence: r.state.persistence,
        equips: r.state.equips, pins: r.state.pins, save: r.state.save,
        rng: r.state.rng, seam: r.state.seam,
        tick_count: r.out.perTick.length,
        inputs: buildTape(r.out.perTick, r.boot, r.seg.name,
            { noclip: false, noDamage: false, noHazards: [], grants: [] }).inputs,
    };
    emit(join(TAPES, `${r.seg.name}.json`), tapeJson(obj, descriptionFor(r, i), r.seg.name),
        r.seg.name);
    emit(join(TRACES, `${r.seg.name}.trace.json`),
        `${JSON.stringify(r.out.trace, null, 4)}\n`, `${r.seg.name} trace`);
}
console.log(`\n## r9-campaign: ${segSum}t = `
    + `${SEGMENTS.map((s, i) => `${s.name} ${segTicks[i]}t`).join(' + ')}, `
    + `${SEGMENTS.length - 1} internal seam(s)`);
console.log(`## goal ledger rows this chain CREDITS: ${goalLedgerRows.join(', ')}`);
console.log('## there is NO hand answer for the four new legs — the differential is the gate.');

if (CHECK) console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
