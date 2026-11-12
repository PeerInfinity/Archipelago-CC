/**
 * `seedlingNoHitDirectionalGates` — the per-room table of directional no-hit gates (⚖ the user, 2026-11-11: "Add the
 * directional gates for now, but make a note to reexamine this later."), its reader's refusals, and what the committed
 * rules carry for it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { noHitDirectionalGatesFor, stampNoHitDirectionalGates, gateCondition, WITNESS_ARM_OF_FLAG } from './seedlingNoHitDirectionalGates.js';
import { wallFlyerBands } from './seedlingWallFlyerBands.js';
import { buildLevelWorld } from '../seedlingDemo/levelWorld.js';

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const MAP = read('./atlases/seedling-map.json');
const TABLE = read('./seedlingNoHitDirectionalGates.json');
const PLANS = read('../../../scripts/procgen/seedling-wallflyer-nohit-plans.json');
const RULES = read('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
const TILE = MAP.tile_size;

const levelOf = (n) => MAP.levels.find((l) => l.level === n);
const tileOf = (x, y) => [Math.floor(Number(x) / TILE), Math.floor(Number(y) / TILE)];
const doorOf = (levelNo, to) => {
    const door = (levelOf(levelNo)?.entities ?? []).find((e) => Number(e.attrs?.to) === to && e.attrs.playerx !== undefined);
    const back = (levelOf(to)?.entities ?? []).find((e) => Number(e.attrs?.to) === levelNo && e.attrs.playerx !== undefined);
    return door && back ? { door: tileOf(door.x, door.y), landing: tileOf(back.attrs.playerx, back.attrs.playery) } : null;
};
const gatesOf = (levelNo, { table = TABLE, plans = PLANS } = {}) => {
    const level = levelOf(levelNo);
    return noHitDirectionalGatesFor(table, plans, level, wallFlyerBands(level, buildLevelWorld(level)), doorOf);
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const caseOf = (id) => {
    const [, level, from, to, arm] = /^l(\d+)-(\d+)-(\d+)-([a-z]+)$/.exec(id);
    return { level: Number(level), from: Number(from), to: Number(to), arm };
};

describe('the table of directional no-hit gates', () => {
    it('says it is a per-room table for now, to be re-examined, in the table and in its reader', () => {
        expect(TABLE.$comment).toMatch(/Add the directional gates for now, but make a note to reexamine this later/);
        expect(TABLE.reexamine).toMatch(/RE-EXAMINED/);
        expect(TABLE.reexamine).toMatch(/waiting spot off the ray at the far end of every flight/);
        const reader = readFileSync(new URL('./seedlingNoHitDirectionalGates.js', import.meta.url), 'utf8');
        expect(reader).toMatch(/Add the directional gates for now, but make a note to reexamine this later/);
        expect(reader).toMatch(/waiting spot off the ray at\s+\* the far end of every flight/);
    });

    it('every gate is accepted against its room, its bands and the witness plans, and types no tile', () => {
        expect(TABLE.gates.length).toBeGreaterThan(0);
        for (const gate of TABLE.gates) {
            expect(Object.keys(gate).sort(), `L${gate.level}`).toEqual(['arms', 'band', 'blocked', 'level', 'says', 'witness']);
            const [read1, ...rest] = gatesOf(gate.level).filter((g) => g.gate === gate);
            expect(rest, `L${gate.level}`).toEqual([]);
            expect(read1.condition).toEqual({ any: gate.arms.map((f) => ({ flag: f })) });
            // The tiles are the named flyers' bands, whole.
            const level = levelOf(gate.level);
            const bands = wallFlyerBands(level, buildLevelWorld(level)).filter((b) => gate.band.includes(b.id));
            expect(bands.map((b) => b.id).sort()).toEqual([...gate.band].sort());
            expect(new Set(read1.tiles.map(String))).toEqual(new Set(bands.flatMap((b) => b.tiles).map(String)));
        }
    });

    it('holds exactly the directions the game witnessed: every no-item NOT FOUND crossing is one gate\'s, and no gate stands without one', () => {
        const notFoundNone = Object.keys(PLANS.notFound).filter((id) => caseOf(id).arm === 'none').sort();
        expect(TABLE.gates.flatMap((g) => g.witness.notFound).sort()).toEqual(notFoundNone);
        // A room whose every no-item crossing was walked (the plans hold no NOT FOUND for it) has no gate.
        const gatedLevels = new Set(TABLE.gates.map((g) => g.level));
        const walkedOnly = [...new Set(Object.keys(PLANS.plans).map((id) => caseOf(id).level))]
            .filter((n) => !notFoundNone.some((id) => caseOf(id).level === n));
        expect(walkedOnly.length).toBeGreaterThan(0);
        for (const n of walkedOnly) expect(gatedLevels.has(n), `L${n}`).toBe(false);
        // Each gate offers exactly the arms that have a witnessed plan across it, of the arms this table knows.
        for (const gate of TABLE.gates) {
            const sample = caseOf(gate.witness.notFound[0]);
            const witnessed = Object.entries(WITNESS_ARM_OF_FLAG).filter(([, arm]) => Object.keys(PLANS.plans)
                .some((id) => { const c = caseOf(id); return c.level === gate.level && c.arm === arm && c.from === sample.from; })).map(([f]) => f);
            expect([...gate.arms].sort(), `L${gate.level}`).toEqual(witnessed.sort());
        }
    });

    it('a gate whose witness plan is missing from the plans file is refused by name (each witness, each list)', () => {
        for (const gate of TABLE.gates) {
            const ids = [
                ...gate.witness.notFound.map((id) => ['notFound', id]),
                ...Object.values(gate.witness.arms).map((id) => ['plans', id]),
                ...gate.witness.free.map((id) => ['plans', id]),
            ];
            expect(ids.length).toBeGreaterThan(gate.arms.length);
            for (const [list, id] of ids) {
                const plans = clone(PLANS);
                delete plans[list][id];
                expect(() => gatesOf(gate.level, { plans }), id).toThrow(new RegExp(`L${gate.level} .*witness ${id} is not under "${list}"`));
            }
        }
    });

    it('refuses a gate that does not say what its witnesses show', () => {
        const edit = (levelNo, fn) => {
            const table = clone(TABLE);
            fn(table.gates.find((g) => g.level === levelNo));
            return () => gatesOf(levelNo, { table });
        };
        const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
        const TURNED = { N: 'E', S: 'E', E: 'N', W: 'N' };
        for (const gate of TABLE.gates) {
            const n = gate.level;
            expect(edit(n, (g) => { g.blocked = OPPOSITE[g.blocked]; }), `L${n} reversed`).toThrow(/does not cross the band in the blocked direction/);
            expect(edit(n, (g) => { g.blocked = TURNED[g.blocked]; }), `L${n} turned`).toThrow(/which "[NESW]" does not cross/);
            expect(edit(n, (g) => { g.blocked = 'up'; })).toThrow(/"blocked" is not one of N, E, S, W/);
            expect(edit(n, (g) => { g.band.push('wallflyer@0,0'); })).toThrow(/holds no wallflyer@0,0/);
            expect(edit(n, (g) => { g.band = []; })).toThrow(/names no flyer/);
            expect(edit(n, (g) => { g.arms.push('hasWand'); })).toThrow(/arm hasWand has no witness arm/);
            expect(edit(n, (g) => { delete g.witness.arms[g.arms[0]]; })).toThrow(/has no witness plan/);
            expect(edit(n, (g) => { g.witness.arms.hasFire = g.witness.arms[g.arms[0]]; })).toThrow(/witness for hasFire, which the gate does not offer/);
            expect(edit(n, (g) => { g.witness.notFound = []; })).toThrow(/no NOT FOUND witness/);
            // An arm witnessed by another arm's plan, a control witnessed by an item plan, a free walk cited as blocked.
            expect(edit(n, (g) => { g.witness.arms[g.arms[0]] = g.witness.arms[g.arms[1]]; })).toThrow(/holds "[a-z]+", not "[a-z]+"/);
            expect(edit(n, (g) => { g.witness.free.push(g.witness.arms[g.arms[0]]); })).toThrow(/holds "[a-z]+", not "none"/);
            expect(edit(n, (g) => { g.witness.arms[g.arms[0]] = g.witness.free[0]; })).toThrow(/holds "none", not/);
        }
        // A witness of another room.
        const [a, b] = TABLE.gates;
        expect(edit(a.level, (g) => { g.witness.free.push(b.witness.free[0]); })).toThrow(new RegExp(`is not a case of level ${a.level}`));
    });
});

describe('stampNoHitDirectionalGates', () => {
    const open = () => ({ kind: 'open', conditions: [], faces: {}, dirs: {}, manual: [], labels: [] });
    const grid = () => ({ width: 3, height: 3, cells: Array.from({ length: 9 }, (_, i) => (i === 3 ? { ...open(), kind: 'wall' } : open())) });
    const gate = { level: 1, arms: ['hasSword', 'hasShield'] };
    const gates = [{ gate, condition: gateCondition(gate), blocked: 'N', tiles: [[0, 1], [1, 1], [2, 1]] }];

    it('charges each band tile that is floor the blocked way only, and leaves walls and every other cell alone', () => {
        const before = grid();
        const g = stampNoHitDirectionalGates(before, gates);
        expect(g.cells[3]).toEqual(before.cells[3]);
        for (const i of [4, 5]) {
            expect(g.cells[i].kind).toBe('directional');
            expect(g.cells[i].dirs).toEqual({ N: [{ any: [{ flag: 'hasSword' }, { flag: 'hasShield' }] }] });
            expect(g.cells[i].conditions).toEqual([]);
        }
        for (const i of [0, 1, 2, 6, 7, 8]) expect(g.cells[i]).toEqual(before.cells[i]);
        expect(before.cells[4].kind).toBe('open');
        expect(stampNoHitDirectionalGates(before, [])).toBe(before);
    });

    it('refuses a band tile that is a door, or that is not open floor', () => {
        expect(() => stampNoHitDirectionalGates(grid(), gates, new Set(['2,1']))).toThrow(/the band tile \[2,1\] is a door/);
        const g = grid();
        g.cells[4] = { ...open(), kind: 'gated', conditions: [{ flag: 'canSwim' }] };
        expect(() => stampNoHitDirectionalGates(g, gates)).toThrow(/the band tile \[1,1\] is gated, not open floor/);
    });
});

describe('the committed rules carry the gates and nothing else in those rooms', () => {
    const REGIONS = RULES.regions['1'];
    const ITEM_OF_FLAG = { hasSword: 'Progressive Sword', hasSpear: 'Ghost Spear', hasShield: 'Progressive Shield' };
    const roomRegions = (n) => Object.keys(REGIONS).filter((r) => r === `level_${n}` || r.startsWith(`level_${n}__`));
    const isTrue = (rule) => rule === undefined || rule === null || rule.rule === 'True_';

    it('each gated room is two sub-regions; one crossing costs the arm set, and every other exit and location is free', () => {
        for (const gate of TABLE.gates) {
            const regions = roomRegions(gate.level);
            expect(regions, `L${gate.level}`).toHaveLength(2);
            const priced = [];
            for (const r of regions) {
                for (const e of REGIONS[r].exits ?? []) if (!isTrue(e.access_rule)) priced.push({ from: r, to: e.connected_region, rule: e.access_rule });
                for (const l of REGIONS[r].locations ?? []) expect(isTrue(l.access_rule), `${r} @ ${l.name}`).toBe(true);
            }
            expect(priced, `L${gate.level}`).toHaveLength(1);
            expect(regions).toContain(priced[0].to);
            expect(priced[0].from).not.toBe(priced[0].to);
            expect(priced[0].rule).toEqual({ rule: 'Or', children: gate.arms.map((f) => ({ rule: 'Has', args: { item_name: ITEM_OF_FLAG[f] } })) });
            // The reverse crossing exists and is free.
            const back = REGIONS[priced[0].to].exits.find((e) => e.connected_region === priced[0].from);
            expect(back && isTrue(back.access_rule)).toBe(true);
            // Every door INTO the room is as free as it was.
            for (const [name, region] of Object.entries(REGIONS)) {
                if (regions.includes(name)) continue;
                for (const e of region.exits ?? []) if (regions.includes(e.connected_region)) expect(isTrue(e.access_rule), e.name).toBe(true);
            }
        }
    });

    it('a wallflyer room with no gate stays one region, all free', () => {
        const gated = new Set(TABLE.gates.map((g) => g.level));
        const ungated = MAP.levels.filter((l) => (l.entities ?? []).some((e) => e.type === 'wallflyer') && !gated.has(l.level));
        expect(ungated.length).toBeGreaterThan(0);
        for (const level of ungated) {
            const regions = roomRegions(level.level);
            expect(regions, `L${level.level}`).toEqual([`level_${level.level}`]);
            for (const e of REGIONS[regions[0]].exits ?? []) expect(isTrue(e.access_rule), e.name).toBe(true);
        }
    });
});
