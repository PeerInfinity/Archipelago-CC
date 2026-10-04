/**
 * The adapter's property path, and the ONE thing M1 changes about it: it
 * stands down on the AP locations the host's placement table owns (EDITOR
 * INTEGRATION M1, H6; plan §17.0.4).
 *
 * ⛓ THE CONFIG IS THE SHIPPED `games/seedling.json`, so the property → flash
 * name → AP name chain under test is the one the panel really builds. The
 * adapter itself imports nothing and guards on `typeof window`, so it
 * constructs in node with two stubs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it } from 'vitest';

import { FlashBridgeAdapter } from './flashBridgeAdapter.js';
import { SeedlingCheckBinding } from './seedlingCheckBinding.js';
import { SeedlingRegionBinding } from './seedlingRegionBinding.js';
import { substrateRegistryEntry as seedlingEntry } from './flashSeedlingLibrary.js';

const CONFIG = JSON.parse(readFileSync(
    fileURLToPath(new URL('./games/seedling.json', import.meta.url)), 'utf8'));

const ATLAS = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../presets/seedling_atlas/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));
const OVERWORLD = 'overworld_start__r8c0';
const worldFor = (regionId) => seedlingEntry.deserializeWorld(ATLAS.preset_sidecars['1'][regionId].playable_payload);

/** The first location whose property the game itself can flip. */
const SUBJECT = CONFIG.locations[0];

let published;
const adapterFor = () => {
    published = [];
    return new FlashBridgeAdapter({
        config: CONFIG,
        flashObjectId: `test-${Math.random()}`,
        stateManager: { getLatestStateSnapshot: () => ({ inventory: {} }) },
        dispatcher: { publish: (name, data, opts) => published.push({ name, data, opts }) },
        eventBus: { subscribe: () => () => {} },
        log: () => {},
    });
};

/** A player pickup is the SECOND report for a property (the first is baseline). */
const pickup = (a, property) => {
    a._onStateChanged(property, false);   // baseline
    a._onStateChanged(property, true);    // the player action
};

describe('the property path, unchanged when nobody claims a location', () => {
    let a;
    beforeEach(() => { a = adapterFor(); });

    it('dispatches the check and queues the undo', () => {
        pickup(a, SUBJECT.property);
        expect(published.map((p) => p.name)).toEqual(['user:locationCheck']);
        expect(published[0].data.locationName).toBe(SUBJECT.ap_name);
        expect(a.undoQueue).toEqual([{ class: 'main', property: SUBJECT.property, value: false }]);
    });

    it('starts with an EMPTY owned set — an adapter nobody told behaves as it always has', () => {
        expect(a.hostOwnedLocations.size).toBe(0);
    });
});

describe('and it STANDS DOWN on a location the host owns', () => {
    /**
     * ⛔⛔ WHY THIS IS NOT MERELY REDUNDANT. With an `APItem` in the room the
     * game grants nothing, so the only writer of this flag is the bridge, on
     * the AP server's `ReceivedItems`. An echo the suppression happens to miss
     * would then read as a player pickup — checking the location a SECOND time
     * AND queueing an undo that writes the granted item straight back to false.
     * The gate that catches it is *"the flag flips EXACTLY ONCE"*.
     */
    it('no second check and NO UNDO — the undo would revoke the granted item', () => {
        const a = adapterFor();
        a.setHostOwnedLocations(new Set([SUBJECT.ap_name]));
        pickup(a, SUBJECT.property);
        expect(published).toEqual([]);
        expect(a.undoQueue).toEqual([]);
    });

    it('and the mutant is the same run with the set EMPTY — it checks and undoes', () => {
        const a = adapterFor();
        a.setHostOwnedLocations(new Set());
        pickup(a, SUBJECT.property);
        expect(published.map((p) => p.name)).toEqual(['user:locationCheck']);
        expect(a.undoQueue).toHaveLength(1);
    });

    /**
     * ⛓ A SET, NOT A DELETE — this is the row that makes the difference
     * observable. The two ENCOUNTER locations (`fire@L32`, `darksword@L12`) are
     * boss/special grants with no pickup entity: they are never rewritten, no
     * `APItem` stands there, and they MUST keep this path.
     */
    it('a location NOT in the set is untouched by the stand-down', () => {
        const other = CONFIG.locations.find((l) => l.property !== SUBJECT.property);
        const a = adapterFor();
        a.setHostOwnedLocations(new Set([SUBJECT.ap_name]));
        pickup(a, other.property);
        expect(published.map((p) => p.name)).toEqual(['user:locationCheck']);
        expect(published[0].data.locationName).toBe(other.ap_name);
    });

    it('matches on the AP NAME, which is what would actually be dispatched', () => {
        // ⛔ NOT the flash name: `flashLocationToApName` is the mapping the
        // dispatch itself uses, and the placement table speaks AP names. A set
        // of flash names would silently never match.
        const a = adapterFor();
        a.setHostOwnedLocations(new Set([SUBJECT.flash_name]));
        pickup(a, SUBJECT.property);
        expect(published.map((p) => p.name)).toEqual(['user:locationCheck']);
    });

    it('accepts an array as well as a Set, and null clears', () => {
        const a = adapterFor();
        a.setHostOwnedLocations([SUBJECT.ap_name]);
        expect(a.hostOwnedLocations.has(SUBJECT.ap_name)).toBe(true);
        a.setHostOwnedLocations(null);
        expect(a.hostOwnedLocations.size).toBe(0);
    });
});

describe('the M1 declarations in games/seedling.json', () => {
    /**
     * ⛔ ORDER IS THE GUARANTEE. BridgeGeneric builds `_properties` in
     * declaration order and reports in it, so `pendingExit` must arrive before
     * `level` in the frame a door fires — otherwise the host sees the level
     * move first and can no longer say which door caused it.
     */
    it('declares the four M1 properties BEFORE `level`', () => {
        const names = CONFIG.state_properties.map((p) => p.property);
        const level = names.indexOf('level');
        expect(level).toBeGreaterThan(-1);
        for (const p of ['pendingExit', 'pendingCheck', 'keyMask', 'totemCount']) {
            expect(names.indexOf(p)).toBeGreaterThan(-1);
            expect(names.indexOf(p)).toBeLessThan(level);
        }
        // and playerPositionX/Y keep theirs, which the crossing tie-break needs
        for (const p of ['playerPositionX', 'playerPositionY']) {
            expect(names.indexOf(p)).toBeLessThan(level);
        }
    });

    /**
     * ⛔ EVERY ENTRY IS A PROPERTY. `doConfigure` pushes every array element
     * into `_properties` without inspecting it, so a `$comment` object would
     * become a property with an undefined class alias — which is why M1's note
     * is a TOP-LEVEL key instead.
     */
    it('carries no stray entries — BridgeGeneric pushes every one of them', () => {
        for (const p of CONFIG.state_properties) {
            expect(Object.keys(p).sort()).toEqual(['class', 'property', 'type']);
            expect(CONFIG.classes[p.class]).toBeTruthy();
        }
    });
});

/**
 * The inertness harness (W5; ⛓ W8c reuses it): one game's reports through the adapter and the glue's two
 * bindings, under `config` — `changes` after the baseline burst.
 */
function runInertness(config, changes, inventory) {
    const pub = [];
    const reports = [];
    const a = new FlashBridgeAdapter({
        config,
        flashObjectId: `w5-${Math.random()}`,
        stateManager: { getLatestStateSnapshot: () => ({ inventory }) },
        dispatcher: { publish: (name, data) => pub.push({ name, location: data.locationName }) },
        eventBus: { subscribe: () => () => {} },
        log: () => {},
    });
    const region = new SeedlingRegionBinding({ now: () => 1_000_000 });
    region.onLoadRegion({ region_id: OVERWORLD, world: worldFor(OVERWORLD), arrivedFrom: null });
    const check = new SeedlingCheckBinding({ table: new Map(), placementKey: (l, t) => `${l}:${t}` });
    const effects = [];
    a.onStateReport = (p, v) => {
        reports.push([p, v]);
        effects.push(...region.onStateReport(p, v), ...check.onStateReport(p, v));
    };
    const declared = new Set(config.state_properties.map((p) => p.property));
    // What BridgeGeneric would report: the baseline burst in declaration order,
    // then the changes — a property the config does not declare is never reported.
    const baseline = { hasSword: false, hasShield: false, level: 0, playerPositionX: 160, playerPositionY: 288,
        pendingExit: '', pendingCheck: '', keyMask: 0, totemCount: 0, beam: false, rockSet: false, freezeObjects: false };
    for (const p of config.state_properties) {
        a._onStateChanged(p.property, baseline[p.property] ?? (p.type === 'int' ? 0 : false));
    }
    const queue0 = a._buildQueue();
    for (const [p, v] of changes) if (declared.has(p)) a._onStateChanged(p, v);
    const queue1 = a._buildQueue();
    return { pub, reports, effects, queue0, queue1, gameState: { ...a.gameState },
        bridge: JSON.parse(JSON.stringify({ state_properties: config.state_properties })) };
}

describe('⛓ W5 — `beam` / `rockSet` (the Moonrock statics) are INERT on the AP path', () => {
    /**
     * W5 declares the moonrock's two save statics in `games/seedling.json` so a
     * wasm arrival can stage level 0 off `readState`. They must change NOTHING
     * the host does with a report: the adapter acts on a property only through
     * `propertyToLocationFlash`, the undo (`_findPropertyDef`) and the echo
     * table, and the glue's two bindings read `level` / `playerPosition*` /
     * `pendingExit` / `pendingCheck` only. So the same game, configured WITH
     * and WITHOUT the two rows, must produce the same checks, undos, writes and
     * binding effects — the reports differing by exactly the two new rows.
     */
    const NEW = ['beam', 'rockSet'];
    const WITHOUT = { ...CONFIG, state_properties: CONFIG.state_properties.filter((p) => !NEW.includes(p.property)) };
    const INVENTORY = { 'Progressive Sword': 1, 'Red Key': 1 };

    const run = (config) => runInertness(config, [
        ['hasShield', true],                       // a player pickup → check + undo
        ['beam', true],                            // Shield.removed() → Main.beam
        ['pendingCheck', '1|0|5|0'],               // a clear (not a location here)
        ['rockSet', true],                         // the moonrock lands
        ['playerPositionX', 48], ['playerPositionY', 64],
        ['level', 86],                             // a crossing
        ['beam', false],
    ], INVENTORY);

    it('the shipped config declares exactly the two new rows, BEFORE `level`, mapping to no location', () => {
        const names = CONFIG.state_properties.map((p) => p.property);
        expect(names.filter((n) => !WITHOUT.state_properties.some((p) => p.property === n))).toEqual(NEW);
        for (const n of NEW) {
            expect(names.indexOf(n)).toBeLessThan(names.indexOf('level'));
            expect(CONFIG.locations.some((l) => l.property === n)).toBe(false);
            expect(CONFIG.state_properties.find((p) => p.property === n)).toEqual({ class: 'main', property: n, type: 'boolean' });
        }
        expect(adapterFor().propertyToLocationFlash).not.toHaveProperty('beam');
        expect(adapterFor().propertyToLocationFlash).not.toHaveProperty('rockSet');
    });

    it('WITH vs WITHOUT the two rows: the same checks, undos, writes and binding effects', () => {
        const w = run(CONFIG);
        const wo = run(WITHOUT);
        expect(w.pub).toEqual(wo.pub);
        expect(w.pub.map((p) => p.name)).toEqual(['user:locationCheck']);   // the shield pickup, once
        expect(w.queue0).toEqual(wo.queue0);
        expect(w.queue1).toEqual(wo.queue1);
        expect(w.queue1.length).toBeGreaterThan(0);
        expect(w.effects).toEqual(wo.effects);
        expect(w.effects.length).toBeGreaterThan(0);                        // the crossing was seen
    });

    it('the reports differ by EXACTLY the two new rows (the binding hook sees them; nothing acts on them)', () => {
        const w = run(CONFIG);
        const wo = run(WITHOUT);
        expect(w.reports.filter(([p]) => !NEW.includes(p))).toEqual(wo.reports);
        expect(w.reports.filter(([p]) => NEW.includes(p))).toEqual([['beam', false], ['rockSet', false],
            ['beam', true], ['rockSet', true], ['beam', false]]);
        const strip = (g) => Object.fromEntries(Object.entries(g).filter(([k]) => !NEW.includes(k)));
        expect(strip(w.gameState)).toEqual(wo.gameState);
    });
});

describe('⛓ W8c — `freezeObjects` (the Game static a Help / a dialogue / the cutscene sets) is INERT on the AP path', () => {
    /**
     * W8c declares `Game.freezeObjects` so the wasm adoption can SEE a freeze no
     * botStatus row carries (`wasmPlayback.adoptionRefusal`'s `freeze` clause):
     * the arrow-key tutorial `Help(2)` after the new game's cutscene left every
     * tape frame dead with every other clause passing (plan §5.15). Same
     * proof as W5's two rows: WITH vs WITHOUT it, the same checks, undos, writes
     * and binding effects.
     */
    const NEW = ['freezeObjects'];
    const WITHOUT = { ...CONFIG, state_properties: CONFIG.state_properties.filter((p) => !NEW.includes(p.property)) };
    const run = (config) => runInertness(config, [
        ['freezeObjects', true],                   // a Help comes up
        ['hasShield', true],                       // a player pickup → check + undo
        ['freezeObjects', false],                  // dismissed
        ['pendingCheck', '1|0|5|0'],
        ['playerPositionX', 48], ['playerPositionY', 64],
        ['level', 86],                             // a crossing
        ['freezeObjects', true],                   // a dialogue in the next room
    ], { 'Progressive Sword': 1, 'Red Key': 1 });

    it('the shipped config declares it once, on the Game class, BEFORE `level`, mapping to no location', () => {
        const names = CONFIG.state_properties.map((p) => p.property);
        expect(names.filter((n) => n === 'freezeObjects')).toHaveLength(1);
        expect(names.indexOf('freezeObjects')).toBeLessThan(names.indexOf('level'));
        expect(CONFIG.state_properties.find((p) => p.property === 'freezeObjects')).toEqual({ class: 'game', property: 'freezeObjects', type: 'boolean' });
        expect(CONFIG.locations.some((l) => l.property === 'freezeObjects')).toBe(false);
        expect(adapterFor().propertyToLocationFlash).not.toHaveProperty('freezeObjects');
    });
    it('WITH vs WITHOUT it: the same checks, undos, writes and binding effects', () => {
        const w = run(CONFIG);
        const wo = run(WITHOUT);
        expect(w.pub).toEqual(wo.pub);
        expect(w.pub.map((p) => p.name)).toEqual(['user:locationCheck']);
        expect(w.queue0).toEqual(wo.queue0);
        expect(w.queue1).toEqual(wo.queue1);
        expect(w.effects).toEqual(wo.effects);
        expect(w.effects.length).toBeGreaterThan(0);
    });
    it('the reports differ by EXACTLY its rows (the binding hook sees them; nothing acts on them)', () => {
        const w = run(CONFIG);
        const wo = run(WITHOUT);
        expect(w.reports.filter(([p]) => !NEW.includes(p))).toEqual(wo.reports);
        expect(w.reports.filter(([p]) => NEW.includes(p))).toEqual([['freezeObjects', false], ['freezeObjects', true],
            ['freezeObjects', false], ['freezeObjects', true]]);
    });
});

describe('⛓ MID-ROOM REPLAN — the delivery gate (`itemGate`): a driver decides which inventory a push writes', () => {
    const adapterWith = (inventory) => new FlashBridgeAdapter({
        config: CONFIG, flashObjectId: `test-${Math.random()}`,
        stateManager: { getLatestStateSnapshot: () => ({ inventory }) },
        dispatcher: { publish: () => {} }, eventBus: { subscribe: () => () => {} }, log: () => {},
    });
    const sword = (writes) => writes.find((w) => w.property === 'hasSword')?.value;

    it('no gate: the inventory as it stands (as before); a gate: what it returns, until it is cleared', () => {
        const a = adapterWith({ 'Progressive Sword': 1 });
        expect(a.itemGate).toBeNull();
        expect(sword(a._buildItemWritesFromInventory())).toBe(true);
        const seen = [];
        a.setItemGate((live) => { seen.push(live); return {}; });
        expect(sword(a._buildItemWritesFromInventory())).toBe(false); // held back = the property's clearing write
        expect(seen).toEqual([{ 'Progressive Sword': 1 }]);
        a.setItemGate(null);
        expect(sword(a._buildItemWritesFromInventory())).toBe(true);
    });

    it('_itemWritesFor answers "what would this inventory write" (a key writes no item property); liveInventory copies the snapshot', () => {
        const a = adapterWith({ 'Red Key': 1 });
        expect(a._itemWritesFor({ 'Red Key': 1 }, { quiet: true }).filter((w) => w.value === true)).toEqual([]);
        expect(sword(a._itemWritesFor({ 'Progressive Sword': 1 }, { quiet: true }))).toBe(true);
        const inv = a.liveInventory();
        inv.x = 1;
        expect(a.liveInventory()).toEqual({ 'Red Key': 1 });
    });

    it('a gate that throws is logged and the push writes the live inventory', () => {
        const a = adapterWith({ 'Progressive Sword': 1 });
        a.setItemGate(() => { throw new Error('boom'); });
        expect(sword(a._buildItemWritesFromInventory())).toBe(true);
    });
});
