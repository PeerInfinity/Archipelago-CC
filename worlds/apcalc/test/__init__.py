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
