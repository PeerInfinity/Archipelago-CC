#!/usr/bin/env node
/**
 * probe-seedling-mask-lines — ⛓⛓⛓ seedling-fidelity-masks: THE SWING'S LINE OF SIGHT SAMPLES THE "Solid" PIXELMASKS
 * (`CONTACT_FIDELITY.pixelMaskSightLines`), PLAYED ON THE GAME AND COMPARED WITH THE MODEL TICK BY TICK.
 *
 * `Player.slash`'s `collideLine("Solid", x, y, v[i].x, v[i].y)` (`Player.as:917`) meets an OpenTree's opaque pixels
 * (L65). Each witness (`fidelityMasks.MASK_WITNESSES`) is played on a FRESH p4g page (headless, the logic-only channel);
 * every poll reads `botStatus` (the player, `slash.{tests,hits}`) and `botMobiles` (the `Bob` rows), and the model
 * replays the same tape with the key ON:
 *
 *   mask-l65-opentree   (a control) boot (192,40), swings: the line starts in the OpenTree's pixels and LANDS (type "Tree")
 *   mask-l65-wall       boot (216,72), the same: the line's first sample meets the Body Wall tile at (224,80)
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-mask-lines.mjs                       # every witness: build, play, compare
 *   node scripts/procgen/probe-seedling-mask-lines.mjs --only=mask-l65-wall
 *   node scripts/procgen/probe-seedling-mask-lines.mjs --record              # also write fixtures/mask-witness/<name>.json
 *   node scripts/procgen/probe-seedling-mask-lines.mjs --dump=85-90          # print both sides on those ticks
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { compareDrillWitness } from '../../frontend/modules/seedlingDemo/fidelityDrill.js';
import { MASK_WITNESS_DIR, MASK_WITNESSES, MASK_SWITCHES, maskModelSamples, maskTape }
    from '../../frontend/modules/seedlingDemo/fidelityMasks.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** One poll (`botStatus` + `botMobiles`), folded to a sample. */
export function maskSampleOf(s, m) {
    const rows = m.mobiles ?? [];
    return {
        t: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits ?? null, slash: s.slash ?? null,
        drills: rows.filter((r) => /Drill$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y, anim: r.anim, destroy: r.destroy,
            onScreen: r.on_screen, hitsTimer: r.enemy?.hits_timer ?? null })),
        chasers: rows.filter((r) => /(^|:)(Bob|BobSoldier)$/.test(r.cls))
            .map((r) => ({ tag: /BobSoldier$/.test(r.cls) ? 'bobsoldier' : 'bob', x: r.x, y: r.y })),
    };
}

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
        if (Number.isInteger(s.tick) && m.tick === s.tick) byTick.set(s.tick, maskSampleOf(s, m));
        if (s.finished) { status = s; break; }
    }
    if (!status) throw new Error('the tape never finished inside the deadline');
    return { status, samples: [...byTick.values()].filter((s) => s.t < tape.tick_count).sort((a, b) => a.t - b.t) };
}

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const only = arg('only')?.split(',') ?? null;
    const RECORD = process.argv.includes('--record');
        takeBoxLockOrExit({ name: 'probe-seedling-mask-lines.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const w of MASK_WITNESSES) {
        if (only && !only.includes(w.name)) continue;
        const tape = await maskTape(w);
        const model = await maskModelSamples(tape);
        const off = await maskModelSamples(tape, { ...MASK_SWITCHES, pixelMaskSightLines: false });
        check(`${w.name}: the model (key ON) replays the tape to its end`, model.error === null, model.error ?? '');
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
            for (const g of samples.filter((x) => x.t >= dump[0] && x.t <= dump[1])) {
                const m = model.samples[g.t];
                console.log(`      t${g.t} game p(${g.x}, ${g.y}) h${g.hits} drills ${JSON.stringify(g.drills)} chasers `
                    + `${JSON.stringify(g.chasers)}\n         model p(${m?.x}, ${m?.y}) h${m?.hits} drills `
                    + `${JSON.stringify(m?.drills)} chasers ${JSON.stringify(m?.chasers)}`);
            }
        }
        const bad = compareDrillWitness(samples, model.samples, tape.boot.level);
        check(`${w.name}: the game reproduces the model (key ON) at 0 px (player, chasers) on all ${samples.length} `
            + 'sampled tick(s)', bad.length === 0, bad.slice(0, 4).join('; '));
        const offBad = compareDrillWitness(samples, off.samples, tape.boot.level);
        if (w.control) check(`${w.name}: (a control) the key OFF reproduces the game too`, offBad.length === 0,
            offBad.slice(0, 2).join('; '));
        else check(`${w.name}: the key OFF leaves the game (the mask/line matters on this tape)`, offBad.length > 0,
            offBad.slice(0, 2).join('; '));
        const blocked = model.pressHits.filter((h) => /collideLine/.test(h.why ?? ''));
        console.log(`      ${w.name}: model (ON) refused lines ${blocked.map((h) => `t${h.t}:${h.why}`).join(' | ')}; `
            + `game slash ${JSON.stringify(samples.at(-1)?.slash)}`);
        if (RECORD) {
            mkdirSync(MASK_WITNESS_DIR, { recursive: true });
            const path = join(MASK_WITNESS_DIR, `${w.name}.json`);
            writeFileSync(path, `${JSON.stringify({ name: w.name, page: PAGE_NAME,
                recordedBy: 'scripts/procgen/probe-seedling-mask-lines.mjs --record',
                end: { level: status.level, tick: status.tick }, tape, samples })}\n`);
            console.log(`recorded ${path.slice(REPO.length + 1)} — ${samples.length} tick(s)`);
        }
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
