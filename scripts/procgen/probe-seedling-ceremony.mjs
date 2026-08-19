#!/usr/bin/env node
/**
 * probe-seedling-ceremony — walk the player onto a real pickup and watch
 * what the game does. `Bot.autoAdvance`'s FIRST LIVE FIRE.
 *
 * Region-atlas Phase 8, subtractive ladder rung R3, slice 0. Brief:
 * `CC/docs/plans/seedling-bot-r3-opus-kickoff.md` §3 ("ceremony probe
 * BEFORE the batch").
 *
 * ── WHY THIS RUNS AGAINST THE EXISTING BUILD ──────────────────────────
 *
 * `autoAdvance` has been compiled in since R0 and has never fired: every
 * route on the ladder avoids every ceremony, and `saw_auto_advance == 0`
 * is asserted on all 34 committed fixtures. R3 is the rung that walks onto
 * a pickup for real, so the first thing to find out is whether the feature
 * that was shipped dark actually works — BEFORE the one AS3 batch is
 * compiled, so that a defect in it rides that batch instead of forcing a
 * second ten-minute pipeline run.
 *
 * The ceremony, from source:
 *   `Pickup.update` collides with the player -> `pick_up()` sets
 *   `Game.freezeObjects` and counts `specialTimer` down from 150 -> at zero
 *   it spawns a temporary `NPC` with the item's text -> `NPC.talk()` reads
 *   `Input.released(p.keys[6])` (X, 88) on FROZEN frames -> pages advance ->
 *   the NPC removes itself, the freeze lifts, `removeSelf()` runs
 *   `removed()`: the property write, `Game.setPersistence`, and — for the
 *   SWORD ONLY — `FP.world.add(new Help(3))`.
 *
 * ⚠ TWO PREDICTED DEFECTS, both from reading, both to be confirmed here:
 *
 * 1. `Sword.removed()`'s `Help(3)` is NOT gated by `Inventory.help` (only
 *    `Inventory.as:158` is), it holds `Game.freezeObjects` until
 *    `Input.pressed(Key.X)`, and `autoAdvance` returns early on it because
 *    it gates on `Game.talking` and a `Help` is not an NPC. Predicted:
 *    the sword tape DEADLOCKS with `dead_frames` climbing forever.
 * 2. `autoAdvance` dispatches KEY_DOWN on phase 0 and KEY_UP on phase 1.
 *    If the edge that ends the freeze is the PRESS, the next frame is live,
 *    `autoAdvancePhase` resets, and the KEY_UP is never dispatched —
 *    leaving X held down for the rest of the run.
 *
 * The `--pickup=torch` variant exists for a third question: `TorchPickup`
 * and `HealthPickup` are the only two collected items whose `removed()`
 * calls `Main.unlockMedal`, which reaches the Newgrounds API. A grant never
 * ran `removed()`, so that call has never executed in the recompiled
 * runtime at all.
 *
 * Run: node scripts/procgen/probe-seedling-ceremony.mjs
 *      node scripts/procgen/probe-seedling-ceremony.mjs --pickup=torch
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b';
const WASM_DIR = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

if (!existsSync(WASM_DIR)) {
    console.log(`SKIP: no wasm artifact at ${WASM_DIR}`);
    process.exit(0);
}

/**
 * The probes, each a boot position and a single hold.
 *
 * Hand-authored rather than driver-synthesized on purpose: the driver
 * treats every pickup as an AVOID volume (a walked-over pickup deadlocked
 * the tape at every rung before this one), so asking it to plan INTO one
 * is asking it to refuse. The geometry is read off the extract —
 * `sword@48,48` in L10's 7x7 room, walkable from (48,80) straight up, with
 * the room's two teleporters at tiles (3,1) and (3,6) and the hold stopped
 * well short of the first.
 */
const PROBES = {
    sword: {
        level: 10, boot: { x: 48, y: 80 }, key: 'up', hold: 45, ticks: 70,
        expect: 'hasSword', why: 'the only pickup whose removed() adds a Help(3)',
    },
    torch: {
        level: 30, boot: { x: 64, y: 80 }, key: 'up', hold: 45, ticks: 70,
        expect: 'hasTorch', why: 'removed() calls Main.unlockMedal — never yet executed',
    },
};

const arg = (name, fallback) => {
    const found = process.argv.find((a) => a.startsWith(`--${name}=`));
    return found === undefined ? fallback : found.slice(name.length + 3);
};
const WHICH = arg('pickup', 'sword');
const probe = PROBES[WHICH];
if (!probe) {
    console.error(`--pickup must be one of ${Object.keys(PROBES).join(', ')}`);
    process.exit(1);
}

/**
 * `--x=N` — press X on the tape's OWN ticks, N times, after the hold.
 *
 * ⚠ This is the experiment the first probe run turned into the interesting
 * one. The bot KEPT TICKING through the ceremony (the tick counter ran 24
 * to 70 while the player never moved off (56,62)), which means its
 * dead-frame gate saw `Game.freezeObjects` false at the top of the frame
 * while the movement block was still being skipped inside it. If the tape
 * is advancing anyway, then the tape can supply the X release itself — and
 * `NPC.talk()` reads `Input.released(p.keys[6])` from the NPC's own update,
 * which is NOT inside `Mobile.mobileUpdate`'s frozen block. So a dialogue
 * that `autoAdvance` never saw may be dismissable from the tape with no
 * AS3 at all.
 *
 * Single-tick spans, spaced: a length-1 span is a press edge at `from` and
 * a release edge at `to`, which is the full down-then-up `Input.released`
 * needs. Spaced by 4 so each release lands on its own frame.
 */
const X_PRESSES = Number(arg('x', 0));
const inputs = [{ key: probe.key, from: 0, to: probe.hold }];
for (let i = 0; i < X_PRESSES; i++) {
    inputs.push({ key: 'primary', from: probe.hold + 2 + i * 4, to: probe.hold + 3 + i * 4 });
}
const tickCount = X_PRESSES > 0 ? probe.hold + 4 + X_PRESSES * 4 : probe.ticks;

const tape = {
    tape_version: 3,
    game: 'seedling',
    boot: { level: probe.level, x: probe.boot.x, y: probe.boot.y },
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'lava', 'ice', 'waterfall'],
    grants: [],
    persistence: [],
    tick_count: tickCount,
    inputs,
};

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

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

    console.log(`ceremony probe: ${WHICH} (${probe.why})`);
    const before = await botJson('botStatus');
    // ⚠ THE NEGATIVE FIRST. If the property were already true the whole
    // probe would "pass" without collecting anything — the same shape as
    // the shut-before control every opened-blocker claim needs.
    console.log(`  before: ${probe.expect}=${before.items[probe.expect]} `
        + `level=${before.level} (${before.x},${before.y})`);
    if (before.items[probe.expect] !== false) {
        console.log('  ⚠ the property is ALREADY true before the tape runs — this probe '
            + 'would prove nothing. Fresh page did not mean fresh save.');
        process.exit(1);
    }

    const loaded = await bot('botLoadTape', JSON.stringify(tape));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    if (await bot('botStart') !== 'ok') throw new Error('botStart refused');

    // Poll rather than wait-for-finished: a DEADLOCK is a predicted outcome
    // here, so the interesting readout is the shape of the stall — the tick
    // frozen while `dead_frames` climbs — and a plain wait would report it
    // as a bare timeout.
    let last = null;
    let stalledSince = null;
    const DEADLINE = Date.now() + 15 * 60 * 1000;
    for (;;) {
        const st = await botJson('botStatus');
        const line = `tick=${st.tick}/${st.tick_count} dead=${st.dead_frames} `
            + `auto=${st.saw_auto_advance} ${probe.expect}=${st.items[probe.expect]} `
            + `L${st.level} (${Math.round(st.x)},${Math.round(st.y)}) `
            + `recv=${st.receive_input}`;
        if (line !== last) { console.log(`  ${line}`); last = line; }
        if (st.finished) {
            console.log(`\nFINISHED. ${probe.expect}=${st.items[probe.expect]}, `
                + `saw_auto_advance=${st.saw_auto_advance}, dead_frames=${st.dead_frames}`);
            const got = st.items[probe.expect] === true;
            const fired = st.saw_auto_advance > 0;
            console.log(got && fired
                ? '\n✅ REAL COLLECTION WORKS on the existing build, and auto-advance '
                  + 'fired for the first time.'
                : `\n❌ finished but ${got ? '' : 'the item was NOT collected'}`
                  + `${!got && !fired ? ' and ' : ''}`
                  + `${fired ? '' : 'auto-advance never fired'}.`);
            break;
        }
        // A stall is `tick` not moving while `dead_frames` climbs.
        if (st.tick === stalledSince?.tick && st.dead_frames > stalledSince.dead + 400) {
            console.log(`\n⛔ DEADLOCK: tick pinned at ${st.tick} while dead_frames `
                + `climbed to ${st.dead_frames}. saw_auto_advance=${st.saw_auto_advance}, `
                + `${probe.expect}=${st.items[probe.expect]}, receive_input=`
                + `${st.receive_input}, menu=${st.menu}.`);
            console.log(st.items[probe.expect] === true
                ? '  The item WAS collected and the game is still frozen — so the stall '
                  + 'is AFTER removed(), i.e. the Help(3) predicted above.'
                : '  The item was NOT collected — the stall is inside the dialogue, so '
                  + 'auto-advance itself is not dismissing it.');
            break;
        }
        if (st.tick !== stalledSince?.tick) stalledSince = { tick: st.tick, dead: st.dead_frames };
        if (Date.now() > DEADLINE) {
            console.log('\n⛔ deadline with no verdict');
            break;
        }
        await page.waitForTimeout(2000);
    }
    const heap = logs.filter((l) => /heap_alloc|out of memory|abort/i.test(l));
    if (heap.length) console.log(`\nruntime errors: ${heap.slice(0, 3).join(' ')}`);
} finally {
    await page.close();
    await browser.close();
}
