"""Tests for the APCalc world."""

import unittest
from collections import Counter


class TestSlotData(unittest.TestCase):
    """slot_data carries what the client needs to rebuild the rules.

    The frontend builds an APCalc rules.json from slot_data plus the server's
    scouts when no preset matches the room. Each entrance rule is built from
    its edges' path_costs, which are full paths from Start: the generator adds
    the edge's own buttons to one of the source node's paths, chosen by its
    RNG, so they cannot be derived from the operation and operand.
    """

    def _world(self, **options):
        from test.general import setup_multiworld
        from worlds.apcalc import APCalcWorld

        multiworld = setup_multiworld(APCalcWorld, ("generate_early",), 1, options)
        return multiworld.worlds[1]

    def test_edges_carry_path_costs_and_sphere(self):
        world = self._world()
        edges = world.fill_slot_data()["edges"]
        self.assertEqual(len(edges), len(world.generated_edges))
        for sent, edge in zip(edges, world.generated_edges):
            self.assertEqual(sent["sphere"], edge.sphere)
            self.assertEqual([Counter(pc) for pc in sent["path_costs"]], edge.path_costs)

    def test_path_costs_are_not_derivable_from_the_operand(self):
        # Pins WHY path_costs is sent: some edge leaves a node with several
        # paths, so its cost depends on which one the generator picked.
        world = self._world(num_spheres=8)
        multi_path = [e for e in world.generated_edges
                      if e.source_index is not None
                      and len(world.generated_nodes[e.source_index].path_costs) > 1]
        self.assertTrue(multi_path)

    def test_generation_options_in_slot_data(self):
        slot_data = self._world(ops_per_sphere=2, nums_per_sphere=3, trash_per_sphere=0,
                                max_branches=7, randomize_items=False).fill_slot_data()
        self.assertEqual(
            {k: slot_data[k] for k in ("ops_per_sphere", "nums_per_sphere", "trash_per_sphere",
                                        "max_branches", "randomize_items")},
            {"ops_per_sphere": 2, "nums_per_sphere": 3, "trash_per_sphere": 0,
             "max_branches": 7, "randomize_items": False})


class TestVictoryLocation(unittest.TestCase):
    """The goal is an ID-bearing Victory location holding the ID-bearing Victory item,
    locked on every seed (sdc-goal-apcalc; the shape world_generator/_victory_location.py
    gives a generated world), and slot_data declares that the client may report it."""

    def _world(self, **options):
        from test.general import setup_multiworld
        from worlds.apcalc import APCalcWorld

        multiworld = setup_multiworld(APCalcWorld, ("generate_early", "create_regions", "create_items",
                                                    "set_rules", "generate_basic"), 1, options)
        return multiworld, multiworld.worlds[1]

    def test_victory_has_ids_and_is_locked(self):
        from worlds.apcalc.Items import BASE_ITEM_ID, item_table
        from worlds.apcalc.Locations import BASE_LOCATION_ID, MAX_LOCATIONS, location_name_to_id
        for randomize in (True, False):
            multiworld, world = self._world(randomize_items=randomize)
            loc = multiworld.get_location("Victory", 1)
            self.assertEqual(loc.address, BASE_LOCATION_ID + MAX_LOCATIONS + 1)
            self.assertEqual(loc.address, location_name_to_id["Victory"])
            self.assertTrue(loc.locked)
            self.assertEqual(loc.item.name, "Victory")
            self.assertEqual(loc.item.code, BASE_ITEM_ID + 15)
            self.assertEqual(item_table["Victory"].id, loc.item.code)
            self.assertNotIn("Victory", [i.name for i in multiworld.itempool])

    def test_ids_are_unique_and_in_range(self):
        from worlds.apcalc.Items import item_name_to_id
        from worlds.apcalc.Locations import location_name_to_id
        self.assertEqual(len(set(item_name_to_id.values())), len(item_name_to_id))
        self.assertEqual(len(set(location_name_to_id.values())), len(location_name_to_id))
        self.assertLess(max(item_name_to_id.values()), min(location_name_to_id.values()))

    def test_completion_needs_items(self):
        from BaseClasses import CollectionState
        multiworld, world = self._world()
        self.assertFalse(multiworld.completion_condition[1](CollectionState(multiworld)))

    def test_slot_data_declares_the_goal_report(self):
        _, world = self._world()
        self.assertIs(world.fill_slot_data()["reports_goal_by_server_item"], True)
