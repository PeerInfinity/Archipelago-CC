"""The Wind Waker game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class TWWGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'The Wind Waker'

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract The Wind Waker settings including logic configuration values."""
        # Get base settings
        settings = super().get_settings_data(world, multiworld, player)

        # Add TWW-specific logic values that are used in state_method calls
        # These are calculated during world initialization and stored as world attributes
        logic_attrs = [
            'logic_in_swordless_mode',
            'logic_in_required_bosses_mode',
            'logic_obscure_1',
            'logic_obscure_2',
            'logic_obscure_3',
            'logic_precise_1',
            'logic_precise_2',
            'logic_precise_3',
            'logic_rematch_bosses_skipped',
            'logic_tuner_logic_enabled',
        ]

        for attr in logic_attrs:
            try:
                if hasattr(world, attr):
                    settings[attr] = bool(getattr(world, attr))
                else:
                    settings[attr] = False  # Default value
            except Exception as e:
                logger.error(f"Error extracting {attr}: {e}")
                settings[attr] = False

        return settings
