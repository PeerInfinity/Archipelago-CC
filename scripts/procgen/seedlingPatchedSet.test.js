/**
 * ⛓ RULES patched-set — the playthrough reads the DELIVERED (patched) set, the starter atlas reads the extract
 * VANILLA, and a fall whose descent fires a live door exits to the chain's END.
 *
 * ⚖ The user (2026-10-05): ship ONLY the moonrock removal (`SEEDLING_SET_PATCHES`), no L110 repoint. Only
 * `seedling_playthrough` RECEIVES the delivered set, so only its readers switch; the starter atlas (and the atlas
 * arms) run the built-in map, Moonrock included.
 *
 * The rows drive the PRODUCERS (a fresh partition build, a fresh derivation), not the committed files, so a
 * reader that swaps its input reds here before any `--check` is re-run.
 */
import { describe, expect, it } from 'vitest';

import { buildSubRegionPartition, PARTITION_ALPHABET } from './make-seedling-subregion-partition.mjs';
import { derivePlaythroughLayer, PLAYTHROUGH_MAP, VANILLA_MAP, pitChains } from './make-seedling-playthrough-rules.mjs';
import { pitChainsFromCensus } from './seedlingPitChains.js';

const L0 = (doc) => doc.levels.find((l) => l.level === 0);
const hasMoonrock = (doc) => L0(doc).entities.some((e) => e.type === 'moonrock');
/** The Moonrock's footprint in L0 (240,256 → tiles 15..17 × 16..18), the stairs tile (16,17) under it. */
const ROCK_TILES = [15, 16, 17].flatMap((x) => [16, 17, 18].map((y) => [x, y]));

describe('the playthrough reads the PATCHED set, the starter atlas reads VANILLA', () => {
    it('the generator\'s map document is the extract with the moonrock removed', () => {
        expect(hasMoonrock(VANILLA_MAP)).toBe(true);
        expect(hasMoonrock(PLAYTHROUGH_MAP)).toBe(false);
    });

    it('a fresh partition: the rock\'s footprint is r8c0 in the playthrough and NO sub-region in the starter atlas', async () => {
        const { doc } = await buildSubRegionPartition();
        const entryOf = (file, region) => Object.values(doc.atlases).find((a) => a.atlas === file).regions[region];
        const subAt = (e, [x, y]) => {
            const ch = e.rows[y - e.origin[1]][x - e.origin[0]];
            return ch === '.' ? null : e.sub_regions[PARTITION_ALPHABET.indexOf(ch)];
        };
        const playthrough = entryOf('seedling-playthrough.json', 'level_0');
        const starter = entryOf('seedling.json', 'overworld_start');
        expect(ROCK_TILES.map((t) => subAt(playthrough, t))).toEqual(ROCK_TILES.map(() => 'r8c0'));
        expect(ROCK_TILES.map((t) => subAt(starter, t))).toEqual(ROCK_TILES.map(() => null));
    }, 120_000);
});

describe('a chained fall exits to the chain\'s END (fidelity DESCENT\'s census, no hand row)', () => {
    it('L110\'s pit connects to level_2 (3,2), and no arrival of it is left in L0', () => {
        const { atlas } = derivePlaythroughLayer();
        const from110 = atlas.vanilla_layout.connections.filter((c) => c.from[0] === 'level_110'
            && c.from[1].startsWith('out_pit_'));
        expect(from110).toEqual([{ from: ['level_110', 'out_pit_3_2'], to: ['level_2', 'in_pit_L110_3_2'], one_way: true }]);
        const l2 = atlas.regions.find((r) => r.region_id === 'level_2');
        expect(l2.exits.find((e) => e.exit_id === 'in_pit_L110_3_2').exit_tiles).toEqual([[3, 2]]);
        const l0 = atlas.regions.find((r) => r.region_id === 'level_0');
        expect(l0.exits.filter((e) => e.exit_id.startsWith('in_pit_L110'))).toEqual([]);
        expect(pitChains.map((c) => [c.from, c.via, c.landing.level, c.ends])).toEqual([
            [110, 'stairs@256,272', 0, { level: 2, tile: [3, 2] }],
        ]);
    }, 120_000);

    const row = (over = {}) => ({ from: 7, pit: { x: 16, y: 16 }, to: 8, ctor: { x: 0, y: 0 }, latched: [],
        fires: { t: 30, door: 'stairs@0,0', to: 9, arrival: { x: 40, y: 56 } }, deactivated: [], ...over });
    const room = { level: 7 };
    const group = { to: 8, arrival: [0, 0], tiles: [[1, 1]] };

    it('a fired door → its target and its arrival TILE; an unchained pit → null (the landing stands)', () => {
        const { pitOutcome, chains } = pitChainsFromCensus({ rows: [row()] }, { tileSize: 16, standable: () => true });
        expect(pitOutcome(room, group)).toEqual({ to: 9, arrival: [2, 3] });
        expect(chains).toHaveLength(1);
        expect(pitOutcome(room, { ...group, tiles: [[5, 5]] })).toBeNull();
        // A row that only LATCHES or names a DEACTIVATED door does not chain.
        const quiet = pitChainsFromCensus({ rows: [row({ fires: null, deactivated: [{ door: 'teleporter@0,0' }] })] },
            { tileSize: 16, standable: () => true });
        expect(quiet.pitOutcome(room, group)).toBeNull();
    });

    it('refuses BY NAME: an unstandable end, ctors that disagree, a group that mixes chained and unchained tiles', () => {
        const wall = pitChainsFromCensus({ rows: [row()] }, { tileSize: 16, standable: () => 'a wall' });
        expect(() => wall.pitOutcome(room, group)).toThrow(/L7's pit chains through L8's stairs@0,0 to L9 \[2,3\], which is not a place to stand — a wall/);
        expect(() => pitChainsFromCensus({ rows: [row(), row({ fires: null })] }, { tileSize: 16, standable: () => true }))
            .toThrow(/L7's pit at \(16,16\) has ctors that disagree/);
        const mixed = pitChainsFromCensus({ rows: [row()] }, { tileSize: 16, standable: () => true });
        expect(() => mixed.pitOutcome(room, { ...group, tiles: [[1, 1], [2, 1]] })).toThrow(/mixes chained and unchained tiles/);
    });
});
