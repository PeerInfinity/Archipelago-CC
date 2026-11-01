#!/usr/bin/env node
/**
 * probe-cloudberry-touch-up — **THE ON-SCREEN ↑ AT A CLOUDBERRY DOOR, TAPPED MANY TIMES, MISSES COUNTED**
 * (cloudberry P3a; P1b's one unexplained live miss: a touch ↑ at the end door that did not open the exit menu).
 *
 * The committed `cloudberry_sphere_worldgen` preset in the real frontend, the Cloudberry panel's game page with
 * its on-screen controls turned On, and REAL pointer input (Playwright's mouse on the page's `#touch` buttons, as
 * P1b's battery tapped them). Each tap is a trial: did the door's menu open within `--wait` ms? Variants:
 *
 *   first   the FIRST tap after the controls are switched On (they are switched Off and On before each trial) —
 *           the context of P1b's miss: bot parks the player at the end door, doors re-armed, 400 ms, tap
 *   end     the end door, the menu closed by its × and ↑ tapped again at once (the menu just closed)
 *   start   the start door after a reset (the level reconfigured: the player respawns there), re-armed, tap
 *   swap    after a region swap: ↓ in the menu chooses south → region_2_3 configures → back by the start door
 *           (↑ in its menu) → park at region_2_2's end door → tap
 *
 * A miss records the page's door state at the tap (`__cloudberryEmbed.status()`: doorArmed, startDoorArmed, the
 * bob, the input) and the touch layer's state. Prints a tally per variant; exits 1 when any tap missed.
 *
 *   node scripts/procgen/probe-cloudberry-touch-up.mjs [--port <n>] [--rounds <n per variant>] [--hold <ms>] [--wait <ms>] [--only first,end,start,swap]
 *
 * Needs the same-origin Cloudberry site (`node scripts/setup/fetch-cloudberry-site.mjs`, or `--link` a build) and a
 * dev server serving this tree; takes the box lock. Writes nothing.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { failOnCrash, totalLine } from './gateTotal.js';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-cloudberry-touch-up.mjs', kind: 'browser' });
    const argv = process.argv.slice(2);
    const arg = (name) => {
        const eq = argv.find((a) => a.startsWith(`${name}=`));
        if (eq) return eq.slice(name.length + 1);
        const i = argv.indexOf(name);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const PORT = Number(arg('--port') ?? process.env.TEST_PORT ?? 8000);
    const ROUNDS = Number(arg('--rounds') ?? 20);
    const HOLD = Number(arg('--hold') ?? 180);
    const WAIT = Number(arg('--wait') ?? 2000);
    const ONLY = new Set((arg('--only') ?? 'first,end,start,swap').split(','));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    if (!fs.existsSync(path.join(repoRoot, 'frontend/external/cloudberry/index.html'))) {
        console.error('REFUSED: no Cloudberry site at frontend/external/cloudberry — run: node scripts/setup/fetch-cloudberry-site.mjs');
        process.exit(2);
    }
    let failures = 0;
    failOnCrash(() => failures);
    const tally = {};
    const misses = [];

    const browser = await chromium.launch({ args: [...HEADLESS_LOGIC_ONLY_ARGS] });
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
        const logs = [];
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const seed = 'AP_14089154938208861744';
        const base = `http://localhost:${PORT}/frontend/`;
        await page.goto(`${base}?rules=${encodeURIComponent(`./presets/cloudberry_sphere_worldgen/${seed}/${seed}_rules.json`)}`);
        const frame = () => page.frames().find((f) => f.url().includes('/external/cloudberry/index.html') && f.url().includes('loadRegionEvent'));
        const game = (fn, a) => frame().evaluate(fn, a);
        const app = () => game(() => {
            const a = window.__cloudberryEmbed?.app;
            return a ? { region: a.config?.regionId ?? null, ok: !!a.playResult?.ok, configures: a.configures, menu: a.menu ?? null,
                platforms: a.itemsState?.platforms ?? [], bots: (a.events ?? []).filter((e) => e.kind === 'bot').length,
                lastBot: (a.events ?? []).filter((e) => e.kind === 'bot').at(-1) ?? null } : null;
        });
        const waitFor = async (desc, fn, ms = 120000) => {
            const t0 = Date.now();
            for (;;) {
                let v = null;
                try { v = await fn(); } catch { /* reloading */ }
                if (v) return v;
                if (Date.now() - t0 > ms) throw new Error(`timeout waiting for: ${desc}`);
                await page.waitForTimeout(100);
            }
        };
        const configured = (region, after = -1) => waitFor(`${region} configured`, async () => {
            const a = await app();
            return a?.region === region && a.ok && a.configures > after ? a : null;
        }, 180000);

        await configured('region_2_2');
        const build = await game(() => fetch('build-info.json').then((r) => r.json()).then((j) => j.build));
        console.log(`page build ${build}; ${ROUNDS} rounds per variant; hold ${HOLD} ms; a miss = no menu within ${WAIT} ms`);
        // Clouds held (the swap variant leaves by the south exit, which needs it).
        await page.evaluate(async () => {
            const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
            await proxy.addItemToInventory('Clouds', 1);
        });
        await waitFor('Cloud held in the page', async () => ((await app()).platforms.includes('Cloud') ? true : null), 30000);

        const touch = (on) => game((v) => { document.querySelector(`input[name="touch-mode"][value="${v}"]`).click(); return !document.getElementById('touch').hidden; }, on ? 'on' : 'off');
        const tap = async (sel, hold = HOLD) => {
            const b = await frame().locator(sel).boundingBox();
            if (!b) throw new Error(`no box for ${sel}`);
            await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
            await page.mouse.down();
            await page.waitForTimeout(hold);
            await page.mouse.up();
        };
        const park = async () => {
            const n = (await app()).bots;
            await game(() => window.__swfBridge.botWalkTo({ kind: 'portal', id: 'north' }, { door: 'end' }));
            const a = await waitFor('the bot parks at the end door', async () => { const x = await app(); return x.bots > n ? x : null; });
            if (a.lastBot?.result !== 'reached') throw new Error(`park: ${JSON.stringify(a.lastBot)}`);
        };
        const rearm = async () => { await game(() => window.__cloudberryEmbed.rearmDoors()); await page.waitForTimeout(400); };
        const trial = async (variant, door) => {
            const st = await game(() => window.__cloudberryEmbed.status());
            const t0 = Date.now();
            await tap('#touch [data-key="up"]');
            let opened = null;
            while (Date.now() - t0 < WAIT) {
                const a = await app();
                if (a.menu) { opened = a.menu; break; }
                await page.waitForTimeout(30);
            }
            const t = (tally[variant] ??= { taps: 0, misses: 0 });
            t.taps++;
            if (opened?.door !== door) {
                t.misses++;
                const touchState = await game(() => ({ hidden: document.getElementById('touch').hidden, down: [...document.querySelectorAll('#touch .down')].map((b) => b.dataset.key) }));
                misses.push({ variant, door, opened, status: { doorArmed: st.doorArmed, startDoorArmed: st.startDoorArmed, bob: st.bob, input: st.input, bot: st.bot }, touchState });
                console.log(`  MISS ${variant} #${t.taps}: ${JSON.stringify(misses.at(-1))}`);
            }
            return opened;
        };
        const closeMenu = async () => {
            if (!(await app()).menu) return;
            await tap('#exit-menu .close', 80);
            await waitFor('menu closed', async () => (!(await app()).menu ? true : null), 5000);
        };

        if (ONLY.has('first')) {
            for (let i = 0; i < ROUNDS; i++) {
                await touch(false);
                await park();
                await rearm();
                if (!(await touch(true))) throw new Error('the touch layer did not show');
                await trial('first', 'end');
                await closeMenu();
            }
        }
        if (ONLY.has('end')) {
            await touch(true);
            await park();
            await rearm();
            for (let i = 0; i < ROUNDS; i++) {
                await trial('end', 'end');
                await closeMenu();   // the page re-arms on close; ↑ again at once
            }
        }
        if (ONLY.has('start')) {
            await touch(true);
            for (let i = 0; i < ROUNDS; i++) {
                // The start door offers nothing in region_2_2 (no way back): go to region_2_3 first.
                const a = await app();
                if (a.region !== 'region_2_3') {
                    await park(); await rearm();
                    await trial('(to region_2_3)', 'end');
                    await tap('#touch [data-key="down"]', 150);
                    await configured('region_2_3', a.configures);
                }
                const b = await app();
                await game(() => window.__swfBridge.reset());
                await configured('region_2_3', b.configures);
                await rearm();
                await trial('start', 'start');
                await closeMenu();
            }
        }
        if (ONLY.has('swap')) {
            await touch(true);
            for (let i = 0; i < ROUNDS; i++) {
                let a = await app();
                if (a.region !== 'region_2_2') {
                    await rearm();
                    await trial('(start door back)', 'start');
                    await tap('#touch [data-key="up"]', 150);
                    await configured('region_2_2', a.configures);
                }
                await park(); await rearm();
                await trial('swap', 'end');
                a = await app();
                await tap('#touch [data-key="down"]', 150);
                await configured('region_2_3', a.configures);
            }
        }
        const errors = logs.filter((l) => !l.includes('unwind'));
        console.log('\ntally:');
        for (const [v, t] of Object.entries(tally)) console.log(`  ${v}: ${t.misses} miss(es) in ${t.taps} taps`);
        const counted = Object.entries(tally).filter(([v]) => !v.startsWith('('));
        const taps = counted.reduce((s, [, t]) => s + t.taps, 0);
        const missed = counted.reduce((s, [, t]) => s + t.misses, 0) + Object.entries(tally).filter(([v]) => v.startsWith('(')).reduce((s, [, t]) => s + t.misses, 0);
        console.log(`TOTAL: ${missed} miss(es) in ${Object.values(tally).reduce((s, t) => s + t.taps, 0)} taps (${taps} in the four variants); page errors ${errors.length}`);
        if (missed > 0 || errors.length > 0) failures++;
    } catch (e) {
        console.log(`crashed: ${e.stack ?? e}`);
        failures++;
    } finally {
        await browser.close();
    }
    console.log(totalLine(failures));
    process.exit(failures === 0 ? 0 : 1);
}
