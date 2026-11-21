/**
 * procgenCore/levelSetReference — the `region_atlas[p].level_set` field's one spelling, and THE HOST WRITER:
 * the real `PresetUI.prototype.loadDocumentFile` puts a bundle's `level-set` member into `levelSetCache` BEFORE
 * the rules are displayed (S3).
 *
 * Mutants this file reds (each driven by hand, quoted in the as-built):
 *  · `levelSetContentHash` over `rooms` only → the start-changed row;
 *  · the writer's `putLevelSets` call removed → the writer row;
 *  · the put moved AFTER `displayLoadedJsonFileDetails` → the writer row (cached-at-display);
 *  · the schema's `level_set` `additionalProperties: false` dropped → the closed-shape row.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { loadJSZipNode } from '../../../scripts/procgen/loadJSZipNode.mjs';
import { writeBundle } from '../presets/documentBundle.js';
import { PresetUI } from '../presets/presetUI.js';
import { atlasCache } from './atlasCache.js';
import { computeContentHash } from './contentIdentity.js';
import { rulesJsonSchemaErrors } from './jsonSchemaCheck.js';
import { loadRulesSchema } from './jsonSchemaFiles.js';
import { createLevelSetCache, levelSetCache } from './levelSetCache.js';
import {
    levelSetContentHash, levelSetRefOf, levelSetReferenceOf, putLevelSets,
} from './levelSetReference.js';

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'));
/** A real STAMPED level set (the committed vanilla extraction). */
const VANILLA = read('../seedlingDemo/fixtures/seedling-vanilla-set.json');
const PLAYTHROUGH = read('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
const RULES_SCHEMA = loadRulesSchema();

afterEach(() => { levelSetCache.clear(); atlasCache.clear(); });

describe('levelSetReference — the field\'s one spelling', () => {
    it('content_hash is the whole document minus set_id and provenance, which a stamped set already carries', () => {
        expect(levelSetContentHash(VANILLA)).toBe(computeContentHash(VANILLA, { idKey: 'set_id' }));
        expect(levelSetContentHash(VANILLA)).toBe(VANILLA.provenance.content_hash);
        expect(levelSetReferenceOf(VANILLA)).toEqual({ set_id: VANILLA.set_id, content_hash: VANILLA.provenance.content_hash });
    });
    it('it covers MORE than the rooms: a changed `start` alone moves it (a player is delivered the start too)', () => {
        const moved = { ...structuredClone(VANILLA), start: { ...VANILLA.start, level: VANILLA.start.level + 1 } };
        expect(levelSetContentHash(moved)).not.toBe(levelSetContentHash(VANILLA));
    });
    it('…and NOT its own id or provenance (a re-stamp under another id is the same content)', () => {
        const renamed = { ...structuredClone(VANILLA), set_id: 'other-id', provenance: { note: 'x' } };
        expect(levelSetContentHash(renamed)).toBe(levelSetContentHash(VANILLA));
    });
    it('refuses by name: an unstamped set, a non-set', () => {
        expect(() => levelSetReferenceOf({ rooms: [] })).toThrow(/carries no `set_id`/);
        expect(() => levelSetContentHash({ set_id: 'x' })).toThrow(/`rooms` array/);
    });
    it('levelSetRefOf reads THAT player\'s reference, never another\'s; null when absent', () => {
        const ref = levelSetReferenceOf(VANILLA);
        const rules = { region_atlas: { 1: { atlas_id: 'a', game: 'g', level_set: ref }, 2: { atlas_id: 'b', game: 'g' } } };
        expect(levelSetRefOf(rules, '1')).toEqual(ref);
        expect(levelSetRefOf(rules, 1)).toEqual(ref);
        expect(levelSetRefOf(rules, '2')).toBe(null);
        expect(levelSetRefOf(rules, '3')).toBe(null);
        expect(levelSetRefOf(rules, null)).toBe(null);
        expect(levelSetRefOf(PLAYTHROUGH, '1')).toBe(null);
    });
    it('putLevelSets holds each set under its own id with its computed hash; a non-set is skipped', () => {
        const c = createLevelSetCache();
        expect(putLevelSets([VANILLA, { overlay_id: 'x' }, null], c)).toEqual([levelSetReferenceOf(VANILLA)]);
        expect(c.get(VANILLA.set_id, VANILLA.provenance.content_hash).status).toBe('held');
        expect(c.get(VANILLA.set_id, 'ffffffff').status).toBe('mismatch');
    });
    it('a body edited after its stamp is held under its REAL hash, so the stamped reference reports a mismatch', () => {
        const c = createLevelSetCache();
        const edited = structuredClone(VANILLA);
        edited.rooms[0].name = `${edited.rooms[0].name} (edited)`;
        putLevelSets([edited], c);
        expect(c.get(VANILLA.set_id, VANILLA.provenance.content_hash).status).toBe('mismatch');
    });
    it('names no game or substrate (grep pin)', () => {
        const src = readFileSync(fileURLToPath(new URL('./levelSetReference.js', import.meta.url)), 'utf8');
        expect(src).not.toMatch(/seedling|maze|bounce|cloudberry|alttp|flash|noiz2sa|omsi|cavernous|tmt|adventure/i);
    });
});

describe('rules.schema.json — `region_atlas[p].level_set` is optional and closed', () => {
    const withRef = (ref) => {
        const r = structuredClone(PLAYTHROUGH);
        r.region_atlas['1'] = { ...r.region_atlas['1'], level_set: ref };
        return r;
    };
    it('a committed preset without it validates; with a well-formed one it still validates', () => {
        expect(rulesJsonSchemaErrors(PLAYTHROUGH, RULES_SCHEMA)).toEqual([]);
        expect(rulesJsonSchemaErrors(withRef(levelSetReferenceOf(VANILLA)), RULES_SCHEMA)).toEqual([]);
    });
    it('an extra key, a missing hash, or a hash that is not 8 hex is refused', () => {
        const ref = levelSetReferenceOf(VANILLA);
        expect(rulesJsonSchemaErrors(withRef({ ...ref, extra: 1 }), RULES_SCHEMA).length).toBeGreaterThan(0);
        expect(rulesJsonSchemaErrors(withRef({ set_id: ref.set_id }), RULES_SCHEMA).length).toBeGreaterThan(0);
        expect(rulesJsonSchemaErrors(withRef({ ...ref, content_hash: 'XYZ' }), RULES_SCHEMA).length).toBeGreaterThan(0);
    });
});

describe('THE HOST WRITER — `loadDocumentFile` holds the bundle\'s level set BEFORE the rules publish', () => {
    const JSZip = loadJSZipNode();
    async function loadBundle(members) {
        const bytes = await writeBundle(members, { jszip: JSZip });
        const seen = { rules: null, heldAtDisplay: null, notes: [] };
        const host = {
            loadJSZip: async () => JSZip,
            eventBus: { publish: (_ev, p) => seen.notes.push(p?.message ?? '') },
            displayLoadedJsonFileDetails: (doc) => { seen.rules = doc; seen.heldAtDisplay = levelSetCache.ids(); },
        };
        await PresetUI.prototype.loadDocumentFile.call(host, { name: 'set.zip', arrayBuffer: async () => bytes });
        return seen;
    }

    it('a bundle with a level-set member → held under the id the rules name, with the hash they name, at display time', async () => {
        const ref = levelSetReferenceOf(VANILLA);
        const rules = structuredClone(PLAYTHROUGH);
        rules.region_atlas['1'] = { ...rules.region_atlas['1'], level_set: ref };
        const seen = await loadBundle([{ kind: 'rules', doc: rules }, { kind: 'level-set', doc: VANILLA }]);
        expect(seen.heldAtDisplay).toEqual([VANILLA.set_id]);
        const named = levelSetRefOf(seen.rules, '1');
        expect(named).toEqual(ref);
        const got = levelSetCache.get(named.set_id, named.content_hash);
        expect(got.status).toBe('held');
        expect(got.set).toEqual(VANILLA);
        expect(seen.notes.join(' ')).toMatch(new RegExp(`CACHED — .*level-set \\(\`level-set\\.json\`\\) as ${VANILLA.set_id}`));
        expect(seen.notes.join(' ')).not.toMatch(/NOT loaded — .*level-set/);
    });
    it('a bundle with no level-set member holds nothing (and a plain .json never reaches the cache)', async () => {
        await loadBundle([{ kind: 'rules', doc: PLAYTHROUGH }]);
        expect(levelSetCache.size).toBe(0);
    });
});
