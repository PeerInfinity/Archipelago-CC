"""The rules document a world_generator package sends in slot_data (`worldgen_rules`, _embedded_rules.py).

Pins, over every committed package (scripts/data/worldgen-package-recipes.json):
- IDENTITY: the shipped document's game, world game, location name -> id, item name -> id and region set
  equal the package's own exporter export (frontend/presets/<pkg>/AP_14089154938208861744/). That is what
  the client's ID check (checkLocalWorld) compares. procgen_maze_worldgen has no export; it is checked
  against the generated Python's tables instead (as are all the others).
- NO PLACEMENT: after the strip, no object pairs a location with the item the export placed there (the
  research's leak scan, as a test).
- The cap: 0 sends nothing; under the cap sends the envelope; over the cap sends only the omitted note.
- A PACKED .apworld (a zip on sys.path, as AP loads custom_worlds) reads its _worldgen_rules.json and its
  _worldgen_options.json through pkgutil (the old open() path silently ran seed 1 on default options).
"""

import importlib
import json
import re
import sys
import zipfile
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from world_generator._embedded_rules import (  # noqa: E402
    OMITTED_KEY, SLOT_DATA_KEY, WORLDGEN_RULES_FILE, WORLDGEN_RULES_FORMAT, strip_placements)

RECIPES = json.loads((REPO / 'scripts' / 'data' / 'worldgen-package-recipes.json').read_text())['packages']
EXPORT_SEED = 'AP_14089154938208861744'


def _envelope(package):
    return json.loads((REPO / 'worlds' / package / WORLDGEN_RULES_FILE).read_bytes())


def _export(package):
    path = REPO / 'frontend' / 'presets' / package / EXPORT_SEED / f'{EXPORT_SEED}_rules.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else None


def _identity(doc, p):
    locations, regions = {}, set()
    for name, region in doc['regions'][p].items():
        regions.add(name)
        for loc in region.get('locations') or []:
            locations[loc['name']] = loc.get('id')
    items = {name: it.get('id') for name, it in doc['items'][p].items()}
    return {'game': doc['game_name'], 'world_game': doc['world'][p].get('game'),
            'locations': locations, 'items': items, 'regions': regions}


def _placements(doc):
    out = {}
    for regions in doc['regions'].values():
        for region in regions.values():
            for loc in region.get('locations') or []:
                item = loc.get('item')
                if isinstance(item, dict) and item.get('name') and item['name'] != loc['name']:
                    out[loc['name']] = item['name']
    return out


def _leaks(node, placed, path='', hits=None):
    """Paths of objects that still pair a placed location with its placed item."""
    hits = [] if hits is None else hits
    if isinstance(node, dict):
        strings = {v for v in node.values() if isinstance(v, str)} | {k for k, v in node.items() if isinstance(v, str)}
        for key, value in node.items():
            if isinstance(value, str) and placed.get(key) == value:
                hits.append(f'{path}/{key}')
        for loc in strings & set(placed):
            if placed[loc] in strings and placed[loc] != loc:
                hits.append(path)
        for key, value in node.items():
            _leaks(value, placed, f'{path}/{key}', hits)
    elif isinstance(node, list):
        for i, value in enumerate(node):
            _leaks(value, placed, f'{path}[{i}]', hits)
    return hits


@pytest.mark.parametrize('package', sorted(RECIPES))
def test_the_envelope_names_its_format_and_player(package):
    env = _envelope(package)
    assert env['format'] == WORLDGEN_RULES_FORMAT
    assert env['player'] in env['doc']['world']
    assert env['doc']['game_name'] == RECIPES[package]['game_name']


@pytest.mark.parametrize('package', sorted(p for p in RECIPES if _export(p) is not None))
def test_identity_equals_the_packages_own_export(package):
    env, export = _envelope(package), _export(package)
    mine, theirs = _identity(env['doc'], env['player']), _identity(export, '1')
    for key in mine:
        assert mine[key] == theirs[key], f'{package}: {key} differs from its export'


@pytest.mark.parametrize('package', sorted(RECIPES))
def test_identity_equals_the_generated_python(package):
    """The document's ids are the generated world's own tables (the check that covers procgen_maze too)."""
    module = importlib.import_module(f'worlds.{package}')
    world = next(v for v in vars(module).values()
                 if isinstance(v, type) and getattr(v, '__module__', '') == module.__name__
                 and hasattr(v, 'location_name_to_id') and hasattr(v, 'game'))
    env = _envelope(package)
    ident = _identity(env['doc'], env['player'])
    assert ident['game'] == world.game
    assert {n: i for n, i in ident['locations'].items() if i is not None} == dict(world.location_name_to_id)
    assert {n: i for n, i in ident['items'].items() if i is not None} == dict(world.item_name_to_id)


@pytest.mark.parametrize('package', sorted(p for p in RECIPES if _export(p) is not None))
def test_no_placement_survives_the_strip(package):
    """No object in the shipped document pairs a location with the item its export placed there."""
    export = _export(package)
    placed = _placements(export)
    assert placed, f'{package}: the export has no placements to scan for'
    assert _leaks(_envelope(package)['doc'], placed) == []
    assert _leaks(strip_placements(json.loads(json.dumps(export))), placed) == [], \
        'the strip must clean the export itself too (a source that IS an export)'


def test_the_strip_removes_every_listed_field():
    doc = {
        'canonical_placements': {}, 'is_canonical': True, 'generation_seed': 1, 'seed_name': 's',
        'player_names': {}, 'provenance': {}, 'sphere_log': [],
        'world': {'1': {'slot_data': {}, 'canonical_placements': {}, 'is_vanilla': True, 'preset_label': 'x',
                        'er_seed': 1, 'rom_name': 'r', 'options': {'a': 1}}},
        'regions': {'1': {'R': {'locations': [{'name': 'L', 'item': {'name': 'I'}}]}}},
        'preset_sidecars': {'1': {'R': {'playable_payload': {
            'items': [{'id': 'I', 'locationName': 'L'}], 'locations': [{'name': 'L', 'item': 'I'}]}}}},
        'procgen_metadata': {'1': {'sphere_plan': {'spheres': [{'items': ['I']}]}}},
    }
    out = strip_placements(doc)
    assert set(out) == {'world', 'regions', 'preset_sidecars', 'procgen_metadata'}
    assert out['world']['1'] == {'options': {'a': 1}}
    assert out['regions']['1']['R']['locations'] == [{'name': 'L'}]
    assert out['preset_sidecars']['1']['R']['playable_payload'] == {
        'items': [{'locationName': 'L'}], 'locations': [{'name': 'L'}]}
    assert out['procgen_metadata']['1']['sphere_plan']['spheres'][0]['items'] == ['I'], 'sphere_plan is KEPT'


# ---- fill_slot_data and the cap ---------------------------------------------------------------------

class _Opt:
    def __init__(self, value):
        self.value = value


def _fake_world(module, cap_kb, **options):
    base = next(v for v in vars(module).values()
                if isinstance(v, type) and getattr(v, '__module__', '') == module.__name__
                and hasattr(v, '_with_embedded_rules'))
    world = object.__new__(type('FakeWorld', (base,), {'player_name': 'P1'}))
    opts = type('O', (), {})()
    opts.rules_in_slot_data_max_kb = _Opt(cap_kb)
    for name, value in options.items():
        setattr(opts, name, _Opt(value))
    world.options = opts
    return world


def test_the_cap_zero_under_and_over(caplog):
    module = importlib.import_module('worlds.cloudberry_sphere_worldgen')
    size_kb = -(-len((REPO / 'worlds' / 'cloudberry_sphere_worldgen' / WORLDGEN_RULES_FILE).read_bytes()) // 1024)

    assert _fake_world(module, 0)._with_embedded_rules({'k': 1}) == {'k': 1}

    sent = _fake_world(module, size_kb)._with_embedded_rules({'k': 1})
    assert sent['k'] == 1 and OMITTED_KEY not in sent
    assert sent[SLOT_DATA_KEY]['format'] == WORLDGEN_RULES_FORMAT
    assert sent[SLOT_DATA_KEY]['doc']['game_name'] == 'Cloudberry Sphere WorldGen'

    with caplog.at_level('WARNING'):
        over = _fake_world(module, size_kb - 1)._with_embedded_rules({'k': 1})
    assert over == {'k': 1, OMITTED_KEY: {'size_kb': size_kb, 'cap_kb': size_kb - 1, 'reason': 'over_cap'}}
    assert any('rules_in_slot_data_max_kb' in r.getMessage() for r in caplog.records)


def test_the_document_carries_the_rolled_options():
    module = importlib.import_module('worlds.cloudberry_sphere_worldgen')
    sent = _fake_world(module, 1024, randomize_items=True, use_canonical_options=False,
                       accessibility=2)._with_embedded_rules({})
    env = sent[SLOT_DATA_KEY]
    options = env['doc']['world'][env['player']]['options']
    assert options['randomize_items'] is True
    assert options['use_canonical_options'] is False
    assert options['accessibility'] == 2
    assert 'rules_in_slot_data_max_kb' not in options, 'a transport-only option, not exported'


def test_option_effects_resolve_in_the_document():
    """seedling_playthrough: Has(Seal, 16) reads the rolled seals_required, and boss_location_items=filler
    trades the bosses' Seals for Nothing in the pool counts, as the export resolves them."""
    module = importlib.import_module('worlds.seedling_playthrough')
    world = _fake_world(module, 1024, seals_required=9, boss_location_items=1)
    world.canonical_placements = type(world).canonical_placements
    env = world._with_embedded_rules({})[SLOT_DATA_KEY]
    doc, p = env['doc'], env['player']
    counts = [n['args']['count'] for n in _walk(doc['regions'])
              if n.get('rule') == 'Has' and n.get('args', {}).get('item_name') == 'Seal']
    assert counts and set(counts) == {9}
    base = _envelope('seedling_playthrough')['doc']['itempool_counts'][p]
    pool = doc['itempool_counts'][p]
    assert pool['Seal'] == base['Seal'] - 7
    assert pool['Nothing'] == base.get('Nothing', 0) + 7
    assert doc['world'][p]['options']['seals_required'] == 9

    default = _fake_world(module, 1024, seals_required=16, boss_location_items=0)
    default.canonical_placements = type(default).canonical_placements
    assert default._with_embedded_rules({})[SLOT_DATA_KEY] == _envelope('seedling_playthrough'), \
        'at the source options the sent document is the shipped one'


def _walk(node):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from _walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from _walk(value)


# ---- a packed .apworld --------------------------------------------------------------------------------

def test_a_packed_apworld_reads_its_package_json(tmp_path, monkeypatch):
    """Generate a package under a fresh game name, zip it (as `--apworld` packs it), import it through
    zipimport, and read both package files through the generated code: the embedded rules and the
    canonical options."""
    import subprocess
    from worlds.AutoWorld import AutoWorldRegister
    recipe = RECIPES['cloudberry_sphere_worldgen']
    alias, game = 'zz_packed_sphere_worldgen', 'Zz Packed Sphere WorldGen'
    out = tmp_path / 'src' / alias
    cmd = [sys.executable, '-m', 'world_generator', recipe['source'], '--output', str(out), '--game-name', game,
           '--force', '--apply-name-substitutions', '--canonical-seed', '1']
    subprocess.run(cmd, cwd=REPO, check=True, capture_output=True)
    root = tmp_path / 'packed.zip'
    with zipfile.ZipFile(root, 'w') as z:
        for f in out.rglob('*'):
            if f.is_file() and '__pycache__' not in f.parts:
                z.write(f, f'{alias}/{f.relative_to(out)}')
    monkeypatch.syspath_prepend(str(root))
    try:
        module = importlib.import_module(alias)
        assert type(module.__spec__.loader).__name__ == 'zipimporter'
        world_cls = next(v for v in vars(module).values()
                         if isinstance(v, type) and getattr(v, '__module__', '') == alias
                         and hasattr(v, '_with_embedded_rules'))
        sent = _fake_world(module, 1024)._with_embedded_rules({})
        assert sent[SLOT_DATA_KEY]['doc']['game_name'] == game

        # _load_canonical_options: the canonical options land (the old open() path raised
        # NotADirectoryError inside the zip, swallowed it, and kept the defaults).
        canonical = json.loads((out / '_worldgen_options.json').read_text())
        scalars = {k: v for k, v in canonical.items() if isinstance(v, (bool, int))}
        assert scalars
        world = object.__new__(world_cls)
        opts = type('O', (), {})()
        for name in canonical:
            setattr(opts, name, _Opt('UNSET'))
        world.options = opts
        world._load_canonical_options()
        assert {name: getattr(opts, name).value for name in scalars} == scalars
    finally:
        AutoWorldRegister.world_types.pop(game, None)
        for name in [m for m in sys.modules if m == alias or m.startswith(alias + '.')]:
            del sys.modules[name]


def test_the_exporter_drops_the_document_from_the_exported_slot_data():
    """An export of a package must not carry its own document again (world[p].slot_data.worldgen_rules)."""
    src = (REPO / 'exporter' / 'games' / 'base' / 'world_data.py').read_text(encoding='utf-8')
    assert re.search(r"k != 'worldgen_rules'", src)
    for package in sorted(p for p in RECIPES if _export(p) is not None):
        slot_data = _export(package)['world']['1'].get('slot_data') or {}
        assert SLOT_DATA_KEY not in slot_data, f'{package}: the export re-embeds worldgen_rules'
