#!/usr/bin/env node
/**
 * probe-seedling-r5-mobiles — ⛓⛓ THE SLICE-23 BATCH'S TWO NEW SURFACES,
 * ASKED OF THE REAL GAME.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 23. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §37.3.
 *
 * Two questions the flags-off roster gate cannot answer, because both are
 * about capabilities no committed fixture uses:
 *
 *   1. does `botMobiles()` — the new ExternalInterface callback — return
 *      the raw per-entity rows it claims, in update order, with the nested
 *      `enemy` object present for Enemies and null for everything else?
 *   2. does a version-6 `save` block actually land? Boots L43 with all five
 *      totem parts, one key and two seal parts PRESENTED, and reads them
 *      back through `botStatus.save`, which is `Player.hasTotemPart(i)` /
 *      `Player.hasKey(i)` / `Main.hasSealPart(i)` — the same accessors the
 *      gates read, never echoed from the tape.
 *
 * ⛔ AND THE THIRD QUESTION IS THE ONE THE FIELD EXISTS FOR: with the parts
 * presented, does the game FREEZE on the wand's approach fade? A boot that
 * lands inside `Wand.update`'s gate should spend its first ~99 frames as
 * DEAD frames with the tick counter pinned — which is the whole difference
 * between the pair's two arms, observed directly rather than inferred.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-mobiles.mjs
 */

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_URL = 'http://localhost:8000/frontend/modules/flashPanel/wasm/'
    + `${process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b'}/game.html`;

const { loadTape } = await import(join(REPO,
    'frontend/modules/seedlingDemo/fixtures/index.js'));

const checks = [];
const check = (ok, name, detail) => {
    checks.push({ ok, name, detail });
    console.log(`   ${ok ? '✓' : '⛔'} ${name}\n      ${detail}`);
};

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});
const page = await browser.newPage();
const bot = (name, a) => page.evaluate(
    ([n, x]) => String(window.__swfBridge.game[n](x)), [name, a],
);
const botJson = async (name, a) => JSON.parse(await bot(name, a));

try {
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
        await page.waitForTimeout(250);
    }
    await page.click('#btn-start');
    for (let i = 0; i < 480
        && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
        await page.waitForTimeout(250);
    }

    console.log('## the slice-23 batch, asked of the real game\n');

    // ── 1. the callback exists at all ────────────────────────────────
    const registered = await page.evaluate(
        () => !!(window.__swfBridge?.game?.botMobiles),
    );
    check(registered, '`botMobiles` is registered as its own callback',
        registered ? 'window.__swfBridge.game.botMobiles is a function — and no '
            + 'existing caller polls it, which is what makes it inert by construction'
            : 'ABSENT — the batch did not reach this build');

    // ── 2. the v6 boot, and the save block read back ─────────────────
    const tape = loadTape('r5-l43-wand');
    const withKeys = {
        ...tape,
        save: { totem_parts: [0, 1, 2, 3, 4], keys: [2], seal_parts: [9, 4] },
    };
    const loaded = await bot('botLoadTape', JSON.stringify(withKeys));
    check(loaded === 'ok', 'a version-6 tape LOADS', loaded);
    const started = await bot('botStart');
    check(started === 'ok', 'and ARMS', started);

    // ⚠ `FP.world = new Game(...)` only records a `_goto`; THE SWAP LANDS AT
    // END OF TICK, and this runtime renders at ~0.5 fps headless. So the
    // first `botStatus` after `botStart` reports `Main.level` 43 (the static
    // the constructor already wrote) while `FP.world` is STILL LEVEL 0 —
    // which is exactly what the first cut of this probe measured, reporting
    // "the boot landed in 43" beside a mobile list of Statue /
    // IntroCharacter / Player. Wait for the WORLD, not for the static.
    let boot = await botJson('botStatus');
    for (let i = 0; i < 240; i += 1) {
        const live = await botJson('botMobiles');
        if ((live.mobiles ?? []).some((r) => r.cls.endsWith('BossTotem'))) break;
        await page.waitForTimeout(1000);
        boot = await botJson('botStatus');
    }
    const s = boot.save ?? {};
    check(Array.isArray(s.totem_parts) && s.totem_parts.every(Boolean)
        && s.has_all_totem_parts === true,
        '⛓⛓⛓ the totem parts LANDED, read through `Player.hasTotemPart(i)`',
        `totem_parts ${JSON.stringify(s.totem_parts)} `
        + `has_all=${s.has_all_totem_parts}`);
    check(JSON.stringify(s.keys) === JSON.stringify([false, false, true, false, false]),
        '⛓ the KEY landed in its own index and nowhere else',
        `keys ${JSON.stringify(s.keys)} for a declared [2]`);
    check(Array.isArray(s.seal_parts) && s.seal_parts[0] === 9 && s.seal_parts[1] === 4
        && s.seal_parts[2] === -1 && s.has_all_seal_parts === false,
        '⛔⛔ the SEAL PARTS are IDENTITY SLOTS — collection order, -1 for empty',
        `seal_parts ${JSON.stringify(s.seal_parts)} for a declared [9, 4]; `
        + `has_all=${s.has_all_seal_parts} because the LAST slot is still -1, which `
        + 'is `SealController.hasAllSealParts()`\'s own test');
    check(boot.level === 43, 'and the boot landed in level 43',
        `level ${boot.level} at (${boot.x}, ${boot.y})`);

    // ── 3. the mobile readout ────────────────────────────────────────
    const m = await botJson('botMobiles');
    const rows = m.mobiles ?? [];
    check(rows.length > 0, '`botMobiles` returns rows for the live world',
        `${rows.length} Mobile(s): ${rows.map((r) => r.cls.split('::').pop()).join(', ')}`);
    const player = rows.find((r) => r.cls.endsWith('Player'));
    check(!!player && player.enemy === null,
        '⛓ the PLAYER is in it, and its `enemy` block is null',
        player ? `${player.cls} at (${player.x}, ${player.y}) type="${player.type}" `
            + `anim=${JSON.stringify(player.anim)} alpha=${player.alpha} `
            + `onScreen=${player.on_screen}`
            : 'no Player row — the set is not `Mobile` after all');
    // ⛔⛔ AND `type = "Solid"` IS WRITTEN BY `update()`, NOT BY THE
    // CONSTRUCTOR. `BossTotem`'s base ctor is `Enemy`, which sets
    // `type = "Enemy"`; the `"Solid"` is the ELSE of `if (activated)` inside
    // `update()`. `Game.update` skips `super.update()` entirely while
    // `blackCover > 0`, so for the room's whole load fade the boss reports
    // "Enemy" — which is what the first cut of this probe measured and read
    // as a refutation of the census correction.
    //
    // ⛓ IT IS UNOBSERVABLE TO A WALK, and that is a claim about the UPDATE
    // ORDER rather than about the fade: every blackCover frame is a DEAD
    // frame the tape does not advance through, and on the first LIVE frame
    // the boss updates BEFORE the player (`addUpdate` PREPENDS; Player added
    // at `Game.as:2092`, boss at `:2121`), so the type is already "Solid" by
    // the time any sweep reads it. `beforeTypeFlip` does NOT apply here.
    let boss = rows.find((r) => r.cls.endsWith('BossTotem'));
    for (let i = 0; i < 120 && boss && boss.type !== 'Solid'; i += 1) {
        await page.waitForTimeout(1000);
        boss = ((await botJson('botMobiles')).mobiles ?? [])
            .find((r) => r.cls.endsWith('BossTotem'));
    }
    check(!!boss && boss.type === 'Solid' && boss.enemy !== null,
        '⛓⛓⛓ AND THE UNWOKEN BOSS REPORTS `type = "Solid"` — the census row '
        + 'that said `collider: none` for twenty-two slices',
        boss ? `${boss.cls} type="${boss.type}" destroy=${boss.destroy} `
            + `enemy=${JSON.stringify(boss.enemy)}`
            : 'no BossTotem row');
    check(rows.every((r) => typeof r.x === 'number' && typeof r.vx === 'number'
        && 'destroy' in r && 'enemy' in r),
        'every row has the SAME SHAPE — raw fields, `enemy` present or null',
        `${rows.length} rows, keys: ${Object.keys(rows[0] ?? {}).join(' ')}`);

    // ── 4. ⛔ THE FADE — the freeze the field exists to open ──────────
    // ⚠ AND THE WINDOW HAS TO BE LONG ENOUGH TO DISCRIMINATE. Headless this
    // runtime is ~0.5 fps, so a four-second sample is one or two frames and
    // "the tick did not move" is true of a frozen game AND of a game that
    // simply has not had a frame yet — the probe's own weak-arm trap.
    const before = await botJson('botStatus');
    await page.waitForTimeout(60000);
    const after = await botJson('botStatus');
    check(after.dead_frames > before.dead_frames + 4 && after.tick <= before.tick + 2,
        '⛔⛔ the WAND FADE is freezing the game — dead frames climb, the tick does not',
        `tick ${before.tick} -> ${after.tick}, dead_frames ${before.dead_frames} -> `
        + `${after.dead_frames}. \`Wand.update\` writes `
        + '`Game.freezeObjects = alpha < 1` on every tick its gate is open, and the '
        + 'gate is the player\'s Y plus `hasAllTotemParts()` — so this freeze is the '
        + 'boot field doing its job, before anything has been touched.');
    await bot('botReset');
} finally {
    await browser.close();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${failed.length === 0 ? '✓ ALL CHECKS PASSED' : `⛔ ${failed.length} FAILED`}`
    + ` (${checks.length} checks)`);
if (failed.length > 0) process.exitCode = 1;
