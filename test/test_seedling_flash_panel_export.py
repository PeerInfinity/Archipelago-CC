"""The Seedling export handler produces the slot's `flash_panel` block; no other world's export gains one.

`exporter/games/unofficial/seedling.py` reads `frontend/modules/procgenPipeline/flashPanelWiring.json`,
the same file `regionAtlasCompiler.js` compiles from. Before it, the seed-1 `seedling` preset's block was
typed by hand and `Generate.py` dropped it. These rows hold the handler to the world directory `seedling`
and to the shared file.
"""

import json
from pathlib import Path

from exporter.games import GAME_HANDLERS, clear_handler_cache, get_game_export_handler
from exporter.games.base import GenericGameExportHandler
from exporter.games.unofficial.seedling import (
    FLASH_PANEL_WIRING_PATH,
    SeedlingExportHandler,
    seedling_flash_panel_wiring,
)

REPO = Path(__file__).resolve().parents[1]
WIRING_FILE = REPO / 'frontend' / 'modules' / 'procgenPipeline' / 'flashPanelWiring.json'
SEED_1_PRESET = REPO / 'frontend' / 'presets' / 'seedling' / 'AP_14089154938208861744' / 'AP_14089154938208861744_rules.json'


def _world_in(module_name):
    """A world object whose class lives in `module_name` (all the handler lookup reads)."""
    world_class = type('FakeWorld', (), {})
    world_class.__module__ = module_name
    return world_class()


def test_the_handler_reads_the_file_the_compiler_reads():
    assert Path(FLASH_PANEL_WIRING_PATH).resolve() == WIRING_FILE
    assert seedling_flash_panel_wiring() == json.loads(WIRING_FILE.read_text(encoding='utf-8'))['seedling']


def test_the_seedling_world_gets_the_handler_and_its_export_carries_the_block():
    clear_handler_cache()
    world = _world_in('worlds.seedling')
    handler = get_game_export_handler(world=world)
    assert isinstance(handler, SeedlingExportHandler)
    for player in (1, 3):
        export_data = {}
        handler.preprocess_world_data(world, export_data, player)
        assert export_data['flash_panel'] == {str(player): seedling_flash_panel_wiring()}
        # Only the block: the upstream world ships no package files, so nothing else is injected.
        assert set(export_data) == {'flash_panel'}


def test_no_other_world_directory_reaches_the_handler():
    clear_handler_cache()
    assert [name for name, cls in GAME_HANDLERS.items() if cls is SeedlingExportHandler] == ['seedling']
    for module_name in ('worlds.seedling_playthrough', 'worlds.seedling_worldgen_absent', 'worlds.checksfinder'):
        world = _world_in(module_name)
        handler = get_game_export_handler(world=world)
        assert not isinstance(handler, SeedlingExportHandler), module_name


def test_a_non_seedling_export_gains_no_block():
    clear_handler_cache()
    world = _world_in('fake_upstream_world_without_package_files')
    handler = get_game_export_handler(world=world)
    assert type(handler) is GenericGameExportHandler
    export_data = {}
    handler.preprocess_world_data(world, export_data, 1)
    assert 'flash_panel' not in export_data


def test_the_committed_seed_1_preset_carries_exactly_the_produced_block():
    doc = json.loads(SEED_1_PRESET.read_text(encoding='utf-8'))
    assert doc['flash_panel'] == {'1': seedling_flash_panel_wiring()}
