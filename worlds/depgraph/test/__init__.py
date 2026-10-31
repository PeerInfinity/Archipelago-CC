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
