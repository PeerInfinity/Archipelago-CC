import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
import { reach } from '../shared/simulatorCore.js';
import {
    BIOMES, DEFAULT_BIOME_ID, resolveBiome,
} from './mazeRoomBiomeLibrary.js';
import {
    bfsSolver, createState, reachedExit, generateMaze, getTile,
    TILE_FLOOR, TILE_WALL,
} from './mazeRoomEngine.js';

describe('mazeRoomBiomeLibrary', () => {
    describe('resolveBiome', () => {
        it('returns the default biome when input is null/undefined', () => {
            expect(resolveBiome(null).id).toBe(DEFAULT_BIOME_ID);
            expect(resolveBiome(undefined).id).toBe(DEFAULT_BIOME_ID);
        });

        it('returns a biome by id with no overrides', () => {
            const r = resolveBiome({ id: 'empty' });
            expect(r.id).toBe('empty');
            expect(r.biome).toBe(BIOMES.empty);
            expect(r.params).toEqual({});
        });

        it('layers paramsOverride per-key on top of biome defaults', () => {
            const r = resolveBiome({
                id: 'classic',
                paramsOverride: { foo: 1, bar: 2 },
            });
            expect(r.params).toEqual({ foo: 1, bar: 2 });
        });

        it('throws on unknown biome id', () => {
            expect(() => resolveBiome({ id: 'nope' })).toThrow(/unknown biome/);
        });
    });

    describe('biome → maze generation (round-trip)', () => {
        const sampleSizes = [
            { width: 8, height: 6 },
            { width: 12, height: 10 },
        ];
        const sampleSeeds = [1, 17, 42];

        for (const biomeId of Object.keys(BIOMES)) {
            it(`'${biomeId}' produces a connected maze across sizes/seeds (no fallback)`, () => {
                for (const { width, height } of sampleSizes) {
                    for (const seed of sampleSeeds) {
                        const { world, stats } = generateMaze({
                            width, height, seed,
                            biome: { id: biomeId },
                            params: { placeGateAndKey: false },
                        });
                        // Entrance must be floor.
                        expect(getTile(world, world.entrance.x, world.entrance.y))
                            .toBe(TILE_FLOOR);
                        // Each exit must be floor.
                        for (const exit of world.exits.values()) {
                            expect(getTile(world, exit.x, exit.y)).toBe(TILE_FLOOR);
                        }
                        // BFS-solvable from entrance to exit.
                        const r = reach(world, bfsSolver, createState(world), reachedExit);
                        expect(r.ok).toBe(true);
                        // Stats reflect biome dispatch.
                        expect(stats.biome).toBe(biomeId);
                        expect(stats.usedFallback).toBe(false);
                    }
                }
            });
        }

        it("'empty' produces a maze with zero walls", () => {
            const { world } = generateMaze({
                width: 8, height: 6, seed: 1,
                biome: { id: 'empty' },
                params: { placeGateAndKey: false },
            });
            for (let i = 0; i < world.tiles.length; i++) {
                expect(world.tiles[i]).toBe(TILE_FLOOR);
            }
        });

        it("'corridor' walls at least half the tiles for a small grid", () => {
            const { world } = generateMaze({
                width: 10, height: 8, seed: 1,
                biome: { id: 'corridor' },
                params: { placeGateAndKey: false },
            });
            let walls = 0;
            for (let i = 0; i < world.tiles.length; i++) {
                if (world.tiles[i] === TILE_WALL) walls += 1;
            }
            // 10×8 = 80 tiles. Manhattan path from corner to corner is 17
            // steps → ~18 floor tiles, ~62 walls. Allow a wide margin.
            expect(walls).toBeGreaterThan(world.tiles.length / 2);
        });

        it("'classic' default seed-1 layout matches biome-less generation (back-compat)", () => {
            // Pre-biome callers passed no biome and got the random-walls
            // path. With DEFAULT_BIOME_ID = 'classic' and the classic
            // biome dispatching to random_walls with no extra params,
            // tile-by-tile output must match.
            const a = generateMaze({ width: 8, height: 6, seed: 7 });
            const b = generateMaze({ width: 8, height: 6, seed: 7, biome: { id: 'classic' } });
            expect(Array.from(a.world.tiles)).toEqual(Array.from(b.world.tiles));
        });

        it('determinism across biomes for fixed seed', () => {
            for (const biomeId of Object.keys(BIOMES)) {
                const cfg = {
                    width: 10, height: 8, seed: 5,
                    biome: { id: biomeId },
                    params: { placeGateAndKey: false },
                };
                const a = generateMaze(cfg);
                const b = generateMaze(cfg);
                expect(Array.from(a.world.tiles), `biome=${biomeId}`)
                    .toEqual(Array.from(b.world.tiles));
            }
        });
    });

    it('exposes biome metadata for the panel UI dropdown', () => {
        for (const [id, entry] of Object.entries(BIOMES)) {
            expect(typeof id).toBe('string');
            expect(typeof entry.name).toBe('string');
            expect(typeof entry.description).toBe('string');
            expect(typeof entry.backend).toBe('string');
        }
    });

    it('throws via generateMaze for unknown biome id', () => {
        expect(() => generateMaze({
            width: 8, height: 6, seed: 1, biome: { id: 'nope' },
        })).toThrow(/unknown biome/);
    });
});

// Note: per-backend behavioral tests live in the corresponding
// mazeAlgorithms/*.test.js files. This file covers the biome ↔
// generateMaze contract specifically.
