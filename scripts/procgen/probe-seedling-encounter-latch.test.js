/**
 * The encounter-latch probe's PURE helpers (the probe itself drives the wasm game and runs only by hand or in
 * `seedling-probe.yml`): the counted classes read off `Game.totalEnemies()`, the tile BFS, and one step of the
 * CLEAR arm's closed loop.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { armFlags, clearStep, conditionHolds, countedClassesFromSource, tilePath } from './probe-seedling-encounter-latch.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME_AS = join(REPO, 'vendor/seedling/src/Game.as');

describe('countedClassesFromSource', () => {
    it('reads the classCount terms of totalEnemies, skipping commented ones and other functions', () => {
        const src = `public function other():int { return classCount(Coin); }
        public function totalEnemies():int
        {
            //return typeCount("Enemy") + classCount(Ghost);
            return classCount(Spinner) +
                   classCount(Jellyfish) + classCount(Enemy);
        }
        public function after():void { classCount(IceTrap); }`;
        expect(countedClassesFromSource(src)).toEqual(['Enemies::Enemy', 'Enemies::Jellyfish', 'Enemies::Spinner']);
    });
    it('is null with no totalEnemies', () => {
        expect(countedClassesFromSource('')).toBeNull();
        expect(countedClassesFromSource(undefined)).toBeNull();
    });
    it.skipIf(!existsSync(GAME_AS))('on the real source: the kill-lock classes are counted and IceTrap is not', () => {
        const got = countedClassesFromSource(readFileSync(GAME_AS, 'utf8'));
        for (const c of ['Spinner', 'Jellyfish', 'Puncher']) expect(got).toContain(`Enemies::${c}`);
        expect(got).not.toContain('Enemies::IceTrap');
    });
});

describe('tilePath', () => {
    const open = (rows) => (x, y) => rows[y]?.[x] === '.';
    it('routes around a wall and returns null when walled off', () => {
        const rows = ['...', '##.', '...'];
        const p = tilePath(3, 3, open(rows), [0, 0], [0, 2]);
        expect(p[0]).toEqual([0, 0]);
        expect(p.at(-1)).toEqual([0, 2]);
        expect(p).toHaveLength(7);
        expect(tilePath(3, 3, open(['.#.', '##.', '...']), [0, 0], [2, 2])).toBeNull();
    });
    it('reaches a goal tile that is itself not passable (a body on a blocked cell)', () => {
        expect(tilePath(2, 1, open(['.#']), [0, 0], [1, 0])).toEqual([[0, 0], [1, 0]]);
    });
});

describe('clearStep', () => {
    const straight = (a, b) => [a, b];
    it('attacks a body inside the slash box: face it for a tick, then primary', () => {
        const s = clearStep({ t: 100, player: { x: 50, y: 50 }, bodies: [{ cls: 'Enemies::Spinner', x: 40, y: 54 }], path: straight });
        expect(s.kind).toBe('attack');
        expect(s.inputs).toEqual([{ key: 'left', from: 100, to: 101 }, { key: 'primary', from: 101, to: 103 }]);
    });
    it('walks toward the nearest body along the path, both axes when diagonal', () => {
        const s = clearStep({ t: 0, player: { x: 24, y: 24 }, bodies: [
            { cls: 'Enemies::Puncher', x: 200, y: 200 }, { cls: 'Enemies::Jellyfish', x: 72, y: 72 }], path: straight });
        expect(s.kind).toBe('move');
        expect(s.target).toBe('Enemies::Jellyfish');
        expect(s.keys).toEqual(['right', 'down']);
    });
    it('presses into the way it was walking when the last move went nowhere', () => {
        const s = clearStep({ t: 8, player: { x: 24, y: 24 }, bodies: [{ cls: 'Enemies::Puncher', x: 200, y: 24 }],
            path: straight, lastMove: { stuck: true, keys: ['right'] } });
        expect(s.kind).toBe('break');
        expect(s.inputs.map((i) => i.key)).toEqual(['right', 'primary']);
    });
});

describe('conditionHolds / armFlags', () => {
    it('reads flag, any and all', () => {
        const f = new Set(['hasSword']);
        expect(conditionHolds({ flag: 'hasSword' }, f)).toBe(true);
        expect(conditionHolds({ any: [{ flag: 'canSwim' }, { flag: 'hasSword' }] }, f)).toBe(true);
        expect(conditionHolds({ all: [{ flag: 'canSwim' }, { flag: 'hasSword' }] }, f)).toBe(false);
        expect(conditionHolds(null, f)).toBe(false);
    });
    // . open, # wall, ~ water (needs canSwim), r a rock the sword breaks; the room is the left column.
    const level = (rows) => {
        const cellAt = (x, y) => ({ '.': { kind: 'open' }, '#': { kind: 'wall' },
            '~': { kind: 'gated', conditions: [{ flag: 'canSwim' }] },
            r: { kind: 'gated', conditions: [{ any: [{ flag: 'hasSword' }, { flag: 'hasSpear' }] }] } })[rows[y]?.[x]];
        return { width: rows[0].length, height: rows.length, cellAt, blocked: () => false, from: [0, 0], base: new Set(['hasSword']) };
    };
    it('asks for the flag of a gate on the only route to a body, and not for one the sword already opens', () => {
        expect(armFlags({ ...level(['.r~.']), bodies: [[3, 0]] })).toEqual(['canSwim']);
        expect(armFlags({ ...level(['.r..']), bodies: [[3, 0]] })).toEqual([]);
    });
    it('asks for nothing when every body is reachable on foot', () => {
        expect(armFlags({ ...level(['....', '~~~~']), bodies: [[3, 0], [2, 0]] })).toEqual([]);
    });
});
