#!/usr/bin/env node
/**
 * probe-seedling-l40-flag12-lock — ⛓ R-A5's GAME WITNESS (⚖ design-4 2026-11-11: "the rule is stricter than main, so it needs a
 * game witness, not only static evidence"). L40's `wandlock@480,560` (group t3) is opened only by `buttonroom@880,768`
 * (tag 12, in `level_40__r48c54`); R-A5 prices `level_40__r26c13 -> level_40__r23c29` at that press's event (flag 12).
 *
 * Two tapes, the SAME but for one persistence clear, each played on the GAME (the wasm build, headless, logic-only channel)
 * and on the JS MODEL (`createTapeStepper`):
 *   - `shut`: boot in the body just SOUTH of the lock (centred at (488,608), column 30, in r26c13), hold UP. No flag 12: the lock must hold —
 *     the player never reaches the lock's row 35 or above;
 *   - `open`: the same, with `{40, 12}` cleared before the first tick (the press latched: `ButtonRoom.check()` reads its
 *     slot and re-publishes its group, `ButtonRoom.as:43-44,79-89`; the lock fades and types itself "", `Lock.as:64-98`).
 *     The player must pass the lock's row into r23c29's column. This arm is the probe's own control: the same walk DOES
 *     cross when the press has happened, so `shut` holding is the lock, not a wall.
 * `noDamage` is set on both (the column's `iceturret@472,400` is not what is measured).
 * Each runtime's lowest tile row reached and its final position are printed; game ≡ model on both is a check.
 *
 * Run (a dev server at the repo root; SEEDLING_PORT, default 8000): node scripts/procgen/probe-seedling-l40-flag12-lock.mjs
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`. Takes the box lock (kind `browser`).
 */
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const MODULE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'modules', 'seedlingDemo');
const TILE = 16;
/** The lock: `wandlock@480,560` = tile (30,35). The body r26c13 is south of it, r23c29's column north. */
export const LOCK_ROW = 35;
export const BOOT = Object.freeze({ level: 40, x: 480, y: 600 }); // the player stands centred at (488, 608): tile (30,38)
const TICKS = 300;

/** The witness tape; `cleared` = the persistence clears applied before the first tick. */
export function flag12Tape(name, cleared) {
    return {
        game: 'seedling', name, boot: { ...BOOT }, noclip: false, noDamage: true, noHazards: [], grants: [],
        persistence: cleared.map(({ level, tag }) => ({ level, tag, note: 'R-A5 witness: the press latched' })),
        equips: [], pins: ['sound', 'dead_frames'], save: { totem_parts: [], keys: [0, 1, 2], seal_parts: [] },
        rng: { seed: 418414780, split: false, cosmetic: 0, fp: 1763053598 },
        seam: {
            items: { hasSword: true, hasGhostSword: false, hasShield: true, hasFire: true, hasWand: false, hasFireWand: false,
                canSwim: true, hasSpear: false, hasDarkShield: false, hasDarkSuit: false, hasDarkSword: false, hasFeather: false,
                hasTorch: true },
            beam: false, rock_set: false, hits_max: 3, first_use: false, extended: false, time: 8586, primary: 0, secondary: 0,
            grass_cut: 0, cutscene: [false, false, false, false], menu_state: 0, music: { set: 'Room', index: 1 },
        },
        tick_count: TICKS, tape_version: 8,
        inputs: [{ key: 'up', from: 0, to: TICKS }],
        description: `R-A5 witness ${name}: L40 boot (480,600) in r26c13, south of wandlock@480,560, hold up`,
    };
}

export const WITNESSES = Object.freeze({
    shut: Object.freeze({ cleared: [], crosses: false }),
    open: Object.freeze({ cleared: [{ level: 40, tag: 12 }], crosses: true }),
});

/** The model's per-tick player positions. */
export async function modelTrack(tapeJson) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const st = createTapeStepper(parseTape(JSON.stringify(tapeJson)), { levelSource: atlasLevelSource() });
    const track = [];
    for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation;
        track[o.t] = { x: o.x, y: o.y };
    }
    return track.filter(Boolean);
}

async function gameTrack(page, tapeJson) {
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const call = (n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]()
        : window.__swfBridge.game[name](x)), [n, a]);
    const loaded = await call('botLoadTape', JSON.stringify(gameVisibleTape(parseTape(JSON.stringify(tapeJson)))));
    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
    const started = await call('botStart');
    if (started !== 'ok') throw new Error(`botStart: ${started}`);
    const track = [];
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
        const s = JSON.parse(await call('botStatus'));
        if (Number.isInteger(s.tick) && s.level === 40) track.push({ t: s.tick, x: s.x, y: s.y });
        if (s.finished) return { track, status: s };
        await page.waitForTimeout(20);
    }
    throw new Error('the tape never finished inside the deadline');
}

const rowOf = (y) => Math.floor(y / TILE);
const summary = (track) => ({ minRow: Math.min(...track.map((p) => rowOf(p.y))), last: track.at(-1) });

async function main() {
    takeBoxLockOrExit({ name: 'probe-seedling-l40-flag12-lock.mjs', kind: 'browser' });
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    console.log('CHANNEL: headless logic-only (the wasm game) + the JS model in node');
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const [name, w] of Object.entries(WITNESSES)) {
        const tape = flag12Tape(`l40-flag12-${name}`, w.cleared);
        const model = summary(await modelTrack(tape));
        const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
        let game;
        try {
            const page = await browser.newPage();
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
                await page.waitForTimeout(250);
            }
            await assertLogicOnlyChannel(page);
            game = await gameTrack(page, tape);
        } finally {
            await browser.close();
        }
        const g = summary(game.track);
        console.log(`MEASURED: ${name} (clears ${JSON.stringify(w.cleared)}): game min row ${g.minRow}, last (${g.last.x}, ${g.last.y}) `
            + `L${game.status.level} t${game.status.tick}; model min row ${model.minRow}, last (${model.last.x}, ${model.last.y})`);
        const crossed = (s) => s.minRow < LOCK_ROW;
        check(`${name}: the GAME ${w.crosses ? 'crosses' : 'never reaches'} the lock's row ${LOCK_ROW}`, crossed(g) === w.crosses,
            `min row ${g.minRow}`);
        check(`${name}: the MODEL ${w.crosses ? 'crosses' : 'never reaches'} the lock's row ${LOCK_ROW}`, crossed(model) === w.crosses,
            `min row ${model.minRow}`);
        check(`${name}: game and model end on the same tile`, rowOf(g.last.y) === rowOf(model.last.y)
            && Math.floor(g.last.x / TILE) === Math.floor(model.last.x / TILE),
        `game (${g.last.x}, ${g.last.y}) model (${model.last.x}, ${model.last.y})`);
    }
    if (failures) { console.log(`\n${failures} CHECK(S) FAILED`); process.exit(1); }
    console.log('\nALL CHECKS PASSED');
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();
