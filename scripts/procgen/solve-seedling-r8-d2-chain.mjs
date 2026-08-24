#!/usr/bin/env node
/**
 * solve-seedling-r8-d2-chain — D2's LAST **THREE** ROOMS AS ONE STAGED
 * MULTI-SEGMENT CHAIN, driven by the live solver. R8 slice 7 track D;
 * SPLICED at R9 slice 3.
 *
 * ── WHAT THIS IS, AND WHY IT IS **THREE** SEGMENTS ────────────────────
 *
 * ⛓⛓⛓ R9 SLICE 3 SPLICED L18 IN FRONT — ⚖ ruling 5's ONE attributed licence
 * (R8 close, option A, user 2026-08-11). What R8 §18.4.1 carried as its first
 * close-out debt is discharged here.
 *
 * Every staged chain before this one has exactly ONE segment: a room, a boot,
 * a walk. This is the machinery's first chain whose segments have to LATCH to
 * each other — `boot(N+1) == latch(N)` over all 46 signature rows — while
 * still being staged at the head.
 *
 *   `r8-solve-18`  THE HONEST L18, **PROMOTED, NOT RE-AUTHORED**. D2's
 *               kill-lock room: `lock@144,112` is `tset -1`, two `Spinner`s
 *               are its only openers, and the walk takes NOTHING — zero hits,
 *               zero spinner contacts, on a tape that does not declare
 *               `noDamage`. It is `solve-seedling-r8-l18.mjs`'s artifact and
 *               stays so; this chain gives it a RELATION, not a rewrite.
 *   `r8-d2-19`  THE SHIELDSPIRE. Boot: **L18's MEASURED LATCH** — R8 recorded
 *               it staged at L19's own arrival from L18 by DECLARATION; the
 *               splice replaces that declaration with the number the game
 *               produces. The solver identifies `shieldboss@80,32` as the
 *               obstacle standing in the placement (`bosskey@96,64` is INSIDE
 *               his 48x48 body), fights him on a schedule derived from
 *               `shieldBossWindowFor`, collects the key, resolves
 *               `bosslock@48,32` through ⚖ §15.7a's mechanism graph to the
 *               `keylock` verb, and crosses to L20.
 *               ⛔ ONE SEGMENT — trap 150: a fight does not survive the door,
 *               so the fight and the crossing it opens cannot be cut apart.
 *   `r8-d2-20`  THE SHIELD, AND THE WAY OUT. Boot: `r8-d2-19`'s latch. Takes
 *               `shield@112,48`, then crosses WESTWARD through the three
 *               gates §15.2 found on the far side of it —
 *               `shieldlocknorm@176,16` (a latching TOUCH) ->
 *               `buttonroom@192,16` (a `room = -1` local publish) ->
 *               `lock@32,80` -> the four-cell alcove -> `stairsup@16,48` ->
 *               **L13**.
 *
 * ⛔ THE CHARGED ROUTE IS STILL NOT WALKABLE, and that is why this chain
 * begins at L18 rather than at L13. "L13's alcove -> L18 -> ..." has no edge:
 * `assertD2RouteGraph` re-derives the D2 graph from the atlas and L13's only
 * path to L18 runs through L14, L15 and L16 — none of them crossed. ⚖ Ruled:
 * three contiguous segments ending in L13, and all three are here.
 *
 * ⛓ WHAT R8's VERSION OF THIS FILE SAID, KEPT BECAUSE IT WAS TRUE THEN:
 * *"L18 IS NOT IN THIS CHAIN, and the reason is a measurement rather than a
 * budget: `R8_D2_COMPLETE.trackA` records the strike schedule built, driven,
 * and stopped by L18's south-west corner. A room that refuses is REPORTED,
 * never recorded."* R8 slice 8 then solved it — the disc became a LINE, the
 * scan's 40-candidate bound was fixed, and the kill lock got its writer — and
 * the room stopped refusing. The refusal is what made the recording legal.
 *
 * Run (model-side; the two latch runs need Windows Chrome and a dev server):
 *   node scripts/procgen/solve-seedling-r8-d2-chain.mjs --headline   # no browser
 *   node scripts/procgen/solve-seedling-r8-d2-chain.mjs
 *   node scripts/procgen/solve-seedling-r8-d2-chain.mjs --check
 *
 * Then record (the game is the only oracle) — ⛔ ALWAYS `--only=`, and ⛔ NOT
 * `r8-solve-18`, which this chain promoted and did not re-author:
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-d2,r8-d2-19,r8-d2-20
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { committedTick0, tick0ParseFields, despawnField, tick0Field }
    from './tick0Carry.js';
import { createWalkReport } from './walkReport.js';

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
    producer: 'solve-seedling-r8-d2-chain.mjs',
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
/**
 * ⛓ `--headline` — THE CHEAP FIRST ASK (⚖ R8 §18.6.3(b), one instrument over).
 *
 * The headline is a pure MODEL run: one `twoPassSolve` from L18's boot over all
 * three goal lists, no game, no browser. The segments are not — each boots its
 * predecessor's MEASURED latch, which only Windows Chrome can produce. So the
 * expensive half of this script's answer is available for the price of a node
 * process, and a plan whose headline cannot meet the ends-meet arithmetic is
 * caught before a GPU session is announced, let alone spent.
 *
 * ⛔ It emits NOTHING. It is a measurement, not an authoring pass.
 */
const HEADLINE_ONLY = process.argv.includes('--headline');

const { parseTape, requiredTapeVersion, assertTapeWithinRuntimeBudget } =
    await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { segmentBootFromLatch, seamLatchFindings } =
    await import(join(MODULE, 'r7Acceptance.js'));
const { gameVisibleTape, heldKeysAt } = await import(join(MODULE, 'tapeFormat.js'));
const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));

/**
 * ⛔⛔⛔ THE SUCCESSOR'S BOOT IS THE **GAME'S** LATCH, NOT THE MODEL'S.
 *
 * Slice 2's staged chains are one segment each, so nothing ever had to be
 * authored FROM a predecessor. This chain does, and two of the seam's rows
 * make that a game question rather than a model one: `save.time` advances by
 * `timeRate` per `Game.update()` INCLUDING dead frames, and the three RNG
 * streams advance on draws no model line makes. `SEAM_BOOT_SPEC` marks both
 * `modelled: false` — the model TRANSPORTS them and does not simulate them —
 * so a boot the model invented for them would be a number nobody measured.
 *
 * ⇒ segment 1 is driven through the WINDOWS channel and its `botSeam()` is
 * handed to `segmentBootFromLatch`, exactly as `plan-seedling-r7-act2.mjs`
 * does. That is what makes `boot(N+1) == latch(N)` a MEASURED equality over
 * all 46 signature rows rather than a claim.
 */
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const WIN_SCRATCH_WSL = '/mnt/c/playwright';
const WIN_SCRATCH_DOS = 'C:\\playwright';
const WIN_PY = '/mnt/c/Windows/py.exe';
const WIN_DRIVER = join(HERE, 'seedling-bot-replay-win.py');

function latchOf(label, tapeObj) {
    mkdirSync(WIN_SCRATCH_WSL, { recursive: true });
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
            '--deadline-sec', String(Math.ceil(tapeObj.tick_count * 1.5) + 120),
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
    return got.seam;
}

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * ⛓⛓⛓ A MEASURED LATCH, TURNED INTO THE SUCCESSOR'S BOOT BLOCKS — and the
 * CALM check is a precondition rather than a report.
 *
 * ⛔ A latch that is not a calm arrival, or that `segmentBootFromLatch`
 * refuses (partial, no `beginEntry`, an unrepresentable field), is a STOP:
 * the successor's boot could not reproduce it, and authoring one anyway
 * would put a state nobody measured into a committed tape. R8 lesson 4 from
 * the authoring side — the game is the only oracle, so a latch it will not
 * give is not a number to invent.
 */
function carryFromLatch(label, latch) {
    const calm = seamLatchFindings(latch, { requireCalm: true });
    const notCalm = calm.filter((r) => !r.ok);
    check(`${label} ends at a CALM ARRIVAL in the GAME`, notCalm.length === 0,
        notCalm.length === 0
            ? `${calm.length - 1} signature rows latched at tick `
                + `${latch.seam['latch.tick']}`
            : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));
    if (notCalm.length) {
        throw new Error('refusing to author a segment from a latch that is not a '
            + 'calm arrival — the boot could not reproduce it');
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

/**
 * ⛔ THE STAGED BOOT IS THE CAMPAIGN'S OWN LATCH, READ OFF DISK — the same
 * source `r8-solve-20` used, for the same reason: booting a state invented
 * beside the campaign would be a claim about a different game.
 *
 * ⚠ WHAT IS **NOT** DECLARED, deliberately: nothing about L18. No `{18,0}`
 * (the kill-lock the two spinners open), no out-of-band `{17,29}`. The honest
 * route arrives here having written both, and neither is a precondition for
 * anything these two segments do — declaring them would be staging the room
 * `trackA` reports as a wall.
 */
/**
 * ⛓ R9 SLICE 7 — RE-POINTED AT THE TWIN. This was `r7-act2-11.json`, the last
 * committed segment of the hand chain `act2-the-sword`, which ⚖ ruling 14
 * retired. `r8-solve-11` is the SOLVER tape for the same room from the same
 * boot, and the swap is a MEASUREMENT, not a hope: at slice 7's baseline the
 * two files' boot blocks were compared field by field and came out BYTE-EQUAL
 * over all eleven — `boot`, `noclip`, `noDamage`, `noHazards`, `grants`,
 * `persistence`, `equips`, `pins`, `save`, `rng`, `seam`. Only the fields in
 * that list are read below. The hand chain's post-sword latch and the solver
 * chain's are the same numbers; what changed is which file holds them.
 */
const LATCH = parseTape(JSON.parse(
    readFileSync(join(TAPES, 'r8-solve-11.json'), 'utf8')));

/** A room's own arrival, from the atlas — never a tile centre typed by hand. */
function arrivalInto(fromLevel, toLevel) {
    const src = levelSource(fromLevel);
    const e = (src.entities ?? []).find(
        (x) => x.attrs && Number(x.attrs.to) === toLevel
            && x.attrs.playerx !== undefined);
    if (!e) throw new Error(`no L${fromLevel} -> L${toLevel} teleporter in the atlas`);
    return { level: toLevel, x: Number(e.attrs.playerx), y: Number(e.attrs.playery) };
}

const placement = (level, type) => {
    const e = (levelSource(level).entities ?? []).find((x) => x.type === type);
    if (!e) throw new Error(`L${level} has no ${type}`);
    return { x: e.x, y: e.y };
};
const exitTo = (level, to) => {
    const e = (levelSource(level).entities ?? []).find(
        (x) => (x.type === 'stairsup' || x.type === 'stairsdown' || x.type === 'teleporter')
            && Number(x.attrs?.to) === to);
    if (!e) throw new Error(`L${level} has no exit to L${to}`);
    return { x: e.x, y: e.y };
};

/**
 * ⛓⛓⛓ SEGMENT 0 IS `r8-solve-18`, **PROMOTED AND NOT RE-AUTHORED** — R9
 * slice 3, ⚖ ruling 5's licence.
 *
 * R8 §18.4.1 priced this splice as "three committed artifacts and two more
 * Windows-driver latch runs". It is three, not four, because the honest L18
 * ALREADY EXISTS as a recorded, byte-exact artifact — `solve-seedling-r8-l18
 * .mjs`'s own — and duplicating it under an `r8-d2-18` name would author a
 * second tape with the same boot, the same goal list and the same walk.
 *
 * ⛔ SO THIS SCRIPT DOES NOT WRITE IT, AND MUST NOT. `r8-solve-18` stays the
 * L18 producer's artifact; what changes is its RELATION, and a relation lives
 * in `PLAYTHROUGH_CHAINS` (`CHAIN_KINDS` carries exactly this). Editing its
 * `description` so it SAID "segment 0" would spend a re-record licence on a
 * word.
 *
 * ⛓ What the chain gains by promoting it is a claim nobody could make before:
 * `chainFindings`' stream-slice row now asserts that the R8-era standalone L18
 * RECORDING is the new headline's first `tick_count` ticks, tick for tick.
 *
 * ⚠ Its boot is read off the committed tape rather than recomputed from
 * `arrivalInto(16, 18)`. The two agree — and if they ever stop, the tape is
 * what the game replays, so the tape is what the chain is sliced from.
 */
const L18_NAME = 'r8-solve-18';
const L18_RAW = JSON.parse(readFileSync(join(TAPES, `${L18_NAME}.json`), 'utf8'));
const L18 = parseTape(L18_RAW);

const SEGMENTS = [
    {
        name: L18_NAME,
        promoted: true,                   // ⛓ authored by solve-seedling-r8-l18.mjs
        boot: L18.boot,
        goals: [{ kind: 'reach-exit', exit: exitTo(18, 19) }],
        headline: 'THE HONEST L18 — D2\'s kill-lock room, PROMOTED into the chain',
    },
    {
        name: 'r8-d2-19',
        boot: null,                       // ⛓ L18's LATCH, measured — was DECLARED
        goals: [
            { kind: 'collect-placement', placement: placement(19, 'bosskey') },
            { kind: 'reach-exit', exit: exitTo(19, 20) },
        ],
        headline: 'THE SHIELDSPIRE — the fight, the key and the bosslock, in ONE segment',
    },
    {
        name: 'r8-d2-20',
        boot: null,                       // ⛓ the predecessor's LATCH, measured
        goals: [
            { kind: 'collect-placement', placement: placement(20, 'shield') },
            { kind: 'reach-exit', exit: exitTo(20, 13) },
        ],
        headline: 'THE SHIELD, AND THE WAY OUT — westward through the three gates to L13',
    },
];

/**
 * ⛓⛓⛓ THE HEADLINE — ALL THREE ROOMS IN **ONE RUN**, so the three segments
 * have something to be tick-for-tick identical to.
 *
 * A one-segment staged chain can make its headline its own segment (slice 2's
 * definition, and honest there: "the same walk driven in one run" and the
 * segment ARE the same tape). A multi-segment chain cannot — the ENDS-MEET
 * arithmetic (`sum(tick_count) === headline.tick_count`) and the stream-slice
 * check are exactly the rows that make a CUT a measurement rather than a
 * declaration, and both need a whole-walk recording to compare against.
 *
 * ⛔ AND IT IS A **TWO-PASS** SOLVE NOW, WHICH THE TWO-SEGMENT HEADLINE NEVER
 * HAD TO BE. L18's `lock@144,112` is `tset -1`: nothing but
 * `Game.totalEnemies()` reaching zero opens it, `createLevelRun` takes
 * `persistence` AT CONSTRUCTION, and the model deliberately does not WRITE the
 * flag (§11.5, one writer per persistence slot). So the headline's own walk
 * needs, as an INPUT, a tick only a solve can produce — which is precisely
 * what `twoPassSolve` is, and it is the SAME loop `r8-solve-18` was authored
 * by. ⇒ the headline becomes a **v9** tape carrying one timed `at` row, and
 * `stagedClearFindings` will demand a `clears` provenance for it on the chain.
 */
const HEADLINE = Object.freeze({
    name: 'r8-d2',
    boot: SEGMENTS[0].boot,
    goals: SEGMENTS.flatMap((s) => s.goals),
    headline: 'ALL THREE ROOMS IN ONE RUN — what the three segments are sliced from',
});

const results = [];
let carried = null;      // the previous segment's latch, as boot fields

/**
 * The staged state every run below is constructed with, per boot source.
 * `LATCH` (r7-act2-11's committed v8 block) for the head of the chain;
 * `carried` — the PREDECESSOR'S MEASURED LATCH — for every segment after it.
 */
const stagedState = (persistence) => ({
    persistence, equips: LATCH.equips, pins: LATCH.pins ?? [],
    save: LATCH.save ?? null, rng: LATCH.rng ?? null, seam: LATCH.seam ?? null,
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

/** The three per-segment claims every walk on this chain owes. */
function claimArrival(name, run) {
    const hits = run.playerHits.length;
    const deaths = run.playerDeaths.length;
    check(`${name}: ZERO hits and ZERO deaths`, hits === 0 && deaths === 0,
        `hits ${hits}, deaths ${deaths}`);
    const t = run.transitions[run.transitions.length - 1];
    check(`${name}: ends at a LEVEL ARRIVAL (§3.5)`, Boolean(t),
        JSON.stringify(run.transitions));
    check(`${name}: the arrival is CALM (v = 0 at the latch)`,
        run.state.vx === 0 && run.state.vy === 0, `v=(${run.state.vx},${run.state.vy})`);
    return t;
}

// ── the headline: ONE run over all three goal lists ───────────────────
/**
 * ⛔ THE EMITTED WALK IS REPLAYED INTO A FRESH RUN, and every claim is read off
 * THAT one — `solve-seedling-r8-l18.mjs`'s own rule. A solver that measured its
 * own walk and a tape that reproduces it are different artifacts, and the tape
 * is the one the game will be handed.
 */
const headSolved = await twoPassSolve({
    makeRun: (persistence) => runFrom(HEADLINE.boot, stagedState(persistence)),
    goals: HEADLINE.goals,
    name: HEADLINE.name,
    boot: HEADLINE.boot,
    persistence: LATCH.persistence,
    log: (m) => console.log(m),
});
{
    const state = stagedState(headSolved.persistence);
    const run = runFrom(HEADLINE.boot, state);
    for (const held of headSolved.out.perTick) run.advance(held);
    claimArrival(HEADLINE.name, run);
    results.push({
        seg: HEADLINE, run, out: headSolved.out, boot: HEADLINE.boot, state,
        before: { hasShield: false, keys: [] },
        to: run.transitions[run.transitions.length - 1]?.to_level ?? null,
    });
    /**
     * ⛓⛓⛓ THE SPLICE'S MODEL-SIDE CLAIM, AND IT IS THE WHOLE REASON SEGMENT 0
     * IS PROMOTED RATHER THAN RE-AUTHORED: the headline's first `L18.tick_count`
     * ticks must press the SAME KEYS the committed `r8-solve-18` presses. If
     * they do not, the recorded L18 tape is not what the chain is sliced from
     * and the stream-slice row would be measuring two different walks.
     *
     * ⚠ Compared as HELD SETS per tick rather than as spans: the fold is
     * `buildTape`'s and two identical walks always fold identically, but the
     * claim is about the WALK and the held set is what the walk IS.
     */
    let firstDiff = -1;
    for (let t = 0; t < L18.tick_count; t += 1) {
        const a = [...heldKeysAt(L18, t)].sort().join('+');
        const b = [...(headSolved.out.perTick[t] ?? [])].sort().join('+');
        if (a !== b) { firstDiff = t; break; }
    }
    check(`⛓⛓⛓ the headline's first ${L18.tick_count} ticks ARE ${L18_NAME}'s walk, `
        + 'key for key', firstDiff === -1,
    firstDiff === -1
        ? `${L18.tick_count} ticks compared, no difference`
        : `first difference at tick ${firstDiff}: ${L18_NAME} holds `
            + `[${[...heldKeysAt(L18, firstDiff)].sort().join(', ')}], the headline holds `
            + `[${[...(headSolved.out.perTick[firstDiff] ?? [])].sort().join(', ')}]`);
    /**
     * ⛓⛓ AND THE DECLARED CLEAR IS THE SAME TICK. `{18,0}` is model-sourced —
     * the spinner removal plus the `Lock`'s own 101-step fade — so a headline
     * that walked L18 identically must compute it identically, and the chain's
     * `clears` provenance row is authored against ONE number rather than two.
     */
    const headAt = headSolved.persistence.find((r) => r.level === 18 && r.tag === 0);
    const l18At = L18.persistence.find((r) => r.level === 18 && r.tag === 0);
    check(`⛓⛓ the headline declares {18,0} at the SAME tick ${L18_NAME} does`,
        Boolean(headAt) && Boolean(l18At) && headAt.at === l18At.at,
        `headline ${headAt?.at} vs ${L18_NAME} ${l18At?.at}`);
}

if (HEADLINE_ONLY) {
    console.log(`\n## r8-d2 headline (MODEL ONLY): ${headSolved.out.perTick.length} ticks, `
        + `${headSolved.out.trace.rows.length} decision(s), ${headSolved.out.replans} `
        + `re-plan(s), passes [${headSolved.passes.map((x) => x.kind).join(', ')}]`);
    console.log('## nothing emitted; the segments need the game (`latchOf`).');
    console.log(failures ? `\n${failures} FAILURE(S)` : '\nall model-side checks green');
    process.exit(failures ? 1 : 0);
}

// ── the segments, each booted from its predecessor's MEASURED latch ────
for (let i = 0; i < SEGMENTS.length; i += 1) {
    const seg = SEGMENTS[i];
    /**
     * ⛓ SEGMENT 0 IS NOT SOLVED HERE. It is `r8-solve-18`, already authored,
     * already recorded; this chain reads its committed tape for the cut and
     * DRIVES that exact artifact through the game for the successor's boot.
     * Solving it again would produce a second walk to compare the recording
     * against, which is the L18 producer's `--check`, not this one's job.
     */
    if (seg.promoted) {
        results.push({
            seg, run: null, out: { perTick: { length: L18.tick_count } },
            boot: seg.boot,
            state: {
                persistence: L18.persistence, equips: L18.equips, pins: L18.pins,
                save: L18.save, rng: L18.rng, seam: L18.seam,
            },
            before: null, to: 19,
        });
        if (!CHECK) {
            /**
             * ⛓⛓ THE LATCH IS MEASURED ON THE **COMMITTED** ARTIFACT, not on a
             * provisional this script rebuilt. That is what makes segment 1's
             * boot the state the game actually reaches when it replays the tape
             * the roster carries.
             */
            const latch = latchOf(seg.name, L18_RAW);
            carried = carryFromLatch(seg.name, latch);
        }
        continue;
    }
    /**
     * ⚠ UNDER `--check` THE SUCCESSOR READS ITS OWN COMMITTED BOOT rather than
     * re-driving the game for it: the producer check asks "is this artifact
     * what the solver derives", and re-measuring a latch that has not changed
     * would spend a browser run to learn the same numbers the tape carries.
     * A latch that HAS changed shows up as a byte diff, which is the check.
     */
    if (CHECK) {
        const committed = parseTape(JSON.parse(
            readFileSync(join(TAPES, `${seg.name}.json`), 'utf8')));
        carried = {
            boot: committed.boot,
            state: {
                persistence: committed.persistence, equips: committed.equips,
                pins: committed.pins, save: committed.save, rng: committed.rng,
                seam: committed.seam,
            },
        };
    }
    const boot = carried.boot;
    const state = carried.state;
    const run = runFrom(boot, state);
    const before = {
        hasShield: run.inventory.hasShield,
        keys: [...(run.keys ?? [])],
    };
    const out = solveSegment({ run, goals: seg.goals, name: seg.name, boot });
    const t = claimArrival(seg.name, run);
    results.push({ seg, run, out, boot, state, before, to: t?.to_level ?? null });
    /**
     * ⛓ THE NEXT SEGMENT'S BOOT IS THIS ONE'S LATCH, MEASURED IN THE GAME.
     * See `latchOf`: two of the seam's rows are `modelled: false`, so only the
     * running game can produce them.
     */
    if (i < SEGMENTS.length - 1 && !CHECK) {
        const provisional = {
            game: 'seedling', name: seg.name, boot,
            noclip: false, noDamage: false, noHazards: [], grants: [],
            persistence: state.persistence, equips: state.equips, pins: state.pins,
            save: state.save, rng: state.rng, seam: state.seam,
            tick_count: out.perTick.length,
            inputs: buildTape(out.perTick, boot, seg.name,
                { noclip: false, noDamage: false, noHazards: [], grants: [] }).inputs,
            tape_version: 8,
        };
        carried = carryFromLatch(seg.name, latchOf(seg.name, provisional));
    }
}

// ── the headline numbers ──────────────────────────────────────────────
const head = results[0];
const l18 = results[1];          // ⛓ PROMOTED — read off disk, not solved here
const l19 = results[2];
const l20 = results[3];
/**
 * ⛓ SEGMENT 0's LENGTH IS THE COMMITTED TAPE'S, and it is asserted rather than
 * assumed: `chainSpans` slices the headline at `cuts[0]`, so a chain whose
 * first cut is not `r8-solve-18`'s own `tick_count` would compare the wrong
 * window and say so in a message about the SECOND segment.
 */
check(`⛓ segment 0 is ${L18_NAME}'s committed length, not a number typed here`,
    l18.out.perTick.length === L18.tick_count,
    `${l18.out.perTick.length} against the tape's ${L18.tick_count}`);
check('⛓ the ShieldBoss dies to THREE derived presses, each inside its window',
    l19.run.shieldBossHits.filter((h) => h.landed).length === 3,
    JSON.stringify(l19.run.shieldBossHits.filter((h) => h.landed)
        .map((h) => ({ t: h.t, hits: h.hits }))));
check('⛓ the boss key is HELD after segment 19', l19.run.keys.has(0),
    JSON.stringify([...l19.run.keys]));
check('⛓ `hasShield` flips NOT-HELD -> HELD inside segment 20',
    l20.before.hasShield === false && l20.run.inventory.hasShield === true,
    `${l20.before.hasShield} -> ${l20.run.inventory.hasShield}`);
check('⛓ the chain ENDS in L13, through the westward gates', l20.to === 13,
    `to L${l20.to}`);
const clears = l20.run.earnedClears ?? [];
for (const [lvl, tag, by] of [[20, 2, 'shield'], [20, 0, 'shieldlocknorm'],
    [20, 4, 'buttonroom']]) {
    check(`⛓ {${lvl},${tag}} is EARNED during the run (${by})`,
        clears.some((c) => c.level === lvl && c.tag === tag), JSON.stringify(clears));
}
/**
 * ⛔ AND `{20,1}` — THE LOCK'S OWN CLEAR — IS **NOT** EARNED, WHICH IS THE
 * MECHANISM AND NOT A GAP.
 *
 * `Lock.turnOff()`'s third line is `Game.setPersistence(tag, false)`, and
 * `levelRun` BANKS that write in `pendingEarnedClears` — the set the NEXT
 * BUILD of that level is handed — rather than applying it to this visit
 * (§15.3.2's law from the other side: a clear is a PERMISSION about the run).
 * The walk leaves L20 the moment the alcove opens, so the write never becomes
 * an `earnedClears` row in THIS segment. Asserted as an ABSENCE with its
 * reason, because "the lock cleared and nobody recorded it" and "the lock's
 * clear is banked for the next build" print the same thing otherwise.
 */
check('⛓ {20,1} is BANKED, not earned — `Lock.turnOff()`\'s write is the NEXT build\'s',
    !clears.some((c) => c.level === 20 && c.tag === 1)
        && l20.run.openActivators.size === 0,
    `earnedClears ${JSON.stringify(clears)}; the run left L20 at the alcove`);

// ── emit ──────────────────────────────────────────────────────────────
function tapeJson(r, description) {
    const folded = buildTape(r.out.perTick, r.boot, r.seg.name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const obj = {
        game: 'seedling',
        name: r.seg.name,
        boot: r.boot,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: r.state.persistence,
        equips: r.state.equips,
        pins: r.state.pins,
        save: r.state.save,
        rng: r.state.rng,
        seam: r.state.seam,
        tick_count: r.out.perTick.length,
        inputs: folded.inputs,
    };
    /**
     * ⛓ THE DECLARED VERSION IS DERIVED, NOT TYPED. The headline now carries a
     * timed `at` row (L18's kill lock), which is a v9 channel — `parseTape`
     * refuses it under a v8 header, and hardcoding 8 here would refuse this
     * script's own output. `requiredTapeVersion` decides the EMITTED number;
     * this decides the one the parser is handed.
     */
    const declaredVersion = obj.persistence.some((r) => r.at !== undefined) ? 9 : 8;
    // ⛓ R9 slice 8: the tick-0 latch is CARRIED, never authored — read off
    // the committed tape, which is the artifact (⚖ ruling 17). Spread AFTER
    // `declaredVersion`, which the field invalidates: a tick-0 block below
    // v11 is refused BY DEFINITION, so a producer that carried the block and
    // not the version would refuse its own committed tape.
    const tick0 = committedTick0(TAPES, r.seg.name);
    const parsed = parseTape({
        ...obj, tape_version: declaredVersion, ...tick0ParseFields(tick0, obj),
    });
    /**
     * ⛔ THE BUDGET, ASSERTED BEFORE THE GAME IS ASKED — trap 16 / §15.4. The
     * runtime refuses a dense tape at LOAD with a heap failure, which reads as
     * a broken harness rather than as a plan that is too dense. A tape's
     * budget is SPANS, not ticks.
     */
    const budget = assertTapeWithinRuntimeBudget({ ...obj, tape_version: declaredVersion },
        r.seg.name);
    console.log(`## ${r.seg.name} budget: ${budget.spans} span(s), `
        + `${Math.round(budget.bytes / 1024)} KB, ${r.out.perTick.length} ticks`);
    return `${JSON.stringify({
        tape_version: requiredTapeVersion(parsed),
        game: 'seedling',
        name: r.seg.name,
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

const DESCRIPTIONS = {
    'r8-d2': '⛓⛓⛓ R9 SLICE 3 — THE HEADLINE of the staged chain `r8-d2`, RE-DERIVED '
        + 'OVER THREE SEGMENTS: all of D2\'s last three rooms driven by the live solver '
        + 'in ONE RUN, so the three segments have something to be tick-for-tick '
        + 'IDENTICAL to. ⚖ R8\'s close ruled the splice R9\'s FIRST ACT under ONE '
        + 'attributed licence (option A, user 2026-08-11), and this is it: the honest '
        + 'L18 is PREPENDED, so the chain no longer DECLARES L19\'s arrival from L18 — '
        + 'it walks there. From r7-act2-11\'s committed v8 block (the campaign\'s own '
        + 'post-sword latch) staged at L18\'s own arrival from L16, through the '
        + 'kill-lock room\'s two spinners, then the ShieldBoss fight, the boss key, the '
        + 'bosslock, L20\'s shield and the three westward gates to L13. ⛔ A v9 tape '
        + 'now, and that is L18\'s doing: `lock@144,112` is `tset -1`, `createLevelRun` '
        + 'takes `persistence` AT CONSTRUCTION, and the model does not WRITE the flag '
        + '(§11.5) — so the headline is authored by the SAME `twoPassSolve` loop '
        + '`r8-solve-18` was, and carries one timed `at` row whose provenance the chain '
        + 'declares. ⛔ Its cuts are decided by PERSISTENCE (trap 150 — a fight does not '
        + 'survive the door, so L19\'s fight and the crossing it opens are one segment) '
        + 'and its two internal seams are MEASURED equalities over all 46 signature '
        + 'rows. Authored by scripts/procgen/solve-seedling-r8-d2-chain.mjs.',
    'r8-d2-19': '⛓⛓⛓ R8 SLICE 7 — SEGMENT 1 of the staged chain `r8-d2`, and the '
        + 'ladder\'s FIRST BOSS FIGHT DRIVEN BY THE SOLVER. The live policy identifies '
        + '`shieldboss@80,32` as the obstacle the placement is INSIDE (`bosskey@96,64` '
        + 'sits at tile (6,4), within his 48x48 body — the wall, the key and the exit '
        + 'are one object), and fights him on a PRESS SCHEDULE DERIVED from '
        + '`shieldBossFight.shieldBossWindowFor`: `hitPlayer` counts 120 CONSECUTIVE '
        + 'band ticks and opens `movedShield`, the one animation `ShieldBoss.hit` '
        + 'forwards through, and the press tick is the EARLIEST T whose five dispatches '
        + '(`SLASH_HIT_TICKS`, because `slashDelayMax` is ZERO) all land inside it. ⛔ '
        + 'Traps 85/93: one press is FIVE hit tests and the RECEIVER decides how many '
        + 'land — the first press of the room spends its first dispatch on the ARMING '
        + 'SWALLOW and lands on its second, and `hitsTimer = 30` then refuses the four '
        + 'behind it. ZERO hits over the whole fight, which is a claim about the STAB: '
        + 'every landing calls `sit()`, aborting the chain before frames 5..8. Then the '
        + 'key\'s ceremony, and `bosslock@48,32` opened by the `keylock` verb — ⚖ '
        + '§15.7a ruling 1\'s `key -> keylock` opener, whose 80-tick window is '
        + '`activators.opensOnKeyTick(60, 0.05)` and not a Lock\'s 101. ⛔ ONE SEGMENT: '
        + 'a fight does not survive the door (trap 150), so the fight and the crossing '
        + 'it opens cannot be cut apart. ⛓⛓⛓ R9 SLICE 3 CHANGED ITS BOOT AND NOTHING '
        + 'ELSE ABOUT IT: R8 staged this segment at L19\'s own arrival from L18 by '
        + 'DECLARATION, because `R8_D2_COMPLETE.trackA` reported L18 as a wall rather '
        + 'than recording it. R8 slice 8 then solved that room honestly, so every field '
        + 'of this boot is now `r8-solve-18`\'s MEASURED LATCH — the save arrays, the '
        + 'persistence set carrying `{18,0}`, the three RNG streams, `save.time` — read '
        + 'out of the running game by `botSeam()` and turned into blocks by '
        + '`segmentBootFromLatch`. Two of those rows are `modelled: false` by '
        + '`SEAM_BOOT_SPEC` on purpose, which is exactly why a Windows-driver run and '
        + 'not a model line produces them. Authored by '
        + 'scripts/procgen/solve-seedling-r8-d2-chain.mjs.',
    'r8-d2-20': '⛓⛓⛓ R8 SLICE 7 — SEGMENT 2 of the staged chain `r8-d2`, and `touch`\'s '
        + 'room at last. EVERY FIELD OF ITS BOOT IS r8-d2-19\'s LATCH, read out of the '
        + 'run by `segmentBootFromLatch` — the save arrays with key 0 in them, the '
        + 'persistence set carrying `{19,0}`, the three RNG streams, the day/night phase '
        + 'and the music pair. That is what makes this the machinery\'s first MEASURED '
        + 'seam between two staged segments. The solver takes `shield@112,48` (no gate '
        + 'at all stands between the L19 arrival and it — §15.2\'s correction), then '
        + 'crosses WESTWARD through the three gates that are BEHIND it: '
        + '`shieldlocknorm@176,16`, a latching TOUCH gated on `Player.hasShield` that '
        + 'refuses input for its whole 101-tick fade (`turnOff` restores it ONLY `if '
        + '(p)`, so the verb releases the lean on the snap — a player carried out of the '
        + 'check rect never gets input back); then `buttonroom@192,16`, whose `room = '
        + '-1` LOCAL PUBLISH latches tSet 0 open; then `lock@32,80`, which ⚖ §15.7a '
        + 'ruling 1 resolves through the MECHANISM GRAPH to that buttonroom rather than '
        + 'by its own id, with the buttonroom\'s stance a legal target under ⚖ ruling '
        + '2\'s hypothesis quantifier (it is reachable only once the shieldlock is '
        + 'discharged); then the four-cell alcove and `stairsup@16,48` to L13. Four '
        + 'clears EARNED during the run: {20,2} the shield, {20,0} the shieldlock, '
        + '{20,4} the buttonroom and {20,1} the lock. ⚠ `save.rockSet` is NOT witnessed '
        + '— `Shield.removed()` sets `Moonrock.beam` and the MOONROCK writes `rockSet` '
        + '(trap 124), and the moonrock is in L0. Authored by '
        + 'scripts/procgen/solve-seedling-r8-d2-chain.mjs.',
};

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
for (const r of results) {
    /**
     * ⛔ SEGMENT 0 IS NOT THIS SCRIPT'S ARTIFACT. `r8-solve-18` is authored and
     * checked by `solve-seedling-r8-l18.mjs`; this chain PROMOTED it, and a
     * promotion that rewrote the file would be a re-record spent on a
     * relation. The `--check` above names exactly the artifacts it re-authors,
     * which is the whole point of naming them.
     */
    if (r.seg.promoted) {
        console.log(`## ${r.seg.name}: PROMOTED, not re-authored — `
            + `${r.out.perTick.length} ticks read from the committed tape `
            + '(solve-seedling-r8-l18.mjs owns it)');
        continue;
    }
    emit(join(TAPES, `${r.seg.name}.json`), tapeJson(r, DESCRIPTIONS[r.seg.name]),
        r.seg.name);
    emit(join(TRACES, `${r.seg.name}.trace.json`),
        `${JSON.stringify(r.out.trace, null, 4)}\n`, `${r.seg.name} trace`);
}

/**
 * ⛓ THE ENDS-MEET ARITHMETIC, ASSERTED HERE TOO — the chain's own acceptance
 * row will assert it against the RECORDINGS; this is the model-side half, so a
 * plan that could not possibly meet it is caught before a browser runs.
 */
const segTicks = SEGMENTS.map((x, i) => results[i + 1].out.perTick.length);
const segSum = segTicks.reduce((a, b) => a + b, 0);
check('⛓ sum(segment ticks) === the headline\'s own tick count',
    segSum === head.out.perTick.length,
    `${segTicks.join(' + ')} = ${segSum} against ${head.out.perTick.length}`);

/**
 * ⛓⛓ THE CUT LIST THE CHAIN CONSTANT MUST CARRY, PRINTED RATHER THAN TYPED.
 * `chainSpans` derives the spans from `cuts` and `endsAt`, so a constant that
 * disagrees with the tapes is exactly the ends-meet failure this arithmetic
 * exists to catch — and the cheapest way not to mistype it is not to type it.
 */
const cuts = segTicks.slice(0, -1).map((_, i) => segTicks
    .slice(0, i + 1).reduce((a, b) => a + b, 0));
console.log(`\n## PLAYTHROUGH_CHAINS.r8-d2: cuts [${cuts.join(', ')}], `
    + `endsAt ${segSum}`);
console.log(`## r8-d2: headline ${head.out.perTick.length}t = `
    + `${SEGMENTS.map((x, i) => `${x.name} ${segTicks[i]}t`).join(' + ')}`
    + `, ${SEGMENTS.length - 1} internal seam(s)`);
console.log('## there is NO hand answer for L18, L19 or L20 westward — the '
    + 'differential is the gate.');

if (CHECK) console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
