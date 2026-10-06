#!/usr/bin/env node
/**
 * Seedling L57's DEATH-SPAWNED EXIT, THE GAME'S WAY (rules `rules-game-truth-gaps`, the L57 lift: ⚖ the user
 * 2026-10-06, "lift L57 like L82"). The playthrough now wires `tentacle_beast_mouth` (L57 -> L58) from the
 * runtime-exit census; this asks the wasm game whether that door exists and where it leads.
 *
 * The kill is STAGED, not fought: `TentacleBeast`'s ctor reads its persistence tag, and a CLEARED tag (the
 * beast already died) builds it dead and calls `createMouthEntrance()` at once (`TentacleBeast.as:52-60`) —
 * the game's own resume path, the one any re-entry after the kill takes. Fighting it on a fixed tape is not
 * possible: the eight tentacles spawn at `Math.random()` positions (`TentacleBeast.as:165-175`).
 *
 * Rows, each a fresh tape on one page (the conch granted: the arena is water):
 *   DEAD  — the tag cleared: from each probe boot, holding the key toward the mouth (96,64), the GAME crosses
 *           to L58 and lands where the manifest says (`named_rooms.tentacle_beast_mouth`, (56,96));
 *   ALIVE — the same inputs with the tag held: no crossing (the door exists only after the death).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (proved, `CHANNEL: headless logic-only`), so it runs in CI too
 * (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-tentacle-mouth.mjs [--host=http://localhost:8000] [--ticks=240]
 *      [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
/** The arena, its tag, and the boots that approach the mouth (the door at (96,64), from the AS3). */
export const ARENA = Object.freeze({ level: 57, tag: 0, mouth: { x: 96, y: 64 } });
export const APPROACHES = Object.freeze([
    { boot: { x: 96, y: 96 }, key: 'up' },
    { boot: { x: 96, y: 80 }, key: 'up' },
    { boot: { x: 128, y: 64 }, key: 'left' },
    { boot: { x: 64, y: 64 }, key: 'right' },
]);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const TICKS = Number(arg('ticks', '240'));
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const { PIN_NAMES, parseTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/tapeFormat.js'));
    const { spawnFromBoot } = await import(join(REPO, 'frontend/modules/seedlingDemo/playerPhysicsV1.js'));
    const manifest = JSON.parse(readFileSync(join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), 'utf8'))
        .named_rooms.tentacle_beast_mouth;
    const want = { level: manifest.level, ...spawnFromBoot({ x: manifest.x, y: manifest.y }) };

    takeBoxLockOrExit({ name: 'probe-seedling-tentacle-mouth.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const tapeOf = (name, a, dead) => parseTape({
        tape_version: 8, game: 'seedling', name, description: 'probe-seedling-tentacle-mouth',
        boot: { level: ARENA.level, ...a.boot }, noclip: false, noDamage: true, noHazards: [],
        grants: [{ level: ARENA.level, items: ['conch'] }],
        persistence: dead ? [{ level: ARENA.level, tag: ARENA.tag, note: 'the TentacleBeast died (staged)' }] : [],
        equips: [], pins: [...PIN_NAMES], save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false }, seam: {}, tick_count: TICKS,
        inputs: [{ key: a.key, from: 0, to: TICKS }],
    });

    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    const bot = (name, a) => page.evaluate(([n, x]) => String(window.__swfBridge.game[n](x)), [name, a]);
    const botJson = async (name, a) => JSON.parse(await bot(name, a));
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
        // ⛓ the logic-only channel, PROVED before anything is measured (`seedlingChannel.js`)
        await assertLogicOnlyChannel(page);
        const run = async (tape) => {
            if (await bot('botLoadTape', JSON.stringify(tape)) !== 'ok') throw new Error(`botLoadTape ${tape.name}`);
            if (await bot('botStart') !== 'ok') throw new Error(`botStart ${tape.name}`);
            for (const deadline = Date.now() + 10 * 60 * 1000; ;) {
                const st = await botJson('botStatus');
                if (st.finished) break;
                if (st.error) throw new Error(`${tape.name}: ${st.error}`);
                if (Date.now() > deadline) throw new Error(`${tape.name}: deadline`);
                await page.waitForTimeout(500);
            }
            const drained = await botJson('botDrain');
            return { ticks: drained.ticks ?? [], cleared: (await botJson('botStatus')).persistence_cleared ?? null };
        };
        let crossedDead = 0;
        for (const a of APPROACHES) {
            for (const dead of [true, false]) {
                const { ticks } = await run(tapeOf(`l57-${dead ? 'dead' : 'alive'}-${a.key}`, a, dead));
                const first = ticks.find((o) => o.level !== ARENA.level);
                const row = { dead, boot: a.boot, key: a.key, crossed: first ? { t: first.t, level: first.level, x: first.x, y: first.y } : null,
                    last: ticks.at(-1) ?? null };
                console.log(`ROW ${JSON.stringify(row)}`);
                if (dead && first) {
                    crossedDead += 1;
                    check(`DEAD, ${a.key} from (${a.boot.x},${a.boot.y}): the mouth leads to L${want.level} at the manifest's landing`,
                        first.level === want.level && first.x === want.x && first.y === want.y,
                        JSON.stringify({ got: first, want }));
                }
                if (!dead) check(`ALIVE, ${a.key} from (${a.boot.x},${a.boot.y}): no door — the player stays in L${ARENA.level}`, !first,
                    first ? JSON.stringify(first) : '');
            }
        }
        check('with the beast dead, at least one approach crosses through the mouth', crossedDead > 0, `${crossedDead} of ${APPROACHES.length}`);
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await page.close();
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
