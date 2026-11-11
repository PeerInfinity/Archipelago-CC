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
