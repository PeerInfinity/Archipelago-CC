/**
 * packResolver — (substrate, the three settings) → one resolved document + a gap report (⛓ CONTENT SETS PL-2, Z.5/Z.6).
 *
 * 1. The ActionNodes proof: the committed pack `example-village` resolves to the AN-1 example graph document, apart
 *    from its provenance, and that document compiles to the committed preset, apart from its provenance block.
 * 2. Table mode over an in-memory pack that needs every rule ActionNodes applies: each fill and flattening is a row.
 * 3. Refusals by name: `assign`, a numbers pack for another game, a rule the substrate does not apply.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import '../actionNodes/actionNodesLibrary.js';
import { compileActionGraph } from '../actionNodes/actionGraphCompiler.js';
import { validateActionGraph } from '../actionNodes/actionGraph.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { FIXTURE_PROVENANCE } from '../contentPacks/testing/fixtureProvenance.js';
import { substrateRegistryEntry as actionNodesEntry } from '../actionNodes/actionNodesLibrary.js';
import { stringifyRulesJson } from '../shared/rulesJsonBuilder.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { FIRST_WALK_CANDIDATE, resolveContent, resolveLoaded } from './packResolver.js';
import { contentGapReport, gapReportLines } from '../../../scripts/procgen/report-content-gaps.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GRAPH_PATH = 'frontend/modules/actionNodes/graphs/example-village.json';
const PRESET_PATH = 'frontend/presets/action_nodes_example/AP_1/AP_1_rules.json';
const PACK = 'example-village';
const readRepoJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));

/** A graph without its provenance: the block, and every node's and boon's `src`. */
function withoutProvenance(graph) {
    const g = structuredClone(graph);
    delete g.provenance;
    for (const table of [g.nodes, g.boons]) for (const e of Object.values(table)) delete e.src;
    return g;
}

describe('the ActionNodes proof: the example village as a pack', () => {
    it('resolve(action_nodes, {exists: [example-village]}, table) deep-equals the committed graph, apart from provenance', async () => {
        const { document } = await resolveContent('action_nodes', { exists: [PACK] }, nodePackIo());
        const graph = readRepoJson(GRAPH_PATH);
        expect(withoutProvenance(document)).toEqual(withoutProvenance(graph));
        // Key order too, so the compiler (which walks objects in order) sees the same document.
        expect(JSON.stringify(withoutProvenance(document))).toBe(JSON.stringify(withoutProvenance(graph)));
        expect(validateActionGraph(document).ok).toBe(true);
    });

    it('the preset compiled from the resolved graph equals the committed preset, apart from its provenance block', async () => {
        const { document } = await resolveContent('action_nodes', { exists: [PACK] }, nodePackIo());
        const { rules } = compileActionGraph(document, { seed: 1, graphPath: GRAPH_PATH });
        const preset = readRepoJson(PRESET_PATH);
        const strip = (d) => { const c = structuredClone(d); delete c.provenance; return c; };
        expect(stringifyRulesJson(strip(rules))).toBe(stringifyRulesJson(strip(preset)));
        // The resolved graph names its packs' entries, never a per-entry source (Z.7).
        expect(rules.provenance['1'].graph_provenance.sources.packs.type).toBe('derived');
        expect(rules.provenance['1'].graph_provenance.sources.packs.from.every((k) => k.startsWith(`${PACK}:`))).toBe(true);
    });

    it('its provenance moved onto the pack: every source of the graph\'s block is a source of one of the pack\'s layers', async () => {
        const graph = readRepoJson(GRAPH_PATH);
        const layers = ['structure', 'concepts', 'numbers'].map((l) => readRepoJson(`frontend/packs/${PACK}/${l}/manifest.json`).provenance.sources);
        for (const [id, source] of Object.entries(graph.provenance.sources)) {
            expect(layers.some((s) => JSON.stringify(s[id]) === JSON.stringify(source)), id).toBe(true);
        }
    });

    it('the gap report (the script\'s): one row, P1 placing the use node after the start; nothing flattened, unused or unnamed', async () => {
        const result = await contentGapReport('action_nodes', { exists: [PACK] }, { registerAll: false });
        const { report } = result;
        expect(report.filled).toEqual([{ entry: `${PACK}:task/eat-bread`, part: 'after', rule: 'P1@1', value: [['start']] }]);
        expect([report.flattened, report.unused, report.unnamed]).toEqual([[], [], []]);
        expect(report.numbersMode).toBe('table');
        const lines = gapReportLines(result);
        expect(lines.some((l) => l.includes('P1@1') && l.includes('eat-bread'))).toBe(true);
    });
});

/* ── An in-memory pack that needs every rule ActionNodes applies ──────────── */

const P = 'p';
const k = (kind, slug) => `${P}:${kind}/${slug}`;
const MANA = k('resource', 'mana');
const task = (extra) => ({ kind: 'task', time: MANA, ...extra });
const STRUCTURE = {
    schema_version: 1,
    entries: {
        [k('place', 'home')]: { kind: 'place' },
        [k('place', 'far')]: { kind: 'place' },
        [MANA]: { kind: 'resource' },
        [k('stat', 'str')]: { kind: 'stat', modifies: [{ entry: k('task', 'a'), part: 'time', lasts: 'loop' }] },
        [k('stat', 'int')]: { kind: 'stat' },
        [k('resource', 'gold')]: { kind: 'resource' },
        [k('boon', 'charm')]: { kind: 'boon', results: [{ stat: k('stat', 'str') }] },
        [k('task', 'start')]: task({ place: k('place', 'home'), tags: ['start'] }),
        // place = the start's, no after → after the start (structural); no limit → L1; two stat results, no numbers → AN2
        [k('task', 'a')]: task({ place: k('place', 'home'), results: [{ stat: k('stat', 'str') }, { stat: k('stat', 'int') }] }),
        // alternatives → AN-flat; str minimum missing → AN1; every_nth → AN-flat; opens the far place
        [k('task', 'b')]: task({
            place: k('place', 'home'), after: [[k('task', 'a')]], limit: true,
            requires: [[{ stat: k('stat', 'str') }], [{ resource: k('resource', 'gold') }]],
            results: [{ resource: k('resource', 'gold'), sign: '+', when: 'every_nth' }, { opens: k('place', 'far') }],
        }),
        // a check at the far place: after its opener; a boon result → B1
        [k('task', 'e')]: task({ place: k('place', 'far'), limit: true, tags: ['check'], results: [{ boon: k('boon', 'charm') }] }),
        // no place, no after → P1; a use task with no limit → L2 (nothing gives gold, so 1)
        [k('task', 'd')]: task({ tags: ['use'], requires: [[{ resource: k('resource', 'gold'), consume: true }]], results: [{ resource: MANA, sign: '+' }] }),
        // a growing limit → AN-flat then L1; no action_nodes time → T1 from the omsi set
        [k('task', 'c')]: task({ place: k('place', 'far'), after: [[k('task', 'e')]], limit: { grows_with: k('stat', 'str') }, tags: ['goal'] }),
    },
};
const NUMBERS = {
    schema_version: 1,
    sets: {
        action_nodes: {
            exists: P,
            economy: { loop_mana: 100 },
            values: {
                [k('task', 'start')]: { time: 0, limit: 1 },
                [k('task', 'a')]: { time: 25 },
                [k('task', 'b')]: { time: 10, limit: 1, [`results.${k('resource', 'gold')}`]: 2 },
                [k('task', 'e')]: { time: 5, limit: 1 },
                [k('task', 'd')]: { time: 0, [`requires.${k('resource', 'gold')}.min`]: 1, [`results.${MANA}`]: 5 },
                [k('boon', 'charm')]: { count: 1, [`results.${k('stat', 'str')}`]: 1 },
            },
        },
        omsi: { exists: P, economy: { start_clock: 250 }, values: { [k('task', 'c')]: { time: 100 } } },
    },
};
const CONCEPTS = {
    schema_version: 1,
    concepts: { [k('task', 'a')]: { kind: 'task', name: 'Do A', presents: k('task', 'a') } },
};
const THEME = {
    schema_version: 1,
    concepts: { 'theme:task/a': { kind: 'task', name: 'Themed A', presents: k('task', 'a') } },
};
/** An in-memory loaded pack (`loadPackStack`'s row shape); each layer names the fixture source. */
const loaded = (id, layers) => Object.freeze({
    id,
    layers: Object.freeze(Object.fromEntries(Object.entries(layers).map(([name, json]) => [name, { ...json, provenance: FIXTURE_PROVENANCE }]))),
});
const memPack = loaded(P, { structure: STRUCTURE, numbers: NUMBERS, concepts: CONCEPTS });

function resolveMem({ words = [memPack], numbersStack = [memPack], registry = substrateRegistry } = {}) {
    return resolveLoaded('action_nodes', { exists: [P] }, { existsLoaded: [memPack], wordsLoaded: words, numbersStack, registry });
}
const rowsOf = (rows, entry) => rows.filter((r) => r.entry === entry);

describe('table mode: a missing number is filled by rule and listed (Z.6)', () => {
    const { document: g, report } = resolveMem();

    it('the document is a valid graph', () => {
        expect(validateActionGraph(g).ok).toBe(true);
    });

    it('L1: a missing limit is max(1, ⌊clock ÷ time⌋)', () => {
        expect(g.nodes.a.limit).toBe(Math.floor(100 / 25));
        expect(rowsOf(report.filled, k('task', 'a'))).toContainEqual({ entry: k('task', 'a'), part: 'limit', rule: 'L1@1', value: 4 });
    });

    it('AN2: a stat result with no number is round(weight × rate × share × 10), at least 1', () => {
        expect(g.nodes.a.results.stats).toEqual({ str: 1, int: 1 });   // weight ½ (two stats), share ¼ → 1.25 → 1
        expect(rowsOf(report.filled, k('task', 'a')).filter((r) => r.rule === 'AN2@1')).toHaveLength(Object.keys(g.nodes.a.results.stats).length);
    });

    it('AN1: a stat minimum with no number is the stat\'s gains over the after ancestors; AN-flat takes the first set', () => {
        expect(g.nodes.b.requires).toEqual({ stats: { str: g.nodes.a.results.stats.str * g.nodes.a.limit } });
        expect(report.flattened).toContainEqual({ entry: k('task', 'b'), part: 'requires', rule: 'AN-flat@1', from: 'alternatives' });
        expect(report.flattened).toContainEqual({ entry: k('task', 'b'), part: `results.${k('resource', 'gold')}`, rule: 'AN-flat@1', from: 'every_nth' });
    });

    it('an `opens` result places the opened place\'s tasks after the opener', () => {
        expect(g.nodes.e.after).toEqual([['b']]);
    });

    it('B1: a task result that gives a boon is listed, not written', () => {
        expect(report.unused).toEqual([expect.objectContaining({ entry: k('task', 'e'), rule: 'B1@1' })]);
        expect(g.nodes.e.results).toBeUndefined();
    });

    it('P1 and L2: a placeless use task goes after the start, its limit is the number held (at least 1)', () => {
        expect(g.nodes.d.after).toEqual([['start']]);
        expect(g.nodes.d.limit).toBe(1);
        expect(g.nodes.d.results).toEqual({ resources: { gold: -1 }, mana: 5 });
        expect(rowsOf(report.filled, k('task', 'd')).map((r) => r.rule).sort()).toEqual(['L2@1', 'P1@1']);
    });

    it('T1 and a growing limit: time from another game\'s set as a share of its clock; the limit flattened then L1', () => {
        expect(g.nodes.c.time).toBe(Math.round((100 / 250) * 100));
        expect(rowsOf(report.filled, k('task', 'c')).map((r) => r.rule).sort()).toEqual(['L1@1', 'T1@1']);
        expect(report.flattened).toContainEqual({ entry: k('task', 'c'), part: 'limit', rule: 'AN-flat@1', from: 'grows_with' });
    });

    it('AN-flat drops a `modifies`, listed', () => {
        expect(report.flattened).toContainEqual(expect.objectContaining({ entry: k('stat', 'str'), part: 'modifies.time' }));
    });

    it('W1: an entry no word presents is shown by its id and listed, never written', () => {
        expect(g.nodes.a.name).toBe('Do A');
        expect(g.nodes.b.name).toBe(k('task', 'b'));
        expect(report.unnamed).toContainEqual({ entry: k('task', 'b'), rule: 'W1@1' });
        expect(report.unnamed.some((r) => r.entry === k('task', 'a'))).toBe(false);
    });

    it('every rule a row names is one the substrate applies', () => {
        const used = [...report.filled, ...report.flattened, ...report.unused, ...report.unnamed].map((r) => r.rule.split('@')[0]);
        for (const id of used) expect(actionNodesEntry.fillRules).toContain(id);
    });
});

describe('the words and the numbers stacks', () => {
    it('a theme later in the words stack renames the task; the pack\'s own words sit underneath', () => {
        const theme = loaded('theme', { concepts: THEME });
        expect(resolveMem({ words: [memPack, theme] }).document.nodes.a.name).toBe('Themed A');
    });

    it('a later numbers pack wins per value path; the others fall through', () => {
        const later = loaded('later', {
            numbers: { schema_version: 1, sets: { action_nodes: { exists: P, values: { [k('task', 'a')]: { limit: 2 } } } } },
        });
        const { document: g, report } = resolveMem({ numbersStack: [memPack, later] });
        expect(g.nodes.a.limit).toBe(2);
        expect(g.nodes.a.time).toBe(25);
        expect(rowsOf(report.filled, k('task', 'a')).some((r) => r.part === 'limit')).toBe(false);
    });
});

describe('refusals by name', () => {
    it('assign: no substrate declares a walk; the refusal names the substrate and the first walk\'s candidate', async () => {
        await expect(resolveContent('action_nodes', { exists: [PACK], numbersMode: 'assign' }, nodePackIo()))
            .rejects.toThrow(new RegExp(`substrate "action_nodes" declares no numbersWalk.*the first walk would be ${FIRST_WALK_CANDIDATE}'s`));
        await expect(resolveContent('action_nodes', { exists: [PACK], numbersMode: 'fixed' }, nodePackIo())).rejects.toThrow(/is not one of assign, table/);
    });

    it('a numbers pack with no set for this substrate over the world\'s exists', async () => {
        await expect(resolveContent('action_nodes', { exists: [PACK], numbers: ['maze'] }, nodePackIo()))
            .rejects.toThrow(/numbers names the pack "maze", which has no numbers layer/);
    });

    it('a rule the substrate does not apply', () => {
        const entries = { action_nodes: { id: 'action_nodes', fillRules: ['P1', 'W1', 'AN2', 'AN1', 'AN-flat', 'B1', 'T1', 'L2'] } };
        const registry = { get: (id) => entries[id] ?? null, getAll: () => Object.values(entries) };
        expect(() => resolveMem({ registry })).toThrow(/rule L1 is needed, and the substrate does not apply it/);
    });

    it('a missing number no rule fills', () => {
        const numbers = structuredClone(NUMBERS);
        delete numbers.sets.action_nodes.values[k('boon', 'charm')].count;
        const pack = loaded(P, { structure: STRUCTURE, numbers, concepts: CONCEPTS });
        expect(() => resolveLoaded('action_nodes', { exists: [P] }, { existsLoaded: [pack], wordsLoaded: [pack], numbersStack: [pack] }))
            .toThrow(/boon "p:boon\/charm" has no count in any numbers set/);
    });

    it('a substrate with an assembler and no structure', async () => {
        await expect(resolveContent('action_nodes', {}, nodePackIo())).rejects.toThrow(/resolves a document from structure, and the exists packs \[\] hold none/);
    });
});
