/**
 * ⛓ RULES weapon-reach-census — ONCE THE GHOST SWORD IS HELD THE THRUST IS GONE: the census
 * (`census-seedling-weapon-reach.mjs`) compares, for every Spear-typed target and ghost rock, the stances the Spear
 * thrust hits it from with the stances the Ghost Sword swing does.
 *
 * Pinned so the count cannot drift silently: a new pole event, a moved stance, or a model change that turns a "same"
 * into a LOOSER reds a row here and has to be read. The probe's scenes (`probe-seedling-weapon-reach.mjs`) are pinned
 * to the census's own stances, so a witness can never test a stance the census no longer names.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { buildPlaythroughAtlas } from './make-seedling-playthrough-rules.mjs';
import { censusWeaponReach, isFinding, isRulesLooser } from './census-seedling-weapon-reach.mjs';
import { SCENES } from './probe-seedling-weapon-reach.mjs';

let rows;
beforeAll(() => {
    rows = censusWeaponReach({ atlas: buildPlaythroughAtlas() });
}, 300_000);

const name = (r) => `L${r.level} ${r.target}`;
const FACING = { right: 'E', up: 'N', left: 'W', down: 'S' };

describe('the weapon reach census', () => {
    it('counts 38 rows: 20 poles, 12 spear-block push facings, 4 bridge runs, 2 ghost rocks', () => {
        const kinds = {};
        for (const r of rows) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
        expect(kinds).toEqual({ pole: 20, block: 12, bridge: 4, rock: 2 });
        expect(rows.filter(isFinding).length).toBe(11);
    });

    it('0 RULES-LOOSER: every charged pole the thrust lights from a side, the ghost swing lights from that side too', () => {
        // At the tile CENTRE three did not (L62 lightpole@120,200, L63 lightpole@64,88, L101 lightpole@144,64: the
        // thrust's facing from the centre is not one the 24 px swing reaches in). Over the fidelity model's fine lattice
        // (`poleFineStances`) the swing lights each from a point of the SAME tile — the probe witnesses both halves.
        expect(rows.filter(isRulesLooser).map(name)).toEqual([]);
        // The two that remain LOOSER per side are poles the rules do not charge (their light kills nothing gated).
        expect(rows.filter((r) => /LOOSER/.test(r.verdict)).map((r) => [name(r), r.charged])).toEqual([
            ['L66 lightpole@96,80', false],
            ['L66 lightpole@48,80', false],
        ]);
    });

    it('0 charged poles are TIGHTER: the 2 the swing lights from the L65 landing pockets are credited (the rules\' ghost arm)', () => {
        // ⛓ RULES l63-pole-crossings: `POLE_GHOST_ARM` charges a side no thrust reaches with the swing's centre stances.
        expect(rows.filter((r) => r.kind === 'pole' && r.charged && /TIGHTER/.test(r.verdict)).map(name)).toEqual([]);
        expect(rows.filter((r) => r.kind === 'pole' && /swing-credited/.test(r.verdict)).map(name)).toEqual([
            'L63 lightpole@48,272',
            'L63 lightpole@112,272',
        ]);
    });

    it('the block search\'s one stance (behind the block) is the same for both weapons, every block, every facing', () => {
        for (const r of rows.filter((x) => x.kind === 'block')) expect(r.rulesStanceSwing, name(r)).toBe(r.rulesStanceThrust);
    });

    it('every bridge run opens from the same banks with either weapon; every ghost rock has a swing stance', () => {
        expect(rows.filter((r) => r.kind === 'bridge').map((r) => r.verdict)).toEqual(['same', 'same', 'same', 'same']);
        expect(rows.filter((r) => r.kind === 'rock').map((r) => [name(r), r.swing.length > 0]))
            .toEqual([['L3 breakablerockghost@0,64', true], ['L101 breakablerockghost@224,96', true]]);
    });

    it('the probe\'s scenes are census stances, each mix lit or not as the census says', () => {
        for (const [scene, s] of Object.entries(SCENES)) {
            const pole = rows.find((r) => r.kind === 'pole' && r.level === s.level && r.tag === s.tag);
            expect(pole, scene).toBeTruthy();
            const F = FACING[s.dir];
            const has = (list) => list.some((x) => x.startsWith(`[${s.tile}]`) && x.split('@')[0].includes(F));
            const centre = s.at[0] === s.tile[0] * 16 + 8 && s.at[1] === s.tile[1] * 16 + 8;
            if (centre) {
                // The rules' stance (thrust) and the centre swing, from the tile centre in the scene's facing.
                if ('spear' in s.lit) expect(has(pole.thrust), `${scene} thrust`).toBe(s.lit.spear);
                // The census's own centre-swing claim (the game may light MORE: see the probe's SCENES note).
                expect(has(pole.centreSwing), `${scene} centre swing`).toBe(s.centreSwing);
                if (s.centreSwing) expect(s.lit['ghost-spear-sword'], scene).toBe(true);
            } else {
                // A fine point: the census's deepest swing point of that tile in that facing.
                expect(pole.swingPoints[`${s.tile}`]?.[F]?.slice(0, 2), scene).toEqual(s.at);
                expect(s.lit['ghost-spear-sword'], scene).toBe(true);
            }
        }
    });
});
