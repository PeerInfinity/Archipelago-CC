/**
 * seedlingConstantsCensus — **THE GATE OVER THE SEEDLING CONSTANTS CENSUS**
 * (engine-prep arc, slice A1, D5).
 *
 *   (i)   the committed census agrees with a fresh one — `--check`'s logic,
 *         `checkCensus()`, not a copy of it;
 *   (ii)  zero `unclassified` rows, every physics/rule row carries a kind and
 *         no other row does, no two reviewed targets tie, none is dead;
 *   (iii) the key is LINE-INDEPENDENT — blank lines inserted above statements
 *         in a temp copy move lines and no key;
 *   (iv)  the positions, the unary minus and the key's unit on synthetic
 *         sources;
 *   and the three MUTANTS, each in a temp copy of the closure, never in the
 *   tree, each with its verdict predicted in its title.
 *
 * ⛓ `vendor/seedling` is read only by the anchor row, which SKIPS BY NAME when
 * the submodule is absent; the other rows run without it (the as3 column is
 * then not compared — `checkCensus` says so; the doc region renders the
 * COMMITTED rows, anchors included, so it needs no AS3 source).
 */
import {
    copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { checkCensus } from './census-seedling-constants.mjs';
import {
    AS3_SRC, CENSUS_CSV, DOC_MD, FIELDS_CSV, GUARDED, KINDS, REGION_BEGIN, as3Declarations, buildClosure,
    md5h8, parseCsv, rowsOfFile,
} from './seedlingConstantsCensus.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HAS_AS3 = existsSync(join(REPO, AS3_SRC));
const PHYS1 = 'frontend/modules/seedlingDemo/playerPhysicsV1.js';

const temps = [];
afterAll(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }); });

/** A temp copy of the closure plus the three census files (and a link to the AS3 source). */
function tempCopy() {
    const dir = mkdtempSync(join(tmpdir(), 'seedling-census-'));
    temps.push(dir);
    const put = (rel) => {
        mkdirSync(dirname(join(dir, rel)), { recursive: true });
        copyFileSync(join(REPO, rel), join(dir, rel));
    };
    for (const { file } of buildClosure(REPO)) put(file);
    for (const rel of [FIELDS_CSV, CENSUS_CSV, DOC_MD]) put(rel);
    if (HAS_AS3) {
        mkdirSync(dirname(join(dir, AS3_SRC)), { recursive: true });
        symlinkSync(join(REPO, AS3_SRC), join(dir, AS3_SRC));
    }
    return dir;
}

/** Replace exactly one occurrence of `from` in `rel` under `dir`. */
function edit(dir, rel, from, to) {
    const p = join(dir, rel);
    const src = readFileSync(p, 'utf8');
    expect(src.split(from).length - 1, `the mutant's anchor text occurs once in ${rel}`).toBe(1);
    writeFileSync(p, src.replace(from, to));
}

const tree = checkCensus(REPO);

describe('(i) the committed census is current — --check over the tree', () => {
    it('no RED item: no new physics/rule/unclassified literal, nothing to retire, nothing stale', () => {
        expect(tree.diff.red).toEqual([]);
        expect(tree.census.ambiguous).toEqual([]);
    });

    it('the doc region is the render of the committed census', () => {
        expect(tree.docStale).toBe(false);
    });

    it('drift that is GREEN by design is reported, not failed (cosmetic/structural churn, moved lines)', () => {
        expect(tree.diff.green.every((g) => ['new', 'vanished', 'moved'].includes(g.why))).toBe(true);
        expect(tree.diff.green.filter((g) => g.why !== 'moved').every((g) => !GUARDED.has(g.class))).toBe(true);
    });
});

describe('(ii) the classification is complete and well-formed', () => {
    const rows = tree.census.rows;

    it('zero unclassified rows', () => {
        expect(rows.filter((r) => r.class === 'unclassified').map((r) => r.key)).toEqual([]);
    });

    it('every physics/rule row has a kind; no cosmetic/structural row has one', () => {
        expect(rows.filter((r) => GUARDED.has(r.class) && !KINDS.includes(r.kind)).map((r) => r.key)).toEqual([]);
        expect(rows.filter((r) => !GUARDED.has(r.class) && r.kind).map((r) => r.key)).toEqual([]);
    });

    it('every derivation row names its sources in its note', () => {
        expect(rows.filter((r) => r.kind === 'derivation' && !r.note.trim()).map((r) => r.key)).toEqual([]);
    });

    it('every reviewed target reaches at least one row', () => {
        expect(tree.census.unusedTargets).toEqual([]);
    });

    it('keys are unique', () => {
        expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    });
});

describe('(iii) the key does not carry the line', () => {
    it('blank lines inserted above statements in a temp copy move lines and no key', () => {
        const dir = tempCopy();
        const rel = 'frontend/modules/seedlingDemo/levelRun.js';
        const src = readFileSync(join(dir, rel), 'utf8');
        // a blank line above EVERY top-level `export` and the first `const` of every line-leading run
        writeFileSync(join(dir, rel), src.replace(/\nexport /g, '\n\nexport ').replace(/\n(\s+)const /g, '\n\n$1const '));
        writeFileSync(join(dir, PHYS1), `\n\n\n${readFileSync(join(dir, PHYS1), 'utf8')}`);
        const moved = checkCensus(dir);
        expect(moved.diff.red).toEqual([]);
        const keysA = tree.census.rows.map((r) => r.key);
        const keysB = moved.census.rows.map((r) => r.key);
        expect(keysB).toEqual(keysA);
        const shifted = moved.diff.green.filter((g) => g.why === 'moved').length;
        expect(shifted, 'the edit really moved lines').toBeGreaterThan(400);
    });
});

describe('(iv) positions, the unary minus and the unit, on synthetic sources', () => {
    const rowsOf = (src) => rowsOfFile('x.js', src);
    const one = (src) => {
        const r = rowsOf(src);
        expect(r).toHaveLength(1);
        return r[0];
    };

    it('scalar: a top-level UPPER const initialised to a number or a negated number', () => {
        expect(one('export const SPEED = 0.5;')).toMatchObject({ position: 'scalar', literal: '0.5', enclosing: 'SPEED', function: '(module)' });
        expect(one('const NEG = -3;')).toMatchObject({ position: 'scalar', literal: '-3', value: -3 });
        expect(one('const H = 0x10;')).toMatchObject({ position: 'scalar', literal: '0x10', value: 16 });
        expect(one('const R = 0.0333;').literal, 'spelled, never re-printed').toBe('0.0333');
    });

    it('table: any other top-level const whose initialiser is not a function', () => {
        expect(one('const lower = 7;')).toMatchObject({ position: 'table', enclosing: 'lower' });
        const t = rowsOf('export const T = Object.freeze({ a: { speed: 2 }, list: [4, 5] });');
        expect(t.map((r) => r.position)).toEqual(['table', 'table', 'table']);
        expect(t[0].context).toBe('T.a.speed: speed:2');
        expect(t[1].context).toBe('T.list: list:[4,5]');
        expect(one('const D = A + 1;')).toMatchObject({ position: 'table', enclosing: 'D' });
        expect(one('const OBJ = { m() { return 6; } };')).toMatchObject({ position: 'table', function: 'm' });
    });

    it('inline: inside a function-valued const, a function, a let, or top-level code', () => {
        expect(one('const F = () => 9;')).toMatchObject({ position: 'inline', function: 'F' });
        expect(one('function f(x) { return x * 5; }')).toMatchObject({ position: 'inline', function: 'f' });
        expect(one('let n = 4;')).toMatchObject({ position: 'inline', enclosing: 'n' });
        expect(one('class K { step() { return 2; } }')).toMatchObject({ position: 'inline', function: 'K.step' });
    });

    it('the unary minus folds into the literal wherever it sits', () => {
        expect(one('function g() { return -1; }')).toMatchObject({ literal: '-1', value: -1, position: 'inline' });
        expect(one('const T = [-2];')).toMatchObject({ literal: '-2', position: 'table' });
        expect(one('function g(a) { return a - 1; }').literal, 'a BINARY minus is not folded').toBe('1');
    });

    it('the key: unit hash, literal, ordinal among identical units', () => {
        const [a, b] = rowsOf('function h() { a(1); a(1); }');
        expect(a.key).toBe(`x.js|h|h${md5h8('a(1);')}|1|0`);
        expect(b.key).toBe(`x.js|h|h${md5h8('a(1);')}|1|1`);
    });

    it('the unit ignores comments and whitespace, and an if-BODY edit does not move the key of its TEST', () => {
        expect(one('function f() { g(/* a */ 3); }').key).toBe(one('function f() {\n  g(3   /* b */);\n}').key);
        expect(one('function f(x) { if (x > 3) { a(); } }').key).toBe(one('function f(x) { if (x > 3) { b(); c(); } }').key);
        expect(one('function f(x) { if (x > 3) { a(); } }').key).not.toBe(one('function f(x) { if (x >= 3) { a(); } }').key);
    });
});

describe('the mutants — each in a temp copy of the closure', () => {
    it('(a) PREDICTED RED: a new `const SPEED_X = 0.37` in a physics file names its key', () => {
        const dir = tempCopy();
        edit(dir, PHYS1, 'export const WATER_FRICTION = 0.5;\n', 'export const WATER_FRICTION = 0.5;\nexport const SPEED_X = 0.37;\n');
        const { diff } = checkCensus(dir);
        const key = `${PHYS1}|(module)|h${md5h8('SPEED_X=0.37')}|0.37|0`;
        expect(diff.red.map((x) => [x.why, x.key])).toEqual([['NEW', key]]);
    });

    it('(b) PREDICTED GREEN: a new literal inside a cosmetic table', () => {
        const dir = tempCopy();
        const rel = 'frontend/modules/flashPanel/seedlingSemantics.js';
        const committed = tree.census.rows.filter((r) => r.file === rel && r.enclosing === 'TILE_COLUMN_VARIANTS');
        expect(committed.length, 'the table exists').toBeGreaterThan(0);
        expect(new Set(committed.map((r) => r.class)), 'and is cosmetic').toEqual(new Set(['cosmetic']));
        edit(dir, rel, 'export const TILE_COLUMN_VARIANTS = Object.freeze({\n',
            'export const TILE_COLUMN_VARIANTS = Object.freeze({\n    99: { grass: false },\n');
        const { diff, docStale } = checkCensus(dir);
        expect(diff.red).toEqual([]);
        expect(docStale, 'the doc renders the committed census, so green drift does not stale it').toBe(false);
        expect(diff.green.filter((g) => g.why === 'new').map((g) => [g.class, g.key.split('|').at(-2)])).toEqual([['cosmetic', '99']]);
    });

    it('(c) PREDICTED RED: a committed physics row\'s statement deleted must be RETIRED', () => {
        const dir = tempCopy();
        const gone = tree.committed.find((r) => r.file === PHYS1 && r.enclosing === 'WATER_FRICTION');
        expect(gone?.class).toBe('physics');
        edit(dir, PHYS1, 'export const WATER_FRICTION = 0.5;\n', '');
        const { diff } = checkCensus(dir);
        expect(diff.red.map((x) => [x.why, x.key])).toEqual([['RETIRED', gone.key]]);
    });

    it('(d) PREDICTED RED: a hand edit inside the doc region is a stale doc', () => {
        const dir = tempCopy();
        const doc = readFileSync(join(dir, DOC_MD), 'utf8');
        const at = doc.indexOf(REGION_BEGIN);
        expect(at).toBeGreaterThan(-1);
        writeFileSync(join(dir, DOC_MD), `${doc.slice(0, at + REGION_BEGIN.length)}\nhand edit${doc.slice(at + REGION_BEGIN.length)}`);
        expect(checkCensus(dir).docStale).toBe(true);
    });
});

describe('the AS3 anchors', () => {
    /**
     * An anchor names an AS3 NAME, not only a numeric declaration: reviewers
     * anchored table rows to `Player.as:normalHitbox` (a Rectangle) and to a
     * class's `setHitbox` call. So the row asks that the name occurs in that
     * file, and — where a numeric `const`/`var` of that name exists and the
     * row is a scalar — that one of them has the scalar's value.
     */
    it.skipIf(!HAS_AS3)('every as3 anchor names a word in its vendor/seedling/src file (SKIPPED BY NAME when absent); a scalar anchored to a numeric declaration has its value', () => {
        const decls = as3Declarations(REPO);
        const bad = [];
        const text = new Map();
        for (const r of parseCsv(readFileSync(join(REPO, CENSUS_CSV), 'utf8'))) {
            if (!r.as3) continue;
            for (const a of r.as3.split(' ')) {
                const [file, name] = a.split(':');
                const path = join(REPO, AS3_SRC, file);
                if (!existsSync(path)) { bad.push(`${r.key}: ${a}: no such file`); continue; }
                if (!text.has(path)) text.set(path, readFileSync(path, 'latin1'));
                if (!new RegExp(`\\b${name}\\b`).test(text.get(path))) { bad.push(`${r.key}: ${a}: the name is not in the file`); continue; }
                const hit = decls.filter((d) => d.file === file && d.name === name);
                if (r.position === 'scalar' && hit.length && !hit.some((d) => d.value === Number(r.literal))) bad.push(`${r.key}: ${a} has another value`);
            }
        }
        expect(bad).toEqual([]);
    });
});
