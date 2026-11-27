/**
 * ⛓ SEEDLING HAMMER-PHASE ENTRY-37 WALL (`seedling-hammer-entry37-wall`; ⚖ the user, 2026-11-26: *"Entry-37 wall
 * (Recommended)"*) — the default-tier rows.
 *
 *   - (a) `AXE_TIMING_SWORD_SWAP`: ships OFF, its env name is in the solver's table, `withAxeTimingSwordSwap` restores;
 *     `axeTimingSwordSlot` (the slot the AXETIMING rung would select) reads the run's own slot array;
 *   - (b) `previewWandShot` is Enemy-blind (it asks `collidesSolid` only): on L65's pair (`turret@64,112` +
 *     `darktrap@144,144`, both wand keys ON) the preview flies past the turret the run's shot stops on. The preview is
 *     the wand VERB's MagicalLock stance preview only, and `execWand` reads the run's `magicalLocksOpened` after the
 *     press (a shot the preview called clear and the run stopped is refused there, naming `wandShotHits`); the census
 *     row says which MagicalLock rooms hold a body of the wave-67/68 classes at all.
 *
 * The captured request 37:8 itself (a 2309-unit solve) is the train tier: `hammerEntry37Wall.train.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    AXE_TIMING_SWORD_SWAP, AXE_TIMING_SWORD_SWAP_COUNTS, axeTimingSwordSlot, previewWandShot, withAxeTimingSwordSwap,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { INVENTORY_ITEM_IDS, parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { withWandVerb } from './wandVerb.js';
import { wandEnemyTape } from '../../../scripts/procgen/probe-seedling-wandenemybodies.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A run stand-in: `progress` only, which is all `axeTimingSwordSlot` reads. */
const fakeRun = ({ inventory, primaryWeapon, inventorySlots }) => ({
    progress: (f) => ({ inventory, primaryWeapon, inventorySlots })[f],
});

describe('entry-37 wall (a) — AXE_TIMING_SWORD_SWAP, the switch', () => {
    it('ships OFF, and its env name is in the solver\'s table (sorted, unique)', () => {
        expect(AXE_TIMING_SWORD_SWAP.enabled).toBe(process.env.SEEDLING_AXE_TIMING_SWORD_SWAP === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_AXE_TIMING_SWORD_SWAP');
        expect([...SOLVER_ENV_NAMES].sort()).toEqual([...SOLVER_ENV_NAMES]);
        expect(new Set(SOLVER_ENV_NAMES).size).toBe(SOLVER_ENV_NAMES.length);
        expect(Object.keys(AXE_TIMING_SWORD_SWAP_COUNTS).sort()).toEqual(['asked', 'certified', 'landings', 'refused']);
    });

    it('withAxeTimingSwordSwap sets it for the call and restores it, also on a throw', () => {
        const before = AXE_TIMING_SWORD_SWAP.enabled;
        expect(withAxeTimingSwordSwap(true, () => AXE_TIMING_SWORD_SWAP.enabled)).toBe(true);
        expect(AXE_TIMING_SWORD_SWAP.enabled).toBe(before);
        expect(() => withAxeTimingSwordSwap(true, () => { throw new Error('x'); })).toThrow('x');
        expect(AXE_TIMING_SWORD_SWAP.enabled).toBe(before);
    });
});

describe('entry-37 wall (a) — axeTimingSwordSlot', () => {
    const sword = INVENTORY_ITEM_IDS.sword;
    const wand = INVENTORY_ITEM_IDS.wand;
    const spear = INVENTORY_ITEM_IDS.spear;
    const fire = INVENTORY_ITEM_IDS.fire;

    it('the sword held and the wand selected (37:8\'s state: slots [0,1,3,2], primary 3 = the wand) → the sword\'s slot', () => {
        expect(axeTimingSwordSlot(fakeRun({ inventory: { hasSword: true, hasWand: true }, primaryWeapon: 'wand',
            inventorySlots: [sword, fire, spear, wand] }))).toBe(0);
    });

    it('reads the run\'s OWN slot order (arrival order), never a re-derivation', () => {
        expect(axeTimingSwordSlot(fakeRun({ inventory: { hasSword: true }, primaryWeapon: 'fire',
            inventorySlots: [fire, sword] }))).toBe(1);
    });

    it('the sword already selected, no sword held, or no sword slot yet → null (the rung as before)', () => {
        expect(axeTimingSwordSlot(fakeRun({ inventory: { hasSword: true }, primaryWeapon: 'sword',
            inventorySlots: [sword, wand] }))).toBeNull();
        expect(axeTimingSwordSlot(fakeRun({ inventory: { hasWand: true }, primaryWeapon: 'wand',
            inventorySlots: [wand] }))).toBeNull();
        // the flag landed this observation, the slot has not been appended (the frame's tail): not selectable yet
        expect(axeTimingSwordSlot(fakeRun({ inventory: { hasSword: true }, primaryWeapon: 'wand',
            inventorySlots: [wand] }))).toBeNull();
    });

    it('the ghost sword is its own item (id 4, the fusion\'s slot)', () => {
        const ghost = INVENTORY_ITEM_IDS.ghostsword;
        expect(axeTimingSwordSlot(fakeRun({ inventory: { hasGhostSword: true, hasWand: true }, primaryWeapon: 'wand',
            inventorySlots: [ghost, fire, wand] }))).toBe(0);
        expect(axeTimingSwordSlot(fakeRun({ inventory: { hasGhostSword: true }, primaryWeapon: 'ghostsword',
            inventorySlots: [ghost] }))).toBeNull();
    });
});

describe('entry-37 wall (b) — previewWandShot is Enemy-blind; the run is not (L65\'s pair, both wand keys ON)', () => {
    const KEYS = { wandShotEnemyBodies: true, wandShotTrapBodies: true };
    const tape = parseTape(JSON.stringify(wandEnemyTape('turret-l65')));
    const press = tape.inputs.find((sp) => sp.key === 'primary').from;

    it('facing turret@64,112 from (41.7,120): the preview stops on the wall past the turret; the run\'s shot on the turret', () => {
        const got = withWandVerb(true, () => withContactFidelity(KEYS, () => {
            const run = createRunForStaging({ ...tape, equips: tape.equips ?? [] }, atlasLevelSource());
            const keysAt = (i) => new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key));
            for (let i = 0; i < press; i += 1) run.advance(keysAt(i));
            const preview = previewWandShot(run, run.state, run.direction);
            for (let i = press; i < tape.tick_count; i += 1) run.advance(keysAt(i));
            return { level: run.level, direction: run.direction, preview, hits: run.wandShotHits.map((h) => h.id) };
        }));
        expect(got.level).toBe(65);
        expect(got.direction).toBe(0);
        expect(got.hits[0]).toBe('turret@64,112');
        // MEASURED: the preview flies past the turret to the wall (`tile:Body Wall`, spawn (57,120))
        expect(got.preview.event).toMatchObject({ arm: 'other', id: 'tile:Body Wall' });
    });
});

describe('entry-37 wall (b) — the MagicalLock rooms that hold a wave-67/68 body (the only rooms the preview is asked in)', () => {
    it('only L101, whose two locks are FIRE locks (refused by name before any preview: the Fire Wand\'s case 5)', () => {
        const map = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
        const classes = new Set(['turret', 'lavatrap', 'wallflyer', 'icetrap', 'sandtrap', 'drill', 'grenade', 'darktrap']);
        const rows = map.levels.map((l) => ({
            level: l.level,
            locks: l.entities.filter((e) => e.type === 'magicallock' || e.type === 'magicallockfire').map((e) => e.type),
            bodies: l.entities.filter((e) => classes.has(e.type)).map((e) => `${e.type}@${e.x},${e.y}`),
        })).filter((r) => r.locks.length > 0);
        expect(rows.map((r) => r.level)).toEqual([12, 34, 43, 68, 101]);
        expect(rows.filter((r) => r.bodies.length > 0)).toEqual([
            { level: 101, locks: ['magicallockfire', 'magicallockfire'], bodies: ['darktrap@160,80'] },
        ]);
    });
});
