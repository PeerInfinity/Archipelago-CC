/**
 * `atlasSource` — the browser-safe seam, and the ONE "index rooms by level"
 * map (maze-lab arms F-a / plan §17.1 F11).
 *
 * ⛔⛔ THIS FILE DID NOT EXIST AT `8a1eb6b1a`, AND THE BRIEF NAMED IT. F-a's
 * bounded ⚖ 52 run listed `frontend/modules/seedlingDemo/atlasSource.test.js`;
 * `ls` says otherwise. `levelSourceFromAtlas` was reached only INDIRECTLY, by
 * seven `procgen*`/`watch*` test files that build a level source on the way to
 * asking something else — so the throw-by-name that is the function's whole
 * documented reason for existing ("rather than returning undefined for
 * `buildLevelWorld` to trip over one frame later") was asserted by nobody.
 */
import { describe, expect, it } from 'vitest';

import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const DOC = { levels: [{ level: 0, name: 'start' }, { level: 19, name: 'the door room' }] };

describe('indexLevels — one spelling, keyed by the NUMBER', () => {
    it('keys by the level number the documents carry, not by its string', () => {
        const byLevel = indexLevels(DOC);
        expect(byLevel.get(19)).toBe(DOC.levels[1]);
        expect(byLevel.get('19')).toBeUndefined();
        expect([...byLevel.keys()]).toEqual([0, 19]);
    });

    it('returns an already-built Map UNCHANGED — the tolerance `indexSeedlingLevels` always had', () => {
        const m = new Map([[7, { level: 7 }]]);
        expect(indexLevels(m)).toBe(m);
    });

    it('is empty, not a throw, for a document with no levels at all', () => {
        expect(indexLevels({}).size).toBe(0);
        expect(indexLevels(null).size).toBe(0);
        expect(indexLevels(undefined).size).toBe(0);
    });

    /**
     * ⛓ LEVEL 0 IS A REAL LEVEL and it is the Seedling starting room, so an
     * index that treated a falsy key as absent would lose it.
     */
    it('holds level 0', () => {
        expect(indexLevels(DOC).get(0)).toBe(DOC.levels[0]);
    });
});

describe('levelSourceFromAtlas', () => {
    it('answers a NUMERIC level, and refuses a stringified one BY NAME', () => {
        const source = levelSourceFromAtlas(DOC);
        expect(source(19)).toBe(DOC.levels[1]);
        expect(() => source('19')).toThrow(/seedling atlas has no level 19 \(it has 2 levels\)/);
    });

    it('names the level and the corpus size rather than returning undefined', () => {
        expect(() => levelSourceFromAtlas(DOC)(404))
            .toThrow('seedling atlas has no level 404 (it has 2 levels)');
    });

    it('is built over an atlas with no levels without throwing until asked', () => {
        const source = levelSourceFromAtlas({});
        expect(() => source(0)).toThrow(/no level 0 \(it has 0 levels\)/);
    });
});
