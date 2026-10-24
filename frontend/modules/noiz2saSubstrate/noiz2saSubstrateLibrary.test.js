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
import { sceneCount } from './noiz2saRegion.js';
import {
    substrateRegistryEntry, NOIZ2SA_ZONES, NOIZ2SA_VICTORY_ITEM_NAME, NOIZ2SA_FILLER_ITEM_NAME,
    NOIZ2SA_LOAD_REGION_EVENT, NOIZ2SA_IFRAME_ID, zoneRegion, exitButtonsOf, describeRegion, setPlaybackProxy,
    zoneLocationPlan, zoneRulesOf,
} from './noiz2saSubstrateLibrary.js';
import { solverKindOf, botHonorsInstant } from '../procgenCore/substratePredicates.js';

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
    it('N4c: the move and the location check are two queue actions; no move+check special case', () => {
        expect(entry.loopSupport.queueActions).toEqual(['regionMove', 'locationCheck']);
        // exactly runner's declarations plus the play clock: no move+check special case (N4b's is removed)
        expect(Object.keys(entry.loopSupport).sort()).toEqual([
            'customQueues', 'executeVia', 'instant', 'manual', 'playClock', 'playback', 'queueActions', 'record',
            'summaryRecording',
        ]);
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
    const move = { start: { stage: 0, scene: 1 }, end: { stage: 0, scene: 2 } };
    const check = { start: { stage: 0, scene: 1 }, end: { stage: 0, scene: 4 } };
    const check2 = { start: { stage: 0, scene: 5 }, end: { stage: 0, scene: 8 } };
    const locations = [{ id: 'check1', check }, { id: 'check2', check: check2 }];
    const payload = {
        gameId: 'noiz2sa', move, seed: 1, locations,
        ap_locations: { check1: 'r__check1', check2: 'r__check2' },
        exits: [{ exit_id: 'exit_S', side: 'S', exitName: 'exit_S', targetRegion: 'r2' }],
        fogEnabled: true,
    };
    it('deserializeWorld: exits as a Map, and the region + exit list in params (all the bridge forwards)', () => {
        const w = entry.deserializeWorld(payload);
        expect(w.exits).toBeInstanceOf(Map);
        expect(w.exits.get('exit_S').targetRegion).toBe('r2');
        expect(w.params).toEqual({
            move, seed: 1, locations,
            exits: [{ exitName: 'exit_S', side: 'S', targetRegion: 'r2' }],
            walkToExits: 'byName', // the bridge resolves a bot walk to an exit by its name
        });
        expect(w.ap_locations).toEqual({ check1: 'r__check1', check2: 'r__check2' });
    });
    it('N4c: a region with no locations; each location keeps its own span; the older shapes are read', () => {
        const none = { ...payload, locations: [], ap_locations: {} };
        expect(sidecarPayloadErrors(sidecarFieldsOf(entry), none)).toEqual([]);
        expect(entry.deserializeWorld(none).params.locations).toEqual([]);
        // a location without its span gets the default one — the same for every location (⚖ "By default, they are the same")
        expect(entry.deserializeWorld({ ...payload, locations: [{ id: 'check1' }, { id: 'check2' }] }).params.locations)
            .toEqual([{ id: 'check1', check }, { id: 'check2', check }]);
        // a stored span wins
        const longer = { start: move.start, end: { stage: 0, scene: 8 } };
        expect(entry.deserializeWorld({ ...payload, locations: [{ id: 'check1', check: longer }] }).params.locations)
            .toEqual([{ id: 'check1', check: longer }]);
        // pre-N4c: {start, end} is the move span, one location per ap_locations key
        const { move: _m, locations: _l, ...rest } = payload;
        const old = { ...rest, ...move, ap_locations: { clear: 'r__clear' } };
        expect(sidecarPayloadErrors(sidecarFieldsOf(entry), old).map((e) => `${e.code} ${e.field}`))
            .toEqual(['MISSING_REQUIRED move', 'MISSING_REQUIRED locations']);
        expect(entry.deserializeWorld(old).params).toMatchObject({ move, seed: 1, locations: [{ id: 'clear', check }] });
    });
    it('deserializeWorld refuses a malformed span (the warehouse skips the region)', () => {
        expect(() => entry.deserializeWorld({ ...payload, move: { ...move, end: { stage: 0, scene: 0 } } })).toThrow(/before its start/);
        expect(() => entry.deserializeWorld({ ...payload, move: undefined })).toThrow(/segment start/);
        expect(() => entry.deserializeWorld({ ...payload, locations: [{ id: 'check1', check: { ...check, end: { stage: 0, scene: 0 } } }] })).toThrow(/before its start/);
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
        expect(shapes).toEqual(['1:1, check1 1:1–1:2 (seed 1)', '1:2–1:3, no location (seed 1)',
            '1:boss–2:1, check1 1:boss–2:3, check2 1:boss–2:3 (seed 1)']);
    });
    it('extractZoneRules: a zone\'s locations (none when it declares none), Victory on the last location; the payload is declared', () => {
        const ids = (z) => z.locations.map((l) => `${l.id}:${l.item}`);
        const z = NOIZ2SA_ZONES.map((_, i) => entry.extractZoneRules(i, { region_id: `r${i}` }));
        expect(z.map(ids)).toEqual([
            [`check1:${NOIZ2SA_FILLER_ITEM_NAME}`], [],
            [`check1:${NOIZ2SA_FILLER_ITEM_NAME}`, `check2:${NOIZ2SA_VICTORY_ITEM_NAME}`],
        ]);
        z.forEach((zr, i) => {
            expect(zr.payload).toEqual({
                gameId: 'noiz2sa', ...zoneRegion(i),
                ap_locations: Object.fromEntries(zr.locations.map((l) => [l.id, `r${i}__${l.id}`])),
            });
            expect(sidecarPayloadErrors(sidecarFieldsOf(entry), { ...zr.payload, exits: [], fogEnabled: true })).toEqual([]);
        });
        expect(zoneRegion(1).locations).toEqual([]); // ⚖ none by default: the zone declares none
        expect(entry.libraryItems[NOIZ2SA_VICTORY_ITEM_NAME].is_victory).toBe(true);
    });
    it('⚖ "Add one location to the last region": a table whose zones declare no location gets one, on its last zone, holding Victory', () => {
        const bare = [{ start: '1:1', end: '1:1' }, { start: '1:2', end: '1:3' }, { start: '1:boss', end: '2:1' }];
        expect(zoneLocationPlan(bare)).toEqual({ counts: [0, 0, 1], victoryZone: 2 });
        const z = bare.map((_, i) => zoneRulesOf(bare, i, { region_id: `r${i}` }));
        expect(z.map((zr) => zr.locations.map((l) => `${l.id}:${l.item}`))).toEqual([[], [], [`check1:${NOIZ2SA_VICTORY_ITEM_NAME}`]]);
        expect(z[2].payload.ap_locations).toEqual({ check1: 'r2__check1' });
        // a table that declares any location keeps its own counts; Victory on the last zone with one
        expect(zoneLocationPlan([{ locations: 2 }, {}])).toEqual({ counts: [2, 0], victoryZone: 0 });
        expect(zoneLocationPlan([])).toEqual({ counts: [], victoryZone: -1 });
    });
});

describe('the committed noiz2sa_substrate_test preset', () => {
    const rules = JSON.parse(readFileSync(join(REPO, PRESET), 'utf8'));
    const sidecars = Object.entries(rules.preset_sidecars['1']);
    it('N4c: one region with one location, one with none, one with two — each location with its own span', () => {
        expect(sidecars.map(([, sc]) => sc.playable_payload.locations.length)).toEqual([1, 0, 2]);
        for (const [regionId, sc] of sidecars) {
            const { move, locations } = sc.playable_payload;
            expect(rules.regions['1'][regionId].locations.map((l) => l.name)).toEqual(locations.map((l) => `${regionId}__${l.id}`));
            locations.forEach((l) => expect(sceneCount(l.check)).toBe(2 * sceneCount(move)));
            if (locations[0]) expect(locations[0].check.start).toEqual(move.start);
        }
    });
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
        expect(rules.preset_sidecars['1'].region_0_0.playable_payload.move.start).toEqual({ stage: 0, scene: 0 });
    });
});
