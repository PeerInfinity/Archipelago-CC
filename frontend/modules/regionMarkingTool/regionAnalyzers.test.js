/**
 * ⚖ (the user, 2026-10-04) — the marking tool's Analyze button passes the PHYSICS MODEL oracles for a Seedling
 * atlas, so the panel and the CLI agree (regionAnalyzers.js is the registry both read). Other games are
 * unaffected.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { REGION_ANALYZERS, regionAnalyzerFor } from './regionAnalyzers.js';
import { analyzeSeedlingRegion, applySeedlingRegionAnalysis } from '../flashPanel/seedlingAtlasAnalysis.js';
import { seedlingModelOracles } from '../seedlingDemo/seedlingModelOracles.js';

const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const STARTER = readJson('../flashPanel/atlases/seedling.json');
const MAP = readJson('../flashPanel/atlases/seedling-map.json');
const GAME_CONFIG = readJson('../flashPanel/games/seedling.json');
const deps = { mapDoc: MAP, gameConfig: GAME_CONFIG };
const clone = (o) => JSON.parse(JSON.stringify(o));
const houseRow = (rows) => rows.filter((e) => [e.from, e.to].includes('r1c6') && [e.from, e.to].includes('r8c0'));

describe('the Analyze button on the Seedling STARTER atlas', () => {
    it('does NOT re-propose the model-sealed r1c6 <-> r8c0 hand row', () => {
        const analysis = regionAnalyzerFor('seedling')(clone(STARTER), 'overworld_start', deps);
        expect(analysis.needs_authoring).toEqual([]);
        expect(houseRow(analysis.internal_exits)).toEqual([]);
        expect(analysis.model_verdicts.map((v) => `${v.from}->${v.to} ${v.walkable}`).sort())
            .toEqual(['r1c6->r8c0 false', 'r8c0->r1c6 false']);
    });

    it('Analyze + Accept on the committed atlas is a no-op (the panel agrees with the producer)', () => {
        const atlas = clone(STARTER);
        const before = JSON.stringify(atlas.regions);
        for (const r of atlas.regions) {
            applySeedlingRegionAnalysis(atlas, regionAnalyzerFor('seedling')(atlas, r.region_id, deps), { stamp: false });
        }
        expect(JSON.stringify(atlas.regions)).toBe(before);
    });

    it('control: WITHOUT the oracles the same region re-proposes the hand row (what the button used to do)', () => {
        const analysis = analyzeSeedlingRegion(clone(STARTER), 'overworld_start', deps);
        expect(analysis.needs_authoring.map((n) => `${n.from}<->${n.to}`)).toEqual(['r1c6<->r8c0']);
    });
});

describe('a non-Seedling atlas is unaffected', () => {
    afterEach(() => { delete REGION_ANALYZERS.testgame; });

    it('a game with no entry still has no analyzer', () => {
        expect(regionAnalyzerFor('rwk')).toBeNull();
        expect(Object.keys(REGION_ANALYZERS)).toEqual(['seedling']);
        expect(REGION_ANALYZERS.seedling.modelOracles).toBe(seedlingModelOracles);
    });

    it('a game entry with no oracles gets its deps exactly as passed', () => {
        const seen = [];
        REGION_ANALYZERS.testgame = { analyze: (atlas, id, d) => { seen.push(d); return { region_id: id }; } };
        const d = { mapDoc: {}, gameConfig: {} };
        regionAnalyzerFor('testgame')({}, 'r', d);
        expect(seen).toEqual([d]);
        expect(seen[0]).toBe(d);
    });
});
