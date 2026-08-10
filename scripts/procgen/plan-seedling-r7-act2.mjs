#!/usr/bin/env node
/**
 * plan-seedling-r7-act2 — AUTHOR the first honest segments, from the LEGS
 * and from the GAME's own latch. R7 slice 6c.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §3.1/§3.2 (the
 * segment and the seam), §15.7 (the ruled segment scope: the minimal valid
 * dependency chain, not the strict AP total order), §16.9 (what slice 6c
 * inherits). Chain data: `frontend/modules/seedlingDemo/playthroughWalk.js`,
 * chain `act2-to-l5`.
 *
 * ── ⛓ WHAT THIS ADDS TO `plan-seedling-r7-ends-meet.mjs` ──────────────
 *
 * That script authors the TOY chain, whose walk is two literal input spans
 * inherited from a frozen R1 fixture. This one authors a chain whose walk is
 * a ROUTE: forty-one spans positioned by A* against live per-visit geometry,
 * including a 200-tick button hold and a 39-tick LEAN on a pushable block.
 * Typing those would be transcribing a measurement, so the chain declares
 * LEGS and this synthesizes them — §3.6's M1 generator, one rung on from the
 * seam.
 *
 * ⛔ AND THE CUTS ARE CHECKED, NOT TAKEN. `playthroughWalk` DECLARES the
 * three transition ticks and the end tick; this refuses to author anything
 * unless the driver's own `transitions` and `tick_count` are exactly those.
 * A route that shifts by one tick under a physics edit is then a named
 * failure rather than a chain that silently re-cuts itself around the change
 * — which is the difference between a committed claim and a snapshot.
 *
 * ── THE CUSTODY CHAIN ─────────────────────────────────────────────────
 *
 * Segment 1 boots the game's own initial state and inherits NOTHING.
 * Every later segment's boot block is its predecessor's LATCH, read out of
 * the running game by `botSeam()` and handed to `segmentBootFromLatch`
 * (which refuses by name anything the tape format cannot express). Nothing
 * about any segment's state is typed anywhere.
 *
 * `--check` IS THE ORACLE: re-running must produce byte-identical tapes, or
 * the committed chain is not reproducible. That can only work because the
 * chain DECLARES its FlashPunk seed — `Engine.as:50` seeds the LCG once per
 * page from one `Math.random()`.
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/plan-seedling-r7-act2.mjs            # write
 *   node scripts/procgen/plan-seedling-r7-act2.mjs --check    # verify
 */

import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
    existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = 'seedling_bot_ap';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const TAPES = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');
const CHAIN_ID = (process.argv.find((a) => a.startsWith('--chain=')) ?? '--chain=act2-to-l5')
    .slice('--chain='.length);

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { parseTape, TAPE_VERSION } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { segmentBootFromLatch, seamLatchFindings } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/r7Acceptance.js'));
const {
    PLAYTHROUGH_CHAINS, TRUE_INITIAL_BOOT, chainInputsFor, chainSpans,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/playthroughWalk.js'));
const { synthesizeLegs } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV2.js'));
const { atlasLevelSource } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/levelSource.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const chain = PLAYTHROUGH_CHAINS.find((c) => c.id === CHAIN_ID);
if (!chain) throw new Error(`no chain "${CHAIN_ID}"`);
if (!chain.walk.legs) {
    throw new Error(`chain "${CHAIN_ID}" carries literal inputs, not legs — `
        + 'author it with plan-seedling-r7-ends-meet.mjs');
}

/**
 * ⚠ THE SERIALIZED FORM IS WRITTEN FROM A PARSED TAPE, always. `parseTape`
 * normalises (sorts spans, sorts persistence clears, fills empty blocks), so
 * writing the raw object and reading it back would produce a file that
 * differs from what every consumer sees.
 */
function tapeJson(obj, description) {
    const parsed = parseTape(obj);
    return `${JSON.stringify({
        tape_version: TAPE_VERSION,
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

function emit(name, json) {
    const path = join(TAPES, `${name}.json`);
    if (CHECK) {
        const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
        check(`${name} is byte-identical to what this planner derives`, have === json,
            have === null ? 'the tape does not exist'
                : have === json ? `${json.length} bytes`
                    : '⛔ DRIFT — the committed tape is not what the legs plus the '
                        + "game's own latch produce today");
        return;
    }
    writeFileSync(path, json);
    console.log(`WROTE ${path} (${json.length} bytes)`);
}

// ── the walk, synthesized, and its cuts CHECKED against the declaration ──
const levelSource = atlasLevelSource();
const plan = synthesizeLegs(chain.walk.legs, {
    levelSource,
    boot: { ...TRUE_INITIAL_BOOT },
    name: chain.headline,
    relax: {
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        equips: [],
        pins: [...chain.walk.pins],
        // ⚠ The FULL role set. A walk with collision ON consults every role,
        // and this one drives a mechanic in `combat`'s (the bob it must not
        // touch) as well as in `blocking`'s (the block it must move).
        roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'],
    },
});
const gotCuts = plan.transitions.map((t) => t.t);
console.log(`\n## chain ${chain.id}\n`);
console.log(`   ${plan.tape.tick_count} ticks, ${plan.tape.inputs.length} spans, `
    + `transitions [${gotCuts.join(' ')}]`);
for (const s of plan.shoves) {
    console.log(`   shove ${s.id} ${s.dir}: contact t+${s.contactTick}, lean ${s.leanTicks}, `
        + `(${s.from.tx},${s.from.ty}) -> (${s.to.tx},${s.to.ty})`);
}
for (const h of plan.holds) {
    console.log(`   hold ${h.presser.tag}@${h.presser.x},${h.presser.y} t=${h.presser.t}: `
        + `${h.ticks} ticks, traps [${h.traps.join(' ')}], ${h.volleys} volleys`);
}
check("⛔ the route's own transitions are the chain's DECLARED cuts",
    JSON.stringify(gotCuts) === JSON.stringify([...chain.cuts, chain.endsAt]),
    `driver [${gotCuts.join(' ')}] vs declared [${[...chain.cuts, chain.endsAt].join(' ')}] `
    + '— a chain whose cuts are taken from whatever the planner produced cannot notice '
    + 'a route that moved');
check('⛔ the route ends exactly where the chain says it ends',
    plan.tape.tick_count === chain.endsAt,
    `tick_count ${plan.tape.tick_count}, endsAt ${chain.endsAt}`);
if (failures > 0) {
    console.log('\nrefusing to author from a route that is not the declared one');
    process.exit(1);
}
const WALK_INPUTS = plan.tape.inputs;

/**
 * ⛔⛔ THE LATCH COMES OFF REAL-GPU WINDOWS CHROME, AND THAT IS A PRICE
 * RATHER THAN A PREFERENCE.
 *
 * `plan-seedling-r7-ends-meet.mjs` drives its two segments through WSL's own
 * Chromium, because the toy chain is 109 ticks and SwiftShader can afford
 * them. This chain is 822, and the first cut of this script measured what
 * that costs: **segment 1 alone (183 ticks) had not finished driving after
 * eleven minutes**, which projects past twenty for the three drives the
 * authoring needs. The same tape on the Windows channel replays at ~28 fps.
 *
 * So the authoring uses the SAME dumb driver the differential's `--win`
 * channel and every R7 probe use — `seedling-bot-replay-win.py`, which
 * already drains `botSeam()` and hands the whole envelope back. The driver
 * stays dumb; every decision stays here.
 *
 * ⚠ The latch is a GAME READING either way, so the channel cannot change
 * what is authored — only how long it takes to read it. If it ever did, the
 * `--check` re-run on the other channel would say so by name.
 */
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
        JSON.stringify(parseTape(tapeObj)));
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
    return { seam: got.seam, ticks: got.stream.ticks, status: got.status };
}

{
    const spans = chainSpans(chain);
    const base = {
        game: 'seedling',
        tape_version: TAPE_VERSION,
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        persistence: [],
        equips: [],
        pins: [...chain.walk.pins],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 0, split: false, cosmetic: 0, fp: chain.walk.fpSeed },
        seam: null,
    };

    // ── the headline: the whole walk, one run ──────────────────────────
    emit(chain.headline, tapeJson({
        ...base,
        name: chain.headline,
        boot: { ...TRUE_INITIAL_BOOT },
        tick_count: chain.endsAt,
        inputs: chainInputsFor(WALK_INPUTS, 0, chain.endsAt),
    }, `⛓ THE HEADLINE of chain "${chain.id}" — the game's own opening in ONE run, so `
        + `the ${chain.segments.length} segments have something to be tick-for-tick `
        + 'IDENTICAL to. From `new Game(0, 80, 128)` with an empty save, no grants, no '
        + 'persistence clears and collision ON, through L2, L3 and L4 to the L5 '
        + 'arrival. L4 is the room slice 6b could not plan: its column 2 is walled at '
        + 'every row but the cell `pushableblock@32,64` stands in, so the walk holds '
        + '`button@16,64` until the two arrowtraps kill `bob@64,64` (measured: hits '
        + '0->1->2->3, gone by t~158 of that segment) and then LEANS the block from '
        + '(2,4) to (4,4). `pins: ["dead_frames"]` makes `save.time` '
        + 'update-determined; `rng.fp` is declared because FlashPunk seeds its LCG once '
        + 'per PAGE. Authored by scripts/procgen/plan-seedling-r7-act2.mjs.'));

    // ── segment 1: the true initial state, no inheritance ──────────────
    const seg1Name = chain.segments[0];
    const seg1Obj = {
        ...base,
        name: seg1Name,
        boot: { ...TRUE_INITIAL_BOOT },
        tick_count: spans[0].to,
        inputs: chainInputsFor(WALK_INPUTS, spans[0].from, spans[0].to),
    };
    emit(seg1Name, tapeJson(seg1Obj,
        `⛓ SEGMENT 1 of chain "${chain.id}" — the CUSTODY BASE CASE, and the first `
        + 'segment of the honest playthrough. Boots the game\'s own initial state '
        + '(`Main.as:50-51`: `new Game(0, 80, 128)`, empty save) and inherits NOTHING: '
        + 'no grants, no persistence clears, no save presentation, no seam block. Runs '
        + `L0's opening to stairsdown@256,272 and ends at t=${spans[0].to}, the L2 `
        + 'ARRIVAL. Its latch is what authors segment 2.'));

    // ── every later segment: authored FROM the predecessor's latch ─────
    let prev = seg1Obj;
    for (let i = 1; i < chain.segments.length; i += 1) {
        const driven = latchOf(chain.segments[i - 1], prev);
        const calm = seamLatchFindings(driven.seam, { requireCalm: true });
        const notCalm = calm.filter((r) => !r.ok);
        check(`${chain.segments[i - 1]} ends at a CALM ARRIVAL`, notCalm.length === 0,
            notCalm.length === 0
                ? `${calm.length - 1} signature rows latched at tick `
                    + `${driven.seam.seam['latch.tick']}`
                : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));
        if (notCalm.length) {
            throw new Error('refusing to author a segment from a latch that is not a '
                + 'calm arrival — the boot could not reproduce it');
        }
        const blocks = segmentBootFromLatch(driven.seam);
        const name = chain.segments[i];
        const obj = {
            ...base,
            ...blocks,
            name,
            tick_count: spans[i].to - spans[i].from,
            inputs: chainInputsFor(WALK_INPUTS, spans[i].from, spans[i].to),
        };
        emit(name, tapeJson(obj,
            `⛓ SEGMENT ${i + 1} of chain "${chain.id}" — EVERY FIELD OF ITS BOOT STATE `
            + `IS ${chain.segments[i - 1]}'s LATCH, read out of the game and handed to `
            + '`segmentBootFromLatch`. Nothing here is typed: the save arrays, the '
            + 'persistence clear set, the three RNG streams, the day/night phase and '
            + 'the music no-repeat pair are all numbers only the game can produce. '
            + 'That is what makes the seam a MEASURED equality rather than a claim — '
            + '`boot(N+1) == latch(N)` over the whole SEAM_SIGNATURE, checked by '
            + '`playthroughAcceptance` on every sweep. Authored by '
            + 'scripts/procgen/plan-seedling-r7-act2.mjs.'));
        prev = obj;
    }
}

console.log(`\n${failures === 0
    ? (CHECK ? 'CHECK CLEAN — the committed chain is what the game produces today'
        : 'WROTE the chain; record it with `--record --only=<names>`')
    : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
