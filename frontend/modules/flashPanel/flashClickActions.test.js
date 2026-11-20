/**
 * ⛓ CA-S4: FLASH'S MAP-CLICK TELEPORT (`flashClickActions.js`, `flashPanelUI.js`).
 * ⚖ user, session 84c8ab35, 2026-11-20T16:29:00Z, *"Per-map option (Recommended)"*: each map's "On click" strip has its
 * own "Teleport in Flash"; the Region Graph's starts with the current box setting, the Region Map's starts OFF; the box
 * keeps working only for clicks outside the two maps.
 *
 * PINNED:
 *   - registration: `_setupTeleportUI` registers `flash.teleport` + `flash.teleportLocation` when the game can teleport,
 *     registers nothing (and unregisters) when it cannot; the teardown unregisters; a second panel never steals them;
 *   - the initial values: the Graph = the box at that moment (ticked → true, unticked → false), the Map = false;
 *   - the run: a region click → `_teleportToRegion`, a location click → `_teleportToLocation`; no game → `no-game`;
 *   - the box (`handleUserLocationCheck`): a check from any OTHER panel teleports when ticked; the two maps' click
 *     checks and bulk checks never do; Flash's own never does;
 *   - the panel no longer subscribes to `regionGraph:nodeSelected` (source scan).
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./index.js', async (importOriginal) => ({ ...(await importOriginal()), getSeedlingRegionGlue: () => null }));
const { FlashPanelUI } = await import('./flashPanelUI.js');
const CA = await import('../regionView/clickActions.js');
const { makeFlashTeleportActions } = await import('./flashClickActions.js');
const { REGION_GRAPH_ORIGINATORS } = await import('../regionGraph/regionGraphOriginators.js');
const { REGION_MAP_ORIGINATORS } = await import('../regionMap/regionMapClickActions.js');

const ID = CA.PANEL_ACTION_IDS;

/** A FlashPanelUI stand-in: the fields `_setupTeleportUI` and the teleports touch, nothing else. */
function standIn({ teleport = true, adapter = true, boxChecked = false } = {}) {
    const p = Object.create(FlashPanelUI.prototype);
    const el = () => ({ style: {}, innerHTML: '', appendChild() {}, append() {} });
    Object.assign(p, {
        gameConfig: { teleport, region_coords: {}, location_coords: {} },
        adapter: adapter ? {} : null,
        teleportRow: el(), teleportRegionSelect: el(), teleportLocationSelect: el(),
        teleportOnClickCheckbox: { checked: boxChecked },
        calls: [],
        _panelLog: () => {},
    });
    p._teleportToRegion = (r) => p.calls.push(['region', r]);
    p._teleportToLocation = (l) => p.calls.push(['location', l]);
    return p;
}

beforeEach(() => {
    CA.resetClickActionsForTests();
    globalThis.document ??= { createElement: () => ({}) };
});
afterEach(() => CA.resetClickActionsForTests());

describe('registration follows the game\'s teleport', () => {
    it('a teleport-capable game registers both actions; a teardown unregisters them', () => {
        const p = standIn();
        p._setupTeleportUI();
        expect(CA.getClickAction(ID.flashTeleport)?.owner).toBe('flash');
        expect(CA.getClickAction(ID.flashTeleportLocation)?.target).toBe('location');
        expect(CA.getClickAction(ID.flashTeleport).order).toBe(CA.ORDER.select);
        p._setupTeleportUI(); // a re-setup is idempotent (no duplicate-id throw)
        expect(CA.listClickActions('region').filter((d) => d.owner === 'flash')).toHaveLength(1);
        p._unregisterClickActions();
        expect(CA.getClickAction(ID.flashTeleport)).toBeNull();
        expect(CA.getClickAction(ID.flashTeleportLocation)).toBeNull();
    });

    it('a game that cannot teleport registers nothing, and unregisters what an earlier game registered', () => {
        const p = standIn();
        p._setupTeleportUI();
        p.gameConfig = { teleport: false };
        p._setupTeleportUI();
        expect(CA.getClickAction(ID.flashTeleport)).toBeNull();
        const q = standIn({ teleport: false });
        q._setupTeleportUI();
        expect(CA.getClickAction(ID.flashTeleport)).toBeNull();
    });

    it('a second Flash panel never takes the first one\'s actions, nor unregisters them', () => {
        const a = standIn();
        const b = standIn();
        a._setupTeleportUI();
        b._setupTeleportUI();
        b._unregisterClickActions();
        expect(CA.getClickAction(ID.flashTeleport)).not.toBeNull();
        CA.runClickActions('regionGraph', 'region', { regionName: 'R' }, { enabled: true, region: { [ID.flashTeleport]: true } }, {});
        expect(a.calls).toEqual([['region', 'R']]);
        expect(b.calls).toEqual([]);
    });
});

describe('the initial values (⚖ 2026-11-20): the Graph = the box now, the Map = off', () => {
    for (const box of [true, false]) {
        it(`box ${box ? 'ticked' : 'unticked'}`, () => {
            const p = standIn({ boxChecked: box });
            for (const d of makeFlashTeleportActions(() => p)) {
                expect(d.initial('regionGraph')).toBe(box);
                expect(d.initial('regionMap')).toBe(false);
            }
        });
    }

    it('seeded once: after the Graph holds its value, ticking the box changes nothing', () => {
        const p = standIn({ boxChecked: false });
        p._setupTeleportUI();
        const bare = () => ({ enabled: true, region: {}, location: {} });
        const { settings } = CA.withInitialValues('regionGraph', bare());
        expect(settings.region[ID.flashTeleport]).toBe(false);
        expect(settings.location[ID.flashTeleportLocation]).toBe(false);
        p.teleportOnClickCheckbox.checked = true;
        CA.runClickActions('regionGraph', 'region', { regionName: 'R' }, settings, {});
        expect(p.calls).toEqual([]);
        // an UNSEEDED config (a row's session override) follows the box at click time
        CA.runClickActions('regionGraph', 'region', { regionName: 'R' }, bare(), {});
        expect(p.calls).toEqual([['region', 'R']]);
        // the Map's never does
        CA.runClickActions('regionMap', 'region', { regionName: 'R' }, bare(), {});
        expect(p.calls).toEqual([['region', 'R']]);
    });
});

describe('the run', () => {
    it('a region click teleports to the region, a location click to the location', () => {
        const p = standIn();
        p._setupTeleportUI();
        const on = { enabled: true, region: { [ID.flashTeleport]: true }, location: { [ID.flashTeleportLocation]: true } };
        const r = CA.runClickActions('regionMap', 'region', { regionName: 'R' }, on, {});
        const l = CA.runClickActions('regionMap', 'location', { regionName: 'R', locationName: 'L' }, on, {});
        expect(p.calls).toEqual([['region', 'R'], ['location', 'L']]);
        expect(r.results).toEqual([{ id: ID.flashTeleport, owner: 'flash', result: { ok: true, region: 'R' } }]);
        expect(l.results).toEqual([{ id: ID.flashTeleportLocation, owner: 'flash', result: { ok: true, location: 'L' } }]);
    });

    it('no game up: no teleport, `no-game`', () => {
        const p = standIn({ adapter: false });
        for (const d of makeFlashTeleportActions(() => p)) CA.registerClickAction(d);
        const r = CA.runClickActions('regionGraph', 'region', { regionName: 'R' }, { enabled: true, region: { [ID.flashTeleport]: true } }, {});
        expect(r.results[0].result).toEqual({ ok: false, reason: 'no-game' });
        expect(p.calls).toEqual([]);
    });
});

describe('the box (`handleUserLocationCheck`) keeps only the non-map sources', () => {
    const MAP = [...Object.values(REGION_GRAPH_ORIGINATORS), ...Object.values(REGION_MAP_ORIGINATORS)];

    it('MAP_CLICK_ORIGINATORS = the two map panels\' originators exactly', () => {
        expect([...CA.MAP_CLICK_ORIGINATORS].sort()).toEqual([...MAP].sort());
    });

    it('ticked: another panel\'s check teleports; a map\'s click or bulk check never does; Flash\'s own never does', () => {
        const p = standIn({ boxChecked: true });
        for (const originator of ['RegionsPanel', 'locationsPanel', undefined, 'textAdventure']) {
            p.handleUserLocationCheck({ locationName: `L-${originator}`, originator });
        }
        for (const originator of [...MAP, 'FlashPanel']) p.handleUserLocationCheck({ locationName: `M-${originator}`, originator });
        expect(p.calls).toEqual([['location', 'L-RegionsPanel'], ['location', 'L-locationsPanel'], ['location', 'L-undefined'],
            ['location', 'L-textAdventure']]);
    });

    it('unticked: nothing teleports', () => {
        const p = standIn({ boxChecked: false });
        p.handleUserLocationCheck({ locationName: 'L', originator: 'RegionsPanel' });
        expect(p.calls).toEqual([]);
    });
});

describe('the regionGraph:nodeSelected listener is gone', () => {
    it('flashPanelUI.js and index.js neither subscribe to it nor register the intent', () => {
        for (const f of ['./flashPanelUI.js', './index.js']) {
            const src = readFileSync(new URL(f, import.meta.url), 'utf8');
            expect(src, f).not.toMatch(/subscribe\(\s*'regionGraph:nodeSelected'/);
            expect(src, f).not.toMatch(/SubscriberIntent\(\s*'regionGraph:nodeSelected'/);
        }
    });
});
