"""The Spoiler Export Hook helper apworld (worlds/spoiler_export_hook) and the client file its callers carry.

No world uses the helper yet, so these drive it the way a caller will: `_spoiler_hook_client.prepare(cls, mw)`
and `.slot_data(world)` on a real filled multiworld, with the option set on the slots' options objects.

What needs real AP loading (a packed helper loading before or after a packed caller, on pristine upstream) can't
run here, because the fork's `worlds` package has already loaded everything. Here: the client has no module-level
import that could depend on load order, and the packed file imports the way AP's zip loader imports it.
"""

import ast
import json
import logging
import subprocess
import sys
import types
import zipfile
from pathlib import Path
from unittest import mock

import pytest

from BaseClasses import CollectionState  # noqa: F401  (loads BaseClasses before worlds, as AP does)
from Fill import distribute_items_restrictive
from Options import Visibility
from test.general import setup_multiworld
from worlds.AutoWorld import AutoWorldRegister

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from scripts.build.pack_apworld import pack_apworld  # noqa: E402

from exporter.games.base.handler import BaseGameExportHandler  # noqa: E402
from exporter.games.base.world_data import TRANSPORT_ONLY_OPTIONS  # noqa: E402

import worlds.spoiler_export_hook as hook  # noqa: E402
from worlds.spoiler_export_hook import _spoiler_hook_client as client  # noqa: E402

HOOK_DIR = REPO / 'worlds' / 'spoiler_export_hook'
PACKED = REPO / 'apworlds' / 'spoiler_export_hook.apworld'
CLIENT_NAME = '_spoiler_hook_client.py'
CACHE_ATTR = hook._CACHE_ATTR
CLIENT_STATE = '_spoiler_hook_client'
GAME_A = 'APQuest ServerData'
GAME_B = 'DepGraph'
#: slots: 1 and 2 are A, 3 is B.
A1, A2, B1 = 1, 2, 3


@pytest.fixture(scope='module')
def built():
    """One real filled multiworld, shared because filling is the slow part; `mw` resets what a test may change."""
    multiworld = setup_multiworld([AutoWorldRegister.world_types[GAME_A], AutoWorldRegister.world_types[GAME_A],
                                   AutoWorldRegister.world_types[GAME_B]], seed=1)
    distribute_items_restrictive(multiworld)
    return multiworld


OFF, OWN_SLOT, WITH_SENDERS = 0, 1, 2


def _set_option(world, value):
    if value is None:
        world.options.__dict__.pop(hook.OPTION, None)
    else:
        setattr(world.options, hook.OPTION, client.SpoilerDataInSlotData(int(value)))


@pytest.fixture
def mw(built):
    """Slot 2 has the option off and slots 1 and 3 on (own_slot), as scenario 3 does. Each test starts with empty caches."""
    def configure(a1=True, a2=False, b1=True):
        _set_option(built.worlds[A1], a1)
        _set_option(built.worlds[A2], a2)
        _set_option(built.worlds[B1], b1)
        return built
    configure()
    for name in (CACHE_ATTR, CLIENT_STATE):
        built.__dict__.pop(name, None)
    built.configure = configure
    yield built
    built.is_race = False
    for name in (CACHE_ATTR, CLIENT_STATE, 'configure'):
        built.__dict__.pop(name, None)
    for player in (A1, A2, B1):
        built.worlds[player].options.__dict__.pop(hook.OPTION, None)


def _run_client(multiworld):
    """What AP does: stage_pre_output once per class, then fill_slot_data per slot."""
    for game in (GAME_A, GAME_B):
        client.prepare(AutoWorldRegister.world_types[game], multiworld)
    return {player: client.slot_data(multiworld.worlds[player]) for player in (A1, A2, B1)}


def _warnings(caplog):
    return [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING and 'poiler' in r.getMessage()]


def _absent():
    return mock.patch.dict(sys.modules, {client.HOOK_MODULE: None})


def _stub_hook(**attrs):
    return mock.patch.dict(sys.modules, {client.HOOK_MODULE: types.SimpleNamespace(**attrs)})


def _omitted(reason):
    return {client.OMITTED_KEY: {'reason': reason}}


# ---------------------------------------------------- absent and present (scenarios 1-4)

def test_absent_with_the_option_off_adds_nothing_and_prints_nothing(mw, caplog):
    """Scenario 1, and Robert's ruling: a silent generation."""
    mw.configure(a1=False, a2=False, b1=False)
    with _absent(), caplog.at_level(logging.INFO):
        result = _run_client(mw)
    assert result == {A1: {}, A2: {}, B1: {}}
    assert [r for r in caplog.records if 'poiler' in r.getMessage()] == []


def test_absent_with_the_option_on_skips_and_warns_once(mw, caplog):
    """Scenario 2: both world classes hit it, one warning, and the reason reaches slot_data."""
    mw.configure(a1=True, a2=True, b1=True)
    with _absent():
        result = _run_client(mw)
    assert result == {A1: _omitted('hook_absent'), A2: _omitted('hook_absent'), B1: _omitted('hook_absent')}
    lines = _warnings(caplog)
    assert len(lines) == 1, lines
    assert 'not installed' in lines[0] and 'generation continues' in lines[0]


def test_present_computes_once_for_every_asking_slot(mw, caplog):
    """Scenario 3: the first class computes for both classes' slots; the off slot gets nothing."""
    with mock.patch.object(hook, 'walk', wraps=hook.walk) as walked, caplog.at_level(logging.INFO):
        result = _run_client(mw)
    assert walked.call_count == 1
    assert result[A2] == {}
    for player in (A1, B1):
        record = result[player][hook.SLOT_DATA_KEY]
        assert record['player'] == player and record['format'] == hook.FORMAT
        assert record['seed_name'] == str(mw.seed_name) and record['steps']
    assert result[A1][hook.SLOT_DATA_KEY] != result[B1][hook.SLOT_DATA_KEY]
    assert _warnings(caplog) == []
    assert any('computed once for 2 slot(s)' in r.getMessage() for r in caplog.records)


def test_present_with_the_option_off_does_no_work(mw, caplog):
    """Scenario 4."""
    mw.configure(a1=False, a2=False, b1=False)
    with mock.patch.object(hook, 'walk', wraps=hook.walk) as walked, caplog.at_level(logging.INFO):
        result = _run_client(mw)
    assert result == {A1: {}, A2: {}, B1: {}}
    assert walked.call_count == 0 and not hasattr(mw, CACHE_ATTR)
    assert [r for r in caplog.records if 'poiler' in r.getMessage()] == []


def test_a_world_without_the_option_is_not_asking(mw):
    """The 'plain' slot of the scenarios: a world that never defined the option."""
    mw.configure(a1=None, a2=None, b1=True)
    result = _run_client(mw)
    assert result[A1] == {} and result[A2] == {} and hook.SLOT_DATA_KEY in result[B1]


# ---------------------------------------------------- failure modes (scenarios 10-13)

def test_version_mismatch_skips_the_slots(mw, caplog):
    """Scenario 10."""
    with mock.patch.object(hook, 'SUPPORTED_CLIENT_APIS', frozenset({client.CLIENT_API + 1})):
        with mock.patch.object(hook, 'walk', wraps=hook.walk) as walked:
            result = _run_client(mw)
    assert result == {A1: _omitted('api_mismatch'), A2: {}, B1: _omitted('api_mismatch')}
    assert walked.call_count == 0
    assert len(_warnings(caplog)) == 1


def test_a_helper_too_old_to_name_its_apis_is_a_mismatch(mw, caplog):
    with _stub_hook():
        result = _run_client(mw)
    assert result == {A1: _omitted('api_mismatch'), A2: {}, B1: _omitted('api_mismatch')}
    assert len(_warnings(caplog)) == 1


@pytest.mark.parametrize('body', ['raise RuntimeError("deliberately broken helper")\n',
                                  'import a_module_nobody_has_installed\n'],
                         ids=['raises', 'missing-dependency'])
def test_a_helper_that_fails_on_import_skips_the_slots(mw, caplog, tmp_path, body):
    """Scenario 11, through a real import. A dependency it can't find must not read as 'helper absent'."""
    import worlds
    name = 'spoiler_hook_test_broken'
    (tmp_path / name).mkdir()
    (tmp_path / name / '__init__.py').write_text(body, encoding='utf-8')
    with mock.patch.object(client, 'HOOK_MODULE', f'worlds.{name}'), \
            mock.patch.object(worlds, '__path__', [*worlds.__path__, str(tmp_path)]):
        result = _run_client(mw)
    assert result == {A1: _omitted('hook_broken'), A2: {}, B1: _omitted('hook_broken')}
    lines = _warnings(caplog)
    assert len(lines) == 1 and 'failed to import' in lines[0], lines


def test_a_helper_that_raises_while_computing_fails_once_per_seed(mw, caplog):
    """Scenario 12: one attempt, one traceback, one warning, whichever classes ask afterwards."""
    with mock.patch.object(hook, 'walk', side_effect=ValueError('deliberate')) as walked:
        result = _run_client(mw)
    assert walked.call_count == 1
    assert result == {A1: _omitted('hook_failed'), A2: {}, B1: _omitted('hook_failed')}
    tracebacks = [r for r in caplog.records if r.exc_info]
    assert len(tracebacks) == 1 and len(_warnings(caplog)) == 1


def test_a_failure_reading_the_result_does_not_fail_the_output_step(mw, caplog):
    """fill_slot_data runs in AP's output pool, where an exception would fail the whole generation."""
    def explode(*_):
        raise KeyError('deliberate')
    with _stub_hook(SUPPORTED_CLIENT_APIS=hook.SUPPORTED_CLIENT_APIS, prepare=lambda _: None, slot_data_for=explode):
        result = _run_client(mw)
    assert result == {A1: _omitted('hook_failed'), A2: {}, B1: _omitted('hook_failed')}
    assert any(r.exc_info for r in caplog.records)


def test_a_race_seed_never_carries_the_data(mw, caplog):
    """Scenario 13."""
    mw.is_race = True
    with mock.patch.object(hook, 'walk', wraps=hook.walk) as walked:
        result = _run_client(mw)
    assert walked.call_count == 0
    assert result == {A1: _omitted('race'), A2: {}, B1: _omitted('race')}
    lines = _warnings(caplog)
    assert len(lines) == 1 and 'race seed' in lines[0], lines


def test_over_the_size_limit_sends_the_reason_instead(mw):
    with mock.patch.object(hook, 'MAX_SLOT_BYTES', 10):
        result = _run_client(mw)
    for player in (A1, B1):
        assert hook.SLOT_DATA_KEY not in result[player]
        note = result[player][client.OMITTED_KEY]
        assert note['reason'] == 'over_cap' and note['cap_bytes'] == 10 and note['size_bytes'] > 10


def test_reading_before_the_compute_says_so(mw):
    assert client.slot_data(mw.worlds[A1]) == _omitted('not_prepared')


# ---------------------------------------------------- the walk

def _snapshot(multiworld):
    return {
        'placements': {(loc.player, loc.name): (id(loc.item), loc.locked, loc.address)
                       for loc in multiworld.get_locations()},
        'precollected': {player: [id(item) for item in items]
                         for player, items in multiworld.precollected_items.items()},
        'itempool': [id(item) for item in multiworld.itempool],
        'state_items': {player: dict(counts) for player, counts in multiworld.state.prog_items.items()},
        'state_regions': {player: set(regions) for player, regions in multiworld.state.reachable_regions.items()},
        'state_checked': set(multiworld.state.locations_checked),
    }


def test_the_walk_leaves_the_multiworld_untouched(mw):
    """No write to any placement, precollected list, item pool or the multiworld's own state."""
    before = _snapshot(mw)
    _run_client(mw)
    assert _snapshot(mw) == before


def test_the_walk_equals_ap_own_spheres(mw):
    """MultiWorld.get_spheres is the independent answer to 'what is reachable when'."""
    walked = hook.walk(mw)
    by_sphere = {}
    for label, location in walked['steps']:
        by_sphere.setdefault(int(label.split('.')[0]), set()).add(location)
    spheres = [sphere for sphere in mw.get_spheres() if sphere]
    assert len(spheres) > 1, 'a one-sphere seed proves nothing about the order'
    assert [by_sphere[index] for index in range(len(by_sphere))] == spheres[:walked['spheres']]
    assert walked['unreachable'] == 0 and walked['spheres'] == len(spheres)


def test_the_walk_is_deterministic(mw):
    first, second = hook.walk(mw), hook.walk(mw)
    assert [(label, loc.player, loc.name) for label, loc in first['steps']] == \
           [(label, loc.player, loc.name) for label, loc in second['steps']]
    by_sphere = {}
    for label, location in first['steps']:  # set order varies between runs, so each sphere must be sorted
        by_sphere.setdefault(label.split('.')[0], []).append((location.player, location.name))
    assert all(rows == sorted(rows) for rows in by_sphere.values())


def test_a_second_prepare_is_a_cache_hit(mw):
    with mock.patch.object(hook, 'walk', wraps=hook.walk) as walked:
        first = hook.prepare(mw)
        second = hook.prepare(mw)
    assert first is second and walked.call_count == 1


def test_the_result_lives_on_the_multiworld_and_holds_plain_data(mw):
    """No module state, and nothing that keeps Location objects alive past the compute."""
    result = hook.prepare(mw)
    assert getattr(mw, CACHE_ATTR) is result
    json.dumps({str(player): record for player, record in result['data'].items()})
    assert [k for k, v in vars(hook).items() if isinstance(v, (dict, list, set)) and not k.startswith('__')] == []


@pytest.mark.parametrize('player', [A1, B1])
def test_the_record_lists_exactly_the_slots_own_locations_and_items(mw, player):
    world = mw.worlds[player]
    record = hook.prepare(mw)['data'][player]
    id_to_location, id_to_item = world.location_id_to_name, world.item_id_to_name

    def name(value, table):
        return table[value] if isinstance(value, int) else value

    own = [name(row[1], id_to_location) for row in record['steps'] if row[1] is not None]
    assert sorted(own) == sorted(loc.name for loc in mw.get_filled_locations(player))
    received = [name(row[2], id_to_item) for row in record['steps'] if row[2] is not None]
    assert sorted(received) == sorted(loc.item.name for loc in mw.get_filled_locations() if loc.item.player == player)
    start = [name(value, id_to_item) for value in record['start']]
    assert sorted(start) == sorted(item.name for item in mw.precollected_items[player])
    assert all(row[1] is not None or row[2] is not None for row in record['steps'])


@pytest.mark.parametrize('address,name,package,expected', [
    (5, 'Bow', {5: 'Bow'}, 5),                      # the package gives this exact name back
    (5, 'Progressive Bow', {5: 'Progressive Bow (Alt)'}, 'Progressive Bow'),  # ALttP's case
    (5, 'Skull Mask', {}, 'Skull Mask'),            # OoT's case: the id isn't in the package
    (None, 'Event Item', {}, 'Event Item'),         # an event has no id
], ids=['safe-id', 'id-resolves-elsewhere', 'id-not-in-package', 'event'])
def test_an_id_is_sent_only_when_the_package_gives_that_name_back(address, name, package, expected):
    assert hook._code(address, name, package) == expected


# ---------------------------------------------------- own_slot_with_senders

def _sender_rows(record):
    return [row for row in record['steps'] if len(row) == 4]


def _names(multiworld, player, row):
    """A row's (item received, sending player, sending location), each ID read back through its own game's table."""
    item = multiworld.worlds[player].item_id_to_name.get(row[2], row[2])
    sender, location = row[3]
    return item, sender, multiworld.worlds[sender].location_id_to_name.get(location, location)


def test_own_slot_carries_no_sender_data_at_all(mw):
    mw.configure(a1=OWN_SLOT, a2=OFF, b1=OWN_SLOT)
    for player, record in hook.prepare(mw)['data'].items():
        assert {len(row) for row in record['steps']} == {3}, player
        assert sorted(record) == ['format', 'player', 'seed_name', 'start', 'steps', 'unreachable']


def test_a_sender_row_names_the_player_and_location_the_spoiler_names(mw):
    """Every row against the placements, both ways: nothing wrong, and no sending location left out."""
    mw.configure(a1=WITH_SENDERS, a2=OFF, b1=WITH_SENDERS)
    for player, record in hook.prepare(mw)['data'].items():
        expected = sorted((loc.player, loc.name, loc.item.name) for loc in mw.get_filled_locations()
                          if loc.item.player == player and loc.player != player)
        assert expected, 'a seed where nobody sends this slot anything proves nothing'
        found = []
        for row in _sender_rows(record):
            item, sender, location = _names(mw, player, row)
            assert sender != player and row[1] is None
            placed = mw.get_location(location, sender)
            assert placed.item.player == player and placed.item.name == item
            found.append((sender, location, item))
        assert sorted(found) == expected


def test_senders_change_nothing_else_in_the_record(mw):
    """Same format, same rows in the same order, and other players' locations that give this slot nothing stay out."""
    plain = {player: hook.compact_for(mw, hook.walk(mw), player) for player in (A1, B1)}
    full = {player: hook.compact_for(mw, hook.walk(mw), player, True) for player in (A1, B1)}
    for player in (A1, B1):
        assert full[player]['format'] == plain[player]['format'] == hook.FORMAT
        assert [row[:3] for row in full[player]['steps']] == plain[player]['steps']
        assert {key: value for key, value in full[player].items() if key != 'steps'} == \
               {key: value for key, value in plain[player].items() if key != 'steps'}
        assert all(row[2] is not None and row[1] is None for row in _sender_rows(full[player]))


def test_each_slot_gets_its_own_level_from_one_walk(mw):
    mw.configure(a1=OWN_SLOT, a2=OFF, b1=WITH_SENDERS)
    with mock.patch.object(hook, 'walk', wraps=hook.walk) as walked:
        result = _run_client(mw)
    assert walked.call_count == 1 and result[A2] == {}
    assert _sender_rows(result[A1][hook.SLOT_DATA_KEY]) == [] and _sender_rows(result[B1][hook.SLOT_DATA_KEY])


def test_a_race_seed_never_carries_senders_either(mw):
    mw.configure(a1=WITH_SENDERS, a2=OFF, b1=WITH_SENDERS)
    mw.is_race = True
    assert _run_client(mw) == {A1: _omitted('race'), A2: {}, B1: _omitted('race')}


def _one_step_world(address, name, sender_table, own_table):
    """A stub: slot 1 receives an item from slot 2's location, with each game's table set by the test."""
    item = types.SimpleNamespace(player=1, code=None, name='Item')
    location = types.SimpleNamespace(player=2, address=address, name=name, item=item)
    worlds = {1: types.SimpleNamespace(location_id_to_name=own_table, item_id_to_name={}),
              2: types.SimpleNamespace(location_id_to_name=sender_table, item_id_to_name={})}
    multiworld = types.SimpleNamespace(worlds=worlds, precollected_items={}, seed_name='s')
    return hook.compact_for(multiworld, {'steps': [('0.1', location)], 'unreachable': 0}, 1, True)['steps'][0][3]


@pytest.mark.parametrize('address,sender_table,own_table,expected', [
    (7, {7: 'Chest'}, {}, 7),                                  # the sender's package gives the name back
    (7, {7: 'Other'}, {7: 'Chest'}, 'Chest'),                  # only the RECEIVER's game knows this id as this name
    (7, {}, {7: 'Chest'}, 'Chest'),                            # the sender's package doesn't list the id
    (None, {}, {}, 'Chest'),                                   # an event location has no id
], ids=['safe-id', 'sender-table-disagrees', 'not-in-sender-table', 'event'])
def test_the_sender_location_follows_the_id_rule_for_the_senders_game(address, sender_table, own_table, expected):
    assert _one_step_world(address, 'Chest', sender_table, own_table) == [2, expected]


def test_the_option_is_one_choice_off_by_default():
    option = client.SpoilerDataInSlotData
    assert option.default == OFF and option.name_lookup[OFF] == 'off'
    assert option.options['own_slot'] == OWN_SLOT
    assert option.options['own_slot_with_senders'] == WITH_SENDERS == hook.OWN_SLOT_WITH_SENDERS
    assert not option.visibility & Visibility.spoiler, 'in the text spoiler it would move every committed _Spoiler.txt'
    assert option.from_any(False).value == OFF, 'an unquoted YAML `off` arrives as False'


def test_the_option_description_says_what_senders_reveal():
    description = ' '.join(client.SpoilerDataInSlotData.__doc__.split())
    assert 'Every client in the room can read' in description and "other players' worlds" in description
    assert 'Spoiler Export Hook' in description and 'race' in description


# ---------------------------------------------------- the package

def test_it_is_a_hidden_world_nobody_can_play():
    world = AutoWorldRegister.world_types['Spoiler Export Hook']
    assert world.hidden and world.__module__ == 'worlds.spoiler_export_hook'
    with pytest.raises(RuntimeError, match='not a playable game'):
        world.stage_assert_generate(None)


def test_the_client_api_is_one_the_helper_serves():
    assert client.CLIENT_API in hook.SUPPORTED_CLIENT_APIS
    assert client.OPTION == hook.OPTION


def test_the_source_manifest_carries_the_ruled_version_floor():
    manifest = json.loads((HOOK_DIR / 'archipelago.json').read_text(encoding='utf-8'))
    assert manifest['minimum_ap_version'] == '0.6.7' and manifest['game'] == 'Spoiler Export Hook'
    assert manifest['world_version'] == hook.__version__


def test_the_package_carries_its_mit_notice():
    notice = (HOOK_DIR / 'LICENSE').read_text(encoding='utf-8')
    assert notice.startswith('MIT License') and 'Permission is hereby granted' in notice


def test_the_committed_apworld_is_what_the_source_packs_to(tmp_path):
    """A source edit that doesn't rebuild the file goes red here."""
    fresh = tmp_path / 'spoiler_export_hook.apworld'
    assert pack_apworld('spoiler_export_hook', fresh)
    with zipfile.ZipFile(fresh) as a, zipfile.ZipFile(PACKED) as b:
        names = sorted(a.namelist())
        assert names == sorted(b.namelist())
        assert {n: a.read(n) for n in names} == {n: b.read(n) for n in names}
    assert sorted(names) == [f'spoiler_export_hook/{n}' for n in
                             sorted(['LICENSE', '__init__.py', CLIENT_NAME, 'archipelago.json'])]
    with zipfile.ZipFile(PACKED) as packed:
        manifest = json.loads(packed.read('spoiler_export_hook/archipelago.json'))
    assert manifest['minimum_ap_version'] == '0.6.7' and manifest['compatible_version']


def test_the_client_has_no_import_that_depends_on_load_order():
    """Scenario 9's defect, statically: a module-level import of the helper fails the caller when it loads first."""
    tree = ast.parse((HOOK_DIR / CLIENT_NAME).read_text(encoding='utf-8'))
    top_level = [node for node in ast.walk(tree) if isinstance(node, (ast.Import, ast.ImportFrom))]
    assert sorted(alias.name for node in top_level for alias in node.names) == \
           ['Choice', 'Visibility', 'importlib', 'logging']
    assert [node.module for node in top_level if isinstance(node, ast.ImportFrom)] == ['Options']


#: The steps of worlds.WorldSource.load for a zip, over a stubbed `worlds` package (the real one loads every world).
ZIP_LOAD_PROBE = r'''
import enum, importlib, importlib.util, json, sys, types, zipimport
apworld = sys.argv[1]
options = types.ModuleType("Options")
options.Choice = type("Choice", (), {})
options.Visibility = enum.IntFlag("Visibility", {"spoiler": 1, "other": 2, "all": 3})
sys.modules["Options"] = options
worlds = types.ModuleType("worlds"); worlds.__path__ = []
auto = types.ModuleType("worlds.AutoWorld")
auto.World = type("World", (), {}); auto.WebWorld = type("WebWorld", (), {})
sys.modules.update({"worlds": worlds, "worlds.AutoWorld": auto})
importer = zipimport.zipimporter(apworld)
spec = importer.find_spec("spoiler_export_hook")
mod = importlib.util.module_from_spec(spec)
mod.__package__ = f"worlds.{mod.__package__}"
mod.__name__ = f"worlds.{mod.__name__}"
sys.modules[mod.__name__] = mod
importer.exec_module(mod)
client = importlib.import_module("worlds.spoiler_export_hook._spoiler_hook_client")
loaded, reason = client._load_hook()
print(json.dumps({"same": loaded is mod, "reason": reason, "version": mod.__version__, "from_zip": apworld in mod.__file__}))
'''


def test_the_packed_file_loads_the_way_ap_loads_a_zip():
    """Its name, layout and imports survive the zip import. Load ORDER is proven on pristine upstream, not here."""
    done = subprocess.run([sys.executable, '-I', '-c', ZIP_LOAD_PROBE, str(PACKED)],
                          capture_output=True, text=True, timeout=60, stdin=subprocess.DEVNULL)
    assert done.returncode == 0, done.stderr
    assert json.loads(done.stdout) == {'same': True, 'reason': None, 'version': hook.__version__, 'from_zip': True}


# ---------------------------------------------------- the pin on every copy of the client

def _copies_on_disk(repo):
    """Every tracked or untracked-but-not-ignored copy of the client, plain or inside an .apworld, as (where, bytes)."""
    listed = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z',
                             f'*{CLIENT_NAME}', '*.apworld'],
                            cwd=repo, capture_output=True, check=True).stdout.decode('utf-8').split('\0')
    copies = []
    for rel in filter(None, listed):
        path = repo / rel
        if not path.is_file():
            continue  # a path git still lists that this tree has deleted
        if rel.endswith('.apworld'):
            with zipfile.ZipFile(path) as packed:
                copies += [(f'{rel}!{member}', packed.read(member)) for member in packed.namelist()
                           if member.rsplit('/', 1)[-1] == CLIENT_NAME]
        else:
            copies.append((rel, path.read_bytes()))
    return copies


def _mismatches(repo, source_bytes):
    return [where for where, data in _copies_on_disk(repo) if data != source_bytes]


def test_every_copy_of_the_client_is_byte_identical():
    """No apworld carries the client yet; the helper's own .apworld is the copy this reads today."""
    source = (HOOK_DIR / CLIENT_NAME).read_bytes()
    found = [where for where, _ in _copies_on_disk(REPO)]
    assert f'worlds/spoiler_export_hook/{CLIENT_NAME}' in found
    assert f'apworlds/spoiler_export_hook.apworld!spoiler_export_hook/{CLIENT_NAME}' in found
    assert _mismatches(REPO, source) == []


def test_the_pin_catches_a_mismatching_copy(tmp_path):
    """The check itself, on a throwaway repo: a good copy passes, a changed plain copy or packed copy fails."""
    source = b'# the client\n'
    subprocess.run(['git', 'init', '-q'], cwd=tmp_path, check=True)
    good = tmp_path / 'worlds' / 'good'
    good.mkdir(parents=True)
    (good / CLIENT_NAME).write_bytes(source)
    assert _mismatches(tmp_path, source) == []
    bad = tmp_path / 'worlds' / 'bad'
    bad.mkdir()
    (bad / CLIENT_NAME).write_bytes(source + b'# drifted\n')
    assert _mismatches(tmp_path, source) == [f'worlds/bad/{CLIENT_NAME}']
    (bad / CLIENT_NAME).unlink()
    with zipfile.ZipFile(tmp_path / 'other.apworld', 'w') as packed:
        packed.writestr(f'other/{CLIENT_NAME}', source + b'# drifted\n')
    assert _mismatches(tmp_path, source) == [f'other.apworld!other/{CLIENT_NAME}']


# ---------------------------------------------------- the exporter

def test_the_exporter_keeps_the_option_and_the_record_out_of_rules_json(mw):
    assert hook.OPTION in TRANSPORT_ONLY_OPTIONS
    world = mw.worlds[A1]
    note = {'reason': 'over_cap'}
    with mock.patch.object(world, '_cached_slot_data',
                           {'keep': 1, 'spoiler_data': {'steps': []}, 'spoiler_data_omitted': note}, create=True):
        data = BaseGameExportHandler().get_world_data(world, mw, A1)
    assert data['slot_data'] == {'keep': 1, 'spoiler_data_omitted': note}
    assert hook.OPTION not in data['options'] and hook.OPTION not in data['option_definitions']


def test_a_slot_data_holding_only_the_record_exports_none(mw):
    world = mw.worlds[A1]
    with mock.patch.object(world, '_cached_slot_data', {'spoiler_data': {'steps': []}}, create=True):
        assert 'slot_data' not in BaseGameExportHandler().get_world_data(world, mw, A1)
