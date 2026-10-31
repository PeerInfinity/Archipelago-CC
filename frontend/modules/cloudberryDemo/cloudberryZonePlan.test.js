import { describe, it, expect, beforeEach } from 'vitest';

import {
    canHostCloudberryExitGates, cloudberryAttemptArgs, cloudberryAttemptSeed, emitCloudberryZone,
    planCloudberryLevel, readCloudberryDocument, splitCloudberryRequirement,
} from './cloudberryZonePlan.js';
import {
    clearCloudberryLevelCache, cloudberryGenerationStats, ensureCloudberryLevel, installCloudberryGenerator,
    lookupCloudberryLevel,
} from './cloudberryGeneration.js';
import { substrateRegistryEntry, generateCloudberryZoneForSpecsGen } from './cloudberryLibrary.js';
import { CLOUDBERRY_LIBRARY_OBSTACLES } from './cloudberryRules.js';

const SHA = 'a'.repeat(64);

/** A ck-level/2 document shaped like the generator's for a plan (each piece: its new items, 3 witnessed coins). */
function fakeDoc(plan, { args = plan.args, withoutStartDoor = false, coinsPerPiece = 3, error = null } = {}) {
    if (error) return { error };
    const seedPieces = [];
    const coins = [];
    let id = 100;
    plan.pieceSets.forEach((S, k) => {
        const prev = k ? plan.pieceSets[k - 1] : [];
        seedPieces.push({ kind: 'piece', piece: k, items: S.filter((x) => !prev.includes(x)) });
        for (let i = 0; i < coinsPerPiece; i++) coins.push({ id: id++, piece: k, witness: { replayOfPiece: k, tick: 10 * i + 5 } });
    });
    const { reroll, ...request } = args;
    return {
        args: { request: { ...request, rerolls: plan.pieceSets.map(() => 0) } },
        level: { heroAbility: { JetPack: !!args.heroCustom } },
        goal: withoutStartDoor ? { door: [1, 1] } : { startDoor: [0, 0], door: [1, 1] },
        seedPieces,
        coins: { count: coins.length, list: coins },
    };
}

const specs = (over = {}) => ({
    region_id: 'region_1_0',
    seed: 12345,
    exitSpecs: [
        { side: 'E', requirement: ['Moving Blocks'], counts: {} },
        { side: 'W', requirement: [], counts: {} },
    ],
    locationSpecs: [{ id: 'loc_0', item: 'Clouds', requirement: [] }, { id: 'loc_1', item: null, requirement: [] }],
    cloudberry: {},
    ...over,
});
const ctx = { entrance: { side: 'W', requirement: ['Clouds'], counts: {} } };

describe('splitCloudberryRequirement', () => {
    it('platform items with count 1 are physics; Jetpack, foreign items and counts are authored', () => {
        expect(splitCloudberryRequirement(['Clouds', 'Moving Blocks', 'Jetpack', 'Lantern', 'Pendulums'], { Pendulums: 2 }))
            .toEqual({
                physics: ['MovingBlock', 'Cloud'],
                authored: [{ item: 'Jetpack', count: 1 }, { item: 'Lantern', count: 1 }, { item: 'Pendulums', count: 2 }],
            });
    });
});

describe('canHostCloudberryExitGates', () => {
    it('accepts gates with EQUAL platform parts only (every exit is at the end door)', () => {
        expect(canHostCloudberryExitGates([], ['Clouds'])).toBe(true);
        expect(canHostCloudberryExitGates([['Clouds']], ['Clouds'])).toBe(true);
        expect(canHostCloudberryExitGates([['Clouds']], [{ item: 'Clouds', count: 1 }, 'Jetpack'])).toBe(true);
        expect(canHostCloudberryExitGates([['Clouds']], ['Moving Blocks'])).toBe(false);
        expect(canHostCloudberryExitGates([['Clouds']], [])).toBe(false);
        // Jetpack and foreign items are locks, not pieces: they never conflict.
        expect(canHostCloudberryExitGates([['Jetpack']], ['Lantern'])).toBe(true);
    });
});

describe('planCloudberryLevel', () => {
    it('plans item-free pieces for the check coins, then the exits\' items; the way back is free', () => {
        const plan = planCloudberryLevel(specs({ cloudberry: { cloudberryTileset: 'cave' } }), ctx);
        expect(plan.pieceSets).toEqual([[], [], ['MovingBlock']]);
        expect(plan.locations.map((l) => [l.id, l.piece])).toEqual([['loc_0', 0], ['loc_1', 1]]);
        expect(plan.needs).toEqual({ checks: [1, 1, 0], startDoor: true });
        expect(plan.exits).toEqual([
            { side: 'E', back: false, physics: ['MovingBlock'], authored: [] },
            { side: 'W', back: true, physics: [], authored: [] },
        ]);
        expect(plan.args).toEqual({
            seed: 12345, difficulty: 2, tileset: 'cave', pieceLength: 3500,
            pieces: [{ upgrades: { Jump: 2 } }, { upgrades: { Jump: 2 } }, { upgrades: { MovingBlock: 5, Jump: 2 } }],
            trace: false, settings: false,
        });
        expect(plan.jetpack).toBe(false);
    });

    it('checks per piece groups the coins; min pieces pads item-free pieces at the start', () => {
        const two = planCloudberryLevel(specs({ cloudberry: { cloudberryChecksPerPiece: 2, cloudberryTileset: 'sea' } }), ctx);
        expect(two.pieceSets).toEqual([[], ['MovingBlock']]);
        expect(two.needs.checks).toEqual([2, 0]);
        const padded = planCloudberryLevel(specs({
            exitSpecs: [], locationSpecs: [{ id: 'v', item: 'Victory', requirement: [] }],
            cloudberry: { cloudberryMinPieces: 3, cloudberryTileset: 'sea' },
        }), {});
        expect(padded.pieceSets).toEqual([[], [], []]);
        expect(padded.locations).toEqual([{ id: 'v', item: 'Victory', piece: 2, authored: [] }]);
        expect(padded.needs.startDoor).toBe(false);
    });

    it('nests location requirements under the exits (new item 5, carried 3)', () => {
        const plan = planCloudberryLevel(specs({
            exitSpecs: [{ side: 'S', requirement: ['Moving Blocks', 'Clouds'] }],
            locationSpecs: [{ id: 'a', requirement: [] }, { id: 'b', requirement: ['Moving Blocks'] }],
            cloudberry: { cloudberryTileset: 'cave', cloudberryMinPieces: 1 },
        }), {});
        expect(plan.pieceSets).toEqual([[], ['MovingBlock'], ['MovingBlock', 'Cloud']]);
        expect(plan.args.pieces.map((p) => p.upgrades)).toEqual([
            { Jump: 2 }, { MovingBlock: 5, Jump: 2 }, { MovingBlock: 3, Cloud: 5, Jump: 2 }]);
    });

    it('refuses by name: unequal exits, incomparable requirements, a gated way back', () => {
        expect(() => planCloudberryLevel(specs({
            exitSpecs: [{ side: 'E', requirement: ['Clouds'] }, { side: 'S', requirement: ['Moving Blocks'] }],
        }), {})).toThrow(/forward exits need different platform items/);
        expect(() => planCloudberryLevel(specs({
            exitSpecs: [], locationSpecs: [{ id: 'a', requirement: ['Clouds'] }, { id: 'b', requirement: ['Pendulums'] }],
        }), {})).toThrow(/incomparable/);
        expect(() => planCloudberryLevel(specs({ exitSpecs: [{ side: 'W', requirement: ['Clouds'] }] }), ctx))
            .toThrow(/way back/);
    });

    it('a Jetpack entry gate makes a Jetpack-hero level by the chance (rng draw 3, after tileset and hazards)', () => {
        const entry = { entrance: { side: 'W', requirement: ['Jetpack'], counts: {} } };
        expect(planCloudberryLevel(specs({ cloudberry: { cloudberryJetpackChance: 1 } }), entry).args.heroCustom)
            .toEqual({ move: 'Jetpack', phsx: { jetpackfuel: 1 } });
        expect(planCloudberryLevel(specs({ cloudberry: { cloudberryJetpackChance: 0 } }), entry).args.heroCustom)
            .toBeUndefined();
        // Without Jetpack in the entry gate the chance draws nothing: same tileset either way.
        const a = planCloudberryLevel(specs({ cloudberry: { cloudberryJetpackChance: 0.5 } }), ctx);
        const b = planCloudberryLevel(specs({ cloudberry: { cloudberryJetpackChance: 0.9 } }), ctx);
        expect(a.args).toEqual(b.args);
    });

    it('hazards: N kinds drawn per level at the level, on every piece', () => {
        const plan = planCloudberryLevel(specs({
            cloudberry: { cloudberryHazards: true, cloudberryHazardKinds: 2, cloudberryHazardLevel: 4, cloudberryTileset: 'cave' },
        }), ctx);
        const hazards = Object.entries(plan.args.pieces[0].upgrades).filter(([k]) => k !== 'Jump');
        expect(hazards).toHaveLength(2);
        expect(hazards.every(([, v]) => v === 4)).toBe(true);
        expect(plan.args.pieces.every((p) => hazards.every(([k]) => p.upgrades[k] === 4))).toBe(true);
    });

    it('is deterministic: the same specs plan the same request and key', () => {
        expect(planCloudberryLevel(specs(), ctx)).toEqual(planCloudberryLevel(specs(), ctx));
        expect(planCloudberryLevel(specs({ seed: 7 }), ctx).key).not.toBe(planCloudberryLevel(specs(), ctx).key);
    });
});

describe('cloudberryAttemptSeed', () => {
    it('attempt 0 is the seed; later attempts are distinct non-negative int32s', () => {
        expect(cloudberryAttemptSeed(99, 0)).toBe(99);
        const seeds = [1, 2, 3, 4].map((a) => cloudberryAttemptSeed(99, a));
        expect(new Set(seeds).size).toBe(4);
        expect(seeds.every((s) => Number.isInteger(s) && s >= 0 && s <= 0x7fffffff)).toBe(true);
        expect(cloudberryAttemptArgs({ seed: 99, x: 1 }, 2)).toEqual({ seed: cloudberryAttemptSeed(99, 2), x: 1 });
    });
});

describe('readCloudberryDocument', () => {
    const plan = planCloudberryLevel(specs({ cloudberry: { cloudberryTileset: 'cave' } }), ctx);
    it('reads the facts, chooses the middle witnessed coin per check, sees the start door', () => {
        const r = readCloudberryDocument(fakeDoc(plan), plan);
        expect(r).toEqual({
            ok: true, facts: { pieceItems: [[], [], ['MovingBlock']], jetpack: false },
            checks: [[101], [104], []], startDoor: true,
        });
    });
    it('refuses what the plan cannot use, with the reason', () => {
        expect(readCloudberryDocument(fakeDoc(plan, { error: 'RerollExhausted: piece 2' }), plan).reason).toMatch(/RerollExhausted/);
        expect(readCloudberryDocument(fakeDoc(plan, { coinsPerPiece: 0 }), plan).reason).toMatch(/witnessed coin/);
        expect(readCloudberryDocument(fakeDoc(plan, { withoutStartDoor: true }), plan).reason).toMatch(/start door/);
        const doc = fakeDoc(plan);
        doc.seedPieces[2].items = ['Cloud'];
        expect(readCloudberryDocument(doc, plan).reason).toMatch(/piece 2 realised \[Cloud\], planned \[MovingBlock\]/);
    });
});

describe('emitCloudberryZone', () => {
    it('check in piece k → S_k; forward exits → S_last; the way back free; authored terms ride gate_rules', () => {
        const plan = planCloudberryLevel(specs({
            exitSpecs: [
                { side: 'E', requirement: ['Moving Blocks', 'Lantern'] },
                { side: 'W', requirement: [] },
            ],
            cloudberry: { cloudberryTileset: 'cave' },
        }), ctx);
        const read = readCloudberryDocument(fakeDoc(plan), plan);
        const zone = emitCloudberryZone(plan, { ...read, generate: {}, docSha256: SHA });
        expect(zone.checks).toEqual([{ name: 'loc_0', coin: 101, piece: 0 }, { name: 'loc_1', coin: 104, piece: 1 }]);
        expect(zone.locations.map((l) => l.paths[0].obstacles)).toEqual([[], []]);
        expect(zone.exitPaths.E[0].obstacles).toEqual(['cloudberry_gate_MovingBlock', 'cloudberry_logic_Lantern']);
        expect(zone.exitPaths.W[0].obstacles).toEqual([]);
        expect(zone.gateRules.portals).toEqual({ east: { rule: 'Has', args: { item_name: 'Lantern' } } });
        expect(zone.obstacleDefs.cloudberry_gate_MovingBlock).toBe(CLOUDBERRY_LIBRARY_OBSTACLES.cloudberry_gate_MovingBlock);
        expect(Object.keys(zone.obstacleDefs).sort()).toEqual(['cloudberry_gate_MovingBlock', 'cloudberry_logic_Lantern']);
    });
});

describe('generation: cache, retry and the hook', () => {
    let calls;
    const plan = planCloudberryLevel(specs({ cloudberry: { cloudberryTileset: 'cave', cloudberryRetries: 2 } }), ctx);
    beforeEach(() => {
        clearCloudberryLevelCache();
        calls = [];
    });
    const generatorFor = (docs) => ({
        build: 'test-build',
        async generate(args) {
            calls.push(args);
            return { text: JSON.stringify(docs(args, calls.length - 1)), docSha256: SHA };
        },
    });

    it('a refusal retries with a derived seed; the result is cached; the store is filled', async () => {
        const stored = new Map();
        installCloudberryGenerator(generatorFor((args, i) => (i === 0
            ? fakeDoc(plan, { args, error: 'RerollExhausted: piece 2 refused in all 16 attempts' })
            : fakeDoc(plan, { args }))), { store: { get: (k) => stored.get(k) ?? null, set: (k, v) => stored.set(k, v) } });
        const r = await ensureCloudberryLevel(plan);
        expect(calls.map((a) => a.seed)).toEqual([plan.args.seed, cloudberryAttemptSeed(plan.args.seed, 1)]);
        expect(calls.every((a) => a.reroll === true)).toBe(true);
        expect(r.attempt).toBe(1);
        expect(r.generate.seed).toBe(cloudberryAttemptSeed(plan.args.seed, 1));
        expect(r.generate.reroll).toBeUndefined();
        expect(lookupCloudberryLevel(plan)).toBe(r);
        expect(stored.size).toBe(1);
        // A new session (memory cleared) takes it from the store without generating.
        clearCloudberryLevelCache();
        const n = calls.length;
        expect((await ensureCloudberryLevel(plan)).docSha256).toBe(SHA);
        expect(calls.length).toBe(n);
        installCloudberryGenerator(null, { store: null });
    });

    it('every attempt refused → a named refusal from the hook; a synchronous drain refuses a miss', async () => {
        installCloudberryGenerator(generatorFor((args) => fakeDoc(plan, { args, coinsPerPiece: 0 })), { store: null });
        const gen = generateCloudberryZoneForSpecsGen(specs({ cloudberry: { cloudberryTileset: 'cave', cloudberryRetries: 2 } }), ctx);
        const ev = gen.next().value;
        expect(ev.type).toBe('attempt');
        await ev.await;
        expect(() => gen.next()).toThrow(/CloudberryLevelRefused: cloudberry zone 'region_1_0'.*attempt 2 .*witnessed coin/);
        expect(calls).toHaveLength(3);
        expect(cloudberryGenerationStats().refusals).toBeGreaterThan(0);

        clearCloudberryLevelCache();
        expect(() => substrateRegistryEntry.generateZoneForSpecs(specs({ seed: 999 }), ctx))
            .toThrow(/being generated by the Cloudberry game page.*cannot wait/);
        installCloudberryGenerator(null, { store: null });
    });

    it('the registry entry: heavy, sphere hooks, prefixed params', () => {
        const e = substrateRegistryEntry;
        expect(e.generationCost).toBe('heavy');
        expect(e.backPortalGated()).toBe(false);
        expect(e.hostsSurplusExitsNatively()).toBe(true);
        expect(e.exitGateVeto({})).toBe(canHostCloudberryExitGates);
        expect(e.gateHostingHint()).toMatch(/end door/);
        expect(Object.keys(e.defaultProcgenParams).every((k) => k.startsWith('cloudberry'))).toBe(true);
        const zs = e.buildZoneSpecs({ region_id: 'r', seed: 1 }, { cloudberryTileset: 'sea', runnerJitter: 1 });
        expect(zs.cloudberry).toEqual({ cloudberryTileset: 'sea' });
    });
});
