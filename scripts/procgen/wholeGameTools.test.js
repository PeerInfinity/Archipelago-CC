/**
 * ⛓ The whole-game tools (slice tile-primitives-whole-game-tools): the cheap half of two CI-sized probes.
 *   - `probe-seedling-whole-game-certify.mjs` compiles all 115 levels and certifies them on a runner (~45 s); here only its
 *     argv, its shard split, its merge, and the old arm's source rewrite — the one that breaks SILENTLY when the
 *     certifier's `internalOnly` line is edited (the probe then throws on CI, after the whole build).
 *   - `probe-seedling-l3-water-door.mjs` drives the wasm; here only its two tapes (they must parse and differ ONLY by the
 *     Conch) and how it reads a run.
 * The measurements themselves (whole game 31 / 6 / 0 at e3efad7ef5; L3 dry 0/3, wet 3/3) live on CI, not here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { parseArgs, needsOldCert, oldFramingSource, shardRegions, mergeArm, OLD_FRAMING_HOOK } from './probe-seedling-whole-game-certify.mjs';
import { l3Tapes, readRun, expectL3, DOOR_TO } from './probe-seedling-l3-water-door.mjs';
import { PIN_NAMES, parseTape } from '../../frontend/modules/seedlingDemo/tapeFormat.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CERT_SRC = readFileSync(`${ROOT}frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js`, 'utf8');

describe('probe-seedling-whole-game-certify — argv', () => {
    it('defaults: 4 shards, both arms, the seedling-probe artifact dir', () => {
        expect(parseArgs(['node', 'x'])).toEqual({ shards: 4, out: 'test-results/seedling-probe', arms: ['new', 'old'] });
    });
    it('reads --shards / --arms / --out', () => {
        expect(parseArgs(['node', 'x', '--shards=2', '--arms=new', '--out=o'])).toEqual({ shards: 2, out: 'o', arms: ['new'] });
    });
    it('refuses a bad shard count or an unknown arm', () => {
        expect(() => parseArgs(['node', 'x', '--shards=0'])).toThrow(/--shards/);
        expect(() => parseArgs(['node', 'x', '--shards=two'])).toThrow(/--shards/);
        expect(() => parseArgs(['node', 'x', '--arms=new,stricter'])).toThrow(/stricter/);
    });
});

describe('probe-seedling-whole-game-certify — the old arm', () => {
    it('the hook is present exactly once in the certifier on the tree', () => {
        expect(CERT_SRC.split(OLD_FRAMING_HOOK).length - 1).toBe(1);
    });
    it('rewrites internalOnly to answer false, and only there', () => {
        const out = oldFramingSource(CERT_SRC);
        expect(out).toContain(`${OLD_FRAMING_HOOK} if (true) return false;`);
        expect(out.length - CERT_SRC.length).toBe(' if (true) return false;'.length);
    });
    it('the scratch certifier is written only when the old arm runs', () => {
        expect(needsOldCert(parseArgs(['node', 'x']).arms)).toBe(true);
        expect(needsOldCert(parseArgs(['node', 'x', '--arms=new']).arms)).toBe(false);
        expect(needsOldCert(parseArgs(['node', 'x', '--arms=old']).arms)).toBe(true);
    });
    it('a stranded scratch certifier is gitignored', () => {
        expect(readFileSync(`${ROOT}.gitignore`, 'utf8').split('\n')).toContain('*.oldframing.tmp.js');
    });
    it('throws (does not silently measure the new framing twice) when the hook moved', () => {
        expect(() => oldFramingSource(CERT_SRC.replace(OLD_FRAMING_HOOK, 'const internalOnly = (w, n) => {'))).toThrow(/hook moved/);
    });
});

describe('probe-seedling-whole-game-certify — shards and merge', () => {
    const names = ['level_1__a', 'level_1__b', 'level_2__a', 'level_3__a', 'level_10__a'];
    it('every region lands in exactly one shard, whole levels together', () => {
        const parts = [0, 1].map((i) => shardRegions(names, i, 2));
        expect(parts.flatMap((p) => p.regions).sort()).toEqual([...names].sort());
        for (const p of parts) for (const r of p.regions) expect(p.levels).toContain(r.split('__')[0]);
        expect(parts[0].levels.filter((l) => parts[1].levels.includes(l))).toEqual([]);
    });
    it('dedupes across shards, splits problems by direction, counts clean levels', () => {
        const parts = [
            { shard: 0, problems: ['level_1__a → x: derived true, atlas false', 'level_2__a z'], accepted: [{ label: 'L', source: 's', by: 'b', extra: 1 }], lines: ['l1'] },
            { shard: 1, problems: ['level_1__a → x: derived true, atlas false', 'level_1__b → y (landing 3,3): derived false, atlas true'], accepted: [{ label: 'L', source: 's', by: 'b' }], lines: ['l1', 'l2'] },
            { shard: 2, problems: [], accepted: [], lines: [], threw: 'boom' },
        ];
        const m = mergeArm(parts, new Set(['level_1', 'level_2', 'level_3']));
        expect(m.problems).toHaveLength(3);
        expect([m.looser, m.stricter]).toEqual([1, 1]);
        expect(m.accepted).toEqual([{ label: 'L', source: 's', by: 'b' }]);
        expect(m.lines).toEqual(['l1', 'l2']);
        expect(m.threw).toEqual(['shard 2: boom']);
        expect([m.clean, m.levels]).toEqual([1, 3]);
    });
});

describe('probe-seedling-l3-water-door — tapes and reading', () => {
    const tapes = l3Tapes();
    it('both tapes parse, and differ only by the Conch grant', () => {
        for (const raw of Object.values(tapes)) expect(() => parseTape({ ...raw, pins: [...PIN_NAMES] })).not.toThrow();
        const strip = ({ name, description, grants, ...rest }) => rest;
        expect(strip(tapes.dry)).toEqual(strip(tapes.wet));
        expect(tapes.dry.grants).toEqual([]);
        expect(tapes.wet.grants).toEqual([{ level: 3, items: ['conch'] }]);
    });
    it('reads the door off the levels a run visited; only the wet control is expected to reach it', () => {
        const ticks = [{ t: 0, level: 3, x: 32, y: 64 }, { t: 1, level: 3, x: 20, y: 64 }, { t: 2, level: DOOR_TO, x: 5, y: 5 }];
        const r = readRun(ticks, { hits: 0 });
        expect([r.reachedDoor, r.minX3, r.levels]).toEqual([true, 20, [3, DOOR_TO]]);
        const dry = readRun(ticks.slice(0, 2), null);
        expect([dry.reachedDoor, dry.hits]).toEqual([false, null]);
        expect(expectL3('wet', dry)).toBe(false);
        expect(expectL3('dry', dry)).toBe(true);
    });
});
