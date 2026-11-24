/**
 * contentPacks/provenance — the Z.7 block, the loader check (Z6 check 1), the extract-script check (check 2), the
 * report's counts (check 4) and the backfill of the committed packs (⛓ CONTENT SETS PL-1).
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ContentPackError, KNOWN_LAYERS, loadPackStack } from './contentPacks.js';
import { nodePackIo } from './nodePackIo.js';
import {
    SOURCE_FIELDS, SOURCE_TYPES, checkLayerProvenance, layerEntries, parseProvenance, provenanceCounts, resolveSource,
} from './provenance.js';
import { packProvenanceReport } from '../../../scripts/procgen/report-pack-provenance.mjs';
import { ACTION_GRAPH_REFUSALS, PROVENANCE_SOURCE_FIELDS, validateActionGraph } from '../actionNodes/actionGraph.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REGISTRY = JSON.parse(readFileSync(join(REPO, 'frontend/packs/packs.json'), 'utf8'));
const loadAll = () => Promise.all(REGISTRY.packs.map(async ({ id }) => (await loadPackStack([id], nodePackIo()))[0]));

/** One source of each type, with exactly its required fields. */
const MINIMAL = Object.freeze({
    game: { type: 'game', name: 'A Game', repo: 'someone/a-game', commit: 'a636e9a410' },
    gameByPath: { type: 'game', name: 'A Game', path: 'data/icon.png' },
    person: { type: 'person', name: 'An Artist' },
    model: { type: 'model', model: 'claude-opus-5-5', date: '2026-11-15' },
    unrecorded: { type: 'model', model: 'unrecorded', family: 'Claude Opus', date: '2026-11-15' },
    hand: { type: 'authored', by: 'someone' },
    fill: { type: 'derived', from: ['game'], by: 'R1@1' },
    script: { type: 'derived', from: ['a:key/x'], by: 'scripts/procgen/x.mjs' },
});
const block = (over = {}) => ({ sources: structuredClone(MINIMAL), default: 'hand', ...over });
const refuse = (b, pattern) => expect(() => parseProvenance(b, 'p', 'concepts')).toThrow(pattern);

describe('the block (Z.7)', () => {
    it('one source of each of the five types, with only its required fields, parses', () => {
        expect(new Set(Object.values(MINIMAL).map((s) => s.type))).toEqual(new Set(SOURCE_TYPES));
        expect(parseProvenance(block(), 'p', 'concepts').default).toBe('hand');
    });

    it('each type refuses its missing required field, by pack, layer and source', () => {
        const missing = {
            game: ['name', /source "game": a game source needs its name/],
            gameByPath: ['path', /source "gameByPath": a game source needs a repo and a commit, or a path/],
            person: ['name', /source "person": a person source needs the name/],
            model: ['date', /source "model": date undefined is not YYYY-MM-DD/],
            unrecorded: ['family', /source "unrecorded": an "unrecorded" model needs its family/],
            hand: ['by', /source "hand": an authored source needs its by/],
            fill: ['by', /source "fill": by undefined is neither a rule id/],
        };
        for (const [id, [field, pattern]] of Object.entries(missing)) {
            const b = block();
            delete b.sources[id][field];
            refuse(b, new RegExp(`^content pack "p" layer "concepts" provenance: ${pattern.source}`));
        }
    });

    it('refuses: no block, no sources, an unlisted default / group / from, an unknown type or field, a bad approved', () => {
        refuse(undefined, /has no provenance block/);
        refuse({ sources: {}, default: 'x' }, /sources is missing or empty/);
        refuse(block({ default: 'nobody' }), /default "nobody" is not a listed source/);
        refuse(block({ groups: { 'p:task/': 'nobody' } }), /group "p:task\/" names "nobody", which is not a listed source/);
        const b = block();
        b.sources.fill.from = ['ghost'];
        refuse(b, /source "fill": from names "ghost", which is not a listed source/);
        refuse(block({ sources: { x: { type: 'rumour' } }, default: 'x' }), /source "x": type "rumour" is not one of game, person, model, authored, derived/);
        refuse(block({ sources: { x: { type: 'person', name: 'A', email: 'a@b' } }, default: 'x' }), /source "x": field "email" is not one a person source takes/);
        refuse(block({ sources: { x: { type: 'person', name: 'A', approved: { by: 'B' } } }, default: 'x' }), /approved.date undefined is not YYYY-MM-DD/);
        refuse(block({ sources: { x: { type: 'model', model: 'claude-opus-5-5', family: 'Opus', date: '2026-11-15' } }, default: 'x' }), /family is only for an "unrecorded" model/);
        refuse(block({ extra: 1 }), /unknown field "extra"/);
    });

    it('an entry resolves: its own src, else the LONGEST group prefix, else the default', () => {
        const b = parseProvenance(block({ groups: { 'p:task/': 'fill', 'p:task/use-': 'game' } }), 'p', 'structure');
        expect(resolveSource(b, 'p:task/use-food')).toBe('game');
        expect(resolveSource(b, 'p:task/wander')).toBe('fill');
        expect(resolveSource(b, 'p:stat/dex')).toBe('hand');
        expect(resolveSource(b, 'p:task/use-food', 'person')).toBe('person');
    });

    it('every type\'s field list starts from its required fields (no type lists a field twice)', () => {
        for (const fields of Object.values(SOURCE_FIELDS)) expect(new Set(fields).size).toBe(fields.length);
    });
});

describe('ONE validator (PL-2): the ActionNodes graph block and the pack layers are checked by the same code', () => {
    const GRAPH = JSON.parse(readFileSync(join(REPO, 'frontend/modules/actionNodes/graphs/example-village.json'), 'utf8'));

    it('the two drifted fields are OPTIONAL: `session` on a model source, `ruling` inside `approved`', () => {
        expect(SOURCE_FIELDS.model).toContain('session');
        const b = block();
        b.sources.model.session = 'some-session';
        b.sources.model.approved = { by: 'someone', date: '2026-11-15', ruling: 'A14' };
        expect(parseProvenance(b, 'p', 'concepts').sources.model.session).toBe('some-session');
        // Still optional: the minimal model source (neither field) parses above.
        const empty = block();
        empty.sources.model.session = '';
        refuse(empty, /source "model": session must be a non-empty string/);
        const noRuling = block();
        noRuling.sources.model.approved = { by: 'someone', date: '2026-11-15', ruling: '' };
        refuse(noRuling, /approved.ruling must be a non-empty string/);
        const other = block();
        other.sources.person.session = 'x';
        refuse(other, /source "person": field "session" is not one a person source takes/);
    });

    it('the AN-1 example graph\'s block parses unchanged under the pack layer\'s validator', () => {
        const parsed = parseProvenance(GRAPH.provenance, 'example-village', 'structure');
        expect(Object.keys(parsed.sources)).toEqual(Object.keys(GRAPH.provenance.sources));
    });

    it('actionGraph.js keeps no copy: its table IS this one, and a source this module refuses the graph refuses too', () => {
        expect(PROVENANCE_SOURCE_FIELDS).toBe(SOURCE_FIELDS);
        expect(validateActionGraph(GRAPH).ok).toBe(true);
        const g = structuredClone(GRAPH);
        g.provenance.sources['actionnodes-design'].email = 'x@y';     // refused by name here, accepted by the old copy
        const { ok, errors } = validateActionGraph(g);
        expect(ok).toBe(false);
        expect(errors[0].code).toBe(ACTION_GRAPH_REFUSALS.BAD_PROVENANCE);
        expect(errors[0].message).toMatch(/field "email" is not one a model source takes/);
    });
});

describe('the loader check (Z6 check 1): refused by pack, layer and key', () => {
    const files = (layer) => ({
        'p/pack.json': { schema_version: 1, id: 'p', title: 'p', licence: 'CC0', layers: { concepts: 'c.json' } },
        'p/c.json': { schema_version: 1, provenance: block(), concepts: { 'p:place/a': { kind: 'place', name: 'A', ...layer } } },
    });
    const io = (f) => ({ base: 'mem:/packs/', readJson: async (u) => structuredClone(f[u.slice('mem:/packs/'.length)]) });
    it('an entry naming an unlisted source', async () => {
        await expect(loadPackStack(['p'], io(files({ src: 'nobody' })))).rejects.toThrow(
            /^content pack "p" layer "concepts" provenance key "p:place\/a": src "nobody" is not a listed source/);
    });
    it('a layer with no block', async () => {
        const f = files({});
        delete f['p/c.json'].provenance;
        await expect(loadPackStack(['p'], io(f))).rejects.toThrow(ContentPackError);
    });
    it('a listed src loads, and the entry resolves to it', async () => {
        const [p] = await loadPackStack(['p'], io(files({ src: 'person' })));
        expect(checkLayerProvenance('p', 'concepts', p.layers.concepts).sourceOf.get('p:place/a')).toBe('person');
    });
    it('every known layer has an entry table, and a text layer\'s entries are its strings and lists', () => {
        for (const layer of KNOWN_LAYERS) expect(Array.isArray(layerEntries(layer, {}))).toBe(true);
        expect(layerEntries('text', { strings: { 'p:a': 'x' }, lists: { 'p:b': ['y'] } }).map((e) => e.key)).toEqual(['p:a', 'p:b']);
        expect(layerEntries('bindings', { bindings: { jta: { 'p:task/a': { src: 'x' } } } })).toEqual([{ key: 'jta/p:task/a', src: 'x' }]);
    });
});

describe('the committed packs, backfilled (Z.7)', () => {
    it('every pack the registry lists loads whole: every layer has a block and every entry resolves', async () => {
        const all = await loadAll();
        expect(all.map((p) => p.id)).toEqual(REGISTRY.packs.map((p) => p.id));
        for (const p of all) {
            for (const [layer, json] of Object.entries(p.layers)) {
                const { sourceOf } = checkLayerProvenance(p.id, layer, json);
                expect(sourceOf.size).toBe(layerEntries(layer, json).length);
            }
        }
    });

    it('the report counts every entry of every layer once (check 4)', async () => {
        const report = await packProvenanceReport();
        for (const p of await loadAll()) {
            for (const [layer, json] of Object.entries(p.layers)) {
                const counted = Object.values(report[p.id][layer]).reduce((n, s) => n + s.count, 0);
                expect(counted).toBe(layerEntries(layer, json).length);
            }
            expect(Object.fromEntries(Object.entries(report[p.id]).map(([l, s]) => [l, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.count]))])))
                .toEqual(provenanceCounts(p));
        }
    });

    it('a model source names a model id from the files\' commit trailers, or "unrecorded" with a family; never a guess', async () => {
        for (const p of await loadAll()) {
            for (const [layer, json] of Object.entries(p.layers)) {
                for (const [id, s] of Object.entries(json.provenance.sources)) {
                    if (s.type !== 'model') continue;
                    expect(s.model === 'unrecorded' || /^claude-[a-z]+-\d+-\d+$/.test(s.model), `${p.id}/${layer}/${id}`).toBe(true);
                }
            }
        }
    });

    it('⚖ `approved` only where the plan log records the user\'s approval: S1\'s words, S2\'s words and shapes (R3/R4 open)', async () => {
        const approvedNotes = [];
        for (const p of await loadAll()) {
            for (const [layer, json] of Object.entries(p.layers)) {
                for (const [id, s] of Object.entries(json.provenance.sources)) {
                    if (s.approved) approvedNotes.push([`${p.id}/${layer}/${id}`, s.note, s.approved.ruling]);
                }
            }
        }
        expect(approvedNotes.length).toBeGreaterThan(0);
        // ⛓ PL-2: the ActionNodes example (the pack `example-village`) carries its design's approval, ruling A14, as
        // its graph did; `approved.ruling` names where it is recorded.
        for (const [where, note, ruling] of approvedNotes) {
            if (where.startsWith('example-village/')) expect(ruling, where).toMatch(/^A14: /);
            else expect(note, where).toMatch(/^content sets S[12] /);
        }
    });

    it('⛔ no committed world document carries a PACK\'s provenance (Z.7): no pack source\'s note', async () => {
        // A world looks its sources up through its packs. Only the packs' own records are needles: a model id is
        // shared with sources that are not packs. ⛓ AN-1b: the ActionNodes example world records its pack ids
        // (`provenance[p].exists`), no longer its graph's block, so no world is set aside.
        const needles = new Set();
        for (const p of await loadAll()) {
            for (const json of Object.values(p.layers)) {
                for (const s of Object.values(json.provenance.sources)) if (s.note) needles.add(s.note);
            }
        }
        expect(needles.size).toBeGreaterThan(0);
        const rules = execFileSync('git', ['-C', REPO, 'ls-files', '-z', 'frontend/presets/*_rules.json'], { encoding: 'utf8' })
            .split('\0').filter(Boolean);
        expect(rules.length).toBeGreaterThan(0);
        const textOf = (f) => JSON.stringify(JSON.parse(readFileSync(join(REPO, f), 'utf8')));
        const hits = rules.filter((f) => { const text = textOf(f); return [...needles].some((n) => text.includes(JSON.stringify(n).slice(1, -1))); });
        expect(hits).toEqual([]);
    });
});

describe('Z6 check 2: a game source\'s extract script has a --check mode, and its check runs in CI', () => {
    it('every `extracted_by` names a script that parses --check and has its own test beside it, which imports it', async () => {
        const scripts = new Set();
        for (const p of await loadAll()) {
            for (const json of Object.values(p.layers)) {
                for (const s of Object.values(json.provenance.sources)) {
                    if (s.type !== 'game' || !s.extracted_by) continue;
                    for (const e of [].concat(s.extracted_by)) scripts.add(e.replace(/ --check$/, ''));
                }
            }
        }
        expect(scripts.size).toBeGreaterThan(0);
        for (const script of scripts) {
            const path = join(REPO, script);
            expect(existsSync(path), script).toBe(true);
            expect(readFileSync(path, 'utf8'), script).toMatch(/['"]--check['"]/);
            const test = path.replace(/\.(mjs|js)$/, '.test.js');
            // The checked set: a script's `--check` comparison runs in CI through its own vitest file (the
            // extract tests run the same drift function `--check` prints), so the test must exist and import it.
            expect(existsSync(test), `${script}: no ${basename(test)} beside it`).toBe(true);
            expect(readFileSync(test, 'utf8'), basename(test)).toContain(`'./${basename(path)}'`);
        }
    });
});
