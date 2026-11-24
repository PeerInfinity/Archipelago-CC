"""Hand-written worlds that ship their own rules document send it in slot_data (sdc-embed-handwritten-rules).

Baking Adventure and Coding Adventure carry ``_embedded_rules.json`` (their seed-1 export, stripped of every
placement) and send it as ``worldgen_rules``, so a web client with no preset for the room plays it
(⚖ Robert 2026-11-15: "Embed their rules"). These rows hold:

- freshness: the committed file is byte for byte what ``scripts/test/check-handwritten-embedded-rules.py``
  rebuilds from the world's current Python, and the check goes red on a stale file;
- the document is the committed seed-1 preset's, stripped (the preset and the embedded file agree);
- no placement: no ID-bearing location keeps an item; no slot_data copy, no canonical placements;
- the world sends it: ``fill_slot_data`` carries the envelope under the names the client reads, equal to
  world_generator's (the worlds keep their own copy so they load on plain upstream Archipelago);
- the tracked .apworld carries the same bytes.
"""

import importlib.util
import json
import zipfile
from pathlib import Path

import pytest

from test.general import setup_multiworld
from world_generator import _embedded_rules as wg
from world_generator._embedded_rules import strip_placements

REPO = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location(
    'check_handwritten_embedded_rules', REPO / 'scripts' / 'test' / 'check-handwritten-embedded-rules.py')
assert _spec is not None and _spec.loader is not None
check_lib = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(check_lib)

SEED1 = 'AP_14089154938208861744'
WORLDS = {
    'bakingadventure': ('worlds.bakingadventure', 'BakingAdventureWorld', 'Baking Adventure'),
    'codingadventure': ('worlds.codingadventure', 'CodingAdventureWorld', 'Coding Adventure'),
}


def _envelope(directory):
    return json.loads((REPO / 'worlds' / directory / check_lib.EMBEDDED_FILE).read_bytes())


def test_the_enrolled_worlds_are_baking_and_coding():
    assert check_lib.enrolled_worlds(REPO) == sorted(WORLDS)


@pytest.mark.parametrize('directory', sorted(WORLDS))
def test_the_embedded_document_is_what_the_world_exports(directory, tmp_path):
    problem = check_lib.check(directory, str(tmp_path))
    assert problem is None, f'{problem}. Rebuild: python scripts/test/check-handwritten-embedded-rules.py --write {directory}'


def test_the_check_is_red_on_a_stale_document(tmp_path):
    """A committed file one rule away from the world's Python fails, naming the file."""
    directory = 'bakingadventure'
    envelope = _envelope(directory)
    region = next(iter(envelope['doc']['regions']['1'].values()))
    region['locations'][0]['access_rule'] = {'type': 'constant', 'value': True}
    stale_root = tmp_path / 'root'
    (stale_root / 'worlds' / directory).mkdir(parents=True)
    (stale_root / 'worlds' / directory / check_lib.EMBEDDED_FILE).write_text(
        json.dumps(envelope, separators=(',', ':'), sort_keys=True), encoding='utf-8')
    problem = check_lib.check(directory, str(tmp_path), root=stale_root)
    assert problem and 'is stale' in problem and f'worlds/{directory}/' in problem


@pytest.mark.parametrize('directory', sorted(WORLDS))
def test_the_document_is_the_seed1_preset_stripped(directory):
    preset = json.loads((REPO / 'frontend' / 'presets' / directory / SEED1 / f'{SEED1}_rules.json').read_bytes())
    assert _envelope(directory)['doc'] == strip_placements(preset)


@pytest.mark.parametrize('directory', sorted(WORLDS))
def test_the_document_carries_no_placement(directory):
    envelope = _envelope(directory)
    assert envelope['format'] == wg.WORLDGEN_RULES_FORMAT and envelope['player'] == '1'
    doc = envelope['doc']
    assert doc['world']['1']['game'] == WORLDS[directory][2]
    for key in wg.SEED_KEYS:
        assert key not in doc, key
    for key in wg.WORLD_SEED_KEYS:
        assert key not in doc['world']['1'], key
    locations = [loc for region in doc['regions']['1'].values() for loc in region['locations']]
    assert any(loc.get('id') is not None for loc in locations)
    assert [loc['name'] for loc in locations if loc.get('id') is not None and 'item' in loc] == []


@pytest.mark.parametrize('directory', sorted(WORLDS))
def test_fill_slot_data_sends_the_document(directory):
    module_name, class_name, _game = WORLDS[directory]
    module = importlib.import_module(module_name)
    assert (module.EMBEDDED_RULES_KEY, module.EMBEDDED_RULES_OMITTED_KEY, module.EMBEDDED_RULES_MAX_KB) == (
        wg.SLOT_DATA_KEY, wg.OMITTED_KEY, wg.CAP_DEFAULT_KB)
    assert module.EMBEDDED_RULES_FILE == check_lib.EMBEDDED_FILE
    multiworld = setup_multiworld(getattr(module, class_name), ('generate_early',), 1)
    slot_data = multiworld.worlds[1].fill_slot_data()
    assert slot_data[wg.SLOT_DATA_KEY] == _envelope(directory)
    assert wg.OMITTED_KEY not in slot_data
    assert slot_data['reports_goal_by_server_item'] is True


@pytest.mark.parametrize('directory', sorted(WORLDS))
def test_the_tracked_apworld_carries_the_same_document(directory):
    with zipfile.ZipFile(REPO / 'apworlds' / f'{directory}.apworld') as zf:
        packed = zf.read(f'{directory}/{check_lib.EMBEDDED_FILE}')
    assert packed == (REPO / 'worlds' / directory / check_lib.EMBEDDED_FILE).read_bytes()
