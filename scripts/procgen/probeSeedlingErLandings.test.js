/**
 * `probe-seedling-er-landings.mjs` — the witness's hands, pinned in node.
 *
 * The probe plays three shuffled-world landings on the wasm game; the played legs are its own run. What node can
 * pin is everything the run is built from: the staging holds exactly what each case names, the hand plans stand on
 * the committed atlas, the model that chooses their keys ends where the game is expected to, and the reader that
 * grades a run tells a pass from each way of failing.
 */
import { describe, expect, it } from 'vitest';
import {
    C1_SUBGOALS, CASES, L12, LANDS, POST_SWORD_BASE, PRE_SWORD_BASE, WAYPOINTS,
    expectLanding, followWaypoints, keysToward, landingStaging, readRun, spansOf,
} from './probe-seedling-er-landings.mjs';
import { atlasLevelSource } from '../../frontend/modules/seedlingDemo/levelSource.js';

const heldOf = (staging) => Object.entries(staging.seam.items).filter(([, v]) => v === true).map(([k]) => k).sort();
const entityAt = (level, type, x, y) => atlasLevelSource()(level).entities
    .find((e) => e.type === type && e.x === x && e.y === y);

describe('probe-seedling-er-landings: the staging', () => {
    it('every case boots at its landing holding exactly its items and keys, with no flag of its own room', async () => {
        for (const [name, c] of Object.entries(CASES)) {
            const staging = await landingStaging(c);
            expect(staging.boot, name).toEqual(c.boot);
            const latched = c.base === POST_SWORD_BASE ? ['hasSword'] : [];
            expect(heldOf(staging), name).toEqual([...c.items, ...latched].sort());
            expect(staging.save, name).toEqual({ totem_parts: [], keys: c.keys, seal_parts: [] });
            expect(staging.persistence.filter((r) => r.level === c.boot.level), name).toEqual([]);
            expect(staging.noclip || staging.noDamage, name).toBe(false);
        }
    });

    it('the swordless case stands on the campaign\'s item-less state, and no case holds the Shield', async () => {
        expect(CASES['c2-l22-swordless'].base).toBe(PRE_SWORD_BASE);
        for (const c of Object.values(CASES)) expect(heldOf(await landingStaging(c))).not.toContain('hasShield');
    });
});

describe('probe-seedling-er-landings: the plans stand on the atlas', () => {
    it('c1\'s sub-goals name the Red Key lock, the burnable tree and the chest by their own tags', () => {
        const [lock, tree, chest] = C1_SUBGOALS;
        expect(entityAt(12, 'bosslock', lock.at.x, lock.at.y)?.attrs).toMatchObject({ keyType: '0', tag: String(L12.redLock) });
        expect(entityAt(12, 'burnabletree', tree.at.x, tree.at.y)?.attrs).toMatchObject({ tag: String(L12.tree) });
        expect(entityAt(12, 'chest', chest.placement.x, chest.placement.y)?.attrs).toMatchObject({ tag: String(L12.chest) });
        expect(atlasLevelSource()(12).entities.find((e) => e.type === 'shieldlocknorm')?.attrs)
            .toMatchObject({ tag: String(L12.shieldLock) });
    });

    it('c2 and c3 aim at a door and a pit that lead where the case says', () => {
        const c2 = CASES['c2-l22-swordless'];
        expect(entityAt(22, 'teleporter', c2.goal.exit.x, c2.goal.exit.y)?.attrs.to).toBe(String(LANDS['c2-l22-swordless']));
        const c3 = CASES['c3-l40-pit'];
        const fall = atlasLevelSource()(40).entities.find((e) => e.type === 'control' && e.attrs?.fallthrough !== undefined);
        expect(fall.attrs.fallthrough).toBe(String(LANDS['c3-l40-pit']));
        expect([c3.goal.pit.tx * 16, c3.goal.pit.ty * 16]).toEqual([c3.goal.pit.x, c3.goal.pit.y]);
    });
});

describe('probe-seedling-er-landings: the hands', () => {
    it('keysToward holds the keys toward the point and none inside the tolerance', () => {
        expect(keysToward(10, 10, 20, 10)).toEqual(['right']);
        expect(keysToward(10, 10, 0, 30)).toEqual(['left', 'down']);
        expect(keysToward(10, 10, 10.5, 9.5)).toEqual([]);
        expect(keysToward(10, 10, 10.5, 9.5, 0.4)).toEqual(['right', 'up']);
    });

    it('spansOf turns per-tick keys into the tape\'s half-open spans', () => {
        expect(spansOf([[], ['up'], ['up', 'left'], ['left'], []])).toEqual([
            { key: 'up', from: 1, to: 3 }, { key: 'left', from: 2, to: 4 }]);
        expect(spansOf([['primary'], [], ['primary']])).toEqual([
            { key: 'primary', from: 0, to: 1 }, { key: 'primary', from: 2, to: 3 }]);
    });

    it('the model that picks the keys ends each hand plan in the room the case names, alive', async () => {
        for (const name of Object.keys(WAYPOINTS)) {
            const { perTick, model } = await followWaypoints(await landingStaging(CASES[name]), WAYPOINTS[name]);
            expect(model.level, name).toBe(LANDS[name]);
            // Three hits kill (`hits_max` on the seam); a plan the model dies on would restart at the door.
            expect(model.hits.length, name).toBeLessThan(3);
            expect(spansOf(perTick).every((s) => s.to > s.from), name).toBe(true);
        }
    }, 120000);

    it('the swordless plan never presses the Sword', async () => {
        const name = 'c2-l22-swordless';
        const { perTick } = await followWaypoints(await landingStaging(CASES[name]), WAYPOINTS[name]);
        expect(perTick.some((keys) => keys.includes('primary'))).toBe(false);
    }, 120000);
});

describe('probe-seedling-er-landings: the reader', () => {
    const walk = (level, to) => [{ t: 0, x: 24, y: 136, level }, { t: 1, x: 30, y: 136, level }, { t: 2, x: 24, y: 232, level: to }];

    it('a landing passes when the run ends in the named room and never restarts', () => {
        const r = readRun(walk(22, 29), [], [], { maxHits: 1 });
        expect(r).toMatchObject({ levels: [22, 29], respawns: 0, maxHits: 1 });
        expect(expectLanding('c2-l22-swordless', r)).toBe(true);
        expect(expectLanding('c3-l40-pit', r)).toBe(false);
    });

    it('a run that is put back on its boot tile is a restart, and fails', () => {
        const ticks = [{ t: 0, x: 24, y: 136, level: 22 }, { t: 1, x: 60, y: 130, level: 22 },
            { t: 2, x: 24, y: 136, level: 22 }, { t: 3, x: 24, y: 232, level: 29 }];
        const r = readRun(ticks);
        expect(r.respawns).toBe(1);
        expect(expectLanding('c2-l22-swordless', r)).toBe(false);
    });

    it('c1 passes only with the lock, the tree, the chest and a seal written, and the Shield lock untouched', () => {
        const stay = [{ t: 0, x: 24, y: 88, level: 12 }, { t: 1, x: 328, y: 834, level: 12 }];
        const tags = [L12.tree, L12.redLock, L12.chest].map((t) => `12:${t}`);
        expect(readRun(stay, ['0:1'], ['0:1', ...tags]).wrote).toEqual([...tags].sort());
        expect(expectLanding('c1-l12-chest', readRun(stay, [], tags, { seals: 1 }))).toBe(true);
        expect(expectLanding('c1-l12-chest', readRun(stay, [], tags, { seals: 0 }))).toBe(false);
        expect(expectLanding('c1-l12-chest', readRun(stay, [], tags.slice(0, 2), { seals: 1 }))).toBe(false);
        expect(expectLanding('c1-l12-chest', readRun(stay, [], [...tags, `12:${L12.shieldLock}`], { seals: 1 }))).toBe(false);
    });
});
