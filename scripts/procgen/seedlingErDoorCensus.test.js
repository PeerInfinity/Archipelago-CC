/**
 * ⛓ ER E1 — the ER door census, pinned to the COMMITTED playthrough atlas, AP_1 rules and the producer's
 * source. A restamped atlas, a new link reader in the producer or a moved gate moves these rows: re-measure
 * with `node scripts/procgen/census-seedling-er-doorways.mjs` and re-pin by name.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { loadCensusInputs } from './census-seedling-er-doorways.mjs';
import { censusErDoorways, classifyExit, doorwaysOf, pairDoorways, stairsProof } from './seedlingErDoorCensus.js';

describe('seedlingErDoorCensus — the rules themselves (synthetic)', () => {
    const level = (entities) => ({ level: 1, entities });
    const bounds = { w: 10, h: 10 };
    const conn = (to) => ({ from: ['level_1', 'x'], to: [`level_${to}`, 'in_L1_0_0'] });

    it('R-LINK classifies a link by its entity, and an edge teleporter by the outer tile ring', () => {
        const stairs = { exit_id: 'out_stairsdown_32_32', exit_tiles: [[2, 2]] };
        expect(classifyExit({ level: 1, exit: stairs, conn: conn(2), bounds, triggerKeys: {},
            mapLevel: level([{ type: 'stairsdown', x: 32, y: 32, attrs: { to: '2' } }]) })).toEqual({ cls: 'stairsdown', rule: 'R-LINK' });
        const edge = { exit_id: 'out_teleporter_0_32', exit_tiles: [[0, 2]] };
        expect(classifyExit({ level: 1, exit: edge, conn: conn(2), bounds, triggerKeys: {},
            mapLevel: level([{ type: 'teleporter', x: 0, y: 32, attrs: { to: '2' } }]) }).cls).toBe('teleporter/edge');
    });

    it('a link whose @to disagrees with its connection, or an exit with no entity, is UNCLASSIFIED (Q5)', () => {
        const stairs = { exit_id: 'out_stairsdown_32_32', exit_tiles: [[2, 2]] };
        expect(classifyExit({ level: 1, exit: stairs, conn: conn(3), bounds, triggerKeys: {},
            mapLevel: level([{ type: 'stairsdown', x: 32, y: 32, attrs: { to: '2' } }]) }).cls).toBeNull();
        expect(classifyExit({ level: 1, exit: stairs, conn: conn(2), bounds, triggerKeys: {}, mapLevel: level([]) }).cls).toBeNull();
        expect(classifyExit({ level: 1, exit: { exit_id: 'weird', exit_tiles: [[0, 0]] }, conn: conn(2), bounds, triggerKeys: {},
            mapLevel: level([]) }).cls).toBeNull();
    });

    it('a stair whose only reverse is a teleporter fails the proof by name', () => {
        const atlas = {
            regions: [
                { region_id: 'level_1', map_ref: 1, bounds, exits: [
                    { exit_id: 'out_stairsdown_32_32', exit_tiles: [[2, 2]], entrance_tile: [2, 2] },
                    { exit_id: 'in_L2_48_48', exit_tiles: [[2, 3]], entrance_tile: [2, 3] }] },
                { region_id: 'level_2', map_ref: 2, bounds, exits: [
                    { exit_id: 'out_teleporter_48_48', exit_tiles: [[3, 3]], entrance_tile: [3, 3] },
                    { exit_id: 'in_L1_32_32', exit_tiles: [[3, 4]], entrance_tile: [3, 4] }] },
            ],
            vanilla_layout: { connections: [
                { from: ['level_1', 'out_stairsdown_32_32'], to: ['level_2', 'in_L1_32_32'], one_way: true },
                { from: ['level_2', 'out_teleporter_48_48'], to: ['level_1', 'in_L2_48_48'], one_way: true },
            ] },
        };
        const mapDoc = { tile_size: 16, levels: [
            level([{ type: 'stairsdown', x: 32, y: 32, attrs: { to: '2', playerx: '48', playery: '64' } }]),
            { level: 2, entities: [{ type: 'teleporter', x: 48, y: 48, attrs: { to: '1', playerx: '32', playery: '48' } }] },
        ] };
        const { doorways, unclassified } = doorwaysOf(atlas, mapDoc, { triggerKeys: {} });
        expect(unclassified).toEqual([]);
        const key = (l, x, y) => `${l}|${x}|${y}`;
        const table = new Map([
            [key(1, 2, 2), { via: { level: 2, type: 'teleporter', x: 48, y: 48 } }],
            [key(2, 3, 3), { via: { level: 1, type: 'stairsdown', x: 32, y: 32 } }],
        ]);
        pairDoorways(doorways, table, mapDoc, key);
        const proof = stairsProof(doorways);
        expect(proof.failures).toEqual([{ id: 'L1:out_stairsdown_32_32', why: ['reverse L2:out_teleporter_48_48 is teleporter/door, not stairsup'] }]);
    });
});

describe('census-seedling-er-doorways — the committed playthrough atlas', () => {
    let c;
    beforeAll(async () => {
        c = censusErDoorways(await loadCensusInputs());
    }, 180_000);

    it('320 one-way connections merge into 281 doorways, every one classified by a stated rule (Q5)', () => {
        expect(c.connections).toBe(320);
        expect(c.oneWayConnections).toBe(320);
        expect(c.doorways).toBe(281);
        expect(c.unclassified).toEqual([]);
        expect(c.byKind).toEqual({ death: 2, pit: 13, stairsdown: 26, stairsup: 26, teleporter: 214 });
        expect(c.byClass).toEqual({
            pit: 12, 'pit/chained': 1, stairsdown: 26, stairsup: 26, 'teleporter/door': 23, 'teleporter/edge': 191, warp: 2,
        });
        expect(c.byRule).toEqual({ 'R-LINK': 266, 'R-PIT': 13, 'R-WARP': 2 });
    });

    it('game data pairs 258; the heuristic finds 260; the one-way doorways are named by rule', () => {
        expect(c.gamePaired).toBe(258);
        expect(c.heuristicPaired).toBe(260);
        expect(Object.values(c.pairingCounts).reduce((a, b) => a + b, 0)).toBe(281);
        const oneWayLinks = c.oneWay.filter((o) => o.cls.startsWith('teleporter')).map((o) => `${o.id}>L${o.to}`);
        expect(oneWayLinks).toEqual([
            'L34:out_teleporter_128_0>L12', 'L43:out_teleporter_144_64>L37', 'L58:out_teleporter_48_112+1>L57',
            'L58:out_teleporter_80_16>L46', 'L100:out_teleporter_288_96>L101', 'L101:out_teleporter_104_24>L110',
            'L106:out_teleporter_64_48>L101', 'L109:out_teleporter_160_48>L101',
        ]);
        expect(c.oneWay.filter((o) => o.cls === 'warp').map((o) => o.id))
            .toEqual(['L57:out_tentaclebeast_80_48', 'L69:out_lightbosscontroller_72_72']);
        // L58 -> L57 is the FALSE heuristic pair (with the tentacle beast's warp); the rest are L61-63's
        // double-door edges, where the heuristic sees both doors and game data names one.
        expect(c.disagreements).toHaveLength(14);
        expect(c.disagreements.filter((d) => d.game.length === 0).map((d) => d.id))
            .toEqual(['L57:out_tentaclebeast_80_48', 'L58:out_teleporter_48_112+1']);
    });

    it('every stair has exactly one game-data reverse, mutual, of the opposite direction: 26 pairs', () => {
        expect(c.proof).toMatchObject({ stairs: 52, down: 26, up: 26, failures: [] });
        expect(c.proof.pairs).toHaveLength(26);
    });

    it('(A) the producer\'s link readers are scanned, none unmeasured; the stairs-exposed ones are named', () => {
        expect(c.scan.readers).toEqual(['arrivalSolidCensus', 'buildLevelWorld', 'censusFallsOntoDoors', 'deriveAtlas',
            'gameLandings', 'poleKillsOf', 'returnSpawnTable']);
        expect(c.exposure.unmeasured).toEqual([]);
        const exposed = c.exposure.rows.filter((r) => r.stairsLandings.length).map((r) => `${r.fn}:${r.reads}`);
        expect(exposed).toEqual([
            'doorTilesOf:gameLandings', 'derivePlaythroughLayer:deriveAtlas', 'pitChainsFor:censusFallsOntoDoors',
            'playthroughBlockStoppers:poleKillsOf', 'barrierAnalysis:poleKillsOf', 'barrierAnalysis:buildLevelWorld', 'barrierAnalysis:gameLandings',
            'playthroughRopeEvents:gameLandings', 'RETURN_SPAWNS:returnSpawnTable', 'arrivalSpawnFor:returnSpawnTable',
            'playthroughLandingGates:returnSpawnTable',
        ]);
    });

    it('(B) 65 of 320 cross-level AP exits are gated (63 before rules-certifier-tail charged L54 r1c8 -> L53 r14c9 and L91 -> L89 r1c10 with Swim); 5 sit on a stairs doorway, each conjunct owned by rule', () => {
        expect(c.gates).toMatchObject({ crossLevel: 320, gated: 65, gatedLandingEvent: 17, gatedLandingTerrain: 15 });
        expect(c.gates.apExitsWithNoConnection).toEqual([]);
        expect(c.gates.stairsRows.map((r) => `${r.apExit} ${r.owners.map((o) => o.owner).join('+')}`)).toEqual([
            'level_101__r4c9 -> level_102__r5c9 DEPARTURE',
            'level_102__r5c9 -> level_101__r4c9 LANDING',
            'level_12__r13c6 -> level_5__r1c1 LANDING/terrain',
            'level_17 -> level_16__r3c7 LANDING',
            'level_98 -> level_99__r2c7 DEPARTURE',
        ]);
        expect(c.gates.stairsRows.every((r) => r.owners.every((o) => o.owner !== 'UNATTRIBUTED'))).toBe(true);
    });

    it('(C)–(F) and the pins', () => {
        expect(c.chains).toEqual([expect.objectContaining({
            pit: 'L110:out_pit_3_2', landsIn: 0, stairsDoorway: 'L0:out_stairsdown_256_272', stairsReverse: 'L2:out_stairsup_48_16',
        })]);
        // rules-certifier-tail's chargeNecessaryApproaches charges 16 of the 18 bindings, so 2 remain and none is at risk
        // (level_51/out_teleporter_144_0, the one at risk before, is now charged).
        expect(c.permissive.map((p) => p.binding)).toEqual(['level_66/out_teleporter_72_64', 'level_89/Level 089 - Feather']);
        expect(c.permissive.filter((p) => p.atRisk)).toEqual([]);
        expect(c.start).toEqual({ level: 0, subRegion: 'r7c6',
            stairsInStartSubRegion: ['L0:out_stairsdown_256_272', 'L0:out_stairsdown_32_192'],
            stairsIntoStartSubRegion: ['L13:out_stairsup_64_144', 'L2:out_stairsup_48_16'] });
        expect(c.floors).toEqual({ levels: [50, 52], stairsDoorways: [] });
        expect(c.pins.map((p) => `${p.doorway} ${p.rule}`)).toEqual([
            'L0:out_stairsdown_256_272 PIN-CHAIN', 'L2:out_stairsup_48_16 PIN-CHAIN (coupled)',
        ]);
    });
});
