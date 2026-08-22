#!/usr/bin/env node
/**
 * plan-seedling-r7-ends-meet — AUTHOR the toy chain's tapes, from the walk
 * and from the GAME's own latch. R7 slice 2.
 *
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §3.1/§3.2, §4
 * slice 2 ("the ENDS-MEET upgrade proven on a two-segment toy chain").
 * Chain data: `frontend/modules/seedlingDemo/playthroughWalk.js`.
 *
 * ── ⛔ WHY THIS IS A SCRIPT AND NOT THREE HAND-WRITTEN TAPES ──────────
 *
 * Segment 2's boot block IS segment 1's latch. Every one of its ~40 fields
 * — the save arrays, the persistence clear set, the RNG streams, the music
 * rejection-loop pair, the day/night phase — is a number only the game can
 * produce, and a hand-typed tape would be a transcription of a measurement
 * that nobody could re-derive. So this drives segment 1, reads `botSeam()`,
 * and hands the envelope to `segmentBootFromLatch` (which refuses by name
 * anything the tape format cannot express). Nothing about segment 2's state
 * is typed anywhere.
 *
 * ⚠ AND THAT IS THE M1 GENERATOR IN MINIATURE. §3.6's ladder is M1 hand
 * plan-scripts / M2 offline / M3 real-time; this is the shape M1 takes when
 * the thing being planned is a SEAM rather than a route.
 *
 * ── `--check` IS THE ORACLE, and it can only work because the chain
 *    declares its own FP seed ───────────────────────────────────────────
 *
 * Re-running must produce byte-identical tapes or the committed chain is
 * not reproducible. Two of the three streams are already deterministic —
 * `Math.random` in this build is a fixed-seed LFSR (R5 slice 23) and the
 * cosmetic generator boots from a constant — but FlashPunk's LCG is seeded
 * once per PAGE from one real `Math.random()` (`Engine.as:50`). So the
 * chain's first segment DECLARES `rng.fp` (`playthroughWalk`'s
 * `walk.fpSeed`), which makes segment 1's latched `fp.seed` a function of
 * that declaration rather than of the page. Without it `--check` could
 * never pass and the chain could never be committed.
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/plan-seedling-r7-ends-meet.mjs            # write
 *   node scripts/procgen/plan-seedling-r7-ends-meet.mjs --check    # verify
 */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { committedTick0, tick0ParseFields, despawnField, tick0Field }
    from './tick0Carry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const TAPES = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { gameVisibleTape, parseTape, requiredTapeVersion, TAPE_VERSION } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { segmentBootFromLatch, seamLatchFindings } =
    await import(join(REPO, 'frontend/modules/seedlingDemo/r7Acceptance.js'));
const {
    PLAYTHROUGH_CHAINS, TRUE_INITIAL_BOOT, chainInputsFor, chainSpans,
} = await import(join(REPO, 'frontend/modules/seedlingDemo/playthroughWalk.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * ⚠ THE SERIALIZED FORM IS WRITTEN FROM A PARSED TAPE, always. `parseTape`
 * normalises (sorts spans, sorts persistence clears, fills empty blocks),
 * so writing the raw object and then reading it back through the parser
 * would produce a file that differs from what every consumer sees.
 */
function tapeJson(obj, description) {
    // ⛓ R9 slice 8: the tick-0 latch is CARRIED, never authored — read off the
    // committed tape, which is the artifact (⚖ ruling 17).
    const tick0 = committedTick0(TAPES, obj.name);
    const parsed = parseTape({ ...obj, ...tick0ParseFields(tick0, obj) });
    return `${JSON.stringify({
        /**
         * ⛔⛔ WAS `TAPE_VERSION`, AND THAT WAS THIS PRODUCER'S PRE-EXISTING
         * DRIFT — measured at a PRISTINE worktree at `899ef7a61`, where
         * `--check` was ALREADY RED on all three of its tapes, before this
         * slice touched anything.
         *
         * `TAPE_VERSION`'s own docblock says it: *"NOTHING THAT EMITS A TAPE
         * READS THIS — the emitted version is decided by WHICH FIELDS THE
         * CALLER DECLARES, so bumping this constant cannot silently
         * re-version the committed fixtures."* This was the one emitter that
         * read it, so every bump since v8 — v9, v10, and this slice's v11 —
         * re-versioned its output and drifted it from the v8 files on disk.
         * Nothing noticed because this producer is on NO checklist: ⚖ ruling
         * 8's identity block runs SIX producers' `--check` and this is a
         * SEVENTH (§14.11 named the gap for two others; this is the third).
         *
         * `requiredTapeVersion` is what every other producer uses and is the
         * rule the constant documents.
         */
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

function emit(name, json) {
    const path = join(TAPES, `${name}.json`);
    if (CHECK) {
        const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
        check(`${name} is byte-identical to what this planner derives`, have === json,
            have === null ? 'the tape does not exist'
                : have === json ? `${json.length} bytes`
                    : '⛔ DRIFT — the committed tape is not what the walk plus the '
                        + "game's own latch produce today");
        return;
    }
    writeFileSync(path, json);
    console.log(`WROTE ${path} (${json.length} bytes)`);
}

const call = (page, name, arg) => page.evaluate(([n, a]) => {
    const g = window.__swfBridge && window.__swfBridge.game;
    if (!g || typeof g[n] !== 'function') return null;
    return a === undefined ? g[n]() : g[n](a);
}, [name, arg]);

async function waitFor(page, desc, fn, timeoutMs = 3600000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${desc}`);
        await page.waitForTimeout(500);
    }
}

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});

async function latchOf(label, tapeObj) {
    const page = await browser.newPage();
    const t0 = Date.now();
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
        await page.click('#btn-start');
        await waitFor(page, 'bot callbacks',
            () => page.evaluate(() => !!(window.__swfBridge?.game?.botSeam)));
        const loaded = await call(page, 'botLoadTape',
            JSON.stringify(gameVisibleTape(parseTape(tapeObj))));
        if (loaded !== 'ok') throw new Error(`botLoadTape(${label}): ${loaded}`);
        const started = await call(page, 'botStart');
        if (started !== 'ok') throw new Error(`botStart(${label}): ${started}`);
        const status = await waitFor(page, `${label} to finish`, async () => {
            const st = JSON.parse(await call(page, 'botStatus'));
            return st.finished ? st : null;
        });
        const drained = JSON.parse(await call(page, 'botDrain'));
        const seam = JSON.parse(await call(page, 'botSeam'));
        console.log(`    drove ${label}: ${drained.ticks.length} observations, `
            + `${status.dead_frames} dead, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        return { seam, ticks: drained.ticks, status };
    } finally {
        await page.close();
    }
}

try {
    for (const chain of PLAYTHROUGH_CHAINS) {
        /**
         * ⛔ THIS PLANNER OWNS THE `walk`-BEARING CHAINS AND ONLY THOSE, and
         * saying so out loud is a SECOND pre-existing defect this slice
         * measured at a pristine `899ef7a61`: the loop walked EVERY chain in
         * `PLAYTHROUGH_CHAINS` and died with `Cannot read properties of
         * undefined (reading 'pins')` on the first staged one (`r8-battery-1`,
         * which declares no `walk` because a solver produced it). So the
         * instrument crashed after its last real row, on every run, and could
         * never reach a clean exit — its own `--check` verdict was
         * unreachable, which is why the drift below it went unseen for three
         * version bumps.
         *
         * A chain without a `walk` is not this planner's to author: it is
         * SKIPPED by name rather than crashed on, so the exit code means what
         * it says.
         */
        if (!chain.walk) {
            console.log(`\n## chain ${chain.id} — SKIPPED: no \`walk\` block, so it is `
                + 'not a hand-planned chain (a solver authored its segments)');
            continue;
        }
        console.log(`\n## chain ${chain.id}\n`);
        const spans = chainSpans(chain);
        const base = {
            game: 'seedling',
            tape_version: TAPE_VERSION,
            noclip: false,
            noDamage: false,
            noHazards: [],
            grants: [],
            persistence: [],
            despawn: [],
            equips: [],
            pins: [...chain.walk.pins],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed: 0, split: false, cosmetic: 0, fp: chain.walk.fpSeed },
            seam: null,
        };

        // ── the headline: the whole walk, one run ──────────────────────
        emit(chain.headline, tapeJson({
            ...base,
            name: chain.headline,
            boot: { ...TRUE_INITIAL_BOOT },
            tick_count: chain.endsAt,
            inputs: chainInputsFor(chain.walk.inputs, 0, chain.endsAt),
        }, `⛓ THE HEADLINE of chain "${chain.id}" — the same walk in ONE run, so the `
            + `${chain.segments.length} segments have something to be tick-for-tick `
            + 'IDENTICAL to. Inputs are `transition-west-return`\'s, unchanged since R1, '
            + `truncated at the second ARRIVAL (t=${chain.endsAt}) so that the LAST `
            + 'segment also ends at one. `pins: ["dead_frames"]` makes `save.time` '
            + 'update-determined (it counts dead frames, which are per-RENDER in '
            + 'vanilla); `rng.fp` is declared because FlashPunk seeds its LCG once per '
            + 'PAGE from `Math.random()` and a committed chain cannot inherit a random '
            + 'number. Authored by scripts/procgen/plan-seedling-r7-ends-meet.mjs.'));

        // ── segment 1: the true initial state, no inheritance ──────────
        const seg1Name = chain.segments[0];
        const seg1Obj = {
            ...base,
            name: seg1Name,
            boot: { ...TRUE_INITIAL_BOOT },
            tick_count: spans[0].to,
            inputs: chainInputsFor(chain.walk.inputs, spans[0].from, spans[0].to),
        };
        emit(seg1Name, tapeJson(seg1Obj,
            `⛓ SEGMENT 1 of chain "${chain.id}" — the CUSTODY BASE CASE. Boots the `
            + 'game\'s own initial state (`Main.as:50-51`: `new Game(0, 80, 128)`, empty '
            + 'save) and inherits NOTHING: no grants, no persistence clears, no save '
            + `presentation, no seam block. Ends at t=${spans[0].to}, which is the L94 `
            + 'ARRIVAL — the constructor half-tile (288+8, 160+8) with a fresh Player at '
            + 'zero velocity, the only tick in this walk a `boot: {level, x, y}` can '
            + 'reproduce. Its latch is what authors segment 2.'));

        // ── every later segment: authored FROM the predecessor's latch ──
        let prev = seg1Obj;
        for (let i = 1; i < chain.segments.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const driven = await latchOf(chain.segments[i - 1], prev);
            const calm = seamLatchFindings(driven.seam, { requireCalm: true });
            const notCalm = calm.filter((r) => !r.ok);
            check(`${chain.segments[i - 1]} ends at a CALM ARRIVAL`, notCalm.length === 0,
                notCalm.length === 0
                    ? `${calm.length - 1} signature rows latched at tick `
                        + `${driven.seam.seam['latch.tick']}`
                    : notCalm.map((r) => `${r.name} [${r.detail}]`).join('; '));
            if (notCalm.length) {
                throw new Error('refusing to author a segment from a latch that is not '
                    + 'a calm arrival — the boot could not reproduce it');
            }
            const blocks = segmentBootFromLatch(driven.seam);
            const name = chain.segments[i];
            const obj = {
                ...base,
                ...blocks,
                name,
                tick_count: spans[i].to - spans[i].from,
                inputs: chainInputsFor(chain.walk.inputs, spans[i].from, spans[i].to),
            };
            emit(name, tapeJson(obj,
                `⛓ SEGMENT ${i + 1} of chain "${chain.id}" — EVERY FIELD OF ITS BOOT `
                + `STATE IS ${chain.segments[i - 1]}'s LATCH, read out of the game and `
                + 'handed to `segmentBootFromLatch`. Nothing here is typed: the save '
                + 'arrays, the persistence clear set, the three RNG streams, the '
                + 'day/night phase and the music no-repeat pair are all numbers only '
                + 'the game can produce. That is what makes the seam a MEASURED '
                + 'equality rather than a claim — `boot(N+1) == latch(N)` over the '
                + 'whole SEAM_SIGNATURE, checked by `playthroughAcceptance` on every '
                + 'sweep. Authored by scripts/procgen/plan-seedling-r7-ends-meet.mjs.'));
            prev = obj;
        }
    }
} finally {
    await browser.close();
}

console.log(`\n${failures === 0
    ? (CHECK ? 'CHECK CLEAN — the committed chain is what the game produces today'
        : 'WROTE the chain; record it with `--record --only=<names>`')
    : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
