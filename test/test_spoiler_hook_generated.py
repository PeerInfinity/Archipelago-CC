"""The generated worlds carry the Spoiler Export Hook's client and options (step H3).

world_generator writes `_spoiler_hook_client.py` verbatim (from `world_generator/ext_template/`), re-homes both of
its options in the package's `Options.py` (the restricted unpickler loads Option classes only from a module whose
name ends in "options"), calls `prepare` from `stage_pre_output` and merges `slot_data(self)` into
`fill_slot_data`. The structural checks run over every package in `worldgen-package-recipes.json`; the stage checks
run two different generated worlds in one multiworld through AP's real steps, helper present and absent. The
hand-written callers are `test_spoiler_hook_callers.py`; the byte pin over every copy is in
`test_spoiler_export_hook.py`.
"""

import json
import sys
from pathlib import Path

import pytest

from BaseClasses import CollectionState  # noqa: F401  (loads BaseClasses before worlds, as AP does)
from Options import Visibility
from Utils import restricted_dumps, restricted_loads
from worlds.AutoWorld import AutoWorldRegister

import worlds.spoiler_export_hook as hook
from test.test_spoiler_hook_callers import (
    OMITTED, OPTION, RECORD, REGIONS, _absent, _check_record, _check_regions, _output)
from test.general import setup_multiworld
from Fill import balance_multiworld_progression, distribute_items_restrictive
from worlds import AutoWorld

REPO = Path(__file__).resolve().parents[1]
CLIENT_NAME = '_spoiler_hook_client.py'
RECIPES = json.loads((REPO / 'scripts' / 'data' / 'worldgen-package-recipes.json').read_text(encoding='utf-8'))
PACKAGES = {package: recipe['game_name'] for package, recipe in sorted(RECIPES['packages'].items())}
# __slotnames__ is pickle's per-class cache (copyreg._slotnames): it appears on the subclass once any earlier test has
# pickled one of its options (test/general's pickle test does, and the order is the platform's), never on the client.
BOOKKEEPING = {'__module__', '__qualname__', '__firstlineno__', '__static_attributes__',
               '_abc_impl', '__parameters__', '__abstractmethods__', '__slotnames__'}
#: Two different generated worlds in one seed: Bounce's items sit in Coding Adventure's locations, so senders show.
STAGE_WORLDS = ['bounce_worldgen', 'codingadventure_worldgen']
STAGE_SEED = 7  # not 1: seed 1 loads each package's canonical options and placements


def test_the_recipe_table_is_the_seventeen_packages():
    assert len(PACKAGES) == 17 and 'seedling_playthrough' in PACKAGES
    assert sum(package.endswith('_worldgen') for package in PACKAGES) == 16


def test_the_generator_copy_is_the_helpers_client():
    source = (REPO / 'worlds' / 'spoiler_export_hook' / CLIENT_NAME).read_bytes()
    assert (REPO / 'world_generator' / 'ext_template' / CLIENT_NAME).read_bytes() == source
    listed = json.loads((REPO / 'frontend/modules/apworldBuild/worldGeneratorFiles.json').read_text(encoding='utf-8'))
    assert f'ext_template/{CLIENT_NAME}' in listed['files']  # the browser's build fetches only these


@pytest.mark.parametrize('package', PACKAGES)
def test_the_package_carries_a_byte_identical_client(package):
    source = (REPO / 'worlds' / 'spoiler_export_hook' / CLIENT_NAME).read_bytes()
    assert (REPO / 'worlds' / package / CLIENT_NAME).read_bytes() == source


@pytest.mark.parametrize('package', PACKAGES)
@pytest.mark.parametrize('field, name', [(OPTION, 'SpoilerDataInSlotData'), (REGIONS, 'SpoilerDataIncludeRegions')])
def test_both_options_are_the_clients_re_homed_in_options_py(package, field, name):
    world = AutoWorldRegister.world_types[PACKAGES[package]]
    option = world.options_dataclass.type_hints[field]
    client = sys.modules[f'worlds.{package}._spoiler_hook_client']
    assert option.__bases__ == (getattr(client, name),)
    assert option.__module__ == f'worlds.{package}.Options'
    own = {key: value for key, value in vars(option).items() if key not in BOOKKEEPING}
    # Only what the client's class holds too (the Option metaclass fills name_lookup/options/aliases on each class).
    assert own == {key: vars(getattr(client, name))[key] for key in own}
    assert own['__doc__'] and set(own) - {'__doc__'} <= {'aliases', 'name_lookup', 'options'}
    restricted_loads(restricted_dumps(option.from_any(option.default)))
    assert option.default == 0 and not option.visibility & Visibility.spoiler


@pytest.mark.parametrize('package', PACKAGES)
def test_the_world_class_has_the_stage_hook(package):
    assert 'stage_pre_output' in vars(AutoWorldRegister.world_types[PACKAGES[package]])


# ---------------------------------------------------- two generated worlds through the real stages

def _generate(levels, regions):
    worlds = [AutoWorldRegister.world_types[PACKAGES[package]] for package in STAGE_WORLDS]
    options = [{OPTION: level, REGIONS: on} for level, on in zip(levels, regions)]
    multiworld = setup_multiworld(worlds, seed=STAGE_SEED, options=options)
    distribute_items_restrictive(multiworld)
    AutoWorld.call_all(multiworld, 'post_fill')
    balance_multiworld_progression(multiworld)
    return multiworld


@pytest.fixture(scope='module')
def baseline():
    return _output(_generate(['off', 'off'], [False, False]))


def test_off_adds_nothing(baseline):
    assert all(RECORD not in data and OMITTED not in data for data in baseline.values())
    with _absent():
        assert _output(_generate(['off', 'off'], [True, True])) == baseline


def test_on_with_the_helper_sends_each_record_and_changes_nothing_else(baseline):
    multiworld = _generate(['own_slot_with_senders', 'own_slot'], [True, False])
    slot_data = _output(multiworld)
    first, second = slot_data[1].pop(RECORD), slot_data[2].pop(RECORD)
    assert slot_data == baseline
    _check_regions(multiworld, 1, first, first.pop('regions'))
    _check_record(multiworld, 1, first, with_senders=True)
    _check_record(multiworld, 2, second, with_senders=False)
    assert {row[3][0] for row in first['steps'] if len(row) == 4} == {2}, 'no sender row: the seed drove nothing'
    json.dumps([first, second])


def test_on_without_the_helper_sends_the_reason_and_changes_nothing_else(baseline, caplog):
    with _absent():
        slot_data = _output(_generate(['own_slot_with_senders', 'own_slot'], [True, False]))
    assert slot_data == {player: {**data, OMITTED: {'reason': 'hook_absent'}} for player, data in baseline.items()}
    assert len([r for r in caplog.records if 'Spoiler data skipped' in r.getMessage()]) == 1
    assert hook.OPTION == OPTION
