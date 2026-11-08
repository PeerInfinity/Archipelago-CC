"""The generator's whole-generation retry (`generator.generate`).

About 1 seed in 2,500 at the default options dead-ends in sphere 6 with "Failed to
generate chain for sphere 6 after 500 attempts" (a 40,000-seed sweep, 2026-11-02:
16 failures, every one with '/': 3 and a single '+', '-' and '*' in its inventory,
i.e. spheres 4 and 5 both awarded '/'). It reached CI as test_item_links [APCalc]
(unittests 41539495088). Such a seed is now generated again from a derived seed.
"""

import random
import unittest

from worlds.apcalc.generator.generator import (
    APCalcConfig, ChainGenerationError, GENERATION_ATTEMPTS, _generate_attempt, generate, retry_seed,
)

# The sweep's 16 failing seeds; the first is the CI reproducer.
DEAD_END_SEEDS = (
    1778134097861364618, 10642287175232656086, 10311201238676538603, 6892731456702427746,
    12454130218472470552, 6851013433327092087, 452832303526493646, 4111619759555882254,
    10696204592910231099, 5823404737797241348, 13163040441333762580, 5550055592690126593,
    1245936519094260768, 4376683064277789762, 12907050723491287573, 5458312161249322107,
)


class TestGeneratorRetry(unittest.TestCase):
    def test_reproducer_dead_ends_on_its_own_seed(self):
        # Pins that the reproducer still exercises the retry: one attempt alone fails.
        seed = DEAD_END_SEEDS[0]
        with self.assertRaisesRegex(ChainGenerationError, "Failed to generate chain for sphere 6"):
            _generate_attempt(APCalcConfig(seed=seed), random.Random(seed), lambda _: None)

    def test_reproducer_succeeds_on_a_retry(self):
        result = generate(APCalcConfig(seed=DEAD_END_SEEDS[0]))
        self.assertEqual(result['generation_attempt'], 1)
        self.assertEqual(result['config'].seed, DEAD_END_SEEDS[0])
        self.assertTrue(any(f"Retry 1/{GENERATION_ATTEMPTS - 1}: seed {retry_seed(DEAD_END_SEEDS[0], 1)}" in line
                            for line in result['log_entries']))

    def test_every_sweep_failure_now_generates(self):
        for seed in DEAD_END_SEEDS:
            with self.subTest(seed=seed):
                self.assertGreaterEqual(generate(APCalcConfig(seed=seed))['generation_attempt'], 1)

    def test_a_seed_that_succeeds_is_not_retried(self):
        # Attempt 0 is the seed itself, so the puzzle is the one the seed always gave
        # (the committed presets, seeds 1-3, regenerate byte-identical).
        self.assertEqual(retry_seed(12345, 0), 12345)
        for seed in (1, 2, 3):
            with self.subTest(seed=seed):
                result = generate(APCalcConfig(seed=seed))
                self.assertEqual(result['generation_attempt'], 0)
                bare = _generate_attempt(APCalcConfig(seed=seed), random.Random(seed), lambda _: None)
                self.assertEqual(result['nodes'], bare['nodes'])
                self.assertEqual(result['edges'], bare['edges'])

    def test_the_ap_world_generates_the_reproducer(self):
        from test.general import setup_multiworld
        from worlds.apcalc import APCalcWorld

        multiworld = setup_multiworld(APCalcWorld, ("generate_early",), DEAD_END_SEEDS[0])
        self.assertEqual(multiworld.seed, DEAD_END_SEEDS[0])
        self.assertTrue(multiworld.worlds[1].generated_nodes)


if __name__ == '__main__':
    unittest.main()
