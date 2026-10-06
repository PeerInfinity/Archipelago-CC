#!/usr/bin/env node
/**
 * Seedling RESTART KEEPS WHAT THE PLAYER HOLDS — the Menu panel's Restart (the warp to `seedlingStartSpawn`, a
 * `new Game(level, x, y)`) changes no held item, no slot ORDER (session state, acquisition order) and no key, in
 * the game's own readouts, gameState's and the AP side's; on the GAME (wasm, default build) and on the JS runtime.
 * `seedling_playthrough` loaded by `?rules=`, headless logic-only, under the box lock; every session on a FRESH page.
 *
 *   W / J  (wasm / JS — the same rows):
 *     1. the new game stands in the start region;
 *     2. three AP items are granted IN ORDER (`stateManagerProxy.addItemToInventory`): Fire, the Sword, the Red Key
 *        — the first two are slot items (the game appends slots in acquisition order), the third a boss key;
 *     3. an AP move into `level_13` (the binding's arrival teleports the game there);
 *     4. BEFORE: the game's readout (items `hasFire`/`hasSword`, the slot array + primary, the keys: wasm
 *        `botStatus.save.keys`, JS `run.keys`, and the declared `keyMask`), gameState's region and the AP inventory;
 *     5. the Menu panel's Restart BUTTON; the player lands at the start;
 *     6. AFTER: the same readouts — each must EQUAL its BEFORE (the Restart neither drops nor reorders anything).
 *
 *   ⚠ THE KEY DELIVERY GAP (measured 2026-10-06, the wave-6 consumer slice's Part 0): the AP's Red Key reaches
 *   NEITHER runtime's game — `games/seedling.json` maps it to `key0`, which has no item write, and `Main.hasKey`
 *   has no bridge setter. The probe records it (`ROW <S> key delivery`) and asserts it only with
 *   `--expect-key-delivered` (the key-delivery slice's row). The Restart rows above hold either way.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build (the
 * `flashPanel/wasm` submodule), or W SKIPs.
 *
 * Run: node scripts/procgen/probe-seedling-restart-held-items.mjs [--host=http://localhost:8000] [--only=W,J]
 *      [--expect-key-delivered] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay, slotBlockOf } from './seedlingRoomPlay.js';

argvHelp(import.meta.url);

/** The preset, by its rules file (served path relative to `frontend/`). */
export const RULES_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';
/** The AP items granted, in this order: two slot items, then a boss key. */
export const GRANTS = Object.freeze(['Fire', 'Progressive Sword', 'Red Key']);
/** The JS runtime's page (`flashPanelUI.JS_RUNTIME_PAGE`'s file name). */
const JS_PAGE = 'jsRuntime.html';

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-restart-held-items.mjs', kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const SESSIONS = arg('only', 'W,J').split(',').filter(Boolean);
    const EXPECT_KEY = process.argv.includes('--expect-key-delivered');
    const PRESET = JSON.parse(readFileSync(join(REPO, 'frontend', RULES_PATH), 'utf8'));
    const START = PRESET.regions['1'].Menu.exits[0].connected_region;
    const SIDECARS = PRESET.preset_sidecars['1'];
    const AWAY = Object.keys(SIDECARS).find((r) => SIDECARS[r].playable_payload?.level === 13);
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    const haveWasm = !!WASM_PAGE && existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', WASM_PAGE));
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    for (const S of SESSIONS) {
        if (S === 'W' && !haveWasm) { console.log(`SKIP: W — seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`); continue; }
        console.log(`INFO: ── session ${S} (a fresh page) ──`);
        // eslint-disable-next-line no-await-in-loop
        failed += await runSession(S);
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession(S) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: S === 'J' ? JS_PAGE : WASM_PAGE, logs, name: `rh-${S}` });
        const { check, waitFor } = rp;
        const out = (tag, o) => console.log(`ROW ${S} ${tag} ${JSON.stringify(o)}`);

        /** Every readout a row compares, in one page round trip (either runtime). */
        const snap = () => page.evaluate(async () => {
            const mod = await import('./modules/flashPanel/index.js');
            const p = mod.getActivePanelInstance();
            const surface = p?.seedlingPlaybackSurface?.() ?? null;
            const g = mod.getSeedlingRegionGlue();
            const game = g?.adapter?._getFlash?.() ?? null;
            const parse = (f) => { try { const raw = f(); return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; } };
            const st = parse(() => game?.botStatus?.());
            const rs = parse(() => game?.readState?.());
            const run = surface?.jsRuntime?.run ?? null;
            const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
            const inv = proxy.getLatestStateSnapshot?.()?.inventory ?? {};
            return {
                region: window.centralRegistry?.getPublicFunction('gameState', 'getCurrentRegion')?.() ?? null,
                binding: g?.binding ? { region: g.binding.region, restarts: g.binding.restarts } : null,
                level: st?.level ?? null,
                game: {
                    hasFire: rs?.hasFire ?? null,
                    hasSword: rs?.hasSword ?? null,
                    keyMask: rs?.keyMask ?? null,
                    // the slot ORDER: the wasm game's readout, else the JS run's own array
                    slots: Array.isArray(st?.inventory_slots) ? st.inventory_slots : (run ? [...(run.inventorySlots ?? [])] : null),
                    primary: st?.primary ?? (run?.state?.primary ?? null),
                    keys: Array.isArray(st?.save?.keys) ? st.save.keys.flatMap((v, i) => (v ? [i] : []))
                        : (run ? [...(run.keys ?? [])].sort((a, b) => a - b) : null),
                },
                ap: Object.fromEntries(Object.entries(inv).filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b))),
            };
        });
        const settledAt = (pred, desc, ms = 30000) => waitFor(desc, async () => { const s = await snap(); return pred(s) ? s : null; }, ms);

        async function bootWasm() {
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(WASM_PAGE)));
            await rp.waitFor('start button enabled', () => rp.gameFrame().evaluate(() => {
                const b = document.getElementById('btn-start');
                return !!b && !b.disabled;
            }));
            await rp.gameFrame().click('#btn-start');
            await assertLogicOnlyChannel(rp.gameFrame());
        }
        async function bootJs() {
            await page.evaluate(async () => {
                const sm = (await import('./app/core/settingsManager.js')).default;
                await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
            });
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor('JS runtime iframe mounted', async () => page.frames().some((fr) => fr.url().includes(JS_PAGE)), 60000);
        }
        async function pressRestart() {
            await page.evaluate(async () => {
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'menuPanel' }, 'tests');
            });
            await rp.waitFor('the Restart button is visible', () => page.evaluate(() => {
                const b = document.querySelector('.menu-panel-restart-button');
                return !!b && b.offsetParent !== null;
            }), 20000);
            await page.click('.menu-panel-restart-button');
        }
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

        try {
            await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
            if (S === 'J') await bootJs(); else await bootWasm();
            await rp.waitFor('the AP load finished', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                return !!p?._apLoadResult;
            }), 180000);

            // 1. THE NEW GAME.
            const born = await settledAt((s) => s.binding?.region === START && s.level === 0, 'the new game stands in the start region', 60000);
            await page.waitForTimeout(1500);
            out('new game', await snap());
            check(`${S}: the new game stands in the start region "${START}"`, !!born);

            // 2. THE GRANTS, in order, each landed before the next (the slot order is acquisition order).
            for (const item of GRANTS) {
                // eslint-disable-next-line no-await-in-loop
                await page.evaluate(async (name) => {
                    const { default: proxy } = await import('./modules/stateManager/stateManagerProxySingleton.js');
                    await proxy.addItemToInventory(name);
                }, item);
                // eslint-disable-next-line no-await-in-loop
                await settledAt((s) => (s.ap[item] ?? 0) > 0, `${item} in the AP inventory`, 15000);
            }
            const granted = await settledAt((s) => s.game.hasFire === true && s.game.hasSword === true
                && (s.game.slots?.length ?? 0) >= 2, 'Fire and the Sword landed in the game (two slots)', 20000).catch(() => null);
            await page.waitForTimeout(1500);
            out('granted', await snap());
            check(`${S}: the two slot items landed in the game (hasFire, hasSword, two slots)`, !!granted,
                JSON.stringify((await snap()).game));

            // 3. AWAY: an AP move into level 13.
            await page.evaluate(async ({ from, to }) => {
                const d = (await import('./modules/flashPanel/index.js')).getDispatcher();
                d.publish('user:regionMove', { sourceRegion: from, targetRegion: to, exitName: null, source: 'probe-restart-held-items' },
                    { initialTarget: 'bottom' });
            }, { from: START, to: AWAY });
            await settledAt((s) => s.region === AWAY && s.level === 13, `the player in ${AWAY}`, 30000);
            await page.waitForTimeout(1500);

            // 4. BEFORE.
            const before = await snap();
            out('before', before);

            // 5. RESTART.
            await pressRestart();
            const back = await settledAt((s) => s.region === START && s.binding?.region === START && s.level === 0,
                'the Restart landed at the start', 30000).catch(() => null);
            await page.waitForTimeout(1500);

            // 6. AFTER.
            const after = await snap();
            out('after', after);
            check(`${S}: Restart landed in the start region (one restart)`, !!back && after.binding?.restarts === 1,
                JSON.stringify({ region: after.region, binding: after.binding }));
            check(`${S}: Restart keeps the game's ITEMS (hasFire, hasSword)`,
                before.game.hasFire === true && before.game.hasSword === true
                    && after.game.hasFire === before.game.hasFire && after.game.hasSword === before.game.hasSword,
                JSON.stringify({ before: before.game, after: after.game }));
            check(`${S}: Restart keeps the slot ORDER (the array and the primary)`,
                Array.isArray(before.game.slots) && before.game.slots.length >= 2
                    && same(after.game.slots, before.game.slots) && after.game.primary === before.game.primary,
                JSON.stringify({ before: [before.game.slots, before.game.primary], after: [after.game.slots, after.game.primary] }));
            check(`${S}: Restart keeps the game's KEYS (the key set and keyMask)`,
                Array.isArray(before.game.keys) && same(after.game.keys, before.game.keys) && after.game.keyMask === before.game.keyMask,
                JSON.stringify({ before: [before.game.keys, before.game.keyMask], after: [after.game.keys, after.game.keyMask] }));
            check(`${S}: Restart keeps the AP inventory`, same(after.ap, before.ap) && GRANTS.every((i) => (after.ap[i] ?? 0) > 0),
                JSON.stringify({ before: before.ap, after: after.ap }));

            // THE KEY DELIVERY GAP — recorded; asserted only when asked (the key-delivery slice).
            const delivered = (after.game.keyMask & 1) === 1 && (after.game.keys ?? []).includes(0);
            out('key delivery', { apRedKey: after.ap['Red Key'] ?? 0, gameKeys: after.game.keys, keyMask: after.game.keyMask, delivered });
            if (EXPECT_KEY) {
                check(`${S}: the AP's Red Key reached the game (key 0 held, keyMask bit 0)`, delivered, JSON.stringify(after.game));
            } else if (!delivered) {
                console.log(`INFO: ${S}: KNOWN GAP — the AP holds the Red Key and the game does not (key0 has no item write; `
                    + 'the key-delivery slice owns it; --expect-key-delivered asserts it)');
            }
            console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s)`);
        } catch (e) {
            check(`${S}: fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`PAGE LOGS (last 30):\n${logs.slice(-30).join('\n')}`);
        }
        await page.close();
        return rp.failures();
    }
}
