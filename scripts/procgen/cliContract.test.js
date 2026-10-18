// THE PIPELINE DRIVERS' COMMAND-LINE CONTRACT, run against the real drivers
// (§5au item 8). Each row spawns a driver the way a script would and checks
// what a script relies on: stdout is data only, the exit code names the
// outcome, every envelope at every step matches its published schema
// (frontend/schema/envelopes/), every rules.json matches
// frontend/schema/rules.schema.json, the status object has its keys, and a
// dump's own `config` rebuilds it through --config.
//
// ⛓ It runs in the default vitest tier, so CI runs it on every push without a
// gate job of its own; check-cli-sphere-config.mjs (still @ci-box as a gate)
// runs here as one row.
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { beforeAll, describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import Ajv07 from 'ajv';

import { EXIT, STATUS_VERSION } from './cliRun.js';
import { SPHERE_STEPS } from '../../frontend/modules/procgenPipeline/sphereSteps.js';
import { SPIRAL_STEPS } from '../../frontend/modules/procgenPipeline/spiralSteps.js';
import { TOPDOWN_STEPS } from '../../frontend/modules/procgenPipeline/topDownSteps.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../..');
const TMP = mkdtempSync(join(tmpdir(), 'cli-contract-'));
const tmp = (name) => join(TMP, name);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const T = 120_000;

/** Run a driver; never rejects — the exit code is part of what is checked. */
async function cli(tool, args) {
    try {
        const { stdout, stderr } = await promisify(execFile)(process.execPath, [join(HERE, `${tool}.js`), ...args], {
            cwd: REPO, maxBuffer: 256 * 1024 * 1024,
        });
        return { code: 0, stdout, stderr };
    } catch (e) {
        if (typeof e.code !== 'number') throw e;
        return { code: e.code, stdout: e.stdout, stderr: e.stderr };
    }
}

const ajv20 = new Ajv2020({ allErrors: true, strict: false });
const ENVELOPE = Object.fromEntries(['sphere', 'spiral', 'topdown'].map((m) => [`${m}-envelope`,
    ajv20.compile(readJson(join(REPO, `frontend/schema/envelopes/${m}-envelope.schema.json`)))]));
const RULES = new Ajv07({ allErrors: true, strict: false }).compile(readJson(join(REPO, 'frontend/schema/rules.schema.json')));
const errs = (v) => JSON.stringify(v.errors?.slice(0, 5));

function expectEnvelope(env, kind, where) {
    expect(env.kind, where).toBe(kind);
    expect(ENVELOPE[kind](env), `${where}: ${errs(ENVELOPE[kind])}`).toBe(true);
}
function expectRules(rules, where) {
    expect(RULES(rules), `${where}: ${errs(RULES)}`).toBe(true);
}
function expectStatus(status, { tool, outcome }) {
    expect(Object.keys(status)).toEqual(['status_version', 'tool', 'subcommand', 'ok', 'exit_code', 'outcome',
        'error', 'completed', 'next', 'outputs', 'oracle', 'summary', 'config']);
    expect(status).toMatchObject({ status_version: STATUS_VERSION, tool, outcome, exit_code: EXIT[outcome], ok: outcome === 'ok' });
}

describe.concurrent('the CLI contract', () => {
    // ⛓ fixtures the refusal rows read, written ONCE (the rows run concurrently)
    beforeAll(async () => {
        writeFileSync(tmp('bad-config.json'), JSON.stringify({ sed: 1 }));
        const plan = await cli('sphere-step', ['plan', '--spheres', '2', '-o', '-']);
        expect(plan.code).toBe(EXIT.ok);
        writeFileSync(tmp('sphere-plan.json'), plan.stdout);
    }, T);

    it('the rules schema is not vacuous', () => {
        expect(RULES({ regions: 5 })).toBe(false);
    });

    it('sphere-step: every step, chained through -i, writes a valid envelope; stdout stays empty', async () => {
        let prev = null;
        for (const step of SPHERE_STEPS) {
            const out = tmp(`sphere-${step}.json`);
            const args = [step, ...(prev ? ['-i', prev] : ['--spheres', '2', '--quota', 'maze=2', '--start', 'maze']),
                '-o', out, '--json-status', tmp(`sphere-${step}.status.json`),
                ...(step === 'compile' ? ['--rules-out', tmp('sphere.rules.json')] : [])];
            // eslint-disable-next-line no-await-in-loop
            const r = await cli('sphere-step', args);
            expect(r.code, `${step}: ${r.stderr.slice(-400)}`).toBe(EXIT.ok);
            expect(r.stdout, step).toBe('');
            expectEnvelope(readJson(out), 'sphere-envelope', step);
            expectStatus(readJson(tmp(`sphere-${step}.status.json`)), { tool: 'sphere-step', outcome: 'ok' });
            prev = out;
        }
        expectRules(readJson(tmp('sphere.rules.json')), 'sphere rules');
    }, T);

    it('sphere-step run -o -: stdout is exactly one envelope; append extends it', async () => {
        const r = await cli('sphere-step', ['run', '--spheres', '2', '-o', '-']);
        expect(r.code).toBe(EXIT.ok);
        const env = JSON.parse(r.stdout);
        expectEnvelope(env, 'sphere-envelope', 'run -o -');
        expectRules(env.compile.rulesJson, 'run rules');
        writeFileSync(tmp('sphere-run.json'), r.stdout);
        const a = await cli('sphere-step', ['append', '-i', tmp('sphere-run.json'), '--items', 'key_red=1', '-o', tmp('sphere-append.json')]);
        expect(a.code, a.stderr.slice(-400)).toBe(EXIT.ok);
        expectEnvelope(readJson(tmp('sphere-append.json')), 'sphere-envelope', 'append');
    }, T);

    it('spiral-step: every step chained, then the rules', async () => {
        let prev = null;
        for (const step of SPIRAL_STEPS) {
            const out = tmp(`spiral-${step}.json`);
            // eslint-disable-next-line no-await-in-loop
            const r = await cli('spiral-step', [step, ...(prev ? ['-i', prev] : ['--quota', 'maze=2', '--quota', 'text_adventure=1', '--start', 'maze']),
                '-o', out, ...(step === 'compile' ? ['--rules-out', tmp('spiral.rules.json')] : [])]);
            expect(r.code, `${step}: ${r.stderr.slice(-400)}`).toBe(EXIT.ok);
            expect(r.stdout, step).toBe('');
            expectEnvelope(readJson(out), 'spiral-envelope', step);
            prev = out;
        }
        expectRules(readJson(tmp('spiral.rules.json')), 'spiral rules');
    }, T);

    it('topdown-step: every step chained from a sphere world, then the rules', async () => {
        const src = await cli('sphere-step', ['run', '--spheres', '2', '-o', tmp('td-src.env.json'), '--rules-out', tmp('td-src.rules.json')]);
        expect(src.code).toBe(EXIT.ok);
        let prev = null;
        for (const step of TOPDOWN_STEPS) {
            const out = tmp(`topdown-${step}.json`);
            // eslint-disable-next-line no-await-in-loop
            const r = await cli('topdown-step', [step, ...(prev ? ['-i', prev] : ['--source', tmp('td-src.rules.json')]),
                '-o', out, ...(step === 'compile' ? ['--rules-out', tmp('topdown.rules.json')] : [])]);
            expect(r.code, `${step}: ${r.stderr.slice(-400)}`).toBe(EXIT.ok);
            expect(r.stdout, step).toBe('');
            expectEnvelope(readJson(out), 'topdown-envelope', step);
            prev = out;
        }
        expectRules(readJson(tmp('topdown.rules.json')), 'topdown rules');
    }, T);

    it.each([
        ['dump-sphere-growth', ['--spheres', '2', '--quota', 'maze=2'], 'sphere-growth-dump'],
        ['dump-shuffled-spiral', ['--quota', 'maze=2', '--quota', 'jta=2'], 'shuffled-spiral-dump'],
        ['dump-grid-growth', ['--grid', '2x2', '--quota', 'maze=2', '--branch', '0.7'], 'grid-growth-dump'],
    ])('%s: stamped, valid rules, empty stdout, and its own config rebuilds it', async (tool, args, kind) => {
        const out = tmp(`${tool}.json`);
        const r = await cli(tool, [...args, '-o', out, '--json-status', tmp(`${tool}.status.json`)]);
        expect(r.code, r.stderr.slice(-400)).toBe(EXIT.ok);
        expect(r.stdout).toBe('');
        const dump = readJson(out);
        expect(dump).toMatchObject({ kind, envelope_version: 1 });
        expectRules(dump.rulesJson, tool);
        const status = readJson(tmp(`${tool}.status.json`));
        expectStatus(status, { tool, outcome: 'ok' });
        expect(status.config).toEqual(dump.config);

        writeFileSync(tmp(`${tool}.cfg.json`), JSON.stringify(dump.config));
        const again = await cli(tool, ['--config', tmp(`${tool}.cfg.json`)]);
        expect(again.code, again.stderr.slice(-400)).toBe(EXIT.ok);
        expect(readFileSync(out, 'utf8')).toBe(readFileSync(dump.config.out, 'utf8'));
    }, T);

    it.each([
        ['an unknown flag', 'usage', 'dump-grid-growth', ['--nope']],
        ['a non-integer value', 'usage', 'dump-grid-growth', ['--seed', 'abc']],
        ['a flag with no value', 'usage', 'sphere-step', ['run', '--seed']],
        ['a substrate the layout cannot place', 'usage', 'dump-grid-growth', ['--quota', 'jta=2']],
        ['an unregistered substrate', 'usage', 'spiral-step', ['run', '--quota', 'bogus=2']],
        ['a missing subcommand', 'usage', 'spiral-step', ['--seed', '2']],
        ['a missing -i file', 'input', 'sphere-step', ['allocate', '-i', '/nonexistent/env.json']],
        ['an envelope of another kind', 'input', 'spiral-step', ['run', '-i', '@sphere-plan.json']],
        ['a --config with an unknown key', 'input', 'dump-grid-growth', ['--config', '@bad-config.json']],
    ])('%s is `%s` (%s), refused before any output, with a status saying so', async (what, outcome, tool, rawArgs) => {
        const args = rawArgs.map((a) => (a.startsWith('@') ? tmp(a.slice(1)) : a));
        const status = tmp(`fail-${what.replace(/\W+/g, '-')}.status.json`);
        const r = await cli(tool, [...args, '--json-status', status, '-o', tmp('never.json')]);
        expect(r.code, r.stderr.slice(-400)).toBe(EXIT[outcome]);
        expect(r.stdout).toBe('');
        expect(r.stderr).toMatch(new RegExp(`\\[${tool}\\] ERROR \\(${outcome}\\): `));
        const s = readJson(status);
        expectStatus(s, { tool, outcome });
        expect(s.error.message).toBeTruthy();
    }, T);

    it('--help exits 0 and drives nothing; --config-schema is a schema ajv compiles', async () => {
        for (const tool of ['sphere-step', 'spiral-step', 'topdown-step', 'dump-sphere-growth', 'dump-shuffled-spiral', 'dump-grid-growth']) {
            // eslint-disable-next-line no-await-in-loop
            const h = await cli(tool, ['--help']);
            expect(h.code, tool).toBe(EXIT.ok);
            expect(h.stdout, tool).toMatch(/Flags \(derived from this file/);
            // eslint-disable-next-line no-await-in-loop
            const s = await cli(tool, ['--config-schema']);
            expect(s.code, tool).toBe(EXIT.ok);
            expect(() => ajv20.compile(JSON.parse(s.stdout)), tool).not.toThrow();
        }
    }, T);

    it('list-substrates --json: every registered entry with its layouts', async () => {
        const r = await cli('list-substrates', ['--json']);
        expect(r.code).toBe(EXIT.ok);
        const list = JSON.parse(r.stdout);
        expect(list).toMatchObject({ kind: 'substrate-list', list_version: 1 });
        expect(list.libraries.every((l) => l.error === null)).toBe(true);
        expect(list.substrates.map((s) => s.id)).toEqual(expect.arrayContaining(['maze', 'flash_seedling_gen', 'noiz2sa']));
        for (const s of list.substrates) expect(Array.isArray(s.layouts), s.id).toBe(true);
    }, T);

    it('check-cli-sphere-config.mjs: the CLI and the panel assemble the same sphere config', async () => {
        const r = await promisify(execFile)(process.execPath, [join(HERE, 'check-cli-sphere-config.mjs')], { cwd: REPO })
            .then((x) => ({ code: 0, ...x }), (e) => ({ code: e.code, stdout: e.stdout, stderr: e.stderr }));
        expect(r.code, r.stderr?.slice(-400)).toBe(0);
        expect(r.stdout).toMatch(/ALL CHECKS PASSED/);
    }, T);
});
