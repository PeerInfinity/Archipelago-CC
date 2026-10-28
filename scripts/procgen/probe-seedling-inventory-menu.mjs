#!/usr/bin/env node
/**
 * probe-seedling-inventory-menu — the GAME WITNESS for the V inventory menu (slice seedling-js-inventory-menu).
 *
 * ── THE QUESTION ──────────────────────────────────────────────────────
 * The JS runtime models a menu session as a HOLD: zero tape ticks, N frozen frames spent on the clock, and the
 * outcome written as `Main.primary` (an `equips` row at the tick after the open). Does the game agree, frame for
 * frame: the same `Main.primary` / `Main.secondary`, the same frozen-frame count, and the same stream after it?
 *
 * ── HOW, WITHOUT AN AS3 EDIT ──────────────────────────────────────────
 * A tape cannot DRIVE the menu (`Inventory.set open` is `Game.freezeObjects`, a Bot dead frame: the tick counter
 * pins and no span can reach the closing V). It CAN open it: the tape releases V on tick `OPEN_AT`, the menu opens
 * in that frame's tail, and the tape pins with `dead_frames` climbing. The probe then presses REAL keys on the
 * game's canvas (Down, X, V, the Flash input path the Bot does not touch), the menu closes, and the tape runs to
 * its end. `botStatus` reports `primary`, `secondary` and `dead_frames`; a CONTROL arm (the same tape without V)
 * gives the boot's own dead frames, so the hold is `dead − control dead`.
 *
 * The MODEL then replays the same tape and, at the boundary where the game froze (`ticksCompleted == OPEN_AT + 1`),
 * applies what the core would: `inventoryMenuWrite({primary, 1})` and `inventoryHold(hold)`. It compares the final
 * `primary`/`secondary`, the observation stream tick for tick, and the clock's dead frames (model) against the
 * game's `dead_frames` (the model's are the game's minus `BOOT_PRESWAP_FRAMES`, as on every chain boundary).
 *
 * Prints `ROW` measurements, `PASS:`/`FAIL:` rows, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED` (exit 1).
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Run: node scripts/procgen/probe-seedling-inventory-menu.mjs [--host=http://localhost:8000] [--wait-for-box=<sec>]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { headlessWebgpuArgs } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { parseTape } from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { createTapeStepper } from '../../frontend/modules/seedlingDemo/tapeRunner.js';
import { atlasLevelSource } from '../../frontend/modules/seedlingDemo/levelSource.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-inventory-menu.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE_NAME = process.env.SEEDLING_PAGE || JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8')).default
        || 'seedling_bot_ap_p4g';
    const WASM_DIR = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(WASM_DIR)) {
        console.log(`SKIP: no wasm artifact at ${WASM_DIR}`);
        process.exit(0);
    }

    const TICKS = 40;
    /** The tick whose frame RELEASES V: the menu opens in that frame's tail, and the tape pins after it. */
    const OPEN_AT = 12;
    const tapeFor = (withMenu) => ({
        tape_version: 4,
        game: 'seedling',
        name: withMenu ? 'probe-inventory-menu' : 'probe-inventory-menu-control',
        description: 'L86, sword + Fire granted (slots [0, 1]); V released on tick 12 (or not); idle.',
        boot: { level: 86, x: 56, y: 56 },
        noclip: false,
        noDamage: true,
        noHazards: [],
        grants: [{ level: 86, items: ['sword', 'fire'] }],
        persistence: [],
        equips: [],
        tick_count: TICKS,
        inputs: withMenu ? [{ key: 'inventory', from: OPEN_AT - 2, to: OPEN_AT }] : [],
    });

    let failures = 0;
    const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`); if (!ok) failures += 1; };

    const browser = await chromium.launch({ args: headlessWebgpuArgs({ enableFeatures: ['WebAssemblyExperimentalJSPI'] }) });

    async function runGame(tape, { menuKeys = null } = {}) {
        const page = await browser.newPage();
        const logs = [];
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const bot = (name, a) => page.evaluate(([n, x]) => String(window.__swfBridge.game[n](x)), [name, a]);
        const botJson = async (name, a) => JSON.parse(await bot(name, a));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
            const loaded = await bot('botLoadTape', JSON.stringify(tape));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await bot('botStart') !== 'ok') throw new Error('botStart refused');
            let pinned = null;
            const DEADLINE = Date.now() + 5 * 60 * 1000;
            for (;;) {
                const st = await botJson('botStatus');
                if (st.finished) break;
                if (Date.now() > DEADLINE) throw new Error(`deadline (tick ${st.tick}, dead ${st.dead_frames})`);
                if (menuKeys && !pinned && st.tick > OPEN_AT) {
                    // The tape is pinned on the menu's freeze: let the dead frames climb, then press the real keys.
                    const d0 = st.dead_frames;
                    await page.waitForTimeout(400);
                    const st2 = await botJson('botStatus');
                    pinned = { tick: st2.tick, deadBefore: d0, deadAfter: st2.dead_frames, primaryBefore: st2.primary };
                    console.log(`ROW pinned ${JSON.stringify(pinned)}`);
                    await page.click('#canvas').catch(() => {});
                    for (const key of menuKeys) {
                        await page.keyboard.down(key);
                        await page.waitForTimeout(150);
                        await page.keyboard.up(key);
                        await page.waitForTimeout(150);
                    }
                }
                await page.waitForTimeout(100);
            }
            const st = await botJson('botStatus');
            const drained = await botJson('botDrain');
            return { st, drained, pinned, logs };
        } finally {
            await page.close();
        }
    }

    /** The model: the same tape, and at the freeze's boundary the core's two calls. */
    function runModel(tape, { hold = 0, writes = [] } = {}) {
        let run = null;
        const stepper = createTapeStepper(parseTape(tape), { levelSource: atlasLevelSource(), onTick: (_t, _s, _h, r) => { run = r; } });
        let injected = false;
        let r = stepper.next();
        while (!r.done) {
            if (hold > 0 && !injected && run && run.ticksCompleted === OPEN_AT + 1) {
                for (const w of writes) run.inventoryMenuWrite(w);
                run.inventoryHold(hold);
                injected = true;
            }
            r = stepper.next();
        }
        return { result: r.value, run, injected };
    }

    try {
        const control = await runGame(tapeFor(false));
        console.log(`ROW control ${JSON.stringify({ dead: control.st.dead_frames, primary: control.st.primary, secondary: control.st.secondary, slots: control.st.inventory_slots })}`);
        const menu = await runGame(tapeFor(true), { menuKeys: ['ArrowDown', 'x', 'v'] });
        const hold = menu.st.dead_frames - control.st.dead_frames;
        console.log(`ROW menu ${JSON.stringify({ dead: menu.st.dead_frames, primary: menu.st.primary, secondary: menu.st.secondary, slots: menu.st.inventory_slots, hold })}`);
        check(menu.pinned && menu.pinned.tick === OPEN_AT + 1 && menu.pinned.deadAfter > menu.pinned.deadBefore,
            `the game PINNED the tape on the menu's freeze at tick ${OPEN_AT + 1} with dead frames climbing (${JSON.stringify(menu.pinned)})`);
        check(menu.st.finished && menu.st.tick === TICKS, `the real V closed the menu and the tape ran to its end (tick ${menu.st.tick}/${TICKS})`);
        check(menu.st.primary === 1 && control.st.primary === 0, `Down + X selected slot 1 in the game (primary ${control.st.primary} → ${menu.st.primary})`);
        check(menu.st.secondary === control.st.secondary, `C was not pressed: secondary unchanged (${menu.st.secondary})`);

        const modelControl = runModel(tapeFor(false));
        const model = runModel(tapeFor(true), { hold, writes: [{ kind: 'primary', slot: 1 }] });
        check(model.injected, `the model reached the freeze boundary (ticksCompleted ${OPEN_AT + 1}) and took the hold`);
        check(model.run.primary === menu.st.primary && model.run.secondary === menu.st.secondary,
            `model primary/secondary ${model.run.primary}/${model.run.secondary} = game ${menu.st.primary}/${menu.st.secondary}`);
        check(JSON.stringify(model.run.inventorySlots) === JSON.stringify(menu.st.inventory_slots),
            `model slots ${JSON.stringify(model.run.inventorySlots)} = game ${JSON.stringify(menu.st.inventory_slots)}`);
        const modelHold = model.run.deadFramesOwed - modelControl.run.deadFramesOwed;
        check(modelHold === hold, `the frozen frames: model hold ${modelHold} = game dead − control dead ${hold}`);
        const g = (menu.drained.ticks ?? []).map((o) => `${o.t}:${o.level}:${o.x}:${o.y}`);
        const m = model.result.ticks.map((o) => `${o.t}:${o.level}:${o.x}:${o.y}`);
        const firstDiff = g.findIndex((row, i) => row !== m[i]);
        check(g.length === m.length && firstDiff === -1,
            `the stream: ${m.length} model rows vs ${g.length} game rows${firstDiff >= 0 ? `, first diff at ${firstDiff}: game ${g[firstDiff]} model ${m[firstDiff]}` : ', identical'}`);
        // ⚠ NOT a time row: `botStatus.game_time` is a LIVE read (`Bot.as:2140`), not latched at `finished`, so it
        // keeps counting after the tape ends and a difference of two reads compares nothing. `dead_frames` IS latched
        // (counted only while armed), and it is the frozen-frame witness above. A latched end-of-tape `Game.time` is
        // a missing readout (the wasm rebuild queue), not something this probe can supply without an AS3 edit.
        console.log('ROW time NOT COMPARED: botStatus.game_time is live, not latched at finish; dead_frames is the witness');
        if (menu.logs.some((l) => /pageerror|\[error\]/.test(l))) console.log(`page errors: ${menu.logs.filter((l) => /pageerror|\[error\]/.test(l)).slice(-4).join(' | ')}`);
    } catch (e) {
        console.error(`PROBE FAILED: ${e.message}`);
        failures += 1;
    } finally {
        await browser.close();
    }
    console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
    process.exitCode = failures === 0 ? 0 : 1;
}
