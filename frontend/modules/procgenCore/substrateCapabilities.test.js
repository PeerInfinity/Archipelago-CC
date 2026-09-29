/**
 * procgenCore/substrateCapabilities — **THE CAPABILITY VOCABULARY, ASKED OF THE
 * REAL REGISTRY** (substrate chart S1).
 *
 * ⛓ The population is every entry the capability-matrix generator loads
 * (`REGISTRY_LIBRARIES`, imported the way the generator imports them), never a
 * fixture: a statement whose predicate silently stopped firing must go red
 * here, and only the real entries can say it did. ⛔ No expectation below is
 * built from this module's own output where the ENTRY can answer instead — a
 * probe that shares its subject's assumption agrees with the bug.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { fieldNamesOf } from '../procgenDocs/registryShape.js';
import { REGISTRY } from '../procgenDocs/generated/registry.js';
import {
    describeRegistry, snapshotExpandable, THREW_PREFIX,
} from '../substrateRegistryPanel/substrateRegistryPanelLibrary.js';
import {
    buildCapabilities, capabilitiesMarkdown,
} from '../../../scripts/procgen/reference/capabilities.mjs';
import { declaredStartingNeeds } from './startingInventory.js';
import {
    CAPABILITY_GROUPS, CAPABILITY_STATEMENTS, CELL_KINDS, CELL_MARKS, CELL_WORDING, FEATURE_WORDING,
    LIST_PREVIEW, LIVE_ANSWERS, REQUIRES_LOOP_MODE_FIELD,
    applyLiveAnswer, capabilityRows, cardOf, uncoveredFields,
} from './substrateCapabilities.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const ENTRIES = substrateRegistry.getAll();
const ROWS = capabilityRows(ENTRIES);
const NAMES = fieldNamesOf(ENTRIES, snapshotExpandable(REGISTRY));
const rowOf = (id) => ROWS.find((r) => r.id === id);
const cellOf = (rowId, entryId) => rowOf(rowId).cells.find((c) => c.id === entryId);

/** ⛓ The statement ids §1 names, in group order — the vocabulary's shape. */
const PLAN_IDS = ['P1', 'P2', 'P3', 'P4', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11',
    'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'E1', 'E2', 'E3', 'E4'];

describe('the vocabulary', () => {
    it('the population is every registered entry', () => {
        expect(ENTRIES.length).toBeGreaterThan(6);
    });

    it('one statement per plan §1 row, in group order, each in a declared group', () => {
        expect(ROWS.map((r) => r.id)).toEqual(PLAN_IDS);
        const groups = CAPABILITY_GROUPS.map((g) => g.id);
        for (const s of CAPABILITY_STATEMENTS) expect(groups, s.id).toContain(s.group);
        const seen = ROWS.map((r) => groups.indexOf(r.group));
        expect(seen).toEqual([...seen].sort((a, b) => a - b));
    });

    it('(i) every field a statement reads is a row of the matrix universe', () => {
        const universe = new Set(NAMES);
        const missing = CAPABILITY_STATEMENTS.flatMap((s) => s.fields
            .filter((f) => !universe.has(f)).map((f) => `${s.id}: ${f}`));
        expect(missing).toEqual([]);
    });

    it('(ii) NON-VACUITY: every statement answers yes for ≥1 real entry, and no/partial for ≥1 unless universal', () => {
        const vacuous = [];
        for (const r of ROWS) {
            const s = CAPABILITY_STATEMENTS.find((x) => x.id === r.id);
            const kinds = new Set(r.cells.map((c) => c.kind));
            if (!kinds.has(CELL_KINDS.YES)) vacuous.push(`${r.id}: no yes`);
            if (!s.universal && !kinds.has(CELL_KINDS.NO) && !kinds.has(CELL_KINDS.PARTIAL)) {
                vacuous.push(`${r.id}: no no/partial, and not declared universal`);
            }
        }
        expect(vacuous).toEqual([]);
    });

    it('(iii) every `requires` names a statement declared BEFORE it', () => {
        const ids = ROWS.map((r) => r.id);
        for (const s of CAPABILITY_STATEMENTS.filter((x) => x.requires)) {
            expect(ids, s.id).toContain(s.requires);
            expect(ids.indexOf(s.requires), s.id).toBeLessThan(ids.indexOf(s.id));
        }
    });

    it('(iii′) a `requires` cell reads n/a exactly where its prerequisite is no or n/a', () => {
        for (const s of CAPABILITY_STATEMENTS.filter((x) => x.requires)) {
            for (const e of ENTRIES) {
                const pre = cellOf(s.requires, e.id).kind;
                const na = pre === CELL_KINDS.NO || pre === CELL_KINDS.NA;
                expect(cellOf(s.id, e.id).kind === CELL_KINDS.NA, `${s.id} × ${e.id}`).toBe(na);
            }
        }
    });

    it('(iv) ⚖ a checkmark is a FEATURE: no statement starts with a negation word', () => {
        const NEGATION = /^(needs|requires|cannot|can't|slow|only)\b/i;
        expect(CAPABILITY_STATEMENTS.filter((s) => NEGATION.test(s.statement)).map((s) => s.id)).toEqual([]);
    });

    it.each([
        ['frontend/modules/procgenCore/substrateCapabilities.js'],
        ['scripts/procgen/reference/capabilities.mjs'],
    ])('(v) ⛔ %s names no registered substrate id (its SOURCE, read)', (rel) => {
        /* ⛓ The WHOLE source — no exemption (S1 blanked the FEATURE_WORDING
         * values for 'runner abilities'; S3 dropped both ability tags from the
         * wording, ⚖ plan §6′.2). */
        const src = readFileSync(join(ROOT, rel), 'utf8');
        const named = ENTRIES.map((e) => e.id)
            .filter((id) => new RegExp(`(?<![A-Za-z0-9_])${id}(?![A-Za-z0-9_])`).test(src));
        expect(named).toEqual([]);
    });

    it('(vi) cardOf lists exactly an entry\'s yes/partial cells, in row order', () => {
        for (const e of ENTRIES) {
            const card = cardOf(e, ROWS);
            expect(card.id).toBe(e.id);
            expect(card.label).toBe(e.label);
            const want = ROWS.filter((r) => {
                const k = r.cells.find((c) => c.id === e.id).kind;
                return k === CELL_KINDS.YES || k === CELL_KINDS.PARTIAL;
            }).map((r) => r.statement);
            expect(card.lines.map((l) => l.statement), e.id).toEqual(want);
        }
    });

    it('every cell carries `why`: each field it read, with the value the matrix shows', () => {
        for (const r of ROWS) {
            for (const c of r.cells) expect(c.why.map((w) => w.field), `${r.id} × ${c.id}`).toEqual(r.fields);
        }
    });
});

describe('(vii) ⚖ the INVERTED rows hold on the real entries — the reason read off the declaration', () => {
    it('L8: an entry declaring requiresLoopMode answers no, and says which declaration', () => {
        const declaring = ENTRIES.filter((e) => e.loopSupport?.requiresLoopMode === true);
        expect(declaring.length).toBeGreaterThan(0);
        for (const e of ENTRIES) {
            const c = cellOf('L8', e.id);
            if (declaring.includes(e)) {
                expect(c.kind, e.id).toBe(CELL_KINDS.NO);
                expect(c.text, e.id).toContain(REQUIRES_LOOP_MODE_FIELD);
            } else {
                expect(c.kind, e.id).toBe(CELL_KINDS.YES);
            }
        }
    });

    it("G3: an entry declaring generationCost 'heavy' answers no, naming its declared value", () => {
        const heavy = ENTRIES.filter((e) => e.generationCost === 'heavy');
        expect(heavy.length).toBeGreaterThan(0);
        for (const e of heavy) {
            const c = cellOf('G3', e.id);
            expect(c.kind, e.id).toBe(CELL_KINDS.NO);
            expect(c.text, e.id).toContain(e.generationCost);
        }
    });

    it('G7: an entry with starting needs answers no, carrying every need\'s reason and names', () => {
        const needing = ENTRIES.filter((e) => e.startingInventory?.needs?.length > 0);
        expect(needing.length).toBeGreaterThan(0);
        for (const e of ENTRIES) {
            const c = cellOf('G7', e.id);
            if (!needing.includes(e)) { expect(c.kind, e.id).toBe(CELL_KINDS.YES); continue; }
            expect(c.kind, e.id).toBe(CELL_KINDS.NO);
            for (const n of declaredStartingNeeds(e)) {
                expect(c.text).toContain(n.reason);
                for (const name of n.anyOf) expect(c.text).toContain(name);
            }
        }
    });
});

describe('L10 on the real entries: a static `types` list is the count, a preview and the whole list', () => {
    it('every entry declaring `sharing.items.types` shows ≤ LIST_PREVIEW names and carries the whole list', () => {
        const typed = ENTRIES.filter((e) => Array.isArray(e.sharing?.items?.types));
        expect(typed.length).toBeGreaterThan(0);
        for (const e of typed) {
            const { types } = e.sharing.items;
            const c = cellOf('L10', e.id);
            expect(c.kind, e.id).toBe(CELL_KINDS.YES);
            expect(c.list, e.id).toEqual(types.map(String));
            expect(c.text, e.id).toBe(CELL_WORDING.itemTypesPreview(types.map(String)));
            expect(c.text.startsWith(CELL_WORDING.itemTypes(types.length)), e.id).toBe(true);
            for (const t of types.slice(LIST_PREVIEW)) expect(c.text.split(': ')[1].split(', '), e.id).not.toContain(t);
        }
        /* non-vacuity: at least one real list is longer than the preview */
        expect(typed.some((e) => e.sharing.items.types.length > LIST_PREVIEW)).toBe(true);
    });
});

describe('the feature wording and the uncovered fields', () => {
    it('every feature id a real entry declares has words — a missing one is a WARNING, not a failure', () => {
        const ids = [...new Set(ENTRIES.flatMap((e) => e.supportedFeatures ?? []))].sort();
        const unworded = ids.filter((id) => !(id in FEATURE_WORDING));
        // eslint-disable-next-line no-console
        if (unworded.length) console.warn(`WARNING substrateCapabilities: feature ids with no FEATURE_WORDING (rendered as the id): ${unworded.join(', ')}`);
        expect(ids.length).toBeGreaterThan(0);
    });

    it('uncoveredFields: a universe name no statement reads, and only those', () => {
        const un = uncoveredFields(NAMES, ROWS);
        expect(un).toEqual([...un].sort());
        const read = new Set(CAPABILITY_STATEMENTS.flatMap((s) => s.fields));
        for (const n of un) expect(read.has(n), n).toBe(false);
        for (const f of read) expect(un, f).not.toContain(f);
        /* non-vacuity: the universe is wider than the vocabulary today */
        expect(un.length).toBeGreaterThan(0);
        expect(un).toContain('loopSupport.customQueues');
    });
});

describe('the live declarations and the marks (substrate chart S2)', () => {
    it('every `live` key is a member of LIVE_ANSWERS, and every LIVE_ANSWERS value is declared by ≥1 statement', () => {
        const members = new Set(Object.values(LIVE_ANSWERS));
        const declared = CAPABILITY_STATEMENTS.filter((s) => 'live' in s);
        for (const s of declared) expect(members.has(s.live), s.id).toBe(true);
        expect(new Set(declared.map((s) => s.live))).toEqual(members);
    });

    it('LIVE_ANSWERS are keys of the panel\'s `vm.answers[id]` — the overlay key is the view-model\'s own', () => {
        const vm = describeRegistry(ENTRIES, REGISTRY, { call: () => null });
        for (const e of ENTRIES) {
            for (const key of Object.values(LIVE_ANSWERS)) expect(vm.answers[e.id], `${e.id}.${key}`).toHaveProperty(key);
        }
    });

    it('CELL_MARKS has one mark per CELL_KINDS value, and no other', () => {
        expect(Object.keys(CELL_MARKS).sort()).toEqual(Object.values(CELL_KINDS).sort());
    });

    it('◐ appears in the generated markdown exactly where a cell is partial', async () => {
        const v = await buildCapabilities({ rows: NAMES.map((name) => ({ name })) });
        const md = capabilitiesMarkdown(v);
        const partials = v.rows.flatMap((r) => r.cells.filter((c) => c.kind === CELL_KINDS.PARTIAL)
            .map(() => `${CELL_MARKS[CELL_KINDS.PARTIAL]} `));
        expect(partials.length).toBeGreaterThan(0);
        const tableLines = md.split('\n').filter((l) => /^\| [A-Z]\d+ \|/.test(l));
        const inTables = tableLines.join('\n').split(CELL_MARKS[CELL_KINDS.PARTIAL]).length - 1;
        expect(inTables).toBe(partials.length);
        for (const r of v.rows) {
            const line = tableLines.find((l) => l.startsWith(`| ${r.id} |`));
            const n = r.cells.filter((c) => c.kind === CELL_KINDS.PARTIAL).length;
            expect(line.split(CELL_MARKS[CELL_KINDS.PARTIAL]).length - 1, r.id).toBe(n);
        }
    });
});

describe('applyLiveAnswer — fixtures', () => {
    const items = { live: LIVE_ANSWERS.itemTypes };
    const yes = { kind: CELL_KINDS.YES, text: CELL_WORDING.itemTypesLive, why: [] };

    it('itemTypes: a list refines a ✓ cell\'s text with the same count wording the static case uses', () => {
        const out = applyLiveAnswer(yes, items, ['Food', 'Arrow']);
        expect(out).not.toBe(yes);
        expect(out.kind).toBe(CELL_KINDS.YES);
        expect(out.text).toBe(`${CELL_WORDING.itemTypes(2)}: Food, Arrow`);
        expect(out.live).toEqual({ key: LIVE_ANSWERS.itemTypes, value: 'Food, Arrow' });
        expect(yes.text).toBe(CELL_WORDING.itemTypesLive); // the input is untouched
        expect(applyLiveAnswer(yes, items, []).text).toBe(CELL_WORDING.itemTypes(0));
    });

    it('itemTypes: `absent`, a threw, or a ✗ cell → the SAME cell', () => {
        const no = { kind: CELL_KINDS.NO, text: null };
        expect(applyLiveAnswer(yes, items, 'absent')).toBe(yes);
        expect(applyLiveAnswer(yes, items, `${THREW_PREFIX}boom`)).toBe(yes);
        expect(applyLiveAnswer(no, items, ['x'])).toBe(no);
    });

    it('itemTypes: a long list shows the count and the first LIST_PREVIEW names, the whole list as `list`', () => {
        const names = ['a', 'b', 'c', 'd', 'e'];
        const out = applyLiveAnswer(yes, items, names);
        expect(out.text).toBe(`${CELL_WORDING.itemTypes(5)}: ${names.slice(0, LIST_PREVIEW).join(', ')}, …`);
        expect(out.list).toEqual(names);
        expect(applyLiveAnswer(yes, items, names.slice(0, LIST_PREVIEW)).text)
            .toBe(`${CELL_WORDING.itemTypes(LIST_PREVIEW)}: ${names.slice(0, LIST_PREVIEW).join(', ')}`);
    });

    it('P2 declares no live answer (⚖ plan §6′.1 item 7) — a controller answer changes nothing', () => {
        const p2 = CAPABILITY_STATEMENTS.find((s) => s.id === 'P2');
        expect('live' in p2).toBe(false);
        const c = { kind: CELL_KINDS.YES, text: null };
        expect(applyLiveAnswer(c, p2, 'controller')).toBe(c);
        expect(applyLiveAnswer(c, { live: 'playbackController' }, 'controller')).toBe(c);
    });

    it('an n/a cell, an undeclared statement, a missing answer → the SAME cell', () => {
        const na = { kind: CELL_KINDS.NA, text: null };
        expect(applyLiveAnswer(na, items, ['x'])).toBe(na);
        expect(applyLiveAnswer(yes, {}, ['x'])).toBe(yes);
        expect(applyLiveAnswer(yes, items, undefined)).toBe(yes);
    });

    it('over the REAL registry with fake live answers: only declared statements change, and only their text', () => {
        const vm = describeRegistry(ENTRIES, REGISTRY, { call: () => ['a', 'b'] });
        for (const s of CAPABILITY_STATEMENTS) {
            const row = rowOf(s.id);
            for (const c of row.cells) {
                const out = applyLiveAnswer(c, s, s.live ? vm.answers[c.id][s.live] : undefined);
                expect(out.kind, `${s.id} × ${c.id}`).toBe(c.kind);
                if (!s.live) expect(out, `${s.id} × ${c.id}`).toBe(c);
            }
        }
    });
});
