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
 * ⛓ ENGINE-PREP C3 — the entities fold: the 23 Seedling entity getters the
 * family read are folded behind `run.entities(family)`. The table lists them
 * as `folded` (read out of `levelRun.js`'s `ENTITY_FAMILY_NAMES`, never
 * typed), keeps ONE `run:entities` row whose `families` column says which
 * file asks for which family, and a family file reading a folded getter
 * directly is RED by name.
 *
 * ⛓ ENGINE-PREP C4 — the progress and ledger folds: the player's bag and
 * progress (12 getters) behind `run.progress(field)`, the Seedling event
 * ledgers (29) behind `run.ledger(kind)`. The census's fold machinery is a
 * LIST (`FOLDS`); the table's `folded` is keyed by query, and each query's
 * row carries its own per-key column (`families`, `fields`, `kinds`).
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
    census, compareToTable, DOOR, entityFamilySites, FOLDS, foldKeySites, importClosure, FAMILY_ENTRIES, SIM_ENTRY,
    staticDrift,
} from './seedlingSolverSurface.js';
import * as LEVEL_RUN from '../../frontend/modules/seedlingDemo/levelRun.js';

const { ENTITY_FAMILY_NAMES } = LEVEL_RUN;

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
    ...cmp.folds.map((e) => `${e.at} ${e.why}`),
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

    it('(vi) the entities fold: no family file reads a folded getter, every run.entities(…) names a known '
        + 'family with a literal, and the table\'s folded list IS levelRun.js\'s ENTITY_FAMILY_NAMES', () => {
        const cmp = compareToTable(fresh, TABLE);
        expect(cmp.folds.map((e) => `${e.at} ${e.why}`)).toEqual([]);
        // generated, not typed: the census's text read, the module's own export and the table agree
        expect(fresh.entityFamilies.names.list).toEqual([...ENTITY_FAMILY_NAMES]);
        expect(fresh.entityFamilies.dispatch.list).toEqual([...ENTITY_FAMILY_NAMES]);
        expect(TABLE.folded.entities).toEqual([...ENTITY_FAMILY_NAMES]);
        // a folded getter has no row: the family reaches it only through the query
        expect(TABLE.rows.filter((r) => r.surface === 'run' && TABLE.folded.entities.includes(r.name))
            .map((r) => r.name)).toEqual([]);
        const row = TABLE.rows.find((r) => r.surface === 'run' && r.name === 'entities');
        expect(row.families).toEqual(entityFamilySites(fresh));
        expect(Object.keys(row.families).filter((f) => !TABLE.folded.entities.includes(f))).toEqual([]);
        expect(Object.values(row.families).flatMap(Object.values).reduce((a, b) => a + b, 0)).toBe(row.sites);
    });

    for (const fold of FOLDS) {
        it(`(vii) the ${fold.query} fold: names = dispatch = levelRun.js's runtime ${fold.namesExport} = the table's `
            + `folded.${fold.query}; no folded row; the ${fold.column} column is a fresh census and sums to the row`, () => {
            const runtime = LEVEL_RUN[fold.namesExport];
            expect(Array.isArray(runtime) && runtime.length > 0, `levelRun.js exports ${fold.namesExport}`).toBe(true);
            expect(fresh.folds[fold.query].names.list).toEqual([...runtime]);
            expect(fresh.folds[fold.query].dispatch.list).toEqual([...runtime]);
            expect(TABLE.folded[fold.query]).toEqual([...runtime]);
            expect(TABLE.rows.filter((r) => r.surface === 'run' && runtime.includes(r.name)).map((r) => r.name))
                .toEqual([]);
            const row = TABLE.rows.find((r) => r.surface === 'run' && r.name === fold.query);
            expect(row, `the run:${fold.query} row`).toBeTruthy();
            expect(row[fold.column]).toEqual(foldKeySites(fresh, fold.query));
            expect(Object.keys(row[fold.column]).filter((k) => !runtime.includes(k))).toEqual([]);
            expect(Object.values(row[fold.column]).flatMap(Object.values).reduce((a, b) => a + b, 0)).toBe(row.sites);
            // the query's row carries ITS column only
            expect(FOLDS.filter((f) => f !== fold && row[f.column] !== undefined).map((f) => f.column)).toEqual([]);
        });
    }

    it('(vii′) the folds are disjoint, and `transitions` (physics, live) is none of them', () => {
        const all = FOLDS.flatMap((f) => TABLE.folded[f.query]);
        expect(new Set(all).size).toBe(all.length);
        expect(all).not.toContain('transitions');
        const t = TABLE.rows.find((r) => r.surface === 'run' && r.name === 'transitions');
        expect([t.class, t.form]).toEqual(['physics', 'event-ledger']);
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

    // ⛓ C3: this mutant read run.bosses until the entities fold folded it (see the C3 block's (a)).
    it('(a′) run.equipNow (reached by botDriverV2.js only), read in dangerMap.js ⇒ RED through `files`', () => {
        const row = TABLE.rows.find((r) => r.surface === 'run' && r.name === 'equipNow');
        expect(Object.keys(row.files)).toEqual(['botDriverV2.js']);
        const cmp = mutate('dangerMap.js', (s) => `${s}\nexport const mutantA2 = (run) => run.equipNow;\n`);
        const lines = say(cmp);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/dangerMap\.js:\d+ reaches run:equipNow — the row names only botDriverV2\.js/);
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

describe('the import door (engine-prep C2), mutants over a temporary copy', () => {
    let tmp;
    beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'solver-door-mutant-')); });
    afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });
    const mutate = (edits) => {
        const copies = new Map();
        for (const [f, ed] of Object.entries(edits)) {
            const rel = `frontend/modules/seedlingDemo/${f}`;
            const src = read(rel);
            const out = ed(src);
            expect(out, `the ${f} mutant edited nothing`).not.toBe(src);
            copies.set(rel, path.join(tmp, f));
            fs.writeFileSync(copies.get(rel), out);
        }
        return say(compareToTable(census((p) => (copies.has(p) ? fs.readFileSync(copies.get(p), 'utf8') : read(p))), TABLE));
    };

    it('(a) dangerMap.js imports SPINNER from spinner.js directly (around the door) ⇒ RED, the door rule', () => {
        // aliased: a second unaliased `SPINNER` binding is a SyntaxError before any census reads it
        const lines = mutate({ 'dangerMap.js': (s) => `import { SPINNER as SPINNER_DIRECT } from './spinner.js';\n${s}` });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/dangerMap\.js:1 imports spinner\.js directly — a family file imports a seedlingDemo module only if it is a family file or the door, solverView\.js/);
    });

    it('(b) solverView.js re-exports a levelWorld symbol no family file imports ⇒ RED "RETIRED"', () => {
        expect(fresh.imports.some((i) => i.name === 'PLAYER_SOLID_TYPES')).toBe(false);
        const lines = mutate({ 'solverView.js': (s) => `${s}export { PLAYER_SOLID_TYPES } from './levelWorld.js';\n` });
        expect(lines).toEqual(['door:solverView.js#PLAYER_SOLID_TYPES — no family file imports it — '
            + 'the export must be RETIRED from solverView.js']);
    });

    it('(b′) solverView.js re-exports a name its module does not export (WATER_STATE is levelWorld-private) ⇒ RED twice', () => {
        const lines = mutate({ 'solverView.js': (s) => `${s}export { WATER_STATE } from './levelWorld.js';\n` });
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/^door:solverView\.js#WATER_STATE — .* must be RETIRED/);
        expect(lines[1]).toMatch(/solverView\.js:\d+ the door holds only .* a re-export of WATER_STATE, which .*levelWorld\.js does not export/);
    });

    it('(c) blocksMover exported by the door AND imported through it in mover.js ⇒ RED "not in the contract table"', () => {
        const lines = mutate({
            'solverView.js': (s) => `${s}export { blocksMover } from './levelWorld.js';\n`,
            'mover.js': (s) => `import { blocksMover } from './solverView.js';\n${s}\nexport const mutantC = blocksMover;\n`,
        });
        expect(lines).toEqual([
            'frontend/modules/seedlingDemo/mover.js:1 reaches import:levelWorld.js#blocksMover — not in the contract table']);
    });

    it('(d) a COMMENT naming a simulation module in a family file ⇒ GREEN', () => {
        const lines = mutate({ 'dangerMap.js': (s) => `// import { SPINNER } from './spinner.js' — prose, not an import\n${s}` });
        expect(lines).toEqual([]);
    });
});

describe('the entities fold (engine-prep C3), mutants over a temporary copy', () => {
    let tmp;
    beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'solver-entities-mutant-')); });
    afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });
    /** Census with the named files replaced by edited copies; the findings as sentences. */
    const mutate = (edits) => {
        const copies = new Map();
        for (const [rel, ed] of Object.entries(edits)) {
            const src = read(rel);
            const out = ed(src);
            expect(out, `the ${rel} mutant edited nothing`).not.toBe(src);
            copies.set(rel, path.join(tmp, path.posix.basename(rel)));
            fs.writeFileSync(copies.get(rel), out);
        }
        return say(compareToTable(census((p) => (copies.has(p) ? fs.readFileSync(copies.get(p), 'utf8') : read(p))), TABLE));
    };
    const DANGER = 'frontend/modules/seedlingDemo/dangerMap.js';

    it('(a) a DIRECT run.pushables read in dangerMap.js ⇒ RED "folded behind run.entities", once', () => {
        const lines = mutate({ [DANGER]: (s) => `${s}\nexport const mutantA = (run) => run.pushables;\n` });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/dangerMap\.js:\d+ reads run\.pushables directly — it is folded behind run\.entities\('pushables'\)/);
    });

    it('(b) run.entities(\'pushable\') — a typo ⇒ RED "unknown entity family"', () => {
        const lines = mutate({ [DANGER]: (s) => `${s}\nexport const mutantB = (run) => run.entities('pushable');\n` });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/dangerMap\.js:\d+ run\.entities\('pushable'\) — unknown entity family; levelRun\.js's ENTITY_FAMILIES holds openActivators, pushables, /);
    });

    it('(c) run.entities(name) with a variable ⇒ RED, a named blind spot', () => {
        const lines = mutate({ [DANGER]: (s) => `${s}\nexport const mutantC = (run, name) => run.entities(name);\n` });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/dangerMap\.js:\d+ run\.entities\(name\) — not a string literal — a BLIND SPOT/);
    });

    it('(d) the pushables entry removed from ENTITY_FAMILIES in levelRun.js ⇒ RED at every site that asks for it, '
        + 'and the name list no longer matches the table', () => {
        const pushSites = Object.values(TABLE.rows.find((r) => r.name === 'entities').families.pushables)
            .reduce((a, b) => a + b, 0);
        const lines = mutate({ [SIM_ENTRY]: (s) => s.replace(/\n {8}pushables: pushablesNow,/, '') });
        const unknown = lines.filter((l) => /run\.entities\('pushables'\) — unknown entity family/.test(l));
        expect(unknown).toHaveLength(pushSites);
        expect(lines.filter((l) => /ENTITY_FAMILY_NAMES .* ≠ the keys of ENTITY_FAMILIES/.test(l))).toHaveLength(1);
        expect(lines).toHaveLength(pushSites + 1);
    });

    it('(e) a COMMENT naming run.pushables in a family file ⇒ GREEN', () => {
        expect(mutate({ [DANGER]: (s) => `${s}\n// run.pushables — prose, not a read\n` })).toEqual([]);
    });
});

describe('the progress and ledger folds (engine-prep C4), mutants over a temporary copy', () => {
    let tmp;
    beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'solver-folds-mutant-')); });
    afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });
    /** Census with the named files replaced by edited copies; the findings as sentences. */
    const mutate = (edits) => {
        const copies = new Map();
        for (const [rel, ed] of Object.entries(edits)) {
            const src = read(rel);
            const out = ed(src);
            expect(out, `the ${rel} mutant edited nothing`).not.toBe(src);
            copies.set(rel, path.join(tmp, path.posix.basename(rel)));
            fs.writeFileSync(copies.get(rel), out);
        }
        return say(compareToTable(census((p) => (copies.has(p) ? fs.readFileSync(copies.get(p), 'utf8') : read(p))), TABLE));
    };
    const DANGER = 'frontend/modules/seedlingDemo/dangerMap.js';

    it('(a) a DIRECT run.inventory read in dangerMap.js ⇒ RED "folded behind run.progress", once', () => {
        const lines = mutate({ [DANGER]: (s) => `${s}\nexport const mutantA = (run) => run.inventory;\n` });
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/dangerMap\.js:\d+ reads run\.inventory directly — it is folded behind run\.progress\('inventory'\)/);
    });

    it('(a′) a DIRECT run.collected read ⇒ RED "folded behind run.ledger", once', () => {
        const lines = mutate({ [DANGER]: (s) => `${s}\nexport const mutantA2 = (run) => run.collected;\n` });
        expect(lines).toEqual([expect.stringMatching(
            /dangerMap\.js:\d+ reads run\.collected directly — it is folded behind run\.ledger\('collected'\)/)]);
    });

    // ⚠ PREDICTED ONE LINE, MEASURED TWO (C4 D4): dangerMap.js reads no ledger and no progress, so a
    // `run.ledger(…)` / `run.progress(…)` there is ALSO a new file on that row — the `files` rule fires
    // beside the fold's own sentence. C3's dangerMap mutants never saw it: dangerMap already asks `entities`.
    it('(b) run.ledger(\'chestOpen\') — a typo ⇒ RED "unknown ledger kind", naming LEDGER_KINDS '
        + '(and a file the run:ledger row does not name)', () => {
        const lines = mutate({ [DANGER]: (s) => `${s}\nexport const mutantB = (run) => run.ledger('chestOpen');\n` });
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/dangerMap\.js:\d+ reaches run:ledger — the row names only botDriverV2\.js, director\.js, solverBot\.js/);
        expect(lines[1]).toMatch(/dangerMap\.js:\d+ run\.ledger\('chestOpen'\) — unknown ledger kind; levelRun\.js's LEDGER_KINDS holds collected, sealCollections, /);
    });

    it('(c) run.progress(f) with a variable ⇒ RED, a named blind spot (and a file the run:progress row does not name)', () => {
        const lines = mutate({ [DANGER]: (s) => `${s}\nexport const mutantC = (run, f) => run.progress(f);\n` });
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/dangerMap\.js:\d+ reaches run:progress — the row names only botDriverV2\.js, director\.js, solverBot\.js/);
        expect(lines[1]).toMatch(/dangerMap\.js:\d+ run\.progress\(f\) — not a string literal — a BLIND SPOT: the census cannot name the field/);
    });

    it('(d) the inventory entry removed from PROGRESS_FIELDS in levelRun.js ⇒ RED at every site that asks for it, '
        + 'and the name list no longer matches the dispatch table', () => {
        const sites = Object.values(TABLE.rows.find((r) => r.name === 'progress').fields.inventory)
            .reduce((a, b) => a + b, 0);
        const lines = mutate({ [SIM_ENTRY]: (s) => s.replace(/\n {8}inventory: inventoryNow,/, '') });
        const unknown = lines.filter((l) => /run\.progress\('inventory'\) — unknown progress field/.test(l));
        expect(unknown).toHaveLength(sites);
        expect(lines.filter((l) => /PROGRESS_FIELD_NAMES .* ≠ the keys of PROGRESS_FIELDS/.test(l))).toHaveLength(1);
        expect(lines).toHaveLength(sites + 1);
    });

    it('(d′) the collected entry pointed at another arrow (collected: sealCollectionsNow) ⇒ GREEN here — the census '
        + 'sees keys, not values; levelRun.test.js\'s query-equals-getter rows are what hold the values', () => {
        expect(mutate({ [SIM_ENTRY]: (s) => s.replace(/\n {8}collected: collectedNow,/,
            '\n        collected: sealCollectionsNow,') })).toEqual([]);
    });

    it('(e) COMMENTS naming run.inventory and run.collected in a family file ⇒ GREEN', () => {
        expect(mutate({ [DANGER]: (s) => `${s}\n// run.inventory, run.collected — prose, not a read\n` })).toEqual([]);
    });

    it('(f) a getter listed in two folds (keys added to LEDGER_KIND_NAMES) ⇒ RED "folded behind both"', () => {
        const lines = mutate({ [SIM_ENTRY]: (s) => s.replace(
            /(export const LEDGER_KIND_NAMES = Object\.freeze\(\[\n)/, "$1    'keys',\n") });
        expect(lines.some((l) => /keys is folded behind both run\.progress and run\.ledger/.test(l))).toBe(true);
    });
});
