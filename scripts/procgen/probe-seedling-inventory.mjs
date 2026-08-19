#!/usr/bin/env node
/**
 * probe-seedling-inventory — can a TAPE drive the real inventory UI?
 *
 * Region-atlas Phase 8, subtractive ladder rung R4, slice 0. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §2.1/§3.1.
 *
 * ── THE QUESTION, AND WHY IT RUNS BEFORE THE BATCH ────────────────────
 *
 * R4 needs the SPEAR equipped: `useItem` switches on
 * `Inventory.getItem(Main.primary)`, `Main.primary` is a SLOT INDEX, and
 * the game's only in-game way to change it is the inventory screen. Two
 * designs are on the table and they differ by an entire AS3 batch:
 *
 *   A  a tape-declared `equips: [{t, slot}]` directive the Bot applies to
 *      `Main.primary` (the game's own debug warps write exactly that line)
 *   B  drive the REAL UI from tape spans — V/I are already legal keys and
 *      `firstUse` is satisfied the moment two items are held, so B needs
 *      NO new AS3 for the mechanism and is what the doctrine prefers
 *      (behaviour lives in tapes, the interpreter is compiled in once).
 *
 * B is predicted IMPOSSIBLE, from reading: `Inventory.set open` IS
 * `Game.freezeObjects = _open` (`Inventory.as:139`), `Bot.update`'s
 * dead-frame gate returns early whenever that flag is true at the top of
 * `Main.update`, and — unlike the dialogue phase — the inventory has ONE
 * writer and nothing clears the flag per frame. So the frame after the
 * toggle should consume no tick and dispatch no key, forever.
 *
 * ⚠ AND THAT IS EXACTLY WHY IT IS PROBED. R3's ceremony probe INVERTED its
 * rung's plan on the same kind of confident structural prediction: the bot
 * turned out to keep ticking through a dialogue because `Game.freezeObjects`
 * is a sticky static several writers move WITHIN a frame. If the inventory
 * behaves the same way, B wins and the R4 batch shrinks to the readouts and
 * the counter fix.
 *
 * ── THE DISCRIMINATOR ─────────────────────────────────────────────────
 *
 * RIGHT is held for the whole tape and V is pressed twice, so the two
 * outcomes have different SHAPES rather than different verdicts:
 *
 *   DEAD  the tick counter pins a frame or two after the first V while
 *         `dead_frames` climbs without bound, and x pins with it
 *   LIVE  the tick counter runs to the end, and x is PINNED between the
 *         two V ticks and moving outside them — the dialogue-phase shape,
 *         `Mobile.mobileUpdate` skipped while the gate above it saw false
 *
 * A third outcome is possible and would mean the toggle never fired at all:
 * ticks run AND x never pins. `firstUse` is the thing to suspect (it needs
 * `items.length >= 2`, which the two grants supply), so the probe reports
 * it as its own case rather than folding it into DEAD.
 *
 * Run: node scripts/procgen/probe-seedling-inventory.mjs
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
 * The geometry is `straight-run`'s, the oldest fixture on the arc: boot at
 * the build spawn in level 0 and hold RIGHT. It is 30+ ticks of open floor
 * with no pickup, no trigger and no hazard, which is exactly what a probe
 * about the UI wants underneath it.
 *
 * The two grants are the only reason this is not a v1 tape: the toggle
 * needs `firstUse`, `Inventory.update` sets it on `items.length >= 2`, and
 * `addItemsFromSave` reads `Player.hasSword`/`hasSpear` — which a grant,
 * being a property write, is enough to satisfy. Under this pair the slot
 * array is [sword, spear], so slot 1 is the spear: the ONE selection R4
 * would ever need.
 */
const OPEN_AT = 10;
const CLOSE_AT = 30;
const TICKS = 50;

const tape = {
    tape_version: 3,
    game: 'seedling',
    name: 'probe-inventory-open',
    description: 'Hold RIGHT through two V toggles, with sword+spear granted.',
    boot: { level: 0, x: 80, y: 128 },
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'lava', 'ice', 'waterfall'],
    grants: [{ level: 0, items: ['sword', 'spear'] }],
    persistence: [],
    tick_count: TICKS,
    inputs: [
        { key: 'right', from: 0, to: TICKS },
        // A length-1 span is a press edge at `from` and a release edge at
        // `to`, and the toggle reads `Input.released` — so one span is one
        // toggle. Between them: DOWN (move the selection to slot 1) and X
        // (`Main.primary = selected`), the whole of what B would have to do.
        { key: 'inventory', from: OPEN_AT, to: OPEN_AT + 1 },
        { key: 'down', from: OPEN_AT + 5, to: OPEN_AT + 6 },
        { key: 'primary', from: OPEN_AT + 10, to: OPEN_AT + 11 },
        { key: 'inventory', from: CLOSE_AT, to: CLOSE_AT + 1 },
    ],
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

    console.log('inventory probe: does an OPEN inventory consume tape ticks?');
    const before = await botJson('botStatus');
    console.log(`  before: hasSword=${before.items.hasSword} hasSpear=${before.items.hasSpear} `
        + `L${before.level} (${before.x},${before.y})`);

    const loaded = await bot('botLoadTape', JSON.stringify(tape));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    if (await bot('botStart') !== 'ok') throw new Error('botStart refused');

    /** Every distinct (tick, x) the poll saw, so the pin is visible. */
    const seen = [];
    let last = null;
    let stalledSince = null;
    let verdict = null;
    // ⚠ Scaled to the LOCAL software-WebGPU browser, ~0.5 fps: a live tick
    // takes ~2s, so 120 dead frames with the tick pinned is ~4 minutes of
    // the game running and the tape not advancing. A fixed timeout looks
    // exactly like a dead bot (the arc's own dead-end note), which is why
    // the stall is detected from `dead_frames` and only backstopped by time.
    const STALL_FRAMES = 120;
    const DEADLINE = Date.now() + 20 * 60 * 1000;
    for (;;) {
        const st = await botJson('botStatus');
        const line = `tick=${st.tick}/${st.tick_count} dead=${st.dead_frames} `
            + `x=${Number(st.x).toFixed(2)} y=${Number(st.y).toFixed(2)} `
            + `auto=${st.saw_auto_advance} recv=${st.receive_input}`;
        if (line !== last) { console.log(`  ${line}`); last = line; seen.push({ ...st }); }
        if (st.finished) {
            verdict = 'ran-to-completion';
            break;
        }
        if (st.tick === stalledSince?.tick && st.dead_frames > stalledSince.dead + STALL_FRAMES) {
            console.log(`\n⛔ THE TAPE STOPPED. tick pinned at ${st.tick} while dead_frames `
                + `climbed to ${st.dead_frames}.`);
            verdict = 'dead';
            break;
        }
        if (st.tick !== stalledSince?.tick) stalledSince = { tick: st.tick, dead: st.dead_frames };
        if (Date.now() > DEADLINE) { verdict = 'deadline'; break; }
        await page.waitForTimeout(1000);
    }

    // ── the verdict, stated as the DESIGN it selects ──────────────────
    if (verdict === 'dead') {
        const st = seen[seen.length - 1];
        console.log(st.tick <= OPEN_AT + 2
            ? '\n✅ PREDICTED OUTCOME: open frames are DEAD frames. The tick pinned within\n'
              + `   two ticks of the V at ${OPEN_AT}, so no tape span can ever reach the\n`
              + '   arrows, the X, or the second V. **Option B is impossible; the R4 batch\n'
              + '   carries the `equips` directive (Option A).**'
            : `\n⚠ the tape stopped, but at tick ${st.tick} rather than near the V at `
              + `${OPEN_AT} — diagnose before concluding anything about the UI.`);
    } else if (verdict === 'ran-to-completion') {
        const drained = await botJson('botDrain');
        const ticks = drained.ticks ?? [];
        const xAt = (t) => ticks.find((o) => o.t === t)?.x;
        const moved = (a, b) => Math.abs((xAt(b) ?? 0) - (xAt(a) ?? 0)) > 0.001;
        const pinnedWhileOpen = !moved(OPEN_AT + 2, CLOSE_AT);
        const movedBefore = moved(1, OPEN_AT);
        const movedAfter = moved(CLOSE_AT + 3, TICKS);
        console.log(`\n  x at ${1}/${OPEN_AT}/${OPEN_AT + 2}/${CLOSE_AT}/${CLOSE_AT + 3}/${TICKS}: `
            + [1, OPEN_AT, OPEN_AT + 2, CLOSE_AT, CLOSE_AT + 3, TICKS]
                .map((t) => `${t}:${xAt(t)?.toFixed?.(2) ?? '—'}`).join(' '));
        if (pinnedWhileOpen && movedBefore) {
            console.log('\n⛔ THE PREDICTION IS INVERTED — the dialogue-phase shape again.\n'
                + '   The tape RAN and the player was PINNED while the inventory was open,\n'
                + '   so open frames consume ticks and a tape CAN reach the UI.\n'
                + '   **Option B becomes live: re-decide §3.1 before finalising the batch.**');
        } else if (!pinnedWhileOpen) {
            console.log('\n⚠ THE TOGGLE NEVER FIRED. The tape ran and the player never stopped,\n'
                + '   so `Game.freezeObjects` was never set — suspect `firstUse`\n'
                + `   (items.length was ${movedBefore ? '' : 'possibly '}< 2) or the key table,\n`
                + '   NOT the dead-frame gate. This probe has not answered its question.');
        }
        console.log(`  (moved before=${movedBefore}, pinned while open=${pinnedWhileOpen}, `
            + `moved after=${movedAfter})`);
    } else {
        console.log(`\n⛔ no verdict (${verdict})`);
    }
    const heap = logs.filter((l) => /heap_alloc|out of memory|abort/i.test(l));
    if (heap.length) console.log(`\nruntime errors: ${heap.slice(0, 3).join(' ')}`);
} finally {
    await page.close();
    await browser.close();
}
