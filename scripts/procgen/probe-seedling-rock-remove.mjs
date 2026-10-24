#!/usr/bin/env node
/**
 * Seedling ROCKMOVE's "Remove bundle", ON THE GAME (rules `rules-rock-remove`). ⚖ The user (2026-10-18): the
 * delivered set drops three trigger-sealing rocks the rules already price open
 * (`seedlingSetPatches.ROCKMOVE_REMOVE_BUNDLE`): L74's rock + button, L39's rope rock, L29's rock + button.
 *
 * One tape per room, each reproducing fidelity ROCKMOVE's D2 witness:
 *   l74-round-trip   boot L73 (64,16): up into L74 (L73's door lands ON `button@288,128`), then down onto
 *                    `teleporter@288,144` → L73. Vanilla: the press drops `fallrock@288,144` on that door
 *   l39-rope-return  boot L39 (144,608) = the L38 arrival tile, `r5-shaft`'s opening: up the shaft, cut
 *                    `rope@96,384` with fire (t185), then back down onto `teleporter@144,624` → L38. Vanilla: the
 *                    cut drops `fallrock@144,624` on that door
 *   l29-south        boot L29 (112,160), south of the neck: up through the neck, then back down
 *   l29-north        boot L29 (112,96), north of the neck: down through it (pressing the button), then back up.
 *                    Vanilla: the press drops `fallrock@112,112` into the neck behind the player
 *
 * Two arms per tape, each on a FRESH page (a reused page keeps the previous build's entities):
 *   DELIVERED  `vanillaRecordSet`'s own default (`SEEDLING_SET_PATCHES`), mounted by `botLoadLevels`
 *   CONTROL    the same delivery WITHOUT the five bundle rows (every other patch kept): the vanilla seals
 * DELIVERED passes iff each room is crossed the way the rules price it; CONTROL iff the seal is reproduced, with
 * its trigger's write in `persistence_cleared` (otherwise the control did not measure the coupling).
 *
 * The model replays each arm's tape on its mounted records; its outcome is a row (by name when it refuses), and on
 * the DELIVERED arm it must agree with the game (ROCKMOVE measured model == game on every recommended arm).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too
 * (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-rock-remove.mjs [--host=http://localhost:8000] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { ROCKMOVE_REMOVE_BUNDLE, SEEDLING_SET_PATCHES } from '../../frontend/modules/seedlingDemo/seedlingSetPatches.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
/** L29's neck: the rock's tile spans y 112–128 (the button's, 128–144). North of it = y < 112. */
const NECK = { top: 112, bottom: 128 };

const tapeOf = (name, fields) => ({
    tape_version: 8, game: 'seedling', name, description: 'probe-seedling-rock-remove',
    noclip: false, noDamage: true, noHazards: [], grants: [], persistence: [], equips: [],
    save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { seed: 1, split: false }, seam: {}, ...fields,
});

/** The four tapes (ROCKMOVE's D2 specs `l74-round`, `l39-rope-return`, `l29-press`, `l29-press-north`). */
export const ROOM_TAPES = Object.freeze({
    'l74-round-trip': tapeOf('l74-round-trip', {
        boot: { level: 73, x: 64, y: 16 }, tick_count: 480,
        inputs: [{ key: 'up', from: 0, to: 20 }, { key: 'down', from: 20, to: 480 }],
    }),
    // `fixtures/tapes/r5-shaft.json`'s first 226 ticks (up the shaft, the fire press that cuts the rope), then down
    'l39-rope-return': tapeOf('l39-rope-return', {
        boot: { level: 39, x: 144, y: 608 }, tick_count: 700,
        grants: [{ level: 39, items: ['conch', 'feather', 'fire', 'sword'] }],
        persistence: [{ level: 39, tag: 8 }], equips: [{ t: 185, slot: 1 }],
        inputs: [
            { key: 'up', from: 0, to: 174 }, { key: 'down', from: 174, to: 175 }, { key: 'up', from: 175, to: 178 },
            { key: 'down', from: 179, to: 181 }, { key: 'primary', from: 185, to: 186 },
            { key: 'down', from: 240, to: 700 },
        ],
    }),
    'l29-south': tapeOf('l29-south', {
        boot: { level: 29, x: 112, y: 160 }, tick_count: 420,
        inputs: [{ key: 'up', from: 0, to: 50 }, { key: 'down', from: 50, to: 420 }],
    }),
    'l29-north': tapeOf('l29-north', {
        boot: { level: 29, x: 112, y: 96 }, tick_count: 520,
        inputs: [{ key: 'down', from: 0, to: 60 }, { key: 'up', from: 290, to: 520 }],
    }),
});

/** The transitions a drained stream implies: one per level change (`probe-seedling-moonrock.mjs`' reading). */
const derivedTransitions = (ticks) => ticks.slice(1).flatMap((o, i) => (o.level === ticks[i].level ? []
    : [{ t: o.t, from: ticks[i].level, to: o.level }]));
const ys = (ticks, level, from = 0) => ticks.filter((o) => o.t >= from && o.level === level).map((o) => o.y);
const minOf = (a) => (a.length ? Math.min(...a) : null);
const maxOf = (a) => (a.length ? Math.max(...a) : null);
const has = (transitions, from, to) => transitions.some((t) => t.from === from && t.to === to);

/**
 * What one tape's drained stream says, room by room: `open` is the delivered verdict (the room crossed the way the
 * rules price it), `sealed` the control's (the vanilla seal reproduced). Exported for the unit rows.
 */
export function readRoom(name, ticks) {
    const transitions = derivedTransitions(ticks);
    if (name === 'l74-round-trip') {
        return { transitions, open: has(transitions, 73, 74) && has(transitions, 74, 73),
            sealed: has(transitions, 73, 74) && !has(transitions, 74, 73) };
    }
    if (name === 'l39-rope-return') {
        return { transitions, open: has(transitions, 39, 38), sealed: transitions.length === 0 };
    }
    if (name === 'l29-south') {
        // up from the south: north of the neck, and then back down south past it
        const north = minOf(ys(ticks, 29));
        const back = ticks.find((o) => o.level === 29 && o.y < NECK.top);
        const southAgain = back ? maxOf(ys(ticks, 29, back.t)) : null;
        return { transitions, north, southAgain,
            open: back !== undefined && southAgain > NECK.bottom + 16, sealed: north >= NECK.bottom };
    }
    if (name === 'l29-north') {
        // down from the north (both arms pass), then the return north from t290
        const south = maxOf(ys(ticks, 29).slice(0, 290));
        const returnNorth = minOf(ys(ticks, 29, 290));
        return { transitions, south, returnNorth, open: south > NECK.bottom + 16 && returnNorth < NECK.top,
            sealed: south > NECK.bottom + 16 && returnNorth >= NECK.bottom };
    }
    throw new Error(`readRoom: no tape ${name}`);
}

/** Each tape's trigger: the write the CONTROL arm must show (a seal without it measured nothing). */
export const TRIGGER_OF = Object.freeze({
    'l74-round-trip': { level: 74, tag: 2 },
    'l39-rope-return': { level: 39, tag: 10 },
    'l29-south': { level: 29, tag: 0 },
    'l29-north': { level: 29, tag: 0 },
});

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { mountedRecordsOf } = await M('wasmWalkTape.js');
    const { levelSourceFromAtlas } = await M('atlasSource.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { runTape } = await M('tapeRunner.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const missing = ROCKMOVE_REMOVE_BUNDLE.filter((p) => !SEEDLING_SET_PATCHES.includes(p)).map((p) => p.id);
    if (missing.length) {
        console.log(`FAIL: the delivery's table does not carry ${missing.join(', ')}`);
        process.exit(1);
    }
    const armOf = (set) => ({ set, levelSource: levelSourceFromAtlas(mountedRecordsOf(set)) });
    const ARMS = {
        // ⛔ the delivery's OWN default, so a delivery that stops carrying the table is seen here
        delivered: armOf(vanillaRecordSet(EMBED, MAP).set),
        control: armOf(vanillaRecordSet(EMBED, MAP, {
            patches: SEEDLING_SET_PATCHES.filter((p) => !ROCKMOVE_REMOVE_BUNDLE.includes(p)) }).set),
    };
    console.log(`PAGE: ${PAGE} · delivered ${ARMS.delivered.set.set_id} · control ${ARMS.control.set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-rock-remove.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    const call = (page, n, a) => page.evaluate(([name, x]) => {
        const g = window.__swfBridge && window.__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return String(x === undefined ? g[name]() : g[name](x));
    }, [n, a]);
    const json = async (page, n, a) => { const r = await call(page, n, a); return r === null ? null : JSON.parse(r); };
    const waitFor = async (page, what, fn, ms) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn();
            if (v) return v;
            if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
            await page.waitForTimeout(250);
        }
    };
    // ⛔ EVERY TAPE × ARM ON A FRESH PAGE.
    const logs = [];
    const run = async (set, tape) => {
        const page = await browser.newPage();
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            await assertLogicOnlyChannel(page);
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const mounted = await json(page, 'botLevelSet');
            if (await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                return st?.finished ? st : null;
            }, 10 * 60 * 1000);
            const drained = await json(page, 'botDrain');
            return { status, mounted, ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    try {
        for (const [tapeName, raw] of Object.entries(ROOM_TAPES)) {
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const trigger = TRIGGER_OF[tapeName];
            for (const [name, a] of Object.entries(ARMS)) {
                const g = await run(a.set, tape);
                const read = readRoom(tapeName, g.ticks);
                const fired = (g.status.persistence_cleared ?? [])
                    .some((c) => Number(c.level) === trigger.level && Number(c.tag) === trigger.tag);
                let model;
                try {
                    const m = readRoom(tapeName, runTape(tape, { levelSource: a.levelSource }).ticks);
                    model = { refused: null, transitions: m.transitions, open: m.open, sealed: m.sealed };
                } catch (e) {
                    model = { refused: e.message.split('\n')[0] };
                }
                console.log(`ROW ${JSON.stringify({ tape: tapeName, arm: name, set_id: a.set.set_id, mounted: g.mounted?.active,
                    observations: g.ticks.length, fired, ...read, final: g.ticks.at(-1) ?? null, model })}`);
                const label = `${tapeName} ${name}`;
                check(`${label}: the game ran the tape to its end on the mounted set`,
                    g.ticks.length === tape.tick_count + 1 && g.mounted?.active === a.set.set_id,
                    `${g.ticks.length} obs, ${g.mounted?.active}`);
                if (name === 'delivered') {
                    check(`${label}: the room is OPEN the way the rules price it, and no rock was dropped`,
                        read.open && !fired, JSON.stringify({ ...read, transitions: undefined, fired }));
                    check(`${label}: the model replays it the same (open, the same transitions)`,
                        model.refused === null && model.open
                            && JSON.stringify(model.transitions) === JSON.stringify(read.transitions),
                        JSON.stringify(model));
                } else {
                    check(`${label}: the vanilla seal is reproduced, with its trigger's write {${trigger.level},${trigger.tag}}`,
                        read.sealed && fired, JSON.stringify({ ...read, transitions: undefined, fired }));
                }
            }
        }
    } catch (e) {
        console.log(`PAGE LOGS (last 20):\n${logs.slice(-20).join('\n')}`);
        check('the wasm runs', false, String(e.message).split('\n')[0]);
    } finally {
        await browser.close();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}
