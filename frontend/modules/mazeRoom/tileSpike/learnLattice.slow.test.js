/**
 * SLOW TIER of the learning walk and the compact reach cache (session tile-l12-one-world; measured by tile-l12-level-world):
 *   - learning walk ≡ rank walk, byte for byte (minimal sets, witness plans + cells, `unreachable`), on L40 laid (the pass + its 5
 *     entries, one shared cache), a rope world and a block world — the committed preset's;
 *   - the compact cache through the derive: L40 laid, compact on ≡ off, with lazy re-searches really taken;
 *   - L12 as ONE level world (compiled with L83, so its teleporter exit is wired): compact ≡ full at sampled points of every arrival.
 * The gadget rows, the mutants and the census are the default tier's (`learnLattice.test.js`, `compactReach.test.js`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { deriveLevelWorldLogic, deriveEntryLogic, COMPACT_REACH, walkFor } from './deriveLevelWorldLogic.js';
import { latticeAxis, regionItems, regionLevels, cutEvents } from './deriveTileLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES } from './deriveLevelWorldLogic.fixture.js';
import { check } from './compactReach.fixture.js';
import { buildPlaythroughMaze } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';

afterEach(() => { COMPACT_REACH.on = true; });

const strip = (r) => JSON.parse(JSON.stringify({ pairs: r.pairs, targets: r.targets }));
const payload = (name) => deserializeMazeWorld(RULES.preset_sidecars['1'][name].playable_payload);
const named = (pred) => Object.entries(RULES.preset_sidecars['1']).find(([, sc]) => sc.playable_payload && pred(deserializeMazeWorld(sc.playable_payload)));
const L40 = payload('level_40__r0c53');
const passAndEntries = (w, opts) => {
    const cache = new Map();
    const pass = deriveLevelWorldLogic(w, HELPERS, { native: true, cache, ...opts });
    const entries = w.sharedWorld.regions.map((r) => strip(deriveEntryLogic(w, r, HELPERS, { native: true, cache, ...opts })));
    return { pairs: pass.pairs, targets: entries };
};

describe('learning walk ≡ rank walk on committed worlds', () => {
    it('L40 laid: the pass + the 5 entries (native, shared cache)', () => {
        expect(walkFor(latticeAxis(regionItems(L40), regionLevels(L40)))).toBe('rank');
        expect(passAndEntries(L40, { walk: 'learn' })).toEqual(passAndEntries(L40, { walk: 'rank' }));
    }, 300_000);
    it('a rope world and a block world (entries, native)', () => {
        const [ropeName] = named((w) => cutEvents(w).length > 0);
        const [blockName] = named((w) => w.blocks?.size > 0 && regionItems(w).length > 0);
        for (const name of [ropeName, blockName]) {
            const w = payload(name);
            const run = (walk) => strip(deriveEntryLogic(w, name, HELPERS, { native: true, cache: new Map(), walk }));
            expect(run('learn'), name).toEqual(run('rank'));
        }
    }, 300_000);
});

describe('the compact cache through the derive', () => {
    it('L40 laid: deriveLevelWorldLogic + the 5 entries, compact on ≡ off (memoised probes become witnesses)', () => {
        const before = COMPACT_REACH.replans;
        const on = passAndEntries(L40, {});
        const replans = COMPACT_REACH.replans - before;
        COMPACT_REACH.on = false;
        const off = passAndEntries(L40, {});
        expect(on).toEqual(off);
        expect(replans).toBeGreaterThan(0);
    }, 300_000);
    it('L12 as ONE level world: compact ≡ full at sampled points of every arrival (lazy plans byte-equal)', () => {
        const doc = JSON.parse(buildPlaythroughMaze({ levels: ['level_12', 'level_83'], embedSphereLog: false }).text);
        const L12 = deserializeMazeWorld(doc.preset_sidecars['1'].level_12__r0c19.playable_payload);
        expect(L12.sharedWorld.regions).toHaveLength(6);
        expect(walkFor(latticeAxis(regionItems(L12), regionLevels(L12)))).toBe('learn');
        expect(check(L12, 12)).toBeGreaterThan(0);
    }, 300_000);
});
