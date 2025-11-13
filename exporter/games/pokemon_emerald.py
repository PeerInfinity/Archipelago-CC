# exporter/games/pokemon_emerald.py

from .base import BaseGameExportHandler
from typing import Any, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class PokemonEmeraldGameExportHandler(BaseGameExportHandler):
    GAME_NAME = 'Pokemon Emerald'
    """Pokemon Emerald specific export handler."""

    def __init__(self, world=None):
        super().__init__()
        self.world = world

    def get_game_info(self, world) -> Dict[str, Any]:
        """Export Pokemon Emerald specific game information."""
        game_info = super().get_game_info(world)

        # Export hm_requirements which maps HM names to badge requirements
        # This is used to build hm_rules in the frontend
        if hasattr(world, 'hm_requirements'):
            game_info['hm_requirements'] = world.hm_requirements
        else:
            game_info['hm_requirements'] = {}

        return game_info

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export Pokemon Emerald specific settings."""
        # Get base settings
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Also include hm_requirements in settings for easy access
        if hasattr(world, 'hm_requirements'):
            settings_dict['hm_requirements'] = world.hm_requirements

        return settings_dict
