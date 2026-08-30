// frontend/modules/procgenCore/contentIdentity.js
//
// THE content-identity family: one stable stringify, one 32-bit hash, one
// compute, one stamp — for every document in this repo whose id EMBEDS the
// hash of its own content.
//
// ⛓⛓ THE ALGORITHM BELOW IS A CONTRACT, NOT AN IMPLEMENTATION DETAIL.
// Ten documents committed to this repository carry ids that were minted with
// it. Change the key sort, the FNV basis or prime, the leaf encoding, or what
// `computeContentHash` deletes, and every one of those ids moves — which means
// every save file keyed on a `set_id`, every preset that names an `atlas_id`,
// and every `--check` byte-identity gate in `scripts/procgen/` goes red at
// once. `contentIdentity.test.js` loads all ten off disk and recomputes them;
// that row is the pin.
//
// THE ALGORITHM
//
//   stableStringify — a recursive, sorted-key JSON encoding:
//     · a leaf (null, or any non-object) is `JSON.stringify(value)`. NOTE the
//       consequences that follow from JSON.stringify and are therefore part of
//       the contract: `undefined` encodes as the BARE token `undefined` (not
//       valid JSON — this string is hash input, never a document), `NaN` and
//       `Infinity` encode as `null`, `-0` encodes as `0`.
//     · an array is `[e0,e1,…]` in SOURCE ORDER (order is content). ⚠ A HOLE
//       in a sparse array renders EMPTY (`[1,,3]`), where JSON.stringify would
//       write `null` — `.map()` preserves holes and `.join()` renders them as
//       nothing. Deterministic, and this string is hash input rather than a
//       document, so it is harmless; it is stated because it is the one place
//       the encoding is not JSON.stringify-equivalent.
//     · an object is `{"k":v,…}` with keys sorted by `Array.prototype.sort`'s
//       default UTF-16 code-unit order. Key ORDER in the document is therefore
//       NOT content; key PRESENCE is.
//
//   fnv1a32 — FNV-1a, 32-bit, basis 0x811c9dc5, prime 0x01000193, folded over
//     the string's UTF-16 CODE UNITS (`charCodeAt`, so an astral character
//     contributes its two surrogates), returned as 8 lowercase hex digits.
//
//   computeContentHash(doc, {idKey}) — hashes the document MINUS `provenance`
//     and MINUS `idKey` itself. Both exclusions are load-bearing: the id embeds
//     the hash, so it cannot be part of the hashed content, and `provenance`
//     carries the hash it is about to be overwritten with.
//
//   stampIdentity(doc, {idKey, defaultBase, baseId}) — writes
//     `doc[idKey] = '<base>-<hash>'` and `doc.provenance.content_hash = hash`,
//     IN PLACE, and returns the document. `base` is `baseId` when given; else
//     the current `doc[idKey]` with a previously stamped `-<content_hash>`
//     suffix stripped (which is what makes re-stamping IDEMPOTENT); else
//     `defaultBase`. A `provenance` that is not a PLAIN object (absent, null, a
//     string, an ARRAY) is replaced with `{}` before the hash is hung on it.
//
// ⚠ THE ARRAY-PROVENANCE RULE IS THE LEVEL-SET VALIDATOR'S, DELIBERATELY.
// Of the five copies this module replaced, three guarded with `typeof !==
// 'object'` (an array passes that, so the hash was hung on the array as a
// stringy index property), one spread `{...provenance}` (which would explode a
// string provenance into index keys), and `levelSetValidator` used a plain-object
// test. The plain-object test is the only one that cannot produce a nonsense
// document, so it is the family's. No committed document has a non-object
// provenance, so adopting it moved no id — measured by the ten-document row.
//
// ⛔ WHAT IS *NOT* IN THIS FAMILY (do not "unify" these — each is deliberately
// a different thing, and three of them have COMMITTED values that would move):
//   · `shared/rulesHash.js` — plain `JSON.stringify`, NOT stable; it keys a
//     localStorage entry and nothing else. Also a submodule.
//   · `jtaSubstrateWrapper/generateDataset.js` `paramsHash` — non-stable, and
//     its value `759b9cfc` is COMMITTED in two presets.
//   · `omsi-loops/planner.js` — a 64-bit hash, a different algorithm entirely.
//   · `procgenCore/urlParams.js` and `procgenPipeline/procgenPipelineEngine.js`
//     seed derivations — hashes that mint a SEED, not an identity.

/** @param {unknown} value */
export function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** FNV-1a over UTF-16 code units → 8 lowercase hex digits. */
export function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/**
 * The 8-hex content hash of `doc`, minus `provenance` and minus its own id key.
 *
 * @param {object} doc
 * @param {{idKey: string}} options
 */
export function computeContentHash(doc, { idKey }) {
    const content = { ...doc };
    delete content.provenance;
    delete content[idKey];
    return fnv1a32(stableStringify(content));
}

/**
 * Stamp (or re-stamp) identity IN PLACE; idempotent. Returns `doc`.
 *
 * @param {object} doc
 * @param {{idKey: string, defaultBase: string, baseId?: string|null}} options
 */
export function stampIdentity(doc, { idKey, defaultBase, baseId = null }) {
    const hash = computeContentHash(doc, { idKey });
    let base = baseId ?? doc[idKey] ?? defaultBase;
    if (baseId == null) {
        const prior = doc.provenance?.content_hash;
        if (typeof prior === 'string' && base.endsWith(`-${prior}`)) {
            base = base.slice(0, -(prior.length + 1));
        }
    }
    doc[idKey] = `${base}-${hash}`;
    if (!isPlainObject(doc.provenance)) doc.provenance = {};
    doc.provenance.content_hash = hash;
    return doc;
}
