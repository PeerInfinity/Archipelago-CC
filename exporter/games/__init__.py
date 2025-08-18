"""Game-specific rule helper functions."""

from typing import Dict, Type
from .base import BaseGameExportHandler
from .alttp import ALttPGameExportHandler
from .generic import GenericGameExportHandler
from .adventure import AdventureGameExportHandler
from .shorthike import ShortHikeGameExportHandler
from .ahit import AHitGameExportHandler

# Register game-specific helper expanders
GAME_HANDLERS: Dict[str, Type[BaseGameExportHandler]] = {
    'A Link to the Past': ALttPGameExportHandler,
    'Generic': GenericGameExportHandler,
    'Adventure': AdventureGameExportHandler,
    'A Short Hike': ShortHikeGameExportHandler,
    'A Hat in Time': AHitGameExportHandler,
}

def get_game_export_handler(game_name: str) -> BaseGameExportHandler:
    """Get the appropriate helper expander for the game."""
    handler_class = GAME_HANDLERS.get(game_name, GenericGameExportHandler)
    return handler_class()