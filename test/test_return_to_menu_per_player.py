"""`return_to_menu` is PER PLAYER, in `exporter["<p>"]` beside `assume_bidirectional_exits` (rules re-closing locks;
user ruling 2026-10-05: *"I want the logic to be aware that returning to the menu at any point is always
possible."* — a flag, never an edge; frontend/modules/procgenCore/restartWarp.js).

It rides the same Python path as F1's flag (test_assume_bidirectional_exits_per_player.py), one row per leg:
- the SLICER: a `_P<n>` export carries `exporter[n]` and no other slot's block;
- the HANDLER: a world_generator world's `return_to_menu` class attribute is written back into the exporting
  slot's block, only when True (absent = false);
- the ROUND TRIP: a committed Seedling preset that declares it → world_generator → the generated world class →
  the handler gives it back; a source without it generates no attribute.
"""
import importlib
import json
import sys
from pathlib import Path

import pytest

from exporter.exporter import PLAYER_SPECIFIC_KEYS, create_ordered_export_data
from exporter.games.base.handler import BaseGameExportHandler


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "frontend/presets/seedling_spiral_room/AP_1/AP_1_rules.json"
KEY = "return_to_menu"


def test_a_player_slice_carries_only_its_own_exporter_block():
    combined = {"regions": {"1": {}, "2": {}}, "exporter": {"1": {KEY: True}, "2": {}}}
    assert "exporter" in PLAYER_SPECIFIC_KEYS
    assert create_ordered_export_data(combined, player_id="1")["exporter"] == {"1": {KEY: True}}
    sliced2 = create_ordered_export_data(combined, player_id="2")
    assert KEY not in json.dumps(sliced2.get("exporter", {}))


class _Handler(BaseGameExportHandler):
    pass


def _world(**attrs):
    return type("FakeWorld", (), attrs)()


def test_the_handler_writes_it_only_from_a_true_world_attribute():
    assert KEY not in _Handler().get_exporter_settings(_world())
    assert _Handler().get_exporter_settings(_world(return_to_menu=True))[KEY] is True
    assert KEY not in _Handler().get_exporter_settings(_world(return_to_menu=False))
    assert KEY not in _Handler().get_exporter_settings(_world(return_to_menu="yes"))


_MODULES = []
_GAMES = []


@pytest.fixture
def generated_world_import(tmp_path):
    """Imports a generated package for one row, then UNREGISTERS it (AutoWorldRegister is global)."""
    from worlds.AutoWorld import AutoWorldRegister

    yield tmp_path
    while _GAMES:
        AutoWorldRegister.world_types.pop(_GAMES.pop(), None)
    while _MODULES:
        for name in [m for m in sys.modules if m == _MODULES[-1] or m.startswith(_MODULES[-1] + ".")]:
            sys.modules.pop(name, None)
        _MODULES.pop()
    sys.path[:] = [p for p in sys.path if p != str(tmp_path)]


def test_the_world_generator_round_trip_keeps_the_slots_flag(generated_world_import):
    from world_generator.generator import WorldGenerator

    tmp_path = generated_world_import
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    assert source["exporter"]["1"][KEY] is True and KEY not in source  # the premise, read off the preset
    src = tmp_path / "source_rules.json"
    src.write_text(json.dumps(source), encoding="utf-8")

    pkg = "r2m_roundtrip"
    game = "R2M Roundtrip"
    gen = WorldGenerator(str(src), output_dir=str(tmp_path / pkg), game_name=game, force=True, player_id="1")
    gen.load()
    gen.generate()
    assert f"{KEY}: ClassVar[bool] = True" in (tmp_path / pkg / "__init__.py").read_text(encoding="utf-8")

    if str(tmp_path) not in sys.path:
        sys.path.insert(0, str(tmp_path))
    importlib.invalidate_caches()
    _MODULES.append(pkg)
    _GAMES.append(game)
    importlib.import_module(pkg)
    from worlds.AutoWorld import AutoWorldRegister
    world = object.__new__(AutoWorldRegister.world_types[game])
    assert _Handler().get_exporter_settings(world)[KEY] is True


def test_a_source_without_the_flag_generates_no_attribute(tmp_path):
    from world_generator.generator import WorldGenerator

    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    source["exporter"]["1"].pop(KEY)
    src = tmp_path / "source_rules.json"
    src.write_text(json.dumps(source), encoding="utf-8")
    gen = WorldGenerator(str(src), output_dir=str(tmp_path / "out"), force=True, player_id="1")
    gen.load()
    gen.generate()
    assert KEY not in (tmp_path / "out" / "__init__.py").read_text(encoding="utf-8")
