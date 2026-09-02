/**
 * The map document's location, and the three bases it is resolved against
 * (maze-lab arms F-b / plan §17.1 F7).
 *
 * ⛔ THE ROWS THAT MATTER ARE THE ONES WITH A READER BEHIND THEM. A derivation
 * asserted only against itself is a fixed point; each row below either resolves
 * the path against a REAL base and opens the file, or scans a caller that has
 * no node moment of its own.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ATLAS_DIR, DEFAULT_MAP_DOCUMENT, mapDocumentPath } from './mapDocumentPath.js';
import { AP_ASSET_PATHS, resolveMapPath } from './seedlingRandomizerWiring.js';
import { ATLAS_PATH } from '../seedlingDemo/levelSource.js';
import { LAB_EVENTS, LAB_PAYLOAD_FIELDS } from '../procgenCore/labProtocol.js';

const REPO = new URL('../../../', import.meta.url);
const source = (rel) => readFileSync(fileURLToPath(new URL(rel, REPO)), 'utf8');

describe('mapDocumentPath — one relative path, three bases', () => {
    it('defaults to the committed extract, and says the answer was the default', () => {
        expect(mapDocumentPath(null)).toEqual({
            path: 'modules/flashPanel/atlases/seedling-map.json',
            name: 'seedling-map.json',
            source: 'the atlases default',
        });
        expect(mapDocumentPath(undefined).source).toBe('the atlases default');
        expect(mapDocumentPath({}).source).toBe('the atlases default');
    });

    it('honours a preset\'s `region_atlas.map_document`, and NAMES it as the source', () => {
        expect(mapDocumentPath({ region_atlas: { map_document: 'other-map.json' } })).toEqual({
            path: `${ATLAS_DIR}other-map.json`,
            name: 'other-map.json',
            source: 'region_atlas.map_document',
        });
    });

    /** ⛓ EMPTY IS NOT A DOCUMENT — the same rule the seq parsers spell. */
    it('an EMPTY or non-string map_document is not a declaration', () => {
        for (const bad of ['', 0, null, false, 42, {}, []]) {
            expect(mapDocumentPath({ region_atlas: { map_document: bad } }).source)
                .toBe('the atlases default');
        }
    });

    /**
     * ⛔⛔ **THE ROW A MISSPELLING REDS, AND IT HAS A READER.** The derived path
     * is relative to `frontend/`; resolve it there and the file must be on
     * disk. A typo in `ATLAS_DIR` reds here, in `levelSource`'s row below, and
     * live in every browser gate that fetches the atlas.
     */
    it('⛔ the derived path RESOLVES to the committed document, from `frontend/`', () => {
        const abs = fileURLToPath(new URL(`frontend/${mapDocumentPath(null).path}`, REPO));
        expect(existsSync(abs)).toBe(true);
        expect(JSON.parse(readFileSync(abs, 'utf8')).levels).toHaveLength(116);
    });

    it('⛓ and node\'s ATLAS_PATH is that same file, resolved against ITS base', () => {
        const abs = fileURLToPath(new URL(`frontend/${mapDocumentPath(null).path}`, REPO));
        expect(ATLAS_PATH).toBe(abs);
        expect(existsSync(ATLAS_PATH)).toBe(true);
    });

    it('the wiring keeps its {path, source} face over the derivation', () => {
        expect(resolveMapPath(null)).toEqual({
            path: mapDocumentPath(null).path, source: 'the atlases default',
        });
        expect(resolveMapPath({ region_atlas: { map_document: 'other-map.json' } }))
            .toEqual({ path: `${ATLAS_DIR}other-map.json`, source: 'region_atlas.map_document' });
        expect(Object.keys(resolveMapPath(null))).toEqual(['path', 'source']);
    });

    it('AP_ASSET_PATHS is DERIVED from it, not a fourth spelling', () => {
        expect(AP_ASSET_PATHS.atlasDir).toBe(ATLAS_DIR);
        expect(AP_ASSET_PATHS.defaultMap).toBe(mapDocumentPath(null).path);
        expect(AP_ASSET_PATHS.defaultMap).toBe(ATLAS_DIR + DEFAULT_MAP_DOCUMENT);
    });
});

/**
 * ⛔ ASSERTED OVER THE SOURCE, because `watchViewer.js` is a 12,000-line browser
 * page module: there is no node moment at which `ATLAS_URL` can be evaluated.
 * What a scan CAN say is that the literal is gone and the derivation is there —
 * and the live proof is the browser gates, which fetch the document this path
 * names on every boot.
 */
describe('the lab\'s ATLAS_URL derives it too — the literal is gone', () => {
    const LAB = 'frontend/modules/seedlingDemo/watchViewer.js';
    const code = () => source(LAB).split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join('\n');

    it('the page resolves the DERIVED path against its own `repoUrl`', () => {
        const body = code();
        expect(body).toMatch(/const ATLAS_URL = repoUrl\(`frontend\/\$\{mapDocumentPath\(null\)\.path\}`\)/);
        expect(body).toMatch(/from '\.\.\/flashPanel\/mapDocumentPath\.js'/);
    });

    it('⛔ and the old literal is not spelled anywhere in it', () => {
        expect(code()).not.toMatch(/modules\/flashPanel\/atlases\/seedling-map\.json/);
    });

    it('⚠ and the scan is NOT vacuous — it sees the literal when one is there', () => {
        const mutant = "const ATLAS_URL = repoUrl('frontend/modules/flashPanel/atlases/seedling-map.json');";
        expect(/modules\/flashPanel\/atlases\/seedling-map\.json/.test(mutant)).toBe(true);
        expect(/const ATLAS_URL = repoUrl\(`frontend\/\$\{mapDocumentPath\(null\)\.path\}`\)/.test(mutant))
            .toBe(false);
    });
});

/**
 * ⚖ **RESIDUE F7b, ASSERTED AS AN ABSENCE.** The survey's finding was that only
 * the panel honours the override. MEASURED: all 3 presets that carry
 * `region_atlas.map_document` name the DEFAULT, so the divergence has zero
 * instances; and the hosted lab is never handed rules at all. This row is what
 * reds the day the first one appears — at which point F7b stops being a case
 * with no instance and becomes a `labProtocol` field, ⚖ for the user.
 */
describe('⚖ F7b — the override has no instance in the tree, and no channel to the lab', () => {
    const PRESETS = fileURLToPath(new URL('frontend/presets/', REPO));

    /** Every `*_rules.json` under `frontend/presets/`, walked — not a list. */
    const rulesFiles = () => {
        const out = [];
        for (const game of readdirSync(PRESETS, { withFileTypes: true })) {
            if (!game.isDirectory()) continue;
            for (const seed of readdirSync(`${PRESETS}${game.name}`, { withFileTypes: true })) {
                if (!seed.isDirectory()) continue;
                const dir = `${PRESETS}${game.name}/${seed.name}`;
                for (const f of readdirSync(dir)) {
                    if (f.endsWith('_rules.json')) out.push(`${dir}/${f}`);
                }
            }
        }
        return out;
    };

    it('every preset that names a map_document names the DEFAULT', () => {
        const files = rulesFiles();
        expect(files.length).toBeGreaterThan(3);   // the walk found presets at all
        const named = files
            .map((f) => JSON.parse(readFileSync(f, 'utf8'))?.region_atlas?.map_document)
            .filter((d) => typeof d === 'string');
        expect(named).toHaveLength(3);
        for (const doc of named) expect(doc).toBe(DEFAULT_MAP_DOCUMENT);
    });

    it('the lab\'s `load` payload carries an address and a payload — never rules', () => {
        const fields = LAB_PAYLOAD_FIELDS[LAB_EVENTS.load];
        expect(fields).toContain('payload');
        expect(fields).not.toContain('rules');
        expect(fields.some((f) => /rule/i.test(f))).toBe(false);
    });
});
