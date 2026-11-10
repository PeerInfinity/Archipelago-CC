"""ENTRANCE RANDOMIZATION E4c — the `seedling_er` world's PYTHON reachability, over a world package generated from it.

`test/general/test_reachability.py` walks every REGISTERED world (`worlds/*`). No package of `Seedling Playthrough ER` is
committed: this test builds one from the committed preset (`frontend/presets/seedling_er/AP_1/AP_1_rules.json`) into a temp
dir through the ONE package recipe (`scripts/lib/worldgen_recipe.world_generator_command`: name substitutions, canonical
seed 1, the output dir named for the package so `world_directory` is its own), imports it, and asks the reachability test's
own questions of it (its unreachable-region table included, inherited by game-name prefix exactly as there):

- the all-state reaches every location and every region but the named unreachable ones, which it does NOT reach;
- the empty state reaches at least one location;
- the all-state beats the game.

and pins, BY NAME, the shuffled world's unreachable set: it is vanilla's (the two L84 components with no inbound edge —
under vanilla items a coupled stairs shuffle permutes the landings, so no room gains or loses one; anything else is a finding).

Why generated, not committed (E4c's measurement): ~0.7 s to generate, and no package under `worlds/` means no roster
enrolment (`worldgen-package-recipes.json`, the freshness check, `world-mapping.json`, Templates, the template rosters); this
runs on push wherever pytest does. The package is UNREGISTERED afterwards (AutoWorldRegister is global).
"""
import importlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "frontend/presets/seedling_er/AP_1/AP_1_rules.json"
PACKAGE = "seedling_playthrough_er"
GAME = "Seedling Playthrough ER"
# The shuffled world's unreachable regions, by name (measured E4c: equal to vanilla's).
EXPECTED_UNREACHABLE = {"level_84__r0c0", "level_84__r3c0"}


@pytest.fixture(scope="module")
def er_world(tmp_path_factory):
    sys.path.insert(0, str(ROOT))
    from scripts.lib.worldgen_recipe import world_generator_command
    from worlds.AutoWorld import AutoWorldRegister

    out = tmp_path_factory.mktemp("er_pkg")
    assert GAME not in AutoWorldRegister.world_types  # the premise: nothing under worlds/ registers this game
    cmd = world_generator_command(str(SOURCE), str(out / PACKAGE), GAME, 1)
    done = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    assert done.returncode == 0, done.stderr[-2000:]
    sys.path.insert(0, str(out))
    importlib.invalidate_caches()
    try:
        importlib.import_module(PACKAGE)
        yield out / PACKAGE, AutoWorldRegister.world_types[GAME]
    finally:
        AutoWorldRegister.world_types.pop(GAME, None)
        for name in [m for m in sys.modules if m == PACKAGE or m.startswith(PACKAGE + ".")]:
            sys.modules.pop(name, None)
        sys.path[:] = [p for p in sys.path if p != str(out)]


def _unreachable_table():
    """The reachability test's own table for this game: its row, plus every base game's it inherits by prefix."""
    from test.general.test_reachability import TestBase

    table = TestBase.default_settings_unreachable_regions
    out = set(table.get(GAME, set()))
    for base, regions in table.items():
        if GAME.startswith(base) and GAME != base:
            out |= regions
    return out


def test_the_package_carries_the_preset_s_entrance_randomization(er_world):
    pkg, _ = er_world
    preset = json.loads(SOURCE.read_text(encoding="utf-8"))
    block = json.loads((pkg / "_worldgen_entrance_randomization.json").read_text(encoding="utf-8"))
    assert block == preset["entrance_randomization"]["1"]
    assert block["placements"]  # the premise: a shuffled world


def test_the_all_state_reaches_everything_but_the_named_regions(er_world):
    from test.general import setup_solo_multiworld

    _, world_type = er_world
    multiworld = setup_solo_multiworld(world_type)
    state = multiworld.get_all_state(False)
    missed = sorted(loc.name for loc in multiworld.get_locations() if not loc.can_reach(state))
    assert missed == []
    unreachable = {r.name for r in multiworld.get_regions() if not r.can_reach(state)}
    assert unreachable == EXPECTED_UNREACHABLE
    # …and the reachability test's own table names exactly these (inherited from `Seedling Playthrough` by prefix).
    assert unreachable == _unreachable_table()
    assert multiworld.can_beat_game(state)


def test_the_empty_state_reaches_a_location(er_world):
    from BaseClasses import CollectionState
    from test.general import setup_solo_multiworld

    _, world_type = er_world
    multiworld = setup_solo_multiworld(world_type)
    state = CollectionState(multiworld)
    assert any(loc.can_reach(state) for loc in multiworld.get_locations())
