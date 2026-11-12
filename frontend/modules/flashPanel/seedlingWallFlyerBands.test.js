/**
 * `seedlingWallFlyerBands` — the flight bands, read off the committed map through the class's transcription.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wallFlyerBands } from './seedlingWallFlyerBands.js';
import { buildLevelWorld } from '../seedlingDemo/levelWorld.js';
import { WALLFLYER } from '../seedlingDemo/wallFlyer.js';

const MAP = JSON.parse(readFileSync(new URL('./atlases/seedling-map.json', import.meta.url), 'utf8'));
const TILE = MAP.tile_size;
const rooms = MAP.levels.filter((l) => (l.entities ?? []).some((e) => e.type === 'wallflyer'));
const bandsOf = (level) => wallFlyerBands(level, buildLevelWorld(level));

describe('wallFlyerBands', () => {
    it('gives one band per placed wallflyer, and none in a room that holds none', () => {
        expect(rooms.length).toBeGreaterThan(0);
        for (const level of rooms) {
            const placed = level.entities.filter((e) => e.type === 'wallflyer').map((e) => `wallflyer@${e.x},${e.y}`);
            expect(bandsOf(level).map((b) => b.id), `L${level.level}`).toEqual(placed);
        }
        const bare = MAP.levels.find((l) => !(l.entities ?? []).some((e) => e.type === 'wallflyer'));
        expect(bandsOf(bare)).toEqual([]);
    });

    it('every band is one straight run of tiles from the flyer\'s own cell, flown at the class\'s speed along one axis', () => {
        for (const level of rooms) {
            for (const b of bandsOf(level)) {
                const [, x, y] = /@(\d+),(\d+)$/.exec(b.id).map(Number);
                const where = `L${level.level} ${b.id}`;
                expect(b.tiles[0], where).toEqual([x / TILE, y / TILE]);
                expect(Math.hypot(b.launch.x, b.launch.y), where).toBeCloseTo(WALLFLYER.moveSpeed, 9);
                const dx = Math.sign(Math.round(b.launch.x));
                const dy = Math.sign(Math.round(b.launch.y));
                expect(Math.abs(dx) + Math.abs(dy), where).toBe(1);
                b.tiles.forEach((t, i) => expect(t, where).toEqual([b.tiles[0][0] + dx * i, b.tiles[0][1] + dy * i]));
                expect(b.tiles.length, where).toBeGreaterThan(1);
                // The stop is the far end of the same line, against a solid: the body's box sits in the last band tile.
                expect([Math.floor(b.stop.x / TILE), Math.floor(b.stop.y / TILE)], where).toEqual(b.tiles.at(-1));
                expect(dx === 0 ? b.stop.x : b.stop.y, where).toBe(dx === 0 ? b.rest.x : b.rest.y);
            }
        }
    });

    it('two flyers that face each other on one line fly the same tiles; the far one\'s rest is the near one\'s stop', () => {
        const pairs = [];
        for (const level of rooms) {
            const bands = bandsOf(level);
            for (const a of bands) {
                for (const b of bands) {
                    if (a.id < b.id && a.stop.x === b.rest.x && a.stop.y === b.rest.y) pairs.push([a, b]);
                }
            }
        }
        expect(pairs.length).toBeGreaterThan(0);
        for (const [a, b] of pairs) {
            expect([b.stop.x, b.stop.y]).toEqual([a.rest.x, a.rest.y]);
            expect([...b.tiles].reverse()).toEqual(a.tiles);
        }
    });
});
