/**
 * trainShardPlan — every train-tier file lands in exactly one `Train-tier Vitest`
 * shard, so a new `*.train.test.js` cannot silently drop out of CI.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import trainConfig from '../../vitest.train.config.js';
import { checkTrainPartition, loadTrainCosts, parseShardArg, planTrainShards, staleTrainCosts } from './trainShardPlan.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = readFileSync(join(REPO, '.github/workflows/unittests_frontend.yml'), 'utf8');

function trainFilesOnDisk(dir = join(REPO, 'frontend'), out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) trainFilesOnDisk(path, out);
        else if (entry.name.endsWith('.train.test.js')) out.push(relative(REPO, path).replaceAll('\\', '/'));
    }
    return out;
}

const trainJob = () => WORKFLOW.slice(WORKFLOW.indexOf('\n  train-tier:\n'), WORKFLOW.indexOf('\n  headless-gates:\n'));
const matrixLength = () => JSON.parse(/^ {8}shard: (\[.*\])$/m.exec(trainJob())[1]).length;
const assignment = (shards) => Object.fromEntries(shards.flatMap((s) => s.files.map((f) => [f, s.shard])));

describe('the committed train tier', () => {
    const files = trainFilesOnDisk();
    const costs = loadTrainCosts();
    const shards = planTrainShards({ files, costs, bins: matrixLength() });

    it('the walk above collects what vitest.train.config.js collects', () => {
        expect(trainConfig.test.include).toEqual(['frontend/**/*.train.test.js']);
        expect(files.length).toBeGreaterThan(0);
    });

    it('every train file is in exactly one shard of the workflow matrix', () => {
        expect(checkTrainPartition(shards, files)).toEqual([]);
        expect(shards.flatMap((s) => s.files).sort()).toEqual([...files].sort());
    });

    it('every cost row names a real file and every real file has one', () => {
        expect(staleTrainCosts(files, costs)).toEqual([]);
        expect(shards.flatMap((s) => s.unpriced)).toEqual([]);
    });

    it('the workflow runs the planner with the matrix-derived k/N, and stays out of the suite family', () => {
        const job = trainJob();
        expect(job).toContain('node scripts/test/run-train-shard.mjs --shard=${{ matrix.shard }}/${{ strategy.job-total }}');
        expect(job).toMatch(/fail-fast: false/);
    });

    it('package.json keeps the serial train config behind test:unit:train', () => {
        expect(JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts['test:unit:train'])
            .toBe('vitest run --config vitest.train.config.js');
        expect(trainConfig.test.fileParallelism).toBe(false);
    });
});

describe('planTrainShards', () => {
    const costs = { a: 50, b: 40, c: 30, d: 20, e: 10 };
    const files = Object.keys(costs);

    it('packs longest-first into the lightest shard', () => {
        expect(assignment(planTrainShards({ files, costs, bins: 2 }))).toEqual({ a: 1, b: 2, c: 2, d: 1, e: 1 });
    });

    it('does not depend on the order the files were listed in', () => {
        expect(planTrainShards({ files: [...files].reverse(), costs, bins: 3 }))
            .toEqual(planTrainShards({ files, costs, bins: 3 }));
    });

    it('a file with no cost row goes to the lightest shard and moves no priced file', () => {
        const before = assignment(planTrainShards({ files, costs, bins: 2 }));
        const shards = planTrainShards({ files: [...files, 'q'], costs, bins: 2 });
        const { q: placed, ...priced } = assignment(shards);
        expect(priced).toEqual(before);
        /** a+d+e = 80 against b+c = 70, so shard 2 is the lightest. */
        expect(placed).toBe(2);
        expect(shards[1].unpriced).toEqual(['q']);
        expect(checkTrainPartition(shards, [...files, 'q'])).toEqual([]);
    });

    it('several new files are placed in path order, each at the median price', () => {
        const shards = planTrainShards({ files: ['z', 'y'], costs: {}, bins: 2 });
        expect(assignment(shards)).toEqual({ y: 1, z: 1 });
        const priced = planTrainShards({ files: [...files, 'z', 'y'], costs, bins: 2 });
        /** the median of the prices is 30: y joins shard 2 (70 → 100), z then shard 1 (80 → 110). */
        expect(priced.map((s) => s.seconds)).toEqual([110, 100]);
        expect(assignment(priced)).toMatchObject({ y: 2, z: 1 });
    });

    it('refuses a nonsense bin count', () => {
        expect(() => planTrainShards({ files, costs, bins: 0 })).toThrow(/bins/);
    });
});

describe('checkTrainPartition', () => {
    const shard = (n, ...files) => ({ shard: n, files, seconds: 0, unpriced: [] });
    it('names an unassigned file', () => {
        expect(checkTrainPartition([shard(1, 'x/a.js')], ['x/a.js', 'x/b.js'])).toEqual(['unassigned: x/b.js']);
    });
    it('names a doubly assigned file', () => {
        expect(checkTrainPartition([shard(1, 'x/a.js'), shard(2, 'x/a.js')], ['x/a.js']))
            .toEqual(['doubly assigned: x/a.js (shards 1, 2)']);
    });
    it('names an empty shard, which would run the whole tier', () => {
        expect(checkTrainPartition([shard(1, 'x/a.js'), shard(2)], ['x/a.js'])).toEqual(['shard 2 is empty']);
    });
    it('names a file nobody collected', () => {
        expect(checkTrainPartition([shard(1, 'x/a.js', 'x/gone.js')], ['x/a.js'])).toEqual(['assigned but not collected: x/gone.js']);
    });
    it('names a path that vitest\'s substring filter would run twice', () => {
        expect(checkTrainPartition([shard(1, 'a.js'), shard(2, 'x/a.js')], ['a.js', 'x/a.js']))
            .toEqual(['path filter overlap: a.js also matches x/a.js']);
    });
});

describe('parseShardArg', () => {
    it('reads k/N', () => expect(parseShardArg('2/3')).toEqual({ k: 2, n: 3 }));
    it.each(['0/3', '4/3', '3', '', undefined])('refuses %s', (v) => {
        expect(() => parseShardArg(v)).toThrow(/--shard/);
    });
});
