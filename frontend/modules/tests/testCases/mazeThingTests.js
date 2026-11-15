/**
 * ⛓ CONTENT SETS S2 — a maze region's THING (`mazeRoom/mazeThings.js`, `mazeThingOverlay.js`): a character, object or
 * piece of information that is NOT an AP check stands on a floor cell; the player walks onto it to read it and keeps
 * walking (⚖ the user, 2026-11-14). One row, in the real panel, on the committed `meta_trial` world:
 *
 *   maze-thing-shows-text — loads the committed preset, stands in a maze region whose payload holds a thing and that
 *   can be walked to it without stepping on a location, a gate or an exit (read off the document), and with real
 *   key presses:
 *     · the panel holds the region's thing, and draws it once its cell has been seen;
 *     · walking onto the cell shows the thing's name and lines under the canvas and publishes
 *       `content:thingExamined` naming the region, the thing, its concept and its information;
 *     · the player walks on (the next press leaves the cell, and the reading goes), and walking back reads it again;
 *     · no location is checked by any of it.
 * Every expectation is read from the data (the document's payload), never spelled here. The node pins (what a region
 * holds, the free-cell rule, the draw) are `mazeRoom/mazeThings.test.js` and `mazeRoom/mazeThingOverlay.test.js`.
 */
import { registerTest } from '../testRegistry.js';
import { getPanelInstance } from '../../mazeRoom/index.js';
import { mazeThingLines } from '../../mazeRoom/mazeThingOverlay.js';

const META_TRIAL_PRESET = './presets/meta_trial/AP_1/AP_1_rules.json';
const STEP = Object.freeze({ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] });
const KEY = Object.freeze({ N: 'ArrowUp', S: 'ArrowDown', E: 'ArrowRight', W: 'ArrowLeft' });

/**
 * A walk over a serialized payload from `from` to `to` that steps only on floor no item, obstacle or exit stands on
 * (so nothing is checked and no gate is asked), as directions; null when there is none.
 */
function walkTo(payload, from, to) {
    const { width, height, tiles } = payload;
    const busy = new Set([...(payload.items ?? []), ...(payload.obstacles ?? []), ...(payload.exits ?? [])].map((c) => `${c.x},${c.y}`));
    const ok = (x, y) => x >= 0 && y >= 0 && x < width && y < height && tiles[y * width + x] === 0 && !busy.has(`${x},${y}`);
    const prev = new Map([[`${from.x},${from.y}`, null]]);
    const queue = [from];
    while (queue.length) {
        const c = queue.shift();
        if (c.x === to.x && c.y === to.y) {
            const dirs = [];
            for (let k = `${c.x},${c.y}`; prev.get(k); k = prev.get(k).from) dirs.unshift(prev.get(k).dir);
            return dirs;
        }
        for (const [dir, [dx, dy]] of Object.entries(STEP)) {
            const n = { x: c.x + dx, y: c.y + dy };
            const k = `${n.x},${n.y}`;
            if (prev.has(k) || !ok(n.x, n.y)) continue;
            prev.set(k, { from: `${c.x},${c.y}`, dir });
            queue.push(n);
        }
    }
    return null;
}

/** A neighbour of `cell` the player can step to and back from (free floor), as `[out, back]` directions. */
function stepAside(payload, cell) {
    const back = { N: 'S', S: 'N', E: 'W', W: 'E' };
    for (const dir of Object.keys(STEP)) {
        const [dx, dy] = STEP[dir];
        if (walkTo(payload, cell, { x: cell.x + dx, y: cell.y + dy })?.length === 1) return [dir, back[dir]];
    }
    return null;
}

const checkedCount = async (testController) => {
    const checked = (await testController.stateManager.getSnapshot())?.checkedLocations;
    return Array.isArray(checked) ? checked.length : Object.keys(checked ?? {}).length;
};

async function mazeThingShowsText(testController) {
    const doc = await (await fetch(META_TRIAL_PRESET, { cache: 'no-store' })).json();
    const slot = '1';
    const sidecars = doc.preset_sidecars?.[slot] ?? {};
    // The region: a maze holding a thing that the player can walk to from where the panel puts it (its entrance).
    const pick = Object.entries(sidecars).map(([rid, sc]) => {
        const p = sc.playable_payload;
        const thing = sc.substrate === 'maze' ? p?.things?.[0] : null;
        if (!thing) return null;
        const path = walkTo(p, p.entrance, thing);
        return path ? { rid, payload: p, thing, path } : null;
    }).find(Boolean) ?? null;
    testController.reportCondition(`⛓ premise: ${META_TRIAL_PRESET} has a maze region whose thing can be walked to over plain floor`
        + (pick ? ` (${pick.rid}: ${pick.thing.name} at ${pick.thing.x},${pick.thing.y}, ${pick.path.length} steps)` : ''), !!pick);
    if (!pick) return testController.getOverallResult();
    const aside = stepAside(pick.payload, pick.thing);
    testController.reportCondition('⛓ premise: the thing\'s cell has a free floor neighbour to walk on to', !!aside);
    if (!aside) return testController.getOverallResult();

    const { getGameStateSingleton } = await import('../../gameState/singleton.js');
    const gs = getGameStateSingleton();
    if (gs?.isLoopModeActive) gs.setLoopModeActive(false);
    const rulesLoaded = testController.waitForEvent('stateManager:rulesLoaded', 10000);
    testController.eventBus.publish('files:jsonLoaded', { jsonData: doc, selectedPlayerId: slot, sourceName: 'maze-thing-shows-text' });
    await rulesLoaded;
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });
    window.eventDispatcher?.publish('maze-thing-shows-text', 'user:regionMove',
        { sourceRegion: gs.getCurrentRegion?.() ?? null, targetRegion: pick.rid, exitName: null }, { initialTarget: 'bottom' });
    // ⛔ IDENTITY: concept_trial has the same maze rooms WITHOUT things — the panel must hold THIS document's world.
    const panel = await testController.pollForValue(() => {
        const p = getPanelInstance();
        return (p?.currentRegionId === pick.rid && p.world?.things?.length && p.state) ? p : null;
    }, `the maze panel stands in ${pick.rid} holding its thing`, 20000, 250);
    testController.reportCondition(`the maze panel stands in ${pick.rid} holding its thing`, !!panel);
    if (!panel) return testController.getOverallResult();
    testController.assertEqual('the panel\'s world holds the document\'s thing', JSON.stringify(pick.payload.things),
        JSON.stringify(panel.getThingStatus().things));
    const start = panel.state.player_pos;
    testController.reportCondition(`⛓ premise: the player starts at the region's entrance (${start.x},${start.y})`,
        start.x === pick.payload.entrance.x && start.y === pick.payload.entrance.y);
    if (start.x !== pick.payload.entrance.x || start.y !== pick.payload.entrance.y) return testController.getOverallResult();

    const events = [];
    const off = testController.eventBus.subscribe('content:thingExamined', (data) => { events.push(data); }, 'tests');
    const press = (dir) => panel.rootElement.dispatchEvent(new KeyboardEvent('keydown', { key: KEY[dir], bubbles: true }));
    const at = (c) => panel.state?.player_pos?.x === c.x && panel.state?.player_pos?.y === c.y;
    const shown = () => panel.rootElement?.querySelector('.maze-room-thing');
    const want = mazeThingLines(pick.thing);
    const wantEvent = JSON.stringify({ region: pick.rid, thing: pick.thing.id, kind: pick.thing.kind, concept: pick.thing.concept, info: pick.thing.info?.concept ?? null });
    const eventOf = (e) => JSON.stringify({ region: e.region, thing: e.thing, kind: e.kind, concept: e.concept, info: e.info });
    try {
        const before = await checkedCount(testController);
        // Drawn only once seen: under fog an unseen cell hides it, and every drawn thing is on a seen cell.
        panel.render();
        const status0 = panel.getThingStatus();
        const seen0 = !panel.fogEnabled || panel._isTileVisibleForRender(pick.thing.x, pick.thing.y);
        testController.assertEqual(`before walking: the thing is drawn iff its cell is seen (seen: ${seen0})`,
            seen0, status0.drawn.some((d) => d.id === pick.thing.id));

        for (const dir of pick.path) press(dir);
        testController.reportCondition(`walked onto ${pick.thing.name}'s cell (${pick.thing.x},${pick.thing.y})`, at(pick.thing));
        const el = shown();
        testController.reportCondition('the panel shows the thing under the canvas', !!el);
        testController.assertEqual('it shows the thing\'s name and its lines',
            JSON.stringify([pick.thing.name, ...want]),
            JSON.stringify(el ? [el.querySelector('.maze-room-thing-name')?.textContent, ...[...el.querySelectorAll('.maze-room-thing-line')].map((p) => p.textContent)] : null));
        testController.assertEqual('one content:thingExamined, naming the region, the thing, its concept and its information',
            JSON.stringify([wantEvent]), JSON.stringify(events.map(eventOf)));

        // walk on, and back: the reading goes and comes back, a second event
        press(aside[0]);
        testController.reportCondition('the player walks on (the next press leaves the cell)', !at(pick.thing));
        testController.reportCondition('off the cell, the reading is gone', !shown());
        press(aside[1]);
        testController.reportCondition('walking back onto the cell reads it again', at(pick.thing) && !!shown());
        testController.assertEqual('a second content:thingExamined', 2, events.length);
        testController.reportCondition('the thing is not drawn under the player', !panel.getThingStatus().drawn.some((d) => d.id === pick.thing.id));
        press(aside[0]);
        const drawnNow = panel.getThingStatus().drawn.find((d) => d.id === pick.thing.id);
        testController.reportCondition(`with the player beside it, the thing is drawn (${drawnNow?.as ?? 'not drawn'})`, !!drawnNow);

        await new Promise((r) => setTimeout(r, 1500));
        await testController.stateManager.pingWorker('after-thing-walk', 3000);
        testController.assertEqual('no location was checked', before, await checkedCount(testController));
    } finally {
        try { off?.(); } catch { /* ignore */ }
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'maze-thing-shows-text',
    name: 'Maze thing: walking onto it shows its text, publishes content:thingExamined, checks nothing; the player walks on',
    description: 'Loads the committed meta_trial preset (content sets S2), stands in a maze region whose thing can be '
        + 'walked to over plain floor, and walks onto its cell with key presses: the panel shows the thing\'s name and '
        + 'lines and publishes content:thingExamined; the next press walks on and the reading goes; walking back reads it '
        + 'again; it is drawn only where seen and not under the player; no location is checked.',
    testFunction: mazeThingShowsText,
    category: 'Maze things',
    enabled: false, // off by default — runs only in the test-substrates mode
});
