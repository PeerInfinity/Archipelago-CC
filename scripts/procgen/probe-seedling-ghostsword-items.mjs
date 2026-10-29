#!/usr/bin/env node
/**
 * The Ghost Sword Fusion ON ITS OWN (slice rules-ghostsword-probe): what does each mix of the Fusion, the Ghost Spear
 * and the Sword let the player do, and do the playthrough rules agree?
 *
 * The rules charge the flag `hasGhostSword` as And(Ghost Sword Fusion, Ghost Spear, Progressive Sword) and a pole or a
 * spear block as HasAny(<pole flag>, Ghost Spear). Two layers decide what an AP player can do:
 *   DELIVERY  `flashBridgeAdapter._inventoryToFlashItems` turns the AP inventory into flash items. `Ghost Sword Fusion`
 *             is the `!ghostsword` FLAG of a `games/seedling.json` `fusion_items` row: the bridge writes `ghostsword`
 *             (→ `Player.hasGhostSword`) only once the flag, `spear` and one `!sword` copy are all held.
 *   GAME      what the raw flag does (`Bot.as` `grantItem` writes it with no recipe test; so does a seam):
 *             - `set slashing` passes on `hasSword || hasGhostSword` (`Player.as:782`), but `slash()` — every hit
 *               test, and the slash timers — is called from `update()` only `if (hasSword)` (`:560`);
 *             - a ghost hit is "Spear"-typed (`:924`): it toggles a pole (`:1105`) and pushes a spear block along
 *               `spearDirection = direction` (`:919-921`, `:1120`);
 *             - a rock breaks to `hit(hasGhostSword ? 1 : 0)` (`:1093`), the FLAG, not the weapon;
 *             - `Inventory.addItemsFromSave` (`Inventory.as:291-330`) splices the ghost sword (4) in for the sword (0)
 *               AND the spear (3) slots once the flag is up, so the Spear can no longer be thrust. Nothing clears
 *               `hasSpear` (no writer but the pickups, the cheats, the debug warps, the grant and the seam).
 *
 * Each scene is played with every mix, each on a FRESH page on the DELIVERED set, the items GRANTED on arrival:
 *   rock   L3 (28,64), the witness `ghostsword-l3-rockghost`'s stance: face W, one press, walk W — breakablerockghost@0,64
 *          (tag 1, rockType 1) across the water; the teleporter under it takes the player into L111 only if it broke.
 *   pole   L63 (128,256), the column's north side [8,16] (`probe-seedling-l63-darktrap.mjs`): face W, one press —
 *          lightpole@112,272 (tag 7) lit = `{63,7}` cleared.
 *   push   L63 (96,96), tile [6,6] west of pushableblockspear@112,96 [7,6]: face E, one press — the block moved.
 *
 * The mixes: ghost (a) · ghost-sword (b) · ghost-spear (c) · ghost-spear-sword (d, the control) · sword · spear.
 * The rock scene adds the Conch to every mix (the walk swims the column).
 *
 * Prints `PASS:`/`FAIL:` rows, `DELIVERY {json}`, `ROW {json}`, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); the wasm build, or SKIP.
 * Takes the box lock. Headless LOGIC-ONLY (`CHANNEL: headless logic-only`), so it runs in CI too.
 *
 * Run: node scripts/procgen/probe-seedling-ghostsword-items.mjs [--host=http://localhost:8000] [--only=rock-ghost,…] [--repeat=N]
 * `--repeat=N` runs every tape N times, each on its own fresh page (the 8x a slice owes, in one CI job).
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

/** The mixes, as `Bot.as` `grantItem` names. Exported for the unit rows. */
export const MIXES = Object.freeze({
    'ghost': ['ghostsword'],
    'ghost-sword': ['ghostsword', 'sword'],
    'ghost-spear': ['ghostsword', 'spear'],
    'ghost-spear-sword': ['ghostsword', 'spear', 'sword'],
    'sword': ['sword'],
    'spear': ['spear'],
});
/** The same mixes as AP inventories, for the delivery layer. */
const AP_NAME = Object.freeze({ ghostsword: 'Ghost Sword Fusion', spear: 'Ghost Spear', sword: 'Progressive Sword' });

/** L3's ghost rock (`breakablerockghost@0,64`, tag 1) and where its teleporter leads. */
export const ROCK = Object.freeze({ level: 3, tag: 1, to: 111 });
/** L63's lightpole@112,272 (tag 7). */
export const POLE = Object.freeze({ level: 63, tag: 7 });
/** L63's pushableblockspear@112,96 as `botMobiles` reports it. */
export const BLOCK_CLASS = 'Puzzlements::PushableBlockSpear';

/** The tapes: one per scene x mix. Exported for the unit rows. */
export function ghostswordTapes() {
    const tape = (scene, mix, { boot, extra = [], inputs, ticks }) => ({
        scene, mix,
        tape: {
            tape_version: 6, game: 'seedling', noclip: false, noDamage: true, noHazards: [], persistence: [], equips: [],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            name: `ghostsword-items-${scene}-${mix}`, description: `probe-seedling-ghostsword-items: ${scene} ${mix}`,
            boot, grants: [{ level: boot.level, items: [...MIXES[mix], ...extra] }], tick_count: ticks, inputs,
        },
    });
    const press = (dir) => [{ key: dir, from: 0, to: 1 }, { key: 'primary', from: 4, to: 5 }];
    const out = {};
    for (const mix of Object.keys(MIXES)) {
        out[`rock-${mix}`] = tape('rock', mix, { boot: { level: 3, x: 28, y: 64 }, extra: ['conch'],
            inputs: [...press('left'), { key: 'left', from: 30, to: 60 }], ticks: 90 });
        out[`pole-${mix}`] = tape('pole', mix, { boot: { level: 63, x: 128, y: 256 }, inputs: press('left'), ticks: 40 });
        out[`push-${mix}`] = tape('push', mix, { boot: { level: 63, x: 96, y: 96 }, inputs: press('right'), ticks: 60 });
    }
    return out;
}

/** What the game's source says each mix does. Exported for the unit rows. */
export function expected(mix) {
    const items = MIXES[mix];
    const ghost = items.includes('ghostsword'), sword = items.includes('sword'), spear = items.includes('spear');
    const ghostHits = ghost && sword;               // `slash()` runs only under hasSword
    const thrust = spear && !ghost;                 // the ghost splice hides the spear slot
    return { swingTests: sword, rock: ghostHits, pole: ghostHits || thrust, push: ghostHits || thrust,
        slots: ghost ? [4] : sword ? [0] : [3], deliveredGhost: ghost && sword && spear };
}

/** What one run says. Exported for the unit rows. */
export function readRun(scene, ticks, status, blocks) {
    const levels = [...new Set(ticks.map((o) => o.level))];
    const cleared = (status?.persistence_cleared ?? []).map((c) => (typeof c === 'string' ? c : `${c.level}:${c.tag}`));
    const row = { levels, slash: status?.slash ?? null, slots: status?.inventory_slots ?? null,
        items: status?.items ? { hasSword: status.items.hasSword, hasSpear: status.items.hasSpear,
            hasGhostSword: status.items.hasGhostSword } : null };
    if (scene === 'rock') {
        row.rockBroken = cleared.includes(`${ROCK.level}:${ROCK.tag}`);
        row.reachedL111 = levels.includes(ROCK.to);
    }
    if (scene === 'pole') row.poleLit = cleared.includes(`${POLE.level}:${POLE.tag}`);
    if (scene === 'push') {
        const [b0, b1] = [blocks?.start, blocks?.end];
        row.block = { start: b0 ? [b0.x, b0.y] : null, end: b1 ? [b1.x, b1.y] : null };
        row.blockMoved = !!(b0 && (!b1 || b1.x !== b0.x || b1.y !== b0.y));
    }
    return row;
}

/** The scene's verdict field. */
const VERB = Object.freeze({ rock: 'rockBroken', pole: 'poleLit', push: 'blockMoved' });

/** The delivery layer: the flash items the bridge writes for each mix's AP inventory. */
export async function deliveryRows() {
    const { FlashBridgeAdapter } = await import(join(REPO, 'frontend/modules/flashPanel/flashBridgeAdapter.js'));
    const config = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
    const adapter = new FlashBridgeAdapter({ config, flashObjectId: 'probe', stateManager: null, dispatcher: null,
        eventBus: null, log: () => {} });
    return Object.entries(MIXES).map(([mix, items]) => {
        const inventory = Object.fromEntries(items.map((i) => [AP_NAME[i], 1]));
        return { mix, inventory, flash: adapter._inventoryToFlashItems(inventory, { quiet: true }) };
    });
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };

    for (const d of await deliveryRows()) {
        console.log(`DELIVERY ${JSON.stringify(d)}`);
        const want = expected(d.mix).deliveredGhost;
        check(`delivery ${d.mix}: the bridge writes ghostsword ${want ? 'once the recipe holds' : 'NOT AT ALL (recipe incomplete)'}`,
            d.flash.includes('ghostsword') === want, JSON.stringify(d.flash));
    }

    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(failed === 0 ? 0 : 1); }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
    const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const set = vanillaRecordSet(EMBED, MAP).set;
    console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);

    takeBoxLockOrExit({ name: 'probe-seedling-ghostsword-items.mjs', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
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
    const blockOf = async (page) => (await json(page, 'botMobiles'))?.mobiles?.find((m) => m.cls === BLOCK_CLASS) ?? null;
    const logs = [];
    const run = async (tape, scene) => {
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
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const blocks = {};
            if (scene === 'push') {
                blocks.start = await waitFor(page, 'the block', () => blockOf(page), 60000);
            }
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                return st?.finished ? st : null;
            }, 10 * 60 * 1000);
            if (scene === 'push') blocks.end = await blockOf(page);
            const drained = await json(page, 'botDrain');
            return { status, mounted, blocks, ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
        } finally {
            await page.close();
        }
    };
    try {
        const only = arg('only', null)?.split(',');
        const repeat = Math.max(1, Number(arg('repeat', '1')) || 1);
        for (const [name, { scene, mix, tape: raw }] of Object.entries(ghostswordTapes()).flatMap((e) => Array(repeat).fill(e))) {
            if (only && !only.includes(name)) continue;
            const tape = parseTape({ ...raw, pins: [...PIN_NAMES] });
            const g = await run(tape, scene);
            const read = readRun(scene, g.ticks, g.status, g.blocks);
            const want = expected(mix);
            console.log(`ROW ${JSON.stringify({ tape: name, scene, mix, set_id: set.set_id, mounted: g.mounted?.active,
                observations: g.ticks.length, grants: tape.grants, ...read })}`);
            check(`${name}: the game ran the tape to its end on the delivered set`,
                g.ticks.length === tape.tick_count + 1 && g.mounted?.active === set.set_id, `${g.ticks.length} obs, ${g.mounted?.active}`);
            check(`${name}: the slots are ${JSON.stringify(want.slots)} and hasSpear is untouched`,
                JSON.stringify(read.slots) === JSON.stringify(want.slots) && read.items?.hasSpear === MIXES[mix].includes('spear'),
                JSON.stringify({ slots: read.slots, items: read.items }));
            check(`${name}: hit tests ${want.swingTests ? 'run' : 'NEVER run'} (slash() only under hasSword)`,
                ((read.slash?.tests ?? 0) > 0) === want.swingTests, JSON.stringify(read.slash));
            check(`${name}: ${VERB[scene]} = ${want[scene]}`, read[VERB[scene]] === want[scene],
                JSON.stringify(scene === 'push' ? read.block : { levels: read.levels }));
            if (scene === 'rock') {
                check(`${name}: L111 reached = ${want.rock} (the teleporter is under the rock)`, read.reachedL111 === want.rock,
                    JSON.stringify(read.levels));
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
