#!/usr/bin/env node
/**
 * ENTRANCE RANDOMIZATION E5, IN THE LEVEL DATA — the witness, on the wasm runtime (the default) or on the
 * Seedling JS runtime (`--runtime=js`, below).
 * `seedling_er` loaded by `?rules=`, the preset's own build (`flash_panel.wasm`), headless logic-only, under the
 * box lock, on ONE fresh page.
 *
 * The randomized load delivers the level set with every moved stairs' exit rewritten to its shuffled destination
 * (`frontend/modules/seedlingDemo/entranceRetarget.js`, applied by `flashPanel/seedlingRandomizerWiring.js` after
 * the AP item rewrite). So the GAME loads the shuffled room when a shuffled stairs fires: no vanilla room in
 * between, no redirect in the region binding. This probe walks shuffled stairs with a person's keys (no bot) and
 * reads what the game and the host did.
 *
 *   the world  the SAME construction the page makes, made here in node first (`loadSeedlingRandomizer` over the
 *              committed files): the delivered set, its placement table and the retarget plan. The page's own
 *              delivered set must carry the same `set_id`, and the game must report that set mounted.
 *   the pairs  picked from the plan by data (`pickRetargetPairs`): two moved stairs that are each other's
 *              placement target, each landing in the AP region the other departs from. EVERY pair is walked,
 *              both ways (`--pairs=0,3` takes a subset; `ROW pairs` lists them).
 *   each leg   the Tools teleport puts the AP player beside the stairs (a free cell next to its tile, read off
 *              the delivered room: the cell the partner stairs lands on when that is one); the key towards the
 *              stairs is held until the game fires a door. A stairs the delivered room does not let a player
 *              with no item walk onto (a lock on its tile; lava all round it, tried and not fired) is reported
 *              `UNWALKED:` with that reason. Then:
 *                - the `level` reports of the crossing are exactly [the shuffled level]: no vanilla level;
 *                - the position the game reported WITH that level is the retargeted `@playerx` / `@playery`
 *                  (the data, not the vanilla landing: this is what tells the two apart when the vanilla and
 *                  the shuffled destination are the same level);
 *                - the door the game reported is the stairs, and names the shuffled level as its destination;
 *                - the game ends in the shuffled level on the binding's arrival spawn for the landing exit, the
 *                  live player on that cell; the region binding and gameState hold the shuffled region; nothing
 *                  is left armed;
 *                - across the crossing: region moves +1 (through that exit, to the shuffled region), logical
 *                  sub-region hops +0, location checks +0, events collected +0, no "no marked exit" warning;
 *                - the delivered exit's `@sign` is the plan's. ⚠ The room-name message itself is NOT observable
 *                  on this build (a `Message` is no `Mobile`, `Game.sign` is consumed inside the update that
 *                  sets it, and no bot verb lists entities by class): the row reports the sign the game was
 *                  handed and the title `Message.as` holds for it.
 *   the item   one more crossing (`pickItemLeg`: the moved stairs whose shuffled room holds the nearest placed
 *              walk-in pickup the flood reaches from its landing), then the walk onto that `apitem`: exactly one
 *              location check, of that location. The two rewrites compose.
 *
 *   refusal    the same rules on a staged build that cannot take the delivery (it lacks a capability the preset's
 *              build declares; the rules are a scratch copy under the git-ignored `test-results/`): the load is refused BY NAME
 *              as an entrance-randomized world left on vanilla rooms, on the panel's log, in its refusal and on
 *              a sticky overlay over the game.
 *
 *   --runtime=js   THE SAME WITNESS PLAYED ON THE SEEDLING JS RUNTIME (`transport: 'js'`): the panel is booted
 *              with its runtime setting on `js` (`moduleSettings.flashPanel.runtime`, unpersisted), so it mounts
 *              `seedlingDemo/jsRuntime.html` instead of the wasm build. The world is made in node for that
 *              transport, the picker, the legs and every per-leg check are the ones above, unchanged; the page
 *              must have delivered the same `set_id`, the JS runtime must report it mounted (`botLevelSet`),
 *              and its `botStatus` must name the runtime `js`. Differences in the driving only: no ▶ Start and
 *              no logic-only channel (the page boots itself under automation), and the page's canvas is
 *              `#game`. The refusal session is the wasm arm's (it needs a staged build that lacks a
 *              capability; the JS runtime is no build in the manifest) and does not run here.
 *
 * Prints `PASS:`/`FAIL:` rows, `ROW <tag> {json}` measurement rows, and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`
 * (exit 1).
 *
 * Prereqs: a dev server at the repo root (`--host=`, default http://localhost:8000); on the wasm arm the wasm
 * build (the `flashPanel/wasm` submodule), or it SKIPs (exit 0). The JS arm needs no build.
 *
 * Run: node scripts/procgen/probe-seedling-wasm-er-retarget.mjs [--runtime=wasm|js] [--host=http://localhost:8000] [--pairs=0,3] [--no-item] [--no-refusal] [--wait-for-box=<sec>]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { FLASH_PANEL, clickPanelTab, createRoomPlay, roomPath, slotBlockOf } from './seedlingRoomPlay.js';
import { bootRetriesLine, isBootFault, startWasmGame, withBootRetry } from './seedlingProbeBoot.js';

argvHelp(import.meta.url);

/** The preset, by its rules file (served path relative to `frontend/`). */
export const RULES_PATH = './presets/seedling_er/AP_1/AP_1_rules.json';

/** The runtimes this witness plays on: the panel's transport, and the game page it mounts for it. */
export const RUNTIMES = Object.freeze(['wasm', 'js']);
/** The JS runtime's page (`flashPanelUI.JS_RUNTIME_PAGE`'s file name) and its canvas. */
const JS_PAGE = 'jsRuntime.html';
const JS_CANVAS = '#game';
/** The panel setting that picks the runtime (`flashPanelUI.RUNTIME_SETTING_KEY`). */
const RUNTIME_SETTING_KEY = 'moduleSettings.flashPanel.runtime';

/** `--runtime=`'s value: one of `RUNTIMES` (default the first), or null for anything else. */
export function runtimeOf(argv) {
    const given = argv.find((a) => a.startsWith('--runtime='))?.slice('--runtime='.length) ?? RUNTIMES[0];
    return RUNTIMES.includes(given) ? given : null;
}

const ARROWS = [[0, -1, 'ArrowUp'], [-1, 0, 'ArrowLeft'], [1, 0, 'ArrowRight'], [0, 1, 'ArrowDown']];

/**
 * The coupled stairs pairs of a retarget plan, in placement order, read off the preset and the plan alone
 * (`entranceRetarget.planEntranceRetarget`'s `moved` rows). Each is `{out, back}`, a leg being
 * `{row, exit, region, level, tile, partnerLanding, toRegion}`:
 *   - `row` the plan row of a stairs the shuffle moved; `exit` its sidecar departure;
 *   - the two are each other's placement target, and each lands in the AP region the other departs from, so the
 *     way back leaves from where the way out arrived;
 *   - `partnerLanding` where the PARTNER lands in this stairs' level (the retargeted `@playerx` / `@playery`).
 */
export function pickRetargetPairs(rules, moved) {
    const slot = Object.keys(rules.player_names)[0];
    const sidecars = rules.preset_sidecars?.[slot] ?? {};
    const byName = new Map(moved.map((row) => [row.exit, row]));
    const leg = (row, partner) => {
        const payload = sidecars[row.region]?.playable_payload;
        const exit = (payload?.exits ?? []).find((e) => e.exitName === row.exit);
        const tile = exit?.exit_tiles?.[0];
        if (!exit || !tile || row.targetRegion !== partner.region || partner.to.to !== row.level) return null;
        return { row, exit, region: row.region, level: row.level, tile, tileSize: payload.tile_size,
            partnerLanding: { x: partner.to.playerx, y: partner.to.playery }, toRegion: row.targetRegion };
    };
    const out = [];
    const seen = new Set();
    for (const row of moved) {
        const partner = byName.get(row.target);
        if (seen.has(row.exit) || !partner || partner.target !== row.exit) continue;
        const a = leg(row, partner);
        const b = leg(partner, row);
        if (!a || !b) continue;
        seen.add(row.exit);
        seen.add(partner.exit);
        out.push({ out: a, back: b });
    }
    return out;
}

/**
 * Where to stand to walk onto a stairs by hand, with no item: `{spots, why}`. `spots` are the free cells next
 * to its tile in the delivered room (the flood's, every solid live), the one the partner lands on first and
 * the HAZARD cells last (water, lava, a pit, by the room's own collision world: `hazard: true`); each
 * `{x, y, key}`, a `new Game` position (the cell's top-left) and the arrow from there onto the stairs. With no
 * spot, `why` says what the delivered room puts in the way: a solid ON the stairs' tile (a lock), or no free
 * cell. ⚠ A hazard cell is still TRIED: MEASURED, one stairs' only approach cell is flagged water and walks
 * (shallow), while another's four are lava and the player does not move. A leg is unwalkable by hand only when
 * no cell fired the stairs and every cell was a hazard (the logic gates such a stairs behind an item, and the
 * witness carries none).
 */
export function approachSpots(record, leg, { walkableCellsFrom, buildLevelWorld }) {
    const [tx, ty] = leg.tile;
    const size = leg.tileSize;
    let flood;
    try { flood = walkableCellsFrom(record, { tx, ty }); } catch {
        const on = (record.entities ?? []).filter((e) => Math.floor(e.x / size) === tx && Math.floor(e.y / size) === ty
            && !['teleporter', 'stairsup', 'stairsdown'].includes(e.type)).map((e) => `${e.type}@(${e.x},${e.y})`);
        return { spots: [], why: `the stairs' tile is solid in the delivered room${on.length ? ` (${on.join(', ')} stands on it)` : ''}` };
    }
    const world = buildLevelWorld(record);
    const hazards = new Set([...world.lethalTerrainTiles, ...world.pitTiles].map((t) => `${Math.floor(t.x / size)},${Math.floor(t.y / size)}`));
    const landing = { tx: Math.floor(leg.partnerLanding.x / size), ty: Math.floor(leg.partnerLanding.y / size) };
    const free = ARROWS.map(([dx, dy]) => ({ tx: tx + dx, ty: ty + dy })).filter((c) => flood.has(`${c.tx},${c.ty}`));
    const spots = free
        .map((c) => ({ x: c.tx * size, y: c.ty * size,
            key: ARROWS.find(([dx, dy]) => dx === tx - c.tx && dy === ty - c.ty)[2],
            partner: c.tx === landing.tx && c.ty === landing.ty, hazard: hazards.has(`${c.tx},${c.ty}`) }))
        .sort((a, b) => (Number(a.hazard) - Number(b.hazard)) || (Number(b.partner) - Number(a.partner)));
    return { spots, why: spots.length > 0 ? null : 'the delivered room has no free cell beside the stairs\' tile' };
}

/**
 * How far the live player may stand from its arrival cell's centre: half a tile, plus up to two tiles ALONG the
 * key the probe was still holding when the room loaded (a held arrow walks the player on until it is released;
 * MEASURED on an arrival with open floor ahead: 21 px).
 */
export function onArrivalCell(live, spawn, tile, key) {
    if (!live || !spawn) return false;
    const dx = live.x - (spawn.x + tile / 2);
    const dy = live.y - (spawn.y + tile / 2);
    const [ax, ay] = (ARROWS.find((a) => a[2] === key) ?? [0, 0]);
    const along = dx * ax + dy * ay;
    const across = Math.abs(dx * ay) + Math.abs(dy * ax);
    return across <= tile / 2 && along >= -tile / 2 && along <= 2 * tile;
}

/**
 * The leg that also picks up a placed item: over every pair leg, the placed walk-in pickup (`kind: 'pickup'`, a
 * rewritten row) of the leg's shuffled room that the flood reaches from the leg's landing in the fewest steps.
 * `{leg, entry, dist}` or null.
 */
export function pickItemLeg(legs, entries, roomOf, walkableCellsFrom) {
    let best = null;
    for (const leg of legs) {
        const { to } = leg.row;
        const record = roomOf(to.to);
        let flood;
        try {
            flood = walkableCellsFrom(record, { tx: Math.floor(to.playerx / leg.tileSize), ty: Math.floor(to.playery / leg.tileSize) });
        } catch { continue; }
        for (const entry of entries) {
            if (entry.level !== to.to || entry.kind !== 'pickup' || entry.rewrite === false) continue;
            const dist = flood.get(`${Math.floor(entry.entity.x / leg.tileSize)},${Math.floor(entry.entity.y / leg.tileSize)}`)?.dist;
            if (Number.isInteger(dist) && (!best || dist < best.dist)) best = { leg, entry, dist };
        }
    }
    return best;
}

/** `Message.as`'s titles, read off the vendored source (null when it is not checked out). */
export function messageTitles(repo) {
    const path = join(repo, 'vendor/seedling/src/Message.as');
    if (!existsSync(path)) return null;
    const m = /titles:Array = new Array\(([^)]*)\)/.exec(readFileSync(path, 'utf8'));
    return m ? [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]) : null;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const RUNTIME = runtimeOf(process.argv);
    if (!RUNTIME) {
        console.log(`unknown --runtime (one of ${RUNTIMES.join(', ')})`);
        process.exit(2);
    }
    const JS = RUNTIME === 'js';
    takeBoxLockOrExit({ name: `probe-seedling-wasm-er-retarget.mjs${JS ? ' --runtime=js' : ''}`, kind: 'browser' });
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const FRONTEND = join(REPO, 'frontend');
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const WITH_ITEM = !process.argv.includes('--no-item');
    // the refusal needs a staged BUILD that lacks a capability: the wasm arm's
    const WITH_REFUSAL = !JS && !process.argv.includes('--no-refusal');
    const REFUSAL_RULES_NAME = 'er-retarget-refusal-rules.json';
    const REFUSAL_RULES = join(REPO, 'test-results', REFUSAL_RULES_NAME);
    const readJson = (rel) => JSON.parse(readFileSync(join(FRONTEND, rel), 'utf8'));
    const PRESET = readJson(RULES_PATH);
    const SLOT = Object.keys(PRESET.player_names)[0];
    const WASM_PAGE = slotBlockOf(PRESET, 'flash_panel')?.wasm ?? '';
    /** The game page this arm's iframe is: the preset's build, or the JS runtime's page. */
    const GAME_PAGE = JS ? JS_PAGE : WASM_PAGE;
    if (!JS && (!WASM_PAGE || !existsSync(join(FRONTEND, 'modules/flashPanel/wasm', WASM_PAGE)))) {
        console.log(`SKIP: seedling wasm artifact not staged (${JSON.stringify(WASM_PAGE)})`);
        process.exit(0);
    }

    // ── the world, made here the way the page makes it ──────────────────
    const { loadSeedlingRandomizer } = await import('../../frontend/modules/flashPanel/seedlingRandomizerWiring.js');
    const { walkableCellsFrom } = await import('../../frontend/modules/seedlingDemo/levelSetExits.js');
    const { buildLevelWorld } = await import('../../frontend/modules/seedlingDemo/levelWorld.js');
    const locations = new Map();
    for (const [regionName, region] of Object.entries(PRESET.regions[SLOT])) {
        for (const loc of region.locations ?? []) locations.set(loc.name, { ...loc, region: regionName });
    }
    const WORLD = await loadSeedlingRandomizer({
        flashPanel: PRESET.flash_panel[SLOT],
        // ⛓ the transport the page will run: the JS runtime answers its capabilities itself, no manifest is its question
        transport: RUNTIME,
        manifest: JS ? null : JSON.parse(readFileSync(join(FRONTEND, 'modules/flashPanel/wasm/builds.json'), 'utf8')),
        rawRules: PRESET,
        locations,
        playerId: SLOT,
        gameConfig: readJson('modules/flashPanel/games/seedling.json'),
        baseUrl: pathToFileURL(`${FRONTEND}/`).href,
        fetchJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
        importModule: (u) => import(u),
    });
    const MOVED = WORLD.entrances?.moved ?? [];
    const roomOf = (level) => WORLD.set?.rooms?.find((r) => r.id === level)?.source?.record ?? null;
    const PAIRS = pickRetargetPairs(PRESET, MOVED);
    const wanted = arg('pairs', null);
    const TAKEN = wanted === null ? PAIRS.map((_, i) => i) : wanted.split(',').map(Number);
    const walkable = (leg) => approachSpots(roomOf(leg.level), leg, { walkableCellsFrom, buildLevelWorld }).spots.some((sp) => !sp.hazard);
    const ITEM = WITH_ITEM ? pickItemLeg(PAIRS.flatMap((p) => [p.out, p.back]).filter(walkable), WORLD.entries ?? [], roomOf, walkableCellsFrom) : null;
    // ⛓ the refusal: the same world on a staged build that cannot take this delivery (it lacks a capability the
    // preset's own build declares), picked from the manifest
    const MANIFEST = WITH_REFUSAL ? readJson('modules/flashPanel/wasm/builds.json') : { builds: [] };
    const capsOf = (page) => MANIFEST.builds.find((b) => page.startsWith(`${b.name}/`))?.capabilities ?? [];
    const OTHER_BUILD = WITH_REFUSAL ? (MANIFEST.builds.find((b) => capsOf(WASM_PAGE).some((c) => !(b.capabilities ?? []).includes(c))
        && existsSync(join(FRONTEND, 'modules/flashPanel/wasm', b.name, 'game.html'))) ?? null) : null;
    const TITLES = messageTitles(REPO);

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const failed = await withBootRetry('ER', () => runSession());
    await browser.close();
    console.log(bootRetriesLine());
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);

    async function runSession() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
        const rp = createRoomPlay({ page, wasmPage: GAME_PAGE, logs, name: `er-retarget-${RUNTIME}` });
        const { check } = rp;
        /**
         * The keyboard into the game. The JS page's canvas is `#game` (the wasm page's `#canvas` is what the
         * shared hands click and focus), so on the JS arm the same two recipes run here against it.
         */
        const focusGame = !JS ? () => rp.focusGame() : async () => {
            await clickPanelTab(page, FLASH_PANEL);
            await page.waitForTimeout(300);
            await rp.gameFrame().click(JS_CANVAS);
            for (const k of ARROWS.map((a) => a[2])) {
                // eslint-disable-next-line no-await-in-loop
                await page.keyboard.up(k);
            }
            await page.waitForTimeout(200);
        };
        const holdUntil = !JS ? (key, until, ceilingMs) => rp.holdUntil(key, until, ceilingMs) : async (key, until, ceilingMs) => {
            await rp.gameFrame().evaluate((sel) => document.querySelector(sel)?.focus(), JS_CANVAS);
            const start = Date.now();
            await page.keyboard.down(key);
            let value = null;
            try {
                while (!value && Date.now() - start < ceilingMs) {
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(50);
                    // eslint-disable-next-line no-await-in-loop
                    value = await until();
                }
            } finally {
                await page.keyboard.up(key);
            }
            return { value, ms: Date.now() - start };
        };
        const out = (tag, o) => console.log(`ROW ${tag} ${JSON.stringify(o)}`);
        const panelLog = () => page.evaluate(() => (document.querySelector('.flash-panel-log')?.textContent ?? ''));
        const panelLogTail = async () => (await panelLog()).split('\n').slice(-12).join(' | ');
        const glue = () => page.evaluate(async () => {
            const g = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
            const b = g.binding;
            const s = g.stats;
            return { region: b.region, lastLevel: b.lastLevel, marks: g.swapState().marks,
                stats: { teleports: s.teleports, regionMoves: s.regionMoves, logicalMoves: s.logicalMoves,
                    locationChecks: s.locationChecks, eventsCollected: s.eventsCollected, warnings: s.warnings } };
        });
        const delta = (a, b) => Object.fromEntries(Object.keys(a.stats).map((k) => [k, b.stats[k] - a.stats[k]]));

        /**
         * The game's own `level` / `pendingExit` reports, each stamped when it arrives with the position the game
         * has declared so far (`playerPositionX/Y` are declared before `level`, so a level report's stamp is the
         * landing the game constructed that level with). The adapter re-installs `_stateHook` on the bridge at
         * every push tick, so the wrap is on the adapter's own field.
         */
        const installReports = () => page.evaluate(async () => {
            const a = (await import('./modules/flashPanel/index.js')).getActivePanelInstance()?.adapter;
            if (!a || a.__erReports) return !!a;
            window.__erReports = [];
            let state = {};
            try { state = JSON.parse(a.readState()); } catch { /* the first reports fill it */ }
            const pos = { x: state.playerPositionX ?? null, y: state.playerPositionY ?? null };
            const hook = a._stateHook;
            a._stateHook = (property, value) => {
                if (property === 'playerPositionX') pos.x = Number(value);
                if (property === 'playerPositionY') pos.y = Number(value);
                if (property === 'level' || property === 'pendingExit') {
                    window.__erReports.push({ property, value, ms: Math.round(performance.now()), x: pos.x, y: pos.y });
                }
                return hook(property, value);
            };
            a.__erReports = true;
            return true;
        });
        const reports = () => page.evaluate(() => window.__erReports ?? []);
        const warnings = () => logs.filter((l) => l.includes('has no marked exit to')).length;
        /** Every leg asked for: walked, or unwalkable by hand for a reason read off the delivered room. */
        const legs = { total: 0, walked: 0, unwalked: [] };
        /** The delivered set as the PAGE holds it: its id, and one exit's attributes. */
        const pageSet = (level = null, index = null) => page.evaluate(async ({ lv, ix }) => {
            const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
            const set = p?._seedlingRealSet ?? null;
            if (!set) return null;
            const exits = lv === null ? [] : (set.rooms.find((r) => r.id === lv)?.source?.record?.entities ?? [])
                .filter((e) => ['teleporter', 'stairsup', 'stairsdown'].includes(e.type) && (e.attrs?.to ?? '') !== '');
            return { set_id: set.set_id, exit: ix === null ? null : (exits[ix] ?? null) };
        }, { lv: level, ix: index });

        /** The new game's ceremony (the intro, then the Help freeze until an arrow), waited out with the engine's own reading. */
        async function ceremony() {
            const { newGameCeremony } = await import('../../frontend/modules/seedlingDemo/wasmPlayback.js');
            const seen = [];
            let dismissed = 0;
            const c0 = Date.now();
            await focusGame();
            for (let quiet = 0; quiet < 2 && Date.now() - c0 < 180000;) {
                // eslint-disable-next-line no-await-in-loop
                const st = JSON.parse(await rp.gameFrame().evaluate(() => window.__swfBridge.game.botStatus()));
                // eslint-disable-next-line no-await-in-loop
                const what = newGameCeremony({ status: st, state: await rp.readGameState() });
                if (what && seen.at(-1) !== what) seen.push(what);
                quiet = what ? 0 : quiet + 1;
                if (what === 'tutorial' && dismissed === 0) {
                    dismissed += 1;
                    // eslint-disable-next-line no-await-in-loop
                    await page.keyboard.down('ArrowRight');
                    // eslint-disable-next-line no-await-in-loop
                    await page.waitForTimeout(100);
                    // eslint-disable-next-line no-await-in-loop
                    await page.keyboard.up('ArrowRight');
                }
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(500);
            }
            return { seen, dismissed, ms: Date.now() - c0 };
        }

        /** Stand on `spot` of the leg's region (the Tools teleport), settled. */
        async function standAt(leg, spot) {
            const took = await page.evaluate(async ({ region, level, x, y }) => {
                const g = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
                return g.teleportTool({ region, level, x, y });
            }, { region: leg.region, level: leg.level, x: spot.x, y: spot.y });
            if (took?.taken !== true) return { ok: false, why: `the Tools teleport declined: ${took?.why}` };
            const there = await rp.waitFor(`${leg.row.exit}: the player stands at (${spot.x}, ${spot.y})`, async () => {
                const g = await rp.readGameState();
                if (g.level !== leg.level || g.playerPositionX !== spot.x || g.playerPositionY !== spot.y) return null;
                const s = await glue();
                return s.region === leg.region && s.lastLevel === leg.level && s.marks.length === 0 ? s : null;
            }, 30000).catch((e) => ({ error: e.message }));
            if (there.error) return { ok: false, why: there.error };
            await page.waitForTimeout(500);
            await focusGame();
            return { ok: true };
        }

        /**
         * One crossing: stand beside the stairs, walk onto it, and read where everything ended. Returns the
         * measurements, or null when no approach cell fired the stairs.
         */
        async function cross(tag, leg) {
            const { row } = leg;
            const name = `${tag} (${row.exit})`;
            const { spots, why } = approachSpots(roomOf(leg.level), leg, { walkableCellsFrom, buildLevelWorld });
            legs.total += 1;
            if (spots.length === 0) {
                legs.unwalked.push({ leg: tag, exit: row.exit, door: row.door, why });
                console.log(`UNWALKED: ${name} — ${why}`);
                return null;
            }
            let fired = null;
            const tried = [];
            for (const spot of spots) {
                // eslint-disable-next-line no-await-in-loop
                const stood = await standAt(leg, spot);
                if (!stood.ok) { tried.push({ spot, why: stood.why }); continue; }
                // eslint-disable-next-line no-await-in-loop
                const g0 = await glue();
                // eslint-disable-next-line no-await-in-loop
                const moves0 = (await rp.glueMoves()).length;
                // eslint-disable-next-line no-await-in-loop
                const reports0 = (await reports()).length;
                const warn0 = warnings();
                // eslint-disable-next-line no-await-in-loop
                const held = await holdUntil(spot.key, async () => ((await reports()).slice(reports0)
                    .some((r) => r.property === 'pendingExit') ? 'fired' : null), 5000);
                if (held.value === 'fired') { fired = { spot, g0, moves0, reports0, warn0, held }; break; }
                // eslint-disable-next-line no-await-in-loop
                tried.push({ spot, why: 'no door fired', live: await rp.livePlayer() });
            }
            if (!fired && spots.every((sp) => sp.hazard)) {
                const reason = `the stairs fired from none of its ${spots.length} approach cell(s), and every one is water, lava or a pit in the delivered room`;
                legs.unwalked.push({ leg: tag, exit: row.exit, door: row.door, why: reason, tried });
                console.log(`UNWALKED: ${name} — ${reason} — ${JSON.stringify(tried)}`);
                return null;
            }
            check(`${name}: walking onto the stairs fired it`, !!fired,
                fired ? JSON.stringify({ from: fired.spot, ms: fired.held.ms, skipped: tried }) : JSON.stringify(tried));
            if (!fired) return null;
            legs.walked += 1;
            const { g0, moves0, reports0, warn0 } = fired;
            const toLevel = row.to.to;
            const end = await rp.waitFor(`${name}: the game in level ${toLevel} and the binding settled`, async () => {
                const g = await rp.readGameState();
                if (g.level !== toLevel) return null;
                const s = await glue();
                return s.region !== leg.region && s.lastLevel === toLevel && s.marks.length === 0 ? { g, s } : null;
            }, 30000).catch((e) => ({ error: e.message }));
            await page.waitForTimeout(1000);
            const state = await rp.readGameState();
            const g1 = await glue();
            const arrival = await rp.arrival();
            const live = await rp.livePlayer();
            const region = await rp.currentRegion();
            const moves = (await rp.glueMoves()).slice(moves0).map((m) => ({ from: m.sourceRegion, to: m.targetRegion, exit: m.exitName }));
            const seen = (await reports()).slice(reports0);
            const levels = seen.filter((r) => r.property === 'level');
            const doors = seen.filter((r) => r.property === 'pendingExit').map((r) => rp.parsePending(r.value));
            const counted = delta(g0, g1);
            const delivered = (await pageSet(leg.level, row.index))?.exit ?? null;
            const sign = Number(delivered?.attrs?.sign ?? 0);
            const m = {
                exit: row.exit, door: row.door, from: { region: leg.region, level: leg.level, spot: fired.spot },
                vanilla: row.from, shuffled: { region: leg.toRegion, ...row.to, landingExit: leg.exit.targetExitId },
                reports: seen.map((r) => `${r.property}=${r.value}@(${r.x},${r.y})`),
                levelsLoaded: levels.map((r) => Number(r.value)),
                end: { level: state.level, checkpoint: { x: state.playerPositionX, y: state.playerPositionY }, live,
                    arrivalSpawn: arrival.spawn, bindingRegion: g1.region, gameStateRegion: region },
                moves, counted, warnings: warnings() - warn0,
                message: { deliveredSign: sign, announces: sign > 0 ? (TITLES?.[sign - 1] ?? `title ${sign}`) : null,
                    observed: 'not observable on this build' },
                heldMs: fired.held.ms, settle: end.error ?? 'settled',
            };
            out(`${tag} leg`, m);
            const tile = leg.tileSize;
            check(`${name}: the door the game fired is the stairs, and it names the shuffled level ${toLevel} (vanilla: ${row.from.to})`,
                doors.length === 1 && doors[0]?.fromLevel === leg.level && `out_${doors[0].type}_${doors[0].x}_${doors[0].y}` === row.door
                    && doors[0].to === toLevel, JSON.stringify(doors));
            check(`${name}: the game loaded exactly the shuffled level ${toLevel}, no other level in between (the flash: 0)`,
                JSON.stringify(m.levelsLoaded) === JSON.stringify([toLevel]), JSON.stringify(m.levelsLoaded));
            check(`${name}: the game constructed it at the retargeted landing (${row.to.playerx}, ${row.to.playery}), not the vanilla exit's (level ${row.from.to} at ${row.from.playerx}, ${row.from.playery})`,
                levels.length > 0 && levels[0].x === row.to.playerx && levels[0].y === row.to.playery,
                JSON.stringify(levels.map((r) => [r.x, r.y])));
            check(`${name}: exactly ONE region move, through that exit, to the shuffled region ${leg.toRegion}`,
                moves.length === 1 && moves[0].from === leg.region && moves[0].to === leg.toRegion && moves[0].exit === row.exit,
                JSON.stringify(moves));
            check(`${name}: across the crossing: region moves +1, logical hops +0, location checks +0, events collected +0, no warning`,
                counted.regionMoves === 1 && counted.logicalMoves === 0 && counted.locationChecks === 0 && counted.eventsCollected === 0
                    && counted.warnings === 0 && m.warnings === 0, JSON.stringify({ ...counted, noMarkedExit: m.warnings }));
            check(`${name}: the game ended in the shuffled level ${toLevel}`, state.level === toLevel, `level=${state.level}`);
            check(`${name}: its checkpoint is the arrival spawn of the landing exit ${leg.exit.targetExitId} (${arrival.spawn?.landing})`,
                !!arrival.spawn && arrival.spawn.exitId === leg.exit.targetExitId && arrival.spawn.matchedArrivedFrom === true
                    && state.playerPositionX === arrival.spawn.x && state.playerPositionY === arrival.spawn.y,
                JSON.stringify({ checkpoint: [state.playerPositionX, state.playerPositionY], spawn: arrival.spawn }));
            check(`${name}: the live player stands on that cell (or walked on from it under the held ${fired.spot.key})`,
                onArrivalCell(live, arrival.spawn, tile, fired.spot.key), JSON.stringify({ live, spawn: arrival.spawn }));
            check(`${name}: the region binding and gameState hold ${leg.toRegion}, nothing left armed`,
                g1.region === leg.toRegion && region === leg.toRegion && g1.marks.length === 0 && g1.lastLevel === toLevel,
                JSON.stringify({ binding: g1.region, gameState: region, marks: g1.marks, lastLevel: g1.lastLevel }));
            check(`${name}: the delivered exit carries the plan's destination and sign ${row.to.sign} (${m.message.announces ?? 'announces nothing'}; the vanilla exit's was ${row.from.sign})`,
                !!delivered && Number(delivered.attrs.to) === row.to.to && Number(delivered.attrs.playerx) === row.to.playerx
                    && Number(delivered.attrs.playery) === row.to.playery && sign === row.to.sign, JSON.stringify(delivered));
            return m;
        }

        /** The composed leg: cross a shuffled stairs, then walk onto the placed item of the room it lands in. */
        async function itemLeg({ leg, entry, dist }) {
            const name = `ITEM (${leg.row.exit}, then "${entry.location}")`;
            out('item pick', { exit: leg.row.exit, toLevel: leg.row.to.to, location: entry.location, ledgerId: entry.ledgerId,
                entity: entry.entity, placed: { item: entry.item, player: entry.player, look: entry.look }, floodDist: dist });
            const delivered = await page.evaluate(async ({ lv, x, y }) => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                return (p?._seedlingRealSet?.rooms.find((r) => r.id === lv)?.source?.record?.entities ?? [])
                    .find((e) => e.x === x && e.y === y && e.type === 'apitem') ?? null;
            }, { lv: entry.level, x: entry.entity.x, y: entry.entity.y });
            check(`${name}: the delivered room ${entry.level} holds the AP item at (${entry.entity.x}, ${entry.entity.y}) — the item rewrite and the exit retarget are in ONE set`,
                !!delivered, JSON.stringify(delivered));
            const crossed = await cross('ITEM', leg);
            if (!crossed) return;
            const size = leg.tileSize;
            const record = roomOf(entry.level);
            const live = await rp.livePlayer();
            const from = { tx: Math.floor(live.x / size), ty: Math.floor(live.y / size) };
            const to = { tx: Math.floor(entry.entity.x / size), ty: Math.floor(entry.entity.y / size) };
            const exits = (record.entities ?? []).filter((e) => ['teleporter', 'stairsup', 'stairsdown'].includes(e.type))
                .map((e) => ({ exit_tiles: [[Math.floor(e.x / size), Math.floor(e.y / size)]] }));
            const path = roomPath({ record, start: from, tile_size: size, exits }, from, to, { walkableCellsFrom, buildLevelWorld });
            check(`${name}: the delivered room has a walk from the arrival (${from.tx}, ${from.ty}) to the item (${to.tx}, ${to.ty})`,
                !!path, path ? `${path.length - 1} step(s)` : 'no path');
            if (!path) return;
            const g0 = await glue();
            const log0 = (await panelLog()).length;
            const checked = async () => ((await glue()).stats.locationChecks > g0.stats.locationChecks);
            const walk = await rp.walkPath(path, { tile: size, stopWhen: checked });
            await rp.waitFor(`${name}: the check is reported`, checked, 10000).catch(() => null);
            await page.waitForTimeout(500);
            const g1 = await glue();
            const counted = delta(g0, g1);
            const lines = (await panelLog()).slice(log0).split('\n').filter((l) => l.includes('[ap placement] checked'));
            const state = await rp.readGameState();
            out('ITEM pickup', { walk: { ok: walk.ok, steps: walk.steps, stopped: walk.stopped ?? false, why: walk.why ?? null, trace: walk.trace },
                counted, lines, level: state.level, region: g1.region });
            check(`${name}: walking onto it made exactly ONE location check, of "${entry.location}"`,
                counted.locationChecks === 1 && lines.length === 1 && lines[0].includes(`"${entry.location}"`), JSON.stringify({ counted, lines }));
            check(`${name}: the pickup moved nothing else (no region move, no logical hop, no warning; still in level ${entry.level}, region ${leg.toRegion})`,
                counted.regionMoves === 0 && counted.logicalMoves === 0 && counted.warnings === 0 && state.level === entry.level && g1.region === leg.toRegion,
                JSON.stringify({ counted, level: state.level, region: g1.region }));
        }

        try {
            out('world', { verdict: WORLD.verdict, set_id: WORLD.set?.set_id ?? null, itemsPlaced: WORLD.replaced,
                stairsRetargeted: WORLD.entrances?.retargeted ?? 0, unmoved: WORLD.entrances?.unmoved ?? [] });
            check('the load, made in node from the committed files, is eligible and retargets stairs', WORLD.verdict === 'eligible' && MOVED.length > 0,
                `${WORLD.verdict}: ${MOVED.length} moved`);
            const inPairs = new Set(PAIRS.flatMap((p) => [p.out.row.exit, p.back.row.exit]));
            out('pairs', { walkable: PAIRS.length, taking: TAKEN, unpaired: MOVED.filter((r) => !inPairs.has(r.exit)).map((r) => r.exit),
                list: PAIRS.map((p) => `${p.out.row.exit} <> ${p.back.row.exit}`) });
            check('every moved stairs is in a coupled pair the witness can walk', inPairs.size === MOVED.length && TAKEN.every((i) => PAIRS[i]),
                `${inPairs.size} of ${MOVED.length} moved exits in ${PAIRS.length} pair(s)`);
            if (TAKEN.some((i) => !PAIRS[i])) return rp.failures();
            await page.goto(`${HOST}/frontend/?rules=${RULES_PATH}`, { waitUntil: 'domcontentloaded' });
            await rp.waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await rp.installWatchers();
            if (JS) {
                // ⛓ the panel's own runtime switch, set before the tab first activates (so its init reads `js`)
                await page.evaluate(async (key) => {
                    const sm = (await import('./app/core/settingsManager.js')).default;
                    await sm.updateSetting(key, 'js', { persist: false });
                }, RUNTIME_SETTING_KEY);
            }
            await rp.waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await rp.waitFor(`${RUNTIME} iframe mounted`, async () => page.frames().some((fr) => fr.url().includes(GAME_PAGE)));
            if (!JS) {
                await startWasmGame(() => rp.gameFrame(), { logs });
                await assertLogicOnlyChannel(rp.gameFrame());
            }
            await rp.waitFor("panel status 'ready'", async () => ((await page.evaluate(() =>
                document.querySelector('.flash-panel-status')?.textContent ?? '')) === 'ready' ? 'ready' : null), 120000);
            await rp.waitForApLoad(120000);
            const mounted = await rp.readLevelSet();
            const held = await pageSet();
            out('delivered', { page: held?.set_id ?? null, game: mounted?.active ?? mounted });
            check('the page delivered the set this probe built (same set_id), and the game reports it mounted',
                held?.set_id === WORLD.set.set_id && String(mounted?.active ?? '') === WORLD.set.set_id,
                JSON.stringify({ node: WORLD.set.set_id, page: held?.set_id, game: mounted?.active }));
            const ran = await page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                return { transport: p?.transport ?? null, setting: p?._initRuntime ?? null };
            });
            const status = JSON.parse(await rp.gameFrame().evaluate(() => window.__swfBridge.game.botStatus()));
            const frameUrl = new URL(rp.gameFrame().url());
            out('runtime', { asked: RUNTIME, panel: ran, game: status.runtime ?? null, page: `${frameUrl.pathname.split('/').pop()}${frameUrl.search}`,
                wire: await rp.gameFrame().evaluate(() => window.__swfBridge.game.wireCheck?.() ?? null) });
            check(`the game played is the ${RUNTIME} runtime: the panel runs transport "${RUNTIME}" and the game page says so`,
                ran.transport === RUNTIME && (status.runtime === 'js') === JS, JSON.stringify({ ...ran, game: status.runtime ?? null }));
            await rp.waitFor('the report recorder installed', installReports, 20000);
            out('ceremony', await ceremony());
            for (const i of TAKEN) {
                // eslint-disable-next-line no-await-in-loop
                await cross(`PAIR ${i} OUT`, PAIRS[i].out);
                // eslint-disable-next-line no-await-in-loop
                await cross(`PAIR ${i} BACK`, PAIRS[i].back);
            }
            out('legs', legs);
            check('every leg was walked, or is unwalkable by hand for a reason read off the delivered room (named above)',
                legs.walked + legs.unwalked.length === legs.total && legs.walked > 0, JSON.stringify({ walked: legs.walked,
                    unwalked: legs.unwalked.map((u) => `${u.leg} ${u.exit}: ${u.why}`) }));
            if (WITH_ITEM) {
                check('a moved stairs lands in a room with a placed walk-in pickup the flood reaches', !!ITEM, ITEM ? ITEM.entry.location : 'none');
                if (ITEM) await itemLeg(ITEM);
            }
            console.log(`INFO: the room-name message is not observable ${JS ? 'through the bridge verbs this witness reads' : 'on this build'}; each leg row carries the sign the game was handed (Message.as titles: ${JSON.stringify(TITLES)})`);
            console.log(`INFO: ${logs.filter((l) => l.startsWith('[pageerror]')).length} page error(s)${JS ? '' : ' (the logic-only channel\'s device loss)'}`);
            console.log(`INFO: panel log: ${await panelLogTail().catch(() => '?')}`);
        } catch (e) {
            if (isBootFault(e)) { await page.close(); throw e; }
            check(`fatal: ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
            console.log(`INFO: panel log: ${await panelLogTail().catch(() => '?')}`);
        }
        await page.close();
        return rp.failures() + (WITH_REFUSAL ? await refusalSession() : 0);
    }

    /**
     * The same rules on a build that cannot take the delivery: the load is refused, and because the world places
     * entrances the panel says so BY NAME, on its log, in `_apLoadRefusal` and on a sticky overlay over the game.
     */
    async function refusalSession() {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        const logs = [];
        page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
        const { check, failures, waitFor, gameFrame } = createRoomPlay({ page, wasmPage: OTHER_BUILD ? `${OTHER_BUILD.name}/game.html` : WASM_PAGE,
            logs, name: 'er-refusal' });
        try {
            check('the manifest holds a staged build that lacks a capability the preset\'s build declares', !!OTHER_BUILD,
                OTHER_BUILD ? `${OTHER_BUILD.name}: ${JSON.stringify(OTHER_BUILD.capabilities ?? [])}` : 'none');
            if (!OTHER_BUILD) { await page.close(); return failures(); }
            const otherPage = `${OTHER_BUILD.name}/game.html`;
            const rules = structuredClone(PRESET);
            rules.flash_panel[SLOT] = { ...rules.flash_panel[SLOT], wasm: otherPage };
            // ⛓ a scratch rules file under the git-ignored `test-results/` (served like any path; removed below):
            // a fulfilled route was measured stalling the app's boot on this page
            mkdirSync(dirname(REFUSAL_RULES), { recursive: true });
            writeFileSync(REFUSAL_RULES, JSON.stringify(rules));
            await page.goto(`${HOST}/frontend/?rules=../test-results/${REFUSAL_RULES_NAME}`, { waitUntil: 'domcontentloaded' });
            await waitFor('rules loaded', () => page.evaluate(() => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0));
            await waitFor('the flashPanel tab activated', () => clickPanelTab(page, FLASH_PANEL));
            await waitFor('wasm iframe mounted', async () => page.frames().some((fr) => fr.url().includes(otherPage)));
            await startWasmGame(() => gameFrame(), { logs });
            const seen = await waitFor('the AP load answered', () => page.evaluate(async () => {
                const p = (await import('./modules/flashPanel/index.js')).getActivePanelInstance();
                if (!p?._apLoadRefusal && !p?._apLoadResult) return null;
                const overlay = document.querySelector('.flash-panel-ap-overlay');
                return { refusal: p._apLoadRefusal ?? null, delivered: !!p._seedlingDelivery,
                    overlay: overlay ? { shown: getComputedStyle(overlay).display !== 'none', text: overlay.textContent } : null,
                    log: (document.querySelector('.flash-panel-log')?.textContent ?? '').split('\n').filter((l) => l.includes('ENTRANCE RANDOMIZATION')) };
            }), 180000);
            const brief = (t) => (typeof t === 'string' && t.length > 260 ? `${t.slice(0, 260)}… (${t.length} chars)` : t);
            console.log(`ROW refusal ${JSON.stringify({ build: OTHER_BUILD.name, refusal: brief(seen.refusal), delivered: seen.delivered,
                overlay: seen.overlay ? { shown: seen.overlay.shown, sameText: seen.overlay.text === seen.refusal } : null, logLines: seen.log.length })}`);
            check(`REFUSAL (${OTHER_BUILD.name}): the load is refused and names the entrance randomization, with the reason`,
                typeof seen.refusal === 'string' && seen.refusal.startsWith('ENTRANCE RANDOMIZATION') && seen.refusal.includes('not delivered')
                    && seen.delivered === false, JSON.stringify({ refusal: brief(seen.refusal), delivered: seen.delivered }));
            check(`REFUSAL (${OTHER_BUILD.name}): a sticky overlay over the game says so, and the panel log carries the line`,
                seen.overlay?.shown === true && seen.overlay.text === seen.refusal && seen.log.length === 1,
                JSON.stringify({ shown: seen.overlay?.shown, sameText: seen.overlay?.text === seen.refusal, logLines: seen.log.length }));
        } catch (e) {
            if (isBootFault(e)) { await page.close(); throw e; }
            check(`fatal (refusal): ${e.message}`, false, e.stack?.split('\n').slice(0, 4).join(' / '));
        }
        rmSync(REFUSAL_RULES, { force: true });
        await page.close();
        return failures();
    }
}
