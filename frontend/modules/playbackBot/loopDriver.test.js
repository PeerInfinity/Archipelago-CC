import { describe, it, expect } from 'vitest';
import {
    MANA_STRATEGIES, availableTasks, buildLoopPath, findRoute, nextTask, pathCost, planNextLoop,
} from './loopDriver.js';

// Menu --GameStart--> Overworld --Port--> Castle --Stairs--> Vault
//                     Overworld --Side--> Field
const EXITS = {
    Menu: [{ name: 'GameStart', to: 'Overworld' }],
    Overworld: [{ name: 'Port', to: 'Castle' }, { name: 'Side', to: 'Field' }],
    Castle: [{ name: 'Stairs', to: 'Vault' }],
    Field: [],
    Vault: [],
};
const LOCATIONS = { Menu: [], Overworld: ['Gate'], Castle: ['Hall'], Field: ['Grass'], Vault: ['Chest'] };

function makeView({ discoveredExits = [], discoveredLocations = [], target = null, costs = {}, maxMana = 100, ...rest } = {}) {
    const exits = new Set(discoveredExits);
    const locs = new Set(discoveredLocations);
    const c = { move: 10, explore: 20, check: 30, ...costs };
    return {
        startRegion: 'Menu',
        target,
        exitsOf: (r) => EXITS[r] ?? [],
        isExitDiscovered: (r, e) => exits.has(`${r}:${e}`),
        isLocationDiscovered: (l) => locs.has(l),
        costOf: (entry) => (entry.type === 'regionMove' ? c.move
            : entry.type === 'customAction' ? c.explore : c.check),
        maxMana,
        ...rest,
    };
}

const kinds = (path) => path.map((e) => (e.type === 'regionMove' ? `move:${e.destinationRegion}`
    : e.type === 'customAction' ? `explore:${e.sourceRegion}` : `check:${e.locationName}`));

describe('loopDriver — routes and paths', () => {
    it('findRoute walks breadth-first and honours the filter', () => {
        expect(findRoute('Menu', 'Vault', (r) => EXITS[r]).map((h) => h.exit)).toEqual(['GameStart', 'Port', 'Stairs']);
        expect(findRoute('Menu', 'Vault', (r) => EXITS[r], (r, e) => e.name !== 'Port')).toBeNull();
        expect(findRoute('Menu', 'Menu', (r) => EXITS[r])).toEqual([]);
    });

    it('buildLoopPath writes gameState path entries with instance numbers', () => {
        const hops = findRoute('Menu', 'Castle', (r) => EXITS[r]);
        const path = buildLoopPath(hops, { kind: 'check', region: 'Castle', location: 'Hall' });
        expect(path).toEqual([
            { type: 'regionMove', sourceRegion: 'Menu', destinationRegion: 'Overworld', exitUsed: 'GameStart', instanceNumber: 1 },
            { type: 'regionMove', sourceRegion: 'Overworld', destinationRegion: 'Castle', exitUsed: 'Port', instanceNumber: 1 },
            { type: 'locationCheck', locationName: 'Hall', sourceRegion: 'Castle', instanceNumber: 1 },
        ]);
        expect(buildLoopPath([], { kind: 'explore', region: 'Menu' }))
            .toEqual([{ type: 'customAction', actionName: 'explore', params: {}, sourceRegion: 'Menu', instanceNumber: 1 }]);
        expect(pathCost(path, () => 7)).toBe(21);
    });
});

describe('loopDriver — the next task', () => {
    const target = { locationName: 'Hall', regionName: 'Castle' };

    it('explores the region whose next exit is still hidden (the frontier)', () => {
        const task = nextTask(makeView({ target, discoveredExits: ['Menu:GameStart'] }));
        expect(task.kind).toBe('explore');
        expect(task.region).toBe('Overworld');
        expect(task.hops.map((h) => h.to)).toEqual(['Overworld']);
    });

    it('explores the start region when even its first exit is hidden', () => {
        const task = nextTask(makeView({ target }));
        expect(task).toMatchObject({ kind: 'explore', region: 'Menu', hops: [] });
    });

    it('explores the target region until the target itself is discovered', () => {
        const task = nextTask(makeView({ target, discoveredExits: ['Menu:GameStart', 'Overworld:Port'] }));
        expect(task).toMatchObject({ kind: 'explore', region: 'Castle' });
    });

    it('checks once the route and the location are discovered', () => {
        const task = nextTask(makeView({ target, discoveredExits: ['Menu:GameStart', 'Overworld:Port'], discoveredLocations: ['Hall'] }));
        expect(task).toMatchObject({ kind: 'check', region: 'Castle', location: 'Hall' });
    });

    it('a target with no accessible route is unreachable', () => {
        const view = makeView({ target, exitsOf: (r) => (r === 'Overworld' ? [] : EXITS[r] ?? []) });
        expect(nextTask(view).kind).toBe('unreachable');
    });
});

describe('loopDriver — planNextLoop and the mana strategies', () => {
    const target = { locationName: 'Chest', regionName: 'Vault' };
    const allRoute = ['Menu:GameStart', 'Overworld:Port', 'Castle:Stairs'];

    it('no target → done', () => {
        expect(planNextLoop(makeView()).kind).toBe('done');
    });

    it('an affordable check loop is moves + the check', () => {
        const plan = planNextLoop(makeView({ target, discoveredExits: allRoute, discoveredLocations: ['Chest'] }));
        expect(plan.kind).toBe('check');
        expect(kinds(plan.path)).toEqual(['move:Overworld', 'move:Castle', 'move:Vault', 'check:Chest']);
        expect(plan.cost).toBe(60);
        expect(plan.affordable).toBe(true);
    });

    it('an affordable explore loop ends in an explore at the frontier', () => {
        const plan = planNextLoop(makeView({ target, discoveredExits: ['Menu:GameStart'] }));
        expect(kinds(plan.path)).toEqual(['move:Overworld', 'explore:Overworld']);
    });

    const pricey = { target, discoveredExits: allRoute, discoveredLocations: ['Chest'], costs: { move: 30, explore: 20, check: 50 } };
    // moves 90 + check 50 = 140 > 100. Moves to Castle (60) + explore (20) = 80 fit; to Vault (90) + 20 = 110 do not.

    it('explore-furthest: as far as the mana allows, then explore there', () => {
        const plan = planNextLoop(makeView({ ...pricey, strategy: MANA_STRATEGIES.EXPLORE_FURTHEST }));
        expect(kinds(plan.path)).toEqual(['move:Overworld', 'move:Castle', 'explore:Castle']);
        expect(plan.affordable).toBe(true);
        expect(plan.reason).toMatch(/costs 140 > 100/);
    });

    it('explore-furthest with not even one move affordable explores the start region', () => {
        const plan = planNextLoop(makeView({ ...pricey, costs: { move: 95, explore: 20, check: 50 } }));
        expect(kinds(plan.path)).toEqual(['explore:Menu']);
    });

    it('explore-target: explores the task region when the walk there fits', () => {
        const plan = planNextLoop(makeView({ ...pricey, costs: { move: 20, explore: 20, check: 50 }, strategy: MANA_STRATEGIES.EXPLORE_TARGET }));
        // moves 60 + check 50 = 110 > 100; moves 60 + explore 20 = 80 fit.
        expect(kinds(plan.path)).toEqual(['move:Overworld', 'move:Castle', 'move:Vault', 'explore:Vault']);
    });

    it('explore-target: farms the start region when the walk is out of reach', () => {
        const plan = planNextLoop(makeView({ ...pricey, strategy: MANA_STRATEGIES.EXPLORE_TARGET }));
        expect(kinds(plan.path)).toEqual(['explore:Menu']);
    });

    it('explore-furthest never farms XP where nothing is hidden: it attempts the task instead', () => {
        const plan = planNextLoop(makeView({ ...pricey, hasHidden: () => false }));
        expect(kinds(plan.path)).toEqual(['move:Overworld', 'move:Castle', 'move:Vault', 'check:Chest']);
        expect(plan.reason).toMatch(/nothing left to explore in Castle, attempting anyway/);
    });

    it('explore-target falls back to attempting when neither the task region nor the start hides anything', () => {
        const plan = planNextLoop(makeView({ ...pricey, strategy: MANA_STRATEGIES.EXPLORE_TARGET, hasHidden: () => false }));
        expect(kinds(plan.path)).toEqual(['move:Overworld', 'move:Castle', 'move:Vault', 'check:Chest']);
    });

    it('keep-attempting: queues the whole task anyway', () => {
        const plan = planNextLoop(makeView({ ...pricey, strategy: MANA_STRATEGIES.KEEP_ATTEMPTING }));
        expect(kinds(plan.path)).toEqual(['move:Overworld', 'move:Castle', 'move:Vault', 'check:Chest']);
        expect(plan.affordable).toBe(false);
        expect(plan.reason).toMatch(/attempting anyway/);
    });

    it('random: picks among the available tasks, avoiding the last one', () => {
        const tasks = [{ kind: 'explore', region: 'Overworld' }, { kind: 'check', region: 'Overworld', location: 'Gate' }];
        const view = makeView({
            target, discoveredExits: ['Menu:GameStart'], strategy: MANA_STRATEGIES.RANDOM,
            availableTasks: () => tasks, random: () => 0,
        });
        expect(planNextLoop(view)).toMatchObject({ kind: 'explore', key: 'explore:Overworld' });
        expect(planNextLoop({ ...view, lastTaskKey: 'explore:Overworld' })).toMatchObject({ kind: 'check', location: 'Gate' });
        expect(kinds(planNextLoop({ ...view, lastTaskKey: 'explore:Overworld' }).path)).toEqual(['move:Overworld', 'check:Gate']);
    });

    it('random: with one task, repeats it', () => {
        const view = makeView({
            target, strategy: MANA_STRATEGIES.RANDOM, availableTasks: () => [{ kind: 'explore', region: 'Menu' }],
            lastTaskKey: 'explore:Menu',
        });
        expect(planNextLoop(view)).toMatchObject({ kind: 'explore', region: 'Menu' });
    });
});

describe('loopDriver — availableTasks', () => {
    it('offers explores where something is hidden and checks of discovered, checkable locations, over discovered exits', () => {
        const tasks = availableTasks({
            startRegion: 'Menu',
            exitsOf: (r) => EXITS[r] ?? [],
            isExitDiscovered: (r, e) => ['Menu:GameStart', 'Overworld:Side'].includes(`${r}:${e}`),
            locationsOf: (r) => LOCATIONS[r] ?? [],
            isLocationDiscovered: (l) => ['Gate', 'Grass', 'Hall'].includes(l),
            isLocationCheckable: (l) => l !== 'Grass',
            hasHidden: (r) => r === 'Overworld',
        });
        expect(tasks).toEqual([
            { kind: 'explore', region: 'Overworld' },
            { kind: 'check', region: 'Overworld', location: 'Gate' },
        ]);
    });
});

describe('loopDriver — move-only regions (⚖ the substrate\'s own automation takes the check)', () => {
    const target = { locationName: 'Hall', regionName: 'Castle' };
    const known = ['Menu:GameStart', 'Overworld:Port', 'Castle:Stairs'];

    it('a target in a region whose queue takes no check is a PASS: move in, and out through an exit', () => {
        const plan = planNextLoop(makeView({ target, discoveredExits: known, discoveredLocations: ['Hall'], canCheck: (r) => r !== 'Castle' }));
        expect(plan.kind).toBe('pass');
        expect(kinds(plan.path)).toEqual(['move:Overworld', 'move:Castle', 'move:Vault']);
        expect(plan.reason).toMatch(/pass through Castle via "Stairs"/);
        expect(plan.key).toBe('pass:Hall');
    });

    it('a move-only region with no exit cannot be passed: unreachable, named', () => {
        const view = makeView({
            target: { locationName: 'Chest', regionName: 'Vault' }, discoveredExits: known, discoveredLocations: ['Chest'],
            canCheck: (r) => r !== 'Vault',
        });
        const plan = planNextLoop(view);
        expect(plan.kind).toBe('unreachable');
        expect(plan.reason).toMatch(/Vault takes no check and has no exit/);
    });
});
