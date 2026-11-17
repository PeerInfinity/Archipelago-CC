"""The hand-written Baking, Coding and JtA worlds finish through an ID-bearing Victory location
(sdc-goal-handwritten, 2026-11-15; slice 1 did the same for APCalc in worlds/apcalc/test).

For each world, on a default and a vanilla seed:
- the goal location has an ID and holds the ID-bearing Victory item, locked, not an event;
- Victory is never in the item pool;
- the completion condition is false with no items;
- slot_data declares ``reports_goal_by_server_item: True`` (read by goalCheck.reportsGoalByServerItem);
- Baking and Coding keep the IDs their WorldGen twins allocated, so rooms of either agree.
"""

import unittest

from BaseClasses import CollectionState
from test.general import setup_multiworld

STEPS = ("generate_early", "create_regions", "create_items", "set_rules", "generate_basic", "pre_fill")


def _baking():
    from worlds.bakingadventure import BakingAdventureWorld
    return BakingAdventureWorld, "Cool on Wire Rack", 300000016, 300100016


def _coding():
    from worlds.codingadventure import CodingAdventureWorld
    return CodingAdventureWorld, "Production Deployment", 400000062, 400100052


def _jta():
    from worlds.jta import JTAWorld
    from worlds.jta.Items import BASE_ITEM_ID
    from worlds.jta.Locations import BASE_LOCATION_ID
    # max+1 of each static range (590100..590140 locations, 590000..590055 items)
    return JTAWorld, "Reach Goal Zone", BASE_LOCATION_ID + 41, BASE_ITEM_ID + 56


WORLDS = {"baking": _baking, "coding": _coding, "jta": _jta}


class TestHandwrittenVictoryLocation(unittest.TestCase):

    def _check(self, key, vanilla):
        cls, loc_name, loc_id, item_id = WORLDS[key]()
        multiworld = setup_multiworld(cls, STEPS, 1, {"vanilla_placement": vanilla})
        world = multiworld.worlds[1]
        loc = multiworld.get_location(loc_name, 1)
        self.assertEqual(loc.address, loc_id)
        self.assertEqual(cls.location_name_to_id[loc_name], loc_id)
        self.assertTrue(loc.locked)
        self.assertFalse(getattr(loc, "event", False) and loc.address is None)
        self.assertEqual(loc.item.name, "Victory")
        self.assertEqual(loc.item.code, item_id)
        self.assertEqual(cls.item_name_to_id["Victory"], item_id)
        self.assertNotIn("Victory", [i.name for i in multiworld.itempool])
        self.assertFalse(multiworld.completion_condition[1](CollectionState(multiworld)))
        self.assertIs(world.fill_slot_data().get("reports_goal_by_server_item"), True)
        # IDs stay unique within the world
        self.assertEqual(len(set(cls.location_name_to_id.values())), len(cls.location_name_to_id))
        self.assertEqual(len(set(cls.item_name_to_id.values())), len(cls.item_name_to_id))

    def test_baking(self):
        for vanilla in (False, True):
            with self.subTest(vanilla=vanilla):
                self._check("baking", vanilla)

    def test_coding(self):
        for vanilla in (False, True):
            with self.subTest(vanilla=vanilla):
                self._check("coding", vanilla)

    def test_jta(self):
        for vanilla in (False, True):
            with self.subTest(vanilla=vanilla):
                self._check("jta", vanilla)


if __name__ == "__main__":
    unittest.main()
