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
 * committed `cloudberry_sphere_worldgen` preset: region_2_2 [∅ | Cloud] holds Clouds → region_2_2__exit_E →
 * region_3_2 [∅ | MovingBlock] holds Moving Blocks → region_3_2__exit_E → region_4_2 holds Victory; each back
 * exit is the next region's start door), and grants the items it needs with addItemToInventory.
 *
 * The bot is the page's own (the computer's recording), driven through the substrate's host-side
 * PlaybackProxy, the surface the Playback Bot and loop mode use. Doors and the exit menu are driven
 * by the page's own keys, dispatched on the game window the way its on-screen controls send them.
 *
 * Runs only in the test-substrates mode (enabled:false; the full module config).
 */
import appEventBus from '../../../app/core/eventBus.js';
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
        // P4c fill slack: the start level holds TWO free check coins (Clouds and the Cloudberry Gem).
        tc.reportCondition(`two check coins (${JSON.stringify(a.payload.checks)})`, Object.keys(a.payload.checks ?? {}).length === 2);
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

/** Host events that can move the bridge's notion of the active region, timestamped (a failure names them). */
function watchRegionEvents(tc) {
    const t0 = performance.now();
    const seen = [];
    const subs = ['gameState:regionChanged', 'iframe:connected', 'iframe:disconnected', 'iframe:appReady',
        'cloudberry:loadRegion', 'cloudberry:playbackControl'].map((ev) => {
        const fn = (d) => seen.push({ ev, t: Math.round(performance.now() - t0),
            region: d?.newRegion ?? d?.region_id ?? d?.iframeId ?? null, resync: d?.resync ?? undefined });
        tc.eventBus.subscribe(ev, fn, 'tests');
        return [ev, fn];
    });
    return { seen, stop: () => subs.forEach(([ev, fn]) => tc.eventBus.unsubscribe(ev, fn, 'tests')) };
}

async function demoPackRegion(tc) {
    const watch = watchRegionEvents(tc);
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
        const target = { [free.name]: 'region_2_2__loc_0', [gated.name]: 'region_3_2__loc_0' };
        const world = { ...payload, ap_locations: target, exits: [] };
        world.params = pageParamsForWorld(world);
        const before = app()?.configures ?? 0;
        tc.eventBus.publish('cloudberry:loadRegion', { region_id: REGION, world });
        const a = await configured(tc, REGION, { after: before, timeoutMs: 60000 });
        if (!a) return tc.getOverallResult();
        tc.assertEqual('the demo pack\'s document hash is the one the page generated', entry.payload.docSha256, a.doc.sha);
        // ⛓ P4a: another iframe panel announcing ready makes gameState publish a RESYNC regionChanged naming the host's
        // region (region_2_2, not this row's cb_demo_inapp) to every iframe. The bridge once read that as a move and went
        // inactive: the row's 1-in-7 "silent bridge" (P3b). Published here on purpose, so the race is always run.
        // (the app's bus, as the iframe adapter publishes it: the test controller's publish does not carry this event)
        const seenBefore = watch.seen.length;
        appEventBus.publish('iframe:appReady', { iframeId: 'cloudberry-row-other-panel', timestamp: Date.now() }, 'iframeAdapter');
        const resynced = await tc.pollForValue(() => (watch.seen.slice(seenBefore).some((e) => e.ev === 'gameState:regionChanged'
            && e.resync === true && e.region === 'region_2_2') ? true : null), 'gameState answered with a resync regionChanged', 3000, 50);
        tc.reportCondition('⛓ premise: the injected appReady made gameState publish a resync regionChanged naming region_2_2', !!resynced);
        await sleep(300);
        let bridgeNow = null;
        try { bridgeNow = gameWin()?.__swfBridgeHostState?.() ?? null; } catch { bridgeNow = null; }
        tc.reportCondition(`another iframe's appReady (a resync regionChanged to region_2_2) leaves the bridge active on ${REGION} `
            + `(${JSON.stringify(bridgeNow)})`, bridgeNow?.active === true && bridgeNow.regionId === REGION);

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
    } finally {
        watch.stop();
        tc.log(`host region events during the row: ${JSON.stringify(watch.seen)}`);
        let bridge = null;
        try { bridge = gameWin()?.__swfBridgeHostState?.() ?? null; } catch { bridge = null; }
        const frames = (window.iframeAdapterCore?.getConnectedIframes?.() ?? [])
            .map((f) => ({ id: f.iframeId, connected: f.connected, beatAgoMs: Date.now() - f.lastHeartbeat, subs: f.eventBusSubscriptions.length }));
        const a = app();
        const page = a ? { region: a.config?.regionId ?? null, configures: a.configures, ok: a.playResult?.ok ?? null,
            refusal: a.refusal, pendingBot: a.pendingBot, items: a.items, platforms: a.itemsState?.platforms ?? null,
            bots: (a.events ?? []).filter((e) => e.kind === 'bot').length } : null;
        tc.log(`bridge state: ${JSON.stringify(bridge)}; page: ${JSON.stringify(page)}; adapter iframes: ${JSON.stringify(frames)}`);
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
        const died = await botWalk(tc, { kind: 'exit', name: 'region_2_2__exit_E' }, 'the bot\'s walk to the end door ends');
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
        const left = await botWalk(tc, { kind: 'exit', name: 'region_2_2__exit_E' }, 'the bot reaches the end door');
        tc.reportCondition(`Clouds held: the bot reaches the end door (${JSON.stringify(left)})`, left?.result === 'reached');
        const sent = exitEvents().slice(n0).at(-1);
        tc.reportCondition(`the page sent the exit by the end door (${JSON.stringify(sent)})`, sent?.side === 'east' && sent?.door === 'end');
        await configured(tc, 'region_3_2', { after: before });
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-bot-end-door-region-move',
    name: 'Cloudberry: the bot dies short of the end door without the item; with it, the end door sends the exit → user:regionMove',
    description: 'Preset region_2_2: the bot to region_2_2__exit_E without Clouds dies and nothing is sent; the bot collects the check '
               + 'coin (region_2_2__loc_0 → Clouds received); the bot to region_2_2__exit_E then reaches the end door, the page sends '
               + 'east by the end door, and region_3_2 configures in the panel.',
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
        await pressKey(PAGE_KEY.east);
        const sent = await tc.pollForValue(() => exitEvents().at(-1)?.side === 'east' ? exitEvents().at(-1) : null, 'east sent', 5000, 100);
        tc.reportCondition(`→ chose east (${JSON.stringify(sent)})`, !!sent);
        await configured(tc, 'region_3_2', { after: before });
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-end-door-menu-by-key',
    name: 'Cloudberry: Up at the end door opens the exit menu; → chooses east → user:regionMove',
    description: 'Preset region_2_2 with Clouds granted: the page\'s bot parks the player at the end door, Up (sent as the '
               + 'page\'s on-screen controls send it) opens the exit menu and pauses the game, → chooses east, and '
               + 'region_3_2 configures in the panel.',
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
        const left = await botWalk(tc, { kind: 'exit', name: 'region_2_2__exit_E' }, 'the bot leaves region_2_2');
        tc.reportCondition(`the bot left region_2_2 by its end door (${JSON.stringify(left)})`, left?.result === 'reached');
        let a = await configured(tc, 'region_3_2', { after: before });
        if (!a) return tc.getOverallResult();
        const sides = embed().startDoorSides?.() ?? [];
        tc.reportCondition(`the start door of region_3_2 offers west, the way back (${JSON.stringify(sides)})`, sides.includes('west'));

        // By key: Up at the start door (the player respawned there) → the way-back menu → ← west → region_2_2.
        const menu = await upAtDoor(tc, 'start');
        tc.reportCondition(`Up at the start door opened the way-back menu (${JSON.stringify(menu)})`, !!menu);
        if (!menu) return tc.getOverallResult();
        before = app()?.configures ?? 0;
        await pressKey(PAGE_KEY.west);
        a = await configured(tc, 'region_2_2', { after: before });
        if (!a) return tc.getOverallResult();
        tc.reportCondition(`…← chose west (${JSON.stringify(exitEvents().at(-1))})`, exitEvents().at(-1)?.side === 'west');

        // By the bot (Moving Blocks NOT held, which region_3_2's end door needs): a page with the bot's start door
        // leaves by it; an older page has none, and this leg says so by name (feature test, not a pass of the leg).
        before = app()?.configures ?? 0;
        await botWalk(tc, { kind: 'exit', name: 'region_2_2__exit_E' }, 'the bot leaves region_2_2 again');
        a = await configured(tc, 'region_3_2', { after: before });
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
        tc.reportCondition(`…and left by it: west, door start (${JSON.stringify(sent)})`, sent?.side === 'west' && sent?.door === 'start');
        await configured(tc, 'region_2_2', { after: before });
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-start-door-way-back',
    name: 'Cloudberry: the start door offers the way back — Up opens it, ← goes back; the bot walks to it without the end door\'s item',
    description: 'Preset with Clouds granted: the bot leaves region_2_2 → region_3_2, whose start door offers west. Up at '
               + 'the start door → the way-back menu → ← → region_2_2. Then on a page with the bot\'s start door '
               + '(features.botStartDoor), the bot\'s walk to the back exit, with Moving Blocks (the end door\'s item) NOT '
               + 'held, reaches the start door and leaves by it (sendExit west, door start) → region_2_2. On an older '
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

// ── 7. a Double Jump level (P5a): one jump without the item, two with it ──────────────

const DOUBLE_JUMP_RULES = `./presets/cloudberry_double_jump_worldgen/${PRESET_SEED}/${PRESET_SEED}_rules.json`;
const DOUBLE_JUMP_REGION = 'region_3_2';

async function doubleJumpLevelNeedsTheItem(tc) {
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        if (!(await loadPreset(tc))) return tc.getOverallResult();
        const features = embed()?.features ?? {};
        tc.reportCondition(features.doubleJump === true
            ? `the page has the Double Jump feature (${JSON.stringify(features)})`
            : `REFUSED: this Cloudberry page has no Double Jump (__cloudberryEmbed.features.doubleJump; ${JSON.stringify(features)}) `
              + '— a Double Jump level needs the Cloudberry Double Jump change (cdc77c9) deployed, or `--link` a build of it',
        features.doubleJump === true);
        if (features.doubleJump !== true) return tc.getOverallResult();

        // The committed Double Jump world's Double level, published into the loaded world with its own AP locations.
        const rules = await (await fetch(DOUBLE_JUMP_RULES, { cache: 'no-store' })).json();
        const sc = rules.preset_sidecars?.['1']?.[DOUBLE_JUMP_REGION]?.playable_payload;
        const params = sc?.params ?? {};
        tc.reportCondition(`⛓ premise: ${DOUBLE_JUMP_REGION} of cloudberry_double_jump_worldgen is a Double-hero level `
            + `(${JSON.stringify(params.generate?.heroCustom ?? null)}; items map ${JSON.stringify(params.items?.['Double Jump'])})`,
        params.generate?.heroCustom?.move === 'Double' && params.items?.['Double Jump'] === 'DoubleJump');
        const coin = Object.keys(params.checks ?? {})[0];
        if (!coin) return tc.getOverallResult();
        const REGION = 'cb_double_jump_inapp';
        const target = 'region_2_2__loc_0';   // a real location of the loaded preset (its own checks stay the Double level's)
        const world = { ...sc, params: { ...params }, ap_locations: { [coin]: target }, exits: [] };
        world.params = pageParamsForWorld(world);
        const before = app()?.configures ?? 0;
        tc.eventBus.publish('cloudberry:loadRegion', { region_id: REGION, world });
        const a = await configured(tc, REGION, { after: before, timeoutMs: 60000 });
        if (!a) return tc.getOverallResult();
        tc.assertEqual('the Double level\'s document hash is the one the page generated', params.docSha256, a.doc.sha);
        tc.reportCondition(`the page plays it with the Double hero (heroJumps ${a.playResult?.heroJumps})`, a.playResult?.heroJumps === 2);
        const one = await tc.pollForValue(() => (app()?.itemsState?.jumpsOn === 1 ? app().itemsState : null),
            'Double Jump unheld: the hero has ONE jump', 20000, 200);
        tc.reportCondition(`Double Jump unheld: the hero has one jump (${JSON.stringify(one)})`, !!one);

        // The level's last piece is Moving Blocks: granted, so only Double Jump is missing at the end door.
        await tc.stateManager.addItemToInventory('Moving Blocks', 1);
        await tc.pollForValue(() => ((app()?.itemsState?.platforms ?? []).includes('MovingBlock') ? true : null),
            'MovingBlock held in the page', 20000, 200);
        // Park at the end door by a side with no exit (the world here has none), as cloudberry-end-door-menu-by-key does.
        const toDoor = async (label) => {
            const n = botEvents().length;
            gameWin().__swfBridge.botWalkTo({ kind: 'portal', id: 'north' }, { door: 'end' });
            return tc.pollForValue(() => (botEvents().length > n ? botEvents().at(-1) : null), label, BOT_TIMEOUT_MS, 200);
        };
        // Unheld: one jump cannot follow the recording to the end door. (Early coins can be reachable with one jump —
        // the rules are SUFFICIENT, not minimal — so the enforced goal measured here is the door, which needs S_last.)
        const failed = await toDoor('the bot\'s walk to the end door ends');
        tc.reportCondition(`Double Jump unheld: the bot does not reach the end door (${JSON.stringify(failed)})`,
            failed?.result === 'died' || failed?.result === 'timeout');

        // Receiving Double Jump: two jumps; the bot reaches the end door, and the check coin (its AP location checked).
        await tc.stateManager.addItemToInventory('Double Jump', 1);
        const two = await tc.pollForValue(() => (app()?.itemsState?.jumpsOn === 2 ? app().itemsState : null),
            'pollItems reaches the page with DoubleJump', 20000, 200);
        tc.reportCondition(`receiving Double Jump reached the page: two jumps (${JSON.stringify(two)})`, !!two);
        const door = await toDoor('the bot reaches the end door');
        tc.reportCondition(`…and now the bot reaches the end door (${JSON.stringify(door)})`, door?.result === 'reached');
        const reached = await botWalk(tc, { kind: 'location', name: target }, 'the bot reaches the coin');
        tc.reportCondition(`the bot reaches the check coin (${JSON.stringify(reached)})`, reached?.result === 'reached');
        const checked = await tc.pollForValue(async () => (checkedList(await snapshot(tc)).includes(target) ? true : null),
            `${target} checked`, 20000, 250);
        tc.reportCondition(`${target} checked`, !!checked);
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-double-jump-level-needs-the-item',
    name: 'Cloudberry: a Double Jump level — one jump and the bot falls short of the end door without the item; with it, two jumps, the door and the coin',
    description: 'P5a. Loads cloudberry_sphere_worldgen, then publishes cloudberry:loadRegion with the committed '
               + 'cloudberry_double_jump_worldgen\'s Double-hero level (region_3_2; its check mapped onto a location of the '
               + 'loaded world). The page plays it (hash matched, heroJumps 2); with Moving Blocks granted but not Double Jump '
               + 'the hero has one jump and the bot falls short of the end door; Double Jump added to the inventory reaches '
               + 'the page (two jumps), the bot reaches the end door and the check coin, which is checked. Refuses by name on a page without features.doubleJump.',
    testFunction: doubleJumpLevelNeedsTheItem,
    category: CATEGORY,
    enabled: false,
});

// ── 8. a world with the hero's physics as settings (P5b) ───────────────────────────────

const HERO_PHYSICS_RULES = `./presets/cloudberry_hero_physics_worldgen/${PRESET_SEED}/${PRESET_SEED}_rules.json`;

/** A level's hero as its payload asks for it. */
const heroOf = (a) => a?.payload?.generate?.heroCustom ?? null;

async function heroPhysicsWorldPlays(tc) {
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        // The committed hero physics world itself (its own start: region_2_2 holds Double Jump + the gem).
        const before = app()?.configures ?? 0;
        await tc.loadRulesFromFile(HERO_PHYSICS_RULES);
        await tc.stateManager.pingWorker('after-rules-load', 3000);
        tc.eventBus.publish('ui:activatePanel', { panelId: PANEL });
        const a = await configured(tc, 'region_2_2', { after: gameIframe() ? before : null });
        if (!a) return tc.getOverallResult();
        tc.assertEqual('the start level\'s document hash is the one the page generated (the same hero)', a.payload.docSha256, a.doc.sha);
        const h1 = heroOf(a);
        tc.reportCondition(`⛓ premise: the start level is a custom-physics plain hero (${JSON.stringify(h1)})`,
            !!h1?.phsx && h1.move === undefined && typeof h1.phsx.gravity === 'number');

        const got = await botWalk(tc, { kind: 'location', name: 'region_2_2__loc_0' }, 'the bot reaches the check coin');
        tc.reportCondition(`the bot reaches the check coin with this hero (${JSON.stringify(got)})`, got?.result === 'reached');
        const snap = await tc.pollForValue(async () => {
            const s = await snapshot(tc);
            return checkedList(s).includes('region_2_2__loc_0') && held(s, 'Double Jump') ? s : null;
        }, 'region_2_2__loc_0 checked → Double Jump received', 20000, 250);
        tc.reportCondition(`region_2_2__loc_0 checked → Double Jump received${snap ? '' : ` — ${await checkDiag(tc)}`}`, !!snap);
        if (!snap) return tc.getOverallResult();

        const n = app()?.configures ?? 0;
        const left = await botWalk(tc, { kind: 'exit', name: 'region_2_2__exit_E' }, 'the bot reaches the end door');
        tc.reportCondition(`the bot reaches the end door (${JSON.stringify(left)})`, left?.result === 'reached');
        const b = await configured(tc, 'region_3_2', { after: n });
        if (!b) return tc.getOverallResult();
        tc.assertEqual('the Double level\'s document hash is the one the page generated (its own hero)', b.payload.docSha256, b.doc.sha);
        const h2 = heroOf(b);
        tc.reportCondition(`its hero is the Double hero with its own physics, not the start level's (${JSON.stringify(h2)})`,
            h2?.move === 'Double' && typeof h2.phsx?.gravity === 'number' && JSON.stringify(h2.phsx) !== JSON.stringify(h1.phsx));
        const two = await tc.pollForValue(() => (app()?.itemsState?.jumpsOn === 2 ? app().itemsState : null),
            'Double Jump held: two jumps', 20000, 200);
        tc.reportCondition(`Double Jump held: two jumps (${JSON.stringify(two)})`, !!two);
        const coin = await botWalk(tc, { kind: 'location', name: 'region_3_2__loc_0' }, 'the bot reaches the Double level\'s coin');
        tc.reportCondition(`the bot reaches the Double level's check coin (${JSON.stringify(coin)})`, coin?.result === 'reached');
        const checked = await tc.pollForValue(async () => (checkedList(await snapshot(tc)).includes('region_3_2__loc_0') ? true : null),
            'region_3_2__loc_0 checked', 20000, 250);
        tc.reportCondition('region_3_2__loc_0 checked', !!checked);
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-hero-physics-world-plays',
    name: 'Cloudberry: a world with hero physics settings — each level plays its own hero; the bot collects and leaves',
    description: 'P5b. Loads the committed cloudberry_hero_physics_worldgen (world physics + per-region variation). The start '
               + 'level configures with its custom-physics hero (hash matched: the page regenerated the same hero); the bot '
               + 'reaches its check coin (Double Jump received) and the end door; the next level is a Double hero with its '
               + 'OWN physics (two jumps held), and the bot reaches its check coin, which is checked.',
    testFunction: heroPhysicsWorldPlays,
    category: CATEGORY,
    enabled: false,
});

// ── 9. the APWorld Editor regenerates a Cloudberry region in ONE press (P5c) ─────────────

const EDITOR_PANEL = 'apworldEditorPanel';
const EDITOR_SELECTOR = '.apworld-editor-panel';

/** Forget every generated level (this session's memory and the browser store), so the press generates. */
async function forgetCloudberryLevels() {
    const { clearCloudberryLevelCache } = await import('../../cloudberryDemo/cloudberryGeneration.js');
    clearCloudberryLevelCache();
    try {
        for (const k of Object.keys(localStorage)) if (k.startsWith('cloudberryLevel:')) localStorage.removeItem(k);
    } catch { /* no storage: nothing stored */ }
}

async function editorRegeneratesInOnePress(tc) {
    let restoreGenerator = () => {};
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        const { cloudberryGenerationStats, cloudberryGenerator } = await import('../../cloudberryDemo/cloudberryGeneration.js');
        const { applyRulesDocOp } = await import('../../apworldEditor/rulesDocOps.js');
        await tc.loadRulesFromFile(PRESET_RULES);
        await tc.stateManager.pingWorker('after-rules-load', 3000);
        tc.eventBus.publish('ui:activatePanel', { panelId: EDITOR_PANEL });
        const disk = await (await fetch(PRESET_RULES)).json();
        const region = 'region_2_2';   // the start region: its way back needs nothing
        const want = JSON.stringify(disk.preset_sidecars['1'][region]);
        const panel = await tc.pollForValue(() => {
            const p = document.querySelector(EDITOR_SELECTOR)?.__panel;
            return p?.session?.ops().length === 0
                && JSON.stringify(p.rulesDoc?.preset_sidecars?.['1']?.[region] ?? null) === want ? p : null;
        }, 'the APWorld Editor holds the preset (its region as on disk, no ops)', 15000, 50);
        tc.reportCondition('the APWorld Editor holds the preset (its region as on disk, no ops)', !!panel);
        if (!panel) return tc.getOverallResult();
        await forgetCloudberryLevels();
        // the region's own substrate, through the product's Re-roll ▸ (it opens the form at the next seed)
        const reroll = await tc.pollForValue(
            () => document.querySelector(`${EDITOR_SELECTOR} .apworld-sidecar-reroll[data-region-name="${region}"]`),
            'the region\'s Re-roll ▸', 15000, 50);
        if (reroll) reroll.click();
        else panel._openRegionGeneration('1', region, 'cloudberry');
        panel._render();
        const go = await tc.pollForValue(() => document.querySelector(
            `${EDITOR_SELECTOR} .apworld-region-generation[data-region-name="${region}"] .apworld-region-generate`),
        'Generate ▸ under the block', 8000, 50);
        tc.reportCondition('the form targets `cloudberry` and draws Generate ▸', panel._regionGen?.target === 'cloudberry' && !!go);
        if (!go) return tc.getOverallResult();
        const docObj = JSON.parse(JSON.stringify(panel.rulesDoc));
        const seed = panel._regionGen.bag.seed;
        const opsBefore = panel.session.ops().length;
        const generatedBefore = cloudberryGenerationStats().generated;

        // ⛓ The row HOLDS the page's generator until it has looked at the form mid-generation (a warm
        //   hidden page generates in a few hundred ms, between two paints), then lets it go on.
        const real = cloudberryGenerator();
        tc.reportCondition('⛓ premise: the page installed a Cloudberry generator', !!real);
        if (!real) return tc.getOverallResult();
        let release = null;
        const held = new Promise((r) => { release = r; });
        let asked = 0;
        const generate = real.generate;
        real.generate = async (a) => { asked += 1; await held; return generate.call(real, a); };
        restoreGenerator = () => { real.generate = generate; };
        const t0 = performance.now();
        const press = panel._generateRegion();          // ONE press
        // while it generates: the form says so (on this page), and a second press is a no-op
        const working = await tc.pollForValue(() => {
            const t = document.querySelector(`${EDITOR_SELECTOR} .apworld-region-generation-elapsed`)?.textContent ?? '';
            return /\(on this page\)/.test(t) ? t : null;
        }, 'the form shows the region generating on this page', CONFIGURE_TIMEOUT_MS, 50);
        tc.reportCondition(`the form shows it is working (${working})`, !!working);
        tc.reportCondition(`…and the page generator was asked (${asked})`, asked >= 1);
        const runBefore = panel._regionGen?.run;
        const second = await panel._generateRegion();
        tc.reportCondition('⛓ a second press while it generates starts nothing (no run, no error)',
            second === null && panel._regionGen?.run === runBefore && panel.session.ops().length === opsBefore);
        release();
        const res = await press;
        restoreGenerator();
        const ms = Math.round(performance.now() - t0);
        tc.log(`one press → ok ${res?.ok} on the page ${panel._regionGenLastRun?.onPage} in ${ms} ms; answer: ${panel._opMessage}`);
        tc.reportCondition(`⛓⛓ ONE press built the region (${res?.ok ? 'ok' : res?.threw})`, res?.ok === true);
        tc.reportCondition('…finished on the page (the worker has no game page)', panel._regionGenLastRun?.onPage === true);
        tc.assertEqual('⛓⛓ ONE op recorded', String(opsBefore + 1), String(panel.session.ops().length));
        const op = panel.session.ops().at(-1);
        tc.assertEqual('…a set-region-sidecar whose provenance is the cloudberry regenerate',
            'set-region-sidecar/regenerate-region-sidecar/cloudberry', `${op?.op}/${op?.provenance?.op}/${op?.provenance?.substrate}`);
        tc.reportCondition(`⛓ the level was generated ONCE (${cloudberryGenerationStats().generated - generatedBefore})`,
            cloudberryGenerationStats().generated - generatedBefore === 1);
        // the rebuilt region is the pure op's on the same arguments (now cached), byte for byte
        const pure = applyRulesDocOp(docObj, {
            op: 'regenerate-region-sidecar', player: '1', region, substrate: 'cloudberry', seed,
            regionParams: op?.provenance?.regionParams, hazardOpts: op?.provenance?.hazardOpts,
            size: op?.provenance?.size, freeItems: op?.provenance?.freeItems,
        });
        tc.reportCondition(`the pure op on the same arguments builds (${pure.error ?? 'ok'})`, pure.ok);
        tc.assertEqual('⛓⛓ the rebuilt region is the pure op\'s, byte for byte',
            JSON.stringify(pure.doc?.preset_sidecars?.['1']?.[region]), JSON.stringify(panel.rulesDoc.preset_sidecars['1'][region]));
        tc.reportCondition('…a new level (not the one on disk)', JSON.stringify(panel.rulesDoc.preset_sidecars['1'][region]) !== want);
        tc.reportCondition('⛓ the answer is the op\'s own description, not a refusal',
            String(panel._opMessage).startsWith(String(pure.description)) && !/^Refused/.test(String(panel._opMessage)));
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    } finally {
        restoreGenerator();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-editor-regenerate-one-press',
    name: 'Cloudberry: the APWorld Editor regenerates a Cloudberry region in ONE press',
    description: 'P5c. Loads cloudberry_sphere_worldgen into the APWorld Editor, forgets every generated level, presses '
               + 'Re-roll ▸ on region_2_2 and Generate ▸ ONCE: the worker (no game page) flags the pending generation, the '
               + 'page finishes it (the form shows it generating on this page; a second press meanwhile starts nothing), '
               + 'and ONE set-region-sidecar lands — the level generated once, byte-equal to the pure op on the same arguments. '
               + 'The row holds the page generator until it has seen the form mid-generation, then releases it.',
    testFunction: editorRegeneratesInOnePress,
    category: CATEGORY,
    enabled: false,
});

// ── 10. *Initialise procgen data* builds a whole Cloudberry slot in ONE press (P5d) ──────

const INIT_DOC = `./presets/adventure/${PRESET_SEED}/${PRESET_SEED}_rules.json`;
const initSection = () => document.querySelector(`${EDITOR_SELECTOR} .apworld-initialise`);

async function editorInitialisesACloudberrySlotInOnePress(tc) {
    let restoreGenerator = () => {};
    try {
        if (!(await siteOrRefuse(tc))) return tc.getOverallResult();
        const { cloudberryGenerationStats, cloudberryGenerator } = await import('../../cloudberryDemo/cloudberryGeneration.js');
        const { INITIALISE_OP, initialiseSlot } = await import('../../apworldEditor/slotInitialise.js');
        const { initialisePageRetryBound } = await import('../../apworldEditor/regionGenerationRun.js');
        await tc.loadRulesFromFile(INIT_DOC);
        await tc.stateManager.pingWorker('after-rules-load', 3000);
        tc.eventBus.publish('ui:activatePanel', { panelId: EDITOR_PANEL });
        const panel = await tc.pollForValue(() => {
            const p = document.querySelector(EDITOR_SELECTOR)?.__panel;
            return p?.rulesDoc?.game_name && p.session?.ops().length === 0 ? p : null;
        }, 'the APWorld Editor holds the bare adventure slot (no ops)', 15000, 50);
        tc.reportCondition('the APWorld Editor holds the bare adventure slot (no ops)', !!panel);
        if (!panel) return tc.getOverallResult();
        panel._selectTab('map');
        const door = await tc.pollForValue(() => document.querySelector(`${EDITOR_SELECTOR} .apworld-initialise-door`),
            'the Map tab\'s Initialise door', 8000, 50);
        tc.reportCondition('the empty Map offers the Initialise door', !!door);
        if (!door) return tc.getOverallResult();
        door.click();
        const sub = await tc.pollForValue(() => initSection()?.querySelector('.apworld-initialise-substrate'),
            'the Initialise form', 8000, 50);
        if (!sub) return tc.getOverallResult();
        sub.value = 'cloudberry';
        sub.dispatchEvent(new Event('change', { bubbles: true }));
        const go = await tc.pollForValue(() => (panel._initialise?.state?.substrate === 'cloudberry'
            ? initSection()?.querySelector('.apworld-initialise-generate') : null), 'Generate ▸ for `cloudberry`', 8000, 50);
        tc.reportCondition('the form targets `cloudberry` and draws Generate ▸', !!go);
        if (!go) return tc.getOverallResult();
        await forgetCloudberryLevels();
        const p = String(panel.playerId);
        const docObj = JSON.parse(JSON.stringify(panel.rulesDoc));
        const opsBefore = panel.session.ops().length;
        const generatedBefore = cloudberryGenerationStats().generated;

        // ⛓ As in row 9: hold the page generator until the form has been seen finishing on the page.
        const real = cloudberryGenerator();
        tc.reportCondition('⛓ premise: the page installed a Cloudberry generator', !!real);
        if (!real) return tc.getOverallResult();
        let release = null;
        const held = new Promise((r) => { release = r; });
        let asked = 0;
        const generate = real.generate;
        real.generate = async (a) => { asked += 1; await held; return generate.call(real, a); };
        restoreGenerator = () => { real.generate = generate; };
        const t0 = performance.now();
        go.click();                                      // ONE press
        const working = await tc.pollForValue(() => {
            const t = document.querySelector(`${EDITOR_SELECTOR} .apworld-initialise-elapsed`)?.textContent ?? '';
            return /\(on this page\)/.test(t) ? t : null;
        }, 'the form shows the slot initialising on this page', CONFIGURE_TIMEOUT_MS, 50);
        tc.reportCondition(`the form shows it is working on this page (${working})`, !!working);
        tc.reportCondition(`…and the page generator was asked (${asked})`, asked >= 1);
        tc.reportCondition('⛓ the form draws no Generate ▸ while it runs (a second press cannot start)',
            !initSection()?.querySelector('.apworld-initialise-generate'));
        release();
        const run = await tc.pollForValue(() => (panel._initialiseLastRun?.outcome ? panel._initialiseLastRun : null),
            'the initialise run\'s outcome', CONFIGURE_TIMEOUT_MS, 100);
        restoreGenerator();
        const res = run?.outcome;
        const ms = Math.round(performance.now() - t0);
        const placed = res?.stats?.placed ?? 0;
        tc.log(`one press → ok ${res?.ok} on the page ${run?.onPage} retries ${res?.retries} placed ${placed} in ${ms} ms; `
            + `answer: ${panel._opMessage}`);
        tc.reportCondition(`⛓⛓ ONE press built the slot (${res?.ok ? 'ok' : (res?.why ?? res?.threw)})`, res?.ok === true);
        tc.reportCondition('…finished on the page (the worker has no game page)', run?.onPage === true);
        tc.reportCondition(`…every placed region is a Cloudberry level (${placed})`, placed > 1
            && Object.values(res?.entries ?? {}).every((e) => e.substrate === 'cloudberry'));
        tc.reportCondition(`…within its bound (${res?.retries} retries ≤ ${initialisePageRetryBound(docObj, p)})`,
            res?.retries >= 1 && res.retries <= initialisePageRetryBound(docObj, p));
        tc.assertEqual('⛓⛓ ONE op recorded', String(opsBefore + 1), String(panel.session.ops().length));
        const op = panel.session.ops().at(-1);
        tc.assertEqual('…an initialise-procgen-layout as `cloudberry`', `${INITIALISE_OP}/cloudberry`,
            `${op?.op}/${op?.provenance?.substrate}`);
        tc.reportCondition(`⛓ each level generated ONCE (${cloudberryGenerationStats().generated - generatedBefore} for ${placed})`,
            cloudberryGenerationStats().generated - generatedBefore === placed);
        // the landed slot is a synchronous initialise on the same arguments, now every level is cached
        const pure = initialiseSlot({ doc: docObj, player: p, substrate: 'cloudberry', gridDims: op?.provenance?.gridDims,
            seed: op?.provenance?.seed, backExits: op?.provenance?.backExits, bag: op?.provenance?.bag });
        tc.reportCondition(`the pure initialise on the same arguments builds (${pure.why ?? 'ok'})`, pure.ok === true);
        tc.assertEqual('⛓⛓ the landed sidecars are the pure initialise\'s, byte for byte',
            JSON.stringify(pure.entries), JSON.stringify(panel.rulesDoc.preset_sidecars?.[p]));
        tc.reportCondition('⛓ the answer is the op\'s description, not a refusal', !/^Refused/.test(String(panel._opMessage)));
        tc.reportCondition('the form closed', !initSection());
    } catch (e) {
        tc.reportCondition(`Test error: ${e.message}`, false);
    } finally {
        restoreGenerator();
    }
    return tc.getOverallResult();
}

registerTest({
    id: 'cloudberry-editor-initialise-one-press',
    name: 'Cloudberry: the APWorld Editor initialises a whole Cloudberry slot in ONE press',
    description: 'P5d. Loads the bare adventure slot into the APWorld Editor, opens Initialise procgen data, picks `cloudberry`, '
               + 'forgets every generated level and presses Generate ▸ ONCE: the worker (no game page) flags the pending '
               + 'generation, the page finishes the slot (each ask builds one more region, within the slot\'s region-count '
               + 'bound), and ONE initialise-procgen-layout lands — every level generated once, its sidecars byte-equal to the '
               + 'pure initialise on the same arguments. The row holds the page generator until it has seen the form working on '
               + 'this page, then releases it.',
    testFunction: editorInitialisesACloudberrySlotInOnePress,
    category: CATEGORY,
    enabled: false,
});
