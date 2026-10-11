#!/usr/bin/env node
/**
 * probe-seedling-pushblock-weapon — does a SWORD slash move a
 * `PushableBlockSpear`, or only a spear thrust? The game and the model, side
 * by side, on the R4 L65 probe's own stance.
 *
 * Seedling fidelity PUSHBLOCK (wave 11), D1. `pushables.js` and R4 §8.10 say
 * "a SWORD slash pushes a PushableBlockSpear too", from a reading of
 * `genericHit`'s ORDER (the Spear arm is tested before the Fire arm and
 * returns before `moveTypes`). Every R4 recording pressed with the SPEAR
 * (`probe-seedling-l65.mjs`: `equips: [{t: 0, slot: 1}]`), so the sword half
 * of the claim was never witnessed.
 *
 * THE SOURCE READING THIS TESTS. The Spear arm is
 *   `(e as PushableBlockSpear).hit(new Point(int(spearDirection % 2 == 0) *
 *    (spearDirection - 1), int(spearDirection % 2 == 1) * (2 - spearDirection)), t, true)`
 * (`Player.as:1123`) — it reads `spearDirection`, NOT `direction`. And
 * `set spearing` writes `spearDirection = -1` FIRST on every call
 * (`Player.as:814`), setting it to `direction` only on a thrust that starts
 * (`:820`); the one other writer is a GHOST-sword slash (`:921`). So during a
 * plain sword slash `spearDirection` is -1, `-1 % 2` is -1 in AS3, `p` is
 * (0, 0), and the relative arm's `tile = getPos() - p * 16` is the block's OWN
 * centre: the hit lands and the block does not move.
 *
 * THE DISCRIMINATOR. Two arms, one tape each, identical but for the slot:
 * boot one cell EAST of `pushableblockspear@176,128` (11,8), walk W into its
 * face (baseline stop), press `primary` once facing W, walk W again.
 *   Δx ≈ 16   the block moved one tile W
 *   Δx ≈ 0    the press did not move it
 * Arm SPEAR is R4's own probe (Δx ≈ 16 on the game, recorded 2026); arm SWORD
 * is the question. Each arm runs on the GAME (p4f, headless) and on the MODEL
 * (`runTape` over the atlas), and the table prints all four.
 *
 * Run (needs a static server over this tree):
 *   SEEDLING_PORT=9580 node scripts/procgen/probe-seedling-pushblock-weapon.mjs
 *   node scripts/procgen/probe-seedling-pushblock-weapon.mjs --model-only
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { headlessWebgpuArgs } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
// ⛓ THE BOX LOCK (R9 P3b): this instrument drives a browser, so it takes the box before it starts — the
// `--model-only` arm too (it costs nothing, and a conditional taker is one more row to declare).
takeBoxLockOrExit({ name: 'probe-seedling-pushblock-weapon.mjs', kind: 'browser' });

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const MODEL_ONLY = process.argv.includes('--model-only');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
const PAGE_PORT = process.env.SEEDLING_PORT || '8000';
const WASM_DIR = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:${PAGE_PORT}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

const PRESS_AT = 30;
const TICKS = 80;
/** `grants` order is the slot order: sword is slot 0, spear slot 1 (R4's probe). */
const ARMS = Object.freeze([
    { name: 'sword', slot: 0 },
    { name: 'spear', slot: 1 },
]);

const tapeFor = (arm) => ({
    tape_version: 4,
    game: 'seedling',
    name: `probe-l65-push-west-${arm.name}`,
    description: `Baseline stop at the block, one ${arm.name} press facing W, re-advance.`,
    boot: { level: 65, x: 192, y: 128 },
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'lava', 'ice', 'waterfall'],
    grants: [{ level: 65, items: ['sword', 'spear'] }],
    persistence: [],
    equips: [{ t: 0, slot: arm.slot }],
    tick_count: TICKS,
    inputs: [
        { key: 'left', from: 5, to: 25 },
        { key: 'primary', from: PRESS_AT, to: PRESS_AT + 1 },
        { key: 'left', from: 40, to: 75 },
    ],
});

const deltaOf = (ticks) => {
    const xAt = (t) => ticks.find((o) => o.t === t)?.x;
    const baseline = xAt(28);
    const after = xAt(78);
    return { baseline, after, delta: baseline - after };
};

const verdict = (d) => (Math.abs(d) < 1 ? 'DID NOT MOVE'
    : (d > 12 && d < 20 ? 'ONE TILE W' : 'UNEXPECTED'));

const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const levelSource = atlasLevelSource();
const rows = [];
for (const arm of ARMS) {
    const { ticks } = runTape(tapeFor(arm), { levelSource });
    rows.push({ arm: arm.name, side: 'model', ...deltaOf(ticks) });
}

if (!MODEL_ONLY) {
    if (!existsSync(WASM_DIR)) {
        console.log(`SKIP game arms: no wasm artifact at ${WASM_DIR}`);
    } else {
        for (const arm of ARMS) {
            const browser = await chromium.launch({
                args: headlessWebgpuArgs({ enableFeatures: ['WebAssemblyExperimentalJSPI'] }),
            });
            const page = await browser.newPage();
            const logs = [];
            page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
            page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
            const bot = (name, a) => page.evaluate(
                ([n, x]) => String(window.__swfBridge.game[n](x)), [name, a]);
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
                const loaded = await bot('botLoadTape', JSON.stringify(tapeFor(arm)));
                if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
                if (await bot('botStart') !== 'ok') throw new Error('botStart refused');
                const DEADLINE = Date.now() + 10 * 60 * 1000;
                for (;;) {
                    const st = await botJson('botStatus');
                    if (st.finished) break;
                    if (st.error) throw new Error(`game error: ${st.error}`);
                    if (Date.now() > DEADLINE) throw new Error('deadline');
                    await page.waitForTimeout(500);
                }
                const drained = await botJson('botDrain');
                rows.push({ arm: arm.name, side: 'game', ...deltaOf(drained.ticks ?? []) });
            } catch (e) {
                console.error(`GAME ARM ${arm.name} FAILED: ${e.message}`);
                console.error(logs.slice(-25).join('\n'));
                process.exitCode = 1;
            } finally {
                await browser.close();
            }
        }
    }
}

console.log('probe-seedling-pushblock-weapon — L65 pushableblockspear@176,128, one press facing W');
console.log('  arm    side   baseline x   after x   Δx      verdict');
for (const r of rows) {
    console.log(`  ${r.arm.padEnd(6)} ${r.side.padEnd(6)} ${String(r.baseline).padEnd(12)} `
        + `${String(r.after).padEnd(9)} ${r.delta.toFixed(2).padEnd(7)} ${verdict(r.delta)}`);
}
for (const arm of ARMS) {
    const m = rows.find((r) => r.arm === arm.name && r.side === 'model');
    const g = rows.find((r) => r.arm === arm.name && r.side === 'game');
    if (!g) continue;
    const agree = verdict(m.delta) === verdict(g.delta);
    console.log(`  ${arm.name}: model ${verdict(m.delta)} / game ${verdict(g.delta)} — `
        + `${agree ? 'AGREE' : '⛔ DISAGREE'} (after-x Δ ${(m.after - g.after).toFixed(3)} px)`);
    if (!agree) process.exitCode = 1;
}
