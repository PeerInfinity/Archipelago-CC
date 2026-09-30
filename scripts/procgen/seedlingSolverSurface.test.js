/**
 * THE SOLVER'S SURFACE, FROZEN — engine-prep C1's gate.
 *
 * `seedling-solver-surface.json` is the declared contract between the
 * Seedling solver family and the simulation: every run / world / state member
 * the family reaches and every simulation symbol it imports, classified. This
 * test goes RED when the surface GROWS (a family file reaches something the
 * table lacks, or reaches a listed thing from a file its row does not name)
 * and when it SHRINKS without the table following (a row nothing reaches is
 * RED "must be RETIRED"), so the table narrows as the surface narrows.
 *
 * To add a member a slice truly needs: `node
 * scripts/procgen/census-seedling-solver-surface.mjs --write`, then read the
 * member and fill in the new row's class, form and why (docs/json/developer/
 * procgen/seedling-solver-surface.md says how).
 *
 * The mutants run the census over a temporary COPY of the family files —
 * never the tree.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    census, compareToTable, DOOR, importClosure, FAMILY_ENTRIES, SIM_ENTRY, staticDrift,
} from './seedlingSolverSurface.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const TABLE = JSON.parse(fs.readFileSync(path.join(HERE, 'seedling-solver-surface.json'), 'utf8'));
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

const CLASSES = new Set(['physics', 'seedling']);
const FORMS = new Set(['live-state', 'event-ledger', 'forecast', 'stepper', 'geometry-query', 'constant', 'function']);

/** A finding list as the sentences a reader acts on. */
const say = (cmp) => [
    ...cmp.unlisted.map((u) => `${u.at} reaches ${u.key} — ${u.why}`),
    ...cmp.retired.map((r) => `${r.key}${r.file ? ` (${r.file})` : ''} — ${r.why}`),
    ...(cmp.family ? [`family closure ${cmp.family.closure.join(' ')} ≠ table ${cmp.family.table.join(' ')}`] : []),
    ...cmp.door.map((d) => `${d.at} ${d.why}`),
];

let fresh;
beforeAll(() => { fresh = census(read); });

describe('the committed contract equals a fresh census', () => {
    it('(i) every static row\'s files and site counts match', () => {
        const drift = staticDrift(fresh, TABLE);
        expect(drift.map((d) => `${d.key}: table ${JSON.stringify(d.table)} ≠ fresh ${JSON.stringify(d.fresh)} `
            + '— run census-seedling-solver-surface.mjs --write')).toEqual([]);
    });

    it('(ii) nothing the family reaches is missing from the table (the surface did not GROW)', () => {
        const cmp = compareToTable(fresh, TABLE);
        expect(cmp.unlisted.map((u) => `${u.at} reaches ${u.key} — ${u.why}`)).toEqual([]);
    });

    it('(iii) every static row is still reached (nothing is owed a RETIREMENT)', () => {
        const cmp = compareToTable(fresh, TABLE);
        expect(cmp.retired.map((r) => `${r.key}${r.file ? ` (${r.file})` : ''} — ${r.why}`)).toEqual([]);
    });

    it('(iv) the family file list equals the import closure', () => {
        const sim = new Set(importClosure([SIM_ENTRY], read));
        const fam = importClosure(FAMILY_ENTRIES, read).filter((f) => !sim.has(f) && f !== DOOR)
            .map((f) => path.posix.basename(f));
        expect(TABLE.family).toEqual(fam);
        expect(compareToTable(fresh, TABLE).family).toBeNull();
    });

    it('every row is classified — a class, a form and a why', () => {
        const bad = TABLE.rows.filter((r) => !CLASSES.has(r.class) || !FORMS.has(r.form) || !r.why)
            .map((r) => `${r.surface}:${r.name} class=${r.class} form=${r.form}`);
        expect(bad).toEqual([]);
    });

    it('the import door\'s closure is the simulation\'s: solverView.js pulls in no family file', () => {
        const sim = new Set(importClosure([SIM_ENTRY], read));
        expect(importClosure([DOOR], read).filter((f) => f !== DOOR && !sim.has(f))).toEqual([]);
    });

    it('(v) the door rule: every family import of the simulation goes through solverView.js, '
        + 'and the door exports exactly what the family imports', () => {
        const cmp = compareToTable(fresh, TABLE);
        expect(cmp.door.map((d) => `${d.at} ${d.why}`)).toEqual([]);
        const direct = fresh.imports.filter((i) => !i.door);
        expect(direct.map((i) => `${i.file}:${i.line} ${i.name}`)).toEqual([]);
        // the door's export count IS the table's import-row count: one row per exported symbol
        expect(fresh.door.exports.size).toBe(TABLE.rows.filter((r) => r.surface === 'import').length);
        // and a door row keeps the SIMULATION module: no row names the door
        expect(TABLE.rows.filter((r) => r.module === DOOR)).toEqual([]);
    });

    it('the census reads ONLY run members off `run` (no stray object spelled `run`)', () => {
        const stray = fresh.reads.filter((r) => r.base === 'run' && !fresh.runMembers.has(r.name))
            .map((r) => `${r.file}:${r.line} run.${r.name}`);
        expect(stray).toEqual([]);
    });
});

describe('mutants, over a temporary copy of the family', () => {
    let tmp;
    const copyOf = (file) => path.join(tmp, path.posix.basename(file));
    beforeAll(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'solver-surface-mutant-'));
    });
    afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    /** Census the family with ONE file replaced by a mutated copy. */
    const mutate = (file, edit) => {
        const rel = `frontend/modules/seedlingDemo/${file}`;
        const src = read(rel);
        const out = edit(src);
        expect(out, `the ${file} mutant edited nothing`).not.toBe(src);
        fs.writeFileSync(copyOf(rel), out);
        const c = census((p) => (p === rel ? fs.readFileSync(copyOf(rel), 'utf8') : read(p)));
        return compareToTable(c, TABLE);
    };

    it('(a) a run method NO family file reaches (adoptWindowClock), read in dangerMap.js ⇒ RED', () => {
        expect(TABLE.rows.some((r) => r.surface === 'run' && r.name === 'adoptWindowClock')).toBe(false);
        const cmp = mutate('dangerMap.js', (s) => `${s}\nexport const mutantA = (run) => run.adoptWindowClock;\n`);
        const lines = say(cmp);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/dangerMap\.js:\d+ reaches run:adoptWindowClock — not in the contract table/);
    });

    it('(a′) run.bosses (reached by botDriverV2.js only), read in dangerMap.js ⇒ RED through `files`', () => {
        const row = TABLE.rows.find((r) => r.surface === 'run' && r.name === 'bosses');
        expect(Object.keys(row.files)).toEqual(['botDriverV2.js']);
        const cmp = mutate('dangerMap.js', (s) => `${s}\nexport const mutantA2 = (run) => run.bosses;\n`);
        const lines = say(cmp);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/dangerMap\.js:\d+ reaches run:bosses — the row names only botDriverV2\.js/);
    });

    it('(b) a DIRECT import of a simulation symbol no family file imports (levelWorld.js#blocksMover) in mover.js '
        + '⇒ RED twice: not in the table, and around the door', () => {
        expect(TABLE.rows.some((r) => r.surface === 'import' && r.name === 'blocksMover')).toBe(false);
        const cmp = mutate('mover.js', (s) => `import { blocksMover } from './levelWorld.js';\n${s}\n`
            + 'export const mutantB = blocksMover;\n');
        const lines = say(cmp);
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/mover\.js:1 reaches import:levelWorld\.js#blocksMover — not in the contract table/);
        expect(lines[1]).toMatch(/mover\.js:1 imports levelWorld\.js directly — .* only if it is a family file or the door/);
    });

    it('(c) the one run.worldCtor read removed from director.js ⇒ RED "RETIRED"', () => {
        const row = TABLE.rows.find((r) => r.surface === 'run' && r.name === 'worldCtor');
        expect(row.sites).toBe(1);
        const cmp = mutate('director.js', (s) => s.replace(/\brun\.worldCtor\b/, 'undefined'));
        const lines = say(cmp);
        expect(lines).toEqual(['run:worldCtor — nothing reaches it — it must be RETIRED']);
    });

    it('(d) a COMMENT mentioning run.notAMember ⇒ GREEN (the census reads code, not comments)', () => {
        const cmp = mutate('dangerMap.js', (s) => `${s}\n// run.notAMember — prose, not a read\n/* run.alsoNot */\n`);
        expect(say(cmp)).toEqual([]);
    });
});
