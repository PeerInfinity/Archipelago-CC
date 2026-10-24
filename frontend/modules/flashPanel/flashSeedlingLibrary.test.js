import { describe, it, expect } from 'vitest';

import {
    substrateRegistryEntry,
    FLASH_SEEDLING_SUBSTRATE_ID,
    FLASH_SEEDLING_LOAD_REGION_EVENT,
} from './flashSeedlingLibrary.js';
import { createFlashSubstrateEntry } from '../flashSubstrate/flashSubstrateLibrary.js';
import { substrateRegistryEntry as flashSeedlingGenEntry } from './flashSeedlingGenLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { substrateIdFor } from '../procgenPipeline/regionAtlasCompiler.js';
import { captureShapeOf, solverKindOf } from '../procgenCore/substratePredicates.js';

// The factory's bare shape, built here and never registered — the registry has
// no generic `flash` entry (⚖ user, 2026-10-18: "isn't really a substrate").
const genericFlashEntry = createFlashSubstrateEntry({ id: 'flash_factory_probe' });

describe('flash_seedling substrate entry', () => {
    it('registers itself on import — headless callers get it from the import alone', () => {
        expect(substrateRegistry.has(FLASH_SEEDLING_SUBSTRATE_ID)).toBe(true);
        expect(substrateRegistry.get(FLASH_SEEDLING_SUBSTRATE_ID)).toBe(substrateRegistryEntry);
    });

    it('uses the id the compiler stamps into the sidecars', () => {
        expect(substrateRegistryEntry.id).toBe(substrateIdFor('seedling'));
    });

    it('renders in the flashPanel panel with its OWN load event', () => {
        // It is driven by flashPanel's WasmBridgeAdapter, not by the shared
        // flashSubstrate bridge — which speaks a different dialect and would
        // be a second AP<->game translation (ruling 2, 2026-07-27).
        expect(substrateRegistryEntry.panelComponentType).toBe('flashPanel');
        expect(substrateRegistryEntry.loadRegionEvent).toBe(FLASH_SEEDLING_LOAD_REGION_EVENT);
        expect(substrateRegistryEntry.loadRegionEvent).not.toBe(genericFlashEntry.loadRegionEvent);
    });

    it('claims no iframeAdapter id — the flashPanel embed never announces appReady', () => {
        expect(substrateRegistryEntry.iframeId).toBeUndefined();
    });

    it('inherits the flash family runtime plumbing unchanged', () => {
        expect(substrateRegistryEntry.supportedFeatures).toEqual(['arbitrary_ap_locations']);
        // ⛓ Seedling JS J3: the Playback Bot's controller (injected by the panel; null headless).
        expect(substrateRegistryEntry.getPlaybackController()).toBeNull();
        expect(substrateRegistryEntry.generateRegionCore).toBeUndefined();
    });

    it('⛓ SEEDLING LOOP MODE: a Loops Bot block walks it (executeVia solver), the factory default shape does not', () => {
        // The Seedling truth: the walkTo solver on the factory's manual-play base,
        // over exits AND locations (⚖ user 2026-10-11: a queued check is a solver walk).
        expect(substrateRegistryEntry.loopSupport).toMatchObject({
            executeVia: 'solver', manual: true, customQueues: false,
        });
        expect([...substrateRegistryEntry.loopSupport.queueActions]).toEqual(['regionMove', 'locationCheck']);
        // No Record/Playback/Instant claim.
        expect(substrateRegistryEntry.loopSupport.instant ?? false).toBe(false);
        // ⛔ Declared on THIS entry, never on the factory: the generic entry (and every
        // other flash game built on it) keeps the manual-only shape.
        expect(genericFlashEntry.loopSupport.executeVia).toBeUndefined();
        expect(genericFlashEntry.loopSupport.playClock).toBeUndefined();
        expect([...genericFlashEntry.loopSupport.queueActions]).toEqual(['regionMove']);
    });

    it('⛓ PLAY CLOCK (⚖ "Drain play time too"): it declares playClock, so Loops drains its coarse regions per GAME second', () => {
        // The host reports the game's own clock (`seedlingPlayClock.js`); `loopState._regionDrainsTime` reads this flag.
        expect(substrateRegistryEntry.loopSupport.playClock).toBe(true);
        // Beside §5.63's executeVia; the factory's default shape declares none (the generated entry: the block below).
        expect(substrateRegistryEntry.loopSupport.executeVia).toBe('solver');
        expect(genericFlashEntry.loopSupport.playClock).toBeUndefined();
    });

    describe('⛓ GENERATED ROOMS IN LOOP MODE: flash_seedling_gen declares what flash_seedling does', () => {
        /**
         * What Loops reads off an entry, each through Loops' own reader: `regionSolver`'s half (solverKindOf),
         * `_shouldBotExecuteCurrentAction`'s queueActions gate for a check, and `_regionDrainsTime` (a COARSE
         * capture shape that declares playClock). Each fact names the declaration it rests on.
         */
        const loopFacts = (entry) => ({
            executeVia: solverKindOf(entry) === 'walkTo',
            locationCheck: !!entry.loopSupport?.queueActions?.includes('locationCheck'),
            playClock: captureShapeOf(entry) === 'coarse' && entry.loopSupport?.playClock === true,
        });
        const ALL = { executeVia: true, locationCheck: true, playClock: true };

        it('a Bot block walks a generated room, a queued check is walked, and its play time drains', () => {
            expect(loopFacts(flashSeedlingGenEntry)).toEqual(ALL);
            expect(loopFacts(substrateRegistryEntry)).toEqual(ALL);
            // The same loopSupport, field for field — one declaration, two entries.
            expect({ ...flashSeedlingGenEntry.loopSupport, queueActions: [...flashSeedlingGenEntry.loopSupport.queueActions] })
                .toEqual({ ...substrateRegistryEntry.loopSupport, queueActions: [...substrateRegistryEntry.loopSupport.queueActions] });
            // The controller the Bot block drives is the entry's own (null headless; flashPanel injects it).
            expect(typeof flashSeedlingGenEntry.getPlaybackController).toBe('function');
        });

        // ⛓ MUTANTS — each declaration dropped from the generated entry turns exactly its own fact red, by name.
        for (const [key, drop] of [
            ['executeVia', ({ executeVia: _x, ...rest }) => rest],
            ['locationCheck', (ls) => ({ ...ls, queueActions: ['regionMove'] })],
            ['playClock', ({ playClock: _x, ...rest }) => rest],
        ]) {
            it(`mutant: ${key} dropped → only "${key}" is lost`, () => {
                const mutant = { ...flashSeedlingGenEntry, loopSupport: drop(flashSeedlingGenEntry.loopSupport) };
                expect(loopFacts(mutant)).toEqual({ ...ALL, [key]: false });
            });
        }
    });

    it('round-trips an atlas payload, keying exits on the AP exit name', () => {
        const payload = {
            gameId: 'seedling',
            atlas_ref: 'seedling-abc',
            atlas_region: 'starting_house',
            level: 86,
            tile_size: 16,
            exits: [{
                exit_id: 'door',
                exitName: 'starting_house -> overworld_start',
                targetRegion: 'overworld_start',
                targetExitId: 'house_door',
                target_level: 0,
                target_spawn: { x: 160, y: 272 },
                entrance_spawn: { x: 48, y: 64 },
            }],
        };
        const world = substrateRegistryEntry.deserializeWorld(payload);
        expect(world.exits).toBeInstanceOf(Map);
        expect(world.exits.has('starting_house -> overworld_start')).toBe(true);
        // The atlas block rides through deserializeWorld untouched — the flash
        // deserializer spreads unknown payload keys.
        expect(world.level).toBe(86);
        expect(world.atlas_region).toBe('starting_house');
        expect(world.atlas_ref).toBe('seedling-abc');
        expect(substrateRegistryEntry.serializeWorld(world)).toEqual(payload);
    });
});
