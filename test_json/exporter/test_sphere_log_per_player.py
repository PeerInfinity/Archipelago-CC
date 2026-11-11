"""`json_tools.sphere_log_per_player`: one filtered sphere log per player, beside the combined one.

Robert (2026-11-09): "an option for it to only include the entries from other worlds that give items to the current
world", off by default and in every preset. For player P the file holds P's own entries, plus, on a line where another
world Q's location gives P an item, Q's entry limited to those locations with empty deltas. The combined file must not
change at all, so these run the real logger on a real three-slot multiworld and compare against it.
"""
import json
import types
from pathlib import Path
from unittest import mock

import pytest

from BaseClasses import CollectionState  # noqa: F401  (loads BaseClasses before worlds, as AP does)
from Fill import distribute_items_restrictive
from test.general import setup_multiworld
from worlds.AutoWorld import AutoWorldRegister

import exporter.sphere_logger as logger
from exporter.exporter import _preset_artifact_names

GAMES = ['APQuest ServerData', 'APQuest ServerData', 'DepGraph']
EMPTY = {'new_inventory_details': {'base_items': {}, 'resolved_items': {}},
         'new_accessible_locations': [], 'new_accessible_regions': []}


def _settings(**overrides):
    base = dict(log_fractional_sphere_details=True, log_integer_sphere_details=False, verbose_sphere_log=False,
                extend_sphere_log_to_all_locations=False, auto_collect_events=False, filter_event_items=False)
    return types.SimpleNamespace(**{**base, **overrides})


def _multiworld(games=GAMES, seed=1):
    multiworld = setup_multiworld([AutoWorldRegister.world_types[game] for game in games], seed=seed)
    distribute_items_restrictive(multiworld)
    return multiworld


@pytest.fixture(scope='module')
def multiworld():
    return _multiworld()


def _run(multiworld, out_dir, settings):
    """The logger as the export hook runs it; returns {filename: [parsed lines]} of what it wrote."""
    out_dir.mkdir(parents=True, exist_ok=True)
    multiworld.temp_dir_for_sphere_log = str(out_dir)
    saved = getattr(multiworld.spoiler, 'playthrough', None)
    try:
        with mock.patch('worlds.json_tools_installer.json_tools_settings.get_json_tools_settings',
                        return_value=settings):
            logger.create_playthrough_with_logging(multiworld.spoiler, create_paths=False)
    finally:
        multiworld.spoiler.playthrough = saved
        del multiworld.temp_dir_for_sphere_log
    return {path.name: path.read_bytes() for path in sorted(out_dir.iterdir())}


def _lines(raw):
    return [json.loads(line) for line in raw.decode().splitlines()]


def _combined(multiworld):
    return f'AP_{multiworld.seed_name}_sphere_log.jsonl'


def _per_player(multiworld, player):
    return logger.per_player_log_filename(str(multiworld.seed_name), player)


MODES = {
    'minimal': {},
    'all_locations': {'extend_sphere_log_to_all_locations': True},
    'integer_spheres_too': {'extend_sphere_log_to_all_locations': True, 'log_integer_sphere_details': True},
}


@pytest.mark.parametrize('mode', MODES)
def test_off_writes_only_the_combined_file_and_on_leaves_it_byte_identical(multiworld, tmp_path, mode):
    off = _run(multiworld, tmp_path / 'off', _settings(**MODES[mode]))
    default = _run(multiworld, tmp_path / 'default', _settings(**MODES[mode], sphere_log_per_player=False))
    on = _run(multiworld, tmp_path / 'on', _settings(**MODES[mode], sphere_log_per_player=True))
    assert list(off) == [_combined(multiworld)] and off == default
    assert sorted(on) == sorted([_combined(multiworld)] + [_per_player(multiworld, p) for p in multiworld.player_ids])
    assert on[_combined(multiworld)] == off[_combined(multiworld)]


def _expected_givers(multiworld, line, player):
    """{other world: sorted location names} of this line's locations whose item goes to `player`."""
    givers = {}
    for key, entry in line['player_data'].items():
        if int(key) == player:
            continue
        for name in entry['sphere_locations']:
            location = multiworld.get_location(name, int(key))
            if location.item and location.item.player == player:
                givers.setdefault(key, []).append(name)
    return {key: sorted(names) for key, names in givers.items()}


def _about(entry):
    inventory = entry['new_inventory_details']
    return bool(entry['sphere_locations'] or inventory['base_items'] or inventory['resolved_items']
                or entry['new_accessible_locations'] or entry['new_accessible_regions'])


@pytest.mark.parametrize('mode', MODES)
def test_each_players_file_is_its_entries_and_its_senders_only(multiworld, tmp_path, mode):
    written = _run(multiworld, tmp_path, _settings(**MODES[mode], sphere_log_per_player=True))
    combined = _lines(written[_combined(multiworld)])
    senders_seen = 0
    for player in multiworld.player_ids:
        key = str(player)
        mine = _lines(written[_per_player(multiworld, player)])
        assert mine[0] == {**combined[0], 'filtered_to_player': key}
        expected = []
        for line in combined[1:]:
            givers = _expected_givers(multiworld, line, player)
            own = line['player_data'][key]
            if line['sphere_index'] == '0':
                expected.append({**line, 'player_data': {key: own}})
            elif givers or _about(own):
                data = {key: own, **{giver: {**EMPTY, 'sphere_locations': names} for giver, names in givers.items()}}
                expected.append({**line, 'player_data': {k: data[k] for k in sorted(data, key=int)}})
                senders_seen += len(givers)
        assert mine[1:] == expected
        assert len(mine) < len(combined), 'a filter that keeps every line filters nothing on this seed'
    assert senders_seen > 0, 'no item crossed worlds at this seed, so the sender path was not driven'


def test_at_a_fractional_step_a_senders_entry_is_its_real_entry(multiworld, tmp_path):
    """The givers' entries are built, not copied; at a fractional step they must still equal the combined file's."""
    written = _run(multiworld, tmp_path, _settings(extend_sphere_log_to_all_locations=True, sphere_log_per_player=True))
    combined = {line['sphere_index']: line for line in _lines(written[_combined(multiworld)])[1:]}
    checked = 0
    for player in multiworld.player_ids:
        for line in _lines(written[_per_player(multiworld, player)])[1:]:
            for key, entry in line['player_data'].items():
                if key != str(player):
                    assert entry == combined[line['sphere_index']]['player_data'][key]
                    checked += 1
    assert checked > 0


def test_verbose_mode_keeps_the_senders_locations_only(multiworld, tmp_path):
    written = _run(multiworld, tmp_path, _settings(verbose_sphere_log=True, sphere_log_per_player=True))
    for player in multiworld.player_ids:
        lines = _lines(written[_per_player(multiworld, player)])
        assert lines[1]['sphere_index'] == '0', 'a verbose entry has no delta, so sphere 0 must be kept by its index'
        for line in lines[1:]:
            for key, entry in line['player_data'].items():
                if key != str(player):
                    assert list(entry) == ['sphere_locations'] and entry['sphere_locations']


def test_a_single_player_seed_writes_no_per_player_file(tmp_path):
    single = _multiworld(['APQuest ServerData'])
    written = _run(single, tmp_path, _settings(sphere_log_per_player=True))
    assert list(written) == [_combined(single)]


def test_the_preset_copy_names_the_per_player_logs_only_when_the_setting_is_on():
    base = 'AP_1'
    off = _preset_artifact_names(base, [1, 2])
    on = _preset_artifact_names(base, [1, 2], True)
    assert not any('_P1_sphere_log' in name for name in off)
    assert on == off + ['AP_1_P1_sphere_log.jsonl', 'AP_1_P2_sphere_log.jsonl']
    assert _preset_artifact_names(base, [1], True) == _preset_artifact_names(base, [1])


def test_the_setting_is_off_by_default_and_in_no_preset():
    from worlds.json_tools_installer.config import EXPORT_PRESETS, ExportSettings
    from worlds.json_tools_installer.json_tools_settings import JSONToolsSettings
    assert JSONToolsSettings.sphere_log_per_player is False and ExportSettings.sphere_log_per_player is False
    assert all('sphere_log_per_player' not in preset['json_tools'] for preset in EXPORT_PRESETS.values())
    # update_host_settings.py's presets: read as text, never run (it rewrites host.yaml).
    script = Path(__file__).resolve().parents[2] / 'scripts' / 'setup' / 'update_host_settings.py'
    assert 'sphere_log_per_player' not in script.read_text(encoding='utf-8')


def test_a_line_with_only_a_delta_for_the_player_is_kept():
    """auto_collect_events can give a player items on a step that is not its own: that line is about it too."""
    quiet = {**EMPTY, 'sphere_locations': []}
    swept = {**quiet, 'new_inventory_details': {'base_items': {'Event': 1}, 'resolved_items': {}}}
    line = {'type': 'state_update', 'sphere_index': '1.2', 'player_data': {1: swept, 2: quiet}}
    assert logger.filter_entry_for_player(line, 1, set())['player_data'] == {'1': swept}
    assert logger.filter_entry_for_player(line, 2, set()) is None
