import { describe, it, expect } from 'vitest';

import { SphereState } from './sphereState.js';

// A minimal incremental-format log: metadata header + two state_updates.
const LOG = [
    JSON.stringify({
        type: 'metadata', seed: 1, seed_name: 'sn',
        event_locations: { 1: ['Chalice Home'] }, event_items: { 1: ['Victory'] },
    }),
    JSON.stringify({
        type: 'state_update', sphere_index: '0',
        player_data: { 1: {
            new_inventory_details: { base_items: {}, resolved_items: {} },
            new_accessible_regions: ['Menu', 'Overworld'],
        } },
    }),
    JSON.stringify({
        type: 'state_update', sphere_index: '0.1',
        player_data: { 1: {
            new_inventory_details: { base_items: { Sword: 1 }, resolved_items: { Sword: 1 } },
            new_accessible_regions: [],
        } },
    }),
].join('\n');

describe('SphereState metadata retention', () => {
    it('keeps the metadata header out of rawData but available via getters', () => {
        const s = new SphereState(null);
        s.parseSphereLog(LOG);

        // rawData stays state_update-only (the per-sphere loops never see metadata).
        expect(s.rawData.every((e) => e.type === 'state_update')).toBe(true);
        expect(s.rawData.length).toBe(2);

        // The metadata entry is preserved verbatim.
        expect(s.getLogMetadata()).toEqual({
            type: 'metadata', seed: 1, seed_name: 'sn',
            event_locations: { 1: ['Chalice Home'] }, event_items: { 1: ['Victory'] },
        });
    });

    it('getRawLogWithMetadata reassembles canonical [metadata, ...state_updates] order', () => {
        const s = new SphereState(null);
        s.parseSphereLog(LOG);
        const full = s.getRawLogWithMetadata();
        expect(full[0].type).toBe('metadata');
        expect(full.slice(1)).toEqual(s.rawData);
        expect(full.length).toBe(3);
    });

    it('returns an empty array when no log is loaded', () => {
        const s = new SphereState(null);
        expect(s.getRawLogWithMetadata()).toEqual([]);
        expect(s.getLogMetadata()).toBeNull();
    });

    it('omits the header gracefully when a log has no metadata entry', () => {
        const s = new SphereState(null);
        const noMeta = LOG.split('\n').slice(1).join('\n'); // drop the metadata line
        s.parseSphereLog(noMeta);
        expect(s.getLogMetadata()).toBeNull();
        const full = s.getRawLogWithMetadata();
        expect(full.every((e) => e.type === 'state_update')).toBe(true);
        expect(full).toEqual(s.rawData);
    });
});
