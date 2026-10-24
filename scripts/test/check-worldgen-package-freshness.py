#!/usr/bin/env python3
"""check-worldgen-package-freshness — DOES EVERY COMMITTED world_generator PACKAGE STILL
REGENERATE BYTE FOR BYTE FROM ITS RECIPE?

A package under `worlds/` is generator output. When the generator gains a line (e.g.
`_worldgen_extra_attributes`, 68ee251975) and nobody regenerates the package, the package
silently lags: two alttp packages lagged for months (rules-produced-blocks, 2026-10-15). This
check regenerates every package from `scripts/data/worldgen-package-recipes.json` with the
command `scripts/lib/worldgen_recipe.py` builds (the one test-world-generator.py runs) into a
temp dir, and fails on any differing file. It also fails when a package authored by the World
Generator has no recipe, or a recipe names no package.

Run:
  python scripts/test/check-worldgen-package-freshness.py [<package> ...]
On push it runs as test/test_worldgen_package_freshness.py (unittests).
"""

import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.worldgen_recipe import committed_packages, load_recipes, regenerate_and_compare  # noqa: E402

PROJECT_ROOT = str(Path(__file__).resolve().parents[2])


def main(argv):
    recipes = load_recipes(PROJECT_ROOT)
    packages = committed_packages(PROJECT_ROOT)
    failures = 0
    if not argv:
        for pkg in sorted(set(packages) - set(recipes)):
            failures += 1
            print(f'FAIL: worlds/{pkg} is a World Generator package with no recipe')
        for pkg in sorted(set(recipes) - set(packages)):
            failures += 1
            print(f'FAIL: the recipe {pkg} names no committed package')
    started = time.time()
    with tempfile.TemporaryDirectory(prefix='worldgen-freshness-') as scratch:
        for pkg in argv or sorted(set(packages) & set(recipes)):
            t = time.time()
            try:
                diffs = regenerate_and_compare(PROJECT_ROOT, pkg, recipes[pkg], scratch)
            except (RuntimeError, KeyError) as exc:
                failures += 1
                print(f'FAIL: {pkg}: {exc}')
                continue
            if diffs:
                failures += 1
                print(f'FAIL: {pkg} is stale ({time.time() - t:.1f}s): {", ".join(diffs)}')
            else:
                print(f'PASS: {pkg} regenerates byte for byte ({time.time() - t:.1f}s)')
    print(f'(wall {time.time() - started:.1f}s)')
    print('ALL CHECKS PASSED' if not failures else f'{failures} CHECK(S) FAILED')
    if failures:
        print('A stale package: regenerate it with its recipe (scripts/data/worldgen-package-recipes.json), '
              're-export the presets it produces, and expect them byte-identical.')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
