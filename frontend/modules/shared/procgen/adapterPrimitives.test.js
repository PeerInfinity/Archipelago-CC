import { describe, it, expect } from 'vitest';

import {
    spatialCore,
    itemBasedPlacer,
    ruleGatePlacer,
    tileGridPathExtractor,
    tileGridDeserializer,
    tileGridSerializer,
} from './adapterPrimitives.js';
import {
    generateRegionCore,
    placeFromItems,
    placeFromRules,
    extractPathsAndObstacles,
    deserializeMazeWorld,
} from '../../mazeRoom/mazeRoomEngine.js';
import { serializeMazeWorld } from '../../procgenPipeline/procgenPipelineEngine.js';

// The adapter-primitives catalog is the substrate-neutral surface
// that registry entries compose from. Confirming each export resolves
// to the right underlying implementation guards against silent
// renames or wiring mistakes — substrates depend on these handles
// staying stable, and the registry-by-id dispatch in the procgen
// pipeline trusts the catalog to mean what it says.

describe('adapterPrimitives', () => {
    it('exposes spatialCore as the maze generateRegionCore', () => {
        expect(spatialCore).toBe(generateRegionCore);
    });

    it('exposes itemBasedPlacer as the maze placeFromItems', () => {
        expect(itemBasedPlacer).toBe(placeFromItems);
    });

    it('exposes ruleGatePlacer as the maze placeFromRules', () => {
        expect(ruleGatePlacer).toBe(placeFromRules);
    });

    it('exposes tileGridPathExtractor as the maze extractPathsAndObstacles', () => {
        expect(tileGridPathExtractor).toBe(extractPathsAndObstacles);
    });

    it('exposes tileGridDeserializer as the maze deserializeMazeWorld', () => {
        expect(tileGridDeserializer).toBe(deserializeMazeWorld);
    });

    it('exposes tileGridSerializer as the pipeline serializeMazeWorld', () => {
        expect(tileGridSerializer).toBe(serializeMazeWorld);
    });
});
