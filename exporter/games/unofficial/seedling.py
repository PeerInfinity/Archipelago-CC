"""Seedling export handler (community apworld, worlds/seedling — the UNMODIFIED upstream world).

It does one thing beyond the generic handler: it writes the slot's `flash_panel` block, the wiring
that boots the recompiled game in the flash panel. Before this handler that block was typed into the
seed-1 `seedling` preset by hand, and every `Generate.py` regeneration dropped it.

The wiring is read from `frontend/modules/procgenPipeline/flashPanelWiring.json`, the same file
`regionAtlasCompiler.js` (`FLASH_PANEL_WIRING`) compiles from, so a build bump moves one file.
Discovery registers this module by its name, which matches the world directory `seedling` only.
`seedling_playthrough` and any `*_worldgen` package are other directories and never reach it.
"""

import json
import os
from typing import Any, Dict

from ..base import GenericGameExportHandler

FLASH_PANEL_WIRING_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..', '..',
    'frontend', 'modules', 'procgenPipeline', 'flashPanelWiring.json',
)
WIRING_GAME = 'seedling'


def seedling_flash_panel_wiring() -> Dict[str, Any]:
    """The Seedling entry of the shared wiring file (a fresh dict on each call)."""
    with open(FLASH_PANEL_WIRING_PATH, encoding='utf-8') as f:
        return json.load(f)[WIRING_GAME]


class SeedlingExportHandler(GenericGameExportHandler):
    """Export handler for Seedling: the generic export plus the slot's `flash_panel` wiring."""

    GAME_NAME = 'Seedling'

    def preprocess_world_data(self, world, export_data: Dict[str, Any], player: int) -> None:
        super().preprocess_world_data(world, export_data, player)
        export_data.setdefault('flash_panel', {})[str(player)] = seedling_flash_panel_wiring()
