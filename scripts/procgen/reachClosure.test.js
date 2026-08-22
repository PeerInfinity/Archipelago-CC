/**
 * reachClosure — the reach instrument's own rows. R9 slice 11b, ⚖ ruling 32 B.
 *
 * Two kinds of row, and the second is the one that matters:
 *
 *  1. a SYNTHETIC three-file graph whose middle edge is the dynamic
 *     `import(join(HERE, '…'))` form — the shape that survives every grep for
 *     `from '…'` (trap 543). Remove the dynamic arm and this row goes red.
 *  2. the SLICE-11 REPRODUCTION, pinned to the real commit range. Slice 11's
 *     seal called the pairs dumps and the ENEMY census inert on a depth-1
 *     grep of the entry script and all four moved (kickoff §21.5, trap 555).
 *     This row asserts the closure names them. Cap the walk at depth 1 and it
 *     goes red.
 *
 * ⚠ Row 2 pins a HISTORICAL range (`70f14a502..5d8ded3b3`), which cannot
 * change — it is not a pin on today's tree and does not decay with one.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    REPO, UPPER_BOUND_SENTENCE,
    buildGraph, evalPathExpr, fileEdges, identityRows, loaderHelpers,
    partition, reachFrom, reachReport,
} from './reachClosure.js';

describe('the path expressions this repo actually writes', () => {
    const filePath = '/repo/scripts/procgen/x.mjs';
    const bindings = new Map([['REPO', '/repo'], ['HERE', '/repo/scripts/procgen']]);

    it('resolves join/dirname/fileURLToPath over import.meta.url', () => {
        expect(evalPathExpr("join(REPO, 'frontend/modules/a.js')", { filePath, bindings }))
            .toBe('/repo/frontend/modules/a.js');
        expect(evalPathExpr('dirname(fileURLToPath(import.meta.url))', { filePath, bindings }))
            .toBe('/repo/scripts/procgen');
    });

    it('resolves the URL spellings — pathToFileURL(...).href and new URL(...).pathname', () => {
        expect(evalPathExpr("pathToFileURL(join(REPO, 'a.js')).href", { filePath, bindings }))
            .toBe('file:///repo/a.js');
        expect(evalPathExpr("new URL('../..', import.meta.url).pathname", { filePath, bindings }))
            .toBe('/repo/');
    });

    it('returns null — never a guess — when a segment is a runtime value', () => {
        expect(evalPathExpr("join(REPO, 'frontend/modules/seedlingDemo', p)",
            { filePath, bindings })).toBeNull();
    });
});

describe('⛓⛓ the LOADER HELPER — the form that hid slice 11\'s four rows', () => {
    it('discovers `const M = (p) => import(join(REPO, …, p))` and resolves its call sites', () => {
        const src = [
            "const REPO = '/repo';",
            "const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));",
            "const mod = async (p) => import(pathToFileURL(join(REPO, p)).href);",
            "const { certify } = await M('procgenSeedling.js');",
            "const { x } = await mod('frontend/modules/seedlingDemo/solverBot.js');",
        ].join('\n');
        const helpers = loaderHelpers(src, '/repo/scripts/procgen/x.mjs');
        expect([...helpers.keys()]).toEqual(['M', 'mod']);
        const { specs } = fileEdges(src, '/repo/scripts/procgen/x.mjs');
        expect(specs).toContain('/repo/frontend/modules/seedlingDemo/procgenSeedling.js');
        expect(specs).toContain('file:///repo/frontend/modules/seedlingDemo/solverBot.js');
    });
});

describe('⛓ a synthetic three-file graph whose middle edge is DYNAMIC', () => {
    /**
     * c.js ──static──▶ b.js ──dynamic join()──▶ a.js
     *
     * A scanner that reads only `from '…'` sees the first edge and not the
     * second, so it reports a change to `a.js` as reaching NOTHING. The reach
     * has to be all three.
     */
    const dir = mkdtempSync(join(tmpdir(), 'reach-graph-'));
    writeFileSync(join(dir, 'a.js'), 'export const a = 1;\n');
    writeFileSync(join(dir, 'b.js'), [
        "import { dirname } from 'node:path';",
        "const HERE = dirname('" + join(dir, 'b.js') + "');",
        "export async function b() { return import(join(HERE, 'a.js')); }",
    ].join('\n'));
    writeFileSync(join(dir, 'c.js'), "import { b } from './b.js';\nexport const c = b;\n");
    const files = ['a.js', 'b.js', 'c.js'];

    it('reaches c.js from a.js THROUGH the dynamic import', () => {
        const graph = buildGraph({ repo: dir, files });
        expect([...graph.forward.get('b.js')]).toEqual(['a.js']);
        expect([...reachFrom(graph, ['a.js'])].sort()).toEqual(['a.js', 'b.js', 'c.js']);
    });

    it('and the static-only half alone would stop at b.js — the row DISCRIMINATES', () => {
        const graph = buildGraph({ repo: dir, files });
        // remove the dynamic edge by hand: what a `from '…'`-only scanner sees
        graph.reverse.get('a.js').delete('b.js');
        expect([...reachFrom(graph, ['a.js'])].sort()).toEqual(['a.js']);
    });
});

describe('⛔⛔ THE SLICE-11 REPRODUCTION — the four rows a depth-1 grep missed', () => {
    const RANGE = '70f14a502..5d8ded3b3';

    /**
     * ⛔⛔ THE SUBJECT IS A PINNED FILE LIST, NOT A `git diff`, AND THAT IS THE
     * FIX FOR A RED CI FOUND FIRST.
     *
     * The first cut ran `git diff --name-only 70f14a502..5d8ded3b3` in the
     * describe body. Locally that is a fact about history and cannot change;
     * on CI, whose checkout is SHALLOW, it is
     * `fatal: ambiguous argument … unknown revision`, thrown at collection time
     * — so the whole FILE errored and 16 rows vanished while the local run was
     * green. ⇒ the seven paths are pinned here as DATA (they are history; they
     * cannot drift), the reproduction runs everywhere, and the git call becomes
     * one row about the PIN's PROVENANCE which skips, by name, where there is
     * no history to ask.
     */
    const changed = Object.freeze([
        'frontend/modules/seedlingDemo/breakVerb.test.js',
        'frontend/modules/seedlingDemo/procgenCountableClock.test.js',
        'frontend/modules/seedlingDemo/procgenPostSword.test.js',
        'frontend/modules/seedlingDemo/procgenScratchPersistence.test.js',
        'frontend/modules/seedlingDemo/r8Acceptance.js',
        'frontend/modules/seedlingDemo/solverBot.js',
        'frontend/modules/seedlingDemo/watchGenOverlay.test.js',
    ]);

    /** The range's own file list, or null where the history is not present. */
    function rangeFiles() {
        try {
            return execFileSync('git', ['diff', '--name-only', RANGE],
                { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
                .split('\n').filter(Boolean);
        } catch {
            return null;
        }
    }

    it('the pinned list is the RANGE\'s own — or says why it could not ask', () => {
        const fromGit = rangeFiles();
        if (fromGit === null) {
            // ⚠ NOT a silent skip: the reason is asserted, so a broken `git`
            // cannot masquerade as a shallow clone.
            expect(() => execFileSync('git', ['rev-parse', '70f14a502^{commit}'],
                { cwd: REPO, stdio: 'ignore' })).toThrow();
            return;
        }
        expect([...fromGit].sort()).toEqual([...changed].sort());
    });

    it('the pinned subject names solverBot.js', () => {
        expect(changed).toContain('frontend/modules/seedlingDemo/solverBot.js');
    });

    it('names the FOUR identity rows slice 11 sealed as held, and they all moved', async () => {
        const report = await reachReport(changed, { repo: REPO });
        const labels = report.identity.map((r) => r.label);
        // §21.5's misses: the three pairs dumps and the ENEMY census, reached
        // through procgenSeedling.js:54 -> procgenOracle.js
        expect(labels).toEqual(expect.arrayContaining([
            'empty pairs c3', 'empty pairs c6', 'carved pairs c4', 'ENEMY census default',
        ]));
        const scripts = report.identity.map((r) => r.script);
        expect(scripts).toEqual(expect.arrayContaining([
            'scripts/procgen/dump-seedling-kind-pairs.mjs',
            'scripts/procgen/census-seedling-enemies.mjs',
        ]));
    });

    it('names the two producers that DID re-record, and their four tapes', async () => {
        const report = await reachReport(changed, { repo: REPO });
        expect(report.producers).toEqual(expect.arrayContaining([
            'scripts/procgen/solve-seedling-r8-l18.mjs',
            'scripts/procgen/solve-seedling-r8-d2-chain.mjs',
        ]));
        const tapes = report.tapes.map((t) => t.tape);
        expect(tapes).toEqual(expect.arrayContaining(
            ['r8-solve-18', 'r8-d2', 'r8-d2-19', 'r8-d2-20'],
        ));
        expect(report.chains).toContain('r8-d2');
    });

    /**
     * ⚖ RULING 33 — the roster gate's per-slice `--only=` comes from HERE. §16.11
     * derived slice 7's selection by hand as *"every tape whose own description
     * names a solve-seedling-* producer (22), plus the four non-solve witnesses
     * §14.0.13 keeps by name"*. The reach reproduces that 22 out of the graph.
     */
    it('⛓ the reached tapes, widened to whole chains, ARE §16.11\'s derived 22', async () => {
        const report = await reachReport(changed, { repo: REPO });
        const { PLAYTHROUGH_CHAINS } = await import(
            '../../frontend/modules/seedlingDemo/playthroughWalk.js');
        const names = new Set(report.tapes.map((t) => t.tape));
        for (const c of PLAYTHROUGH_CHAINS) {
            if (!report.chains.includes(c.id)) continue;
            for (const n of c.segments) names.add(n);
            names.add(c.headline);
        }
        expect(names.size).toBe(22);
        for (const n of ['r8-solve-18', 'r8-d2', 'r8-d2-19', 'r8-d2-20']) {
            expect([...names]).toContain(n);
        }
        // ⛔ a chain's siblings ride in even where the change did not reach their
        // own producer: a moved segment moves the headline it sums into.
        expect([...names]).toContain('r9-campaign');
    });

    it('⚠ and it is an UPPER BOUND: it also names rows slice 11 measured as HELD', async () => {
        const report = await reachReport(changed, { repo: REPO });
        const labels = report.identity.map((r) => r.label);
        // §21.5: the ELEMENTS census reaches the solver exactly the way the
        // ENEMY census does and did NOT move; `level post-sword s1` was the
        // seal's biggest candidate and HELD. Both are in the closure, and that
        // is the instrument being honest rather than wrong.
        expect(labels).toContain('guard census (elements)');
        expect(labels).toContain('level post-sword s1');
        expect(UPPER_BOUND_SENTENCE).toMatch(/CAN move, not what WILL/);
    });

    it('and the maze byte-identity row, which does NOT reach the solver, is absent', async () => {
        const report = await reachReport(changed, { repo: REPO });
        expect(report.identity.map((r) => r.label)).not.toContain('maze byte-identity');
    });
});

describe('⛔⛔ the edge that is NOT an import — a gate DRIVES a page', () => {
    /**
     * `check-seedling-editor-sequence.mjs` never imports `watch.html`; it
     * points a browser at it. Without this edge the closure answers "a change
     * to `watchViewer.js` reaches NO gate", which is a claim of INERTIA and is
     * false — and a short upper bound is worse than none.
     */
    it('a change to the page reaches the browser gates that drive it', async () => {
        const report = await reachReport(
            ['frontend/modules/seedlingDemo/watchViewer.js'], { repo: REPO },
        );
        expect(report.gates).toContain('scripts/procgen/check-seedling-editor-sequence.mjs');
        expect(report.gates).toContain('scripts/procgen/check-seedling-wasm-ship.mjs');
        expect(report.pages).toContain('frontend/modules/seedlingDemo/watch.html');
    });

    it('and the edge is DERIVED from the naming — no name, no edge', () => {
        const graph = buildGraph({ repo: REPO });
        const scripts = [...graph.nodes].filter((n) => n.startsWith('scripts/procgen/'));
        const silent = scripts.filter(
            (n) => !/[A-Za-z0-9_.-]+\.html\b/.test(readFileSync(join(REPO, n), 'utf8')));
        // non-vacuity: there really are scripts of both kinds
        expect(silent.length).toBeGreaterThan(10);
        expect(scripts.length - silent.length).toBeGreaterThan(10);
        for (const n of silent) {
            expect([...graph.forward.get(n)].filter((f) => f.endsWith('.html'))).toEqual([]);
        }
    });
});

describe('the partitions and the identity rows are derived, not typed', () => {
    it('a producer needs a --check to be called a producer', () => {
        const parts = partition(new Set([
            'scripts/procgen/solve-seedling-r8-l18.mjs',
            'scripts/procgen/check-seedling-wasm-ship.mjs',
            'frontend/modules/seedlingDemo/watchViewer.js',
            'frontend/modules/seedlingDemo/solverBot.test.js',
            'frontend/modules/seedlingDemo/solverBot.js',
        ]), { repo: REPO });
        expect(parts.producers).toEqual(['scripts/procgen/solve-seedling-r8-l18.mjs']);
        expect(parts.gates).toEqual(['scripts/procgen/check-seedling-wasm-ship.mjs']);
        expect(parts.pages).toEqual(['frontend/modules/seedlingDemo/watchViewer.js']);
        expect(parts.tests).toEqual(['frontend/modules/seedlingDemo/solverBot.test.js']);
        expect(parts.modules).toEqual(['frontend/modules/seedlingDemo/solverBot.js']);
    });

    it('identity-block rows come out of the shell, loop variables expanded', () => {
        const rows = identityRows({ repo: REPO });
        const labels = rows.map((r) => r.label);
        expect(labels).toContain('killgate s2');
        expect(labels).toContain('killgate s9');
        expect(labels).not.toContain('killgate s$s');
        expect(labels).toContain('solve-seedling-r9-campaign --check');
        // non-vacuity: every row names a script that is really in the tree
        for (const r of rows) expect(r.script).toMatch(/^scripts\/procgen\/[\w.-]+$/);
    });
});
