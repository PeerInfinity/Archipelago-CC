/**
 * `probe-seedling-wallflyer-nohit.mjs` — the witness's hands, pinned in node.
 *
 * The probe plays its plans on the wasm game; the played legs are its own run. What node can pin is what the run is
 * built from: the doors come from the map's own links, a staging holds exactly its arm, the key spans round-trip, every
 * kept plan lands in its room on the model with no hit, and the reader that grades a run tells a clean crossing from
 * each way of failing.
 */
import { describe, expect, it } from 'vitest';
import {
    ARMS, MODEL_REFUSES, PRESS_ARMS, caseName, caseStaging, doorsOf, isNoHitCrossing, parseCase, perTickOf, readMap,
    readPlans, readRun, replayOnModel, spansOf, wallFlyerLevels,
    CHEST_CASES, chestOf, chestCaseKeys, readChestRun,
} from './probe-seedling-wallflyer-nohit.mjs';

const MAP = readMap();
const PLANS = readPlans();
const heldOf = (staging) => Object.entries(staging.seam.items).filter(([, v]) => v === true).map(([k]) => k).sort();

describe('probe-seedling-wallflyer-nohit: the cases', () => {
    it('a case name round-trips, and an unknown arm or shape is refused by name', () => {
        const c = { level: 22, from: 25, to: 29, arm: 'sword' };
        expect(parseCase(caseName(c))).toEqual(c);
        expect(() => parseCase('l22-25-29-hammer')).toThrow(/no case l22-25-29-hammer/);
        expect(() => parseCase('22-25-29-sword')).toThrow(/no case/);
    });

    it('every wallflyer room\'s doors come from its links, each with the landing its far room\'s link back names', () => {
        const rooms = wallFlyerLevels(MAP);
        expect(rooms.length).toBeGreaterThan(0);
        for (const n of rooms) {
            const doors = doorsOf(MAP, n);
            expect(doors.length, `L${n}`).toBeGreaterThan(1);
            for (const d of doors) {
                const back = MAP.levels.find((l) => l.level === d.to).entities.find((e) => Number(e.attrs?.to) === n);
                expect(d.landing, `L${n} -> L${d.to}`).toEqual({ x: Number(back.attrs.playerx), y: Number(back.attrs.playery) });
            }
        }
        expect(() => doorsOf(MAP, -5)).toThrow(/no level -5/);
    });

    it('every kept plan and every NOT FOUND row names a wallflyer room, two of its doors and an arm the model plays', () => {
        const rooms = wallFlyerLevels(MAP);
        const names = [...Object.keys(PLANS.plans), ...Object.keys(PLANS.notFound)];
        expect(names.length).toBeGreaterThan(0);
        expect(new Set(names).size).toBe(names.length);
        for (const name of names) {
            const c = parseCase(name);
            expect(rooms, name).toContain(c.level);
            const to = doorsOf(MAP, c.level).map((d) => d.to);
            expect(to, name).toContain(c.from);
            expect(to, name).toContain(c.to);
            expect(c.from, name).not.toBe(c.to);
            expect(Object.keys(MODEL_REFUSES), name).not.toContain(c.arm);
        }
        for (const arm of [...PRESS_ARMS, ...Object.keys(MODEL_REFUSES)]) expect(Object.keys(ARMS)).toContain(arm);
    });

    it('a NOT FOUND row carries the search it stands on, and never claims the search ran dry', () => {
        for (const [name, row] of Object.entries(PLANS.notFound)) {
            expect(row.nodes, name).toBeGreaterThan(0);
            expect(row.exhausted, name).toBe(false);
        }
    });
});

describe('probe-seedling-wallflyer-nohit: the staging and the keys', () => {
    it('a staging boots on the landing holding exactly its arm, with no flag, key or switch of its own', async () => {
        for (const arm of Object.keys(ARMS)) {
            const s = await caseStaging(MAP, { level: 22, from: 25, to: 29, arm });
            expect(s.boot, arm).toEqual({ level: 22, ...doorsOf(MAP, 22).find((d) => d.to === 25).landing });
            expect(heldOf(s), arm).toEqual([...ARMS[arm]].sort());
            expect(s.save, arm).toEqual({ totem_parts: [], keys: [], seal_parts: [] });
            expect(s.persistence.filter((r) => r.level === 22), arm).toEqual([]);
            expect(s.noclip || s.noDamage, arm).toBe(false);
        }
        await expect(caseStaging(MAP, { level: 22, from: 99, to: 29, arm: 'none' })).rejects.toThrow(/L22 has no door to L99/);
    });

    it('key spans and per-tick keys are inverses', () => {
        const perTick = [[], ['up'], ['primary', 'up'], ['up'], [], ['left', 'up'], ['left']];
        const spans = spansOf(perTick);
        expect(spans).toEqual([{ key: 'up', from: 1, to: 4 }, { key: 'primary', from: 2, to: 3 }, { key: 'left', from: 5, to: 7 }, { key: 'up', from: 5, to: 6 }]);
        expect(perTickOf(spans, perTick.length)).toEqual(perTick);
    });
});

describe('probe-seedling-wallflyer-nohit: the kept plans, on the model', () => {
    it('every kept plan lands in its room with no hit; the same keys with no item do not, where the arm is what clears the line', async () => {
        for (const [name, p] of Object.entries(PLANS.plans)) {
            const c = parseCase(name);
            const perTick = perTickOf(p.inputs, p.ticks);
            expect(await replayOnModel(MAP, c, perTick), name).toEqual({ level: c.to, hits: [] });
            if (c.arm === 'none' || `${caseName({ ...c, arm: 'none' })}` in PLANS.plans) continue;
            const bare = await replayOnModel(MAP, { ...c, arm: 'none' }, perTick);
            expect(bare.level === c.to && bare.hits.length === 0, `${name} without its item`).toBe(false);
        }
    });
});

describe('probe-seedling-wallflyer-nohit: the reader', () => {
    const c = { level: 22, from: 25, to: 29, arm: 'none' };
    const walk = [{ t: 0, level: 22, x: 16, y: 128 }, { t: 1, level: 22, x: 40, y: 120 }, { t: 2, level: 29, x: 24, y: 232 }];

    it('a crossing is clean only when it ends in the target room with no hit and no respawn', () => {
        expect(isNoHitCrossing(c, readRun(walk))).toBe(true);
        expect(isNoHitCrossing(c, readRun(walk, { maxHits: 1 }))).toBe(false);
        expect(isNoHitCrossing(c, readRun(walk.slice(0, 2)))).toBe(false);
        expect(isNoHitCrossing({ ...c, to: 21 }, readRun(walk))).toBe(false);
    });

    it('a player put back on its boot point after leaving it is a respawn', () => {
        const died = [walk[0], walk[1], { t: 2, level: 22, x: 16, y: 128 }, walk[2]];
        expect(readRun(died).respawns).toBe(1);
        expect(isNoHitCrossing(c, readRun(died))).toBe(false);
        expect(readRun([])).toEqual({ levels: [], maxHits: 0, respawns: 0, final: null });
    });
});

/** A chest case's keys replayed on the model, as `{level, x, y}` observations of the player's centre. */
async function replayCentres(c, perTick) {
    const { createRunForStaging } = await import('../../frontend/modules/seedlingDemo/tapeRunner.js');
    const { atlasLevelSource } = await import('../../frontend/modules/seedlingDemo/levelSource.js');
    const staging = await caseStaging(MAP, { level: c.level, from: c.from, arm: 'none' });
    const run = createRunForStaging(JSON.parse(JSON.stringify(staging)), atlasLevelSource(), { scratchPersistence: true });
    const out = [{ level: run.level, x: run.state.x, y: run.state.y }];
    for (const keys of perTick) { run.advance(new Set(keys)); out.push({ level: run.level, x: run.state.x, y: run.state.y }); }
    return out;
}

describe('probe-seedling-wallflyer-nohit --chest: L25\'s chest, on the model', () => {
    const TILE = MAP.tile_size;
    it('each case walks from a real door of the chest\'s room, and the room holds one chest in the mouth of a door\'s corridor', () => {
        expect(new Set(CHEST_CASES.map((c) => c.expect))).toEqual(new Set(['shut', 'open']));
        for (const c of CHEST_CASES) {
            const doors = doorsOf(MAP, c.level);
            expect(doors.some((d) => d.to === c.from), c.name).toBe(true);
            const chest = chestOf(MAP, c.level);
            // `Chest.as:63`: the opening line is under the chest's bottom edge. The `open` case lands on it; no `shut` case does.
            const landing = doors.find((d) => d.to === c.from).landing;
            const under = landing.x === chest.x && landing.y === chest.bottom;
            expect(under, c.name).toBe(c.expect === 'open');
        }
        expect(() => chestOf(MAP, 22)).toThrow(/holds 0 chests, not one/);
    });

    it('the model agrees with what the game showed: shut from L22\'s door (east face and above), open from under it', async () => {
        for (const c of CHEST_CASES) {
            const chest = chestOf(MAP, c.level);
            const { perTick, model } = await chestCaseKeys(MAP, c);
            expect(model.level, c.name).toBe(c.level);
            // Re-read the keys as observations of the player's centre.
            const run = await replayCentres(c, perTick);
            const read = readChestRun(run, chest);
            if (c.expect === 'shut') expect([read.inChest, read.under], c.name).toEqual([0, 0]);
            else { expect(read.under, c.name).toBeGreaterThan(0); expect(read.inChest, c.name).toBeGreaterThan(0); }
        }
    });

    it('the reader counts the observations in the chest\'s cell and in the cell under it', () => {
        const chest = { x: 96, y: 96, right: 112, bottom: 112 };
        const obs = [{ level: 25, x: 120, y: 104 }, { level: 25, x: 104, y: 104 }, { level: 25, x: 104, y: 120 }, { level: 25, x: 104, y: 112 }, { level: 25, x: 112, y: 120 }];
        expect(readChestRun(obs, chest)).toEqual({ inChest: 1, under: 2, levels: [25], final: obs.at(-1) });
        expect(readChestRun(obs, chest, (o) => ({ x: o.x + TILE, y: o.y }))).toMatchObject({ inChest: 0, under: 0 });
    });
});

