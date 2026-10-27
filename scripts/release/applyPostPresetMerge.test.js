/**
 * apply-post-preset-merge.sh — its index logic, run for real in a throwaway
 * git repo: the release's regenerated index (canonical games only) comes in,
 * the dev index gets the preserved presets back, and the live index keeps the
 * ones the list marks `public`. Re-running changes nothing (idempotence).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'apply-post-preset-merge.sh');
const INDEX = 'frontend/presets/preset_files.json';
const LIVE = 'frontend/presets/preset_files.live.json';

const entry = (name) => ({ name, folders: { AP_1: { seed: 1, files: ['AP_1_rules.json'] } } });
const metadata = { schema_version: 1 };

let repo;
afterEach(() => { if (repo) rmSync(repo, { recursive: true, force: true }); repo = undefined; });

const git = (...args) => execFileSync('git', args, {
    cwd: repo, stdio: 'pipe',
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
});
const write = (path, text) => { mkdirSync(dirname(join(repo, path)), { recursive: true }); writeFileSync(join(repo, path), text); };
const writeJson = (path, value) => write(path, `${JSON.stringify(value, null, 2)}\n`);
const read = (path) => readFileSync(join(repo, path), 'utf8');
const run = (...args) => spawnSync('bash', [join(repo, 'scripts/release/apply-post-preset-merge.sh'), '--from-ref', 'HEAD', ...args], { cwd: repo, encoding: 'utf8' });

/**
 * The pre-regen release: two workflow games, three preserved dev presets (one
 * plain, two public), committed. Then the regen merge lands: the index holds
 * the canonical games only and the preserved dirs are gone.
 */
function releaseRepo(list) {
    repo = mkdtempSync(join(tmpdir(), 'post-preset-merge-'));
    git('init', '-q');
    mkdirSync(join(repo, 'scripts/release'), { recursive: true });
    copyFileSync(SCRIPT, join(repo, 'scripts/release/apply-post-preset-merge.sh'));
    write('scripts/release/preserved-dev-presets.txt', list);
    writeJson(INDEX, {
        alttp: entry('A Link to the Past'), dev_demo: entry('Dev Demo'), pub_a: entry('Public A'),
        tunic: entry('TUNIC'), pub_b: entry('Public B'), metadata,
    });
    for (const id of ['dev_demo', 'pub_a', 'pub_b']) write(`frontend/presets/${id}/AP_1/AP_1_rules.json`, `{"id":"${id}"}\n`);
    git('add', '-A');
    git('commit', '-qm', 'pre-regen release');
    // The regenerated index: workflow games only (and a changed one), dirs wiped.
    writeJson(INDEX, { alttp: entry('A Link to the Past v2'), tunic: entry('TUNIC'), metadata });
    for (const id of ['dev_demo', 'pub_a', 'pub_b']) rmSync(join(repo, 'frontend/presets', id), { recursive: true });
}

const LIST = '# header\n\ndev_demo\npub_a public\n  # indented comment\npub_b   public\n';

describe('apply-post-preset-merge.sh', () => {
    it('dev = canonical + preserved; live = canonical + the public ones, with the dev entries', () => {
        releaseRepo(LIST);
        const r = run();
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('of which public    : pub_a pub_b');
        const dev = JSON.parse(read(INDEX));
        const live = JSON.parse(read(LIVE));
        expect(Object.keys(dev)).toEqual(['alttp', 'tunic', 'dev_demo', 'pub_a', 'pub_b', 'metadata']);
        expect(Object.keys(live)).toEqual(['alttp', 'tunic', 'pub_a', 'pub_b', 'metadata']);
        expect(dev.alttp.name).toBe('A Link to the Past v2');
        for (const id of ['pub_a', 'pub_b']) expect(JSON.stringify(live[id])).toBe(JSON.stringify(dev[id]));
        for (const id of ['dev_demo', 'pub_a', 'pub_b']) expect(existsSync(join(repo, `frontend/presets/${id}/AP_1/AP_1_rules.json`))).toBe(true);
    });

    it('is idempotent: a second run writes the same bytes', () => {
        releaseRepo(LIST);
        expect(run().status).toBe(0);
        const first = [read(INDEX), read(LIVE)];
        expect(run().status).toBe(0);
        expect([read(INDEX), read(LIVE)]).toEqual(first);
    });

    it('--dry-run reports the public presets and writes nothing', () => {
        releaseRepo(LIST);
        const before = read(INDEX);
        const r = run('--dry-run');
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toMatch(/live index\s+: 4 games .*\(\+2 public\)/);
        expect(read(INDEX)).toBe(before);
        expect(existsSync(join(repo, LIVE))).toBe(false);
        expect(existsSync(join(repo, 'frontend/presets/pub_a'))).toBe(false);
    });

    it('refuses a list line whose second field is not `public`', () => {
        releaseRepo('dev_demo\npub_a pubilc\n');
        const r = run('--dry-run');
        expect(r.status).toBe(1);
        expect(r.stderr).toContain("bad line for 'pub_a'");
    });
});
