"""Our hand-written worlds carry the Spoiler Export Hook's client and option (step H2).

MetaMath, DepGraph, APCalc and APQuest ServerData each import `SpoilerDataInSlotData` from their own copy of
`_spoiler_hook_client.py`, call `prepare` from `stage_pre_output`, and merge `slot_data(self)` into `fill_slot_data`.
These drive the real generation steps (`AutoWorld.call_all(..., "pre_output")`, then each world's own
`fill_slot_data`), so they pin the wiring, not just the client. The helper itself is tested in
`test_spoiler_export_hook.py`.

MetaMath runs on its hardcoded 2p2e4 proof, so nothing here needs set.mm and nothing here skips without it.

The sweep draws its seeds from AP's own `get_seed()` (20-digit seeds, as Generate.py does), never small ones, and
prints them, so a failure names its seed. `SPOILER_HOOK_SWEEP_SEEDS` sets how many (default below).
"""

import json
import os
import sys
from pathlib import Path
from unittest import mock

import pytest

from BaseClasses import CollectionState, get_seed  # noqa: F401  (loads BaseClasses before worlds, as AP does)
from Fill import balance_multiworld_progression, distribute_items_restrictive
from Options import Visibility
from Utils import restricted_dumps, restricted_loads
from test.general import setup_multiworld
from worlds import AutoWorld
from worlds.AutoWorld import AutoWorldRegister

import worlds.spoiler_export_hook as hook

REPO = Path(__file__).resolve().parents[1]
CLIENT_NAME = '_spoiler_hook_client.py'
OPTION = hook.OPTION
REGIONS = hook.REGIONS_OPTION
RECORD = hook.SLOT_DATA_KEY
OMITTED = 'spoiler_data_omitted'

#: world package -> (game, options every slot of it gets here)
WORLDS = {
    'metamath': ('Metamath', {'theorem': '2p2e4', 'auto_download_database': False}),
    'depgraph': ('DepGraph', {}),
    'apcalc': ('APCalc', {}),
    'apquest_serverdata': ('APQuest ServerData', {}),
}
LEVELS = ['off', 'own_slot', 'own_slot_with_senders']
SWEEP_SEEDS = int(os.environ.get('SPOILER_HOOK_SWEEP_SEEDS', '25'))


def _world_type(package):
    return AutoWorldRegister.world_types[WORLDS[package][0]]


def _generate(packages, levels, seed, regions=None):
    """One slot per (package, level): the generation steps AP's Main runs up to the output step."""
    worlds = [_world_type(package) for package in packages]
    regions = regions or [False] * len(packages)
    options = [{**WORLDS[package][1], OPTION: level, REGIONS: on}
               for package, level, on in zip(packages, levels, regions)]
    multiworld = setup_multiworld(worlds, seed=seed, options=options)
    distribute_items_restrictive(multiworld)
    AutoWorld.call_all(multiworld, 'post_fill')
    balance_multiworld_progression(multiworld)
    return multiworld


def _output(multiworld):
    """What Main does at output: pre_output (every world, then each class's stage), then slot_data per slot."""
    AutoWorld.call_all(multiworld, 'pre_output')
    return {player: dict(multiworld.worlds[player].fill_slot_data()) for player in multiworld.player_ids}


def _absent():
    return mock.patch.dict(sys.modules, {hook.__name__: None})


# ---------------------------------------------------- each world carries the option, the client and the calls

@pytest.mark.parametrize('package', WORLDS)
def test_the_world_carries_a_byte_identical_client(package):
    source = (REPO / 'worlds' / 'spoiler_export_hook' / CLIENT_NAME).read_bytes()
    copy = (REPO / 'worlds' / package / CLIENT_NAME).read_bytes()
    assert copy == source, (
        f'worlds/{package}/{CLIENT_NAME} differs from the helper\'s copy'
        + (' — it has CRLF line endings: is the `**/' + CLIENT_NAME + ' text eol=lf` rule in .gitattributes'
           ' still there?' if b'\r\n' in copy and b'\r\n' not in source else ''))


@pytest.mark.parametrize('package', WORLDS)
def test_the_option_is_the_clients_choice_off_by_default_and_out_of_the_text_spoiler(package):
    option = _world_type(package).options_dataclass.type_hints[OPTION]
    client = sys.modules[f'worlds.{package}._spoiler_hook_client']
    # Re-homed in the options module (the restricted unpickler loads Option classes only from a module whose name
    # ends in "options"), adding nothing of its own: the description and values stay the byte-pinned client's.
    assert option.__bases__ == (client.SpoilerDataInSlotData,)
    assert option.__module__ == f'worlds.{package}.{"options" if package == "apquest_serverdata" else "Options"}'
    bookkeeping = {'__module__', '__qualname__', '__firstlineno__', '__static_attributes__',
                   '_abc_impl', '__parameters__', '__abstractmethods__'}
    own = {key: value for key, value in vars(option).items() if key not in bookkeeping}
    assert own == {key: vars(client.SpoilerDataInSlotData)[key] for key in own}
    assert '__doc__' in own and 'options' in own
    restricted_loads(restricted_dumps(option.from_text('own_slot_with_senders')))
    assert option.default == 0 and option.name_lookup == {0: 'off', 1: 'own_slot', 2: 'own_slot_with_senders'}
    assert not option.visibility & Visibility.spoiler


@pytest.mark.parametrize('package', WORLDS)
def test_the_regions_option_is_the_clients_toggle_off_by_default_and_out_of_the_text_spoiler(package):
    option = _world_type(package).options_dataclass.type_hints[REGIONS]
    client = sys.modules[f'worlds.{package}._spoiler_hook_client']
    assert option.__bases__ == (client.SpoilerDataIncludeRegions,)
    assert option.__module__ == f'worlds.{package}.{"options" if package == "apquest_serverdata" else "Options"}'
    bookkeeping = {'__module__', '__qualname__', '__firstlineno__', '__static_attributes__',
                   '_abc_impl', '__parameters__', '__abstractmethods__'}
    own = {key: value for key, value in vars(option).items() if key not in bookkeeping}
    assert own == {key: vars(client.SpoilerDataIncludeRegions)[key] for key in own}
    assert '__doc__' in own
    restricted_loads(restricted_dumps(option.from_any(True)))
    assert option.default == 0 and not option.visibility & Visibility.spoiler


@pytest.mark.parametrize('package', WORLDS)
def test_the_world_class_has_the_stage_hook(package):
    assert 'stage_pre_output' in vars(_world_type(package))


# ---------------------------------------------------- off / own_slot / own_slot_with_senders, helper present and absent

@pytest.fixture(scope='module', params=list(WORLDS))
def pair(request):
    """Two slots of one world, so items cross between them and senders have something to name."""
    package = request.param
    baseline = _output(_generate([package, package], ['off', 'off'], seed=1))
    return package, baseline


def _run(package, level, present, seed=1, regions=False):
    multiworld = _generate([package, package], [level, 'off'], seed=seed, regions=[regions, False])
    if present:
        return multiworld, _output(multiworld)
    with _absent():
        return multiworld, _output(multiworld)


@pytest.mark.parametrize('present', [True, False], ids=['helper_present', 'helper_absent'])
def test_off_adds_nothing_with_or_without_the_helper(pair, present, caplog):
    package, baseline = pair
    _, slot_data = _run(package, 'off', present)
    assert slot_data == baseline
    assert not [r for r in caplog.records if 'poiler' in r.getMessage()]


@pytest.mark.parametrize('level', LEVELS[1:])
def test_on_without_the_helper_sends_the_reason_and_changes_nothing_else(pair, level, caplog):
    package, baseline = pair
    _, slot_data = _run(package, level, present=False)
    assert slot_data[1] == {**baseline[1], OMITTED: {'reason': 'hook_absent'}}
    assert slot_data[2] == baseline[2]
    assert len([r for r in caplog.records if 'Spoiler data skipped' in r.getMessage()]) == 1


@pytest.mark.parametrize('level', LEVELS[1:])
def test_on_with_the_helper_sends_the_record_and_changes_nothing_else(pair, level):
    package, baseline = pair
    multiworld, slot_data = _run(package, level, present=True)
    record = slot_data[1].pop(RECORD)
    assert slot_data[1] == baseline[1] and slot_data[2] == baseline[2]
    _check_record(multiworld, 1, record, with_senders=level == 'own_slot_with_senders')
    json.dumps(record)


def test_senders_name_the_other_slot_and_own_slot_does_not(pair):
    package, _ = pair
    _, own = _run(package, 'own_slot', present=True)
    _, senders = _run(package, 'own_slot_with_senders', present=True)
    assert all(len(row) == 3 for row in own[1][RECORD]['steps'])
    from_other = [row for row in senders[1][RECORD]['steps'] if len(row) == 4]
    assert from_other, f'{package}: no item of slot 1 sits in slot 2 at seed 1, so the sender path was not driven'
    assert {row[3][0] for row in from_other} == {2}
    # Senders add the fourth element and nothing else.
    assert [row[:3] for row in senders[1][RECORD]['steps']] == own[1][RECORD]['steps']


@pytest.mark.parametrize('level', LEVELS[1:])
def test_regions_add_only_their_field_through_the_real_stages(pair, level):
    package, baseline = pair
    _, plain = _run(package, level, present=True)
    multiworld, with_regions = _run(package, level, present=True, regions=True)
    record = with_regions[1][RECORD]
    regions = record.pop('regions')
    assert record == plain[1][RECORD] and with_regions[2] == plain[2]
    _check_regions(multiworld, 1, record, regions)


def test_regions_without_spoiler_data_add_nothing(pair):
    package, baseline = pair
    _, slot_data = _run(package, 'off', present=True, regions=True)
    assert slot_data == baseline


def _check_regions(multiworld, player, record, regions):
    """Each region once, every one a region of this slot, the start reachable with nothing collected."""
    from BaseClasses import CollectionState
    sent = regions['start'] + [name for _, names in regions['steps'] for name in names]
    assert len(sent) == len(set(sent))
    assert set(sent) <= {region.name for region in multiworld.get_regions(player)}
    empty = CollectionState(multiworld)
    assert set(regions['start']) == {r.name for r in multiworld.get_regions(player) if r.can_reach(empty)}
    for index, names in regions['steps']:
        assert names and record['steps'][index][2] is not None


def _check_record(multiworld, player, record, with_senders):
    """The record against the multiworld it came from: own locations, items received, senders."""
    world = multiworld.worlds[player]
    assert record['format'] == hook.FORMAT and record['player'] == player
    assert record['unreachable'] == 0
    own = {loc.name for loc in multiworld.get_filled_locations(player)}
    sent_own = {world.location_id_to_name.get(row[1], row[1]) for row in record['steps'] if row[1] is not None}
    assert sent_own == own
    received = sorted(loc.item.name for loc in multiworld.get_filled_locations() if loc.item.player == player)
    sent_received = sorted(world.item_id_to_name.get(row[2], row[2]) for row in record['steps'] if row[2] is not None)
    assert sent_received == received
    for row in record['steps']:
        assert len(row) == (4 if with_senders and row[1] is None else 3), row
        if len(row) == 4:
            sender, address = row[3]
            sender_world = multiworld.worlds[sender]
            location = multiworld.get_location(sender_world.location_id_to_name.get(address, address), sender)
            assert location.item.player == player
            assert world.item_id_to_name.get(row[2], row[2]) == location.item.name


# ---------------------------------------------------- the sweep: AP's real seeds, all four worlds in one seed

def test_sweep_all_four_worlds_on_real_seeds_with_the_helper(capsys):
    """Each seed: one slot of every world, asking own_slot or own_slot_with_senders (alternating by seed)."""
    assert SWEEP_SEEDS > 0
    packages = list(WORLDS)
    seeds, checked = [], 0
    for index in range(SWEEP_SEEDS):
        seed = get_seed()
        seeds.append(seed)
        levels = [LEVELS[1 + (index + offset) % 2] for offset in range(len(packages))]
        regions = [(index + offset) % 3 == 0 for offset in range(len(packages))]
        multiworld = _generate(packages, levels, seed=seed, regions=regions)
        slot_data = _output(multiworld)
        for player, level, on in zip(multiworld.player_ids, levels, regions):
            assert OMITTED not in slot_data[player], (seed, player)
            record = dict(slot_data[player][RECORD])
            assert ('regions' in record) == on, (seed, player)
            if on:
                _check_regions(multiworld, player, record, record.pop('regions'))
            _check_record(multiworld, player, record, level == 'own_slot_with_senders')
            checked += 1
    with capsys.disabled():
        print(f'\nspoiler hook sweep: {len(seeds)} seeds from get_seed(), {checked} slot records checked: '
              f'{", ".join(map(str, seeds))}')
    assert checked == SWEEP_SEEDS * len(packages)
