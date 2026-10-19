// runPipeline (§5au item 10): the six drivers called as a function return what
// the CLIs write, byte for byte; importing it does nothing; a process that
// uses it ends on its own; and its errors map to the CLIs' exit codes.
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, it, expect } from 'vitest';

import { DRIVERS, EXIT, InputError, UsageError, outcomeOf, runPipeline } from './runPipeline.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../..');
const TMP = mkdtempSync(join(tmpdir(), 'run-pipeline-'));
const tmp = (n) => join(TMP, n);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const T = 120_000;

const node = (args) => promisify(execFile)(process.execPath, args, { cwd: REPO, maxBuffer: 256 * 1024 * 1024 })
    .then((r) => ({ code: 0, ...r }), (e) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }));
const cli = (tool, args) => node([join(HERE, `${tool}.js`), ...args]);
/** A dump's `config.out` is the path it was written to; compare dumps without it. */
const withoutOut = (dump) => ({ ...dump, config: { ...dump.config, out: null } });

describe('runPipeline', () => {
    it('importing it does nothing: no output, nothing loaded', async () => {
        const r = await node(['--input-type=module', '-e',
            `await import(${JSON.stringify(join(HERE, 'runPipeline.js'))});`]);
        expect(r).toMatchObject({ code: 0, stdout: '', stderr: '' });
    });

    it.each([
        ['dump-grid-growth', { seed: 7, grid: { width: 3, height: 3 }, quotas: { maze: 2, text_adventure: 1 } },
            ['--seed', '7', '--grid', '3x3', '--quota', 'maze=2', '--quota', 'text_adventure=1']],
        ['dump-shuffled-spiral', { quotas: { maze: 2, jta: 2 }, jtaLocations: true },
            ['--quota', 'maze=2', '--quota', 'jta=2', '--jta-locations']],
        ['dump-sphere-growth', { seed: 3, spheres: 2, quotas: { maze: 2 }, start: 'maze' },
            ['--seed', '3', '--spheres', '2', '--quota', 'maze=2', '--start', 'maze']],
    ])('%s returns the dump the CLI writes', async (driver, config, argv) => {
        const r = await runPipeline({ driver, config });
        const c = await cli(driver, [...argv, '-o', tmp(`${driver}.json`)]);
        expect(c.code, c.stderr.slice(-400)).toBe(EXIT.ok);
        const fromCli = readJson(tmp(`${driver}.json`));
        expect(JSON.stringify(withoutOut(r.dump))).toBe(JSON.stringify(withoutOut(fromCli)));
        expect(r.rulesJson).toEqual(fromCli.rulesJson);
        expect(r.envelope).toBeNull();
    }, T);

    it.each([
        ['sphere-step', { seed: 2, spheres: 2, quotas: { maze: 2, bounce: 1 }, start: 'maze' },
            ['run', '--seed', '2', '--spheres', '2', '--quota', 'maze=2', '--quota', 'bounce=1', '--start', 'maze']],
        ['spiral-step', { seed: 5, quotas: { maze: 2, noiz2sa: 1 }, start: 'maze' },
            ['run', '--seed', '5', '--quota', 'maze=2', '--quota', 'noiz2sa=1', '--start', 'maze']],
    ])('%s returns the envelope and rules the CLI writes', async (driver, config, argv) => {
        const r = await runPipeline({ driver, config });
        const c = await cli(driver, [...argv, '-o', tmp(`${driver}.env.json`), '--rules-out', tmp(`${driver}.rules.json`)]);
        expect(c.code, c.stderr.slice(-400)).toBe(EXIT.ok);
        expect(JSON.stringify(r.envelope)).toBe(JSON.stringify(readJson(tmp(`${driver}.env.json`))));
        expect(JSON.stringify(r.rulesJson)).toBe(JSON.stringify(readJson(tmp(`${driver}.rules.json`))));
        expect(r.dump).toBeNull();
    }, T);

    it('topdown-step takes its source as an object, and resumes an envelope', async () => {
        const src = await runPipeline({ driver: 'sphere-step', config: { spheres: 2 } });
        writeFileSync(tmp('td-source.json'), JSON.stringify(src.rulesJson));
        const r = await runPipeline({ driver: 'topdown-step', config: { seed: 2 }, source: src.rulesJson });
        const c = await cli('topdown-step', ['run', '--seed', '2', '--source', tmp('td-source.json'),
            '-o', tmp('td.env.json'), '--rules-out', tmp('td.rules.json')]);
        expect(c.code, c.stderr.slice(-400)).toBe(EXIT.ok);
        expect(JSON.stringify(r.envelope)).toBe(JSON.stringify(readJson(tmp('td.env.json'))));
        expect(JSON.stringify(r.rulesJson)).toBe(JSON.stringify(readJson(tmp('td.rules.json'))));

        // the same source by path, and a half-run envelope resumed to the end
        const byPath = await runPipeline({ driver: 'topdown-step', config: { seed: 2, source: tmp('td-source.json') } });
        expect(byPath.rulesJson).toEqual(r.rulesJson);
        const half = await runPipeline({ driver: 'topdown-step', config: { seed: 2, to: 'realise' }, source: src.rulesJson });
        expect(half.rulesJson).toBeNull();
        const resumed = await runPipeline({ driver: 'topdown-step', config: {}, envelope: half.envelope });
        expect(resumed.rulesJson).toEqual(r.rulesJson);
    }, T);

    it('a call leaves nothing behind for the next one', async () => {
        const plain = { quotas: { jta: 2 } };
        const a = await runPipeline({ driver: 'dump-shuffled-spiral', config: plain });
        await runPipeline({ driver: 'dump-shuffled-spiral', config: { ...plain, jtaLocations: true } });
        const b = await runPipeline({ driver: 'dump-shuffled-spiral', config: plain });
        expect(b.dump).toEqual(a.dump);
        expect(plain).toEqual({ quotas: { jta: 2 } });
    }, T);

    it.each([
        ['an unknown driver', { driver: 'nope' }, UsageError, 'usage'],
        ['an envelope for a dump driver', { driver: 'dump-grid-growth', envelope: {} }, UsageError, 'usage'],
        ['a config key the driver lacks', { driver: 'dump-grid-growth', config: { sed: 1 } }, InputError, 'input'],
        ['a config value of the wrong type', { driver: 'sphere-step', config: { seed: '1' } }, InputError, 'input'],
        ['a substrate the layout cannot place', { driver: 'dump-grid-growth', config: { quotas: { jta: 2 } } }, UsageError, 'usage'],
        ['topdown-step with no source', { driver: 'topdown-step' }, UsageError, 'usage'],
    ])('%s throws, mapped to the CLI exit code', async (what, request, Kind, outcome) => {
        const err = await runPipeline(request).then(() => null, (e) => e);
        expect(err).toBeInstanceOf(Kind);
        expect(outcomeOf(err)).toBe(outcome);
        expect(EXIT[outcomeOf(err)]).toBe(EXIT[outcome]);
    }, T);

    it('a process that runs every driver ends on its own (no process.exit)', async () => {
        const script = `
            const { runPipeline, DRIVERS } = await import(${JSON.stringify(join(HERE, 'runPipeline.js'))});
            const src = (await runPipeline({ driver: 'sphere-step', config: { spheres: 2 } })).rulesJson;
            const configs = {
                'dump-grid-growth': { grid: { width: 2, height: 2 }, quotas: { maze: 2 } },
                'dump-shuffled-spiral': { quotas: { maze: 2 } },
                'dump-sphere-growth': { spheres: 2 },
            };
            for (const driver of DRIVERS) {
                await runPipeline({ driver, config: configs[driver] ?? (driver === 'spiral-step' ? { quotas: { maze: 2 } } : { spheres: 2 }),
                    ...(driver === 'topdown-step' ? { source: src, config: {} } : {}) });
            }
            console.log('done ' + DRIVERS.length);`;
        const started = Date.now();
        const r = await node(['--input-type=module', '-e', script]);
        expect(r.code, r.stderr?.slice(-400)).toBe(0);
        expect(r.stdout.trim()).toBe(`done ${DRIVERS.length}`);
        expect(Date.now() - started).toBeLessThan(T);
    }, T);
});
