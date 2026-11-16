/**
 * contentPacks/testing/fixtureProvenance — **A TEST'S OWN PACKS NAME THEIR SOURCE** (⛓ CONTENT SETS PL-1).
 *
 * The loader refuses a layer manifest with no `provenance` block (Z.7, `provenance.js`). A test that builds its
 * packs in memory wraps its `readJson` in `withFixtureProvenance`: every LAYER manifest it reads that carries no
 * block gets `FIXTURE_PROVENANCE` (one `authored` source, the default), so the test keeps saying what it said and
 * the fixture is declared for what it is. A manifest that carries a block (a committed pack, a test of the check
 * itself) is returned untouched, and `pack.json` / `packs.json` are never touched.
 */

/** The block a fixture layer gets: one authored source, the default for every entry. */
export const FIXTURE_PROVENANCE = Object.freeze({
    sources: Object.freeze({ fixture: Object.freeze({ type: 'authored', by: 'a test fixture' }) }),
    default: 'fixture',
});

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** `readJson` with `FIXTURE_PROVENANCE` laid onto every layer manifest that has none. */
export function withFixtureProvenance(readJson) {
    return async (url) => {
        const json = await readJson(url);
        if (/(^|\/)packs?\.json$/.test(String(url)) || !isObject(json) || 'provenance' in json) return json;
        return { ...json, provenance: structuredClone(FIXTURE_PROVENANCE) };
    };
}
