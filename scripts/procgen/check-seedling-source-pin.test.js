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

import {
    BROWSER_SUBMODULE, BUILDS_JSON, BUILD_INPUT_ALLOWLIST, RELEASE_JSON, checkSourcePin,
} from './check-seedling-source-pin.mjs';
import { headlineOf } from './standingValues.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, 'check-seedling-source-pin.mjs');
const FORK = 'PeerInfinity/Seedling';
/** Two SWFRecomp-CC commits (full SHAs): the one every build records, and a later one. */
const RECOMP = '4c450f076e8253c2e5fdc201a4b7cba2b51b6ad3';
const RECOMP_LATER = 'c842bf0d33109eba165bc3b882fc5c56c8c627e2';
const [OFL] = Object.keys(BUILD_INPUT_ALLOWLIST);

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
 * `release` is the swfrecomp-browser `release.json` (row iv): `false` = the
 * submodule uninitialised; by default, release 2's shape — stamped with the
 * builds' recompiler, a page-only diff of the one allowlisted path.
 */
const RELEASE_2 = () => ({ source: { repo: 'PeerInfinity/SWFRecomp-CC', commit: RECOMP,
    buildInputsUnchanged: { from: RECOMP, to: RECOMP_LATER, paths: ['SWFRecomp', 'SWFModernRuntime'], diff: [OFL],
        allowlist: [{ path: OFL, reason: 'licence text' }] } } });

function fixture({ gitlink, checkout, manifest, initialised = true, withManifest = true, release = RELEASE_2() } = {}) {
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
                source: { repo: FORK, branch: 'ap-m1', commit: pick(manifest?.default, 'pin'),
                    recompiler: manifest?.recompiler ?? RECOMP } },
            { name: 'original_build', role: 'demo', demo: true,
                source: { repo: FORK, branch: 'main', commit: pick(manifest?.demo, 'demo'), recompiler: RECOMP } },
            { name: 'elsewhere', role: 'demo', source: { repo: 'someone/Else', commit: 'f'.repeat(40) } },
        ] }));
    }
    git(root, 'update-index', '--add', '--cacheinfo', `160000,${pick(gitlink, 'pin')},vendor/seedling`);
    git(root, 'commit', '-q', '-m', 'fixture');
    git(sub, 'checkout', '-q', pick(checkout, gitlink ?? 'pin'));
    if (!initialised) rmSync(join(sub, '.git'), { recursive: true, force: true });
    if (release) {
        // A submodule checkout's `.git` is a gitfile; the gate asks only that it exists.
        mkdirSync(join(root, BROWSER_SUBMODULE), { recursive: true });
        writeFileSync(join(root, BROWSER_SUBMODULE, '.git'), 'gitdir: ../../../../.git/modules/browser\n');
        writeFileSync(join(root, RELEASE_JSON), typeof release === 'string' ? release : JSON.stringify(release));
    }
    return { root, sub, shas };
}

const kinds = (rows) => rows.map((r) => r.kind);
const spawnGate = (root) => {
    const r = spawnSync(process.execPath, [GATE, `--repo=${root}`], { encoding: 'utf8', timeout: 60000 });
    return { status: r.status, out: r.stdout, head: headlineOf('gate', r.stdout) };
};

describe('check-seedling-source-pin', () => {
    it('the agreeing pair: gitlink = default source, checkout at it, demo an ancestor, release = recompiler → 5/0, exit 0', () => {
        const { root } = fixture();
        const res = checkSourcePin({ repo: root });
        expect(kinds(res.rows)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS']);
        const g = spawnGate(root);
        expect(g.head.value).toBe('5/0');
        expect(g.head.total).toMatch(/^ALL PASS — 5 VERIFIED/);
        expect(g.status).toBe(0);
    });

    it('⛔ a BUMPED gitlink with an unchanged manifest → (i) FAIL, exit 1', () => {
        const { root } = fixture({ gitlink: 'later' });
        const res = checkSourcePin({ repo: root });
        expect(res.rows[0]).toMatchObject({ kind: 'FAIL' });
        expect(res.rows[0].msg).toMatch(/^\(i\) .* is NOT the default build bot_build's source\.commit/);
        const g = spawnGate(root);
        expect(g.head.value).toBe('4/1');
        expect(g.status).toBe(1);
    });

    it('⛔ the manifest\'s commit EDITED with the gitlink unchanged → (i) FAIL', () => {
        const { root } = fixture({ manifest: { default: 'later' } });
        expect(kinds(checkSourcePin({ repo: root }).rows)).toEqual(['FAIL', 'PASS', 'PASS', 'PASS', 'PASS']);
    });

    it('⛔ a checkout that drifted off the gitlink → (ii) FAIL', () => {
        const { root } = fixture({ checkout: 'later' });
        const res = checkSourcePin({ repo: root });
        expect(kinds(res.rows)).toEqual(['PASS', 'FAIL', 'PASS', 'PASS', 'PASS']);
        expect(res.rows[1].msg).toMatch(/NOT at the gitlink/);
    });

    it('⛔ a demo source that is NOT an ancestor of the gitlink → (iii) FAIL', () => {
        const { root } = fixture({ manifest: { demo: 'side' } });
        const res = checkSourcePin({ repo: root });
        expect(kinds(res.rows)).toEqual(['PASS', 'PASS', 'FAIL', 'PASS', 'PASS']);
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

    /** ⛓ R9 slice P4E: a `candidate` build from the fork, compiled from `commit`. */
    const withCandidate = (root, commit) => {
        const m = JSON.parse(readFileSync(join(root, BUILDS_JSON), 'utf8'));
        m.builds.push({ name: 'next_build', role: 'candidate',
            source: { repo: FORK, branch: 'ap-m1', commit, recompiler: RECOMP } });
        writeFileSync(join(root, BUILDS_JSON), JSON.stringify(m));
    };

    /**
     * ⚖ js-22 2026-11-22 (P1 p4h-beside): a candidate's source is checked by DESCENT, not equality — the vendor tree
     * and swfrecomp-browser follow the build everything runs by default. (R9 slice P4E had the candidate pin them.)
     */
    it('⛓ with a CANDIDATE, the gitlink still pins the DEFAULT, and the candidate DESCENDS from it (iii-c)', () => {
        const { root, shas } = fixture();
        withCandidate(root, shas.later);
        const res = checkSourcePin({ repo: root });
        expect(res.rows.every((r) => r.kind === 'PASS')).toBe(true);
        expect(res.rows[0].msg).toMatch(/EQUALS the default build bot_build's source\.commit/);
        expect(row(res, 'iii-c').msg).toMatch(/candidate next_build's source\.commit .* DESCENDS from the gitlink/);
        expect(spawnGate(root).status).toBe(0);
    });

    it('⛔ (iii-c) a candidate that does NOT descend from the gitlink → a named FAIL (an ancestor, and unrelated)', () => {
        for (const which of ['demo', 'side']) {
            const { root, shas } = fixture();
            withCandidate(root, shas[which]);
            const res = checkSourcePin({ repo: root });
            expect(row(res, 'iii-c')).toMatchObject({ kind: 'FAIL' });
            expect(row(res, 'iii-c').msg).toMatch(/candidate next_build's source\.commit .* does NOT descend from the gitlink/);
            expect(spawnGate(root).status).toBe(1);
        }
    });

    /**
     * ⛓ CI's shape (measured red at d90d1acaae, run 45062282013): the candidate's source lives on a SIDE branch of the
     * fork (p4h: `p4h-as3`), which a checkout of the gitlink never fetches, so the object is absent. The gate fetches
     * it once by SHA and then measures descent; one that no fetch can have stays a named FAIL.
     */
    it('⛓ (iii-c) a candidate source ABSENT from the checkout (a side branch) is fetched by SHA, then measured', () => {
        const { root, sub, shas } = fixture();
        const upstream = join(root, 'upstream-fork');
        forkRepo(upstream); // its shas may or may not equal the fixture's (timestamps) — so measure ITS shas
        const up = { pin: git(upstream, 'rev-parse', 'main~1'), later: git(upstream, 'rev-parse', 'main') };
        git(upstream, 'branch', '-q', '-f', 'cand', up.later);
        git(upstream, 'branch', '-q', '-f', 'main', up.pin);
        rmSync(sub, { recursive: true, force: true });
        git(root, 'clone', '-q', '--no-local', '--single-branch', '-b', 'main', `file://${upstream}`, sub);
        expect(() => git(sub, 'cat-file', '-e', `${up.later}^{commit}`), 'the precondition: the candidate is absent').toThrow();
        const m = JSON.parse(readFileSync(join(root, BUILDS_JSON), 'utf8'));
        for (const b of m.builds) if (b.role === 'default') b.source.commit = up.pin;
        m.builds = m.builds.filter((b) => b.role !== 'demo' || b.source.repo !== FORK);
        writeFileSync(join(root, BUILDS_JSON), JSON.stringify(m));
        git(root, 'update-index', '--cacheinfo', `160000,${up.pin},vendor/seedling`);
        git(root, 'commit', '-q', '--allow-empty', '-m', 'gitlink at the upstream pin');
        withCandidate(root, up.later);
        const res = checkSourcePin({ repo: root });
        expect(row(res, 'iii-c')).toMatchObject({ kind: 'PASS' });
        expect(row(res, 'iii-c').msg).toMatch(/DESCENDS from the gitlink .* \(fetched by SHA/);

        withCandidate(root, 'e'.repeat(40));
        const res2 = checkSourcePin({ repo: root });
        const missing = res2.rows.filter((r) => r.msg.includes('(iii-c)') && r.msg.includes('eeeeeee'));
        expect(missing).toHaveLength(1);
        expect(missing[0]).toMatchObject({ kind: 'FAIL' });
        expect(missing[0].msg).toMatch(/absent, and fetching it by SHA failed/);
        expect(shas.pin).toBeTruthy();
    });

    it('⛔ with a candidate, the DEFAULT\'s mismatch still reds (i), as without one', () => {
        const { root, shas } = fixture({ gitlink: 'later' });
        withCandidate(root, shas.later);
        const res = checkSourcePin({ repo: root });
        expect(res.rows[0]).toMatchObject({ kind: 'FAIL' });
        expect(res.rows[0].msg).toMatch(/is NOT the default build bot_build's source\.commit/);
    });

    it('an UNINITIALISED submodule (both) is a REFUSAL: SKIP, exit 0, 0/0/2', () => {
        const { root } = fixture({ initialised: false, release: false });
        const res = checkSourcePin({ repo: root });
        expect(res.refused).toBe(true);
        expect(res.rows[0].msg).toMatch(/submodule is not initialised — git submodule update --init vendor\/seedling/);
        const g = spawnGate(root);
        expect(g.head.value).toBe('0/0/2');
        expect(g.head.total).toMatch(/^ALL PASS — REFUSED/);
        expect(g.status).toBe(0);
    });

    it('no builds.json (the wasm submodule uninitialised) is a REFUSAL too', () => {
        const { root } = fixture({ withManifest: false });
        const res = checkSourcePin({ repo: root });
        expect(res).toMatchObject({ refused: true });
        expect(kinds(res.rows)).toEqual(['SKIP', 'SKIP']);
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
        expect(kinds(res.rows)).toEqual(['PASS', 'PASS', 'SKIP', 'PASS', 'PASS']);
        expect(res.rows[2].msg).toMatch(/SHALLOW clone/);
        expect(spawnGate(root).head.value).toBe('4/0/1');
    });

    // ── row (iv): swfrecomp-browser's release = the pinning build's recompiler (⚖ js-6) ──

    const row = (res, tag) => res.rows.find((r) => r.msg.startsWith(`(${tag}) `));

    it('(iv) EQUAL: the release\'s source.commit = the default build\'s source.recompiler, full SHAs named', () => {
        const res = checkSourcePin({ repo: fixture().root });
        expect(row(res, 'iv')).toMatchObject({ kind: 'PASS' });
        expect(row(res, 'iv').msg).toContain(`${RECOMP} EQUALS the default build bot_build's source.recompiler ${RECOMP}`);
    });

    it('⛔ (iv) UNEQUAL: a release from another recompiler commit → FAIL naming both SHAs and the remedy', () => {
        const rel = RELEASE_2();
        rel.source.commit = RECOMP_LATER;
        rel.source.buildInputsUnchanged.from = RECOMP_LATER;
        const { root } = fixture({ release: rel });
        const res = checkSourcePin({ repo: root });
        expect(row(res, 'iv')).toMatchObject({ kind: 'FAIL' });
        expect(row(res, 'iv').msg).toContain(RECOMP_LATER);
        expect(row(res, 'iv').msg).toContain(RECOMP);
        expect(row(res, 'iv').msg).toContain('re-release swfrecomp-browser from the default build\'s recompiler commit, '
            + 'or a re-pin (user-gated)');
        expect(spawnGate(root).status).toBe(1);
    });

    it('(iv) CANDIDATE: with a candidate pinned, the release is still held to THE DEFAULT\'s recompiler (⚖ js-22)', () => {
        const { root, shas } = fixture();
        withCandidate(root, shas.later);
        const m = JSON.parse(readFileSync(join(root, BUILDS_JSON), 'utf8'));
        m.builds.find((b) => b.role === 'candidate').source.recompiler = RECOMP_LATER;
        writeFileSync(join(root, BUILDS_JSON), JSON.stringify(m));
        let res = checkSourcePin({ repo: root });
        expect(row(res, 'iv')).toMatchObject({ kind: 'PASS' });
        expect(row(res, 'iv').msg).toMatch(/EQUALS the default build bot_build's source\.recompiler/);
        const rel = RELEASE_2();
        rel.source.commit = RECOMP_LATER;
        rel.source.buildInputsUnchanged.from = RECOMP_LATER;
        writeFileSync(join(root, RELEASE_JSON), JSON.stringify(rel));
        res = checkSourcePin({ repo: root });
        expect(row(res, 'iv')).toMatchObject({ kind: 'FAIL' });
        expect(row(res, 'iv').msg).toMatch(/is NOT the default build bot_build's source\.recompiler/);
    });

    it('(iv) ABSENT: the browser submodule uninitialised → SKIP by name; rows (i)–(iii) still answer, exit 0', () => {
        const { root } = fixture({ release: false });
        const res = checkSourcePin({ repo: root });
        expect(kinds(res.rows)).toEqual(['PASS', 'PASS', 'PASS', 'SKIP']);
        expect(res.refused).toBe(false);
        expect(row(res, 'iv').msg).toContain(`git submodule update --init ${BROWSER_SUBMODULE}`);
        const g = spawnGate(root);
        expect(g.head.value).toBe('3/0/1');
        expect(g.status).toBe(0);
    });

    it('⛔ (iv) UNSTAMPED: release.json present with no full-SHA source.commit → a named FAIL', () => {
        for (const commit of [undefined, '4c450f076', '']) {
            const rel = RELEASE_2();
            rel.source.commit = commit;
            const res = checkSourcePin({ repo: fixture({ release: rel }).root });
            expect(row(res, 'iv')).toMatchObject({ kind: 'FAIL' });
            expect(row(res, 'iv').msg).toMatch(/is UNSTAMPED/);
        }
        const res = checkSourcePin({ repo: fixture({ release: '{ not json' }).root });
        expect(row(res, 'iv')).toMatchObject({ kind: 'FAIL' });
    });

    it('⛔ (iv) a pinning build with no full-SHA source.recompiler → FAIL by name', () => {
        const res = checkSourcePin({ repo: fixture({ manifest: { recompiler: '4c450f0' } }).root });
        expect(row(res, 'iv')).toMatchObject({ kind: 'FAIL' });
        expect(row(res, 'iv').msg).toMatch(/records source\.recompiler "4c450f0", not a full SHA/);
    });

    // ── (iv-b): the offline sub-row — a page-only release's build inputs did not move ──

    it('(iv-b) ABSENT field = PASS (page and binaries from one commit)', () => {
        const rel = RELEASE_2();
        delete rel.source.buildInputsUnchanged;
        const res = checkSourcePin({ repo: fixture({ release: rel }).root });
        expect(row(res, 'iv-b')).toMatchObject({ kind: 'PASS' });
        expect(row(res, 'iv-b').msg).toMatch(/no source\.buildInputsUnchanged/);
    });

    it('(iv-b) diff ⊆ the checker\'s allowlist and from = source.commit → PASS (an empty diff too)', () => {
        expect(row(checkSourcePin({ repo: fixture().root }), 'iv-b')).toMatchObject({ kind: 'PASS' });
        const rel = RELEASE_2();
        rel.source.buildInputsUnchanged.diff = [];
        expect(row(checkSourcePin({ repo: fixture({ release: rel }).root }), 'iv-b')).toMatchObject({ kind: 'PASS' });
    });

    it('⛔ (iv-b) a diff path outside the checker\'s allowlist → FAIL, even when the release\'s OWN allowlist lists it', () => {
        const rel = RELEASE_2();
        const sneak = 'SWFModernRuntime/src/avm2/vm.c';
        rel.source.buildInputsUnchanged.diff.push(sneak);
        rel.source.buildInputsUnchanged.allowlist.push({ path: sneak, reason: 'trust me' });
        const res = checkSourcePin({ repo: fixture({ release: rel }).root });
        expect(row(res, 'iv-b')).toMatchObject({ kind: 'FAIL' });
        expect(row(res, 'iv-b').msg).toContain(`names ${sneak}, outside this checker's allowlist`);
        expect(row(res, 'iv')).toMatchObject({ kind: 'PASS' });
    });

    it('⛔ (iv-b) from ≠ source.commit, or no diff list → FAIL', () => {
        let rel = RELEASE_2();
        rel.source.buildInputsUnchanged.from = RECOMP_LATER;
        let res = checkSourcePin({ repo: fixture({ release: rel }).root });
        expect(row(res, 'iv-b')).toMatchObject({ kind: 'FAIL' });
        expect(row(res, 'iv-b').msg).toMatch(/its from .* is not source\.commit/);
        rel = RELEASE_2();
        delete rel.source.buildInputsUnchanged.diff;
        res = checkSourcePin({ repo: fixture({ release: rel }).root });
        expect(row(res, 'iv-b').msg).toMatch(/not a list of paths/);
    });

    it('(iv-b) with the browser submodule uninitialised there is no sub-row to answer (the (iv) SKIP names both)', () => {
        const res = checkSourcePin({ repo: fixture({ release: false }).root });
        expect(row(res, 'iv-b')).toBeUndefined();
        expect(row(res, 'iv').msg).toMatch(/\(iv\) and its sub-row cannot be asked/);
    });
});
