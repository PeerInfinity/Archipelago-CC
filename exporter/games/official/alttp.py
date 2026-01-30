"""A Link to the Past game-specific export handler.

This exporter handles ALttP-specific helpers that are used in rules:
- can_use_bombs: Checks bomb capacity based on upgrades and bombless_start option
- can_shoot_arrows: Checks bow availability and arrow capacity (or shop access for retro)
- can_kill_most_things: Combat capability check with enemy_shuffle considerations
- can_hold_arrows: Arrow capacity based on upgrades and Capacity Upgrade Shop
- has_hearts: Heart count for shop price rules
- shop_price_rules: Shop accessibility based on randomize_cost_types option

These helpers have option-dependent logic that must be exported as definitions
so the worldgen world can evaluate them correctly at runtime.

Superbunny Cave Locations:
In overworld_glitches/hybrid_major_glitches/no_logic modes, "Superbunny Cave - Top"
and "Superbunny Cave - Bottom" can be accessed with boots clips and superbunny state.
The bunny rules in Rules.py generate complex entrance-path-dependent rules at runtime
that the AST analysis can't fully capture, especially with entrance shuffle.

For these locations in OWG+ modes, we use True_ (no additional location rule beyond
region access). This is correct because boots clips make reaching the region sufficient.

Note: minor_glitches does NOT get this override because boots clips aren't available -
you need Lamp or Flute for proper access. The AST analysis handles minor_glitches.

Other superbunny accessible locations (like Pyramid Fairy) still require Magic Mirror
for superbunny access, so they use the default AST analysis which correctly handles
the "Moon Pearl OR (entrance path + Magic Mirror)" logic.
"""

from typing import Dict, Any, Set, Optional
from ..base import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class ALttPGameExportHandler(GenericGameExportHandler):
    """Export handler for A Link to the Past."""

    # Helper modules containing the rule helpers
    HELPER_MODULES = [
        'worlds.alttp.StateHelpers',
        'worlds.alttp.Shops',
    ]

    # Enable automatic helper export - already True in GenericGameExportHandler
    # but explicitly set for clarity
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Whitelist critical helpers that must be exported as definitions
    # These are option-dependent and fall back to True if not exported
    HELPERS_TO_EXPORT_WHITELIST: Set[str] = {
        # From StateHelpers.py
        'can_use_bombs',
        'can_shoot_arrows',
        'can_kill_most_things',
        'can_hold_arrows',
        'has_hearts',
        'heart_count',
        'can_extend_magic',
        'bottle_count',
        'can_buy',
        'can_buy_unlimited',
        'can_bomb_or_bonk',
        'can_activate_crystal_switch',
        'has_sword',
        'has_beam_sword',
        'has_melee_weapon',
        'has_fire_source',
        'can_melt_things',
        'can_lift_rocks',
        'can_lift_heavy_rocks',
        'has_crystals',
        'has_triforce_pieces',
        'is_not_bunny',
        'can_bomb_clip',
        'can_boots_clip_lw',
        'can_boots_clip_dw',
        'can_get_glitched_speed_dw',
        'can_retrieve_tablet',
        'can_get_good_bee',
        'has_misery_mire_medallion',
        'has_turtle_rock_medallion',
        'can_kill_standard_start',
        # From Shops.py
        'shop_price_rules',
    }

    # Blacklist helpers that are too complex or use patterns we can't export
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = set()

    # Superbunny Cave locations - these can be accessed with just True_ in glitch modes
    # because you can grab items in superbunny state without Magic Mirror when entering
    # from Superbunny Cave (Bottom) or similar valid entrances
    SUPERBUNNY_CAVE_LOCATIONS: Set[str] = {
        'Superbunny Cave - Top',
        'Superbunny Cave - Bottom',
    }

    def __init__(self, world=None):
        super().__init__(world)
        logger.info("ALttP exporter initialized")

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """Override location rule for Superbunny Cave locations in OWG+ glitch modes.

        In overworld_glitches/hybrid_major_glitches/no_logic modes, Superbunny Cave
        locations can be accessed with boots clips and superbunny mechanics. The complex
        bunny rule traversal in Rules.py generates entrance-path-dependent rules at
        runtime that the AST analysis can't fully capture, especially with entrance shuffle.

        For Superbunny Cave locations in OWG+ modes, we return True_ (no additional
        location rule beyond region access). This is correct because:
        1. The cave is named "Superbunny Cave" - items can be grabbed in superbunny state
        2. The region entrance rules ensure the player can physically reach the cave
        3. With boots clips available, reaching the region is sufficient for access

        Note: minor_glitches mode does NOT get this override because boots clips aren't
        available there - you need Lamp or Flute for proper access. The AST analysis
        correctly captures the Moon Pearl requirements for minor_glitches.

        Other superbunny accessible locations (like Pyramid Fairy) still need Magic Mirror
        for superbunny access, so they use the default AST analysis which correctly
        requires Moon Pearl or Magic Mirror.
        """
        try:
            location_name = location.name if hasattr(location, 'name') else str(location)

            # Only override Superbunny Cave locations - other superbunny accessible
            # locations need the full bunny rule (Moon Pearl OR entrance+Mirror)
            if location_name not in self.SUPERBUNNY_CAVE_LOCATIONS:
                return None  # Fall back to normal analysis

            # Check if glitches_required is set to a mode that allows superbunny access
            glitches = getattr(world.options, 'glitches_required', None)
            if glitches is None:
                return None

            # Get the glitch mode value - handle both string and enum
            glitch_mode = str(glitches.current_key) if hasattr(glitches, 'current_key') else str(glitches)

            # Only apply True_ for OWG+ modes where boots clips make superbunny access easy
            # minor_glitches doesn't have boots clips, so needs the full bunny rule
            owg_plus_modes = {'overworld_glitches', 'hybrid_major_glitches', 'no_logic'}
            if glitch_mode not in owg_plus_modes:
                return None  # In no_glitches/minor_glitches, use normal AST analysis

            logger.debug(f"Using True_ override for Superbunny Cave location '{location_name}' in {glitch_mode} mode")
            return {"rule": "True_"}

        except Exception as e:
            logger.debug(f"Error checking superbunny location: {e}")
            return None  # Fall back to normal analysis on any error

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Export progressive item mappings for ALttP.

        ALttP has several progressive item lines that the frontend needs to handle:
        - Progressive Sword: Fighter -> Master -> Tempered -> Golden
        - Progressive Glove: Power Glove -> Titan's Mitt
        - Progressive Shield: Fighter -> Fire -> Mirror
        - Progressive Bow: Bow -> Silver Bow
        - Progressive Mail: Blue Mail -> Red Mail
        """
        # Let the base class auto-detect from Items.py progression_mapping
        base_mapping = super().get_progression_mapping(world)

        # ALttP has progression_mapping in Items.py that the base class should find
        if base_mapping:
            logger.info(f"Exported {len(base_mapping)} progressive item types for ALttP")
            return base_mapping

        # Fallback: define manually if auto-detection fails
        logger.info("Using fallback progressive item definitions for ALttP")
        return {
            'Progressive Sword': {
                'base_item': 'Progressive Sword',
                'items': [
                    {'name': 'Fighter Sword', 'level': 1},
                    {'name': 'Master Sword', 'level': 2},
                    {'name': 'Tempered Sword', 'level': 3},
                    {'name': 'Golden Sword', 'level': 4}
                ]
            },
            'Progressive Glove': {
                'base_item': 'Progressive Glove',
                'items': [
                    {'name': 'Power Glove', 'level': 1},
                    {'name': 'Titans Mitts', 'level': 2}
                ]
            },
            'Progressive Shield': {
                'base_item': 'Progressive Shield',
                'items': [
                    {'name': 'Blue Shield', 'level': 1},
                    {'name': 'Red Shield', 'level': 2},
                    {'name': 'Mirror Shield', 'level': 3}
                ]
            },
            'Progressive Bow': {
                'base_item': 'Progressive Bow',
                'items': [
                    {'name': 'Bow', 'level': 1},
                    {'name': 'Silver Bow', 'level': 2}
                ]
            },
            'Progressive Bow (Alt)': {
                'base_item': 'Progressive Bow',  # Same base as Progressive Bow
                'items': [
                    {'name': 'Bow', 'level': 1},
                    {'name': 'Silver Bow', 'level': 2}
                ]
            },
            'Progressive Mail': {
                'base_item': 'Progressive Mail',
                'items': [
                    {'name': 'Blue Mail', 'level': 1},
                    {'name': 'Red Mail', 'level': 2}
                ]
            }
        }
