/**
 * ER E6 — which world the route survey walks (`surveyPreset.js`), against the committed presets: the derived
 * sphere order IS the committed artifact on the default preset, and the survey's delivered rooms ARE the
 * randomized load's (`entranceRetarget.applyEntranceShuffle` over the vanilla record set).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    COMMITTED_SPHERE_ORDER, DEFAULT_SURVEY_PRESET, assertPresetId, deliveredMapDocument, presetRulesPath,
    sphereOrderFor, sphereOrderOfRules,
} from './surveyPreset.js';
import { throughSurveyDir } from './seedlingSurveyDir.js';
import { applyEntranceShuffle } from '../../frontend/modules/seedlingDemo/entranceRetarget.js';
import { vanillaRecordSet } from '../../frontend/modules/seedlingDemo/levelSetExporter.js';
import { patchedMapDocument } from '../../frontend/modules/seedlingDemo/seedlingSetPatches.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
const PLAYTHROUGH = JSON.parse(readFileSync(presetRulesPath(REPO, DEFAULT_SURVEY_PRESET), 'utf8'));
const ER = JSON.parse(readFileSync(presetRulesPath(REPO, 'seedling_er'), 'utf8'));
const realLocations = (rules) => Object.values(rules.regions['1']).flatMap((r) => r.locations ?? [])
    .filter((l) => l.event_kind === undefined);

describe('surveyPreset — the preset is a directory name', () => {
    it('refuses a path, and names a preset that is not there', () => {
        expect(() => assertPresetId('../x')).toThrow(/directory name/);
        expect(() => assertPresetId('')).toThrow(/directory name/);
        expect(() => presetRulesPath(REPO, 'no_such_preset_here')).toThrow(/no_such_preset_here/);
        expect(presetRulesPath(REPO, 'seedling_er')).toMatch(/presets\/seedling_er\/AP_1\/AP_1_rules\.json$/);
    });

    it('a non-default world\'s survey never shares a directory with the playthrough\'s', () => {
        const base = throughSurveyDir(REPO, 'end', 'full');
        expect(throughSurveyDir(REPO, 'end', 'full', null)).toBe(base);
        const er = throughSurveyDir(REPO, 'end', 'full', 'seedling_er');
        expect(er).not.toBe(base);
        expect(er.endsWith(join('seedling_er', 'through-end'))).toBe(true);
        expect(throughSurveyDir(REPO, 'end', 'route-only', 'seedling_er').endsWith(join('seedling_er', 'through-end-route-only'))).toBe(true);
    });
});

describe('surveyPreset — the sphere order', () => {
    const committed = readJson(COMMITTED_SPHERE_ORDER);

    it('the default preset reads the committed artifact', () => {
        const got = sphereOrderFor({ repo: REPO, preset: DEFAULT_SURVEY_PRESET, rules: PLAYTHROUGH });
        expect(got.source).toBe(COMMITTED_SPHERE_ORDER);
        expect(got.order).toEqual(committed.order);
    });

    it('DERIVED over the default preset\'s rules, it is the committed artifact row for row', () => {
        expect(sphereOrderOfRules(PLAYTHROUGH).rows).toEqual(committed.order);
    });

    it('a shuffled world gets its own order: every real location once, the same items, another sequence', () => {
        const got = sphereOrderFor({ repo: REPO, preset: 'seedling_er', rules: ER });
        expect(got.source).toMatch(/^derived/);
        const names = got.order.map((r) => r.location);
        expect(new Set(names).size).toBe(names.length);
        expect([...names].sort()).toEqual(realLocations(ER).map((l) => l.name).sort());
        // ⚖ Q4: ER only, vanilla items — each location grants what it grants on the playthrough
        const vanillaItem = new Map(committed.order.map((r) => [r.location, r.item]));
        for (const row of got.order) expect(row.item).toBe(vanillaItem.get(row.location));
        expect(names).not.toEqual(committed.order.map((r) => r.location));
    });
});

describe('surveyPreset — the rooms a world is played on', () => {
    const patched = patchedMapDocument(MAP);

    it('a world that places no entrance gets the document it handed in', () => {
        const { doc, plan } = deliveredMapDocument(patched, PLAYTHROUGH);
        expect(plan).toBe(null);
        expect(doc).toBe(patched);
    });

    it('a shuffled world gets the randomized load\'s rooms: the same exits, level for level', () => {
        const { doc, plan } = deliveredMapDocument(patched, ER);
        const { set } = vanillaRecordSet(EMBED, MAP);
        const delivered = applyEntranceShuffle({ rules: ER, slot: '1', set });
        expect(plan.moved.map((m) => `${m.level}:${m.door}`)).toEqual(delivered.plan.moved.map((m) => `${m.level}:${m.door}`));
        expect(plan.moved.length).toBeGreaterThan(0);
        const byId = new Map(delivered.set.rooms.map((r) => [r.id, r.source.record]));
        expect(doc.levels.length).toBe(patched.levels.length);
        let changed = 0;
        doc.levels.forEach((level, i) => {
            expect(level.entities).toEqual(byId.get(level.level).entities);
            // every field but the rewritten exits is the patched document's own
            expect({ ...level, entities: null }).toEqual({ ...patched.levels[i], entities: null });
            if (level !== patched.levels[i]) changed += 1;
        });
        expect(changed).toBe(plan.byLevel.size);
        // the handed-in document is not written to
        expect(JSON.stringify(patched)).toBe(JSON.stringify(patchedMapDocument(MAP)));
    });
});
