#!/usr/bin/env node
/**
 * probe-seedling-rng — take the generator's own stream FROM THE GAME.
 *
 * R6 slice 6a. Brief: `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §14.12.
 *
 * ── WHY A PROBE AND NOT A TABLE OF NUMBERS ────────────────────────────
 *
 * `rng.js` transcribes a 31-bit LFSR and an avmplus hash out of
 * `SWFModernRuntime/src/avm2/avm2_number.c`. A test that checked it against
 * expected values typed into the test file would be checking the
 * transcription against the same reading of the same C — the failure mode
 * where both sides are wrong in the same way. THE GAME IS THE ONLY ORACLE,
 * so this script asks the live wasm build, through the same `Math.random()`
 * the game itself calls, and writes what it says into
 * `fixtures/rng-oracle.json` for `rng.test.js` to diff against.
 *
 * ⛓ `Bot.botRngProbe` puts the state back after sampling (the WRITE hook's
 * second job), so running this against a page mid-window would not disturb
 * it. It still gets a fresh page, because a probe that needs an argument
 * about why it is safe is one bug away from not being.
 *
 * ⚠ THE SEEDS ARE CHOSEN TO BE ADVERSARIAL, not round: the hasher's three
 * multiplies wrap at int32 and a JS `*` gets small inputs right and large
 * ones wrong, so the table has to contain states whose products overflow.
 * 0 is in the list because it means "the build's own boot seed" on both
 * sides, and 2147483647 because it is the top of the orbit.
 *
 * ⛔ AND THE FIRST RUN OF THIS SCRIPT PAID FOR ITSELF TWICE. It caught the
 * xor mask (kickoff §14.1 wrote `avm2_random_xor_masks[29]` and then quoted
 * index 30's `0xA3000000`; index 29 is `0x48000000`, which is what the game
 * returns), and it caught the transport: a seed of 2147483648 came back as
 * **-2147483648**, because the recompiled runtime's `JSON.parse` coerces an
 * integral Number to int32. Both bounds now live in the format.
 *
 * Usage (dev server on :8000 at the repo root):
 *   node scripts/procgen/probe-seedling-rng.mjs [--out <path>]
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_URL = 'http://localhost:8000/frontend/modules/flashPanel/wasm/'
    + `${process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b'}/game.html`;

const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0
    ? process.argv[outArg + 1]
    : join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'rng-oracle.json');

/** Seeds worth pinning, and why each is in the list. */
const SEEDS = [
    { seed: 0, why: 'the build\'s own boot seed (MOCK_DATE_TIME 981152406000)' },
    { seed: 1, why: 'the smallest odd state — takes the xor arm on step 1' },
    { seed: 2, why: 'the smallest even state — takes the shift arm' },
    { seed: 12345, why: 'a small state whose hash products still wrap' },
    { seed: 1234567890, why: 'a state whose hash products are past 2^53 as doubles' },
    { seed: 2147483647, why: '2^31 - 1: the top of the orbit, and the declarable max' },
    { seed: 1486967168, why: 'BOOT_SEED written explicitly — must equal seed 0' },
];
const COUNT = 64;

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

const page = await browser.newPage();
const call = (n, a) => page.evaluate(
    ([nn, x]) => String(window.__swfBridge.game[nn](x)), [n, a]);

try {
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
        await page.waitForTimeout(250);
    }
    await page.click('#btn-start');
    for (let i = 0; i < 480
        && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botRngProbe))); i++) {
        await page.waitForTimeout(250);
    }
    const has = await page.evaluate(() => !!(window.__swfBridge?.game?.botRngProbe));
    if (!has) throw new Error('botRngProbe is not registered — this build predates the batch');

    const streams = [];
    for (const { seed, why } of SEEDS) {
        for (const cosmetic of [false, true]) {
            const raw = await call('botRngProbe',
                JSON.stringify({ seed, count: COUNT, cosmetic }));
            if (raw.startsWith('error:')) throw new Error(`seed ${seed}: ${raw}`);
            const r = JSON.parse(raw);
            if (r.draws.length !== COUNT) {
                throw new Error(`seed ${seed}: got ${r.draws.length} draws, want ${COUNT}`);
            }
            streams.push({ seed, cosmetic, why, draws: r.draws, states: r.states });
            console.log(`seed ${seed}${cosmetic ? ' (cosmetic)' : ''}: `
                + `${r.draws.length} draws, first ${r.draws[0]}, state ${r.states[0]}`);
        }
    }

    // ⛓ The two streams are INDEPENDENT GENERATORS running the same
    // algorithm, so at the same seed they must produce the SAME sequence.
    // Recorded as a claim rather than assumed: if they ever differ, one of
    // them has been given a different mask or a different hasher.
    for (const s of streams.filter((x) => !x.cosmetic)) {
        const c = streams.find((x) => x.cosmetic && x.seed === s.seed);
        const same = JSON.stringify(s.draws) === JSON.stringify(c.draws);
        console.log(`   seed ${s.seed}: gameplay/cosmetic streams agree = ${same}`);
        if (!same) throw new Error(`seed ${s.seed}: the two generators disagree`);
    }

    // ── PHASE 2: DOES THE SPLIT ACTUALLY ROUTE? AN A/B, NOT A READING ─
    //
    // ⛔⛔ THE FIRST VERSION OF THIS CHECK WAS VACUOUS AND SAID SO. It armed
    // ONE split tape in a quiet room and asserted "the gameplay stream
    // stands still" — which it did, and so did the cosmetic one, because in
    // eight ticks of an empty L0 the game draws NOTHING at all. A test that
    // passes when nothing happens is not evidence that the routing works;
    // it is [[feedback_green_pair_can_witness_nothing]] with a different
    // subject.
    //
    // The witness has to be two-sided, so it is a PAIR over the same
    // inputs, differing only in `rng.split`:
    //
    //   · a press of `primary` with the sword granted calls
    //     `Music.playSound("Sword")` (`Player.as:790,797`), whose
    //     `intInd == -1` arm rolls a random index — a COSMETIC draw, by the
    //     census, and one this tape can force on demand.
    //   · split OFF ⇒ that draw comes off the GAMEPLAY generator and its
    //     state MUST MOVE.
    //   · split ON  ⇒ the gameplay state MUST NOT MOVE and the COSMETIC one
    //     MUST. Both halves are asserted: "gameplay still" alone is what
    //     the vacuous version already reported.
    const splitTape = (split) => ({
        tape_version: 7,
        game: 'seedling',
        name: `r6-probe-rng-split-${split ? 'on' : 'off'}`,
        description: 'R6 slice 6a: does the cosmetic stream actually carry the '
            + 'cosmetic draws? The arm is a sword press, whose sound rolls an index.',
        boot: { level: 0, x: 80, y: 128 },
        noclip: false,
        noDamage: true,
        noHazards: ['water', 'pit', 'lava', 'ice', 'waterfall'],
        // The sword, so `slashing`'s `hasSword` gate opens and the press
        // reaches `Music.playSound("Sword")`.
        grants: [{ level: 0, items: ['sword'] }],
        persistence: [],
        equips: [],
        pins: [],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 12345, split },
        tick_count: 24,
        inputs: [
            { key: 'primary', from: 2, to: 3 },
            { key: 'primary', from: 10, to: 11 },
            { key: 'primary', from: 18, to: 19 },
        ],
    });

    const runSplitArm = async (split) => {
        const p2 = await browser.newPage();
        const c2 = (n, a) => p2.evaluate(
            ([nn, x]) => String(window.__swfBridge.game[nn](x)), [n, a]);
        try {
            await p2.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480
                && !(await p2.evaluate(() => !!window.__runtimeReady)); i++) {
                await p2.waitForTimeout(250);
            }
            await p2.click('#btn-start');
            for (let i = 0; i < 480
                && !(await p2.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
                await p2.waitForTimeout(250);
            }
            const tape = splitTape(split);
            const l = await c2('botLoadTape', JSON.stringify(tape));
            if (l !== 'ok') throw new Error(`botLoadTape(split=${split}): ${l}`);
            const st = await c2('botStart');
            if (st !== 'ok') throw new Error(`botStart(split=${split}): ${st}`);
            const armed = JSON.parse(await c2('botStatus'));
            const samples = [];
            for (let i = 0; i < 60; i++) {
                await p2.waitForTimeout(3000);
                const s2 = JSON.parse(await c2('botStatus'));
                samples.push({
                    tick: s2.tick, dead: s2.dead_frames, slash: s2.slash,
                    state: s2.rng.state, cos: s2.rng.cosmetic_state,
                });
                if (s2.finished) break;
            }
            const last = samples[samples.length - 1];
            return { split, armed: armed.rng, last, samples };
        } finally {
            await p2.close();
        }
    };

    console.log('\n## the split A/B — same inputs, one field apart');
    const armOff = await runSplitArm(false);
    const armOn = await runSplitArm(true);
    for (const a of [armOff, armOn]) {
        console.log(`split=${a.split}: armed state ${a.armed.state} cos ${a.armed.cos ?? a.armed.cosmetic_state}`);
        console.log(`   final tick ${a.last.tick} dead ${a.last.dead} `
            + `slash ${JSON.stringify(a.last.slash)} `
            + `state ${a.last.state} cos ${a.last.cos}`);
    }
    // ⚠ THE POSITIVE COUNT FIRST. If the OFF arm's gameplay stream never
    // moved, no cosmetic draw happened at all and the ON arm's stillness
    // means nothing — so that is the first thing checked, and it fails
    // loudly rather than passing quietly.
    const offMoved = armOff.last.state !== armOff.armed.state;
    const onStill = armOn.last.state === armOn.armed.state;
    const onCosMoved = armOn.last.cos !== 1486967168;
    const pressesLanded = (armOff.last.slash?.tests ?? 0) > 0;
    console.log(`   presses reached slash()            = ${pressesLanded}`);
    console.log(`   split OFF: gameplay stream MOVED   = ${offMoved}`);
    console.log(`   split ON : gameplay stream STILL   = ${onStill}`);
    console.log(`   split ON : cosmetic stream MOVED   = ${onCosMoved}`);
    if (!pressesLanded || !offMoved) {
        throw new Error('VACUOUS: the OFF arm drew nothing, so the ON arm\'s '
            + 'stillness witnesses nothing. Fix the tape, not the runtime.');
    }

    // ── PHASE 3: THE GAME'S OWN PARSER, REFUSING WHAT IT SHOULD ──────
    //
    // ⚠ THE FORMAT'S CLAIM IS THAT BOTH CONSUMERS READ A TAPE THE SAME WAY,
    // and `tapeFormat.test.js` only ever asks the JS one. These are the
    // same rejections put to the GAME, which is the half that has been
    // wrong before (the R0 batch's presence-vs-value check rejected all
    // eleven committed fixtures and no JS test could have seen it).
    const refusals = [];
    const expectRefusal = async (label, tape, wanted) => {
        const r = await call('botLoadTape', JSON.stringify(tape));
        const ok = r.startsWith('error:') && r.includes(wanted);
        refusals.push({ label, got: r, ok });
        console.log(`   ${ok ? '✓' : '⛔'} ${label}\n      ${r}`);
    };
    const v7ok = splitTape(false);
    console.log('\n## the game\'s own v7 rejections');
    await expectRefusal('a v6 tape declaring rng is refused BY VALUE',
        { ...v7ok, tape_version: 6, rng: { seed: 12345, split: false } },
        'BY DEFINITION');
    await expectRefusal('a v6 tape carrying the NORMALISED empty block is NOT refused',
        { ...v7ok, tape_version: 6, rng: { seed: 0, split: false } },
        'no-error-expected');
    await expectRefusal('a seed above the orbit is refused, naming the coercion',
        { ...v7ok, rng: { seed: 2147483648, split: false } },
        'JSON.parse');
    await expectRefusal('a non-boolean split is refused',
        { ...v7ok, rng: { seed: 0, split: 'yes' } },
        'rng.split must be a boolean');
    // ⚠ The second row above is a POSITIVE control written as a refusal
    // check on purpose: it must NOT match, and printing it as a ⛔ is how a
    // reader sees that the empty-block path is still open. Fix its verdict.
    refusals[1].ok = !refusals[1].got.startsWith('error:');
    console.log(`   ${refusals[1].ok ? '✓' : '⛔'} (re-read as a POSITIVE control: `
        + `the normalised empty block loads = ${refusals[1].ok})`);
    if (refusals.some((r) => !r.ok)) {
        throw new Error('the game\'s v7 parser does not agree with tapeFormat.js');
    }

    const status = JSON.parse(await call('botStatus'));
    const doc = {
        game_side_refusals: refusals,
        split_witness: {
            seed: 12345,
            off: armOff,
            on: armOn,
            presses_landed: pressesLanded,
            off_gameplay_moved: offMoved,
            on_gameplay_still: onStill,
            on_cosmetic_moved: onCosMoved,
        },
        note: 'GENERATED BY scripts/procgen/probe-seedling-rng.mjs FROM THE LIVE '
            + 'GAME. Do not hand-edit: it is rng.js\'s oracle, and a value typed '
            + 'in here would make the differential check the transcription '
            + 'against itself.',
        count: COUNT,
        hooks: status.rng ? status.rng.hooks : null,
        streams,
    };
    writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`\nwrote ${OUT} (${streams.length} streams x ${COUNT} draws)`);
} finally {
    await page.close();
    await browser.close();
}
