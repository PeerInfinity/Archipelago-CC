"""JS <-> Python parity of the two APCalc generators.

The user keeps both (ruling 2026-10-31, option C): `worlds/apcalc/generator/generator.py`
(the AP world's) and `frontend/modules/apcalcGenerator/apcalcGeneratorEngine.js` (the
browser's, a line-for-line port). This test makes drift between them red: it runs the JS
engine under `node` (`scripts/test/apcalc-js-generate.mjs`) and the Python generator with
the JS engine's RNG (`Mulberry32`, a twin of `frontend/modules/shared/rng.js`), and the
two must give the same nodes, edges, path costs, starting buttons and retry count.

What is covered: the options the two share, i.e. every APCalcConfig field (num_spheres,
ops_per_sphere, nums_per_sphere, trash_per_sphere, max_branches, reuse_attempts, seed),
plus the whole-generation retry (seed 4821 dead-ends at the defaults under mulberry32).
Not covered, because only one side has it: Python's `randomize_items` (an AP option
applied after generation, `worlds/apcalc/__init__.py`), the JS panel's wider ranges
(numSpheres 2-20, opsPerSphere up to 5, trashPerSphere up to 10, maxBranches from 1),
the RNG itself (the AP world uses random.Random; MT vs mulberry32 is the one intended
difference), and the two exporters (`export.py` vs `exportRulesJson`), which differ by
design (see NewDocs/plans/server-data/apcalc-generators-comparison.md section 1).

JS numbers are doubles: past 2^53 the JS puzzle stops being exact and the two diverge.
The configs below stay far under it (measured, 2026-11-04: the largest value is about
2^45); `test_values_stay_exact_in_js` asserts it, so a config change that crosses 2^53
fails by name instead of as an unexplained mismatch.

This is also the place that notices the generator's OUTPUT changed: `PINNED` holds a
digest of every puzzle generated here, keyed by the JS engine's APCALC_GENERATOR_VERSION
(hashed into each browser puzzle's name, `puzzleIdentity`). Output moves -> bump the
version in apcalcGeneratorEngine.js and re-pin the digest (the failure message prints it).
"""

import hashlib
import json
import os
import shutil
import subprocess
import unittest

from worlds.apcalc.generator.generator import APCalcConfig, generate
from worlds.apcalc.generator.mulberry32 import Mulberry32

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DRIVER = os.path.join(REPO, 'scripts', 'test', 'apcalc-js-generate.mjs')

# (num_spheres, ops_per_sphere, nums_per_sphere, trash_per_sphere, max_branches, reuse_attempts)
SHAPES = (
    (8, 1, 2, 1, 5, 0),     # the AP world's defaults (also the panel's, bar the seed)
    (3, 2, 2, 1, 2, 0),
    (5, 2, 3, 0, 3, 0),
    (6, 3, 1, 2, 10, 2),    # an explicit reuse_attempts
    (15, 1, 1, 0, 2, 0),    # the AP world's max num_spheres
)
SEEDS = (1, 2, 3, 4, 5, 6)
# Seeds that dead-end on their own seed under mulberry32 (default shape), so the retry
# path is compared too. Found by a sweep of seeds 1-6000.
RETRY_SEEDS = (4821, 5325)

PINNED = {
    'version': 1,
    'digest': 'bffe4aa9196542e2e8b507ea0ac2626a2bd0e8ebb767162c1443006f782d4869',
}

SAFE = 2 ** 53 - 1


def _cases():
    cases = [(shape, seed) for shape in SHAPES for seed in SEEDS]
    cases += [(SHAPES[0], seed) for seed in RETRY_SEEDS]
    return cases


def _config(shape, seed):
    return APCalcConfig(num_spheres=shape[0], ops_per_sphere=shape[1], nums_per_sphere=shape[2],
                        trash_per_sphere=shape[3], max_branches=shape[4], reuse_attempts=shape[5], seed=seed)


def _js_config(c: APCalcConfig):
    return {'seed': c.seed, 'numSpheres': c.num_spheres, 'opsPerSphere': c.ops_per_sphere,
            'numsPerSphere': c.nums_per_sphere, 'trashPerSphere': c.trash_per_sphere,
            'maxBranches': c.max_branches, 'reuseAttempts': c.reuse_attempts}


def _cost(pc):
    return sorted([k, v] for k, v in pc.items() if v > 0)


def _python_puzzle(c: APCalcConfig):
    g = generate(c, rng_factory=Mulberry32)
    return {
        'nodes': [[n.index, n.value, n.layer, n.sphere, n.item, [_cost(p) for p in n.path_costs]]
                  for n in g['nodes']],
        'edges': [[e.index, e.source_index, e.target_index, e.operation, e.operand, list(e.operand_digits),
                   e.sphere, [_cost(p) for p in e.path_costs]] for e in g['edges']],
        'starting_buttons': _cost(g['starting_buttons']),
        'generation_attempt': g['generation_attempt'],
    }


def _node():
    node = shutil.which('node')
    if node is None and os.environ.get('CI'):
        raise AssertionError('node is not on PATH: the APCalc parity test needs it (GitHub runner images ship it)')
    return node


class TestGeneratorParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        node = _node()
        if node is None:
            raise unittest.SkipTest('node is not on PATH (CI fails instead of skipping)')
        cls.configs = [_config(shape, seed) for shape, seed in _cases()]
        proc = subprocess.run([node, DRIVER], input=json.dumps([_js_config(c) for c in cls.configs]),
                              capture_output=True, text=True, timeout=300, cwd=REPO)
        if proc.returncode != 0:
            raise AssertionError(f'{DRIVER} exited {proc.returncode}:\n{proc.stderr}')
        out = json.loads(proc.stdout)
        cls.js_version = out['version']
        cls.js = out['results']
        cls.py = [_python_puzzle(c) for c in cls.configs]

    def test_same_puzzle(self):
        self.assertEqual(len(self.js), len(self.configs))
        for c, js, py in zip(self.configs, self.js, self.py):
            with self.subTest(config=_js_config(c)):
                self.assertTrue(js['ok'], js.get('error'))
                puzzle = dict(js['puzzle'])
                puzzle.pop('unsafe')
                for key in ('starting_buttons', 'generation_attempt', 'nodes', 'edges'):
                    self.assertEqual(puzzle[key], py[key], f'{key} differ')

    def test_values_stay_exact_in_js(self):
        for c, js, py in zip(self.configs, self.js, self.py):
            with self.subTest(config=_js_config(c)):
                biggest = max(max(abs(n[1]) for n in py['nodes']),
                              max(abs(e[4]) for e in py['edges'] if e[4] is not None))
                self.assertLessEqual(biggest, SAFE, 'a value past 2^53: JS doubles are not exact there, '
                                                    'so this config cannot be compared; pick a smaller one')
                if js['ok']:
                    self.assertEqual(js['puzzle']['unsafe'], 0)

    def test_the_cases_are_not_trivial(self):
        # The comparison must cover real puzzles and the retry, not empty or uniform output.
        self.assertTrue(all(len(p['nodes']) >= 10 for p in self.py))
        self.assertTrue(all(p['generation_attempt'] >= 1 for p in self.py[-len(RETRY_SEEDS):]))
        self.assertEqual(len({json.dumps(p['nodes']) for p in self.py}), len(self.py))

    def test_output_is_pinned_to_the_generator_version(self):
        digest = hashlib.sha256(json.dumps(self.py, sort_keys=True).encode()).hexdigest()
        self.assertEqual(
            (self.js_version, digest), (PINNED['version'], PINNED['digest']),
            f'The APCalc generators\' output is {digest} at APCALC_GENERATOR_VERSION {self.js_version}, '
            f'pinned {PINNED["digest"]} at {PINNED["version"]}. If the output changed on purpose, bump '
            f'APCALC_GENERATOR_VERSION in frontend/modules/apcalcGenerator/apcalcGeneratorEngine.js '
            f'(it renames every browser puzzle) and re-pin PINNED here.')


if __name__ == '__main__':
    unittest.main()
