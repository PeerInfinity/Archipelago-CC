import { describe, expect, it } from 'vitest';

import { compileAccessRule } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import {
    CLOUDBERRY_GAME_ITEMS, CLOUDBERRY_ITEM_NAMES, CLOUDBERRY_ITEMS_BY_AP_NAME, CLOUDBERRY_LIBRARY_OBSTACLES,
    CLOUDBERRY_PAYLOAD_VERSION, buildCloudberryPayload, chooseCheckCoins, documentFacts, emitCloudberryPaths,
    emitCloudberryRules, exitItems, pageParamsForWorld, requiredItems, requirementRule,
} from './cloudberryRules.js';

/** A ck-level/2 document reduced to what the facts read. */
function doc({ pieces, jetpack = false, coins = [] }) {
    const seedPieces = [];
    pieces.forEach((items, k) => {
        if (k > 0) seedPieces.push({ seedPiece: seedPieces.length, kind: 'ladder', ladder: k - 1 });
        seedPieces.push({ seedPiece: seedPieces.length, kind: 'piece', piece: k, items });
    });
    return {
        format: 'ck-level/2',
        level: jetpack ? { heroAbility: { JetPack: true } } : {},
        seedPieces,
        coins: { count: coins.length, list: coins },
    };
}
const coin = (id, piece, tick) => ({ id, pos: [0, 0], piece, ...(tick === null ? {} : { witness: { replayOfPiece: piece, tick, bob: 0 } }) });

const SHA = 'a'.repeat(64);
const FALL_CLOUD = doc({
    pieces: [[], ['FallingBlock'], ['FallingBlock', 'Cloud']],
    coins: [coin(1, 0, 10), coin(2, 0, 20), coin(3, 0, 30), coin(4, 1, 50), coin(5, 1, null), coin(6, 2, 90), coin(7, 2, 80)],
});

describe('items', () => {
    it('names the ten game items (FlyBlob and Jetpack included) and maps both ways', () => {
        expect(CLOUDBERRY_GAME_ITEMS).toEqual(['MovingBlock', 'FallingBlock', 'BouncyBlock', 'GhostBlock', 'Cloud',
            'Elevator', 'Pendulum', 'Conveyor', 'FlyBlob', 'Jetpack']);
        for (const g of CLOUDBERRY_GAME_ITEMS) expect(CLOUDBERRY_ITEMS_BY_AP_NAME[CLOUDBERRY_ITEM_NAMES[g]]).toBe(g);
        expect(Object.keys(CLOUDBERRY_LIBRARY_OBSTACLES)).toEqual(CLOUDBERRY_GAME_ITEMS.map((g) => `cloudberry_gate_${g}`));
    });
});

describe('documentFacts', () => {
    it('reads each piece\'s items, the Jetpack hero and only the WITNESSED coins', () => {
        const f = documentFacts(FALL_CLOUD);
        expect(f.pieceItems).toEqual([[], ['FallingBlock'], ['FallingBlock', 'Cloud']]);
        expect(f.jetpack).toBe(false);
        expect(f.coins.map((c) => c.id)).toEqual([1, 2, 3, 4, 6, 7]);
        expect(documentFacts(doc({ pieces: [[]], jetpack: true })).jetpack).toBe(true);
    });
    it('sorts a piece\'s items into the item order', () => {
        expect(documentFacts(doc({ pieces: [['Cloud', 'MovingBlock']] })).pieceItems).toEqual([['MovingBlock', 'Cloud']]);
    });
    it('refuses an error document, a document without pieces and an unknown item', () => {
        expect(() => documentFacts({ error: 'RerollExhausted: piece 1 …' })).toThrow(/refused: RerollExhausted/);
        expect(() => documentFacts({ seedPieces: [] })).toThrow(/no pieces/);
        expect(() => documentFacts(doc({ pieces: [['Spikes']] }))).toThrow(/unknown Cloudberry item 'Spikes'/);
    });
});

describe('chooseCheckCoins (⚖ R19)', () => {
    it('one per piece = the middle witnessed coin by tick', () => {
        expect(chooseCheckCoins(documentFacts(FALL_CLOUD), 1)).toEqual([
            { name: 'coin2', coin: 2, piece: 0 }, { name: 'coin4', coin: 4, piece: 1 }, { name: 'coin6', coin: 6, piece: 2 },
        ]);
    });
    it('n per piece spreads them, never more than the piece has', () => {
        const picks = chooseCheckCoins(documentFacts(FALL_CLOUD), 2);
        expect(picks.map((c) => c.coin)).toEqual([1, 3, 4, 7, 6]);
    });
});

describe('requirements', () => {
    it('S_k is cumulative; the exits need S_last; a Jetpack level needs Jetpack everywhere', () => {
        const f = documentFacts(FALL_CLOUD);
        expect(requiredItems(f, 0)).toEqual([]);
        expect(requiredItems(f, 1)).toEqual(['FallingBlock']);
        expect(requiredItems(f, 2)).toEqual(['FallingBlock', 'Cloud']);
        expect(exitItems(f)).toEqual(['FallingBlock', 'Cloud']);
        const jet = documentFacts(doc({ pieces: [[], ['FlyBlob']], jetpack: true }));
        expect(requiredItems(jet, 0)).toEqual(['Jetpack']);
        expect(exitItems(jet)).toEqual(['FlyBlob', 'Jetpack']);
        expect(() => requiredItems(f, 3)).toThrow(/out of range/);
    });
});

describe('emitCloudberryPaths', () => {
    it('one path: a physics obstacle per item, then a logic_gate per authored term', () => {
        const { paths, authoredDefs } = emitCloudberryPaths(['Cloud', 'MovingBlock'], [{ item: 'Red Key', count: 1 }, { item: 'Gem', count: 3 }]);
        expect(paths).toEqual([{ path_id: 'p1', obstacles: ['cloudberry_gate_MovingBlock', 'cloudberry_gate_Cloud', 'cloudberry_logic_Red_Key', 'cloudberry_logic_Gem__x3'] }]);
        expect(authoredDefs.cloudberry_logic_Gem__x3.clear_rule).toEqual({ rule: 'Has', args: { item_name: 'Gem', count: 3 } });
    });
    it('compiles to the same predicate as the requirement rule', () => {
        for (const [items, terms] of [[[], []], [['Jetpack'], []], [['MovingBlock', 'Elevator'], [{ item: 'Key', count: 2 }]], [[], [{ item: 'Key' }]]]) {
            const { paths, authoredDefs } = emitCloudberryPaths(items, terms);
            expect(compileAccessRule(paths, { ...CLOUDBERRY_LIBRARY_OBSTACLES, ...authoredDefs }))
                .toEqual(requirementRule(items, terms));
        }
    });
});

describe('emitCloudberryRules', () => {
    const f = documentFacts(FALL_CLOUD);
    const checks = chooseCheckCoins(f, 1);
    it('a check coin in piece k needs S_k; every exit needs S_last; only referenced obstacles are defined', () => {
        const out = emitCloudberryRules(f, { checks, items: { coin2: 'Falling Blocks' }, exitSides: ['E', 'S'] });
        expect(out.locations.map((l) => [l.id, l.item, l.paths[0].obstacles])).toEqual([
            ['coin2', 'Falling Blocks', []],
            ['coin4', null, ['cloudberry_gate_FallingBlock']],
            ['coin6', null, ['cloudberry_gate_FallingBlock', 'cloudberry_gate_Cloud']],
        ]);
        expect(Object.keys(out.exitPaths)).toEqual(['E', 'S']);
        expect(out.exitPaths.E[0].obstacles).toEqual(['cloudberry_gate_FallingBlock', 'cloudberry_gate_Cloud']);
        expect(Object.keys(out.obstacleDefs)).toEqual(['cloudberry_gate_Cloud', 'cloudberry_gate_FallingBlock']);
        expect(out.gateRules).toEqual({ portals: {}, pickups: {} });
    });
    it('authored terms become logic gates AND gate_rules keyed by the page\'s side / the check name', () => {
        const out = emitCloudberryRules(f, {
            checks, exitSides: ['N'],
            authored: { exits: { N: [{ item: 'Red Key', count: 1 }] }, locations: { coin2: [{ item: 'Gem', count: 2 }] } },
        });
        expect(out.exitPaths.N[0].obstacles.at(-1)).toBe('cloudberry_logic_Red_Key');
        expect(out.gateRules.portals).toEqual({ north: { rule: 'Has', args: { item_name: 'Red Key' } } });
        expect(out.gateRules.pickups).toEqual({ coin2: { rule: 'Has', args: { item_name: 'Gem', count: 2 } } });
    });
    it('refuses an unknown side', () => {
        expect(() => emitCloudberryRules(f, { checks, exitSides: ['up'] })).toThrow(/unknown side/);
    });
});

describe('buildCloudberryPayload', () => {
    const checks = [{ name: 'coin2', coin: 2, piece: 0 }, { name: 'coin4', coin: 4, piece: 1 }];
    const generate = { seed: 1, pieces: [], rerolls: [0, 0] };
    it('is the page\'s cloudberry-region/1 payload in params, with AP location names <region>__<check>', () => {
        const p = buildCloudberryPayload('region_2_2', { generate, docSha256: SHA, checks });
        expect(p.gameId).toBe('cloudberry');
        expect(p.params).toEqual({ payload: CLOUDBERRY_PAYLOAD_VERSION, generate, docSha256: SHA, checks: { coin2: 2, coin4: 4 }, items: CLOUDBERRY_ITEMS_BY_AP_NAME });
        expect(p.ap_locations).toEqual({ coin2: 'region_2_2__coin2', coin4: 'region_2_2__coin4' });
        expect(p.gate_rules).toBeUndefined();
    });
    it('carries gate_rules only when something is authored', () => {
        const gateRules = { portals: { east: { rule: 'Has', args: { item_name: 'K' } } }, pickups: {} };
        expect(buildCloudberryPayload('r', { generate, docSha256: SHA, checks, gateRules }).gate_rules).toEqual(gateRules);
    });
    it('refuses a reroll search, a missing request and a bad hash', () => {
        expect(() => buildCloudberryPayload('r', { generate: { ...generate, reroll: true }, docSha256: SHA, checks })).toThrow(/reroll search/);
        expect(() => buildCloudberryPayload('r', { docSha256: SHA, checks })).toThrow(/no generate/);
        expect(() => buildCloudberryPayload('r', { generate, docSha256: 'abc', checks })).toThrow(/64 hex/);
    });
});

describe('pageParamsForWorld', () => {
    it('derives the page\'s exits, side portals and entrySide from the world', () => {
        const exits = new Map([
            ['exit_E', { exit_id: 'exit_E', side: 'E', exitName: 'exit_E' }],
            ['exit_W', { exit_id: 'exit_W', side: 'W', exitName: 'exit_W' }],
            ['odd', { exit_id: 'odd', side: null, exitName: 'odd' }],
        ]);
        const params = pageParamsForWorld({ params: { payload: CLOUDBERRY_PAYLOAD_VERSION, backExitSide: 'W' }, exits });
        expect(params.exits).toEqual([{ side: 'east', exitName: 'exit_E' }, { side: 'west', exitName: 'exit_W' }]);
        expect(params.sidePortals).toEqual({ N: 'north', E: 'east', S: 'south', W: 'west' });
        expect(params.entrySide).toBe('west');
        expect(pageParamsForWorld({ params: {}, exits: [] }).entrySide).toBeNull();
    });
});
