/**
 * The hand-built entrance-randomization fixture (ENTRANCE RANDOMIZATION E2): two regions, a COUPLED stairs
 * pair and one ONE-WAY pit, plus the slot's block — the smallest rules.json carrying every field
 * `rules.schema.json`'s `$defs/exitEntranceRandomization` and `entrance_randomization` declare.
 *
 * A function, so each caller gets a fresh copy to break. ⛔ Not a preset and not a `*_rules.json` file: no
 * producer writes this data yet, and a committed preset would enrol in the derived rosters.
 */

export const ER_FIXTURE_NAMES = Object.freeze({
    up: 'Upstairs',
    down: 'Downstairs',
    stairsDown: 'Upstairs -> Downstairs (stairs)',
    stairsUp: 'Downstairs -> Upstairs (stairs)',
    pit: 'Upstairs -> Downstairs (pit)',
    chest: 'Downstairs Chest',
});

export function erFixtureRules() {
    const N = ER_FIXTURE_NAMES;
    const T = () => ({ type: 'constant', value: true });
    return {
        schema_version: 3,
        game_name: 'ER Fixture',
        archipelago_version: '0.6.0',
        generation_seed: 1,
        player_names: { 1: 'Player1' },
        regions: {
            1: {
                [N.up]: {
                    name: N.up,
                    locations: [],
                    exits: [
                        {
                            name: N.stairsDown, connected_region: N.down, access_rule: T(),
                            er: { group: 'stairs_down', type: 'two_way', reverse: N.stairsUp, shuffle: true },
                        },
                        {
                            name: N.pit, connected_region: N.down, access_rule: T(),
                            er: { group: 'pit', type: 'one_way', shuffle: false },
                        },
                    ],
                },
                [N.down]: {
                    name: N.down,
                    locations: [{ name: N.chest, id: 1, access_rule: T(), item: { name: 'Gem', player: 1, advancement: true, type: null } }],
                    exits: [
                        {
                            name: N.stairsUp, connected_region: N.up, access_rule: T(),
                            er: { group: 'stairs_up', type: 'two_way', reverse: N.stairsDown, shuffle: true },
                        },
                    ],
                },
            },
        },
        start_regions: { 1: { default: [N.up], available: [] } },
        items: { 1: { Gem: { name: 'Gem', id: 1, groups: [], classification: 'progression', event: false, type: null, max_count: 1 } } },
        item_groups: { 1: [] },
        itempool_counts: { 1: { Gem: 1 } },
        world: { 1: { game: 'ER Fixture', options: {} } },
        game_info: { 1: { name: 'ER Fixture', rule_format: { version: '1.0' } } },
        entrance_randomization: {
            1: {
                algorithm: 'ger',
                coupled: true,
                target_group_lookup: { stairs_down: ['stairs_up'], stairs_up: ['stairs_down'] },
                seed: 12345,
                source: { atlas_id: 'er-fixture' },
                // ⚖ E4b COUPLED-MIRROR: a coupled placement carries its mirror row.
                placements: [{ exit: N.stairsDown, target: N.stairsUp }, { exit: N.stairsUp, target: N.stairsDown }],
            },
        },
    };
}
