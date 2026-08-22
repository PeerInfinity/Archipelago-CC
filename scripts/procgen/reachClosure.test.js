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
import { mkdtempSync, writeFileSync } from 'node:fs';
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
    const changed = execFileSync('git', ['diff', '--name-only', RANGE],
        { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);

    it('the range still resolves and still names solverBot.js', () => {
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
