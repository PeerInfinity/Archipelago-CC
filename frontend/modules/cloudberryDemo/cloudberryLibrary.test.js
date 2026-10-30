import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateRegionLibrary } from '../procgenPipeline/regionLibraryValidator.js';
import {
    substrateRegistryEntry as entry, instantiateCloudberryLibraryEntry, instantiateCloudberryLibraryEntryForSpecs,
    validateCloudberryLibraryEntry, captureCloudberryLibraryEntry,
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
        expect(r.extracted_rules.locations.map((l) => l.item)).toEqual(['Falling Blocks', 'Clouds', null]);
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
    it('refuses more node items than check slots', () => {
        expect(() => instantiateCloudberryLibraryEntryForSpecs(byId('cb_moving'), {
            exitSides: [], locationSpecs: [{ item: 'a' }, { item: 'b' }, { item: 'c' }],
        })).toThrow(/2 check slot/);
    });
});

describe('the entry\'s world round trip', () => {
    it('deserializeWorld adds the page\'s exits/sidePortals/entrySide; serializeWorld strips them', () => {
        const r = instantiateCloudberryLibraryEntry(byId('cb_moving'), { region_id: 'r', exitSides: ['E', 'W'] });
        const payload = { ...r.playable_payload, params: { ...r.playable_payload.params, backExitSide: 'W' }, exits: [...r.exits.values()] };
        const world = entry.deserializeWorld(payload);
        expect(world.params.exits.map((e) => e.side)).toEqual(['east', 'west']);
        expect(world.params.entrySide).toBe('west');
        const out = entry.serializeWorld(world);
        expect(Object.keys(out.params).sort()).toEqual(['backExitSide', 'checks', 'docSha256', 'generate', 'items', 'payload']);
    });
});
