/**
 * In-app tests for the Cloudberry Kingdom substrate (`cloudberry`, frontend/modules/cloudberryDemo/).
 *
 * The game page is NOT in this repository (⚖ R18): the rows play the same-origin copy at
 * frontend/external/cloudberry/ (`node scripts/setup/fetch-cloudberry-site.mjs`, or `--link` a local
 * build). With no copy every row REFUSES BY NAME (a failed condition naming the fix) — never a pass.
 * That is why they run in the manual `cloudberry` batch (testBatches.js), which CI runs in
 * `cloudberry-e2e.yml` right after the site fetch, and not in an on-push batch whose job has no site.
 *
 * ⚖ (the user, 2026-09-26) every row SETS the state it expects: it loads its world itself (the
 * committed `cloudberry_sphere_worldgen` preset: region_2_2 [∅ | Cloud] holds Clouds → exit_S →
 * region_2_3 [∅ | MovingBlock] holds Moving Blocks → exit_E → region_3_3 holds Victory; each back
 * exit is the next region's start door), and grants the items it needs with addItemToInventory.
 *
 * The bot is the page's own (the computer's recording), driven through the substrate's host-side
 * PlaybackProxy, the surface the Playback Bot and loop mode use. Doors and the exit menu are driven
 * by the page's own keys, dispatched on the game window the way its on-screen controls send them.
 *
 * Runs only in the test-substrates mode (enabled:false; the full module config).
 */
import { registerTest } from '../testRegistry.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { buildCloudberryPayload, pageParamsForWorld } from '../../cloudberryDemo/cloudberryRules.js';

const CATEGORY = 'cloudberrySubstrate';
const SITE = './external/cloudberry/';
const PANEL = 'cloudberryDemoPanel';
const PRESET_SEED = 'AP_14089154938208861744';
const PRESET_RULES = `./presets/cloudberry_sphere_worldgen/${PRESET_SEED}/${PRESET_SEED}_rules.json`;
const DEMO_PACK = './region-libraries/demo-cloudberry-pack.json';
const SHIPPED_PRESET = 'shipped:cloudberry-sphere-demo';
/** The page boots .NET (seconds) and regenerates the level on every configure. */
const CONFIGURE_TIMEOUT_MS = 180000;
const BOT_TIMEOUT_MS = 90000;
const KEY_HOLD_MS = 150;   // the page's touch controls hold a key ≥ 120 ms: the game reads the keyboard once a frame
const PAGE_KEY = { north: 'ArrowUp', east: 'ArrowRight', south: 'ArrowDown', west: 'ArrowLeft' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The site copy, or a REFUSAL by name. */
async function siteOrRefuse(tc) {
    let info = null;
    try {
        const res = await fetch(`${SITE}build-info.json`, { cache: 'no-store' });
        if (res.ok) info = await res.json();
    } catch { info = null; }
    tc.reportCondition(info
        ? `the same-origin Cloudberry site is present (build ${String(info.build).slice(0, 12)})`
        : 'REFUSED: no same-origin Cloudberry site at frontend/external/cloudberry/ — run '
          + '`node scripts/setup/fetch-cloudberry-site.mjs` (or `--link` a local build)', !!info);
    return info;
}

function gameIframe() {
    return document.querySelector('iframe[src*="/external/cloudberry/index.html"][src*="loadRegionEvent"]');
}
const gameWin = () => gameIframe()?.contentWindow ?? null;
const embed = () => gameWin()?.__cloudberryEmbed ?? null;
const app = () => embed()?.app ?? null;
const botEvents = () => (app()?.events ?? []).filter((e) => e.kind === 'bot');
const exitEvents = () => (app()?.events ?? []).filter((e) => e.kind === 'sendExit');

function checkedList(snapshot) {
    const c = snapshot?.checkedLocations;
    if (c instanceof Set) return [...c];
    if (Array.isArray(c)) return c;
    return Object.keys(c ?? {});
}
async function snapshot(tc) {
    await tc.stateManager.pingWorker('cloudberry-row', 3000);
    return tc.stateManager.getSnapshot() ?? {};
}
const held = (snap, item) => Number(snap?.inventory?.[item] ?? 0) > 0;

/** What the page and the host say about the region's checks (for a failure message). */
async function checkDiag(tc) {
    const a = app();
    let st = null;
    try { st = embed()?.status?.(); } catch { st = null; }
    const snap = await snapshot(tc);
    return JSON.stringify({
        pageChecked: [...(a?.checked ?? [])], pageSent: a?.sent ?? null, configureChecked: a?.config?.checkedLocations ?? null,
        gameChecks: st?.checks ?? null, hostChecked: checkedList(snap), inventory: snap.inventory ?? null,
    });
}

/** `region` configured and playing (a configure after `after` configures, when given). */
async function configured(tc, region, { after = null, timeoutMs = CONFIGURE_TIMEOUT_MS } = {}) {
    const a = await tc.pollForValue(() => {
        const x = app();
        if (!x || x.config?.regionId !== region || !(x.playResult?.ok || x.refusal)) return null;
        if (after !== null && (x.configures ?? 0) <= after) return null;
        return x;
    }, `${region} configured in the Cloudberry panel`, timeoutMs, 250);
    tc.reportCondition(a ? `${region} configured and playing (${a.refusal ?? `${a.playResult.pieces} pieces, ${a.playResult.checks} checks`})`
        : `${region} configured in the Cloudberry panel`, !!a && !a.refusal);
    return a && !a.refusal ? a : null;
}

/** Load the committed preset fresh, and wait for its start region in the panel. */
async function loadPreset(tc) {
    const before = app()?.configures ?? 0;
    await tc.loadRulesFromFile(PRESET_RULES);
    await tc.stateManager.pingWorker('after-rules-load', 3000);
    tc.eventBus.publish('ui:activatePanel', { panelId: PANEL });
    const a = await configured(tc, 'region_2_2', { after: gameIframe() ? before : null });
    if (!a) return null;
    tc.reportCondition('the game page is same-origin', gameIframe().src.startsWith(new URL('./', document.baseURI).href));
    return a;
}

function controller() {
    return substrateRegistry.get('cloudberry')?.getPlaybackController?.() ?? null;
}

/** The host-side bot to a location or an exit; resolves with the page's bot result event. */
async function botWalk(tc, target, label) {
    const c = controller();
    if (!c) { tc.reportCondition('the cloudberry PlaybackController exists', false); return null; }
    const n = botEvents().length;
    c.walkTo(target);
    return tc.pollForValue(() => {
        const r = botEvents();
        return r.length > n ? r[r.length - 1] : null;
    }, label, BOT_TIMEOUT_MS, 200);
}

/** A key as the page's on-screen controls send it (keydown, a hold, keyup, on the game window). */
async function pressKey(code, holdMs = KEY_HOLD_MS) {
    const win = gameWin();
    const fire = (type) => win.dispatchEvent(new win.KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
    fire('keydown');
    await sleep(holdMs);
    fire('keyup');
}

/** Up at a door (re-armed first, as a player who walked up to it): the menu that opened, or null. */
async function upAtDoor(tc, door) {
    embed().rearmDoors();
    await sleep(300);
    await pressKey('ArrowUp');
    return tc.pollForValue(() => (app()?.menu?.door === door ? app().menu : null), `Up at the ${door} door opens the menu`, 8000, 100);
}

// ── 1. the start region of the committed preset ──────────────────────────────

async function presetStartRegionConfigures(tc) {
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        const a = await loadPreset(tc);
        if (!a) return tc.getOverallResult();
        tc.assertEqual('the document hash the payload names is the one the page generated', a.payload.docSha256, a.doc.sha);
        tc.assertEqual('nothing held at the start', '[]', JSON.stringify(a.itemsState?.platforms ?? []));
        tc.reportCondition(`one check coin (${JSON.stringify(a.payload.checks)})`, Object.keys(a.payload.checks ?? {}).length === 1);
        const look = await tc.pollForValue(() => app()?.look ?? null, 'the check-coin look', 20000, 200);
        tc.reportCondition(`check coins draw the Archipelago logo from THIS frontend's art library (${look?.sheet ?? look?.reason})`,
            look?.source === 'logo' && String(look.sheet).startsWith(new URL('./packs/archipelago/', document.baseURI).href));
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-preset-start-region-configures',
    name: 'Cloudberry: the committed preset configures its start region in the panel (hash-checked, logo look)',
    description: 'Loads cloudberry_sphere_worldgen; procgenPlayer publishes cloudberry:loadRegion; the panel swaps its '
               + 'waiting page for the same-origin game page, which regenerates region_2_2 from the payload\'s request, '
               + 'matches its document hash, plays it with nothing held, and draws check coins with the logo from this '
               + 'frontend\'s art library. Refuses by name when the site copy is absent.',
    testFunction: presetStartRegionConfigures,
    category: CATEGORY,
    enabled: false,
});

// ── 2. a region from the DEMO PACK: boots, its coin checks a location, an unheld item ─────

async function demoPackRegion(tc) {
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        if (!(await loadPreset(tc))) return tc.getOverallResult();
        const lib = await (await fetch(DEMO_PACK, { cache: 'no-store' })).json();
        const entry = lib.entries.find((e) => e.entry_id === 'cb_moving');
        tc.reportCondition('⛓ premise: the demo pack holds cb_moving (∅ → MovingBlock)', !!entry);
        if (!entry) return tc.getOverallResult();
        const free = entry.payload.checks.find((c) => c.piece === 0);
        const gated = entry.payload.checks.find((c) => c.piece === 1);
        tc.reportCondition(`⛓ premise: a free check (${free?.name}) and one behind Moving Blocks (${gated?.name})`, !!free && !!gated);
        if (!free || !gated) return tc.getOverallResult();

        // The pack's payload, its checks mapped onto two real locations of the loaded world.
        const REGION = 'cb_demo_inapp';
        const payload = buildCloudberryPayload(REGION, {
            generate: entry.payload.generate, docSha256: entry.payload.docSha256, checks: entry.payload.checks,
        });
        const target = { [free.name]: 'region_2_2__loc_0', [gated.name]: 'region_2_3__loc_0' };
        const world = { ...payload, ap_locations: target, exits: [] };
        world.params = pageParamsForWorld(world);
        const before = app()?.configures ?? 0;
        tc.eventBus.publish('cloudberry:loadRegion', { region_id: REGION, world });
        const a = await configured(tc, REGION, { after: before, timeoutMs: 60000 });
        if (!a) return tc.getOverallResult();
        tc.assertEqual('the demo pack\'s document hash is the one the page generated', entry.payload.docSha256, a.doc.sha);

        // Unheld: the bot dies on the gated coin's way; nothing checked.
        const died = await botWalk(tc, { kind: 'location', name: target[gated.name] }, `the bot's walk to ${gated.name} ends`);
        tc.reportCondition(`Moving Blocks unheld: its platforms are not landable — the bot died (${JSON.stringify(died)})`, died?.result === 'died');
        tc.reportCondition(`${target[gated.name]} not checked`, !checkedList(await snapshot(tc)).includes(target[gated.name]));

        // The free coin → the AP location it maps to is checked; the page draws it as checked.
        const got = await botWalk(tc, { kind: 'location', name: target[free.name] }, `the bot reaches ${free.name}`);
        tc.reportCondition(`the bot reached ${free.name} (${JSON.stringify(got)})`, got?.result === 'reached');
        const checked = await tc.pollForValue(async () => (checkedList(await snapshot(tc)).includes(target[free.name]) ? true : null),
            `${target[free.name]} checked`, 20000, 250);
        tc.reportCondition(`a check coin → its AP location ${target[free.name]} is checked`, !!checked);
        const outline = await tc.pollForValue(() => (app()?.checked?.has?.(free.name) ? true : null), 'the page has it checked', 10000, 200);
        tc.reportCondition(`setCheckedLocations reached the page: ${free.name} drawn as checked`, !!outline);

        // Receiving Moving Blocks: the platforms become landable, the bot reaches the gated coin.
        await tc.stateManager.addItemToInventory('Moving Blocks', 1);
        const landable = await tc.pollForValue(() => ((app()?.itemsState?.platforms ?? []).includes('MovingBlock') ? true : null),
            'pollItems reaches the page with MovingBlock', 20000, 200);
        tc.reportCondition('receiving Moving Blocks reached the page (pollItems: MovingBlock held)', !!landable);
        const reached = await botWalk(tc, { kind: 'location', name: target[gated.name] }, `the bot reaches ${gated.name}`);
        tc.reportCondition(`…and now the bot reaches ${gated.name} (${JSON.stringify(reached)})`, reached?.result === 'reached');
        const checked2 = await tc.pollForValue(async () => (checkedList(await snapshot(tc)).includes(target[gated.name]) ? true : null),
            `${target[gated.name]} checked`, 20000, 250);
        tc.reportCondition(`${target[gated.name]} checked`, !!checked2);
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-demo-pack-region-coin-and-unheld-item',
    name: 'Cloudberry: a demo-pack region boots; unheld platforms are not landable; a check coin checks its AP location; receiving the item makes them landable',
    description: 'Publishes cloudberry:loadRegion with the demo pack\'s cb_moving payload (its two checks mapped onto two '
               + 'locations of the loaded preset). The page plays it (hash matched); the bot dies on the way to the coin '
               + 'behind Moving Blocks; the free coin checks its AP location and is drawn as checked; Moving Blocks added '
               + 'to the inventory reaches the page and the bot then reaches the gated coin, which is checked.',
    testFunction: demoPackRegion,
    category: CATEGORY,
    enabled: false,
});

// ── 3. the bot leaves by the end door: needs the item, then user:regionMove ───────────

async function botEndDoorRegionMove(tc) {
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        if (!(await loadPreset(tc))) return tc.getOverallResult();
        const n0 = exitEvents().length;
        const died = await botWalk(tc, { kind: 'exit', name: 'exit_S' }, 'the bot\'s walk to the end door ends');
        // Its walk ends short of the door: 'died', or 'timeout' (the recording ran out, the door not reached;
        // measured on region_2_2), never 'reached'.
        tc.reportCondition(`Clouds unheld: the bot's walk ends short of the end door (${JSON.stringify(died)})`,
            died?.result === 'died' || died?.result === 'timeout');
        tc.reportCondition('…and no exit was sent', exitEvents().length === n0 && app()?.config?.regionId === 'region_2_2');

        const got = await botWalk(tc, { kind: 'location', name: 'region_2_2__loc_0' }, 'the bot reaches the check coin');
        tc.reportCondition(`the bot reached the check coin (${JSON.stringify(got)})`, got?.result === 'reached');
        const snap = await tc.pollForValue(async () => {
            const s = await snapshot(tc);
            return checkedList(s).includes('region_2_2__loc_0') && held(s, 'Clouds') ? s : null;
        }, 'region_2_2__loc_0 checked → Clouds received', 20000, 250);
        tc.reportCondition(`the check coin → region_2_2__loc_0 checked → Clouds received${snap ? '' : ` — ${await checkDiag(tc)}`}`, !!snap);
        if (!snap) return tc.getOverallResult();
        await tc.pollForValue(() => ((app()?.itemsState?.platforms ?? []).includes('Cloud') ? true : null), 'Cloud held in the page', 20000, 200);

        const before = app()?.configures ?? 0;
        const left = await botWalk(tc, { kind: 'exit', name: 'exit_S' }, 'the bot reaches the end door');
        tc.reportCondition(`Clouds held: the bot reaches the end door (${JSON.stringify(left)})`, left?.result === 'reached');
        const sent = exitEvents().slice(n0).at(-1);
        tc.reportCondition(`the page sent the exit by the end door (${JSON.stringify(sent)})`, sent?.side === 'south' && sent?.door === 'end');
        await configured(tc, 'region_2_3', { after: before });
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-bot-end-door-region-move',
    name: 'Cloudberry: the bot dies short of the end door without the item; with it, the end door sends the exit → user:regionMove',
    description: 'Preset region_2_2: the bot to exit_S without Clouds dies and nothing is sent; the bot collects the check '
               + 'coin (region_2_2__loc_0 → Clouds received); the bot to exit_S then reaches the end door, the page sends '
               + 'south by the end door, and region_2_3 configures in the panel.',
    testFunction: botEndDoorRegionMove,
    category: CATEGORY,
    enabled: false,
});

// ── 4. the end door's menu by key ──────────────────────────────────────────────────────

async function endDoorMenuByKey(tc) {
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        if (!(await loadPreset(tc))) return tc.getOverallResult();
        await tc.stateManager.addItemToInventory('Clouds', 1);
        await tc.pollForValue(() => ((app()?.itemsState?.platforms ?? []).includes('Cloud') ? true : null), 'Cloud held in the page', 20000, 200);
        // Park the player at the end door by a side the region has no exit on (so the door does not leave by itself).
        const n = botEvents().length;
        gameWin().__swfBridge.botWalkTo({ kind: 'portal', id: 'north' }, { door: 'end' });
        const parked = await tc.pollForValue(() => (botEvents().length > n ? botEvents().at(-1) : null), 'the bot parks at the end door', BOT_TIMEOUT_MS, 200);
        tc.reportCondition(`the bot parked the player at the end door (${JSON.stringify(parked)})`, parked?.result === 'reached');
        const menu = await upAtDoor(tc, 'end');
        tc.reportCondition(`Up at the end door opened the exit menu (${JSON.stringify(menu)})`, !!menu);
        if (!menu) return tc.getOverallResult();
        tc.reportCondition('the game is paused while the menu is open (play clock stopped)', await tc.pollForValue(() => (app()?.clockRunning === false ? true : null), 'clock stopped', 3000, 100) === true);
        const before = app()?.configures ?? 0;
        await pressKey(PAGE_KEY.south);
        const sent = await tc.pollForValue(() => exitEvents().at(-1)?.side === 'south' ? exitEvents().at(-1) : null, 'south sent', 5000, 100);
        tc.reportCondition(`↓ chose south (${JSON.stringify(sent)})`, !!sent);
        await configured(tc, 'region_2_3', { after: before });
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-end-door-menu-by-key',
    name: 'Cloudberry: Up at the end door opens the exit menu; ↓ chooses south → user:regionMove',
    description: 'Preset region_2_2 with Clouds granted: the page\'s bot parks the player at the end door, Up (sent as the '
               + 'page\'s on-screen controls send it) opens the exit menu and pauses the game, ↓ chooses south, and '
               + 'region_2_3 configures in the panel.',
    testFunction: endDoorMenuByKey,
    category: CATEGORY,
    enabled: false,
});

// ── 5. the start door: the way back, by key and by the bot ───────────────────────────

async function startDoorWayBack(tc) {
    try {
        const site = await siteOrRefuse(tc);
        if (!site) return tc.getOverallResult();
        if (!(await loadPreset(tc))) return tc.getOverallResult();
        await tc.stateManager.addItemToInventory('Clouds', 1);
        await tc.pollForValue(() => ((app()?.itemsState?.platforms ?? []).includes('Cloud') ? true : null), 'Cloud held in the page', 20000, 200);
        let before = app()?.configures ?? 0;
        const left = await botWalk(tc, { kind: 'exit', name: 'exit_S' }, 'the bot leaves region_2_2');
        tc.reportCondition(`the bot left region_2_2 by its end door (${JSON.stringify(left)})`, left?.result === 'reached');
        let a = await configured(tc, 'region_2_3', { after: before });
        if (!a) return tc.getOverallResult();
        const sides = embed().startDoorSides?.() ?? [];
        tc.reportCondition(`the start door of region_2_3 offers north, the way back (${JSON.stringify(sides)})`, sides.includes('north'));

        // By key: Up at the start door (the player respawned there) → the way-back menu → ↑ north → region_2_2.
        const menu = await upAtDoor(tc, 'start');
        tc.reportCondition(`Up at the start door opened the way-back menu (${JSON.stringify(menu)})`, !!menu);
        if (!menu) return tc.getOverallResult();
        before = app()?.configures ?? 0;
        await pressKey(PAGE_KEY.north);
        a = await configured(tc, 'region_2_2', { after: before });
        if (!a) return tc.getOverallResult();
        tc.reportCondition(`…↑ chose north (${JSON.stringify(exitEvents().at(-1))})`, exitEvents().at(-1)?.side === 'north');

        // By the bot (Moving Blocks NOT held, which region_2_3's end door needs): a page with the bot's start door
        // leaves by it; an older page has none, and this leg says so by name (feature test, not a pass of the leg).
        before = app()?.configures ?? 0;
        await botWalk(tc, { kind: 'exit', name: 'exit_S' }, 'the bot leaves region_2_2 again');
        a = await configured(tc, 'region_2_3', { after: before });
        if (!a) return tc.getOverallResult();
        if (!embed().features?.botStartDoor) {
            tc.log(`NOT RUN BY NAME: this page (build ${String(site.build).slice(0, 12)}) has no bot start door `
                + '(__cloudberryEmbed.features.botStartDoor) — the Cloudberry branch p3a-bot-start-door adds it.', 'warn');
            return tc.getOverallResult();
        }
        const snap = await snapshot(tc);
        tc.reportCondition('⛓ premise: Moving Blocks NOT held (the end door would need it)', !held(snap, 'Moving Blocks'));
        before = app()?.configures ?? 0;
        const n = exitEvents().length;
        const back = await botWalk(tc, { kind: 'exit', name: 'region_2_2' }, 'the bot walks the way back');
        tc.reportCondition(`the bot reached the START door (${JSON.stringify(back)})`, back?.result === 'reached' && back?.goal?.kind === 'startdoor');
        const sent = exitEvents().slice(n).at(-1);
        tc.reportCondition(`…and left by it: north, door start (${JSON.stringify(sent)})`, sent?.side === 'north' && sent?.door === 'start');
        await configured(tc, 'region_2_2', { after: before });
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-start-door-way-back',
    name: 'Cloudberry: the start door offers the way back — Up opens it, ↑ goes back; the bot walks to it without the end door\'s item',
    description: 'Preset with Clouds granted: the bot leaves region_2_2 → region_2_3, whose start door offers north. Up at '
               + 'the start door → the way-back menu → ↑ → region_2_2. Then on a page with the bot\'s start door '
               + '(features.botStartDoor), the bot\'s walk to the back exit, with Moving Blocks (the end door\'s item) NOT '
               + 'held, reaches the start door and leaves by it (sendExit north, door start) → region_2_2. On an older '
               + 'page that leg is logged as not run, by name.',
    testFunction: startDoorWayBack,
    category: CATEGORY,
    enabled: false,
});

// ── 6. the shipped Procgen preset generates in the browser ─────────────────────────────

async function shippedPresetGenerates(tc) {
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        tc.eventBus.publish('ui:activatePanel', { panelId: 'procgenPipelinePanel' });
        const panel = await tc.pollForValue(() => document.querySelector('.procgen-pipeline-panel')?.__panel ?? null,
            'the Procgen Pipeline panel', 8000, 50);
        tc.reportCondition('the Procgen Pipeline panel is mounted', !!panel);
        if (!panel) return tc.getOverallResult();
        panel._applyPreset(SHIPPED_PRESET);
        tc.assertEqual('the preset is applied', SHIPPED_PRESET, String(panel.activePresetId));
        const t0 = performance.now();
        await panel._runGeneration();
        const rules = await tc.pollForValue(() => panel._stepState?.compile?.rulesJson ?? null,
            'the preset world compiled (the levels generated by the hidden game page)', 150000, 200);
        tc.reportCondition(`Run all compiled the world in ${Math.round(performance.now() - t0)} ms (${panel.message ?? ''})`, !!rules);
        if (!rules) return tc.getOverallResult();
        const committed = await (await fetch(PRESET_RULES, { cache: 'no-store' })).json();
        const pick = (sc) => Object.fromEntries(Object.entries(sc ?? {}).map(([id, v]) => [id, {
            generate: v.playable_payload?.params?.generate, docSha256: v.playable_payload?.params?.docSha256,
            checks: v.playable_payload?.params?.checks,
        }]));
        const mine = pick(rules.preset_sidecars?.['1']);
        tc.reportCondition(`three Cloudberry regions (${Object.keys(mine).join(', ')})`, Object.keys(mine).length === 3);
        tc.assertEqual('every region\'s request, document hash and check coins equal the committed preset\'s',
            JSON.stringify(pick(committed.preset_sidecars?.['1'])), JSON.stringify(mine));
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-shipped-preset-generates',
    name: 'Cloudberry: the shipped preset "cloudberry-sphere-demo" generates in the browser and equals the committed world',
    description: 'The Procgen Pipeline panel applies shipped:cloudberry-sphere-demo and runs it; its three levels are '
               + 'generated by the hidden same-origin game page (cloudberryGenFrame.js; a warm localStorage cache '
               + 'regenerates nothing). Every region\'s request, document hash and check coins equal the committed '
               + 'cloudberry_sphere_worldgen preset\'s.',
    testFunction: shippedPresetGenerates,
    category: CATEGORY,
    enabled: false,
});
