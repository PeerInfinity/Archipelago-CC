/**
 * ⛓ RETURN TO MENU — the region graph's ONE-STEP move (`attemptMovePlayerOneStepToRegion`) plans the player's
 * movement from where they stand, so it gets the Restart move (procgenCore/restartRoute.js): with the flag and no
 * walk, the step is the Menu panel's Restart; with a walk, or without the flag, it is what it was.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let rawJson = null;
vi.mock('../stateManager/index.js', () => ({
    stateManagerProxySingleton: {},
    getLastRawJsonData: () => rawJson,
}));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => ({ getCurrentRegion: () => 'Pit' }) }));
vi.mock('../discovery/singleton.js', () => ({ default: {} }));
const restart = vi.fn(() => ({ mode: 'world', target: 'Menu' }));
vi.mock('../../app/core/centralRegistry.js', () => ({
    centralRegistry: { getPublicFunction: (mod, fn) => (mod === 'menuPanel' && fn === 'restart' ? restart : null) },
}));

const { NavigationManager } = await import('./navigationManager.js');

const ADJ = { Menu: [['GameStart', 'Start']], Start: [['toB', 'B'], ['drop', 'Pit']], Pit: [], C: [['cToB', 'B']] };
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
const pathFinder = {
    findPathWithExits: (a, b) => { const p = bfs(a, b); return p ? { steps: p, length: p.length - 1 } : null; },
    findPath: (a, b) => {
        const p = bfs(a, b);
        return p ? { steps: p.map((s) => s.region), nextExit: p[1]?.exitUsed ?? null, length: p.length - 1 } : null;
    },
};
const statuses = [];
const nav = new NavigationManager({ pathFinder, updateStatus: (t) => statuses.push(t), cy: null });
const docWith = (flag) => ({ rawJsonData: { start_regions: { 1: ['Menu'] }, exporter: { 1: flag ? { return_to_menu: true } : {} } } });

beforeEach(() => { restart.mockClear(); statuses.length = 0; });

describe('regionGraph one-step move — the RESTART step', () => {
    it('flag ON, no walk from the pit: the step is the Menu panel\'s Restart', () => {
        rawJson = docWith(true);
        nav.attemptMovePlayerOneStepToRegion('B');
        expect(restart).toHaveBeenCalledTimes(1);
        expect(statuses).toEqual(['Restart → Menu (no walk from Pit to B)']);
    });

    it('flag OFF: no Restart; today\'s "No path" status', () => {
        rawJson = docWith(false);
        nav.attemptMovePlayerOneStepToRegion('B');
        expect(restart).not.toHaveBeenCalled();
        expect(statuses[0]).toBe('No path to B');
    });

    it('a walk exists: no Restart (walk preferred)', () => {
        rawJson = docWith(true);
        expect(nav.takeRestartStepToward('C', 'B', { restart })).toBe(false);
        expect(restart).not.toHaveBeenCalled();
    });
});
