/**
 * The Noiz2sa registry entry (`noiz2saSubstrateLibrary.js`): what it declares, the payload ↔ world round trip
 * the flash bridge depends on, the zone table, and the committed `noiz2sa_substrate_test` preset against all
 * of it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { sidecarFieldsOf, sidecarPayloadErrors, validateSidecarFields } from '../procgenCore/sidecarFields.js';
import { captureShapeOf } from '../procgenCore/substratePredicates.js';
import {
    substrateRegistryEntry, NOIZ2SA_ZONES, NOIZ2SA_VICTORY_ITEM_NAME, NOIZ2SA_FILLER_ITEM_NAME,
    NOIZ2SA_LOAD_REGION_EVENT, NOIZ2SA_IFRAME_ID, zoneRegion, exitButtonsOf, describeRegion, setPlaybackProxy,
} from './noiz2saSubstrateLibrary.js';
import { solverKindOf, botHonorsInstant, moveIncludesCheck } from '../procgenCore/substratePredicates.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PRESET = 'frontend/presets/noiz2sa_substrate_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const entry = substrateRegistryEntry;

describe('the registry entry', () => {
    it('registers on import, as `noiz2sa`, on its own iframe and load event', () => {
        expect(substrateRegistry.get('noiz2sa')).toBe(entry);
        expect(entry.loadRegionEvent).toBe(NOIZ2SA_LOAD_REGION_EVENT);
        expect(entry.iframeId).toBe(NOIZ2SA_IFRAME_ID);
    });
    it('is a SUMMARY substrate with runner\'s loop declarations, the Bot included (N4)', () => {
        expect(captureShapeOf(entry)).toBe('summary');
        expect(entry.loopSupport).toMatchObject({
            manual: true, record: true, playback: true, instant: true, summaryRecording: true, playClock: true,
            executeVia: 'solver',
        });
        expect(entry.takeLastRecording).toBeUndefined();
        expect(entry.loopSupport.requiresLoopMode).toBeUndefined(); // playable outside loop mode
    });
    it('N4b: the move is the only queue action, and the check rides on it (moveIncludesCheck)', () => {
        expect(entry.loopSupport.queueActions).toEqual(['regionMove']);
        expect(moveIncludesCheck(entry)).toBe(true);
    });
    it('the Bot is the walkTo solver, through the injected proxy (null headless); Bot × Instant stays NO', () => {
        expect(solverKindOf(entry)).toBe('walkTo');
        expect(botHonorsInstant(entry)).toBe(false);
        expect(entry.getPlaybackController()).toBeNull();
        const proxy = { walkTo() {} };
        setPlaybackProxy(proxy);
        try {
            expect(entry.getPlaybackController()).toBe(proxy);
        } finally {
            setPlaybackProxy(null);
        }
    });
    it('declares a valid payload', () => {
        expect(() => validateSidecarFields(entry.sidecarFields)).not.toThrow();
    });
});

describe('payload ↔ world', () => {
    const payload = {
        gameId: 'noiz2sa', start: { stage: 0, scene: 1 }, end: { stage: 0, scene: 2 }, seed: 1,
        ap_locations: { clear: 'r__clear' },
        exits: [{ exit_id: 'exit_S', side: 'S', exitName: 'exit_S', targetRegion: 'r2' }],
        fogEnabled: true,
    };
    it('deserializeWorld: exits as a Map, and the region + exit list in params (all the bridge forwards)', () => {
        const w = entry.deserializeWorld(payload);
        expect(w.exits).toBeInstanceOf(Map);
        expect(w.exits.get('exit_S').targetRegion).toBe('r2');
        expect(w.params).toEqual({
            start: { stage: 0, scene: 1 }, end: { stage: 0, scene: 2 }, seed: 1,
            exits: [{ exitName: 'exit_S', side: 'S', targetRegion: 'r2' }],
            walkToExits: 'byName', // the bridge resolves a bot walk to an exit by its name
        });
        expect(w.ap_locations).toEqual({ clear: 'r__clear' });
    });
    it('deserializeWorld refuses a malformed span (the warehouse skips the region)', () => {
        expect(() => entry.deserializeWorld({ ...payload, end: { stage: 0, scene: 0 } })).toThrow(/before its start/);
        expect(() => entry.deserializeWorld({ ...payload, start: undefined })).toThrow(/segment start/);
    });
    it('serializeWorld inverts it: params dropped (derived), exits back to the array', () => {
        expect(entry.serializeWorld(entry.deserializeWorld(payload))).toEqual(payload);
    });
    it('exitButtonsOf skips nameless exits', () => {
        expect(exitButtonsOf([{ side: 'N' }, { exit_id: 'x', side: 'E' }])).toEqual([{ exitName: 'x', side: 'E', targetRegion: null }]);
    });
});

describe('the zone table', () => {
    it('every zone is a valid span on seed 1', () => {
        expect(entry.zoneCount).toBe(NOIZ2SA_ZONES.length);
        const shapes = NOIZ2SA_ZONES.map((_, i) => describeRegion(zoneRegion(i)));
        expect(shapes).toEqual(['1:1 (seed 1)', '1:2–1:3 (seed 1)', '1:boss–2:1 (seed 1)']);
    });
    it('extractZoneRules: one clear location per region, Victory on the last; the payload is declared', () => {
        const last = NOIZ2SA_ZONES.length - 1;
        for (let i = 0; i <= last; i++) {
            const z = entry.extractZoneRules(i, { region_id: `r${i}` });
            expect(z.locations).toEqual([{ id: 'clear', item: i === last ? NOIZ2SA_VICTORY_ITEM_NAME : NOIZ2SA_FILLER_ITEM_NAME, position: null }]);
            expect(z.payload).toEqual({ gameId: 'noiz2sa', ...zoneRegion(i), ap_locations: { clear: `r${i}__clear` } });
        }
        expect(entry.libraryItems[NOIZ2SA_VICTORY_ITEM_NAME].is_victory).toBe(true);
    });
});

describe('the committed noiz2sa_substrate_test preset', () => {
    const rules = JSON.parse(readFileSync(join(REPO, PRESET), 'utf8'));
    const sidecars = Object.entries(rules.preset_sidecars['1']);
    it('has one Noiz2sa region per zone, each payload clean against the declaration', () => {
        expect(sidecars.map(([, sc]) => sc.substrate)).toEqual(NOIZ2SA_ZONES.map(() => 'noiz2sa'));
        const fields = sidecarFieldsOf(entry);
        for (const [, sc] of sidecars) {
            expect(sidecarPayloadErrors(fields, sc.playable_payload)).toEqual([]);
            expect(() => entry.deserializeWorld(sc.playable_payload)).not.toThrow();
        }
    });
    it('prices its regions by time (loop_costs, write-by-class) and starts in a Noiz2sa region', () => {
        for (const [regionId] of sidecars) {
            expect(rules.loop_costs['1'].regions[regionId]).toMatchObject({ timeDrainPerSecond: 1 });
        }
        expect(rules.regions['1'].Menu.exits.map((e) => e.connected_region)).toContain('region_0_0');
        expect(rules.preset_sidecars['1'].region_0_0.playable_payload.start).toEqual({ stage: 0, scene: 0 });
    });
});
