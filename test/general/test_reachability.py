import unittest

from BaseClasses import CollectionState
from worlds.AutoWorld import AutoWorldRegister
from . import setup_solo_multiworld, gen_steps


class TestBase(unittest.TestCase):
    gen_steps = gen_steps

    default_settings_unreachable_regions = {
        "A Link to the Past": {
            "Chris Houlihan Room",  # glitch room by definition
            "Desert Northern Cliffs",  # on top of mountain, only reachable via OWG
            "Dark Death Mountain Bunny Descent Area"  # OWG Mountain descent
        },
        # These Blasphemous regions are not reachable with default options
        "Blasphemous": {
            "D01Z04S13[SE]", # difficulty must be hard
            "D01Z05S25[E]", # difficulty must be hard
            "D02Z02S05[W]", # difficulty must be hard and purified_hand must be true
            "D04Z01S06[E]", # purified_hand must be true
            "D04Z02S02[NE]", # difficulty must be hard and purified_hand must be true
            "D05Z01S11[SW]", # difficulty must be hard
            "D06Z01S08[N]", # difficulty must be hard and purified_hand must be true
            "D20Z02S11[NW]", # difficulty must be hard
            "D20Z02S11[E]", # difficulty must be hard
        },
        "Ocarina of Time": {
            "Prelude of Light Warp",  # Prelude is not progression by default
            "Serenade of Water Warp",  # Serenade is not progression by default
            "Lost Woods Mushroom Timeout",  # trade quest starts after this item
            "ZD Eyeball Frog Timeout",  # trade quest starts after this item
            "ZR Top of Waterfall",  # dummy region used for entrance shuffle
        },
        # The following SM regions are only used when the corresponding StartLocation option is selected (so not with
        # default settings). Also, those don't have any entrances as they serve as starting Region (that's why they
        # have to be excluded for testAllStateCanReachEverything).
        "Super Metroid": {
            "Ceres",
            "Gauntlet Top",
            "Mama Turtle"
        },
        "shapez": {
            "Achievements needing a MAM",  # unreachable with default settings
        },
        # Seedling's map has rooms the game itself never lets the player walk into. They hold no
        # locations, and their exits are one-way OUT, so the transcription records them faithfully
        # rather than dropping them. See docs/json/developer/procgen/seedling-bot.md.
        "Seedling Playthrough": {
            # L58 is Dungeon5_DeadBoss: entered only by the boss-death level swap, which is not an
            # edge a player can traverse. The seven rooms form a closed clique with one exit to L46.
            "level_58__r1c2",
            "level_58__r1c4",
            "level_58__r2c1",
            "level_58__r2c5",
            "level_58__r3c3",
            "level_58__r4c1",
            "level_58__r6c5",
            # TODO(R8): L82 is NOT settled. R1's fall table verifies `71 ⇓ 82` (pit (12,13) ->
            # arrival (10,17)) and the R1 bot walked it, but rules v1 emits no entrance at all --
            # unlike `83 ⇓ 84`, the next row of the same table, which is emitted. Under armed lava
            # the pit's L71 component is unreachable, so this may be a deliberate drop; if not, the
            # edge is missing from the transcription and this line should be removed.
            "level_82",
            # L84 is a pass-through: the 83 -> 84 fall lands on pit with no walkable neighbour, so
            # only the arrival room r2c4 is entered. These two components have no inbound edge.
            "level_84__r0c0",
            "level_84__r3c0",
        },
    }

    def test_default_all_state_can_reach_everything(self):
        """Ensure all state can reach everything and complete the game with the defined options"""
        for game_name, world_type in AutoWorldRegister.world_types.items():
            unreachable_regions = self.default_settings_unreachable_regions.get(game_name, set())
            # Apply unreachable regions from base game to WorldGen variants
            for base_name, base_regions in self.default_settings_unreachable_regions.items():
                if game_name.startswith(base_name) and game_name != base_name:
                    unreachable_regions = unreachable_regions | base_regions
            with self.subTest("Game", game=game_name):
                multiworld = setup_solo_multiworld(world_type)
                state = multiworld.get_all_state(False)
                for location in multiworld.get_locations():
                    with self.subTest("Location should be reached", location=location.name):
                        self.assertTrue(location.can_reach(state), f"{location.name} unreachable")

                for region in multiworld.get_regions():
                    if region.name in unreachable_regions:
                        with self.subTest("Region should be unreachable", region=region.name):
                            self.assertFalse(region.can_reach(state))
                    else:
                        with self.subTest("Region should be reached", region=region.name):
                            self.assertTrue(region.can_reach(state))

                with self.subTest("Completion Condition"):
                    self.assertTrue(multiworld.can_beat_game(state))

    def test_default_empty_state_can_reach_something(self):
        """Ensure empty state can reach at least one location with the defined options"""
        for game_name, world_type in AutoWorldRegister.world_types.items():
            with self.subTest("Game", game=game_name):
                multiworld = setup_solo_multiworld(world_type)
                state = CollectionState(multiworld)
                all_locations = multiworld.get_locations()
                if all_locations:
                    locations = set()
                    for location in all_locations:
                        if location.can_reach(state):
                            locations.add(location)
                    self.assertGreater(len(locations), 0,
                                       msg="Need to be able to reach at least one location to get started.")
