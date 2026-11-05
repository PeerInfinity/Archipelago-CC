/**
 * THE DERIVED-RULE OVERRIDE, red-first (session tile-rules-automation-r-a3; ⚖ Robert 2026-11-04 "A + B now, C after B
 * (Recommended)"; designer GO, rules-4 PASS). `seedlingDerivedRuleTable.js` + `derivedRuleRows.derivedRuleTable`.
 *
 * ⛔ ECHO LAUNDERING: the maze must not read an override back. A sentinel planted in a table row (spelled so it stays
 * truth-table EQUAL — `Or(rule, And(rule, SENTINEL))` — so guard 2 lets it through) must reach the AP layer and NO world
 * payload, and the payloads must be byte-identical with and without it. The atlas side is the echo method's: a table row is
 * never an echoed element (`exact` requires echo-free), and every atlas row is planted (rule-less ones too,
 * mazeInputOutputSplit.test.js).
 */
import { describe, it, expect } from 'vitest';
import { buildPlaythroughMaze } from './make-seedling-playthrough-maze.mjs';
import {
    applyDerivedRuleTable, applyDerivedRuleTableToAtlas, refuseHandRowsUnderTable, tableStaleness, tableInputs,
    composedDisagreeMessage, importClosure, REGEN_RECIPE,
} from './seedlingDerivedRuleTable.js';
import { derivedRuleTable, labelDerivedRows, summarizeDerivedRows } from '../../frontend/modules/mazeRoom/tileSpike/derivedRuleRows.js';

const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const TRUE = { rule: 'True_' };
const SENTINEL = '⟦r-a3 override sentinel⟧';
const plantIn = (rule) => ({ rule: 'Or', children: [rule, { rule: 'And', children: [rule, has(SENTINEL)] }] });

// L98's two exits: one whose atlas row carries its rule (the Shield×2/weapon stairs), one whose rule is a landing gate (Swim).
const LEVELS = ['level_98', 'level_99', 'level_93'];
const row = (name, exitId, rule) => ({ key: `level_98|${name}`, kind: 'exit', region: 'level_98', name, arrival: 'entrance', atlas: { region_id: 'level_98', exit_id: exitId }, rule });
const compile = (derivedTable) => JSON.parse(buildPlaythroughMaze({ levels: LEVELS, embedSphereLog: false, derivedTable }).text);
const ruleOf = (doc, name) => doc.regions['1'].level_98.exits.find((e) => e.name === name).access_rule;
const payloads = (doc) => JSON.stringify(Object.values(doc.preset_sidecars['1']).map((sc) => sc.playable_payload ?? null));

describe('⛔ the maze cannot read an override back (sentinel pin)', () => {
    const plain = compile({ rows: [] });
    const STAIRS = 'level_98 -> level_99__r2c7';
    const SWIM = 'level_98 -> level_93__r5c7';
    const planted = compile({ rows: [row(STAIRS, 'out_stairsup_112_112', plantIn(ruleOf(plain, STAIRS))), row(SWIM, 'out_teleporter_112_192', plantIn(ruleOf(plain, SWIM)))] });
    it('the AP layer CARRIES the planted row (positive control: the plant reached the override)', () => {
        expect(JSON.stringify(ruleOf(planted, STAIRS))).toContain(SENTINEL);
        expect(JSON.stringify(ruleOf(planted, SWIM))).toContain(SENTINEL);
        expect(ruleOf(plain, SWIM)).toEqual(has('Progressive Swim'));   // a landing-gate rule, no atlas row
    });
    it('no world payload carries it, and the payloads are byte-identical with and without it', () => {
        expect(payloads(planted)).not.toContain(SENTINEL);
        expect(payloads(planted)).toBe(payloads(plain));
    });
    it('MUTANT: a row put where the worlds read (the hand inputs) IS carried — the read-back can fail', () => {
        const doc = JSON.parse(buildPlaythroughMaze({
            levels: LEVELS, embedSphereLog: false, derivedTable: { rows: [] },
            plant: ({ hand }) => { hand.exits.set('level_98/out_teleporter_112_192', has(SENTINEL)); },
        }).text);
        expect(payloads(doc)).toContain(SENTINEL);
    });
});

describe('guard 2: composed ≠ table is refused by name, with what to do', () => {
    it('the maze compile throws, naming the element and the input-side fix', () => {
        expect(() => compile({ rows: [row('level_98 -> level_93__r5c7', 'out_teleporter_112_192', TRUE)] }))
            .toThrow(/COMPOSED ≠ TABLE at level_98\|level_98 -> level_93__r5c7: the table's derived rule is looser.*derivation's INPUT/s);
    });
    it('applyDerivedRuleTable reports it and still overrides; an unknown element is refused', () => {
        const rules = { regions: { 1: { r: { exits: [{ name: 'x', access_rule: has('A') }], locations: [{ name: 'l' }] } } } };
        const out = applyDerivedRuleTable(rules, { rows: [{ key: 'r|x', kind: 'exit', region: 'r', name: 'x', rule: has('B') }, { key: 'r|@l', kind: 'location', region: 'r', name: 'l', rule: TRUE }] });
        expect(out.applied).toBe(2);
        expect(out.composedDisagrees.map((d) => [d.key, d.compare])).toEqual([['r|x', 'incomparable']]);
        expect(rules.regions[1].r.exits[0].access_rule).toEqual(has('B'));
        expect(composedDisagreeMessage(out.composedDisagrees[0])).toContain(REGEN_RECIPE);
        expect(() => applyDerivedRuleTable(rules, { rows: [{ key: 'q|y', kind: 'exit', region: 'q', name: 'y', rule: TRUE }] })).toThrow(/q\|y names no element/);
        expect(applyDerivedRuleTable(rules, { rows: [{ key: 'q|y', kind: 'exit', region: 'q', name: 'y', rule: TRUE }] }, { partial: true }).applied).toBe(0);
    });
    it('the atlas takes the table rule only where its row carries a rule, and reports the composed one', () => {
        const atlas = { regions: [{ region_id: 'level_1', exits: [{ exit_id: 'a', access_rule: has('A') }, { exit_id: 'b' }], locations: [] }] };
        const t = { rows: [{ key: 'k1', kind: 'exit', atlas: { region_id: 'level_1', exit_id: 'a' }, rule: { rule: 'Or', children: [has('A'), { rule: 'And', children: [has('A'), has('B')] }] } },
            { key: 'k2', kind: 'exit', atlas: { region_id: 'level_1', exit_id: 'b' }, rule: TRUE }] };
        const out = applyDerivedRuleTableToAtlas(atlas, t);
        expect(out.map((r) => [r.key, r.compare])).toEqual([['k1', 'equal']]);
        expect(atlas.regions[0].exits[0].access_rule.rule).toBe('Or');
        expect(atlas.regions[0].exits[1].access_rule).toBeUndefined();
    });
});

describe('guard 1: a hand term on a table element is refused (m3)', () => {
    it('names the element and its hand row', () => {
        const t = { rows: [{ key: 'level_82|x', kind: 'exit', atlas: { region_id: 'level_82', exit_id: 'out_teleporter_144_0' } }] };
        expect(() => refuseHandRowsUnderTable(t, { exitTerms: [{ region_id: 'level_82', exit_id: 'out_teleporter_144_0' }], locationTerms: new Map() }))
            .toThrow(/HAND row where the derived-rule table decides: level_82\|x \(hand level_82\/out_teleporter_144_0\)/);
        const loc = { rows: [{ key: 'level_19|@W', kind: 'location', atlas: { region_id: 'level_19', location: 'W' } }] };
        expect(() => refuseHandRowsUnderTable(loc, { exitTerms: [], locationTerms: new Map([['W', {}]]) })).toThrow(/level_19\|@W/);
        expect(() => refuseHandRowsUnderTable(t, { exitTerms: [], locationTerms: new Map() })).not.toThrow();
    });
});

describe('guard 3: staleness — the maze payloads and the engine closure', () => {
    const maze = { preset_sidecars: { 1: { a: { playable_payload: { x: 1 } } } } };
    it('a fresh table is not stale; a moved payload or engine is, with the regeneration recipe', () => {
        const table = { rows: [{}], inputs: tableInputs(maze) };
        expect(tableStaleness(table, maze)).toEqual([]);
        const moved = tableStaleness(table, { preset_sidecars: { 1: { a: { playable_payload: { x: 2 } } } } });
        expect(moved).toHaveLength(1);
        expect(moved[0]).toMatch(/maze world payloads moved.*regenerate: run alone.*gh workflow run seedling-probe\.yml/s);
        expect(tableStaleness({ ...table, inputs: { ...table.inputs, engineMd5: 'x' } }, maze)[0]).toMatch(/derivation engine moved.*comment-only edit counts/s);
        expect(tableStaleness({ rows: [], excluded: [], inputs: null }, maze)).toEqual([]);
    });
    it('the engine closure is derived from the certifier\'s imports, and holds the derivation engine', () => {
        const c = importClosure();
        expect(c).toContain('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js');
        expect(c).toContain('frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js');
    });
});

describe('derivedRuleTable: the selection', () => {
    const rules = {
        regions: { 1: { a: { exits: [{ name: 'a -> b', connected_region: 'b' }], locations: [{ name: 'E', event: true, item: { name: 'E' } }] }, b: { exits: [], locations: [] } } },
        preset_sidecars: { 1: { a: { playable_payload: { exits: [{ exitName: 'a -> b', atlas_exit_id: 'out_1' }] } }, b: {} } },
    };
    const exitRow = (derived, ap, extra = {}) => ({ kind: 'exit', region: 'a', name: 'a', arrival: 'entrance', verdict: 'agrees', exits: [{ name: 'a -> b', derived, ap }], ...extra });
    const label = (rows, echoes = new Set()) => labelDerivedRows(rows, { rules, echoes });
    it('an EQUAL, echo-free, overridable element is a row with its atlas address', () => {
        const t = derivedRuleTable(label([exitRow(has('X'), has('X'))]), { rules });
        expect(t.rows).toEqual([{ key: 'a|a -> b', kind: 'exit', region: 'a', name: 'a -> b', arrival: 'entrance', atlas: { region_id: 'a', exit_id: 'out_1' }, rule: has('X') }]);
    });
    it('path-vs-edge (not equal) and echoed elements are not exact', () => {
        expect(derivedRuleTable(label([exitRow({ rule: 'False_' }, TRUE)]), { rules }).rows).toEqual([]);
        expect(derivedRuleTable(label([exitRow(has('X'), has('X'))], new Set(['a|a -> b'])), { rules }).rows).toEqual([]);
    });
    it('a rule naming an EVENT the document places is sharedBinding (any event, not locks only): excluded, with why', () => {
        const t = derivedRuleTable(label([exitRow(has('E'), has('E'))]), { rules });
        expect(t.rows).toEqual([]);
        expect(t.excluded).toEqual([{ key: 'a|a -> b', why: 'sharedBinding (playthroughEventLayer): E' }]);
    });
    it('an EVENT LOCATION is sharedBinding too (its place is the event layer\'s side; `event` is a boolean on the row)', () => {
        const rows = [{ kind: 'location', region: 'a', name: 'E', event: true, arrival: 'entrance', verdict: 'agrees', derived: TRUE, ap: TRUE }];
        const t = derivedRuleTable(label(rows), { rules });
        expect(t.rows).toEqual([]);
        expect(t.excluded).toEqual([{ key: 'a|@E', why: 'sharedBinding (playthroughEventLayer): E' }]);
    });
    // ⛓ BINDING WITNESSES (slice rules-sharedbinding-witnesses; rules-4's R-A3 ruling (c)): a sharedBinding element is
    // re-admitted only when EVERY event it names has a ledger entry — the ledger is data, never a list in code.
    const witnessed = (rows, w) => labelDerivedRows(rows, { rules: rules2, echoes: new Set(), witnessed: w });
    const rules2 = {
        regions: { 1: { a: { exits: [{ name: 'a -> b', connected_region: 'b' }], locations: [{ name: 'E', event: true, item: { name: 'E' } }, { name: 'F', event: true, item: { name: 'F' } }] }, b: { exits: [], locations: [] } } },
        preset_sidecars: rules.preset_sidecars,
    };
    const both = { rule: 'And', children: [has('E'), has('F')] };
    it('a WITNESSED binding re-admits its element (bindingWitnessed, no sharedBinding); a mutant without the ledger restores the exclusion', () => {
        const t = witnessed([exitRow(has('E'), has('E'))], [{ event: 'E' }]);
        expect(t.elements[0].sharedBinding).toBeUndefined();
        expect(t.elements[0].bindingWitnessed).toEqual({ by: 'gameWitnessLedger', events: ['E'] });
        expect(derivedRuleTable(t, { rules: rules2 }).rows.map((r) => r.key)).toEqual(['a|a -> b']);
        expect(summarizeDerivedRows(t).sharedBinding).toBe(0);
        // m: the ledger dropped → the exclusion is back, by its fact.
        expect(derivedRuleTable(witnessed([exitRow(has('E'), has('E'))], []), { rules: rules2 }).excluded)
            .toEqual([{ key: 'a|a -> b', why: 'sharedBinding (playthroughEventLayer): E' }]);
    });
    it('an element naming a witnessed AND an unwitnessed event stays excluded, naming both', () => {
        const t = derivedRuleTable(witnessed([exitRow(both, both)], [{ event: 'E' }]), { rules: rules2 });
        expect(t).toEqual({ rows: [], excluded: [{ key: 'a|a -> b', why: 'sharedBinding (playthroughEventLayer): E, F' }] });
    });
    it('a ledger entry naming no event the document places is refused (stale)', () => {
        expect(() => witnessed([exitRow(has('X'), has('X'))], [{ event: 'E' }, { event: 'Gone' }])).toThrow(/naming no event the document places \(stale\): Gone/);
    });
    it('a named exclusion is listed with its reason; a stale one is refused', () => {
        const t = derivedRuleTable(label([exitRow(has('X'), has('X'))]), { rules, exclusions: [{ key: 'a|a -> b', why: 'because' }] });
        expect(t).toEqual({ rows: [], excluded: [{ key: 'a|a -> b', why: 'because' }] });
        expect(() => derivedRuleTable(label([exitRow(has('X'), has('X'))]), { rules, exclusions: [{ key: 'nope', why: 'x' }] })).toThrow(/stale\): nope/);
    });
});
