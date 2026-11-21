/**
 * S3 — **THE MOUNT KEY READS `region_atlas[p].level_set`** (and so the JS save key, `jsSaveKey(mountKey)`).
 *
 * ⛔ ABSENT → BYTE-IDENTICAL: every committed preset with `flash_seedling` rooms keys exactly as it did at the
 * slice's base. The digests below were MEASURED by running this module's `seedlingMountKey` over a pristine
 * `git archive` of the base (origin/main `15bc7c65ee`) and over this tree: 8/8 equal. A preset added or
 * regenerated later moves its row on purpose — re-record it then, and say so.
 * ⛓ PRESENT → APART: two sets that differ only in one tile key apart, and so save apart.
 *
 * Mutants this file reds (each driven by hand, quoted in the as-built):
 *  · the key reads `region_atlas[p]` minus `level_set` → the keys-apart row;
 *  · the key always writes a `level_set: null` → every absent row.
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { levelSetReferenceOf } from '../procgenCore/levelSetReference.js';
import { stampLevelSetIdentity } from '../seedlingDemo/levelSetValidator.js';
import { editorVanillaSet } from '../seedlingDemo/watchSetEditor.js';
import { jsSaveKey } from './seedlingJsSave.js';
import { seedlingMountKey } from './seedlingMountKey.js';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel) => JSON.parse(readFileSync(`${REPO}${rel}`, 'utf8'));
const sha16 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** ⛓ `[preset, sha256(mountKey)[0:16], jsSaveKey(mountKey)]` at the base, player `'1'`. */
const BASE = [
    ['frontend/presets/seedling_atlas/AP_1/AP_1_rules.json', 'd287026777994457', 'seedlingJsSave_88147be40519edef'],
    ['frontend/presets/seedling_atlas_host/AP_1/AP_1_rules.json', '112958cc5d97e6bc', 'seedlingJsSave_2082008aff958c93'],
    ['frontend/presets/seedling_atlas_location/AP_1/AP_1_rules.json', '20c0032352167969', 'seedlingJsSave_0f911d1fe45d1540'],
    ['frontend/presets/seedling_er/AP_1/AP_1_rules.json', '7970bdeeec36aa64', 'seedlingJsSave_5a6e14becf2e76b7'],
    ['frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json', 'c56f1d856b4d1bef', 'seedlingJsSave_f6ea46a13de4c328'],
    ['frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json', 'd734d40cf39ee0f7', 'seedlingJsSave_a7670b232eeec69e'],
    ['frontend/presets/seedling_sphere_room/AP_1/AP_1_rules.json', 'f2647945cec94156', 'seedlingJsSave_3b35e90c86c174f1'],
    ['frontend/presets/seedling_spiral_room/AP_1/AP_1_rules.json', '1bf561d73a81adad', 'seedlingJsSave_41513aef0ee6808e'],
];

/** The roster DERIVED from the tree, so a preset that gains `flash_seedling` rooms cannot slip past the table. */
const derivedRoster = () => execSync('git ls-files "frontend/presets/*_rules.json"', { cwd: REPO }).toString()
    .trim().split('\n').filter((f) => readFileSync(`${REPO}${f}`, 'utf8').includes('"flash_seedling"'));

describe('⛔ level_set ABSENT → every committed Seedling preset\'s mount key (and JS save key) is byte-identical to the base', () => {
    it('the table is the whole derived roster', () => {
        expect(derivedRoster().sort()).toEqual(BASE.map(([f]) => f).sort());
    });
    it.each(BASE)('%s', (file, digest, saveKey) => {
        const rules = read(file);
        expect(rules.region_atlas?.['1']?.level_set).toBeUndefined();
        const key = seedlingMountKey({ rules, playerId: '1' });
        expect(key.startsWith('unkeyable')).toBe(false);
        expect(sha16(key)).toBe(digest);
        expect(jsSaveKey(key)).toBe(saveKey);
    });
});

describe('⛓ level_set PRESENT → two sets that differ only in one tile key apart, and save apart', () => {
    /** The watch page's vanilla 116 as RECORDS (`#editLoadVanilla`), and the same set with ONE tile flipped. */
    const VANILLA = editorVanillaSet(read('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
        read('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
    const oneTile = (() => {
        const s = structuredClone(VANILLA);
        const tiles = s.rooms[10].source.record.layers[0].tiles;
        tiles[0] = [tiles[0][0], tiles[0][1], tiles[0][2] === 48 ? 0 : 48, tiles[0][3]];
        return stampLevelSetIdentity(s);
    })();
    const PRESET = read(BASE[0][0]);
    const withSet = (set) => {
        const rules = structuredClone(PRESET);
        rules.region_atlas['1'] = { ...rules.region_atlas['1'], level_set: levelSetReferenceOf(set) };
        return rules;
    };
    it('the two references differ only in content (the set ids carry the content hash too)', () => {
        const a = levelSetReferenceOf(VANILLA);
        const b = levelSetReferenceOf(oneTile);
        expect(b.content_hash).not.toBe(a.content_hash);
        expect(b.set_id).not.toBe(a.set_id);
    });
    it('…and the mount keys and JS save keys differ, while every other key input is identical', () => {
        const ka = seedlingMountKey({ rules: withSet(VANILLA), playerId: '1' });
        const kb = seedlingMountKey({ rules: withSet(oneTile), playerId: '1' });
        expect(ka).not.toBe(kb);
        expect(jsSaveKey(ka)).not.toBe(jsSaveKey(kb));
        const strip = (k) => { const o = JSON.parse(k); delete o.atlas.level_set; return JSON.stringify(o); };
        expect(strip(ka)).toBe(strip(kb));
    });
    it('present differs from absent (the same preset, with and without a reference)', () => {
        expect(seedlingMountKey({ rules: withSet(VANILLA), playerId: '1' }))
            .not.toBe(seedlingMountKey({ rules: PRESET, playerId: '1' }));
    });
});
