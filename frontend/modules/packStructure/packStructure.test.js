/**
 * packStructure — the readers for the `structure`, `numbers` and `bindings` layers (⛓ CONTENT SETS PL-1, Z.2/Z.4).
 * The packs are FIXTURES ON DISK (`fixtures/packs/`), read through `loadPackStack` like any committed pack, so the
 * loader's provenance check runs on them too.
 */
import { describe, expect, it } from 'vitest';

import { ContentPackError, LOGIC_LAYERS, loadPackStack } from '../contentPacks/contentPacks.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { createPackConcepts } from '../packConcepts/packConcepts.js';
import { CONTENT_LAYERS, loadContentSet } from '../procgenPipeline/worldContent.js';
import {
    DEFAULT_TERRAIN_PASS, MODIFIES_PARTS, RESULT_WHEN, STRUCTURE_FIELDS, STRUCTURE_KINDS, TERRAIN_PASSES,
    assertPresentsStructure, terrainPassOf, createStructure, parseModifiesPart, parseStructureId, parseStructureManifest,
} from './packStructure.js';
import { createNumbers, numbersSelectionRefusal, parseNumbersManifest, parseValuePath } from './packNumbers.js';
import { assertBindingsBind, createBindings, parseBindingsManifest } from './packBindings.js';

const FIXTURES = new URL('./fixtures/packs/', import.meta.url).href;
const io = nodePackIo({ base: FIXTURES });
const load = (ids, only) => loadPackStack(ids, { ...io, ...(only ? { only } : {}) });

/** The fixture omsi structure manifest, cloned, with `edit` applied to its entries. */
async function omsiStructureWith(edit) {
    const [omsi] = await load(['omsi'], ['structure']);
    const json = structuredClone(omsi.layers.structure);
    edit(json.entries);
    return json;
}

describe('structure: the fixture packs, read from disk', () => {
    it('loads omsi, jta and ground together (what exists: packs added together), every entry kind present', async () => {
        const s = createStructure(await load(['omsi', 'jta', 'ground']));
        expect(s.packs()).toEqual(['omsi', 'jta', 'ground']);
        for (const kind of STRUCTURE_KINDS) expect(s.ofKind(kind).length).toBeGreaterThan(0);
        expect(STRUCTURE_KINDS.flatMap((k) => s.ofKind(k)).sort()).toEqual(s.keys().sort());
        expect(Object.isFrozen(s.get('omsi:task/pick-locks').requires[0][0])).toBe(true);
    });

    it('holds Y\'s six additions as Z.2 writes them (C1–C6)', async () => {
        const s = createStructure(await load(['omsi', 'jta']));
        const wander = s.get('omsi:stat/wander');
        expect([wander.owner, wander.max]).toEqual(['omsi:task/wander', true]);                          // C1
        expect(s.get('omsi:task/pick-locks').limit).toEqual({ grows_with: 'omsi:stat/wander' });          // C2
        const whens = s.keys().flatMap((k) => (s.get(k).results ?? []).map((r) => r.when ?? 'each'));
        expect([...new Set(whens)].sort()).toEqual([...RESULT_WHEN].sort());                              // C3
        expect(s.get('omsi:resource/glasses').modifies[0]).toEqual(
            { entry: 'omsi:task/wander', part: 'results.omsi:stat/wander', lasts: 'loop' });                // C4
        expect(s.get('jta:boon/how-to-read').modifies[0].entry).toBe('*');
        expect('place' in s.get('jta:task/use-food')).toBe(false);                                        // C5
        expect(s.get('omsi:task/pick-locks').requires.length).toBeGreaterThan(1);                         // C6
    });

    it('a structure id parses into pack, kind and slug; a modifies part is on the closed list', () => {
        expect(parseStructureId('omsi:task/pick-locks')).toEqual({ pack: 'omsi', kind: 'task', slug: 'pick-locks' });
        expect(parseStructureId('omsi:monster/x')).toBeNull();
        expect(MODIFIES_PARTS.length).toBe(4);
        expect(parseModifiesPart('results.omsi:stat/dex')).toEqual({ part: 'results', id: 'omsi:stat/dex' });
        expect(parseModifiesPart('results.dex')).toBeNull();
        expect(parseModifiesPart('cost')).toBeNull();
    });
});

describe('structure: ⛔ refusal by name', () => {
    const refuses = async (edit, pattern) => {
        const json = await omsiStructureWith(edit);
        expect(() => createStructure([{ id: 'omsi', layers: { structure: json } }])).toThrow(ContentPackError);
        expect(() => createStructure([{ id: 'omsi', layers: { structure: json } }])).toThrow(pattern);
    };
    const t = (e) => e['omsi:task/pick-locks'];
    it('an unknown kind', () => refuses((e) => { e['omsi:task/x'] = { kind: 'quest' }; }, /entry "omsi:task\/x": kind "quest" is not one of/));
    it('a kind the key does not carry', () => refuses((e) => { e['omsi:task/x'] = { kind: 'stat' }; }, /kind "stat" does not match the key's kind "task"/));
    it('a key in another pack\'s namespace', () => refuses((e) => { e['jta:task/x'] = { kind: 'task' }; }, /namespace "jta" is not its pack's id "omsi"/));
    it('a field the kind does not take (a number in structure)', () => refuses((e) => { t(e).cost = 400; }, /pick-locks": field "cost" is not one a task takes/));
    it('a name in structure', () => refuses((e) => { e['omsi:stat/dex'].name = 'Dexterity'; }, /dex": field "name" is not one a stat takes/));
    it('a place that is not a place', () => refuses((e) => { t(e).place = 'omsi:stat/dex'; }, /place "omsi:stat\/dex" is a stat, not a place/));
    it('requires written flat (not a list of sets)', () => refuses((e) => { t(e).requires = [{ stat: 'omsi:stat/dex' }]; }, /requires\[0\] is not a non-empty set/));
    it('a requirement member of neither form', () => refuses((e) => { t(e).requires = [[{ boon: 'x' }]]; }, /requires\[0\]\[0\] is not \{ stat \} or \{ resource, consume\? \}/));
    it('a result of two forms', () => refuses((e) => { t(e).results = [{ stat: 'omsi:stat/dex', boon: 'jta:boon/how-to-read' }]; }, /results\[0\] needs exactly one of/));
    it('a resource result with no sign', () => refuses((e) => { t(e).results = [{ resource: 'omsi:resource/gold' }]; }, /needs sign "\+" or "-"/));
    it('an unknown when', () => refuses((e) => { t(e).results[0].when = 'sometimes'; }, /when "sometimes" is not one of each, last, every_nth/));
    it('a limit of a third form', () => refuses((e) => { t(e).limit = 5; }, /limit \(true, or \{ grows_with \}\) is not an object/));
    it('a modifies part off the closed list', () => refuses((e) => { e['omsi:resource/glasses'].modifies[0].part = 'cost'; }, /part "cost" is not one of time, limit/));
    it('a modifies lasts off the list', () => refuses((e) => { e['omsi:resource/glasses'].modifies[0].lasts = 'forever'; }, /lasts "forever"/));
    it('an after naming a stat', () => refuses((e) => { t(e).after = [['omsi:stat/dex']]; }, /after\[0\]\[0\]: the task "omsi:stat\/dex" is a stat/));
    it('max other than true', () => refuses((e) => { e['omsi:stat/wander'].max = 100; }, /max is true .* or absent/));
    it('a reference no pack in the stack holds', () => refuses((e) => { t(e).time = 'omsi:resource/stamina'; }, /time names "omsi:resource\/stamina", which no pack in the stack holds/));
    it('a boon result of a form a boon cannot give (PL-2: stat or resource only, no `when`)', async () => {
        const [jta] = await load(['jta'], ['structure']);
        const withBoon = (results) => {
            const json = structuredClone(jta.layers.structure);
            json.entries['jta:boon/how-to-read'].results = results;
            return () => parseStructureManifest(json, 'jta');
        };
        expect(withBoon([{ opens: 'jta:task/use-food' }])).toThrow(/how-to-read": results\[0\] needs exactly one of stat, resource \(got opens\)/);
        expect(withBoon([{ stat: 'jta:stat/study', when: 'last' }])).toThrow(/results\[0\]: the result has unknown field "when"/);
        expect(withBoon([{ resource: 'jta:resource/food' }])).toThrow(/needs sign "\+" or "-"/);
        expect(withBoon([{ stat: 'jta:stat/study' }])()).toBeTruthy();
    });
    it('an unknown manifest field', async () => {
        const json = await omsiStructureWith(() => {});
        json.tasks = {};
        expect(() => parseStructureManifest(json, 'omsi')).toThrow(/unknown field "tasks"/);
    });
    it('every field each kind takes is one the fixtures use (no field goes unread)', async () => {
        const s = createStructure(await load(['omsi', 'jta', 'ground']));
        const used = new Set(s.keys().flatMap((k) => Object.keys(s.get(k)).map((f) => `${s.get(k).kind}.${f}`)));
        const unused = Object.entries(STRUCTURE_FIELDS).flatMap(([kind, fs]) => fs.map((f) => `${kind}.${f}`))
            .filter((kf) => !used.has(kf) && !kf.endsWith('.src'));
        expect(unused).toEqual([]);
    });
});

describe('⛓ PASS-1 — terrain: a tile kind\'s declared passability', () => {
    const ground = async () => structuredClone((await load(['ground'], ['structure']))[0].layers.structure);
    const parse = (json) => () => parseStructureManifest(json, 'ground');

    it('the fixture declares one entry per value of the closed set; the default is walkable', async () => {
        const s = createStructure(await load(['ground']));
        expect(s.ofKind('terrain').map((k) => s.get(k).pass).sort()).toEqual([...TERRAIN_PASSES].sort());
        expect(TERRAIN_PASSES).toContain(DEFAULT_TERRAIN_PASS);
        expect(Object.isFrozen(TERRAIN_PASSES)).toBe(true);
    });

    it.each([
        ['a value outside the set', (e) => { e['ground:terrain/rug'].pass = 'one-way'; }, /entry "ground:terrain\/rug": pass "one-way" is not one of walkable, blocked/],
        ['no pass at all', (e) => { delete e['ground:terrain/rug'].pass; }, /entry "ground:terrain\/rug": pass undefined is not one of/],
        ['a field a terrain does not take', (e) => { e['ground:terrain/rug'].needs = 'swim'; }, /field "needs" is not one a terrain takes \(kind, src, pass\)/],
        ['pass on a kind that is not terrain', (e) => { e['ground:place/hall'] = { kind: 'place', pass: 'blocked' }; }, /field "pass" is not one a place takes/],
    ])('refused by name: %s', async (_, edit, pattern) => {
        const json = await ground();
        edit(json.entries);
        expect(parse(json)).toThrow(ContentPackError);
        expect(parse(json)).toThrow(pattern);
    });

    it('terrainPassOf reads a concept\'s pass through the structure layer; no terrain presented is walkable', async () => {
        const stack = await load(['ground']);
        const words = createPackConcepts(stack);
        const structure = createStructure(stack);
        assertPresentsStructure(words, structure);
        expect(terrainPassOf(words.get('ground:terrain/pillar'), structure)).toBe('blocked');
        expect(terrainPassOf(words.get('ground:terrain/rug'), structure)).toBe('walkable');
        expect(terrainPassOf(words.get('ground:object/lamp'), structure)).toBe(DEFAULT_TERRAIN_PASS);
        expect(terrainPassOf(words.get('ground:object/lamp'), null)).toBe(DEFAULT_TERRAIN_PASS);
        // A terrain presented with no logic layer loaded is refused by name, never read as walkable.
        expect(() => terrainPassOf(words.get('ground:terrain/pillar'), null))
            .toThrow(/concept "ground:terrain\/pillar" presents "ground:terrain\/pillar", which no structure in the stack holds/);
    });

    it('a concept that presents a terrain entry is of kind terrain (the Z.1 two-form presents)', async () => {
        const [g] = await load(['ground'], ['concepts']);
        const json = structuredClone(g.layers.concepts);
        json.concepts['ground:terrain/pillar'].kind = 'object';
        expect(() => createPackConcepts([{ id: 'ground', layers: { concepts: json } }]))
            .toThrow(/presents the terrain "ground:terrain\/pillar", but its own kind is object/);
    });
});

describe('the words: a pack concept presents a structure entry (Z.1, Z.3)', () => {
    it('the pack\'s own words, then a theme later in the stack renames the task (latest wins)', async () => {
        const words = createPackConcepts(await load(['omsi', 'theme'], ['concepts']));
        expect(words.presenting('omsi:task/pick-locks').name).toBe('Open Something Locked');
        expect(createPackConcepts(await load(['omsi'], ['concepts'])).presenting('omsi:task/pick-locks').name).toBe('Pick Locks');
        assertPresentsStructure(words, createStructure(await load(['omsi'], ['structure'])));
    });
    it('a namespaced presents that no structure holds is refused by name', async () => {
        const words = createPackConcepts(await load(['theme'], ['concepts']));
        const jta = createStructure(await load(['jta'], ['structure']));
        expect(() => assertPresentsStructure(words, jta))
            .toThrow(/pack "theme" concept "theme:task\/pick-locks" presents "omsi:task\/pick-locks", which no structure/);
    });
    it('⛔ the words never read structure, numbers or bindings: a content set over the fixtures fetches concepts and text only', async () => {
        expect([...CONTENT_LAYERS]).toEqual(['concepts', 'text']);
        expect(CONTENT_LAYERS.filter((l) => LOGIC_LAYERS.includes(l))).toEqual([]);
        const read = [];
        const set = await loadContentSet(['omsi', 'jta', 'theme'], { base: FIXTURES, readJson: async (u) => { read.push(u); return io.readJson(u); } });
        const layersRead = read.filter((u) => !u.endsWith('/pack.json')).map((u) => u.slice(FIXTURES.length).split('/')[1]);
        expect([...new Set(layersRead)]).toEqual(['concepts']);
        expect(set.concepts.presenting('omsi:task/pick-locks').pack).toBe('theme');
    });
});

describe('numbers (Z.4) — a set holds DEFAULTS (Z7)', () => {
    it('value paths: the forms Z.4 writes', () => {
        expect(parseValuePath('time')).toEqual({ head: 'time' });
        expect(parseValuePath('count')).toEqual({ head: 'count' });     // ⛓ PL-2: a boon's item-pool copies
        expect(parseValuePath('requires.omsi:stat/wander.min')).toEqual({ head: 'requires', id: 'omsi:stat/wander', field: 'min' });
        expect(parseValuePath('results.omsi:resource/gold')).toEqual({ head: 'results', id: 'omsi:resource/gold' });
        expect(parseValuePath('modifies.results.omsi:stat/wander')).toEqual({ head: 'modifies', part: 'results.omsi:stat/wander' });
        for (const bad of ['cost', 'requires.omsi:stat/wander', 'results.gold', 'modifies.cost']) expect(parseValuePath(bad)).toBeNull();
    });
    it('reads the fixture sets, one per game, keyed by structure id and value path', async () => {
        const n = createNumbers(await load(['omsi'], ['numbers']));
        expect(n.sets().map((s) => s.game).sort()).toEqual(['action_nodes', 'omsi']);
        const omsi = n.set('omsi', 'omsi');
        expect(omsi.value('omsi:task/pick-locks', 'time')).toBe(400);
        expect(omsi.value('omsi:task/pick-locks', 'results.omsi:resource/gold')).toEqual({ base: 10, every: 10 });
        expect(omsi.economy.start_clock).toBe(250);
        expect(n.set('omsi', 'jta')).toBeNull();
    });
    it('a later pack wins per value path; the others fall through', async () => {
        const [omsi] = await load(['omsi'], ['numbers']);
        const over = { id: 'tuning', layers: { numbers: { schema_version: 1, sets: { omsi: { exists: 'omsi', values: { 'omsi:task/pick-locks': { time: 300 } } } } } } };
        const set = createNumbers([omsi, over]).set('omsi', 'omsi');
        expect([set.value('omsi:task/pick-locks', 'time'), set.packOf('omsi:task/pick-locks', 'time')]).toEqual([300, 'tuning']);
        expect(set.value('omsi:task/pick-locks', 'requires.omsi:stat/wander.min')).toBe(20);
    });
    const bad = (sets) => () => parseNumbersManifest({ schema_version: 1, sets }, 'p');
    it('refuses by name: a bad path, a string value, an entry of another pack, a bad exists, a bad game id', () => {
        expect(bad({ omsi: { exists: 'p', values: { 'p:task/a': { cost: 1 } } } })).toThrow(/set "omsi": values "p:task\/a": "cost" is not a value path/);
        expect(bad({ omsi: { exists: 'p', values: { 'p:task/a': { time: 'slow' } } } })).toThrow(/"time" is "slow", not a number/);
        expect(bad({ omsi: { exists: 'p', values: { 'q:task/a': { time: 1 } } } })).toThrow(/names an entry of pack "q", but the set prices "p"/);
        expect(bad({ omsi: { exists: 'P!' } })).toThrow(/exists "P!" is not a pack id/);
        expect(bad({ 'Omsi': { exists: 'p' } })).toThrow(/set "Omsi": the key is not a substrate id/);
    });
    it('⛔ a numbers pack for another game or another "what exists" is refused by name (Z.5)', async () => {
        const [omsi] = await load(['omsi'], ['numbers']);
        expect(numbersSelectionRefusal(omsi, { substrateIds: ['omsi'], exists: ['omsi'] })).toBeNull();
        expect(numbersSelectionRefusal(omsi, { substrateIds: ['action_nodes'], exists: ['omsi'] })).toBeNull();
        expect(numbersSelectionRefusal(omsi, { substrateIds: ['jta'], exists: ['omsi'] }))
            .toMatch(/^numbers names the pack "omsi", which has no set for the substrate\(s\) \[jta\] over the world's exists \[omsi\] \(its sets: omsi over omsi, action_nodes over omsi\)$/);
        expect(numbersSelectionRefusal(omsi, { substrateIds: ['omsi'], exists: ['jta'] })).toMatch(/over the world's exists \[jta\]/);
        const [jta] = await load(['jta']);
        expect(numbersSelectionRefusal(jta, { substrateIds: ['jta'], exists: ['jta'] })).toBe('numbers names the pack "jta", which has no numbers layer');
    });
});

describe('bindings (Z.4)', () => {
    it('reads a binding per game and structure id; `src` stays in the pack', async () => {
        const b = createBindings(await load(['omsi', 'jta'], ['bindings']));
        expect(b.games().sort()).toEqual(['jta', 'omsi']);
        expect(b.of('jta', 'jta:task/beg-for-food').skills_slots).toEqual([0]);
        expect('src' in b.of('omsi', 'omsi:task/pick-locks')).toBe(false);
        expect(b.of('jta', 'omsi:task/pick-locks')).toBeNull();
        assertBindingsBind(b, createStructure(await load(['omsi', 'jta'], ['structure'])));
    });
    it('refuses by name: another pack\'s entry, a non-object, a bad game id; and a binding with no structure entry', async () => {
        const one = (bindings) => () => parseBindingsManifest({ schema_version: 1, bindings }, 'p');
        expect(one({ jta: { 'q:task/a': {} } })).toThrow(/binding "q:task\/a": names an entry of pack "q"/);
        expect(one({ jta: { 'p:task/a': 3 } })).toThrow(/binding "p:task\/a": the binding is not an object/);
        expect(one({ 'J-T-A': {} })).toThrow(/game "J-T-A": the key is not a substrate id/);
        const b = createBindings(await load(['jta'], ['bindings']));
        const omsi = createStructure(await load(['omsi'], ['structure']));
        expect(() => assertBindingsBind(b, omsi))
            .toThrow(/game "jta" binding "jta:task\/beg-for-food" names an entry no structure in the stack holds/);
    });
});
