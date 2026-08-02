#!/usr/bin/env node
/**
 * probe-seedling-l65-breach — does the three-push chain the sweep found
 * actually open L65's health corridor? A PAIR, differing only in whether
 * the three `primary` spans exist.
 *
 * Region-atlas Phase 8, rung R4. Brief: the kickoff's §10.6 ("health's gate
 * = the L65 re-sweep… health returns iff that sweep finds a breach"), and
 * `recon-seedling-pushes.mjs`, which found one.
 *
 * ── WHAT THE SWEEP SAYS, AND WHY IT NEEDS THE GAME ────────────────────
 *
 * Entering L65 through L63's door at (128,304) — the arrival at (128,16) —
 * the L68 door is SEALED by `pushableblockspear@176,128` at tile (11,8),
 * which plugs the one corridor (12,8)-(11,8)-(10,8)-(10,7)-(10,6)-(11,6)-
 * (11,5)-door. §8.5 ruled that permanent because no single push from the
 * entry component connects the room. At the planner's own pitch the sweep
 * finds a THREE-push chain that does:
 *
 *   1. W  from tile (12,8), reach 1        block (11,8) -> (10,8)
 *   2. N  from tile (10,10), reach 2 ACROSS THE PIT at (10,9)
 *                                          block (10,8) -> (10,7)
 *   3. W  from tile (12,7), reach 2 THROUGH THE WALL at (11,7)
 *                                          block (10,7) -> (9,7), a PIT
 *
 * Two of those three shapes are already oracle-confirmed (§10.6: the
 * facing-direction push at reach 1 in this very room, and reach 2 across a
 * pit in L67). The two that are NOT are **UP** — the one direction whose
 * `spearRect` arm carries the asymmetric `+ 1` and which no recording has
 * ever exercised — and reach 2 through a SOLID, which was inferred from
 * "the spear has no line-of-sight gate" rather than seen.
 *
 * ⚠ Note what the chain does NOT rest on. Whether the block is DESTROYED
 * on the pit at (9,7) (`PushableBlockFire.input()`) or merely sits there is
 * invisible to reachability: a pit tile is forbidden floor either way. The
 * claim under test is that the block LEAVES the corridor, not that it
 * vanishes — so a probe that confirms the corridor is enough, and the
 * destruction rule stays a source reading with nothing resting on it.
 *
 * ── THE PAIR ──────────────────────────────────────────────────────────
 *
 * Both arms walk the identical route and end with the same LEFT-then-UP
 * pair of holds, each long enough to PIN against a wall rather than to
 * stop at a computed position — the l71 discipline: assert the effect, and
 * make each outcome a different wall.
 *
 *   press arm    ends ~(166, 99)   — through the vacated corridor, pinned
 *                                    under (10,5)'s Body Wall
 *   control      ends ~(194, 115)  — pinned at the block's own east face,
 *                                    then under `rock@192,96`
 *
 * Both ~(194, 115) -> NO BREACH: some push did not happen, and the trace
 * says which (the position after each press span is logged).
 * Both ~(166, 99)  -> the corridor was never plugged; diagnose the world.
 *
 * ⚠ Span sizes are COAST-CORRECTED (§10.6): releasing a held arrow leaves
 * ~1.1-1.4 px/tick that friction drains over ~5 px, so a hold of N ticks
 * travels roughly N + 4 px. Where a wall can absorb the overshoot the hold
 * is deliberately LONG and the stop is the wall; where a pit is downrange
 * the hold is sized with the coast counted in.
 *
 * Run: node scripts/procgen/probe-seedling-l65-breach.mjs
 */

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PAGE_NAME = 'seedling_bot_ap';
const WASM_DIR = join(REPO, 'frontend', 'modules', 'flashPanel', 'wasm', PAGE_NAME);
const PAGE_URL = `http://localhost:8000/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
const OUT = process.env.PROBE_OUT ?? '/tmp';

if (!existsSync(WASM_DIR)) {
    console.log(`SKIP: no wasm artifact at ${WASM_DIR}`);
    process.exit(0);
}

const TICKS = 440;

/** The three press ticks, named so the trace can be read against them. */
const PRESS_1 = 18;
const PRESS_2 = 130;
const PRESS_3 = 286;

const tapeFor = (withPress) => ({
    tape_version: 4,
    game: 'seedling',
    name: withPress ? 'probe-l65-breach-press' : 'probe-l65-breach-control',
    description: 'The sweep\'s three-push chain in L65 (or not), then walk the corridor.',
    // Tile (12,8): the entry side of the seal, where the L63 (128,304) door
    // lands the walk after a short descent. Booting here rather than at the
    // arrival keeps the tape about the PUSHES.
    boot: { level: 65, x: 192, y: 128 },
    noclip: false,
    noDamage: true,
    noHazards: ['water', 'lava', 'ice', 'waterfall'],
    grants: [{ level: 65, items: ['sword', 'spear'] }],
    persistence: [],
    equips: [{ t: 0, slot: 1 }],
    tick_count: TICKS,
    inputs: [
        // ── push 1: W at reach 1, from tile (12,8) ────────────────────
        // The hold is long on purpose: the block itself is the wall that
        // stops it, flush at x = 194, which is also the widest stance.
        { key: 'left', from: 5, to: 12 },
        ...(withPress ? [{ key: 'primary', from: PRESS_1, to: PRESS_1 + 1 }] : []),
        // The block glides at 0.5 px/tick — 32 ticks per tile — and
        // `hit()` ignores a press while `v.length > 0`, so every wait here
        // is a requirement, not padding.

        // ── walk (12,8) -> (12,9) -> (11,9) -> (11,10) -> (10,10) ─────
        // ⚠ Not straight down: (12,10) and (10,9) are PITS, and L65 has no
        // `control` block, so a fall is `die()`.
        { key: 'down', from: 62, to: 73 },     // y 136 -> ~152, tile (12,9)
        { key: 'left', from: 78, to: 83 },     // x 194 -> ~184, tile (11,9)
        { key: 'down', from: 88, to: 99 },     // y 152 -> ~168, tile (11,10)
        { key: 'left', from: 104, to: 119 },   // x 184 -> ~164, tile (10,10)

        // ── push 2: N at reach 2, ACROSS the pit at (10,9) ────────────
        // Two ticks of UP: enough to face north, short enough that the
        // coast leaves the terrain probe inside row 10 (its top edge is
        // y = 160 and the probe reaches y - 2).
        { key: 'up', from: 124, to: 125 },
        ...(withPress ? [{ key: 'primary', from: PRESS_2, to: PRESS_2 + 1 }] : []),

        // ── walk back (10,10) -> (11,10) -> (11,9) -> (12,9) -> (12,7) ─
        { key: 'right', from: 178, to: 193 },  // x ~164 -> ~184
        { key: 'up', from: 198, to: 205 },     // y ~164 -> ~152, tile (11,9)
        { key: 'right', from: 210, to: 221 },  // x ~184 -> ~200, tile (12,9)
        // Long by design: `rock@192,96` fills (12,6), so this hold ENDS at
        // the rock's south face, y = 115, whatever the coast does.
        { key: 'up', from: 226, to: 265 },

        // ── push 3: W at reach 2, THROUGH the Body Wall at (11,7) ─────
        // Also long by design: the wall's east face pins the player at
        // x = 194, the stance with the most rect on the block.
        { key: 'left', from: 270, to: 281 },
        ...(withPress ? [{ key: 'primary', from: PRESS_3, to: PRESS_3 + 1 }] : []),

        // ── the payoff: down, west along row 8, then north up the corridor
        { key: 'down', from: 335, to: 350 },   // y ~115 -> ~135, tile (12,8)
        // Sized to stop mid-tile in (10,8) rather than flush against
        // (9,8)'s wall: pinning there would leave the box's left edge
        // exactly on (9,7)'s pit boundary, a zero-pixel margin nobody
        // should be asked to trust.
        { key: 'left', from: 355, to: 378 },   // x ~194 -> ~166 (press) / pinned 194 (control)
        // Long: the press arm rises through the vacated (10,7) and (10,6)
        // and pins under (10,5)'s Body Wall; the control never leaves
        // tile 12 and pins under the rock it is already touching.
        { key: 'up', from: 383, to: 422 },
    ],
});

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

async function runTape(tape) {
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
        const loaded = await bot('botLoadTape', JSON.stringify(tape));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await bot('botStart') !== 'ok') throw new Error('botStart refused');

        let last = null;
        let stalledSince = null;
        const DEADLINE = Date.now() + 30 * 60 * 1000;
        for (;;) {
            const st = await botJson('botStatus');
            const line = `tick=${st.tick}/${st.tick_count} dead=${st.dead_frames} `
                + `x=${Number(st.x).toFixed(2)} y=${Number(st.y).toFixed(2)} `
                + `L${st.level} primary=${st.primary} err=${st.error ?? ''}`;
            if (line !== last) { console.log(`  ${line}`); last = line; }
            if (st.finished) break;
            if (st.tick === stalledSince?.tick && st.dead_frames > stalledSince.dead + 200) {
                throw new Error(`tape stalled at tick ${st.tick}`);
            }
            if (st.tick !== stalledSince?.tick) {
                stalledSince = { tick: st.tick, dead: st.dead_frames };
            }
            if (Date.now() > DEADLINE) throw new Error('deadline');
            await page.waitForTimeout(1000);
        }
        const drained = await botJson('botDrain');
        writeFileSync(join(OUT, `${tape.name}.drain.json`), JSON.stringify(drained));
        const ticks = drained.ticks ?? [];
        const at = (t) => ticks.find((o) => o.t === t) ?? {};
        // The position at each press is what a failed arm is diagnosed
        // from: a press that fired from the wrong stance moved nothing,
        // and the chain then reads as "the sweep was wrong" when it was
        // the tape.
        for (const [label, t] of [
            ['before push 1', PRESS_1], ['before push 2', PRESS_2],
            ['before push 3', PRESS_3], ['after push 3', PRESS_3 + 40],
        ]) {
            const o = at(t);
            console.log(`    ${label.padEnd(14)} t=${t}  (${o.x}, ${o.y})`);
        }
        if (logs.length) console.log('  page console tail:', logs.slice(-8).join(' | '));
        const finals = ticks.at(-1) ?? {};
        return { x: finals.x, y: finals.y, ticks };
    } finally {
        await page.close();
    }
}

try {
    console.log('l65 breach pair: PRESS arm (three pushes)');
    const press = await runTape(tapeFor(true));
    console.log('\nl65 breach pair: CONTROL arm (identical walk, no presses)');
    const control = await runTape(tapeFor(false));

    console.log(`\n  press:   final (${press.x}, ${press.y})`);
    console.log(`  control: final (${control.x}, ${control.y})`);
    const through = press.x < 176 && press.y < 110;
    const pinned = control.x > 188 && control.y > 108;
    if (through && pinned) {
        console.log('✅ THE L65 BREACH IS ORACLE-CONFIRMED. The three-push chain moved the');
        console.log('   block out of the corridor and the press arm walked it; the control');
        console.log('   pinned at the block\'s own face. §8.5\'s verdict is overturned by the');
        console.log('   game: `health` is reachable at R4, and ruling 2 is re-opened with an');
        console.log('   oracle behind it rather than a grid.');
    } else if (!through && pinned) {
        console.log('⛔ NO BREACH: the press arm pinned where the control did. Read the');
        console.log('   per-press positions above — a stance that drifted is a TAPE defect,');
        console.log('   a stance that held is a MODEL defect, and they are different findings.');
    } else {
        console.log('⚠ UNEXPECTED SHAPE — the control did not pin (was the block there?) or');
        console.log('   the press arm stopped somewhere new. Diagnose from the traces above.');
    }
} catch (e) {
    console.error(`\nPROBE FAILED: ${e.message}`);
    process.exitCode = 1;
} finally {
    await browser.close();
}
