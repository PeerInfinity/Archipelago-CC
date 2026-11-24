/**
 * Pins for the shared region actions (region map step 2, D3): each action reads only the handles it is given,
 * dispatches through THE CALLER'S dispatcher with the caller's source/originator, and returns a result instead of
 * flashing anything. The restart step (⛓ RETURN TO MENU) keeps navigationManager.restart.test.js's three cases.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => rule.ok }));

const a = await import('./regionActions.js');

const ADJ = { Menu: [['GameStart', 'Start']], Start: [['toB', 'B'], ['drop', 'Pit']], Pit: [], B: [], C: [['cToB', 'B']] };
function bfs(from, to) {
    const seen = new Set([from]);
    const queue = [[{ region: from, exitUsed: null }]];
    while (queue.length) {
        const path = queue.shift();
        const here = path[path.length - 1].region;
        if (here === to) return path;
        for (const [exit, next] of ADJ[here] ?? []) {
            if (!seen.has(next)) { seen.add(next); queue.push([...path, { region: next, exitUsed: exit }]); }
        }
    }
    return null;
}
const staticData = { regions: new Map([
    ['Menu', { locations: [] }], ['Start', { locations: [{ name: 's1' }, { name: 's2', access_rule: { ok: false } }, { name: 's3' }] }],
    ['B', { locations: [] }], ['Pit', { locations: [] }], ['C', { locations: [] }],
]) };
const snapshot = { checkedLocations: ['s3'] };
const stateManager = {
    getStartRegions: () => ['Menu'], getStaticData: () => staticData, getLatestStateSnapshot: () => snapshot,
};
const pathFinder = {
    stateManager,
    findPathWithExits: (x, y) => { const p = bfs(x, y); return p ? { steps: p, length: p.length - 1 } : null; },
    findPath: (x, y) => {
        const p = bfs(x, y);
        return p ? { steps: p.map((s) => s.region), nextExit: p[1]?.exitUsed ?? null, length: p.length - 1 } : null;
    },
    buildAccessibilityMap: () => ADJ,
    findExitBetweenRegions: (s, t) => (ADJ[s] ?? []).find(([, n]) => n === t)?.[0] ?? null,
};
function handles({ here = 'Menu', path = [], rules = null, restart = null } = {}) {
    const published = [];
    const gs = {
        region: here, path: [...path],
        getCurrentRegion() { return this.region; },
        setCurrentRegion(r) { this.region = r; },
        getPath() { return this.path; },
        getLastRegionInPath() { return this.path.at(-1)?.region ?? null; },
        trimPath: vi.fn(),
        updatePath: vi.fn(),
        addLocationCheck: vi.fn(),
    };
    const dispatcher = { publish: (event, payload, target) => published.push({ event, payload, target }) };
    const events = [];
    return {
        h: { dispatcher, eventBus: { publish: (e, d) => events.push([e, d]) }, gameState: gs, stateManager, pathFinder,
            getRules: () => rules, restart },
        published, events, gs,
    };
}
const rulesWith = (flag) => ({ rules: { start_regions: { 1: ['Menu'] }, exporter: { 1: flag ? { return_to_menu: true } : {} } }, playerId: '1' });

describe('moves', () => {
    // ⚖ No "one step" (user, 2026-11-17): `planOneStepMove` / `moveOneStep` / `moveDirectly` left this module in CA-S3
    // with their last caller (the Region Map's interim click reader). A direct move is `planDirectMove` +
    // `publishRegionMove`, as the click actions' route from the player does (`clickActions.js` `routeTo`).
    it('directly: the final exit from the second-to-last region, under the caller\'s source and dispatcher', () => {
        const { h, published } = handles();
        const r = a.planDirectMove(h, 'B');
        expect(r).toMatchObject({ ok: true, move: { sourceRegion: 'Start', targetRegion: 'B', exitName: 'toB' } });
        a.publishRegionMove(h, r.move, 'regionGraph-direct');
        expect(published).toEqual([{ event: 'user:regionMove', target: 'bottom', payload: {
            sourceRegion: 'Start', sourceUID: undefined, targetRegion: 'B', exitName: 'toB', updatePath: false,
            source: 'regionGraph-direct' } }]);
    });

    it('a result, never a flash: no current region / already there / no path', () => {
        expect(a.planDirectMove(handles({ here: null }).h, 'B')).toEqual({ ok: false, reason: 'no-current' });
        expect(a.planDirectMove(handles({ here: 'B' }).h, 'B')).toEqual({ ok: false, reason: 'already-there', from: 'B' });
        expect(a.planDirectMove(handles({ here: 'Pit' }).h, 'B')).toEqual({ ok: false, reason: 'no-path', from: 'Pit' });
        const thrower = handles();
        thrower.h.gameState.getCurrentRegion = () => { throw new Error('boom'); };
        const errs = [];
        expect(a.planDirectMove(thrower.h, 'B', { onError: (e) => errs.push(e.message) }).reason).toBe('no-current');
        expect(errs).toEqual(['boom']);
    });
});

describe('the RESTART step (⛓ RETURN TO MENU) — navigationManager.restart.test.js\'s cases at the new home', () => {
    it('flag ON, no walk from the pit: the step is the Menu panel\'s Restart, and nothing is dispatched', () => {
        const restart = vi.fn(() => ({ mode: 'world', target: 'Menu' }));
        const { h, published } = handles({ here: 'Pit', rules: rulesWith(true), restart });
        expect(a.takeRestartStep(h, 'Pit', 'B')).toEqual({ ok: true, region: 'Menu' });
        expect(restart).toHaveBeenCalledTimes(1);
        expect(published).toEqual([]);
    });

    it('flag OFF: no Restart; no path', () => {
        const restart = vi.fn(() => ({}));
        const { h } = handles({ here: 'Pit', rules: rulesWith(false), restart });
        expect(a.takeRestartStep(h, 'Pit', 'B')).toEqual({ ok: false });
        expect(restart).not.toHaveBeenCalled();
    });

    it('a walk exists: no Restart (walk preferred)', () => {
        const restart = vi.fn(() => ({}));
        expect(a.takeRestartStep(handles({ rules: rulesWith(true), restart }).h, 'C', 'B')).toEqual({ ok: false });
        expect(restart).not.toHaveBeenCalled();
    });

    it('the Menu panel refusing the restart (or absent) is no restart', () => {
        expect(a.takeRestartStep(handles({ here: 'Pit', rules: rulesWith(true), restart: () => null }).h, 'Pit', 'B')).toEqual({ ok: false });
        expect(a.takeRestartStep(handles({ here: 'Pit', rules: rulesWith(true) }).h, 'Pit', 'B')).toEqual({ ok: false });
    });
});

describe('path edits', () => {
    it('addToPath with no path yet: ONE move, gameState builds the path', () => {
        const { h, published } = handles();
        expect(a.addToPath(h, 'B', { source: 'regionGraph-addToPath' })).toEqual({ ok: true, kind: 'single', from: 'Menu' });
        expect(published).toEqual([{ event: 'user:regionMove', target: { initialTarget: 'bottom' },
            payload: { targetRegion: 'B', sourceRegion: 'Menu', source: 'regionGraph-addToPath' } }]);
    });

    it('addToPath from the path\'s end: every step, beforeExecute first', () => {
        const order = [];
        const { h, published } = handles({ path: [{ type: 'regionMove', region: 'Menu' }] });
        h.dispatcher.publish = (e, p) => { order.push(`dispatch ${p.targetRegion}`); published.push(p); };
        const r = a.addToPath(h, 'B', { source: 's', beforeExecute: () => order.push('before') });
        expect(r).toMatchObject({ ok: true, kind: 'path', from: 'Menu', regions: ['Start', 'B'] });
        expect(order[0]).toBe('before');
        const none = handles({ path: [{ type: 'regionMove', region: 'Pit' }] });
        const before = vi.fn();
        expect(a.addToPath(none.h, 'B', { source: 's', beforeExecute: before })).toEqual({ ok: false, reason: 'no-path', from: 'Pit' });
        expect(before).not.toHaveBeenCalled();
    });

    it('overwritePath: reset to the start, trim, beforeExecute, then walk', () => {
        const { h, gs } = handles({ here: 'B', path: [{ type: 'regionMove', region: 'B' }] });
        const before = vi.fn();
        const r = a.overwritePath(h, 'B', { source: 'regionGraph-overwritePath', beforeExecute: before });
        expect(gs.region).toBe('Menu');
        expect(gs.trimPath).toHaveBeenCalledWith('Menu', 1);
        expect(before).toHaveBeenCalledTimes(1);
        expect(r).toMatchObject({ ok: true, kind: 'path', from: 'Menu', regions: ['Start', 'B'] });
        expect(a.overwritePath(handles().h, 'Menu', { source: 's' })).toEqual({ ok: false, reason: 'already-there', from: 'Menu' });
    });
});

describe('location checks + select/show', () => {
    it('one check: the caller\'s originator, originalDOMEvent, target bottom', () => {
        const { h, published } = handles();
        expect(a.checkLocation(h, { locationName: 's1', regionName: 'Start', originator: 'RegionGraphCheck' })).toEqual({ ok: true });
        expect(published).toEqual([{ event: 'user:locationCheck', target: { initialTarget: 'bottom' },
            payload: { locationName: 's1', regionName: 'Start', originator: 'RegionGraphCheck', originalDOMEvent: true } }]);
        expect(a.checkLocation({ dispatcher: null }, { locationName: 's1' })).toEqual({ ok: false, reason: 'no-dispatcher' });
    });

    it('bulk: unchecked AND accessible by rule only', () => {
        const { h, published } = handles();
        expect(a.bulkCheckCandidates(h, 'Start')).toEqual(['s1']);
        expect(a.checkAccessibleLocationsInRegion(h, 'Start', { originator: 'RegionGraphBulkCheck' })).toEqual({ ok: true, checked: 1 });
        expect(published.map((p) => p.payload.originator)).toEqual(['RegionGraphBulkCheck']);
        expect(a.bulkCheckCandidates(h, 'Menu')).toEqual([]);
        expect(a.bulkCheckCandidates(h, 'Nowhere')).toEqual([]);
    });

    it('discovery can turn location checks off', () => {
        expect(a.locationChecksAllowed()).toBe(true);
        expect(a.locationChecksAllowed({ active: true, settings: { disableLocationCheckUI: true } })).toBe(false);
        expect(a.locationChecksAllowed({ active: false, settings: { disableLocationCheckUI: true } })).toBe(true);
    });

    it('show publishes through the caller\'s bus (CA-S5: publishNodeSelected is gone, with the nodeSelected events)', () => {
        expect(a.publishNodeSelected).toBeUndefined();
        const { h, events, gs } = handles();
        a.showRegionInRegionsPanel(h, 'B');
        expect(events).toEqual([
            ['ui:activatePanel', { panelId: 'regionsPanel' }],
            ['ui:navigateToRegion', { regionName: 'B' }],
        ]);
        a.addLocationCheckToPath(h, 's1', 'Start');
        expect(gs.addLocationCheck).toHaveBeenCalledWith('s1', 'Start');
    });

    it('start regions', () => {
        const { h } = handles();
        expect(a.primaryStartRegion(h)).toBe('Menu');
        expect(a.isStartRegion(h, 'Menu')).toBe(true);
        expect(a.primaryStartRegion({ stateManager: { getStartRegions: () => [], getStaticData: () => staticData } })).toBe('Menu');
        expect(a.primaryStartRegion({ stateManager: {} })).toBe(null);
    });
});
