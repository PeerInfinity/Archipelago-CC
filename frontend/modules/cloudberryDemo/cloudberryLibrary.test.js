import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateRegionLibrary } from '../procgenPipeline/regionLibraryValidator.js';
import { captureShapeOf, solverKindOf, offersPlayback, botHonorsInstant } from '../procgenCore/substratePredicates.js';
import { classifyRegion, generateLoopCosts, REGION_CLASS } from '../shared/procgen/loopCostGenerator.js';
import {
    CLOUDBERRY_EXIT_SIDES, substrateRegistryEntry as entry, instantiateCloudberryLibraryEntry, instantiateCloudberryLibraryEntryForSpecs,
    validateCloudberryLibraryEntry, captureCloudberryLibraryEntry, cloudberryLibraryEntryRefusal,
} from './cloudberryLibrary.js';

const PACK = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),
    '../../region-libraries/demo-cloudberry-pack.json'), 'utf8'));
const byId = (id) => PACK.entries.find((e) => e.entry_id === id);

describe('the committed demo pack', () => {
    it('validates, every entry\'s carried rules = what its facts emit', () => {
        const vr = validateRegionLibrary(PACK, { entryCapabilityCheck: (e) => entry.validateLibraryEntry(e) });
        expect(vr.errors).toEqual([]);
        expect(vr.ok).toBe(true);
    });
    it('holds no game data: args, the resolved request, a hash, facts and checks only', () => {
        for (const e of PACK.entries) {
            expect(Object.keys(e.payload).sort()).toEqual(['args', 'checks', 'docSha256', 'facts', 'generate']);
            expect(e.payload.generate.reroll).toBeUndefined();
            expect(Array.isArray(e.payload.generate.rerolls)).toBe(true);
        }
    });
    it('has nested pieces and Jetpack levels', () => {
        expect(PACK.entries.some((e) => e.payload.facts.jetpack)).toBe(true);
        for (const e of PACK.entries) {
            const p = e.payload.facts.pieceItems;
            for (let k = 1; k < p.length; k++) expect(p[k - 1].every((it) => p[k].includes(it))).toBe(true);
        }
    });
});

describe('validateCloudberryLibraryEntry', () => {
    it('refuses carried rules that drift from the facts', () => {
        const e = structuredClone(byId('cb_moving'));
        e.carried_rules.locations[1].paths = [{ path_id: 'p1', obstacles: [] }];
        expect(validateCloudberryLibraryEntry(e).errors.join()).toMatch(/locations differ/);
    });
    it('refuses a reroll search and a bad hash', () => {
        const e = structuredClone(byId('cb_moving'));
        e.payload.generate.reroll = true;
        e.payload.docSha256 = 'x';
        const errs = validateCloudberryLibraryEntry(e).errors.join();
        expect(errs).toMatch(/reroll search/);
        expect(errs).toMatch(/64 hex/);
    });
});

describe('instantiate (spiral)', () => {
    it('places the entry on the slot\'s sides with its carried items and the page payload', () => {
        const r = instantiateCloudberryLibraryEntry(byId('cb_falling_cloud'), { region_id: 'region_1_2', exitSides: ['E', 'S'] });
        expect(r.substrate).toBe('cloudberry');
        expect([...r.exits.keys()]).toEqual(['exit_E', 'exit_S']);
        expect(r.extracted_rules.exits.map((x) => x.paths[0].obstacles)).toEqual([
            ['cloudberry_gate_FallingBlock', 'cloudberry_gate_Cloud'], ['cloudberry_gate_FallingBlock', 'cloudberry_gate_Cloud']]);
        expect(r.extracted_rules.locations.map((l) => l.item)).toEqual(['Falling Blocks', 'Clouds', 'Victory']);
        expect(r.playable_payload.params.payload).toBe('cloudberry-region/1');
        expect(r.playable_payload.ap_locations.coin55).toBe('region_1_2__coin55');
        expect(r.obstacle_defs.cloudberry_gate_Cloud.clear_set).toEqual([['Clouds']]);
    });
    it('round-trips through capture', () => {
        const src = byId('cb_bouncy');
        const r = instantiateCloudberryLibraryEntry(src, { region_id: 'x', exitSides: ['N', 'E', 'S', 'W'] });
        const back = captureCloudberryLibraryEntry(r, { entry_id: src.entry_id, name: src.name });
        expect(back).toEqual(src);
    });
});

describe('instantiate for specs (sphere)', () => {
    it('puts the node items on the slots in order, filler on the rest, and returns the end door\'s paths', () => {
        const z = instantiateCloudberryLibraryEntryForSpecs(byId('cb_falling_cloud'), {
            region_id: 'r', exitSides: ['W', 'N'], locationSpecs: [{ item: 'Victory' }], fillerItem: 'Filler',
        });
        expect(z.locations.map((l) => l.item)).toEqual(['Victory', 'Filler', 'Filler']);
        expect(Object.keys(z.exitPaths)).toEqual(['W', 'N']);
        expect(z.payload.gameId).toBe('cloudberry');
    });
    it('refuses more node items than REACHABLE check slots', () => {
        expect(() => instantiateCloudberryLibraryEntryForSpecs(byId('cb_moving'), {
            exitSides: [], locationSpecs: [{ item: 'a' }, { item: 'b' }], entryGate: [],
        })).toThrow(/1 check slot\(s\) reachable with \[\] \(of 2\)/);
        // Outside sphere growth (no entry gate: the APWorld editor) every slot counts.
        expect(() => instantiateCloudberryLibraryEntryForSpecs(byId('cb_moving'), {
            exitSides: [], locationSpecs: [{ item: 'a' }, { item: 'b' }, { item: 'c' }],
        })).toThrow(/2 check slot\(s\) but the node needs 3/);
    });
    it('places node items only on slots the entry gate reaches; a held item opens its pieces', () => {
        const none = instantiateCloudberryLibraryEntryForSpecs(byId('cb_moving'), {
            exitSides: [], locationSpecs: [{ item: 'X' }], fillerItem: 'F', entryGate: [],
        });
        // The coin behind Moving Blocks is no location in this slot (an ordinary coin): only one check.
        expect(none.locations.map((l) => l.item)).toEqual(['X']);
        expect(Object.keys(none.payload.params.checks)).toEqual(['coin38']);
        const held = instantiateCloudberryLibraryEntryForSpecs(byId('cb_moving'), {
            exitSides: [], locationSpecs: [{ item: 'X' }, { item: 'Y' }], fillerItem: 'F', entryGate: ['Moving Blocks'],
        });
        expect(held.locations.map((l) => l.item)).toEqual(['X', 'Y']);
    });
    it('the entrance side is the start door\'s free way back; forward sides keep the end door\'s S_last', () => {
        const z = instantiateCloudberryLibraryEntryForSpecs(byId('cb_moving'), {
            exitSides: ['W', 'E'], entranceSide: 'W', locationSpecs: [],
        });
        expect(z.exitPaths.W).toEqual([{ obstacles: [] }]);
        expect(z.exitPaths.E[0].obstacles).toEqual(['cloudberry_gate_MovingBlock']);
    });
});

describe('libraryEntryRefusal (sphere slots, P3a)', () => {
    const fits = (e, ctx) => cloudberryLibraryEntryRefusal(e, ctx) === null;
    const L = (n) => Array.from({ length: n }, () => ({ item: 'X' }));
    it('is the registry entry\'s hook', () => {
        expect(entry.libraryEntryRefusal).toBe(cloudberryLibraryEntryRefusal);
    });
    it('a forward exit\'s gate (with the entry gate) must hold S_last', () => {
        const e = byId('cb_falling_cloud');   // ∅ → FallingBlock → +Cloud
        expect(fits(e, { exitPlans: [{ side: 'E', gate: ['Falling Blocks'] }] })).toBe(true);   // not a sphere ctx
        expect(cloudberryLibraryEntryRefusal(e, { entryGate: [], exitPlans: [{ side: 'E', gate: ['Falling Blocks'] }] }))
            .toMatch(/end door needs \[Clouds\], which the E exit's gate \[Falling Blocks\]/);
        expect(fits(e, { entryGate: [], exitPlans: [{ gate: ['Falling Blocks', 'Clouds'] }] })).toBe(true);
        expect(fits(e, { entryGate: ['Clouds'], exitPlans: [{ gate: ['Falling Blocks'] }] })).toBe(true);
        expect(fits(e, { entryGate: [], exitPlans: [] })).toBe(true);   // a leaf: no forward exit
    });
    it('the node\'s locations need that many slots reachable with the entry gate', () => {
        const e = byId('cb_moving');           // ∅ → MovingBlock; one check per piece
        expect(fits(e, { entryGate: [], locationSpecs: L(1) })).toBe(true);
        expect(fits(e, { entryGate: [], locationSpecs: L(2) })).toBe(false);
        expect(fits(e, { locationSpecs: L(2) })).toBe(true);   // the editor: every slot counts
        expect(fits(e, { entryGate: ['Moving Blocks'], locationSpecs: L(2) })).toBe(true);
    });
    it('a Jetpack-hero level needs Jetpack held to reach any slot', () => {
        const e = byId('cb_jetpack_flyblob');
        expect(fits(e, { entryGate: [], locationSpecs: L(1) })).toBe(false);
        expect(fits(e, { entryGate: ['Jetpack'], locationSpecs: L(1) })).toBe(true);
    });
});

describe('loop mode (P3b): a summary substrate on the page\'s game clock', () => {
    it('declares what loops reads: summary capture, the page\'s bot as solver, Playback, the play clock', () => {
        const ls = entry.loopSupport;
        expect(captureShapeOf(entry)).toBe('summary');
        expect(solverKindOf(entry)).toBe('walkTo');
        expect(offersPlayback(entry)).toBe(true);
        expect(ls.record && ls.playback && ls.instant).toBe(true);
        // the time drain is charged per GAME second the page reports (setPlayClock), never wall seconds
        expect(ls.playClock).toBe(true);
        expect([...ls.queueActions].sort()).toEqual(['locationCheck', 'regionMove']);
        // the bot walks in real time; Instant is a summary Playback's, not the Bot's
        expect(botHonorsInstant(entry)).toBe(false);
        // no recorder of its own: a summary is loops' capture (one channel per visit)
        expect(entry.takeLastRecording).toBeUndefined();
    });

    it('the committed preset\'s generated loop_costs price every Cloudberry region by TIME', () => {
        expect(classifyRegion('cloudberry')).toBe(REGION_CLASS.SUMMARY);
        const dir = join(dirname(fileURLToPath(import.meta.url)),
            '../../presets/cloudberry_sphere_worldgen/AP_14089154938208861744/AP_14089154938208861744_');
        const rulesJson = JSON.parse(readFileSync(`${dir}rules.json`, 'utf8'));
        const sphereLog = readFileSync(`${dir}sphere_log.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
        const costs = generateLoopCosts({ rulesJson, sphereLog, sourceFileName: 'cloudberryLibrary.test' });
        for (const region of ['region_2_2', 'region_2_3', 'region_3_3']) {
            expect(costs.regions[region]).toEqual({ timeDrainPerSecond: 1, xpEffect: 'cost' });
        }
        // a summary action is never charged the coarse defaults (it would pay twice): no per-location cost
        expect(costs.locations).toEqual({});
    });
});
