/**
 * The node side of a profile override (engine prep A3, D2):
 * `seedlingProfileLoader.mjs` installs `SEEDLING_PROFILE` / `--profile=`
 * before the model loads, and `run-seedling-tape.mjs` is the worked example.
 * Each row is a CHILD PROCESS, because the override is process-wide at load.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUN = join(REPO, 'scripts/procgen/run-seedling-tape.mjs');
const TMP = mkdtempSync(join(tmpdir(), 'seedling-profile-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const DEFAULT_MD5 = 'cf76477ed5289765a0fcec3b292ac3f5';
const temp = (name, text) => { const p = join(TMP, name); writeFileSync(p, text); return p; };
/** The run's stdout; the environment never carries a stray SEEDLING_PROFILE in. */
function run(args, env = {}) {
    const { SEEDLING_PROFILE, ...base } = process.env;
    return spawnSync(process.execPath, [RUN, ...args], { cwd: REPO, encoding: 'utf8', env: { ...base, ...env } });
}
const field = (out, label) => new RegExp(`^${label}: (\\S+)`, 'm').exec(out)?.[1];

describe('run-seedling-tape — a node entry that takes a profile override (D2)', () => {
    it('collide-up-rock: the default md5 without an override; a MOVED md5 under +1 ULP walkSpeed, by flag and by env', () => {
        const base = run(['collide-up-rock', '--expect']);
        expect(base.status, base.stderr).toBe(0);
        expect(base.stdout).toContain('profile: compiled-in default');
        expect(base.stdout).toContain(`profile stamp: seedling-js-2026 ${DEFAULT_MD5}`);
        expect(base.stdout).toContain('expectation: same');

        // A2's mutant (a) named collide-up-rock as moving under this override
        const ulp = temp('ulp.json', '{"walkSpeed": 0.8000000000000002}\n');
        const moved = run(['collide-up-rock', `--profile=${ulp}`, '--expect']);
        expect(moved.status, moved.stderr).toBe(0);
        expect(moved.stdout).toContain('set walkSpeed=0.8000000000000002');
        expect(moved.stdout).toContain('defaulted: 135 of 136 keys');
        expect(moved.stdout).toMatch(/^expectation: moved \(tick \d+ differs/m);
        expect(field(moved.stdout, 'stream md5')).not.toBe(field(base.stdout, 'stream md5'));
        expect(moved.stdout).not.toContain(DEFAULT_MD5);

        const viaEnv = run(['collide-up-rock'], { SEEDLING_PROFILE: ulp });
        expect(field(viaEnv.stdout, 'stream md5')).toBe(field(moved.stdout, 'stream md5'));
    });

    it('a no-op override (`{walkSpeed: 0.8}`) is announced as a set and leaves both md5s at the default', () => {
        const base = run(['collide-up-rock']);
        const noop = run(['collide-up-rock', `--profile=${temp('noop.json', '{"id": "noop", "walkSpeed": 0.8}')}`]);
        expect(noop.status, noop.stderr).toBe(0);
        expect(noop.stdout).toContain('profile: override:noop');
        expect(noop.stdout).toContain('set walkSpeed=0.8');
        expect(noop.stdout).toContain(`profile stamp: noop ${DEFAULT_MD5}`);
        expect(field(noop.stdout, 'stream md5')).toBe(field(base.stdout, 'stream md5'));
    });

    it('a refused override exits 1 naming the FILE and the key', () => {
        const bad = temp('bad.json', '{"walkSped": 0.8}');
        const r = run(['collide-up-rock', `--profile=${bad}`]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain(`REFUSED: ${bad}: profile override: unknown key "walkSped"`);
        const dup = temp('dup.json', '{"walkSpeed": 0.8, "walkSpeed": 0.9}');
        expect(run(['collide-up-rock'], { SEEDLING_PROFILE: dup }).stderr)
            .toContain(`REFUSED: ${dup}: profile override: duplicate key "walkSpeed"`);
    });

    it('the loader refuses an install that comes after the profile module already loaded', () => {
        const ulp = temp('late.json', '{"walkSpeed": 0.9}');
        const script = `
            await import(${JSON.stringify(join(REPO, 'frontend/modules/seedlingDemo/seedlingProfile.js'))});
            const { installProfileFromEnv } = await import(${JSON.stringify(join(REPO, 'scripts/procgen/seedlingProfileLoader.mjs'))});
            try { await installProfileFromEnv({ argv: [], env: { SEEDLING_PROFILE: ${JSON.stringify(ulp)} } }); console.log('INSTALLED'); }
            catch (e) { console.log(e.message); }`;
        const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: REPO, encoding: 'utf8' });
        expect(out).toContain(`${ulp}: installed TOO LATE`);
    });
});
