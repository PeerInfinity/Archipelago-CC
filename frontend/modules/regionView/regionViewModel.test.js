/**
 * Pins for the region view model (region map step 2): the tri-value reachability, the location states and counts,
 * the interior state, the colour a view shows, exit traversability, the ONE discovery decision, and the
 * `displayRegionOf` fold — whose keys are DISPLAY groups, not rules regions.
 */
import { describe, it, expect, vi } from 'vitest';

// A rule here is { ok: bool } or { throws: true }; the shared engine is replaced by that reading.
vi.mock('../shared/ruleEngine.js', () => ({
    evaluateRule: (rule) => {
        if (rule.throws) throw new Error('bad rule');
        return rule.ok;
    },
}));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({ _isSnapshotInterface: true }) }));

const vm = await import('./regionViewModel.js');

const region = (name, locations = [], exits = []) => [name, { name, locations, exits }];
const staticData = {
    regions: new Map([
        region('A', [{ name: 'a1' }, { name: 'a2', access_rule: { ok: false } }, { name: 'a3', access_rule: { throws: true } }],
            [{ name: 'A→B', connected_region: 'B' }]),
        region('B', [{ name: 'b1' }], [{ name: 'B→A', connected_region: 'A' }, { name: 'B→C', connected_region: 'C' }]),
        region('C', [{ name: 'c1' }]),
        region('Empty'),
    ]),
};
const snapshot = { regionReachability: { A: true, B: 'reachable', C: false, Empty: 'checked' }, checkedLocations: ['b1'] };

const fakeDiscovery = ({ regions = [], locations = [], exits = [] } = {}) => ({
    isRegionDiscovered: (r) => regions.includes(r),
    isLocationDiscovered: (l) => locations.includes(l),
    isExitDiscovered: (r, e) => exits.includes(`${r}:${e}`),
});

describe('reachability and location state', () => {
    it('isRegionReachable: true / "reachable" / "checked" only', () => {
        expect(['A', 'B', 'C', 'Empty', 'Nope'].map((r) => vm.isRegionReachable(snapshot, r)))
            .toEqual([true, true, false, true, false]);
        expect(vm.isRegionReachable(null, 'A')).toBe(false);
    });

    it('locationState: checked first, then region reachability, then the rule (a throw is inaccessible)', () => {
        const errors = [];
        const st = (loc, regionName) => vm.locationState(snapshot, staticData, loc, { regionName, onError: (e) => errors.push(e.message) });
        expect(st({ name: 'b1' }, 'B')).toBe('checked');
        expect(st({ name: 'a1' }, 'A')).toBe('accessible');
        expect(st({ name: 'a2', access_rule: { ok: false } }, 'A')).toBe('inaccessible');
        expect(st({ name: 'a3', access_rule: { throws: true } }, 'A')).toBe('inaccessible');
        expect(st({ name: 'c1' }, 'C')).toBe('inaccessible');
        expect(errors).toEqual(['bad rule']);
        expect(vm.locationState(null, staticData, { name: 'a1' })).toBe('inaccessible');
        expect(vm.locationState(snapshot, staticData, { name: 'a1', parent_region: 'A' })).toBe('accessible');
    });

    it('locationCounts + regionInteriorState', () => {
        const a = vm.locationCounts(snapshot, staticData, 'A');
        expect(a).toEqual({ checked: 0, accessible: 1, inaccessible: 2, total: 3, hasAccessible: true, hasInaccessible: true,
            hasUnchecked: true, allChecked: false, hasLocations: true });
        expect(vm.regionInteriorState(a, true)).toBe('mixed-locations');
        expect(vm.regionInteriorState(a, false)).toBe(null);
        const b = vm.locationCounts(snapshot, staticData, 'B');
        expect(b.allChecked).toBe(true);
        expect(vm.regionInteriorState(b, true)).toBe('completed');
        const c = vm.locationCounts(snapshot, staticData, 'C');
        expect(c).toMatchObject({ accessible: 0, inaccessible: 1 });
        expect(vm.regionInteriorState(c, false)).toBe(null);
        expect(vm.regionInteriorState({ ...c, hasAccessible: false, hasInaccessible: true }, true)).toBe('all-inaccessible');
        expect(vm.regionInteriorState({ ...a, hasInaccessible: false }, true)).toBe('all-accessible');
        expect(vm.regionInteriorState(vm.locationCounts(snapshot, staticData, 'Empty'), true)).toBe('completed');
        expect(vm.locationCounts(null, staticData, 'A')).toEqual({ checked: 0, accessible: 0, inaccessible: 0, total: 0 });
    });

    it('regionColorState follows the accessibility filter and discovery, not only reachability', () => {
        const ctx = vm.discoveryContext({ discovery: fakeDiscovery({ regions: ['A'] }), regions: staticData.regions });
        expect(vm.regionColorState(snapshot, 'A', ctx)).toBe('accessible');
        expect(vm.regionColorState(snapshot, 'C', ctx)).toBe('inaccessible');
        expect(vm.regionColorState(snapshot, 'A', { ...ctx, showAccessibility: false })).toBe(null);
        const on = { ...ctx, active: true };
        expect(vm.regionColorState(snapshot, 'A', on)).toBe('accessible');
        expect(vm.regionColorState(snapshot, 'B', on)).toBe(null); // undiscovered: no colour
        expect(vm.regionColorState(snapshot, 'B', { ...on, settings: { colorUndiscoveredByReachability: true } })).toBe('accessible');
    });
});

describe('exitState', () => {
    it('one-way: source reachable AND forward rule; two-way: either direction', () => {
        expect(vm.exitState(snapshot, staticData, { source: 'A', target: 'C', forwardRule: { ok: true } }).traversable).toBe(true);
        expect(vm.exitState(snapshot, staticData, { source: 'C', target: 'A', forwardRule: { ok: true } }).traversable).toBe(false);
        expect(vm.exitState(snapshot, staticData, { source: 'C', target: 'A', forwardRule: { ok: true }, reverseRule: { ok: true },
            bidirectional: true }).traversable).toBe(true);
        expect(vm.exitState(snapshot, staticData, { source: 'C', target: 'A', reverseRule: { ok: false }, bidirectional: true }))
            .toEqual({ sourceReachable: false, targetReachable: true, forwardAccessible: true, reverseAccessible: false, traversable: false });
        // A reverse rule on a one-way pair is not read.
        expect(vm.exitState(snapshot, staticData, { source: 'A', target: 'B', reverseRule: { throws: true } }).reverseAccessible).toBe(true);
        const seen = [];
        expect(vm.exitState(snapshot, staticData, { source: 'A', target: 'B', forwardRule: { throws: true } },
            { onError: (e, dir) => seen.push(dir) }).forwardAccessible).toBe(false);
        expect(seen).toEqual(['forward']);
    });
});

describe('discovery visibility — the one decision', () => {
    const base = { active: true, settings: { undiscoveredDisplay: 'hidden' }, regions: staticData.regions };
    const ctxOf = (disc, extra = {}) => vm.discoveryContext({ ...base, discovery: fakeDiscovery(disc), ...extra });

    it('discovery off: everything shown', () => {
        const ctx = vm.discoveryContext({ discovery: fakeDiscovery(), regions: staticData.regions });
        expect(vm.regionVisibility('C', ctx)).toBe('shown');
        expect(vm.locationDiscovery('c1', 'C', ctx)).toEqual({ discovered: false, placeholder: false, regionHidden: false, visibility: 'shown' });
        expect(vm.exitDiscovery({ source: 'A', target: 'B', forwardExitName: 'A→B' }, ctx)).toEqual({ discovered: true, visibility: 'shown' });
    });

    it('regions: discovered shown; entered from a discovered one a placeholder; else hidden', () => {
        const ctx = ctxOf({ regions: ['A'] });
        expect(vm.regionDiscovery('A', ctx)).toEqual({ discovered: true, hasEntrance: null, visibility: 'shown' });
        expect(vm.regionDiscovery('B', ctx)).toEqual({ discovered: false, hasEntrance: true, visibility: 'placeholder' });
        expect(vm.regionDiscovery('C', ctx)).toEqual({ discovered: false, hasEntrance: false, visibility: 'hidden' });
        // The panel's "show undiscovered" off hides the placeholders.
        expect(vm.regionVisibility('B', ctxOf({ regions: ['A'] }, { showUndiscovered: false }))).toBe('hidden');
        // …but only when undiscoveredDisplay is 'hidden'.
        expect(vm.regionVisibility('B', ctxOf({ regions: ['A'] }, { showUndiscovered: false, settings: { undiscoveredDisplay: 'placeholder' } })))
            .toBe('placeholder');
    });

    it('locations: a placeholder when it or its region is undiscovered; hidden with a hidden region', () => {
        const ctx = ctxOf({ regions: ['A'], locations: ['a1'] });
        expect(vm.locationDiscovery('a1', 'A', ctx)).toEqual({ discovered: true, placeholder: false, regionHidden: false, visibility: 'shown' });
        expect(vm.locationDiscovery('a2', 'A', ctx)).toEqual({ discovered: false, placeholder: true, regionHidden: false, visibility: 'placeholder' });
        expect(vm.locationDiscovery('b1', 'B', ctx).visibility).toBe('placeholder');
        expect(vm.locationDiscovery('c1', 'C', ctx)).toEqual({ discovered: false, placeholder: true, regionHidden: true, visibility: 'hidden' });
        expect(vm.locationVisibility('a2', 'A', ctxOf({ regions: ['A'] }, { showUndiscovered: false }))).toBe('hidden');
    });

    it('exits: hidden past an unentered endpoint; a placeholder until either direction is discovered', () => {
        const ctx = ctxOf({ regions: ['A'], exits: ['B:B→A'] });
        const ab = { source: 'A', target: 'B', forwardExitName: 'A→B', reverseExitName: 'B→A' };
        expect(vm.exitDiscovery(ab, ctx)).toEqual({ discovered: true, visibility: 'shown' });
        expect(vm.exitDiscovery({ ...ab, reverseExitName: '' }, ctx)).toEqual({ discovered: false, visibility: 'placeholder' });
        expect(vm.exitVisibility({ source: 'B', target: 'C', forwardExitName: 'B→C' }, ctx)).toBe('hidden');
        expect(vm.exitVisibility({ ...ab, reverseExitName: '' }, ctxOf({ regions: ['A'] }, { showUndiscovered: false }))).toBe('hidden');
    });
});

describe('the inverse-entrance index (region-map step 3b) — the same answers as the scan', () => {
    it('index.has(name) === hasEntranceFromDiscoveredRegion(name), over every discovered subset of random graphs', () => {
        let seed = 7;
        const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
        for (let g = 0; g < 40; g += 1) {
            const names = Array.from({ length: 6 }, (_, i) => `R${i}`);
            const regions = new Map(names.map((n) => [n, {
                name: n,
                exits: names.filter(() => rnd() < 0.3).map((t, i) => ({ name: `${n}>${t}${i}`, connected_region: t }))
                    .concat(rnd() < 0.2 ? [{ name: `${n}>nowhere`, connected_region: null }] : []),
            }]));
            for (let mask = 0; mask < 64; mask += 1) {
                const disc = fakeDiscovery({ regions: names.filter((_, i) => mask & (1 << i)) });
                const index = vm.enteredFromDiscoveredIndex(regions, disc);
                for (const n of [...names, 'Nope']) expect(index.has(n)).toBe(vm.hasEntranceFromDiscoveredRegion(n, regions, disc));
            }
        }
    });

    it('a context WITH the index gives every region / location / exit decision the scan gives; WITHOUT it has no extra key', () => {
        const base = { active: true, settings: { undiscoveredDisplay: 'hidden' }, regions: staticData.regions };
        for (const discovered of [[], ['A'], ['B'], ['A', 'C'], ['A', 'B', 'C', 'Empty']]) {
            for (const showUndiscovered of [true, false]) {
                const discovery = fakeDiscovery({ regions: discovered, locations: ['a1'], exits: ['B:B→A'] });
                const plain = vm.discoveryContext({ ...base, discovery, showUndiscovered });
                const indexed = vm.discoveryContext({ ...base, discovery, showUndiscovered,
                    enteredFromDiscovered: vm.enteredFromDiscoveredIndex(staticData.regions, discovery) });
                expect(Object.keys(plain)).not.toContain('enteredFromDiscovered');
                for (const [name, data] of staticData.regions) {
                    expect(vm.regionDiscovery(name, indexed)).toEqual(vm.regionDiscovery(name, plain));
                    for (const l of data.locations) expect(vm.locationDiscovery(l.name, name, indexed)).toEqual(vm.locationDiscovery(l.name, name, plain));
                    for (const e of data.exits) {
                        const ex = { source: name, target: e.connected_region, forwardExitName: e.name, reverseExitName: 'B→A' };
                        expect(vm.exitDiscovery(ex, indexed)).toEqual(vm.exitDiscovery(ex, plain));
                    }
                }
            }
        }
    });
});

describe('displayGroupsOf — the displayRegionOf fold', () => {
    const registry = {
        get: (id) => (id === 'seedling'
            ? { compositeMap: { displayRegionOf: (name, sc) => sc?.playable_payload?.atlas_region ?? name } }
            : id === 'plain' ? {} : undefined),
    };
    const rules = { preset_sidecars: { 1: [
        { region_id: 'level_0__r0c0', substrate: 'seedling', playable_payload: { atlas_region: 'level_0' } },
        { region_id: 'level_0__r1c0', substrate: 'seedling', playable_payload: { atlas_region: 'level_0' } },
        { region_id: 'level_1', substrate: 'seedling', playable_payload: { atlas_region: 'level_1' } },
        { region_id: 'room', substrate: 'plain' },
    ] } };
    const sidecars = vm.sidecarIndex(rules, 1);
    const names = ['Menu', 'level_0__r0c0', 'level_0__r1c0', 'level_1', 'room'];

    it('folds sub-regions by the substrate hook; a region without one is its own key', () => {
        const groups = vm.displayGroupsOf(names, { registry, sidecarOf: (n) => sidecars.get(n) });
        expect([...groups]).toEqual([
            ['Menu', ['Menu']],
            ['level_0', ['level_0__r0c0', 'level_0__r1c0']],
            ['level_1', ['level_1']],
            ['room', ['room']],
        ]);
        expect(vm.displayKeyIndex(groups).get('level_0__r1c0')).toBe('level_0');
    });

    it('sidecarIndex reads the committed OBJECT shape (keyed by region name) as well as an array (region-map 3b fix)', () => {
        const asObject = { preset_sidecars: { 1: Object.fromEntries(rules.preset_sidecars[1].map((sc) => {
            const { region_id: id, ...rest } = sc;
            return [id, rest];
        })) } };
        const byObject = vm.sidecarIndex(asObject, 1);
        expect([...byObject.keys()]).toEqual([...sidecars.keys()]);
        const groups = vm.displayGroupsOf(names, { registry, sidecarOf: (n) => byObject.get(n) });
        expect([...groups.keys()]).toEqual(['Menu', 'level_0', 'level_1', 'room']);
        expect(vm.sidecarIndex({ preset_sidecars: { 1: null } }, 1).size).toBe(0);
    });

    it('⚠ a display key is NOT a rules region: level_0 is a key while no level_0 region exists', () => {
        const groups = vm.displayGroupsOf(names, { registry, sidecarOf: (n) => sidecars.get(n) });
        expect(groups.has('level_0')).toBe(true);
        expect(names.includes('level_0')).toBe(false);
    });

    it('substrateOf overrides the sidecar\'s substrate; no registry means no folding', () => {
        expect([...vm.displayGroupsOf(names, { sidecarOf: (n) => sidecars.get(n) }).keys()]).toEqual(names);
        expect([...vm.displayGroupsOf(['x__1'], { registry, substrateOf: () => 'seedling' }).keys()]).toEqual(['x__1']);
    });

    it('aggregation: counts sum; a group is shown if any member is', () => {
        const sum = vm.aggregateCounts([vm.locationCounts(snapshot, staticData, 'A'), vm.locationCounts(snapshot, staticData, 'B')]);
        expect(sum).toEqual({ checked: 1, accessible: 1, inaccessible: 2, total: 4, hasAccessible: true, hasInaccessible: true,
            hasUnchecked: true, allChecked: false, hasLocations: true });
        expect(vm.aggregateVisibility(['hidden', 'placeholder'])).toBe('placeholder');
        expect(vm.aggregateVisibility(['hidden', 'shown', 'placeholder'])).toBe('shown');
        expect(vm.aggregateVisibility(['hidden'])).toBe('hidden');
        expect(vm.aggregateVisibility([])).toBe('hidden');
    });
});
