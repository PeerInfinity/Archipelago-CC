"""Super Mario Land 2 game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class MarioLand2GameExportHandler(GenericGameExportHandler):
    """Export handler for Super Mario Land 2.

    Super Mario Land 2 uses custom helper functions for pipe traversal,
    auto-scroll checks, level progression, and zone-specific logic.
    We inherit from GenericGameExportHandler to preserve these helpers.
    """
    GAME_NAME = 'Super Mario Land 2'

    # Functions that should be exported as helper calls rather than analyzed
    HELPER_FUNCTIONS = {
        'is_auto_scroll',
        'has_pipe_right',
        'has_pipe_left',
        'has_pipe_down',
        'has_pipe_up',
        'has_level_progression',
        'pumpkin_zone_1_midway_bell',
        'pumpkin_zone_1_normal_exit',
        'not_blocked_by_sharks',
        'turtle_zone_1_normal_exit',
        'mario_zone_1_normal_exit',
        'mario_zone_1_midway_bell',
        'macro_zone_1_normal_exit',
        'macro_zone_1_midway_bell',
        'tree_zone_2_normal_exit',
        'tree_zone_2_secret_exit',
        'tree_zone_2_midway_bell',
        'tree_zone_3_normal_exit',
        'tree_zone_4_normal_exit',
        'tree_zone_4_midway_bell',
        'tree_zone_5_boss',
        'pumpkin_zone_2_normal_exit',
        'pumpkin_zone_2_secret_exit',
        'pumpkin_zone_3_secret_exit',
        'pumpkin_zone_4_boss',
        'mario_zone_1_secret_exit',
        'mario_zone_2_normal_exit',
        'mario_zone_2_secret_exit',
        'mario_zone_3_secret_exit',
        'mario_zone_4_boss',
        'turtle_zone_2_normal_exit',
        'turtle_zone_2_midway_bell',
        'turtle_zone_secret_course_normal_exit',
        'space_zone_1_normal_exit',
        'space_zone_1_secret_exit',
        'space_zone_2_midway_bell',
        'space_zone_2_normal_exit',
        'space_zone_2_secret_exit',
        'space_zone_3_boss',
        'macro_zone_1_secret_exit',
        'macro_zone_2_normal_exit',
        'macro_zone_2_midway_bell',
        'macro_zone_3_boss',
        'mushroom_zone_coins',
        'tree_zone_1_coins',
        'tree_zone_2_coins',
        'tree_zone_3_coins',
        'tree_zone_4_coins',
        'tree_zone_5_coins',
        'pumpkin_zone_1_coins',
        'pumpkin_zone_2_coins',
        'pumpkin_zone_secret_course_1_coins',
        'pumpkin_zone_3_coins',
        'pumpkin_zone_4_coins',
        'mario_zone_1_coins',
        'mario_zone_2_coins',
        'mario_zone_3_coins',
        'mario_zone_4_coins',
        'turtle_zone_1_coins',
        'turtle_zone_2_coins',
        'turtle_zone_secret_course_coins',
        'space_zone_1_coins',
        'space_zone_2_coins',
        'space_zone_3_coins',
        'macro_zone_1_coins',
        'macro_zone_2_coins',
        'macro_zone_3_coins',
        'hippo_zone_coins'
    }

    def should_preserve_as_helper(self, func_name: str) -> bool:
        """Check if a function should be preserved as a helper call."""
        return func_name in self.HELPER_FUNCTIONS
