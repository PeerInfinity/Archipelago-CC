#!/usr/bin/env node
/**
 * Seedling L37 FALLROCK, ON THE GAME (rules `rules-l37-fallrock-patch`). ⚖ The user (2026-10-10): the delivered
 * set drops L37's `<fallrock>` (`seedlingSetPatches.PATCH_L37_FALLROCK_REMOVED`), so L37 ↔ L38 stays open in AP play.
 *
 * L37's `teleporter@288,0` lands in L38 ON `buttonroom@144,288` (tset 4, flip 1, room 37), which clears `{37,4}`
 * (`ButtonRoom.as:93`); a cleared `{37,4}` builds L37's `fallrock@288,32` FALLEN (`FallRock.as:42-45`) in L37's
 * 1-tile column-18 corridor. ONE continuous tape (`roundTripTape`), booted in L37 below the rock at (288,96):
 *
 *   up    enter L38 by the door (lands on the button: the press)
 *   down  L38's `teleporter@144,304` → L37 (288,16), then on down the corridor PAST the rock's tile
 *   up    back up the corridor and into L38 a SECOND time
 *   down  and back to L37 again
 *
 * Two arms, each on a FRESH page (a reused page keeps the previous build's entities):
 *   DELIVERED  `vanillaRecordSet`'s own default (`SEEDLING_SET_PATCHES`), mounted by `botLoadLevels`
 *   CONTROL    the same delivery WITHOUT this patch (every other patch kept): the rock is built fallen on the return
 * The DELIVERED arm passes iff the player re-enters L37, gets past the rock's tile (y > 48), and enters L38 again;
 * the CONTROL arm reproduces the seal (`rules-l38-button-event`'s witness): after the return it never gets past.
 * Both must show the press (`{37,4}` in `persistence_cleared`) — otherwise neither arm measured the coupling.
 *
 * The model replays each arm's tape on its mounted records and its outcome is recorded as a row, by name when it
 * refuses (it does today, on both: the model banks the button's write as a clear for L37's next build, which refuses
 * the fallen rock on the control and a clear "which no entity in this level reads" on the delivery).
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too
 * (`.github/workflows/seedling-probe.yml`).
 *
 * Run: node scripts/procgen/probe-seedling-l37-fallrock.mjs [--host=http://localhost:8000] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { PATCH_L37_FALLROCK_REMOVED, SEEDLING_SET_PATCHES } from '../../frontend/modules/seedlingDemo/seedlingSetPatches.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
/** The rock's far edge, in the drained stream's y: past it = the corridor below the rock reached. */
const ROCK = { level: 37, x: 288, y: 32, bottom: 48 };
const TICKS = 360;

/** The one tape both arms play (the schedule: up 0–76 into L38, down to 200, up to 310, down to the end). */
export const roundTripTape = (parseTape, PIN_NAMES) => parseTape({
    tape_version: 8, game: 'seedling', name: 'l37-fallrock-round-trip', description: 'probe-seedling-l37-fallrock',
    boot: { level: 37, x: 288, y: 96 }, noclip: false, noDamage: true, noHazards: [],
    grants: [], persistence: [], equips: [], pins: [...PIN_NAMES],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 1, split: false }, seam: {}, tick_count: TICKS,
    inputs: [
        { key: 'up', from: 0, to: 76 },
        { key: 'down', from: 76, to: 200 },
        { key: 'up', from: 200, to: 310 },
        { key: 'down', from: 310, to: TICKS },
    ],
});

/** The transitions a drained stream implies: one per level change (`probe-seedling-moonrock.mjs`' reading). */
const derivedTransitions = (ticks) => ticks.slice(1).flatMap((o, i) => (o.level === ticks[i].level ? []
    : [{ t: o.t, from: ticks[i].level, to: o.level, at: { x: o.x, y: o.y } }]));

/**
 * What one arm's drained stream says: the transitions, and the L37 y range AFTER the first return (from the
 * first 38 → 37 change to the next 37 → 38, or the end).
 */
export function readRoundTrip(ticks) {
    const transitions = derivedTransitions(ticks);
    const back = transitions.findIndex((t) => t.from === 38 && t.to === 37);
    const again = back < 0 ? -1 : transitions.findIndex((t, i) => i > back && t.from === 37 && t.to === 38);
    const span = back < 0 ? [] : ticks.filter((o) => o.t >= transitions[back].t
        && (again < 0 || o.t < transitions[again].t) && o.level === 37).map((o) => o.y);
    return {
        transitions,
        entered38: transitions.some((t) => t.from === 37 && t.to === 38),
        returned: back >= 0,
        afterReturn: span.length ? { min: Math.min(...span), max: Math.max(...span) } : null,
        pastRock: span.length > 0 && Math.max(...span) > ROCK.bottom,
        reentered38: again >= 0,
    };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
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
    if (!SEEDLING_SET_PATCHES.includes(PATCH_L37_FALLROCK_REMOVED)) {
        console.log('FAIL: the delivery\'s table does not carry l37-fallrock-removed');
        process.exit(1);
    }
    const armOf = (set) => ({ set, levelSource: levelSourceFromAtlas(mountedRecordsOf(set)) });
    const ARMS = {
        // ⛔ the delivery's OWN default, so a delivery that stops carrying the table is seen here
        delivered: armOf(vanillaRecordSet(EMBED, MAP).set),
        control: armOf(vanillaRecordSet(EMBED, MAP, {
            patches: SEEDLING_SET_PATCHES.filter((p) => p !== PATCH_L37_FALLROCK_REMOVED) }).set),
    };
    const tape = roundTripTape(parseTape, PIN_NAMES);
    console.log(`PAGE: ${PAGE} · delivered ${ARMS.delivered.set.set_id} · control ${ARMS.control.set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-l37-fallrock.mjs', kind: 'browser' });
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
    // ⛔ EVERY ARM ON A FRESH PAGE.
    const logs = [];
    const run = async (set) => {
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
        for (const [name, a] of Object.entries(ARMS)) {
            const g = await run(a.set);
            const read = readRoundTrip(g.ticks);
            const pressed = (g.status.persistence_cleared ?? []).some((c) => Number(c.level) === 37 && Number(c.tag) === 4);
            let model;
            try {
                model = { refused: null, ...readRoundTrip(runTape(tape, { levelSource: a.levelSource }).ticks) };
                delete model.transitions;
            } catch (e) {
                model = { refused: e.message.split('\n')[0] };
            }
            console.log(`ROW ${JSON.stringify({ arm: name, set_id: a.set.set_id, mounted: g.mounted?.active,
                observations: g.ticks.length, pressed, ...read, final: g.ticks.at(-1) ?? null, model })}`);
            check(`${name}: the game ran the tape to its end on the mounted set`,
                g.ticks.length === TICKS + 1 && g.mounted?.active === a.set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            check(`${name}: L37's door entered L38 and its button wrote {37,4}`, read.entered38 && pressed,
                JSON.stringify({ entered38: read.entered38, pressed }));
            check(`${name}: L38's teleporter returned to L37`, read.returned, JSON.stringify(read.transitions));
            if (name === 'delivered') {
                check('delivered: after the return the corridor is OPEN — past the rock\'s tile (y > 48) and into L38 AGAIN',
                    read.pastRock && read.reentered38, JSON.stringify(read.afterReturn));
            } else {
                check('control: after the return the rock is FALLEN — the player never gets past its tile',
                    read.afterReturn !== null && !read.pastRock, JSON.stringify(read.afterReturn));
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
