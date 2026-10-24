// frontend/modules/procgenCore/contentIdentity.test.js
//
// EDITOR v3 slice D0a. The identity family had FIVE byte-equivalent copies
// (regionAtlasValidator, regionLibraryValidator, regionAtlasPool,
// levelSetValidator, datasetValidator) plus two ad hoc `canon` clones in
// scripts/procgen. This file is what makes the lift safe to have done:
//
// ⛓⛓ THE CLAIM — every stamped document COMMITTED TO THIS REPOSITORY
// recomputes, through the ONE shared module, to exactly the id and
// content_hash it carries on disk. Those ids were minted by the five copies
// before the lift; if the lift had moved the algorithm by one key sort, one
// prime, or one deleted field, this row names which ids moved.
//
// ⛔ THE ROSTER IS DERIVED, NOT TYPED. It globs the five directories the five
// validators own and keeps the files that actually carry that directory's id
// key — so a new committed atlas/library/pool/set/dataset joins the claim by
// existing, and a file that is not a stamped document stays out on its own
// evidence rather than by someone remembering to exclude it. Two files prove
// the derivation is doing work: `region-libraries/region_library_files.json`
// is a MANIFEST (no `library_id`) and `flashPanel/atlases/seedling-map.json`
// and `seedling-sphere-order.json` are unstamped projections (no `atlas_id`).
//
// ⚠ AND THE ROSTER IS KEYED BY (DIRECTORY, ID KEY), NOT BY ID KEY ALONE:
// `atlas-pools/seedling-atlas-pool.json` carries BOTH `pool_id` (its own) and
// `atlas_id` (a REFERENCE to the source atlas it was built from). A key-name
// scan alone would validate the pool as an atlas and compute a hash for a
// document that never had one — a key name says what a field is CALLED, not
// what the document IS.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    computeContentHash,
    fnv1a32,
    stableStringify,
    stampIdentity,
} from './contentIdentity.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = join(HERE, '..');
const FRONTEND = join(MODULES, '..');

/**
 * The five document families, each = (directory, its id key, the base
 * `stampIdentity` falls back to when a document has no id at all). Every row
 * is one of the five validators D0a re-pointed; nothing else in the repo
 * stamps an id.
 */
const FAMILIES = [
    { name: 'region atlas', dir: join(MODULES, 'flashPanel/atlases'), idKey: 'atlas_id', defaultBase: 'atlas' },
    { name: 'region library', dir: join(FRONTEND, 'region-libraries'), idKey: 'library_id', defaultBase: 'library' },
    { name: 'atlas pool', dir: join(FRONTEND, 'atlas-pools'), idKey: 'pool_id', defaultBase: 'atlas-pool' },
    { name: 'level set', dir: join(MODULES, 'seedlingDemo/fixtures'), idKey: 'set_id', defaultBase: 'level-set' },
    { name: 'jta dataset', dir: join(MODULES, 'jtaSubstrateWrapper/datasets'), idKey: 'dataset_id', defaultBase: 'dataset' },
];

const STAMPED = FAMILIES.flatMap((family) => readdirSync(family.dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ family, file: f, path: join(family.dir, f) }))
    .filter(({ path }) => {
        const doc = JSON.parse(readFileSync(path, 'utf8'));
        return Object.prototype.hasOwnProperty.call(doc, family.idKey);
    }));

describe('⛓ contentIdentity — every COMMITTED stamped document recomputes', () => {
    it('the derived roster is the ten stamped documents, and says which they are', () => {
        // ⚠ The count is asserted so that a document DISAPPEARING is as loud as
        // one arriving; the names are the readable half.
        expect(STAMPED.map((s) => `${s.family.idKey}:${s.file}`)).toEqual([
            'atlas_id:seedling-fixture.json',
            'atlas_id:seedling-playthrough.json',
            'atlas_id:seedling.json',
            'library_id:demo-bounce-pack.json',
            'library_id:demo-maze-pack.json',
            'library_id:demo-runner-pack.json',
            'pool_id:seedling-atlas-pool.json',
            'set_id:seedling-vanilla-set.json',
            'dataset_id:vanilla-raw.json',
            'dataset_id:vanilla.json',
        ]);
    });

    it.each(STAMPED.map((s) => [`${s.family.name} · ${s.file}`, s]))(
        '%s — content_hash and the id suffix both recompute',
        (_label, { path, family }) => {
            const doc = JSON.parse(readFileSync(path, 'utf8'));
            const onDisk = { id: doc[family.idKey], hash: doc.provenance?.content_hash };
            const recomputed = computeContentHash(doc, { idKey: family.idKey });

            expect(recomputed,
                `${family.idKey} content_hash moved: on disk ${onDisk.hash}, recomputed ${recomputed}`)
                .toBe(onDisk.hash);
            expect(onDisk.id,
                `${onDisk.id} does not end with its own content hash ${recomputed}`)
                .toMatch(new RegExp(`-${recomputed}$`));
        },
    );

    it.each(STAMPED.map((s) => [`${s.family.name} · ${s.file}`, s]))(
        '%s — RE-STAMPING through the shared module is a no-op (idempotent)',
        (_label, { path, family }) => {
            const doc = JSON.parse(readFileSync(path, 'utf8'));
            const before = JSON.parse(JSON.stringify(doc));
            stampIdentity(doc, { idKey: family.idKey, defaultBase: family.defaultBase });
            // ⛓ This is the property `--restamp` rests on: the base is the id
            // with its OWN prior hash suffix stripped, so a stamped document
            // that has not changed comes back byte-identical.
            expect(doc).toEqual(before);
        },
    );
});

describe('contentIdentity — the algorithm IS the contract', () => {
    it('sorts object keys and preserves array order', () => {
        expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
        expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
        // Key ORDER is not content; key PRESENCE is.
        expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
        expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 1, b: undefined }));
    });

    it('encodes the hostile leaves the way JSON.stringify does — bare `undefined` included', () => {
        expect(stableStringify(undefined)).toBe(undefined);   // JSON.stringify's own answer
        expect(stableStringify({ u: undefined })).toBe('{"u":undefined}');
        expect(stableStringify(NaN)).toBe('null');
        expect(stableStringify(-0)).toBe('0');
        // ⚠ A SPARSE array is the ONE place the family DIVERGES from
        // JSON.stringify, which fills holes with `null`: `.map()` preserves
        // holes and `.join(',')` renders them as empty, so the encoding is
        // `[1,,3]` — not valid JSON. Deterministic, and hash input is never a
        // document, so it is harmless; it is written down because "a leaf is
        // JSON.stringify" would otherwise read as "the whole thing is".
        expect(stableStringify([1, , 3])).toBe('[1,,3]');  // eslint-disable-line no-sparse-arrays
        expect(JSON.stringify([1, , 3])).toBe('[1,null,3]');  // eslint-disable-line no-sparse-arrays
        expect(stableStringify('é')).toBe('"é"');
    });

    it('fnv1a32 is FNV-1a/32 over UTF-16 code units, 8 lowercase hex', () => {
        // Derived, not quoted: the reference fold, spelled out independently.
        const reference = (s) => {
            let h = 0x811c9dc5;
            for (const unit of [...Array(s.length).keys()].map((i) => s.charCodeAt(i))) {
                h = Math.imul(h ^ unit, 0x01000193);
            }
            return (h >>> 0).toString(16).padStart(8, '0');
        };
        for (const s of ['', 'a', 'hello world', '{"a":1}', '𝄞é']) {
            expect(fnv1a32(s)).toBe(reference(s));
            expect(fnv1a32(s)).toMatch(/^[0-9a-f]{8}$/);
        }
    });

    it('the hash excludes `provenance` and the document\'s OWN id key, and nothing else', () => {
        const base = { schema_version: 1, body: [1, 2] };
        const h = computeContentHash(base, { idKey: 'atlas_id' });
        expect(computeContentHash({ ...base, atlas_id: 'anything' }, { idKey: 'atlas_id' })).toBe(h);
        expect(computeContentHash({ ...base, provenance: { any: 'thing' } }, { idKey: 'atlas_id' })).toBe(h);
        // A DIFFERENT family's id key is ordinary content — which is exactly why
        // the pool (it carries a reference `atlas_id`) must be hashed as a pool.
        expect(computeContentHash({ ...base, atlas_id: 'x' }, { idKey: 'pool_id' })).not.toBe(h);
    });
});

describe('contentIdentity — stampIdentity', () => {
    it('appends the hash, and re-stamping strips the PRIOR suffix rather than stacking', () => {
        const doc = { schema_version: 1, atlas_id: 'demo', body: 1 };
        stampIdentity(doc, { idKey: 'atlas_id', defaultBase: 'atlas' });
        const first = doc.atlas_id;
        expect(first).toMatch(/^demo-[0-9a-f]{8}$/);
        doc.body = 2;
        stampIdentity(doc, { idKey: 'atlas_id', defaultBase: 'atlas' });
        expect(doc.atlas_id).toMatch(/^demo-[0-9a-f]{8}$/);
        expect(doc.atlas_id).not.toBe(first);
    });

    it('falls back to defaultBase only when the document has no id at all', () => {
        const doc = { body: 1 };
        stampIdentity(doc, { idKey: 'set_id', defaultBase: 'level-set' });
        expect(doc.set_id).toMatch(/^level-set-[0-9a-f]{8}$/);
    });

    it('an explicit baseId REPLACES the id and does not strip anything', () => {
        const doc = { atlas_id: 'old-deadbeef', provenance: { content_hash: 'deadbeef' }, body: 1 };
        stampIdentity(doc, { idKey: 'atlas_id', defaultBase: 'atlas', baseId: 'brand-new' });
        expect(doc.atlas_id).toMatch(/^brand-new-[0-9a-f]{8}$/);
    });

    it('⚠ replaces a NON-PLAIN provenance rather than hanging the hash on it', () => {
        // This is levelSetValidator's guard, promoted to the family's. The other
        // four copies used `typeof !== "object"`, under which an ARRAY provenance
        // survives and gains a stringy `content_hash` property; the pool's copy
        // SPREAD it, which would have exploded a string into index keys.
        for (const bad of [[], ['a'], 'a string', 42, null]) {
            const doc = { atlas_id: 'demo', provenance: bad, body: 1 };
            stampIdentity(doc, { idKey: 'atlas_id', defaultBase: 'atlas' });
            expect(Array.isArray(doc.provenance)).toBe(false);
            expect(doc.provenance).toEqual({ content_hash: doc.atlas_id.slice(-8) });
        }
    });

    it('KEEPS the other keys of a plain provenance (it mutates, never replaces)', () => {
        const doc = { atlas_id: 'demo', provenance: { source: 'hand', note: 'keep me' }, body: 1 };
        const prov = doc.provenance;
        stampIdentity(doc, { idKey: 'atlas_id', defaultBase: 'atlas' });
        expect(doc.provenance).toBe(prov);           // in place — the pool used to replace it
        expect(doc.provenance.source).toBe('hand');
        expect(doc.provenance.note).toBe('keep me');
    });
});
