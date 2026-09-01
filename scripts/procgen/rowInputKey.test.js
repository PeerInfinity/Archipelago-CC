/**
 * rowInputKey — **THE FOUR POPULATIONS, AND THE DIRECTION EACH ONE FAILS IN**
 * (R9 slice SG2, ⚖ 71 (a) second stage).
 *
 * ⛔⛔ THE ROWS THAT MATTER ARE THE ONES ABOUT A MISSING INPUT. A byte key
 * tested only where it moves is a key nobody has gated: the defect that costs
 * a slice is the opposite one — a key that DOES NOT move when an input did,
 * which is a stale green riding forever with nothing on disk to disagree. So
 * every population here is exercised in both directions, and the digest rows
 * assert that a member the population is supposed to contain actually MOVES
 * the key.
 *
 * ⛓ The context is STUBBED. `keyContext` shells out to git and reads the
 * whole tree; a unit test that used it would be a test of this repository's
 * current file set rather than of the rule, and could not construct the one
 * case that matters (an input that moved).
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    DERIVED_DATA_EXCLUDED, POPULATIONS, digestOf, expandDeclared, globToRe, inputPopulations,
    keyInputsIn, keyReportLines, nondeterminismFinding, rowInputKey, rowRunDecision,
    spawnTargetsIn, stripComments, unkeyableReason,
} from './rowInputKey.js';
import { FILE as STANDING_VALUES, scriptIn, standingRows } from './standingValues.js';

/** A context whose every input is a literal — the only kind a rule can be
 *  tested against without testing the tree as well. */
function stubCtx({ files = {}, edges = {}, fixtures = [], submodules = [], gitlinks = {} } = {}) {
    const tracked = new Set([...Object.keys(files), ...fixtures]);
    const stems = new Map();
    for (const p of fixtures) {
        const stem = p.split('/').pop().replace(/\.json$/, '').replace(/\.trace$/, '');
        if (!stems.has(stem)) stems.set(stem, []);
        stems.get(stem).push(p);
    }
    const names = [...stems.keys()];
    const stemRe = names.length
        ? new RegExp(`(?<![A-Za-z0-9_-])(${names.join('|')})(?![A-Za-z0-9_-])`, 'g') : null;
    return {
        tracked,
        stems,
        stemRe,
        submodules,
        read: (rel) => files[rel] ?? '',
        hash: (rel) => `h(${files[rel] ?? 'ABSENT'})`,
        gitlink: (path) => gitlinks[path] ?? 'ABSENT',
        filesDirectlyUnder: (dir) => [...tracked].filter((p) =>
            p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/')
            && /\.(?:json|md|txt)$/.test(p)),
        forwardFrom: (seeds) => {
            const out = new Set();
            const queue = [...seeds].filter((s) => tracked.has(s));
            for (const s of queue) out.add(s);
            while (queue.length) {
                const cur = queue.pop();
                for (const d of edges[cur] ?? []) {
                    if (out.has(d)) continue;
                    out.add(d);
                    queue.push(d);
                }
            }
            return out;
        },
    };
}

describe('keyInputsIn — the declaration, and every malformed shape refused BY NAME', () => {
    it('reads one population declaration per line', () => {
        const d = keyInputsIn([
            '/**', ' * @key-inputs code: scripts/procgen/*.mjs',
            ' * @key-inputs data: a/b.json c/d.json', ' */'].join('\n'), { file: 'g.mjs' });
        expect(d.code).toEqual(['scripts/procgen/*.mjs']);
        expect(d.data).toEqual(['a/b.json', 'c/d.json']);
        expect(d.spawn).toEqual([]);
        expect(d.unkeyable).toBeNull();
    });

    /** ⛔ THE ANCHOR, which is the reason `gateRoster` spells its own tags the
     *  same way: the docblock that DEFINES the syntax must not read as a
     *  declaration of it. */
    it('does not read a mid-line mention of the tag as a declaration', () => {
        const d = keyInputsIn(' * the syntax is `@key-inputs data: <path>` — see below\n',
            { file: 'g.mjs' });
        expect(d.data).toEqual([]);
    });

    it('refuses an unknown population by name', () => {
        expect(() => keyInputsIn(' * @key-inputs tapes: a/b.json\n', { file: 'g.mjs' }))
            .toThrow(/not a population/);
    });

    it('refuses a malformed line rather than skipping it', () => {
        expect(() => keyInputsIn(' * @key-inputs code\n', { file: 'g.mjs' }))
            .toThrow(/malformed/);
    });

    /** ⛔ A prose right-hand side would hash nothing and report a population of
     *  ZERO — a stale green wearing a declaration. */
    it('refuses a prose right-hand side', () => {
        expect(() => keyInputsIn(' * @key-inputs data: everything the gate reads\n',
            { file: 'g.mjs' })).toThrow(/not a repo-relative path/);
    });

    it('reads an unkeyable declaration, and refuses a second one', () => {
        expect(keyInputsIn(' * @key-inputs unkeyable: it drives a live site\n',
            { file: 'g.mjs' }).unkeyable).toBe('it drives a live site');
        expect(() => keyInputsIn([' * @key-inputs unkeyable: a', ' * @key-inputs unkeyable: b']
            .join('\n'), { file: 'g.mjs' })).toThrow(/twice/);
    });
});

describe('globToRe / expandDeclared', () => {
    it('`*` does not cross a path separator and `**` does', () => {
        expect(globToRe('scripts/procgen/*.mjs').test('scripts/procgen/a.mjs')).toBe(true);
        expect(globToRe('scripts/procgen/*.mjs').test('scripts/procgen/sub/a.mjs')).toBe(false);
        expect(globToRe('scripts/**/*.mjs').test('scripts/procgen/sub/a.mjs')).toBe(true);
    });

    /** ⛔ A declaration that matches nothing is an input population somebody
     *  BELIEVES exists — the same failure `--key=` refuses a typo for. */
    it('refuses a pattern that selects no tracked file, by name', () => {
        expect(() => expandDeclared(['a/does-not-exist.json'], new Set(['a/b.json']),
            { file: 'g.mjs', population: 'data' })).toThrow(/matches NO tracked file/);
    });
});

describe('stripComments — the mention goes, the code stays', () => {
    it('drops docblock lines, `//` lines and inline block comments', () => {
        const src = ['/**', ' * see node scripts/procgen/mentioned.mjs', ' */',
            "const x = 'node scripts/procgen/real.mjs';",
            '// node scripts/procgen/commented.mjs'].join('\n');
        const out = stripComments(src);
        expect(out).toContain('real.mjs');
        expect(out).not.toContain('mentioned.mjs');
        expect(out).not.toContain('commented.mjs');
    });
});

describe('spawnTargetsIn — a reference, never a usage line', () => {
    const tracked = new Set(['scripts/procgen/gen.mjs', 'scripts/procgen/drive.py',
        'scripts/procgen/boxLock.js', 'scripts/procgen/reference/lib.mjs']);
    const of = (text, fromFile = 'scripts/procgen/check-x.mjs') =>
        [...spawnTargetsIn(text, { tracked, fromFile })].sort();

    it('takes a literal that IS the repo-relative path', () => {
        expect(of("join(REPO, 'scripts/procgen/gen.mjs')")).toEqual(['scripts/procgen/gen.mjs']);
    });

    it('takes a bare sibling literal, resolved against the file that spells it', () => {
        expect(of("execFileSync(PY, [join(HERE, 'drive.py')])"))
            .toEqual(['scripts/procgen/drive.py']);
    });

    it('takes a command line living in a string — the catalogue `cli` shape', () => {
        expect(of("cli: { command: 'node scripts/procgen/gen.mjs --seed=2' }"))
            .toEqual(['scripts/procgen/gen.mjs']);
    });

    /** ⛔⛔ THE MEASURED DEFECT: `reference/lib.mjs` EMITS a header quoting a
     *  command line, and that one mention dragged a 225-file closure in. */
    it('does NOT take a command line quoted inside a longer emitted string', () => {
        expect(of("const HEADER = '// GENERATED by scripts/procgen/gen.mjs — do not edit';"))
            .toEqual([]);
    });

    /** ⛔⛔ THE THREE COSTUMES A SPELLING-ONLY RULE WORE, each measured on
     *  this repo: a NAME LIST in a frozen array (`BOX_LOCK_HOLDERS`), a lock
     *  LABEL, and a markdown backtick pair inside a prose string, which a
     *  lexer reads as a template literal that is exactly a path. */
    it('does NOT take a filename from a NAME LIST', () => {
        expect(of("export const HOLDERS = Object.freeze(['gen.mjs', 'drive.py']);")).toEqual([]);
    });

    it('does NOT take a filename used as a LABEL', () => {
        expect(of("takeBoxLockOrExit({ name: 'gen.mjs', kind: 'browser' });")).toEqual([]);
    });

    it('does NOT take a backticked filename inside a prose string', () => {
        expect(of("const s = 'the gate `gen.mjs` imports the same module';")).toEqual([]);
    });

    /** ⛔ An import is population 1's business; counting it here would make
     *  SPAWN a superset of CODE and the two digests could never disagree. */
    it('does NOT take a `./` import specifier', () => {
        expect(of("import { takeBoxLock } from './boxLock.js';")).toEqual([]);
    });

    it('finds nothing outside the instrument directory', () => {
        expect(of("execFileSync('python', ['Generate.py'])")).toEqual([]);
    });
});

describe('digestOf — the PATH is in the digest, not only the content', () => {
    const ctx = stubCtx({ files: { 'a.js': 'X', 'b.js': 'X' } });
    it('two members with identical content but different paths digest differently', () => {
        expect(digestOf(['a.js'], { ctx, kind: 'code' }))
            .not.toBe(digestOf(['b.js'], { ctx, kind: 'code' }));
    });
    it('an empty population still has a digest', () => {
        expect(digestOf([], { ctx, kind: 'data' })).toMatch(/^[0-9a-f]{32}$/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE KEY — one row per population, in BOTH directions
 * ══════════════════════════════════════════════════════════════════════ */

const WORLD = {
    files: {
        'scripts/procgen/check-x.mjs': "import './dep.js';\nconst D = join(HERE, 'drive.py');"
            + "\nconst T = 'r9-tape-1';\n",
        'scripts/procgen/dep.js': 'export const a = 1;\n',
        'scripts/procgen/drive.py': 'print(1)\n',
        'scripts/procgen/far.js': 'export const b = 2;\n',
        'sub/mod/thing.js': 'export const c = 3;\n',
    },
    edges: {
        'scripts/procgen/check-x.mjs': ['scripts/procgen/dep.js'],
        'scripts/procgen/drive.py': [],
    },
    fixtures: ['fx/fixtures/tapes/r9-tape-1.json', 'fx/fixtures/tapes/r9-tape-2.json'],
    submodules: ['sub/mod'],
    gitlinks: { 'sub/mod': 'aaaa' },
};
const ENTRY = 'scripts/procgen/check-x.mjs';
const keyOf = (world) => rowInputKey({ entry: ENTRY, ctx: stubCtx(world) }).key;

describe('rowInputKey — every population moves the key, and nothing else does', () => {
    it('enumerates all four populations, in one stable order', () => {
        const r = rowInputKey({ entry: ENTRY, ctx: stubCtx(WORLD) });
        expect(r.populations.map((p) => p.name)).toEqual([...POPULATIONS]);
        expect(r.key).toMatch(/^[0-9a-f]{32}$/);
    });

    it('is stable across two computations over the same bytes', () => {
        expect(keyOf(WORLD)).toBe(keyOf(WORLD));
    });

    /** 1 CODE — a transitively imported file. */
    it('MOVES when a transitively imported file moves', () => {
        const w = { ...WORLD, files: { ...WORLD.files, 'scripts/procgen/dep.js': 'export const a = 2;\n' } };
        expect(keyOf(w)).not.toBe(keyOf(WORLD));
    });

    /** 2 DATA — a fixture the closure names by stem. */
    it('MOVES when a fixture the closure NAMES moves', () => {
        const w = { ...WORLD };
        const ctxA = stubCtx(w);
        const before = rowInputKey({ entry: ENTRY, ctx: ctxA });
        const ctxB = stubCtx(w);
        ctxB.hash = (rel) => (rel === 'fx/fixtures/tapes/r9-tape-1.json' ? 'MOVED' : `h(${rel})`);
        expect(rowInputKey({ entry: ENTRY, ctx: ctxB }).key).not.toBe(before.key);
    });

    /** ⛔ …and the fixture it does NOT name is not in the population at all. */
    it('does not contain a fixture nothing in the closure names', () => {
        const pops = inputPopulations({ entry: ENTRY, ctx: stubCtx(WORLD) });
        expect(pops.data).toContain('fx/fixtures/tapes/r9-tape-1.json');
        expect(pops.data).not.toContain('fx/fixtures/tapes/r9-tape-2.json');
    });

    /** 3 SPAWN — the driver, invisible to any import sweep (trap 901). */
    it('MOVES when the spawned driver moves, which no import reaches', () => {
        const w = { ...WORLD, files: { ...WORLD.files, 'scripts/procgen/drive.py': 'print(2)\n' } };
        expect(inputPopulations({ entry: ENTRY, ctx: stubCtx(w) }).spawn)
            .toContain('scripts/procgen/drive.py');
        expect(keyOf(w)).not.toBe(keyOf(WORLD));
    });

    /** 4 BUILD — the gitlink, which is bytes no file in the tree holds. */
    it('MOVES when a reached submodule gitlink moves', () => {
        const reach = { ...WORLD,
            files: { ...WORLD.files,
                'scripts/procgen/dep.js': "import '../../sub/mod/thing.js';\n" },
            edges: { ...WORLD.edges, 'scripts/procgen/dep.js': ['sub/mod/thing.js'] } };
        const before = keyOf(reach);
        expect(inputPopulations({ entry: ENTRY, ctx: stubCtx(reach) }).build).toEqual(['sub/mod']);
        expect(keyOf({ ...reach, gitlinks: { 'sub/mod': 'bbbb' } })).not.toBe(before);
    });

    /** ⛔⛔ …AND A SUBMODULE REACHED BY NAME ALONE IS STILL AN INPUT — the
     *  BUILD mutant's own lesson. In a tree where the submodule is NOT checked
     *  out none of its files is tracked, so CONTAINMENT finds nothing and the
     *  population is empty: the first run of that mutant moved 0 of 34 keys.
     *  A file that spells a path INTO the submodule is the reading that
     *  survives a checkout state. */
    it('MOVES on a gitlink reached by NAME, with no file of it in any population', () => {
        const named = { ...WORLD,
            files: { ...WORLD.files,
                'scripts/procgen/dep.js': "const P = 'sub/mod/game.html';\n" } };
        expect(inputPopulations({ entry: ENTRY, ctx: stubCtx(named) }).code)
            .not.toContain('sub/mod/thing.js');
        expect(inputPopulations({ entry: ENTRY, ctx: stubCtx(named) }).build).toEqual(['sub/mod']);
        expect(keyOf({ ...named, gitlinks: { 'sub/mod': 'bbbb' } })).not.toBe(keyOf(named));
    });

    /** ⛓ …but the BARE directory name in prose is not a reach. */
    it('does NOT take a submodule named only in a comment', () => {
        const mentioned = { ...WORLD,
            files: { ...WORLD.files, 'scripts/procgen/dep.js': '// see sub/mod/notes\n' } };
        expect(inputPopulations({ entry: ENTRY, ctx: stubCtx(mentioned) }).build).toEqual([]);
    });

    /** ⛔ …and a submodule this row does NOT reach into is not its input. */
    it('does not carry the gitlink of a submodule it never reaches', () => {
        expect(inputPopulations({ entry: ENTRY, ctx: stubCtx(WORLD) }).build).toEqual([]);
    });

    /** ⛔⛔ THE NEGATIVE, which is the whole economy: an unrelated file that no
     *  population contains must move NO key. */
    it('does NOT move when an unreached file moves', () => {
        const w = { ...WORLD, files: { ...WORLD.files, 'scripts/procgen/far.js': 'CHANGED\n' } };
        expect(keyOf(w)).toBe(keyOf(WORLD));
    });

    it('a declared code seed carries its own closure into the population', () => {
        const w = { ...WORLD,
            edges: { ...WORLD.edges, 'scripts/procgen/far.js': ['sub/mod/thing.js'] } };
        const declared = { code: ['scripts/procgen/far.js'], data: [], spawn: [], build: [],
            unkeyable: null };
        const pops = inputPopulations({ entry: ENTRY, declared, ctx: stubCtx(w) });
        expect(pops.code).toContain('scripts/procgen/far.js');
        expect(pops.code).toContain('sub/mod/thing.js');
    });
});

describe('keyReportLines — mitigation 1: the populations are answerable from the log', () => {
    it('names every population with a count and a digest', () => {
        const lines = keyReportLines(rowInputKey({ entry: ENTRY, ctx: stubCtx(WORLD) }));
        expect(lines).toHaveLength(POPULATIONS.length);
        for (const p of POPULATIONS) {
            expect(lines.some((l) => l.includes(p) && /[0-9a-f]{32}/.test(l))).toBe(true);
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE DECISION AND THE DETECTOR — the half a 56-minute battery would gate
 * ══════════════════════════════════════════════════════════════════════ */

describe('rowRunDecision — every way a row runs, and the one way it does not', () => {
    const K = { key: 'abc' };
    it('runs an UNKEYED row and says why', () => {
        const d = rowRunDecision({ keyRep: { key: null, unkeyable: 'a live site' }, banked: null });
        expect(d.run).toBe(true);
        expect(d.reason).toContain('a live site');
    });

    it('runs a row with nothing banked', () => {
        expect(rowRunDecision({ keyRep: K, banked: null })).toMatchObject({ run: true,
            unmoved: false });
    });

    it('runs a row whose key MOVED, naming the key it had', () => {
        const d = rowRunDecision({ keyRep: K, banked: 'xyz' });
        expect(d.run).toBe(true);
        expect(d.reason).toContain('xyz');
    });

    /** ⛔ THE ONE SKIP — and it is the whole economy of ⚖ 71 (a). */
    it('does NOT run a row whose key is unmoved', () => {
        expect(rowRunDecision({ keyRep: K, banked: 'abc' }))
            .toEqual({ run: false, unmoved: true, reason: 'key unmoved' });
    });

    /** ⛔⛔ …and BOTH overrides re-run it, each with its own attributable
     *  reason: a forced re-measure and a deliberate detector drive are not the
     *  same run and a log that called them both "re-run" would lose which. */
    it('runs an unmoved row when FORCED, and separately when RE-DRIVEN', () => {
        expect(rowRunDecision({ keyRep: K, banked: 'abc', forced: true }))
            .toMatchObject({ run: true, unmoved: true, reason: 'key unmoved, FORCED' });
        expect(rowRunDecision({ keyRep: K, banked: 'abc', redriveUnchanged: true }).reason)
            .toContain('--redrive-unchanged');
    });
});

describe('nondeterminismFinding — mitigation 2', () => {
    const prev = { value: '265/0', measuredAt: 'aaa' };
    it('fires when a re-drive at an UNMOVED key reads a different verdict', () => {
        const f = nondeterminismFinding({ unmoved: true, prev,
            result: { value: '264/1', exit: 1, ms: 12 }, at: 'bbb' });
        expect(f).toMatchObject({ at: 'bbb', was: '265/0', now: '264/1' });
    });

    /** ⛔ A moved key explains a moved verdict — that is a MEASUREMENT, not a
     *  finding, and filing it as one would make the detector cry wolf on every
     *  ordinary re-run. */
    it('does NOT fire when the key moved', () => {
        expect(nondeterminismFinding({ unmoved: false, prev,
            result: { value: '264/1' }, at: 'bbb' })).toBeNull();
    });

    it('does NOT fire when the verdict agrees', () => {
        expect(nondeterminismFinding({ unmoved: true, prev,
            result: { value: '265/0' }, at: 'bbb' })).toBeNull();
    });

    it('does NOT fire on a row nothing was banked for', () => {
        expect(nondeterminismFinding({ unmoved: true, prev: undefined,
            result: { value: '265/0' }, at: 'bbb' })).toBeNull();
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE DOCS INPUT — found by the NEGATIVE control, which is what one is for
 * ══════════════════════════════════════════════════════════════════════ */

describe('markdown and directory inputs — an instrument READS, everything else CITES', () => {
    const world = {
        files: {
            'scripts/procgen/check-y.mjs': "import './ref.mjs';\nimport '../../frontend/m/g.js';\n",
            'scripts/procgen/ref.mjs': "const DOC = 'docs/dev/one.md';\n"
                + "const DIR = 'docs/dev';\n",
            'frontend/m/g.js': "const cite = 'docs/dev/two.md';\n",
        },
        edges: { 'scripts/procgen/check-y.mjs': ['scripts/procgen/ref.mjs', 'frontend/m/g.js'] },
        fixtures: [],
    };
    const tracked = ['docs/dev/one.md', 'docs/dev/two.md', 'docs/dev/deep/three.md'];
    const ctxOf = () => {
        const c = stubCtx({ ...world });
        for (const t of tracked) c.tracked.add(t);
        return c;
    };
    const dataOf = () => inputPopulations({ entry: 'scripts/procgen/check-y.mjs',
        ctx: ctxOf() }).data;

    /** ⛔⛔ THE STALE GREEN THE NEGATIVE CONTROL FOUND: a doc an instrument
     *  OPENS is an input, and a key blind to it quotes the row forever. */
    it('takes a `.md` an INSTRUMENT names', () => {
        expect(dataOf()).toContain('docs/dev/one.md');
    });

    /** ⛔ …and the directory an instrument names, one level, since that is
     *  what `readdirSync` returns. */
    it('takes the files DIRECTLY under a directory an instrument names, not below', () => {
        expect(dataOf()).toContain('docs/dev/two.md');
        expect(dataOf()).not.toContain('docs/dev/deep/three.md');
    });

    /** ⛔⛔ AND THE OTHER DIRECTION, which is the economy: measured, counting a
     *  frontend module's CITATION pulled all 30 `*.md` into 27 rows and would
     *  have re-run 1709 s of wasm playback on a docs-only commit. */
    it('does NOT take a `.md` named only by a FRONTEND module', () => {
        const only = { ...world,
            files: { ...world.files, 'scripts/procgen/ref.mjs': 'export const a = 1;\n' } };
        const c = stubCtx(only);
        for (const t of tracked) c.tracked.add(t);
        expect(inputPopulations({ entry: 'scripts/procgen/check-y.mjs', ctx: c }).data)
            .not.toContain('docs/dev/two.md');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE WRITER'S OWN OUTPUT — ⚖ 72 (c), R9 slice S1
 *
 * ⛔⛔ THE MUTANT PAIR, AND BOTH HALVES ARE LOAD-BEARING. Half one is the
 * headline: the bank leaves the derived populations. Half two is the
 * NEGATIVE CONTROL (trap 1018 — *a negative control finds a stale green*,
 * found on this very key machinery): an exclusion that accidentally emptied
 * the whole `data` population would pass half one perfectly and destroy the
 * mechanism. So every row below that asserts an ABSENCE is paired with one
 * asserting the presences around it.
 *
 * ⛓ Measured on the real tree at `2f46ba941`, with `--keys` before and after
 * and every row's key diffed: touching the bank moved **31 of 34** keyed rows
 * before and **2** after — exactly `seedling-full-tier-owed` and
 * `slice-records`, the two that declare it. Touching a real data member of a
 * wasm row (`frontend/modules/flashPanel/games/seedling.json`) moved **29**
 * rows before AND after, the same 29 by name. These stubs are that pair,
 * bounded to the rule.
 * ══════════════════════════════════════════════════════════════════════ */

describe("the writer's own output is not one of its inputs", () => {
    const OTHER = 'scripts/procgen/some-baseline.json';
    const world = {
        files: {
            'scripts/procgen/check-b.mjs': "import './r.js';\n",
            /** ⛓ BOTH routes in, because the bank used both: the DIRECTORY
             *  literal (29 rows, via `gateRoster.js`'s `'scripts/procgen'`)
             *  and the PATH literal (the 2 rows that spell it). */
            'scripts/procgen/r.js': "const DIR = 'scripts/procgen';\n"
                + `const B = '${STANDING_VALUES}';\n`,
        },
        edges: { 'scripts/procgen/check-b.mjs': ['scripts/procgen/r.js'] },
        fixtures: [],
    };
    const ctxOf = () => {
        const c = stubCtx(world);
        c.tracked.add(STANDING_VALUES);
        c.tracked.add(OTHER);
        return c;
    };
    const ENTRY_B = 'scripts/procgen/check-b.mjs';
    const declaringIt = { code: [], data: [STANDING_VALUES], spawn: [], build: [],
        unkeyable: null };
    /** ⛓ The bank's BYTES, moved — the only thing a touch of it changes. */
    const moved = (ctx) => {
        const c = { ...ctx };
        c.hash = (rel) => (rel === STANDING_VALUES ? 'MOVED' : ctx.hash(rel));
        return c;
    };

    /** ⛔ THE CONSTANT IS THE WRITER'S, NOT A COPY OF ITS SPELLING. A literal
     *  retyped here would go stale the day the bank moves and the exclusion
     *  would silently stop excluding. */
    it('excludes exactly the path `standingValues` itself declares', () => {
        expect(DERIVED_DATA_EXCLUDED).toBe(STANDING_VALUES);
    });

    /** 1 THE HEADLINE — neither derived route puts it in the population. */
    it('is in NO derived data population, by either route that put it there', () => {
        expect(inputPopulations({ entry: ENTRY_B, ctx: ctxOf() }).data)
            .not.toContain(STANDING_VALUES);
    });

    /** ⛔⛔ 2 THE NEGATIVE CONTROL, at the unit level: the directory rule that
     *  carried the bank in still carries everything else. An exclusion that
     *  emptied `data` would pass the row above and fail here. */
    it('leaves every OTHER file the directory rule finds in the population', () => {
        expect(inputPopulations({ entry: ENTRY_B, ctx: ctxOf() }).data).toContain(OTHER);
    });

    it('does NOT move the key when the bank alone moves', () => {
        const ctx = ctxOf();
        expect(rowInputKey({ entry: ENTRY_B, ctx: moved(ctx) }).key)
            .toBe(rowInputKey({ entry: ENTRY_B, ctx }).key);
    });

    /** ⛔ …and the same tree, same rule, with the OTHER data file moved: the
     *  key MUST move. This is the second half of the control — "unmoved" is
     *  only meaningful from a context that can move. */
    it('DOES move the key when a data member that is not the bank moves', () => {
        const ctx = ctxOf();
        const other = { ...ctx, hash: (rel) => (rel === OTHER ? 'MOVED' : ctx.hash(rel)) };
        expect(rowInputKey({ entry: ENTRY_B, ctx: other }).key)
            .not.toBe(rowInputKey({ entry: ENTRY_B, ctx }).key);
    });

    /** ⛔⛔ 3 THE DECLARATION SURVIVES THE EXCLUSION — the whole reason this is
     *  safe. A row whose SUBJECT is the bank says so, and then it keys on it
     *  again; without this the two rows the bank can falsify would be quoted
     *  forever, which is the stale green the exclusion must not buy. */
    it('keeps it for a row that DECLARES it, and that row moves when it moves', () => {
        const ctx = ctxOf();
        expect(inputPopulations({ entry: ENTRY_B, declared: declaringIt, ctx }).data)
            .toContain(STANDING_VALUES);
        expect(rowInputKey({ entry: ENTRY_B, declared: declaringIt, ctx: moved(ctx) }).key)
            .not.toBe(rowInputKey({ entry: ENTRY_B, declared: declaringIt, ctx }).key);
    });

    /** ⛓ …and the two gates that carry that declaration on disk are the two
     *  the real-tree mutant named. A declaration nobody parses is an input
     *  population that silently does not exist. */
    it('is declared by the two gates whose SUBJECT it is', () => {
        for (const gate of ['./check-seedling-full-tier-owed.mjs', './check-slice-records.mjs']) {
            const text = readFileSync(new URL(gate, import.meta.url), 'utf8');
            expect(keyInputsIn(text, { file: gate }).data).toContain(STANDING_VALUES);
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * WHICH ROWS MAY BE KEYED AT ALL — ⚖ 72's ladder, R9 slice S2
 *
 * ⛔⛔ THE ROW THAT MATTERS IS THE FIRST ONE. `unkeyableReason` used to open
 * with `row.kind !== 'gate'`, and the 30 identity/producer rows it refused
 * cost **1,078,564 ms = 18.0 min** of banked `ms` on EVERY `--write`.
 *
 * ⛓⛓ MEASURED RED-FIRST, against a module carrying that clause again: FOUR
 * rows fail and 58 pass — the headline below, and three in the roster
 * describe (`leaves NO identity row unkeyable`, `still refuses the CI-read
 * suite row` — the suite row is `kind: ci-suite`, so the old clause answered
 * it for the wrong reason — and `gives every row sharing an entry the same
 * keyability answer`, which is red because ONE shared entry crosses kinds:
 * `check-seedling-generated-set.mjs` carries both `identity: generated set`
 * and `gate: seedling-generated-set`, and the old clause split them). ⛔ The
 * clauses that STAYED are asserted on GATE rows on purpose, so they are green
 * on both sides and the red set is attributable to the one clause that moved.
 * ══════════════════════════════════════════════════════════════════════ */

describe('unkeyableReason — the clause set, and the one S2 removed', () => {
    const identity = { kind: 'identity', shell: true,
        command: 'node scripts/procgen/dump-seedling-kind-pairs.mjs --kind=empty --count=3' };
    /** ⛓ A GATE row for the clauses that stayed — see the header: they must be
     *  green against the pre-S2 module too, or the red set says nothing about
     *  which clause moved. */
    const gate = { kind: 'gate', command: 'node scripts/procgen/check-procgen-docs.mjs' };

    /** ⛔ THE HEADLINE. An identity row naming an instrument IS keyable. */
    it('KEYS an identity row — the `kind !== gate` clause is gone', () => {
        expect(unkeyableReason(identity, {})).toBeNull();
    });

    it('refuses an alwaysQuoted row, and a CI-sourced one, by the same reason', () => {
        expect(unkeyableReason({ ...gate, alwaysQuoted: true }, {}))
            .toMatch(/reads CI by SHA/);
        expect(unkeyableReason(gate, { fromCI: true })).toMatch(/reads CI by SHA/);
    });

    it('refuses a row whose command names a REMOTE ORIGIN', () => {
        expect(unkeyableReason({ ...gate,
            command: 'node scripts/procgen/check-x.mjs --pages=https://example.invalid' }, {}))
            .toMatch(/REMOTE ORIGIN/);
    });

    it('refuses a gate that DECLARES itself unkeyable, carrying its reason', () => {
        expect(unkeyableReason(gate, { declared: { unkeyable: 'it drives a live site' } }))
            .toBe('declared by the gate: it drives a live site');
    });

    it('refuses a row that names no instrument in this directory', () => {
        expect(unkeyableReason({ kind: 'gate', command: 'md5sum frontend/x.js' }, {}))
            .toMatch(/names no script/);
    });

    /** ⛓⛓ …and the ORDER of the first two clauses is load-bearing: a row that
     *  is BOTH quoted and scriptless must say the CI reason, because that is
     *  the one the writer's KEEP branch acts on. */
    it('answers with the CI reason first when two clauses could both fire', () => {
        expect(unkeyableReason({ kind: 'gate', alwaysQuoted: true, command: 'true' }, {}))
            .toMatch(/reads CI by SHA/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * …AGAINST THE LIVE ROSTER, because a count nobody checks goes stale green.
 *
 * ⛓ Two counts in this arc were wrong-and-green (the plan's "30 of 33", a
 * test comment's "three catalogue entries"), and both survived because they
 * were PROSE. These assert the same claims as PROPERTIES derived from the
 * roster, so a new row or a re-worded command re-derives them instead of
 * contradicting a sentence.
 * ══════════════════════════════════════════════════════════════════════ */

describe('the roster S2 actually keys', () => {
    const rows = standingRows();

    /** ⛔ EVERY identity/producer row is keyable — the 18 minutes, as a claim
     *  something re-checks. A new identity row whose command names no
     *  instrument would land here rather than in a `--write` log. */
    it('leaves NO identity row unkeyable, and there is at least one to leave', () => {
        const identity = rows.filter((r) => r.kind === 'identity');
        expect(identity.length).toBeGreaterThan(0);
        expect(identity.filter((r) => unkeyableReason(r, {})).map((r) => r.key)).toEqual([]);
    });

    /** ⛓ …and the one row that stays unkeyable stays so for the STATED
     *  reason, not by accident of a clause that no longer exists. */
    it('still refuses the CI-read suite row, by its recipe', () => {
        const suite = rows.filter((r) => r.alwaysQuoted);
        expect(suite.length).toBeGreaterThan(0);
        for (const r of suite) expect(unkeyableReason(r, {})).toMatch(/reads CI by SHA/);
    });

    /**
     * ⚠⚠ SHARED ENTRIES — STATED AS A PROPERTY SO THE NEXT READER MEETS IT AS
     * A DESIGN AND NOT AS A BUG. Eight identity rows run three scripts under
     * different FLAGS, so their keys are IDENTICAL. If one of a group is owed
     * a re-drive all of them are, which is the conservative direction. ⛓ The
     * groups are DERIVED here, never named: the assertion is that a group's
     * members agree about being keyable, and the guard below is that a group
     * exists at all (trap 824 — a vacuous green).
     */
    it('gives every row sharing an entry the same keyability answer', () => {
        const groups = new Map();
        for (const r of rows) {
            const e = scriptIn(r.command);
            if (!e) continue;
            if (!groups.has(e)) groups.set(e, []);
            groups.get(e).push(r);
        }
        const shared = [...groups.values()].filter((g) => g.length > 1);
        expect(shared.length).toBeGreaterThan(0);
        for (const g of shared) {
            expect(new Set(g.map((r) => unkeyableReason(r, {}) ?? 'KEYED')).size).toBe(1);
        }
    });

    /** ⛔⛔ …and the reason those keys collide, at the unit level: THE KEY IS A
     *  FUNCTION OF THE ENTRY, NOT OF THE COMMAND. This is the row that fails
     *  the day somebody "fixes" the collision by hashing the flags in — which
     *  would move all three keys whenever anybody re-words a flag, buying
     *  re-drives for no change in bytes. */
    it('keys two rows that share an entry identically, whatever their flags', () => {
        const ctx = stubCtx({ files: { 'scripts/procgen/dump-x.mjs': 'export const a = 1;\n' },
            edges: {}, fixtures: [] });
        const a = rowInputKey({ entry: 'scripts/procgen/dump-x.mjs', ctx });
        const b = rowInputKey({ entry: 'scripts/procgen/dump-x.mjs', ctx });
        expect(a.key).toBe(b.key);
    });
});
