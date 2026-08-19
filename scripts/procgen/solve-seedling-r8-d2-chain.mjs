#!/usr/bin/env node
/**
 * solve-seedling-r8-d2-chain — D2's LAST TWO ROOMS AS **ONE STAGED
 * MULTI-SEGMENT CHAIN**, driven by the live solver. R8 slice 7 track D.
 *
 * ── WHAT THIS IS, AND WHY IT IS TWO SEGMENTS AND NOT THREE ────────────
 *
 * Every staged chain before this one has exactly ONE segment: a room, a boot,
 * a walk. This is the machinery's first chain whose segments have to LATCH to
 * each other — `boot(N+1) == latch(N)` over all 46 signature rows — while
 * still being staged at the head.
 *
 *   `r8-d2-19`  THE SHIELDSPIRE. Boot: the campaign's own post-sword latch at
 *               L19's own arrival from L18. The solver identifies
 *               `shieldboss@80,32` as the obstacle standing in the placement
 *               (`bosskey@96,64` is INSIDE his 48x48 body), fights him on a
 *               schedule derived from `shieldBossWindowFor`, collects the key,
 *               resolves `bosslock@48,32` through ⚖ §15.7a's mechanism graph
 *               to the `keylock` verb, and crosses to L20.
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
 * ⛔ L18 IS **NOT** IN THIS CHAIN, and the reason is a measurement rather than
 * a budget: `R8_D2_COMPLETE.trackA` records the strike schedule built, driven,
 * and stopped by L18's south-west corner. A room that refuses is REPORTED,
 * never recorded (§11.10.1). The chain therefore begins at L19's own arrival
 * from L18 and claims nothing about the room before it.
 *
 * ⛔ AND THE CHARGED ROUTE WAS NOT WALKABLE. "L13's alcove -> L18 -> ..." has
 * no edge: `assertD2RouteGraph` re-derives the D2 graph from the atlas and
 * L13's only path to L18 runs through L14, L15 and L16. ⚖ Ruled: three
 * contiguous segments ending in L13 — of which two are here.
 *
 * Run (model-side):
 *   node scripts/procgen/solve-seedling-r8-d2-chain.mjs
 *   node scripts/procgen/solve-seedling-r8-d2-chain.mjs --check
 *
 * Then record (the game is the only oracle):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-d2-19,r8-d2-20
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');
const TRACES = join(MODULE, 'fixtures', 'traces');

const CHECK = process.argv.includes('--check');

const { parseTape, requiredTapeVersion, assertTapeWithinRuntimeBudget } =
    await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { segmentBootFromLatch, seamLatchFindings } =
    await import(join(MODULE, 'r7Acceptance.js'));
const { gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));

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
    console.log(`    drove ${label}: ${got.stream.ticks.length} observations, `
        + `${got.status.dead_frames} dead, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (!got.seam) throw new Error(`${label}: the driver returned no seam block`);
    return got.seam;
}

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

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
const LATCH = parseTape(JSON.parse(
    readFileSync(join(TAPES, 'r7-act2-11.json'), 'utf8')));

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

const SEGMENTS = [
    {
        name: 'r8-d2-19',
        boot: arrivalInto(18, 19),
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
 * ⛓⛓⛓ THE HEADLINE — BOTH ROOMS IN **ONE RUN**, so the two segments have
 * something to be tick-for-tick identical to.
 *
 * A one-segment staged chain can make its headline its own segment (slice 2's
 * definition, and honest there: "the same walk driven in one run" and the
 * segment ARE the same tape). A two-segment chain cannot — the ENDS-MEET
 * arithmetic (`sum(tick_count) === headline.tick_count`) and the stream-slice
 * check are exactly the rows that make a CUT a measurement rather than a
 * declaration, and both need a whole-walk recording to compare against.
 */
const HEADLINE = Object.freeze({
    name: 'r8-d2',
    boot: SEGMENTS[0].boot,
    goals: [...SEGMENTS[0].goals, ...SEGMENTS[1].goals],
    headline: 'BOTH ROOMS IN ONE RUN — what the two segments are sliced from',
});

const results = [];
let carried = null;      // the previous segment's latch, as boot fields

for (const seg of [HEADLINE, ...SEGMENTS]) {
    /**
     * ⚠ UNDER `--check` THE SUCCESSOR READS ITS OWN COMMITTED BOOT rather than
     * re-driving the game for it: the producer check asks "is this artifact
     * what the solver derives", and re-measuring a latch that has not changed
     * would spend a browser run to learn the same numbers the tape carries.
     * A latch that HAS changed shows up as a byte diff, which is the check.
     */
    if (CHECK && !seg.boot) {
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
    const boot = seg.boot ?? carried.boot;
    const state = seg.boot
        ? {
            persistence: LATCH.persistence, equips: LATCH.equips, pins: LATCH.pins ?? [],
            save: LATCH.save ?? null, rng: LATCH.rng ?? null, seam: LATCH.seam ?? null,
        }
        : carried.state;
    const run = createLevelRun({
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
    const before = {
        hasShield: run.inventory.hasShield,
        keys: [...(run.keys ?? [])],
    };
    const out = solveSegment({ run, goals: seg.goals, name: seg.name, boot });
    const hits = run.playerHits.length;
    const deaths = run.playerDeaths.length;
    check(`${seg.name}: ZERO hits and ZERO deaths`, hits === 0 && deaths === 0,
        `hits ${hits}, deaths ${deaths}`);
    const t = run.transitions[run.transitions.length - 1];
    check(`${seg.name}: ends at a LEVEL ARRIVAL (§3.5)`, Boolean(t),
        JSON.stringify(run.transitions));
    check(`${seg.name}: the arrival is CALM (v = 0 at the latch)`,
        run.state.vx === 0 && run.state.vy === 0, `v=(${run.state.vx},${run.state.vy})`);
    results.push({ seg, run, out, boot, state, before, to: t?.to_level ?? null });
    /**
     * ⛓ THE NEXT SEGMENT'S BOOT IS THIS ONE'S LATCH, MEASURED IN THE GAME.
     * See `latchOf`: two of the seam's rows are `modelled: false`, so only the
     * running game can produce them.
     */
    if (seg === SEGMENTS[0] && !CHECK) {
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
        const latch = latchOf(seg.name, provisional);
        const calm = seamLatchFindings(latch, { requireCalm: true });
        const notCalm = calm.filter((r) => !r.ok);
        check(`${seg.name} ends at a CALM ARRIVAL in the GAME`, notCalm.length === 0,
            notCalm.length === 0
                ? `${calm.length - 1} signature rows latched at tick `
                    + `${latch.seam['latch.tick']}`
                : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));
        if (notCalm.length) {
            throw new Error('refusing to author a segment from a latch that is not a '
                + 'calm arrival — the boot could not reproduce it');
        }
        const blocks = segmentBootFromLatch(latch);
        carried = {
            boot: blocks.boot,
            state: {
                persistence: blocks.persistence ?? [],
                equips: blocks.equips ?? [],
                pins: blocks.pins ?? state.pins,
                save: blocks.save ?? null,
                rng: blocks.rng ?? null,
                seam: blocks.seam ?? null,
            },
        };
    }
}

// ── the headline numbers ──────────────────────────────────────────────
const head = results[0];
const l19 = results[1];
const l20 = results[2];
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
    const parsed = parseTape({ ...obj, tape_version: 8 });
    /**
     * ⛔ THE BUDGET, ASSERTED BEFORE THE GAME IS ASKED — trap 16 / §15.4. The
     * runtime refuses a dense tape at LOAD with a heap failure, which reads as
     * a broken harness rather than as a plan that is too dense. A tape's
     * budget is SPANS, not ticks.
     */
    const budget = assertTapeWithinRuntimeBudget({ ...obj, tape_version: 8 }, r.seg.name);
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
        equips: parsed.equips,
        pins: parsed.pins,
        save: parsed.save,
        rng: parsed.rng,
        seam: parsed.seam,
        tick_count: parsed.tick_count,
        inputs: parsed.inputs,
    }, null, 4)}\n`;
}

const DESCRIPTIONS = {
    'r8-d2': '⛓⛓⛓ R8 SLICE 7 — THE HEADLINE of the staged chain `r8-d2`: BOTH of D2\'s '
        + 'last two rooms driven by the live solver in ONE RUN, so the two segments have '
        + 'something to be tick-for-tick IDENTICAL to. From r7-act2-11\'s committed v8 '
        + 'block — the campaign\'s own post-sword latch — staged at L19\'s own arrival '
        + 'from L18, through the ShieldBoss fight, the boss key, the bosslock, L20\'s '
        + 'shield and the three westward gates to L13. ⛔ This is the machinery\'s first '
        + 'MULTI-SEGMENT staged chain: its cut is decided by PERSISTENCE (trap 150 — a '
        + 'fight does not survive the door, so L19\'s fight and the crossing it opens '
        + 'are one segment) and its internal seam is a MEASURED equality over all 46 '
        + 'signature rows. Authored by scripts/procgen/solve-seedling-r8-d2-chain.mjs.',
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
        + 'it opens cannot be cut apart. Boot: r7-act2-11\'s committed v8 block — the '
        + 'campaign\'s own post-sword latch — staged at L19\'s own arrival from L18; '
        + 'nothing about L18 is declared, because `R8_D2_COMPLETE.trackA` reports that '
        + 'room as a wall rather than recording it. Authored by '
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
check('⛓ sum(segment ticks) === the headline\'s own tick count',
    l19.out.perTick.length + l20.out.perTick.length === head.out.perTick.length,
    `${l19.out.perTick.length} + ${l20.out.perTick.length} = `
    + `${l19.out.perTick.length + l20.out.perTick.length} against `
    + `${head.out.perTick.length}`);

console.log(`\n## r8-d2: headline ${head.out.perTick.length}t = `
    + `${SEGMENTS.map((x, i) => `${x.name} ${results[i + 1].out.perTick.length}t`).join(' + ')}`
    + `, ${SEGMENTS.length - 1} internal seam(s)`);
console.log('## there is NO hand answer for L19 or L20 westward — the differential is the gate.');

if (CHECK) console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
