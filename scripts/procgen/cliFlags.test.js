// cliFlags — the drivers' one argv parser (§5au item 6), and the substrate-id check.
import { describe, it, expect, beforeAll } from 'vitest';

import { KIND, W, flag, oneOf, parseFlags } from './cliFlags.js';
import { UsageError } from './cliRun.js';
import { checkSubstrateIds, loadPipelineSubstrates } from './registerPipelineSubstrates.js';

const FLAGS = {
    '--seed': W.seed,
    '--region': W.region,
    '--quota': W.quota,
    '--mix': W.mixWeights,
    '--param': W.param,
    '--revisit': W.revisit,
    '--no-bidirectional': W.noBidirectional,
    '--atlas': flag('atlasPools', KIND.list),
    '--items-per-sphere': flag('itemsPerSphere', KIND.int, (o) => { o.spheres = null; }),
    '--asymmetric': flag('asymmetric', oneOf('add', 'remove')),
    '--json-status': W.jsonStatus,
};
const defaults = () => ({
    seed: 1, region: { width: 8, height: 6 }, quotas: {}, mix: {}, params: {}, revisit: 0.25,
    bidirectional: true, atlasPools: [], spheres: 3, itemsPerSphere: null, asymmetric: 'add',
});
const parse = (argv, opts) => parseFlags(argv, FLAGS, defaults(), opts);

describe('parseFlags', () => {
    it('writes each kind into the driver\'s defaults, keeping their key order', () => {
        const out = parse(['--quota', 'maze=2', '--seed', '7', '--region', '4x5', '--quota', 'jta=1',
            '--mix', 'maze=1.5', '--revisit', '0.5', '--no-bidirectional', '--atlas', 'a.json',
            '--atlas', 'b.json', '--asymmetric', 'remove', '--json-status', 's.json']);
        expect(out).toEqual({
            ...defaults(), seed: 7, region: { width: 4, height: 5 }, quotas: { maze: 2, jta: 1 },
            mix: { maze: 1.5 }, revisit: 0.5, bidirectional: false, atlasPools: ['a.json', 'b.json'],
            asymmetric: 'remove',
        });
        expect(Object.keys(out)).toEqual(Object.keys(defaults()));
    });

    it('--param: a plain decimal is a number, anything else a string', () => {
        const { params } = parse(['--param', 'a=40', '--param', 'b=-0.5', '--param', 'c=1e3',
            '--param', 'd=dj', '--param', 'e=']);
        expect(params).toEqual({ a: 40, b: -0.5, c: '1e3', d: 'dj', e: '' });
    });

    it('a flag\'s `then` runs after its write', () => {
        expect(parse(['--items-per-sphere', '2'])).toMatchObject({ itemsPerSphere: 2, spheres: null });
    });

    it('the subcommand is the first argument only, and only when asked for', () => {
        expect(parse(['run', '--seed', '2'], { subcommand: true })).toMatchObject({ subcommand: 'run', seed: 2 });
        expect(() => parse(['run'])).toThrow('unknown flag: run');
        expect(() => parse(['--seed', '2', 'run'], { subcommand: true })).toThrow('unknown flag: run');
    });

    it.each([
        [['--seed', 'abc'], "--seed: expected an integer, got 'abc'"],
        [['--seed', '3x'], "--seed: expected an integer, got '3x'"],
        [['--quota', 'maze=x'], "--quota: expected an integer, got 'x'"],
        [['--quota', 'maze'], "--quota: expected id=N, got 'maze'"],
        [['--quota', '=2'], "--quota: expected id=N, got '=2'"],
        [['--region', '8xq'], "--region: expected WxH, got '8xq'"],
        [['--revisit', ''], "--revisit: expected a number, got ''"],
        [['--asymmetric', 'both'], "--asymmetric expects 'add' or 'remove', got 'both'"],
        [['--seed'], '--seed needs a value'],
        [['--nope'], 'unknown flag: --nope'],
        [['toString'], 'unknown flag: toString'],
    ])('%j is a usage error', (argv, message) => {
        expect(() => parse(argv)).toThrow(UsageError);
        expect(() => parse(argv)).toThrow(message);
    });
});

describe('checkSubstrateIds', () => {
    beforeAll(async () => { await loadPipelineSubstrates(); }, 60_000);
    const how = { layout: 'grid', tool: 'dump-grid-growth', counts: { quotas: '--quota' }, start: 'start' };

    it('passes registered ids the layout places, library sources, zero counts and auto', () => {
        expect(() => checkSubstrateIds(
            { quotas: { maze: 2, 'library:abc': 1, jta: 0 }, start: 'auto' }, how,
        )).not.toThrow();
        expect(() => checkSubstrateIds({ quotas: {}, start: null }, how)).not.toThrow();
    });

    it('refuses an unregistered id and one the layout cannot place, naming the flag', () => {
        expect(() => checkSubstrateIds({ quotas: { bogus: 2 } }, how))
            .toThrow(/^--quota bogus=2: 'bogus' is not a registered substrate \(registered: .*maze/);
        expect(() => checkSubstrateIds({ quotas: { jta: 2 } }, how))
            .toThrow(/^--quota jta=2: dump-grid-growth cannot place 'jta' \(the grid layout places: .*maze/);
        expect(() => checkSubstrateIds({ quotas: {}, start: 'jta' }, how)).toThrow(UsageError);
    });
});
