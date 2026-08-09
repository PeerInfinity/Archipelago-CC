/**
 * r7Acceptance — the ledgers, and the mutations that prove they bite.
 *
 * ⛔ EVERY TEST HERE EXISTS BECAUSE A GREEN GATE ALREADY LIED ONCE. R6's
 * `r6ExitFindings()` reported 6/6 and 8/8 for three slices while
 * `hasShield` was uncollected, because the item ledger was a passthrough
 * field with no findings row (trap 119). So the assertions below are not
 * "the ledger has the right rows" — they are "a row with no earner cannot
 * be reported as satisfied, and a row added tomorrow cannot go
 * unreported".
 */

import { describe, it, expect } from 'vitest';
import {
    R7AcceptanceError, SEAM_SIGNATURE, SAVE_FILE_KEYS, assertSeamSignatureCovers,
    seamRngPosture, seamFindings, R7_GOAL_LEDGER, R7_LEDGER_EXCLUSIONS,
    r7GoalFindings, r7GoalCriteria, R7_BATCH, predictedAttribution,
} from './r7Acceptance.js';

describe('SEAM_SIGNATURE — the coverage assertion (trap 86)', () => {
    it('covers every key `Main.startSave()` normalizes', () => {
        const r = assertSeamSignatureCovers();
        expect(r.saveKeys).toBe(SAVE_FILE_KEYS.length);
        expect(r.rows).toBe(SEAM_SIGNATURE.length);
    });

    it('⛔ MUTATION: a save key with no row THROWS, it does not warn', () => {
        expect(() => assertSeamSignatureCovers([...SAVE_FILE_KEYS, 'hasNewThing']))
            .toThrow(R7AcceptanceError);
        expect(() => assertSeamSignatureCovers([...SAVE_FILE_KEYS, 'hasNewThing']))
            .toThrow(/hasNewThing/);
    });

    it('⛔ MUTATION: a row claiming a key the game does not write THROWS', () => {
        // Drop `grassCut` from the game's side: the signature still claims it.
        const shortened = SAVE_FILE_KEYS.filter((k) => k !== 'grassCut');
        expect(() => assertSeamSignatureCovers(shortened)).toThrow(/grassCut/);
    });

    it('the fields that cannot be blanket equalities say so, by name', () => {
        const byField = new Map(SEAM_SIGNATURE.map((r) => [r.field, r]));
        expect(byField.get('save.time').comparable).toBe('pinned-equality');
        expect(byField.get('save.time').pin).toBe('Bot.pinDeadFrames');
        expect(byField.get('rng.gameplay').comparable).toBe('level-qualified-equality');
        expect(byField.get('fp.seed').comparable).toBe('declared-not-compared');
        // The badge row is EXCLUDED, not absent — trap 101.
        expect(byField.get('save.hasBadge').comparable).toBe('excluded');
    });

    it('⛓ `beam` and `rockSet` are signature rows, and the ledger says why', () => {
        const fields = SEAM_SIGNATURE.map((r) => r.field);
        expect(fields).toContain('save.beam');
        expect(fields).toContain('save.rockSet');
        expect(R7_LEDGER_EXCLUSIONS.beam).toMatch(/Shield\.as:46/);
        expect(R7_LEDGER_EXCLUSIONS.rockSet).toMatch(/Moonrock\.as:118/);
        // Neither is a collectible row.
        expect(R7_GOAL_LEDGER.some((r) => r.id.includes('beam'))).toBe(false);
    });
});

describe('seamRngPosture — stricter than R6\'s window question', () => {
    it('a render-CLEAN level makes the state comparable', () => {
        const p = seamRngPosture([], []);
        expect(p.comparable).toBe(true);
        expect(p.verdict).toMatch(/RENDER-CLEAN/);
    });

    it('⛔ a polluter with NO consumer still breaks the seam — R6 tolerated it', () => {
        const p = seamRngPosture(['Tile.render waterfall spray (t=25)'], []);
        expect(p.comparable).toBe(false);
        expect(p.verdict).toMatch(/NOT COMPARABLE, NOT READ/);
    });

    it('a polluter WITH a consumer is the at-risk case', () => {
        const p = seamRngPosture(['Moonrock.drawFlares (280/render)'], ['finalboss']);
        expect(p.comparable).toBe(false);
        expect(p.verdict).toMatch(/AT RISK/);
    });
});

describe('seamFindings — derived per field per seam', () => {
    const comparableRows = SEAM_SIGNATURE.filter((r) => r.comparable !== 'excluded');

    it('emits one row per comparable signature field per seam', () => {
        const seam = { name: 'S1->S2', exit: {}, boot: {} };
        const f = seamFindings([seam]);
        // one per field, plus the completeness row
        expect(f.length).toBe(comparableRows.length + 1);
    });

    it('⛔ MUTATION: a field missing on either side reads UNCLAIMED, never green', () => {
        const exit = {}; const boot = {};
        for (const r of comparableRows) { exit[r.field] = 1; boot[r.field] = 1; }
        delete exit['save.hasSword'];
        const f = seamFindings([{ name: 'S1->S2', exit, boot }]);
        const row = f.find((x) => x.name === 'S1->S2: save.hasSword');
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/UNCLAIMED/);
        expect(row.detail).toMatch(/exit latch does not carry it/);
    });

    it('⛔ MUTATION: perturbing ANY one field turns exactly that row red', () => {
        for (const target of comparableRows) {
            const exit = {}; const boot = {};
            for (const r of comparableRows) { exit[r.field] = 'v'; boot[r.field] = 'v'; }
            boot[target.field] = 'PERTURBED';
            const f = seamFindings([{ name: 'S', exit, boot }]);
            const reds = f.filter((x) => !x.ok);
            expect(reds.length, `perturbing ${target.field}`).toBe(1);
            expect(reds[0].name).toBe(`S: ${target.field}`);
        }
    });

    it('⛔ MUTATION: no seams at all is NOT green', () => {
        const f = seamFindings([]);
        expect(f.every((r) => r.ok)).toBe(false);
    });
});

describe('R7_GOAL_LEDGER — the census', () => {
    it('holds the sixteen chests, five keys, five totem parts and the Seed', () => {
        const by = (k) => R7_GOAL_LEDGER.filter((r) => r.kind === k).length;
        expect(by('chest')).toBe(16);
        expect(by('key')).toBe(5);
        expect(by('totempart')).toBe(5);
        expect(by('ending')).toBe(1);
        expect(by('pickup')).toBe(12);
        expect(by('encounter')).toBe(2);
    });

    it('every row has a gate and a citation — a row with neither is a comment', () => {
        for (const r of R7_GOAL_LEDGER) {
            expect(r.gate, r.id).toBeTruthy();
            expect(r.cite, r.id).toBeTruthy();
            expect(r.flag, r.id).toBeTruthy();
        }
    });

    it('ids are unique — two chests in one level would collide', () => {
        const ids = R7_GOAL_LEDGER.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('r7GoalFindings — trap 119\'s construction, asserted', () => {
    it('⛔ an empty earner map is 0/N and every row says UNCLAIMED', () => {
        const f = r7GoalFindings({}, []);
        expect(f.filter((r) => r.ok).length).toBe(0);
        expect(f.length).toBe(R7_GOAL_LEDGER.length + 1);
        for (const r of f.slice(0, -1)) expect(r.detail).toMatch(/UNCLAIMED/);
    });

    it('⛔⛔ MUTATION: a row added tomorrow CANNOT go unreported', () => {
        // The findings are a `.map()` over the ledger, so this is a claim
        // about the CONSTRUCTION, not about today's rows. Simulate the added
        // row by counting: every ledger row appears in the findings by id.
        const f = r7GoalFindings({}, []);
        for (const row of R7_GOAL_LEDGER) {
            expect(f.some((x) => x.name.startsWith(row.id)), `${row.id} unreported`).toBe(true);
        }
        // and nothing else does
        expect(f.length - 1).toBe(R7_GOAL_LEDGER.length);
    });

    it('a row earned by a segment NOT in the roster stays UNCLAIMED', () => {
        const f = r7GoalFindings(
            { 'sword@L10': { segment: 'r7-seg-1', witness: 'save.hasSword' } },
            [],
        );
        const row = f.find((x) => x.name.startsWith('sword@L10'));
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/not in the roster/);
    });

    it('⛔ a row earned with NO game-side witness stays UNCLAIMED', () => {
        const f = r7GoalFindings(
            { 'sword@L10': { segment: 'r7-seg-1' } },
            ['r7-seg-1'],
        );
        const row = f.find((x) => x.name.startsWith('sword@L10'));
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/no game-side witness/);
    });

    it('a fully witnessed row goes green, and only that row', () => {
        const f = r7GoalFindings(
            { 'sword@L10': { segment: 'r7-seg-1', witness: 'botStatus.save.hasSword' } },
            ['r7-seg-1'],
        );
        expect(f.filter((r) => r.ok).length).toBe(1);
        expect(f.find((r) => r.ok).name).toMatch(/^sword@L10/);
    });

    it('the criteria store no counts — totals come from the ledger', () => {
        const c = r7GoalCriteria({}, ['a', 'b']);
        expect(c.total).toBe(R7_GOAL_LEDGER.length);
        expect(c.earned).toBe(0);
        expect(c.rosterSize).toBe(2);
        expect(Object.values(c.byKind).reduce((a, k) => a + k.total, 0))
            .toBe(R7_GOAL_LEDGER.length);
    });
});

describe('R7_BATCH — the attribution, committed BEFORE the batch', () => {
    it('every item declares its stream effect', () => {
        for (const i of R7_BATCH.items) {
            expect(i.streamEffect, i.id).toMatch(/^IDENTICAL/);
            expect(i.cite, i.id).toBeTruthy();
        }
    });

    it('the prediction is ZERO re-records — and that is a falsifiable claim', () => {
        expect(R7_BATCH.predictedReRecords).toBe(0);
    });

    it('predictedAttribution: only v<=3 sword tapes change their VALUE', () => {
        const rows = predictedAttribution([
            { name: 'r3-walk-full', tape_version: 3, swordPickups: 1 },
            { name: 'r4-walk-full', tape_version: 4, swordPickups: 1 },
            { name: 'r5-shaft', tape_version: 5, swordPickups: 0 },
            { name: 'r1-walk-1', tape_version: 1, swordPickups: 0 },
        ]);
        expect(rows.every((r) => r.stream === 'IDENTICAL')).toBe(true);
        expect(rows.filter((r) => r.value !== 'unchanged').map((r) => r.name))
            .toEqual(['r3-walk-full']);
    });

    it('the recorded value-change set matches the derivation\'s shape', () => {
        // The three names were DERIVED at slice 0 by running `runTape` over
        // the whole roster; they are pinned here so a drift is visible, and
        // the derivation is what a re-run must reproduce.
        expect(R7_BATCH.predictedValueChanges).toHaveLength(3);
        for (const n of R7_BATCH.predictedValueChanges) expect(n).toMatch(/^r3-/);
    });
});
