import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cloudberryLevelFacts, cloudberryHeroNote, describeCloudberryLevel } from './cloudberryStatus.js';

const preset = (dir) => JSON.parse(readFileSync(
    new URL(`../../presets/${dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json`, import.meta.url), 'utf8'));
const pack = JSON.parse(readFileSync(new URL('../../region-libraries/demo-cloudberry-pack.json', import.meta.url), 'utf8'));
const packEntries = Array.isArray(pack.entries) ? pack.entries : Object.values(pack.entries ?? pack);

describe('the Cloudberry status strip: a level\'s items from its payload', () => {
    it('the request\'s platform upgrades are the facts the pack recorded (every demo-pack level)', () => {
        for (const e of packEntries) {
            const fromRequest = cloudberryLevelFacts({ generate: e.payload.generate });
            expect(fromRequest.pieceItems.map((p) => [...p].sort())).toEqual(e.payload.facts.pieceItems.map((p) => [...p].sort()));
            expect(fromRequest.jetpack).toBe(e.payload.facts.jetpack === true);
        }
    });

    it('a payload carrying facts is read from them first', () => {
        const f = cloudberryLevelFacts({ facts: { pieceItems: [[], ['Cloud']], jetpack: true }, generate: { pieces: [] } });
        expect(f).toEqual({ pieceItems: [[], ['Cloud']], jetpack: true, doubleJump: false });
    });

    it('the Double Jump world\'s Double level: Double Jump for the whole level, then Moving Blocks', () => {
        const params = preset('cloudberry_double_jump_worldgen').preset_sidecars['1'].region_3_2.playable_payload.params;
        const level = describeCloudberryLevel({ params });
        expect(level.items.map((i) => [i.name, i.kind, i.note])).toEqual([
            ['Double Jump', 'ability', 'whole level'],
            ['Moving Blocks', 'platform', 'from checkpoint 1'],
        ]);
        expect(level.items.every((i) => /^#[0-9a-f]{6}$/i.test(i.color))).toBe(true);
    });

    it('the sphere demo\'s start level: Clouds from checkpoint 1, no ability', () => {
        const params = preset('cloudberry_sphere_worldgen').preset_sidecars['1'].region_2_2.playable_payload.params;
        expect(describeCloudberryLevel({ params }).items.map((i) => i.name)).toEqual(['Clouds']);
    });

    it('a platform from the first piece is "from the start"; nothing to read → null', () => {
        const level = describeCloudberryLevel({ params: { generate: { pieces: [{ upgrades: { MovingBlock: 5 } }, { upgrades: { MovingBlock: 3, Elevator: 5 } }] } } });
        expect(level.items.map((i) => i.note)).toEqual(['from the start', 'from checkpoint 1']);
        expect(describeCloudberryLevel({ params: {} })).toBe(null);
    });

    it('the hero note names only non-default sliders of this level\'s kind', () => {
        expect(cloudberryHeroNote({ generate: { heroCustom: { move: 'Double', phsx: { numjumps: 2 } } } })).toBe(null);
        expect(cloudberryHeroNote({ generate: { heroCustom: { move: 'Double', phsx: { numjumps: 3, gravity: 1.3 } } } }))
            .toBe('hero: gravity 1.3, jumps 3');
        // a jetpack slider on a plain level is not this level's
        expect(cloudberryHeroNote({ generate: { heroCustom: { phsx: { jetpackfuel: 2 } } } })).toBe(null);
        const physics = preset('cloudberry_hero_physics_worldgen').preset_sidecars['1'];
        const notes = Object.values(physics).map((s) => cloudberryHeroNote(s.playable_payload?.params)).filter(Boolean);
        expect(notes.length).toBe(Object.keys(physics).length);
    });
});
