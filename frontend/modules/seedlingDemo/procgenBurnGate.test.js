/**
 * seedlingDemo — **THE BURN GATE: a burnable tree on a cut, burned with Fire**
 * (strategy switch r2, the design's D3).
 *
 * The element (`procgenCore/elements/burnGate.js`) realised by the binding as a
 * `burnabletree` with a tag of its own, written at the 2x2's anchor. It
 * certifies on the solver's EXISTING `burn` (no solver edit), with the biome's
 * `hasFire` boot flag carried to the run's inventory by the seam
 * (`items.hasFire` → `save.hasFire`), which `resolveBurnStrategy` reads.
 *
 * THE WITNESS, measured (`generate-seedling-level.mjs --biome=post-fire
 * --elements=burngate`, empty 10x10): seeds 1–3 place and certify
 * `[burn, collect]`; `--require=strategy:burn` and `--require=hasFire` grade
 * STRONG on all three (the slow tier pins strategy:burn).
 *
 * MUTANTS (measured, each reverted — the as-built's table):
 *  (a) `needsStrategy` dropped ⇒ `strategy:burn` has no head (the directive row).
 *  (b) the binding writes the tree at `C` instead of the anchor ⇒ the anchor row reds.
 *  (c) `needs` dropped ⇒ the post-sword row places and the solve refuses for want of Fire
 *      instead of the seam's free refusal by name.
 */

import { describe, expect, it } from 'vitest';

import { generateSeedlingLevel } from './procgenSeedling.js';
import { seedlingOnConnectorEntities } from './procgenSeedlingElements.js';
import {
    POST_DARK_SUIT_PALETTE, POST_FEATHER_PALETTE, POST_FIRE_ITEMS, POST_FIRE_PALETTE, POST_SHIELD_PALETTE,
    POST_SPEAR_PALETTE, POST_SWIM_PALETTE, POST_SWORD_PALETTE, PRE_SWORD_PALETTE,
} from './procgenPalette.js';
import { BIOME_DEFAULT_FOLD, defaultElementsFor } from './procgenSeedling.js';
import { GEN_ROOM_BIOMES } from './seedlingGenRoom.js';
import { BIOME_NAMES, DEFAULT_CENSUS_BIOMES } from './watchGenerate.js';
import {
    ELEMENT_NAMES, ELEMENT_TABLE, ITEMS_ELEMENTS_NEED, STRATEGIES_ELEMENTS_NEED, formatElementSpec,
    headsNeeding, parseElementSpec, resolveRequireDirective,
} from '../procgenCore/elementSpec.js';
import { BURN_GATE, BURN_GATE_DOOR_ID } from '../procgenCore/elements/burnGate.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import { SEAM_BOOT_SPEC } from './tapeFormat.js';

const gen = (palette, { seed = 1, elements = 'burngate', require } = {}) => generateSeedlingLevel({
    seed, palette,
    defaults: { width: 10, height: 10 },
    skeleton: parseSkeleton('empty', { substrate: 'seedling' }),
    elements: parseElementSpec(elements),
    ...(require ? { require } : {}),
});

describe('⛓⛓⛓ the BURN GATE head, its boot flag and its biomes (strategy switch r2)', () => {
    it('the head is `burngate`, LAST, needs `hasFire`, requires strategy `burn`', () => {
        /** ⛓ r3 appended `holdgate` and `weighgate` after it; nothing before it moved. */
        expect(ELEMENT_NAMES.slice(-5)).toEqual(['burngate', 'holdgate', 'weighgate', 'chestloot', 'keygate']); // + B1, + keygate
        expect(ELEMENT_TABLE.burngate.element).toBe(BURN_GATE);
        expect(ELEMENT_TABLE.burngate.needs).toEqual(['hasFire']);
        expect(ELEMENT_TABLE.burngate.needsStrategy).toEqual(['burn']);
        expect(ITEMS_ELEMENTS_NEED).toContain('hasFire');
        expect(STRATEGIES_ELEMENTS_NEED).toContain('burn');
        expect(headsNeeding('strategy:burn')).toEqual(['burngate']);
        expect(headsNeeding('hasFire')).toEqual(['burngate']);
    });

    it('the fire boot flag is the SEAM\'s own `items.hasFire`, and post-fire grants it', () => {
        expect(SEAM_BOOT_SPEC.map((r) => r.key)).toContain('items.hasFire');
        expect(POST_FIRE_ITEMS.hasFire).toBe(true);
        expect(POST_SWORD_PALETTE.items.hasFire).not.toBe(true);
        expect(GEN_ROOM_BIOMES['post-fire']).toBe(POST_FIRE_PALETTE);
        expect(BIOME_NAMES).toContain('post-fire');
    });

    // ⛓ seedling-gen-post-swim-fix (⚖ Robert 2026-11-02, "Both, one re-record"): was "OPT-IN: in no
    // biome default". The head joins by its OWN item, as a last row, and only the fire's boots draw it.
    it('JOINED: the fold\'s last row is `hasFire` → burngate; every boot with the fire draws it, none without', () => {
        expect(BIOME_DEFAULT_FOLD.at(-1)).toEqual({ item: 'hasFire', heads: [{ name: 'burngate' }] });
        for (const items of [POST_FIRE_ITEMS, POST_SPEAR_PALETTE.items, POST_DARK_SUIT_PALETTE.items,
            POST_SWIM_PALETTE.items, POST_FEATHER_PALETTE.items]) {
            expect(formatElementSpec(defaultElementsFor(items))).toMatch(/\+burngate$/);
        }
        for (const items of [PRE_SWORD_PALETTE.items, POST_SWORD_PALETTE.items, POST_SHIELD_PALETTE.items]) {
            expect(formatElementSpec(defaultElementsFor(items))).not.toMatch(/burngate/);
        }
        expect(DEFAULT_CENSUS_BIOMES).not.toContain('post-fire');
    });

    it('`require:[strategy:burn]` resolves to the burn gate on a fire boot; dropping `needsStrategy` (mutant a) leaves no head', () => {
        const d = resolveRequireDirective({ require: ['strategy:burn'], items: POST_FIRE_ITEMS });
        expect(d.refused).toBe(null);
        expect(d.heads).toEqual(['burngate']);
        const { needsStrategy, ...bare } = ELEMENT_TABLE.burngate;
        expect(needsStrategy).toEqual(['burn']);
        const mutant = resolveRequireDirective({ require: ['strategy:burn'], items: POST_FIRE_ITEMS,
            table: { ...ELEMENT_TABLE, burngate: bare } });
        expect(mutant.refused?.reason).toBe('no-element-needs-this-item');
    });
});

describe('⛓⛓⛓ the binding: one `burnabletree` at the anchor, one tag', () => {
    it('the realiser writes the tree at the 2x2 ANCHOR (not the door cell) with its OWN tag', () => {
        let tags = 0;
        const out = seedlingOnConnectorEntities({
            placed: { entities: [{ role: 'obstacle', x: 4, y: 5, id: BURN_GATE_DOOR_ID,
                anchor: { x: 3, y: 5 } }] },
            tagFor: () => { tags += 1; return 7; },
        });
        expect(out.entities).toEqual([{ type: 'burnabletree', tx: 3, ty: 5, attrs: { tag: '7' } }]);
        expect(out.tags).toEqual({ tree: 7 });
        expect(tags).toBe(1);
    });
});

describe('⛓⛓⛓ the BURN GATE on a generated Seedling level', () => {
    it('post-fire seeds 1–3: places, CERTIFIES `[burn, collect]` (burn first), one tagged tree on four floor cells', () => {
        for (const seed of [1, 2, 3]) {
            const out = gen(POST_FIRE_PALETTE, { seed });
            const placed = out.model.elements.placed[0];
            expect(placed.family, `seed ${seed}`).toBe('burngate');
            expect(out.certification.certified, `seed ${seed}`).toBe(true);
            const verbs = out.certification.strategies;
            expect(verbs, `seed ${seed}`).toEqual(['burn', 'collect']);
            const trees = out.record.entities.filter((e) => e.type === 'burnabletree');
            expect(trees, `seed ${seed}`).toHaveLength(1);
            const [tree] = trees;
            expect(Number(tree.attrs?.tag ?? tree.tag), `seed ${seed}`).toBeGreaterThanOrEqual(0);
            /** The 2x2 under the tree is exactly the four door cells, all floor in the record. */
            const ax = Math.round(tree.x / 16);
            const ay = Math.round(tree.y / 16);
            expect(placed.doorCells.map((c) => `${c.x},${c.y}`).sort(), `seed ${seed}`)
                .toEqual([`${ax},${ay}`, `${ax + 1},${ay}`, `${ax},${ay + 1}`, `${ax + 1},${ay + 1}`].sort());
        }
    }, 240000);

    it('post-spear and post-dark-suit certify it too (both boots hold Fire)', () => {
        for (const p of [POST_SPEAR_PALETTE, POST_DARK_SUIT_PALETTE]) {
            const out = gen(p);
            expect(out.certification.certified, p.name).toBe(true);
            expect(out.certification.strategies, p.name).toContain('burn');
        }
    }, 240000);

    it('`require:[hasFire]` through the pipeline is MET via the burn gate, STRONG', () => {
        const out = gen(POST_FIRE_PALETTE, { require: ['hasFire'] });
        expect(out.require.element).toBe('burngate');
        expect(out.require.met).toBe(true);
        expect(out.require.grade).toBe('STRONG');
    }, 240000);

    it('post-sword: REFUSED BY NAME with no solve — the boot grants no Fire', () => {
        const out = gen(POST_SWORD_PALETTE);
        expect(out.certification.gap).toBe('the-element-needs-an-item-this-biome-does-not-grant');
        expect(out.certification.needs).toEqual(['hasFire']);
        expect(out.certification.verdict).toBe(null);
        expect(out.model.elements.ran).toBe(false);
    }, 240000);
});
