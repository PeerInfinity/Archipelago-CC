/**
 * ⛓ RETURN TO MENU IN THE RULES (⚖ the user, 2026-10-05: *"I don't want to add new edges that lead to menu. I want
 * the logic to be aware that returning to the menu at any point is always possible."*) — the logic half of
 * `seedlingRestartWarp.test.js`.
 *
 * The Menu panel's Restart moves the AP player to `Menu`, `GameStart` leads on to the start region, and on Seedling
 * the binding warps the game to `seedlingStartSpawn`. So a slot that realises a Seedling room declares
 * `exporter[p].return_to_menu: true` (`procgenCore/restartWarp.js`, from the substrate's registry declaration) and
 * carries NO exit into `Menu`; and the region `GameStart` leads to must be the one the warp actually lands in.
 *
 * Every row reads the COMMITTED presets, so a producer that stops writing the flag, adds an edge, or lets the
 * start drift away from the spawn reds here.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { seedlingStartSpawn } from './seedlingRegionBinding.js';
import { returnSpawnTable } from './seedlingReturnSpawns.js';
import { mapDocumentPath } from './mapDocumentPath.js';
import { substrateRegistryEntry as seedlingEntry, FLASH_SEEDLING_SUBSTRATE_ID } from './flashSeedlingLibrary.js';
import { substrateRegistryEntry as seedlingGenEntry, FLASH_SEEDLING_GEN_SUBSTRATE_ID } from './flashSeedlingGenLibrary.js';
import { RESTART_WARP, declareReturnToMenu, returnToMenu } from '../procgenCore/restartWarp.js';

const FRONTEND = fileURLToPath(new URL('../../', import.meta.url));
const PRESETS = `${FRONTEND}presets/`;
const OURS = new Map([[FLASH_SEEDLING_SUBSTRATE_ID, seedlingEntry], [FLASH_SEEDLING_GEN_SUBSTRATE_ID, seedlingGenEntry]]);
const rulesOf = (preset) => JSON.parse(readFileSync(`${PRESETS}${preset}/AP_1/AP_1_rules.json`, 'utf8'));
const PARTITION = JSON.parse(readFileSync(`${FRONTEND}modules/flashPanel/atlases/seedling-subregion-partition.json`, 'utf8'));

const SEEDLING_PRESETS = readdirSync(PRESETS)
    .filter((d) => d.startsWith('seedling') && existsSync(`${PRESETS}${d}/AP_1/AP_1_rules.json`)).sort();
const substratesOf = (rules) => new Set(Object.values(rules.preset_sidecars?.['1'] ?? {}).map((s) => s.substrate));
const realisesOurs = (rules) => [...substratesOf(rules)].some((s) => OURS.has(s));

describe('the declaration', () => {
    it('both Seedling substrates declare the warp, and it targets Menu', () => {
        for (const entry of OURS.values()) expect(entry.restartWarp).toBe(RESTART_WARP);
        expect(RESTART_WARP.target).toBe('Menu');
    });

    it('declareReturnToMenu writes ONE key into exporter[p], keeping the others; absent reads false', () => {
        const rules = { exporter: { 1: { assume_bidirectional_exits: false } } };
        expect(returnToMenu(rules)).toBe(false);
        declareReturnToMenu(rules);
        expect(rules.exporter).toEqual({ 1: { assume_bidirectional_exits: false, return_to_menu: true } });
        expect(returnToMenu(rules, '1')).toBe(true);
        expect(returnToMenu(rules, '2')).toBe(false);
        expect(returnToMenu({})).toBe(false);
    });
});

describe('every committed Seedling preset — DERIVED from the presets', () => {
    it('a preset that realises a Seedling room declares return_to_menu; one that realises none does not', () => {
        const census = Object.fromEntries(SEEDLING_PRESETS.map((p) => {
            const rules = rulesOf(p);
            expect(returnToMenu(rules), p).toBe(realisesOurs(rules));
            return [p, returnToMenu(rules)];
        }));
        // ⛓ the two that realise no Seedling room are the maze PROJECTIONS of the starter atlas: the maze
        //   substrate declares no warp, so they keep real soft-lock detection (the rule, not an exception list).
        expect(Object.entries(census).filter(([, v]) => !v).map(([p]) => p))
            .toEqual(['seedling_atlas_maze', 'seedling_atlas_sphere']);
    });

    it('⛔ and NO preset carries an exit into Menu — the flag is not an edge', () => {
        for (const p of SEEDLING_PRESETS) {
            const regions = rulesOf(p).regions['1'];
            const into = Object.entries(regions).flatMap(([n, r]) => r.exits
                .filter((e) => e.connected_region === 'Menu').map((e) => `${n}: ${e.name}`));
            expect(into, p).toEqual([]);
        }
    });
});

/**
 * Is (level, x, y) inside the AP region the sidecar binds? A whole room when it has no sub-region; otherwise by
 * the partition. ⚠ A game landing may stand on a tile the analyzer does not walk (the starter house's door step is
 * inside the building's footprint): such a landing belongs to the component(s) at the NEAREST ring around it — the
 * way the analyzer binds an exit whose tile is not walkable — and that set must be exactly the bound sub-region.
 */
function spawnInRegion(payload, spawn) {
    if (spawn.level !== payload.level) return `level ${spawn.level} is not the region's level ${payload.level}`;
    if (!payload.atlas_ref || !payload.atlas_sub_region) return true;
    const part = PARTITION.atlases[payload.atlas_ref]?.regions?.[payload.atlas_region];
    if (!part) return `no partition for ${payload.atlas_ref}/${payload.atlas_region}`;
    const tx = Math.floor(spawn.x / PARTITION.atlases[payload.atlas_ref].tile_size) - part.origin[0];
    const ty = Math.floor(spawn.y / PARTITION.atlases[payload.atlas_ref].tile_size) - part.origin[1];
    const subAt = (x, y) => part.sub_regions[PARTITION.alphabet.indexOf(part.rows[y]?.[x])];
    let found = subAt(tx, ty) ? new Set([subAt(tx, ty)]) : new Set();
    for (let r = 1; found.size === 0 && r <= 3; r += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
            const dy = r - Math.abs(dx);
            for (const y of new Set([ty + dy, ty - dy])) if (subAt(tx + dx, y)) found.add(subAt(tx + dx, y));
        }
    }
    const subs = [...found];
    return subs.length === 1 && subs[0] === payload.atlas_sub_region
        ? true : `tile (${tx},${ty}) resolves to [${subs}], not ${payload.atlas_sub_region}`;
}

describe('the Restart lands where GameStart leads', () => {
    const covered = SEEDLING_PRESETS.filter((p) => {
        const rules = rulesOf(p);
        const start = rules.regions['1'].Menu.exits.find((e) => e.name === 'GameStart')?.connected_region;
        return OURS.has(rules.preset_sidecars['1'][start]?.substrate);
    });

    it('the covered presets are the ones seedlingRestartWarp.test.js lists', () => {
        expect(covered).toEqual(['seedling_atlas', 'seedling_atlas_location', 'seedling_generated_host',
            'seedling_generated_room', 'seedling_playthrough', 'seedling_spiral_room']);
    });

    it.each(covered)('%s: the region Menu -> GameStart leads to contains seedlingStartSpawn', (p) => {
        const rules = rulesOf(p);
        const start = rules.regions['1'].Menu.exits.find((e) => e.name === 'GameStart').connected_region;
        const sidecar = rules.preset_sidecars['1'][start];
        const world = OURS.get(sidecar.substrate).deserializeWorld(sidecar.playable_payload);
        const mapPath = mapDocumentPath(rules)?.path;
        const returnSpawns = mapPath && existsSync(`${FRONTEND}${mapPath}`)
            ? returnSpawnTable(JSON.parse(readFileSync(`${FRONTEND}${mapPath}`, 'utf8'))) : null;
        const spawn = seedlingStartSpawn({ world, returnSpawns, set: sidecar.playable_payload.start ? { start: sidecar.playable_payload.start } : null });
        expect(spawn, `${p}: no start spawn`).not.toBeNull();
        expect(spawnInRegion(sidecar.playable_payload, spawn), `${p} ${start} @ ${JSON.stringify(spawn)}`).toBe(true);
    });
});
