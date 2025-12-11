"""The Wind Waker game-specific export handler."""

from typing import Dict, Any, Set
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class TWWGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'The Wind Waker'
    # Enable automatic helper export to export discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = True

    # Define where to find helper functions
    HELPER_MODULES = ['worlds.tww.Macros']

    # Entrance access helpers that are dynamically called via getattr and not discovered
    # during static rule analysis. These must be explicitly whitelisted for export.
    HELPERS_TO_EXPORT_WHITELIST: Set[str] = {
        # Boss entrance functions
        'can_access_boss_entrance_in_dragon_roost_cavern',
        'can_access_boss_entrance_in_earth_temple',
        'can_access_boss_entrance_in_forbidden_woods',
        'can_access_boss_entrance_in_forsaken_fortress',
        'can_access_boss_entrance_in_tower_of_the_gods',
        'can_access_boss_entrance_in_wind_temple',
        # Dungeon entrance functions
        'can_access_dungeon_entrance_in_forest_haven_sector',
        'can_access_dungeon_entrance_in_tower_of_the_gods_sector',
        'can_access_dungeon_entrance_on_dragon_roost_island',
        'can_access_dungeon_entrance_on_gale_isle',
        'can_access_dungeon_entrance_on_headstone_island',
        # Fairy fountain entrance functions
        'can_access_fairy_fountain_entrance_on_eastern_fairy_island',
        'can_access_fairy_fountain_entrance_on_northern_fairy_island',
        'can_access_fairy_fountain_entrance_on_outset_island',
        'can_access_fairy_fountain_entrance_on_southern_fairy_island',
        'can_access_fairy_fountain_entrance_on_thorned_fairy_island',
        'can_access_fairy_fountain_entrance_on_western_fairy_island',
        # Inner entrance functions
        'can_access_inner_entrance_in_cliff_plateau_isles_secret_cave',
        'can_access_inner_entrance_in_ice_ring_isle_secret_cave',
        # Miniboss entrance functions
        'can_access_miniboss_entrance_in_earth_temple',
        'can_access_miniboss_entrance_in_forbidden_woods',
        'can_access_miniboss_entrance_in_hyrule_castle',
        'can_access_miniboss_entrance_in_tower_of_the_gods',
        'can_access_miniboss_entrance_in_wind_temple',
        # Secret cave entrance functions
        'can_access_secret_cave_entrance_on_angular_isles',
        'can_access_secret_cave_entrance_on_birds_peak_rock',
        'can_access_secret_cave_entrance_on_boating_course',
        'can_access_secret_cave_entrance_on_bomb_island',
        'can_access_secret_cave_entrance_on_cliff_plateau_isles',
        'can_access_secret_cave_entrance_on_diamond_steppe_island',
        'can_access_secret_cave_entrance_on_dragon_roost_island',
        'can_access_secret_cave_entrance_on_fire_mountain',
        'can_access_secret_cave_entrance_on_horseshoe_island',
        'can_access_secret_cave_entrance_on_ice_ring_isle',
        'can_access_secret_cave_entrance_on_needle_rock_isle',
        'can_access_secret_cave_entrance_on_outset_island',
        'can_access_secret_cave_entrance_on_overlook_island',
        'can_access_secret_cave_entrance_on_pawprint_isle',
        'can_access_secret_cave_entrance_on_pawprint_isle_side_isle',
        'can_access_secret_cave_entrance_on_private_oasis',
        'can_access_secret_cave_entrance_on_rock_spire_isle',
        'can_access_secret_cave_entrance_on_shark_island',
        'can_access_secret_cave_entrance_on_star_island',
        'can_access_secret_cave_entrance_on_stone_watcher_island',
    }


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
