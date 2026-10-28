#!/usr/bin/env node
/**
 * Seedling MOBILE FIT (slice `seedling-js-mobile-polish`, ⚖ the user 2026-10-27: *"On mobile, the bottom of the
 * Seedling panel is covered by the panel select bar at the bottom of the screen."*) — in a phone viewport, the
 * Seedling panel's bottom edge, and the game + touch strip inside it, are at or above the panel select bar's top edge.
 *
 * Each case is a FRESH browser context with phone emulation (`isMobile`, `hasTouch`), `?layout=mobile`, the JS
 * runtime, and the panel's `touchControls` setting forced on or off:
 *
 *   viewports  Pixel 7 412×915 and iPhone 13 390×844, portrait and landscape;
 *   arms       `plain` — the emulated viewport as it is;
 *              `taller` — the layout container forced `--taller-px` (default 56: a URL bar) TALLER than the visible
 *              screen, as on a browser where the container's `100dvh` is not the visible height (no `dvh`, a bottom
 *              toolbar). The bar is fixed to the visible bottom and the container is not, so a panel clamped by the
 *              CSS height alone ran that far under the bar; the measured reserve (`--mobile-bar-reserve`) must absorb it.
 *
 * Rows, per case (px, at the panel's scrollTop 0):
 *   instance  the mobile panel wrapper's bottom ≤ the bar's top;
 *   panel     the Seedling panel root's bottom ≤ the bar's top;
 *   game      max(the game stage's bottom, the touch strip's bottom) ≤ the bar's top.
 * Prints `PASS:`/`FAIL:` rows, a `ROW <case> {json}` measurement row each, and `ALL CHECKS PASSED` /
 * `N CHECK(S) FAILED` (exit 1). `--screens=<dir>` saves one screenshot per case.
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000).
 *
 * Run: node scripts/procgen/probe-seedling-mobile-fit.mjs [--host=http://localhost:8000] [--arms=plain,taller]
 *      [--taller-px=56] [--screens=<dir>] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** The preset, by its rules file (served path relative to `frontend/`). */
export const RULES_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';
/** The phone viewports (CSS px): Playwright's own Pixel 7 and iPhone 13 sizes. */
export const VIEWPORTS = Object.freeze([
    ['pixel7-portrait', 412, 915], ['pixel7-landscape', 915, 412],
    ['iphone13-portrait', 390, 844], ['iphone13-landscape', 844, 390],
]);
const TOUCH = Object.freeze(['on', 'off']);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-mobile-fit.mjs', kind: 'browser' });
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const ARMS = arg('arms', 'plain,taller').split(',').filter(Boolean);
    const TALLER = Number(arg('taller-px', '56'));
    const SCREENS = arg('screens', '');
    if (SCREENS) mkdirSync(SCREENS, { recursive: true });
    const browser = await chromium.launch();
    let failed = 0;
    const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`); if (!ok) failed += 1; };
    for (const arm of ARMS) {
        for (const [name, width, height] of VIEWPORTS) {
            for (const touch of TOUCH) {
                const tag = `${arm}/${name}/touch-${touch}`;
                // eslint-disable-next-line no-await-in-loop
                const m = await measure({ width, height, touch, taller: arm === 'taller' ? TALLER : 0, shot: SCREENS ? join(SCREENS, `${tag.replaceAll('/', '_')}.png`) : '' });
                console.log(`ROW ${tag} ${JSON.stringify(m)}`);
                if (m.error) { check(false, `${tag}: ${m.error}`); continue; }
                const barTop = m.bar.top;
                check(m.instance.bottom <= barTop, `${tag} instance: wrapper bottom ${m.instance.bottom} ≤ bar top ${barTop} (overlap ${m.instance.bottom - barTop})`);
                check(m.root.bottom <= barTop, `${tag} panel: Seedling panel bottom ${m.root.bottom} ≤ bar top ${barTop} (overlap ${m.root.bottom - barTop})`);
                const game = Math.max(m.stage.bottom, m.touch?.bottom ?? 0);
                check(game <= barTop, `${tag} game: game + strip bottom ${game} ≤ bar top ${barTop} (overlap ${game - barTop}; scale ${m.scale}, ${m.touch ? m.touch.placement : 'no strip'})`);
                if (touch === 'on') check(!!m.touch, `${tag}: the touch strip is shown`);
                else check(!m.touch, `${tag}: no touch strip`);
            }
        }
    }
    await browser.close();
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function measure({ width, height, touch, taller, shot }) {
        const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        try {
            await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}&layout=mobile`, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0, null, { timeout: 120000 });
            await page.waitForFunction(() => document.querySelector('.mobile-bottom-bar'), null, { timeout: 30000 });
            if (taller) {
                await page.addStyleTag({ content: `body.mobile-layout-active .mobile-layout-container { height: calc(100dvh + ${taller}px) !important; }` });
            }
            await page.evaluate(async (t) => {
                const sm = (await import('./app/core/settingsManager.js')).default;
                await sm.updateSetting('moduleSettings.flashPanel.runtime', 'js', { persist: false });
                await sm.updateSetting('moduleSettings.flashPanel.touchControls', t, { persist: false });
                const bus = (await import('./app/core/eventBus.js')).default;
                bus.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'tests');
            }, touch);
            await page.waitForFunction((t) => {
                const stage = document.querySelector('.flash-panel-stage');
                const strip = document.querySelector('.flash-touch-controls');
                return !!stage?.dataset.scale && (t === 'on' ? !!strip : !strip);
            }, touch, { timeout: 90000 });
            // the fit follows ResizeObservers: let two frames and the observers settle, then read
            await page.waitForTimeout(1500);
            const m = await page.evaluate(() => {
                const r = (el) => {
                    if (!el) return null;
                    const b = el.getBoundingClientRect();
                    return { top: Math.round(b.top * 10) / 10, bottom: Math.round(b.bottom * 10) / 10 };
                };
                const root = document.querySelector('.flash-panel-container');
                if (root) root.scrollTop = 0;
                const strip = document.querySelector('.flash-touch-controls');
                const container = document.querySelector('.mobile-layout-container');
                return {
                    inner: innerHeight,
                    reserve: container?.style.getPropertyValue('--mobile-bar-reserve') || null,
                    bar: r(document.querySelector('.mobile-bottom-bar')),
                    instance: r(root?.closest('.mobile-panel-instance')),
                    root: r(root),
                    stage: r(document.querySelector('.flash-panel-stage')),
                    scale: document.querySelector('.flash-panel-stage')?.dataset.scale ?? null,
                    touch: strip ? { ...r(strip), placement: strip.dataset.placement ?? null } : null,
                };
            });
            if (shot) await page.screenshot({ path: shot });
            return m;
        } catch (err) {
            return { error: String(err?.message ?? err).split('\n')[0] };
        } finally {
            await ctx.close();
        }
    }
}
