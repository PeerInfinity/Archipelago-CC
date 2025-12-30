"""Yoshi's Island game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class YoshisIslandGameExportHandler(GenericGameExportHandler):
    """Export handler for Yoshi's Island.

    Inherits from GenericGameExportHandler for default behavior.
    Uses HELPER_OBJECT_NAMES to convert logic.method and bosses.method to helpers.
    """

    # Include 'logic' and 'bosses' for helper conversion
    # The base class handles converting logic.method() and bosses.method() to helper calls
    HELPER_OBJECT_NAMES = {'self', 'world', 'logic', 'bosses'}

    # Whitelist helpers that should always be exported
    # (helper modules are auto-discovered from world directory)
    HELPERS_TO_EXPORT_WHITELIST = {
        # BossReqs class helpers
        'castle_access',
        'castle_clear',
        # YoshiLogic class helpers - needed for location access rules
        'has_midring',
        'reconstitute_luigi',
        'bandit_bonus',
        'item_bonus',
        'combat_item',
        'melon_item',
        'default_vis',
        'cansee_clouds',
        'bowserdoor_1',
        'bowserdoor_2',
        'bowserdoor_3',
        'bowserdoor_4',
    }

    # Preserve these helpers as helper calls (don't try to auto-expand them)
    HELPERS_TO_PRESERVE = HELPERS_TO_EXPORT_WHITELIST

    def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract Yoshi's Island world data including computed settings for helpers."""
        world_data = super().get_world_data(world, multiworld, player)

        # Default values for Yoshi's Island options
        OPTION_DEFAULTS = {
            'stage_logic': 0,
            'hidden_object_visibility': 1,
            'shuffle_midrings': 0,
            'item_logic': 0,
            'bowser_door_mode': 0,
            'luigi_pieces_required': 25,
            'castle_clear_condition': 0,
            'castle_open_condition': 5,
        }

        def extract_option(option_name):
            option = getattr(world.options, option_name, None)
            value = getattr(option, 'value', option)
            if value is None:
                return OPTION_DEFAULTS.get(option_name)
            return value

        if hasattr(world, 'options'):
            # Computed values for YoshiLogic helpers
            # (raw options are auto-exported by base class under 'options')
            stage_logic = extract_option('stage_logic')
            if stage_logic == 0:
                world_data['game_logic'] = "Easy"
            elif stage_logic == 1:
                world_data['game_logic'] = "Normal"
            else:
                world_data['game_logic'] = "Hard"

            world_data['midring_start'] = not extract_option('shuffle_midrings')
            world_data['clouds_always_visible'] = extract_option('hidden_object_visibility') >= 2
            world_data['consumable_logic'] = not extract_option('item_logic')

            bowser_door = extract_option('bowser_door_mode')
            if bowser_door == 4:
                bowser_door = 3
            world_data['bowser_door'] = bowser_door
            world_data['luigi_pieces'] = extract_option('luigi_pieces_required')

            # Export boss_order for _xxCanFightBoss helpers
            if hasattr(world, 'boss_order') and world.boss_order:
                world_data['boss_order'] = list(world.boss_order)
            else:
                world_data['boss_order'] = [
                    "Burt The Bashful's Boss Room",
                    "Salvo The Slime's Boss Room",
                    "Bigger Boo's Boss Room",
                    "Roger The Ghost's Boss Room",
                    "Prince Froggy's Boss Room",
                    "Naval Piranha's Boss Room",
                    "Marching Milde's Boss Room",
                    "Hookbill The Koopa's Boss Room",
                    "Sluggy The Unshaven's Boss Room",
                    "Raphael The Raven's Boss Room",
                    "Tap-Tap The Red Nose's Boss Room"
                ]

            # Settings for BossReqs class helpers
            world_data['castle_unlock'] = extract_option('castle_open_condition')
            world_data['boss_unlock'] = extract_option('castle_clear_condition')

        return world_data
