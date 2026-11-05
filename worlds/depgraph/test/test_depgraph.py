"""Tests for the depgraph world."""

import unittest


class TestSlotData(unittest.TestCase):
    """slot_data carries what the client needs to rebuild the rules.

    The frontend builds a DepGraph rules.json from slot_data plus the server's
    scouts when no preset matches the room. The entrance rules depend on
    entrance_rule_mode, and the options name the graph by its key, so slot_data
    must carry both.
    """

    def _slot_data(self, **options):
        from test.general import setup_multiworld
        from worlds.depgraph import DepGraphWorld

        multiworld = setup_multiworld(DepGraphWorld, ("generate_early",), 1, options)
        return multiworld.worlds[1].fill_slot_data()

    def test_entrance_rule_mode_in_slot_data(self):
        for mode in range(4):
            with self.subTest(mode=mode):
                self.assertEqual(self._slot_data(entrance_rule_mode=mode)["entrance_rule_mode"], mode)

    def test_graph_file_key_in_slot_data(self):
        for key in ("tech_tree", "recipe_chain"):
            with self.subTest(graph_file=key):
                self.assertEqual(self._slot_data(graph_file=key)["graph_file"], key)


class TestStartingNodeDeterminism(unittest.TestCase):
    """Randomized starting nodes must come from the world's own RNG.

    They used to come from Python's module-level `random`, so the result
    depended on how many draws other code (option rolling, other worlds) had
    made first. `self.random` is seeded from the multiworld seed alone, which
    makes the picks independent of OTHER players at a fixed slot. It does not
    make them equal across slot positions: each slot's RNG is seeded
    differently.
    """

    OPTIONS = {"graph_file": "coding_adventure", "starting_nodes": 30, "randomize_starting_nodes": True}

    def _starting(self, seed):
        from test.general import setup_multiworld
        from worlds.depgraph import DepGraphWorld

        multiworld = setup_multiworld(DepGraphWorld, ("generate_early",), seed, self.OPTIONS)
        return sorted(multiworld.worlds[1].starting_node_set)

    def test_independent_of_module_random_state(self):
        import random

        random.seed(1)
        first = self._starting(1)
        random.seed(2)
        for _ in range(100):
            random.random()
        second = self._starting(1)
        self.assertGreater(len(first), 1, "expected randomized starting nodes beyond node 1")
        self.assertEqual(first, second)

    def test_differs_across_seeds(self):
        self.assertNotEqual(self._starting(1), self._starting(2))
