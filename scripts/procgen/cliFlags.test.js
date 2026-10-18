// cliFlags — the drivers' one argv parser (§5au item 6), its --config file
// (item 7), and the substrate-id check.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';

import { KIND, W, configSchema, flag, oneOf, parseFlags } from './cliFlags.js';
import { InputError, UsageError } from './cliRun.js';
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
    '--spheres': W.spheres,
    '--items-per-sphere': flag('itemsPerSphere', KIND.int, { clears: ['spheres'] }),
    '--asymmetric': flag('asymmetric', oneOf('add', 'remove')),
    '--json-status': W.jsonStatus,
    '--config': W.config,
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

    it('a flag\'s `clears` keys are nulled after its write', () => {
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

describe('--config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cliFlags-'));
    let n = 0;
    const file = (doc) => {
        const p = join(dir, `c${n++}.json`);
        writeFileSync(p, typeof doc === 'string' ? doc : JSON.stringify(doc));
        return p;
    };

    it('the file sets keys; flags win wherever --config sits; maps merge, lists append', () => {
        const c = file({ seed: 4, quotas: { maze: 2, jta: 1 }, atlasPools: ['a.json'], revisit: 0.75 });
        const out = parse(['--seed', '9', '--quota', 'maze=3', '--config', c, '--atlas', 'b.json']);
        expect(out).toMatchObject({
            seed: 9, quotas: { maze: 3, jta: 1 }, atlasPools: ['a.json', 'b.json'], revisit: 0.75,
        });
        expect(Object.keys(out)).toEqual(Object.keys(defaults()));
    });

    it('a parse result fed back as the file is the same result', () => {
        const argv = ['--seed', '7', '--region', '4x5', '--quota', 'maze=2', '--param', 'a=1',
            '--items-per-sphere', '2', '--asymmetric', 'remove', '--no-bidirectional'];
        const first = parse(argv);
        expect(parse(['--config', file(first)])).toEqual(first);
    });

    it('null only where the default is null or a flag clears the key', () => {
        expect(parse(['--config', file({ itemsPerSphere: null, spheres: null })]))
            .toMatchObject({ itemsPerSphere: null, spheres: null });
        expect(parse(['--config', file({ itemsPerSphere: 2 })])).toMatchObject({ itemsPerSphere: 2, spheres: null });
        expect(() => parse(['--config', file({ seed: null })])).toThrow("'seed' must be an integer, got null");
    });

    it.each([
        [{ sed: 1 }, "unknown key 'sed'"],
        [{ seed: '1' }, "'seed' must be an integer, got \"1\""],
        [{ quotas: { maze: 1.5 } }, "'quotas' must be an object of integers"],
        [{ region: { width: 4 } }, "'region' must be {width, height} integers"],
        [{ asymmetric: 'both' }, "'asymmetric' must be one of \"add\", \"remove\""],
        [[1], 'expected a JSON object'],
        ['{oops', 'not JSON'],
    ])('%j is an input error (exit 3)', (doc, message) => {
        const c = file(doc);
        expect(() => parse(['--config', c])).toThrow(InputError);
        expect(() => parse(['--config', c])).toThrow(message);
    });

    it('a missing file is an input error; twice, or without a value, is usage', () => {
        expect(() => parse(['--config', join(dir, 'nope.json')])).toThrow(InputError);
        const c = file({});
        expect(() => parse(['--config', c, '--config', c])).toThrow(UsageError);
        expect(() => parse(['--config'])).toThrow('--config needs a value');
    });

    it('the schema lists every key a flag writes, its flags and default, and nothing else', () => {
        const schema = configSchema(FLAGS, defaults(), { tool: 't' });
        expect(schema.additionalProperties).toBe(false);
        expect(Object.keys(schema.properties).sort()).toEqual([
            'asymmetric', 'atlasPools', 'bidirectional', 'itemsPerSphere', 'mix', 'params', 'quotas',
            'region', 'revisit', 'seed', 'spheres',
        ]);
        expect(schema.properties.seed).toEqual({ type: 'integer', 'x-flags': ['--seed'], default: 1 });
        expect(schema.properties.spheres.anyOf).toEqual([{ type: 'integer' }, { type: 'null' }]);
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
            .toThrow(/^quotas\.bogus=2 \(--quota\): 'bogus' is not a registered substrate \(registered: .*maze/);
        expect(() => checkSubstrateIds({ quotas: { jta: 2 } }, how))
            .toThrow(/^quotas\.jta=2 \(--quota\): dump-grid-growth cannot place 'jta' \(the grid layout places: .*maze/);
        expect(() => checkSubstrateIds({ quotas: {}, start: 'jta' }, how)).toThrow(UsageError);
    });
});
