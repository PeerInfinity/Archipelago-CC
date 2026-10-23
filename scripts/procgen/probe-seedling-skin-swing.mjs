#!/usr/bin/env node
/**
 * probe-seedling-skin-swing — ⛓⛓⛓ seedling-fidelity-skinswing: DOES THE GAME LAND THE TWO ART-STANDS' SWINGS?
 *
 * `seedlingEnemySkin.test.js`'s stands `lavarunner-L71` and `bulb-L74` (the `FIGHT` keys, 300 ticks) run with
 * `pixelMaskSightLines` OFF since the MASKS flip, because with it ON the model's chaser line of sight (`Player.as:917`)
 * refuses every swing. Each witness (`fidelitySkinSwing.SKINSWING_WITNESSES`) is played on a FRESH p4g page (headless,
 * the logic-only channel); every poll reads `botStatus` (the player, `slash.{tests,hits}`) and `botMobiles` (the
 * chaser rows: position, `enemy.hits`, anim), and the model replays the same tape with the key ON and OFF:
 *
 *   skinswing-l71-lavarunner   L71 boot (96,200), FIGHT, 300 t
 *   skinswing-l74-bulb         L74 boot (80,100), FIGHT, 300 t
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-skin-swing.mjs                       # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-skin-swing.mjs --only=skinswing-l74-bulb
 *   node scripts/procgen/probe-seedling-skin-swing.mjs --record              # also write fixtures/skinswing-witness/<name>.json
 *   node scripts/procgen/probe-seedling-skin-swing.mjs --dump=1-12           # print the game and both model arms on those ticks
 *   node scripts/procgen/probe-seedling-skin-swing.mjs --boot=71,72,208      # an ad-hoc FIGHT stand (300 t; not recordable)
 * Prints the game's hit ticks beside each model arm's, the first diverging tick per arm, `PASS:`/`FAIL:` rows and
 * `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { SKINSWING_WITNESS_DIR, SKINSWING_WITNESSES, compareSkinSwing, hitEvents, skinSwingModelSamples,
    skinSwingSampleOf, skinSwingTape } from '../../frontend/modules/seedlingDemo/fidelitySkinSwing.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

async function playOnGame(page, tapeJson) {
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const tape = parseTape(JSON.stringify(tapeJson));
    const bot = (n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge.game;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    const started = await bot('botStart');
    if (started !== 'ok') throw new Error(`botStart: ${started}`);
    const byTick = new Map();
    const deadline = Date.now() + 600000;
    let status = null;
    while (Date.now() < deadline) {
        const raw = await page.evaluate(() => {
            const g = window.__swfBridge.game;
            return [String(g.botStatus()), String(g.botMobiles())];
        });
        const s = JSON.parse(raw[0]);
        const m = JSON.parse(raw[1]);
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, skinSwingSampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

/** The game's bodies have no placement id: key a body by its tag and its order in the first sample's rows. */
const gameKey = (c, i, s) => `${c.tag}#${s.chasers.filter((x, j) => j < i && x.tag === c.tag).length}`;
const fmtHits = (ev) => ev.map((e) => `t${e.t}:${e.key}=${e.hits}`).join(' ') || '(none)';

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const only = arg('only')?.split(',') ?? null;
    const RECORD = process.argv.includes('--record');
    takeBoxLockOrExit({ name: 'probe-seedling-skin-swing.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const adHoc = arg('boot')?.split(',').map(Number) ?? null;
    const witnesses = adHoc ? [{ name: `skinswing-adhoc-l${adHoc[0]}-${adHoc[1]}-${adHoc[2]}`,
        boot: { level: adHoc[0], x: adHoc[1], y: adHoc[2] }, n: 300, adHoc: true }] : SKINSWING_WITNESSES;
    for (const w of witnesses) {
        if (only && !only.includes(w.name)) continue;
        const tape = await skinSwingTape(w);
        const on = await skinSwingModelSamples(tape, { pixelMaskSightLines: true });
        const off = await skinSwingModelSamples(tape, { pixelMaskSightLines: false });
        const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
        let played;
        try {
            const page = await browser.newPage();
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
                await page.waitForTimeout(250);
            }
            await assertLogicOnlyChannel(page);
            played = await playOnGame(page, tape);
        } finally {
            await browser.close();
        }
        const { status, samples } = played;
        const dump = arg('dump')?.split('-').map(Number) ?? null;
        if (dump) {
            const f = (s) => (s ? `p(${s.x}, ${s.y}) h${s.hits} ${s.chasers.map((c) => `${c.id ?? c.tag}(${c.x},${c.y} h${c.hits}`
                + `${c.anim ? ` ${c.anim}` : ''}${c.dying ? ' D' : ''})`).join(' ')}` : '-');
            for (const g of samples.filter((x) => x.t >= dump[0] && x.t <= dump[1])) {
                console.log(`      t${g.t} game ${f(g)} slash ${JSON.stringify(g.slash)}\n         ON  ${f(on.samples[g.t])}`
                    + `\n         OFF ${f(off.samples[g.t])}`);
            }
        }
        const gHits = hitEvents(samples, gameKey);
        const mKey = (c) => c.id;
        console.log(`      ${w.name}: game hits ${fmtHits(gHits)}`);
        console.log(`      ${w.name}: model ON hits ${fmtHits(hitEvents(on.samples, mKey))}${on.error ? ` [ON error: ${on.error.slice(0, 120)}]` : ''}`);
        console.log(`      ${w.name}: model OFF hits ${fmtHits(hitEvents(off.samples, mKey))}${off.error ? ` [OFF error: ${off.error.slice(0, 120)}]` : ''}`);
        const gDie = samples.reduce((n, s) => n + s.chasers.filter((c) => c.anim === 'die').length, 0);
        console.log(`      ${w.name}: game 'die'-anim body-ticks ${gDie}; game slash ${JSON.stringify(samples.at(-1)?.slash)}; `
            + `end level ${status.level} tick ${status.tick}`);
        const onBad = compareSkinSwing(samples, on.samples);
        const offBad = compareSkinSwing(samples, off.samples.slice(0, off.error ? off.samples.length : undefined));
        console.log(`      ${w.name}: ON first divergence ${onBad[0] ?? '(none)'} (${onBad.length} row(s))`);
        console.log(`      ${w.name}: OFF first divergence ${offBad[0] ?? '(none)'} (${offBad.length} row(s))`);
        check(`${w.name}: the game played ${samples.length} sampled tick(s)`, samples.length > w.n - 20);
        if (RECORD && !w.adHoc) {
            mkdirSync(SKINSWING_WITNESS_DIR, { recursive: true });
            const path = join(SKINSWING_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, stand: w.stand, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-skin-swing.mjs --record',
                end: { level: status.level, tick: status.tick }, tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
