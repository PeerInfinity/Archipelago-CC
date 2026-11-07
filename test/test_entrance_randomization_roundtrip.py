"""ENTRANCE RANDOMIZATION E2 — the per-exit `er` and the per-player `entrance_randomization` block survive the
Python round trip: rules.json → world_generator → the generated world package → the exporter, by PRESENCE.

- the GENERATOR writes the slot's block to `_worldgen_entrance_randomization.json` and its exits' `er` (by exit
  name) to `_worldgen_exit_er.json`; a slot with neither writes neither file;
- it REFUSES, by name, an `er` on an exit name two regions share (an `er` names its reverse and the block's
  placements by name; the runtime loader refuses the same document);
- the EXPORTER, over the REAL generated world (imported, built by `setup_solo_multiworld`, its regions walked
  by `process_regions`), re-attaches every `er` to its exit and re-injects the block under the exporting player;
- the key is ordered and sliced per player like every other per-player block.

(A Python round trip has dropped atlas blocks by PRESENCE before — so each leg asserts the key is THERE.)
"""
import importlib
import json
import sys
from pathlib import Path

import pytest

from exporter.exporter import DESIRED_KEY_ORDER, PLAYER_SPECIFIC_KEYS, create_ordered_export_data, process_regions
from exporter.games.base.handler import BaseGameExportHandler


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "frontend/presets/seedling_spiral_room/AP_1/AP_1_rules.json"
KEY = "entrance_randomization"

BLOCK = {
    "algorithm": "ger",
    "coupled": True,
    "target_group_lookup": {"south": ["north"], "north": ["south"]},
    "seed": 12345,
    "source": {"atlas_id": "er-roundtrip"},
    "placements": [{"exit": "exit_S", "target": "back_N"}],
}
ER = {
    "exit_S": {"group": "south", "type": "two_way", "reverse": "back_N", "shuffle": True},
    "back_N": {"group": "north", "type": "two_way", "reverse": "exit_S", "shuffle": True},
    "GameStart": {"group": "start", "type": "one_way", "shuffle": False},
}


def _source_with_er():
    """The committed spiral-room preset, with one exit renamed so a coupled pair has two unique names
    (`region_0_1`'s `exit_0` → `back_N`; the preset's `exit_<n>` names repeat across regions), `er` on three
    exits and the slot's block."""
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    assert KEY not in source  # the premise: no committed preset carries the block
    regions = source["regions"]["1"]
    back = [e for e in regions["region_0_1"]["exits"] if e["name"] == "exit_0"]
    assert len(back) == 1 and back[0]["connected_region"] == "region_0_0"
    back[0]["name"] = "back_N"
    for region in regions.values():
        for ex in region["exits"]:
            if ex["name"] in ER:
                ex["er"] = ER[ex["name"]]
    source[KEY] = {"1": BLOCK}
    return source


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


def _generate(tmp_path, source, pkg, game=None):
    from world_generator.generator import WorldGenerator

    src = tmp_path / f"{pkg}_source_rules.json"
    src.write_text(json.dumps(source), encoding="utf-8")
    gen = WorldGenerator(str(src), output_dir=str(tmp_path / pkg), game_name=game, force=True, player_id="1")
    gen.load()
    gen.generate()
    return tmp_path / pkg


def test_the_generator_writes_both_files_and_the_exporter_gives_both_back(generated_world_import):
    tmp_path = generated_world_import
    pkg, game = "er_roundtrip", "ER Roundtrip"
    out = _generate(tmp_path, _source_with_er(), pkg, game)
    assert json.loads((out / "_worldgen_entrance_randomization.json").read_text(encoding="utf-8")) == BLOCK
    assert json.loads((out / "_worldgen_exit_er.json").read_text(encoding="utf-8")) == ER

    if str(tmp_path) not in sys.path:
        sys.path.insert(0, str(tmp_path))
    importlib.invalidate_caches()
    _MODULES.append(pkg)
    _GAMES.append(game)
    importlib.import_module(pkg)
    from worlds.AutoWorld import AutoWorldRegister
    from test.general import setup_solo_multiworld

    multiworld = setup_solo_multiworld(AutoWorldRegister.world_types[game], ("generate_early", "create_regions"))
    world = multiworld.worlds[1]
    handler = BaseGameExportHandler(world)
    export_data = {}
    handler.preprocess_world_data(world, export_data, 1)
    assert export_data[KEY] == {"1": BLOCK}  # PRESENCE, under the exporting player

    regions, _ = process_regions(multiworld, 1, handler, {})
    exported = {ex["name"]: ex for region in regions.values() for ex in region.get("exits", [])}
    for name, er in ER.items():
        assert exported[name].get("er") == er, name
    others = [n for n, ex in exported.items() if n not in ER]
    assert others and all("er" not in exported[n] for n in others)


def test_a_slot_without_er_writes_neither_file(tmp_path):
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    out = _generate(tmp_path, source, "no_er")
    assert not (out / "_worldgen_entrance_randomization.json").exists()
    assert not (out / "_worldgen_exit_er.json").exists()


def test_an_er_on_a_shared_exit_name_is_refused_by_name(tmp_path):
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    shared = [ex for region in source["regions"]["1"].values() for ex in region["exits"] if ex["name"] == "exit_0"]
    assert len(shared) > 1  # the premise: procgen's exit names repeat across regions
    shared[0]["er"] = {"group": "g", "type": "one_way", "shuffle": False}
    with pytest.raises(ValueError, match=r"exit 'exit_0' .*carries `er`.*share that name"):
        _generate(tmp_path, source, "shared_er")


def test_a_package_without_the_files_exports_no_er(tmp_path):
    world = type("FakeWorld", (), {})()
    handler = BaseGameExportHandler(world)
    export_data = {}
    handler.preprocess_world_data(world, export_data, 1)
    assert KEY not in export_data
    assert handler.get_worldgen_exit_er("exit_S") is None


def test_the_block_is_ordered_and_sliced_per_player():
    assert KEY in DESIRED_KEY_ORDER and KEY in PLAYER_SPECIFIC_KEYS
    combined = {"regions": {"1": {}, "2": {}}, KEY: {"1": BLOCK, "2": {**BLOCK, "seed": 2}}}
    assert create_ordered_export_data(combined, player_id="2")[KEY] == {"2": {**BLOCK, "seed": 2}}
    assert create_ordered_export_data(combined, player_id="1")[KEY] == {"1": BLOCK}
