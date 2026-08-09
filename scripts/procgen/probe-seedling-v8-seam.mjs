#!/usr/bin/env node
/**
 * probe-seedling-v8-seam — does the GAME honour a tape v8 `seam` block, and
 * does its latch report back what the block declared?
 *
 * Region-atlas Phase 8, rung R7, slice 1. Brief:
 * `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §3.2 / §8.5 item 3.
 *
 * ── WHY A PROBE AND NOT A FIXTURE ─────────────────────────────────────
 *
 * The batch adds a boot block and a latch. Both sides validate the block
 * (`tapeFormat.parseSeam` here, `Bot.botLoadTape` in the fork, with the
 * bounds twinned and each citing the game line that makes it a bound —
 * trap 98), and vitest mutation-tests the JS half. What NEITHER can show is
 * that the GAME applies what it accepted: a `botStart` that parsed the
 * block and wrote nothing would pass every offline test and produce a seam
 * that silently boots the page's state.
 *
 * ⛔ AND THE ROSTER CANNOT SHOW IT EITHER, by construction: no committed
 * tape is v8 and none may become one this slice, because the batch's whole
 * gate is that the 118 fixtures stay byte-identical. So the block's first
 * exercise has to be a probe — and it has to be a PAIR:
 *
 *   CONTROL    the same tape with no `seam` block: the flags are false
 *   INERT      the same tape declaring save state: the flags are true IN
 *              THE GAME'S OWN LATCH, and the observation stream is
 *              unchanged tick for tick
 *   GAMEPLAY   the same tape declaring `cutscene[1]`: the stream MUST
 *              change, because that field is gameplay
 *
 * ⛓ THE THIRD ARM IS A POSITIVE CONTROL AND IT WAS EARNED, NOT PLANNED.
 * The probe first declared `cutscene` inside the INERT arm and asserted the
 * run was unchanged — and the run changed, correctly: `Game.as:955`'s
 * `cutscene[1]` branch writes `p.receiveInput = false` on EVERY frame, so a
 * segment booting that state has a player who cannot move. That is not a
 * defect in the boot block, it is the boot block WORKING on a field the
 * signature already labels GAMEPLAY. Splitting the arms turns a wrong
 * assertion into two right ones: the save state is inert on the stream, and
 * the block genuinely reaches the game.
 *
 * `friction-stop` is 30 ticks of pure deceleration in L0 with nothing to
 * collide with, so the inert arm must be tick-for-tick identical to the
 * control while its save state differs — which is exactly the shape a
 * segment boundary needs.
 *
 * ⚠ ONE FIELD IS DECLARED AND NOT WITNESSED, AND IT SAYS SO: the
 * `Music.currentSet`/`currentIndex` pair. The boot write lands, but the
 * level load then plays a sound of its own and the latch reports THAT — so
 * a 30-tick L0 window cannot tell a boot write from the run's own. Reported
 * as a named bound rather than asserted into a green.
 *
 * Run (dev server on :8000, wasm staged):
 *   node scripts/procgen/probe-seedling-v8-seam.mjs
 */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = 'seedling_bot_ap';
const ARTIFACT = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

if (!existsSync(join(ARTIFACT, 'game.html'))) {
    console.log(`SKIP: no wasm artifact at ${ARTIFACT}`);
    process.exit(0);
}

const { loadTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/fixtures/index.js'));
const { parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { seamLatchFindings } = await import(join(REPO, 'frontend/modules/seedlingDemo/r7Acceptance.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * The treatment's declaration. Deliberately a MIXTURE:
 *  · two item flags, one of which (`hasShield`) the whole rung is about;
 *  · `hits_max: 4`, the one int with a falsy-arm getter;
 *  · `beam`, which is what arms L0's 280-draw render-side flare — declared
 *    here precisely because it is the field that DATES the overworld's RNG
 *    posture (slice 0 §8.2 item 5);
 *  · `cutscene`, an array;
 *  · `music`, the pair that gates a rejection loop's draw count.
 */
const SEAM_INERT = {
    items: { hasSword: true, hasShield: true },
    hits_max: 4,
    beam: true,
    grass_cut: 12,
    music: { set: 'Chest', index: 0 },
};

/**
 * The positive control: one field the signature calls GAMEPLAY.
 * `Game.as:955`'s `cutscene[1]` arm writes `p.receiveInput = false` every
 * frame, so a run that boots it cannot move — and a boot block that could
 * NOT produce that would be a block the game is ignoring.
 */
const SEAM_GAMEPLAY = { cutscene: [false, true, false, false] };

const base = parseTape(loadTape('friction-stop'));
// ⚠ REBUILT AS A v8 TAPE RATHER THAN MUTATED IN PLACE: `parseTape` refuses a
// v1 tape that declares anything, which is the rule this probe must not
// pretend to be outside of. The INPUTS are the fixture's, unchanged, so the
// two arms differ in exactly one thing.
const v8 = (seam) => parseTape({
    tape_version: 8,
    game: 'seedling',
    boot: { ...base.boot },
    noclip: base.noclip,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: [],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 0, split: false, cosmetic: 0, fp: 0 },
    ...(seam ? { seam } : {}),
    tick_count: base.tick_count,
    inputs: base.inputs.map((s) => ({ ...s })),
});

// ⚠ THE SAME LAUNCH ARGS AS THE DIFFERENTIAL, and they are not optional:
// without a WebGPU/swiftshader adapter the recompiled page never reaches
// `Bot.init()`, so `botStatus` never registers and the probe times out
// waiting for a callback that was never going to arrive. Measured — a bare
// `chromium.launch()` hangs at exactly that point.
const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader',
        '--no-sandbox',
    ],
});

async function runArm(label, tape) {
    const page = await browser.newPage();
    const t0 = Date.now();
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
        await page.click('#btn-start');
        await waitFor(page, 'bot callbacks',
            () => page.evaluate(() => !!(window.__swfBridge?.game?.botSeam)));
        const loaded = await call(page, 'botLoadTape', JSON.stringify(tape));
        if (loaded !== 'ok') throw new Error(`botLoadTape(${label}): ${loaded}`);
        const started = await call(page, 'botStart');
        if (started !== 'ok') throw new Error(`botStart(${label}): ${started}`);
        const status = await waitFor(page, `${label} to finish`, async () => {
            const st = JSON.parse(await call(page, 'botStatus'));
            return st.finished ? st : null;
        }, 2400000);
        const drained = JSON.parse(await call(page, 'botDrain'));
        const seam = JSON.parse(await call(page, 'botSeam'));
        const secs = (Date.now() - t0) / 1000;
        console.log(`    arm ${label}: ${drained.ticks.length} observations, `
            + `${status.dead_frames} dead, ${secs.toFixed(0)}s`);
        return { status, ticks: drained.ticks, seam, secs };
    } finally {
        await page.close();
    }
}

const call = (page, name, arg) => page.evaluate(([n, a]) => {
    const g = window.__swfBridge && window.__swfBridge.game;
    if (!g || typeof g[n] !== 'function') return null;
    return a === undefined ? g[n]() : g[n](a);
}, [name, arg]);

async function waitFor(page, desc, fn, timeoutMs = 120000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${desc}`);
        await page.waitForTimeout(500);
    }
}

try {
    console.log('## tape v8 seam block — the two-sided probe\n');
    const control = await runArm('control', v8(null));
    const treatment = await runArm('inert', v8(SEAM_INERT));
    const gameplay = await runArm('gameplay', v8(SEAM_GAMEPLAY));

    // ── (a) the game accepted and APPLIED the block ────────────────────
    const cs = control.seam.seam;
    const ts = treatment.seam.seam;
    check('both arms latched a seam', control.seam.latched && treatment.seam.latched,
        `control ${control.seam.latched}, treatment ${treatment.seam.latched}`);
    check('the control boots the FRESH state (the negative arm)',
        cs['save.hasSword'] === false && cs['save.hasShield'] === false
        && cs['save.hitsMax'] === 3 && cs['save.beam'] === false
        && cs['save.grassCut'] === 0,
        `hasSword=${cs['save.hasSword']} hasShield=${cs['save.hasShield']} `
        + `hitsMax=${cs['save.hitsMax']} beam=${cs['save.beam']} `
        + `grassCut=${cs['save.grassCut']}`);
    // ⛔⛔ `beam` IS NOT IN THIS TABLE, AND WHY IS A FINDING THAT REFUTES
    // §8.2 ITEM 1. That entry calls `Main.beam` "an assertable witness that
    // the shield was EARNED". It is not: `Moonrock.update` treats it as a
    // ONE-SHOT TRIGGER — `if (beam && canBeam)` runs a 5-second beam
    // cutscene (`beamTimeMax = FPS * 5`), plays "Light", and then sets
    // `beam = false; trigger = true` (`Moonrock.as:88-106`). So a window
    // that boots `beam: true` in L0 ends with it FALSE, by design, and the
    // durable witness is `rockSet` — which the same code path sets and
    // which makes the moonrock a 48x48 Solid.
    //
    // The declaration still LANDED, and this probe has three independent
    // witnesses that it did: the beam scene's own sound trail (the Music
    // pair moves from ""/-1 to "Rock"/0), `rockSet` flipping, and a
    // ten-fold wall-clock cost that only the flare can explain.
    const declared = {
        'save.hasSword': true,
        'save.hasShield': true,
        'save.hitsMax': 4,
        'save.grassCut': 12,
    };
    for (const [field, want] of Object.entries(declared)) {
        check(`the game applied \`${field}\``, ts[field] === want,
            `latched ${JSON.stringify(ts[field])}, declared ${JSON.stringify(want)}`);
    }
    check('`beam` was applied and then CONSUMED by the moonrock, as the game '
        + 'defines it', ts['save.beam'] === false && ts['save.rockSet'] === true
        && cs['save.rockSet'] === false,
        `inert arm ended beam=${ts['save.beam']} rockSet=${ts['save.rockSet']}, `
        + `control beam=${cs['save.beam']} rockSet=${cs['save.rockSet']} — `
        + '`Moonrock.update` runs the beam for FPS*5 frames and then writes '
        + '`beam = false; trigger = true`, and the fall sets `rockSet`. ⇒ **`rockSet`, '
        + 'not `beam`, is the durable witness that the shield was earned** (§8.2 item '
        + '1 says `beam`, and this refutes it).');
    check('the INERT arm leaves `static.Game.cutscene` alone',
        JSON.stringify(ts['static.Game.cutscene']) === JSON.stringify([false, false, false, false]),
        JSON.stringify(ts['static.Game.cutscene']));
    // ⚠ A NAMED BOUND, NOT A CHECK. The write lands at `botStart`, and then
    // the level load plays a sound and `Music.playSound` overwrites the pair
    // with its own — so what the latch reports at tick 30 is the RUN's
    // music, not the boot's, in both arms. A 30-tick L0 window cannot
    // witness this field; slice 2's seam probe needs a window that plays no
    // indexed sound, or a read taken at the boot rather than at the latch.
    // Printed rather than asserted, because a check that compares the run's
    // own state to a declaration it has already overwritten would be a check
    // that can only pass by accident.
    console.log('BOUND: the Music no-repeat pair is NOT witnessed by this window — '
        + `control ended at ${JSON.stringify(cs['static.Music.currentSet'])}/`
        + `${cs['static.Music.currentIndex']}, the inert arm (which declared `
        + `"Chest"/0) ended at ${JSON.stringify(ts['static.Music.currentSet'])}/`
        + `${ts['static.Music.currentIndex']}. `
        + `${cs['static.Music.currentSet'] === ts['static.Music.currentSet']
            ? 'Both arms agree, so the run overwrote the declaration'
            : 'The arms DIFFER, so some of the declaration survived'}`
        + ' — the level load plays a sound of its own, and `Music.playSound` '
        + 'writes both fields.');
    check('the latched Music pair is a legal state in both arms',
        typeof cs['static.Music.currentSet'] === 'string'
        && Number.isInteger(cs['static.Music.currentIndex'])
        && typeof ts['static.Music.currentSet'] === 'string'
        && Number.isInteger(ts['static.Music.currentIndex']),
        `control ${JSON.stringify(cs['static.Music.currentSet'])}/`
        + `${cs['static.Music.currentIndex']}, inert `
        + `${JSON.stringify(ts['static.Music.currentSet'])}/`
        + `${ts['static.Music.currentIndex']} — the accessors answer, which is what `
        + 'this batch added them for');

    // ── (b) …and moved NOTHING the tape drives ─────────────────────────
    // ⛔ THE HALF THAT DECIDES WHETHER THE BLOCK IS USABLE AT A SEAM. A
    // declaration that also shifted the player would be a boot block a
    // segment could not boot from.
    const a = JSON.stringify(control.ticks);
    const b = JSON.stringify(treatment.ticks);
    // ⛓⛓ AND THE INERT ARM IS *SLOW*, WHICH IS ITSELF THE MEASUREMENT
    // SLICE 0 PREDICTED FROM SOURCE. §8.2 item 5: L0 holds the game's only
    // `moonrock`, whose `drawFlares` is **280 draws per RENDER frame**,
    // gated on `Main.beam` — which `Shield.removed()` sets. The inert arm
    // declares `beam: true` and the same 30 ticks take multiples of the
    // control's wall clock. The rung's own headline item is what arms the
    // polluter, and this is the first time the game has been asked to
    // demonstrate it rather than the source read to predict it.
    console.log(`FINDING: beam=true costs ${(treatment.secs / control.secs).toFixed(1)}x `
        + `the control's wall clock for the same 30 ticks `
        + `(${control.secs.toFixed(0)}s -> ${treatment.secs.toFixed(0)}s, headless `
        + `swiftshader) and ${control.status.dead_frames} -> `
        + `${treatment.status.dead_frames} DEAD FRAMES for the same one load. `
        + '`Moonrock.drawFlares` is 280 draws per RENDER frame and slice 0 predicted '
        + 'it from source; what it did not predict is the second number. Dead frames '
        + 'are counted per UPDATE while `blackCover` decays per RENDER, so starving '
        + 'the renderer stretches the fade by whatever the ratio moved — here '
        + `${(treatment.status.dead_frames / control.status.dead_frames).toFixed(0)}x. `
        + '⇒ trap 123 is WIDER than slice 0 recorded: it is not only the RNG posture '
        + 'that changes at the shield, it is the DEAD-FRAME LEDGER, and every segment '
        + 'past D2 in a render-coupled level needs `Bot.pinDeadFrames` for its budget '
        + 'to mean anything. The observation STREAM is unaffected, which is the check '
        + 'below.');
    check('a SAVE-STATE declaration moves the stream by NOTHING', a === b,
        a === b ? `${control.ticks.length} observations, identical in both arms`
            : 'THE SEAM BLOCK MOVED THE RUN — it would not be usable as a boot block');

    // ── (b2) …and the POSITIVE CONTROL says the block is not inert by
    //          being ignored.
    const gs = gameplay.seam.seam;
    const c = JSON.stringify(gameplay.ticks);
    check('the GAMEPLAY arm applied `cutscene[1]`',
        JSON.stringify(gs['static.Game.cutscene'])
            === JSON.stringify([false, true, false, false]),
        JSON.stringify(gs['static.Game.cutscene']));
    check('…and the run CHANGED, which is what makes the inert arm evidence',
        c !== a,
        c !== a ? '`Game.as:955`\'s cutscene[1] arm writes `receiveInput = false` every '
            + `frame; the player never moves (${gameplay.status.saw_input_refused
                ? 'and the game reports the refusal' : '⚠ WITHOUT reporting a refusal'})`
            : '⛔ IDENTICAL to the control — the block was ACCEPTED AND IGNORED, which '
                + 'is the one failure the inert arm cannot distinguish from success');

    // ── (c) the FP LCG hook answers, and is not `randomSeed`'s mirror ──
    check('`fp.seed` is a live LCG state, not 0',
        Number.isFinite(ts['fp.seed']) && ts['fp.seed'] > 0,
        `fp.seed=${ts['fp.seed']} (control ${cs['fp.seed']}) — FP.randomSeedLive reads `
        + '`_seed`, which the draws advance; `FP.randomSeed`\'s getter reads `_getSeed`, '
        + 'which only the setter writes');

    // ── (d) the latch consumer's own verdict, on a real envelope ───────
    for (const [label, env] of [['control', control.seam], ['inert', treatment.seam],
        ['gameplay', gameplay.seam]]) {
        const rows = seamLatchFindings(env, { requireCalm: false });
        const bad = rows.filter((r) => !r.ok);
        check(`${label}: every signature row is claimed`, bad.length === 0,
            bad.length === 0 ? `${rows.length - 1} rows`
                : bad.map((r) => r.name).join(', '));
    }

    // ── (e) the refusals, against the GAME's validator ─────────────────
    // Both validators state every bound; this asks the AS3 one, which no
    // offline test can reach.
    const page = await browser.newPage();
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady));
    await page.click('#btn-start');
    await waitFor(page, 'bot callbacks',
        () => page.evaluate(() => !!(window.__swfBridge?.game?.botSeam)));
    const refusals = [
        ['grass_cut 10000 (unlockMedal)', { grass_cut: 10000 }],
        ['menu_state 1 (Game.end zeroes it)', { menu_state: 1 }],
        ['hits_max 0 (the falsy arm)', { hits_max: 0 }],
        ['an unknown item flag', { items: { hasNothing: true } }],
        ['a music index with no set', { music: { index: 3 } }],
        ['primary 6 (six slot ids exist)', { primary: 6 }],
    ];
    for (const [label, seam] of refusals) {
        // ⚠ The JS parser would refuse these too, which is the point — so
        // the tape is hand-built past it, to ask the AS3 validator directly.
        const raw = { ...v8(null), tape_version: 8, seam };
        const said = await call(page, 'botLoadTape', JSON.stringify(raw));
        check(`the GAME refuses ${label}`, typeof said === 'string' && said.startsWith('error:'),
            said);
    }
    // …and a v7 tape declaring a seam, which is the version gate itself.
    const v7WithSeam = { ...v8(null), tape_version: 7, seam: { hits_max: 4 } };
    const saidV7 = await call(page, 'botLoadTape', JSON.stringify(v7WithSeam));
    check('the GAME refuses a v7 tape that declares a seam',
        typeof saidV7 === 'string' && saidV7.startsWith('error:'), saidV7);
    await page.close();
} finally {
    await browser.close();
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
