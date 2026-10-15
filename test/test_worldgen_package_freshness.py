"""Every committed world_generator package regenerates byte for byte from its recipe.

`scripts/test/check-worldgen-package-freshness.py` as pytest rows, one per package, so a generator
change that is not followed by a package regeneration is red on push (rules-produced-blocks,
2026-10-15: two alttp packages had lagged the generator since 68ee251975). The recipe table is
`scripts/data/worldgen-package-recipes.json`; the command is `scripts/lib/worldgen_recipe.py`'s,
the one `scripts/test/test-world-generator.py` runs. Measured: 16 packages, ~32 s serial.
"""

import importlib.util
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('worldgen_recipe', REPO / 'scripts' / 'lib' / 'worldgen_recipe.py')
assert _spec is not None and _spec.loader is not None
recipe_lib = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(recipe_lib)

RECIPES = recipe_lib.load_recipes(str(REPO))
PACKAGES = recipe_lib.committed_packages(str(REPO))


def test_every_generator_package_has_a_recipe_and_every_recipe_a_package():
    assert sorted(PACKAGES) == sorted(RECIPES)
    assert len(PACKAGES) >= 16


@pytest.mark.parametrize('package', sorted(RECIPES))
def test_package_regenerates_byte_for_byte(package, tmp_path):
    diffs = recipe_lib.regenerate_and_compare(str(REPO), package, RECIPES[package], str(tmp_path))
    assert diffs == [], (
        f'worlds/{package} is stale against its recipe: {diffs}. Regenerate it with '
        f'`python scripts/test/check-worldgen-package-freshness.py {package}`\'s recipe '
        '(scripts/data/worldgen-package-recipes.json) and re-export the presets it produces.')


def test_the_comparison_reads_crlf_as_lf_and_names_a_differing_file(tmp_path):
    fresh, committed = tmp_path / 'fresh', tmp_path / 'committed'
    for d in (fresh, committed):
        (d / '__pycache__').mkdir(parents=True)
    (fresh / 'Regions.py').write_bytes(b'a\nb\n')
    (committed / 'Regions.py').write_bytes(b'a\r\nb\r\n')
    (committed / '__pycache__' / 'x.pyc').write_bytes(b'ignored')
    assert recipe_lib._tree_differences(str(fresh), str(committed)) == []
    (fresh / 'Rules.py').write_bytes(b'x\n')
    (committed / 'Rules.py').write_bytes(b'y\n')
    (fresh / 'extra.json').write_bytes(b'{}')
    assert recipe_lib._tree_differences(str(fresh), str(committed)) == [
        'Rules.py', 'extra.json (only in the regenerated package)']
