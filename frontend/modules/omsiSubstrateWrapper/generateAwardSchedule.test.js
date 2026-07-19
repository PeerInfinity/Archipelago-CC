// P2-omsi slice 5: the lootable-contents schedule generator. The
// load-bearing assertions are the byte-inertness disciplines: default
// knobs return null (no payload field anywhere), and generation is
// deterministic per (seed, knobs, pool).
import { describe, it, expect } from 'vitest';
import {
    generateOmsiAwardSchedule, OMSI_LOOTABLES, CONTENTS_HORIZON,
} from './generateAwardSchedule.js';
import { substrateRegistryEntry } from './omsiSubstrateWrapperLibrary.js';

const FOREIGN = [{ substrate: 'jta', type: 'Food' }, { substrate: 'jta', type: 'Fish' }];

describe('generateOmsiAwardSchedule', () => {
    it('returns null at the byte-inert defaults', () => {
        expect(generateOmsiAwardSchedule({ seed: 1 })).toBeNull();
        expect(generateOmsiAwardSchedule({
            seed: 1, originalItemWeight: 1, dummyItemRatio: 0, foreignTypes: FOREIGN,
        })).toBeNull();
    });

    it('is deterministic per seed and differs across seeds', () => {
        const a1 = generateOmsiAwardSchedule({ seed: 7, originalItemWeight: 0.5, foreignTypes: FOREIGN });
        const a2 = generateOmsiAwardSchedule({ seed: 7, originalItemWeight: 0.5, foreignTypes: FOREIGN });
        const b = generateOmsiAwardSchedule({ seed: 8, originalItemWeight: 0.5, foreignTypes: FOREIGN });
        expect(JSON.stringify(a1)).toBe(JSON.stringify(a2));
        expect(JSON.stringify(a1)).not.toBe(JSON.stringify(b));
    });

    it('mints full-horizon contents for the v1 lootables in carrier vocabulary', () => {
        const s = generateOmsiAwardSchedule({ seed: 1, originalItemWeight: 0.5, dummyItemRatio: 0.2, foreignTypes: FOREIGN });
        expect(s.version).toBe(1);
        expect(Object.keys(s.lootables).sort()).toEqual([...OMSI_LOOTABLES].sort());
        const locals = new Set(substrateRegistryEntry.sharing.items.types);
        for (const varName of OMSI_LOOTABLES) {
            const contents = s.lootables[varName].contents;
            expect(contents).toHaveLength(CONTENTS_HORIZON);
            let nonVanilla = 0;
            for (const e of contents) {
                if (e === null) continue;
                nonVanilla += 1;
                if (e.dummy === true) continue;
                if (e.substrate !== undefined) {
                    expect(FOREIGN.some((f) => f.substrate === e.substrate && f.type === e.type)).toBe(true);
                    expect(e.count).toBe(1);
                } else {
                    expect(locals.has(e.name)).toBe(true);
                    expect(e.count).toBe(1);
                }
            }
            expect(nonVanilla).toBeGreaterThan(0);
        }
    });

    it('dummy-only knob mints only dummies and vanillas', () => {
        const s = generateOmsiAwardSchedule({ seed: 3, dummyItemRatio: 0.5 });
        for (const varName of Object.keys(s.lootables)) {
            for (const e of s.lootables[varName].contents) {
                expect(e === null || e.dummy === true).toBe(true);
            }
        }
    });

    it('rejects out-of-range knobs and malformed foreign types', () => {
        expect(() => generateOmsiAwardSchedule({ originalItemWeight: 1.5 })).toThrow(/originalItemWeight/);
        expect(() => generateOmsiAwardSchedule({ dummyItemRatio: -0.1 })).toThrow(/dummyItemRatio/);
        expect(() => generateOmsiAwardSchedule({ originalItemWeight: 0.5, foreignTypes: [{ substrate: 'jta' }] }))
            .toThrow(/foreignTypes/);
    });
});
