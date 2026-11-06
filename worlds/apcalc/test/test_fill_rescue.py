"""The main-fill rescue (`fill_rescue.rescue_progression_fill`, run as `stage_fill_hook`).

About 1 seed in 300 at the default options raised "Fill.FillError: No more spots to place N
items. Remaining locations are invalid." in AP's main fill. The planner's 3,000-seed sweep
(2026-11-05) found 10, plus the CI one (unittests 42119604007,
test_explicit_indirect_conditions_spheres [APCalc], seed 18362835516291304360). A 600-seed
sweep in this slice found 3 more. Each seed fails deterministically, and its puzzle is
solvable (the generator's own placement solves it). AP's random-order fill puts unrelated
buttons in the 4 sphere-0 locations, and the button that opens sphere 1 is left with nowhere to go.
"""

import random
import unittest
from unittest import mock

from BaseClasses import CollectionState
from Fill import FillError, distribute_items_restrictive
from test.general import setup_solo_multiworld
from worlds.apcalc import APCalcWorld
import worlds.apcalc.fill_rescue as fill_rescue

FILL_ERROR_SEEDS = (
    18362835516291304360,  # the CI reproducer
    82542380763946640046, 83896275365218607583, 45416072798820848527, 71729739247432037389,
    45281522273745740411, 23295326200757545552, 19524175963470609477, 77722768139911614837,
    79385271898552713063, 70885945296175134304,
    6578381870870581910, 7488415712368931668, 1558430937347876976,
)

# random.Random('APCalc fill rescue <seed> 1').shuffle(range(10)) for the CI reproducer.
PINNED_ORDER = [7, 1, 4, 0, 2, 9, 3, 8, 6, 5]


def _no_rescue(cls, *args):
    """The behaviour before the rescue: World's default fill_hook does nothing."""


def _placements(multiworld):
    return sorted((loc.name, loc.item.name) for loc in multiworld.get_locations() if loc.address)


class TestFillRescue(unittest.TestCase):
    def test_every_seed_fails_without_the_rescue(self):
        # Pins that these seeds still exercise the rescue.
        with mock.patch.object(APCalcWorld, "stage_fill_hook", classmethod(_no_rescue)):
            for seed in FILL_ERROR_SEEDS:
                with self.subTest(seed=seed):
                    multiworld = setup_solo_multiworld(APCalcWorld, seed=seed)
                    with self.assertRaisesRegex(FillError, "No more spots to place"):
                        distribute_items_restrictive(multiworld)

    def test_every_seed_fills_and_is_beatable_with_the_rescue(self):
        for seed in FILL_ERROR_SEEDS:
            with self.subTest(seed=seed):
                multiworld = setup_solo_multiworld(APCalcWorld, seed=seed)
                distribute_items_restrictive(multiworld)
                self.assertFalse(multiworld.get_unfilled_locations())
                state = CollectionState(multiworld)
                state.sweep_for_advancements()
                self.assertTrue(multiworld.can_beat_game(state))
                self.assertTrue(all(loc.can_reach(state) for loc in multiworld.get_locations()))

    def test_a_seed_that_fills_is_unchanged(self):
        # The rescue only dry-runs (and undoes) the fill, consuming no multiworld.random,
        # so a seed that fills without it gets the same placements and RNG state.
        for seed in (1, 2, 3, 12345):
            with self.subTest(seed=seed):
                with mock.patch.object(APCalcWorld, "stage_fill_hook", classmethod(_no_rescue)):
                    before = setup_solo_multiworld(APCalcWorld, seed=seed)
                    distribute_items_restrictive(before)
                with mock.patch.object(fill_rescue, "_dry_run", wraps=fill_rescue._dry_run) as dry_run:
                    after = setup_solo_multiworld(APCalcWorld, seed=seed)
                    distribute_items_restrictive(after)
                self.assertEqual(dry_run.call_count, 1)  # one dry run, no re-order
                self.assertEqual(_placements(after), _placements(before))
                self.assertEqual(after.random.getstate(), before.random.getstate())

    def test_the_dry_run_leaves_no_placement(self):
        multiworld = setup_solo_multiworld(APCalcWorld, seed=FILL_ERROR_SEEDS[0])
        unfilled = multiworld.get_unfilled_locations()
        pool = [item for item in multiworld.itempool if item.advancement]
        rng_state = multiworld.random.getstate()
        fill_rescue._dry_run(multiworld, unfilled, pool)
        self.assertEqual(multiworld.get_unfilled_locations(), unfilled)
        self.assertTrue(all(item.location is None for item in pool))
        self.assertEqual(multiworld.random.getstate(), rng_state)

    def test_the_reorder_seed_is_stable(self):
        # A string seed is hashed (random version 2), so the re-order is the same on every
        # platform and Python version.
        order = list(range(10))
        random.Random(f"APCalc fill rescue {FILL_ERROR_SEEDS[0]} 1").shuffle(order)
        self.assertEqual(order, PINNED_ORDER)

if __name__ == "__main__":
    unittest.main()
