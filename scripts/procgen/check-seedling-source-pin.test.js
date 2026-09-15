/**
 * check-seedling-source-pin — **THE ROWS, ON FIXTURE REPOSITORIES** (slice
 * seedling-headless-V1).
 *
 * Each fixture is a scratch outer repository with a `vendor/seedling` gitlink,
 * a real nested repository checked out at that path, and a `builds.json` at
 * the wasm submodule's path. The agreeing pair passes; each way the two pins
 * can drift apart is its own red row.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { BUILDS_JSON, checkSourcePin } from './check-seedling-source-pin.mjs';
import { headlineOf } from './standingValues.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, 'check-seedling-source-pin.mjs');
const FORK = 'PeerInfinity/Seedling';

const ID = ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false'];
const git = (cwd, ...args) => execFileSync('git', [...ID, ...args],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const roots = [];
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });

/** The fork's history: `demo` → `pin`, plus `side`, a commit off another root (never an ancestor). */
function forkRepo(dir) {
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q', '-b', 'main');
    const commit = (file) => {
        writeFileSync(join(dir, file), `${file}\n`);
        git(dir, 'add', file);
        git(dir, 'commit', '-q', '-m', file);
        return git(dir, 'rev-parse', 'HEAD');
    };
    const demo = commit('Main.as');
    const pin = commit('Game.as');
    const later = commit('Bot.as');
    git(dir, 'checkout', '-q', '--orphan', 'side');
    const side = commit('Other.as');
    git(dir, 'checkout', '-q', pin);
    return { demo, pin, later, side };
}

/**
 * A fixture: `gitlink` recorded at HEAD, the checkout at `checkout`, and a
 * manifest whose default/demo builds name `manifest.default` / `manifest.demo`.
 */
function fixture({ gitlink, checkout, manifest, initialised = true, withManifest = true } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'source-pin-'));
    roots.push(root);
    git(root, 'init', '-q', '-b', 'main');
    const sub = join(root, 'vendor', 'seedling');
    const shas = forkRepo(sub);
    const pick = (v, dflt) => shas[v ?? dflt] ?? v;
    if (withManifest) {
        mkdirSync(join(root, dirname(BUILDS_JSON)), { recursive: true });
        writeFileSync(join(root, BUILDS_JSON), JSON.stringify({ builds: [
            { name: 'bot_build', role: 'default',
                source: { repo: FORK, branch: 'ap-m1', commit: pick(manifest?.default, 'pin') } },
            { name: 'original_build', role: 'demo', demo: true,
                source: { repo: FORK, branch: 'main', commit: pick(manifest?.demo, 'demo') } },
            { name: 'elsewhere', role: 'demo', source: { repo: 'someone/Else', commit: 'f'.repeat(40) } },
        ] }));
    }
    git(root, 'update-index', '--add', '--cacheinfo', `160000,${pick(gitlink, 'pin')},vendor/seedling`);
    git(root, 'commit', '-q', '-m', 'fixture');
    git(sub, 'checkout', '-q', pick(checkout, gitlink ?? 'pin'));
    if (!initialised) rmSync(join(sub, '.git'), { recursive: true, force: true });
    return { root, sub, shas };
}

const kinds = (rows) => rows.map((r) => r.kind);
const spawnGate = (root) => {
    const r = spawnSync(process.execPath, [GATE, `--repo=${root}`], { encoding: 'utf8', timeout: 60000 });
    return { status: r.status, out: r.stdout, head: headlineOf('gate', r.stdout) };
};

describe('check-seedling-source-pin', () => {
    it('the agreeing pair: gitlink = default source, checkout at it, demo an ancestor → 3/0, exit 0', () => {
        const { root } = fixture();
        const res = checkSourcePin({ repo: root });
        expect(kinds(res.rows)).toEqual(['PASS', 'PASS', 'PASS']);
        const g = spawnGate(root);
        expect(g.head.value).toBe('3/0');
        expect(g.head.total).toMatch(/^ALL PASS — 3 VERIFIED/);
        expect(g.status).toBe(0);
    });

    it('⛔ a BUMPED gitlink with an unchanged manifest → (i) FAIL, exit 1', () => {
        const { root } = fixture({ gitlink: 'later' });
        const res = checkSourcePin({ repo: root });
        expect(res.rows[0]).toMatchObject({ kind: 'FAIL' });
        expect(res.rows[0].msg).toMatch(/^\(i\) .* is NOT the default build bot_build's source\.commit/);
        const g = spawnGate(root);
        expect(g.head.value).toBe('2/1');
        expect(g.status).toBe(1);
    });

    it('⛔ the manifest\'s commit EDITED with the gitlink unchanged → (i) FAIL', () => {
        const { root } = fixture({ manifest: { default: 'later' } });
        expect(kinds(checkSourcePin({ repo: root }).rows)).toEqual(['FAIL', 'PASS', 'PASS']);
    });

    it('⛔ a checkout that drifted off the gitlink → (ii) FAIL', () => {
        const { root } = fixture({ checkout: 'later' });
        const res = checkSourcePin({ repo: root });
        expect(kinds(res.rows)).toEqual(['PASS', 'FAIL', 'PASS']);
        expect(res.rows[1].msg).toMatch(/NOT at the gitlink/);
    });

    it('⛔ a demo source that is NOT an ancestor of the gitlink → (iii) FAIL', () => {
        const { root } = fixture({ manifest: { demo: 'side' } });
        const res = checkSourcePin({ repo: root });
        expect(kinds(res.rows)).toEqual(['PASS', 'PASS', 'FAIL']);
        expect(res.rows[2].msg).toMatch(/original_build.* is NOT an ancestor/);
    });

    it('⛔ zero or two default builds from the fork → FAIL by name, never a guess', () => {
        const { root } = fixture({ manifest: { default: 'pin' } });
        const m = JSON.parse(readFileSync(join(root, BUILDS_JSON), 'utf8'));
        m.builds[1].role = 'default';
        writeFileSync(join(root, BUILDS_JSON), JSON.stringify(m));
        const res = checkSourcePin({ repo: root });
        expect(res.rows[0]).toMatchObject({ kind: 'FAIL' });
        expect(res.rows[0].msg).toMatch(/names 2 build\(s\) with role "default"/);
    });

    it('an UNINITIALISED submodule is a REFUSAL: SKIP, exit 0, 0/0/1', () => {
        const { root } = fixture({ initialised: false });
        const res = checkSourcePin({ repo: root });
        expect(res.refused).toBe(true);
        expect(res.rows[0].msg).toMatch(/submodule is not initialised — git submodule update --init vendor\/seedling/);
        const g = spawnGate(root);
        expect(g.head.value).toBe('0/0/1');
        expect(g.head.total).toMatch(/^ALL PASS — REFUSED/);
        expect(g.status).toBe(0);
    });

    it('no builds.json (the wasm submodule uninitialised) is a REFUSAL too', () => {
        const { root } = fixture({ withManifest: false });
        expect(checkSourcePin({ repo: root })).toMatchObject({ refused: true });
    });

    it('a SHALLOW submodule answers (i) and (ii) and SKIPs (iii) by name', () => {
        const { root, sub, shas } = fixture();
        const shallow = `${sub}-shallow`;
        execFileSync('git', ['clone', '-q', '--depth', '1', `file://${sub}`, shallow, '--branch', 'main'],
            { stdio: 'ignore' });
        // the depth-1 clone's head is `later`; re-point the fixture's pin at it
        rmSync(sub, { recursive: true, force: true });
        renameSync(shallow, sub);
        const m = JSON.parse(readFileSync(join(root, BUILDS_JSON), 'utf8'));
        m.builds[0].source.commit = shas.later;
        writeFileSync(join(root, BUILDS_JSON), JSON.stringify(m));
        git(root, 'update-index', '--cacheinfo', `160000,${shas.later},vendor/seedling`);
        git(root, 'commit', '-q', '-m', 'pin later');
        const res = checkSourcePin({ repo: root });
        expect(kinds(res.rows)).toEqual(['PASS', 'PASS', 'SKIP']);
        expect(res.rows[2].msg).toMatch(/SHALLOW clone/);
        expect(spawnGate(root).head.value).toBe('2/0/1');
    });
});
