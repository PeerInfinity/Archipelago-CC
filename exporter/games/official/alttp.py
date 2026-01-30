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

This exporter also handles:
- Superbunny accessible locations: In glitch modes (minor_glitches, overworld_glitches,
  hybrid_major_glitches, no_logic), certain locations can be accessed in superbunny state
  without Moon Pearl. These are exported with True_ rules since the complex bunny rule
  analysis can miss some valid access paths.
"""

from typing import Dict, Any, Set, Optional
from ..base import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


# Superbunny accessible locations that can be accessed WITHOUT Magic Mirror
# In set_bunny_rules, locations entered via 'Superbunny Cave (Bottom)' don't need Mirror.
# Other superbunny accessible locations still require Magic Mirror.
# This matches the logic in worlds.alttp.Rules.set_bunny_rules lines 1740-1743.
SUPERBUNNY_NO_MIRROR_LOCATIONS = frozenset([
    # Locations in Superbunny Cave (Top) region, accessed via Superbunny Cave (Bottom)
    'Superbunny Cave - Top',
    'Superbunny Cave - Bottom',
])

# Glitch modes that allow superbunny access (from ALttP options)
# These values correspond to the glitches_required option
GLITCH_MODES_WITH_SUPERBUNNY = frozenset([
    'minor_glitches',      # 1
    'overworld_glitches',  # 2
    'hybrid_major_glitches',  # 3
    'no_logic',            # 4
])


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

    def __init__(self, world=None):
        super().__init__(world)
        self._glitch_mode = None  # Cache for glitch mode
        logger.info("ALttP exporter initialized")

    def _get_glitch_mode(self, world) -> Optional[str]:
        """Get the glitches_required option value for this world."""
        if self._glitch_mode is not None:
            return self._glitch_mode

        if world is None:
            return None

        try:
            # Try to get glitches_required option
            if hasattr(world, 'options') and hasattr(world.options, 'glitches_required'):
                glitch_option = world.options.glitches_required
                # Option might be an int or have a current_key property
                if hasattr(glitch_option, 'current_key'):
                    self._glitch_mode = glitch_option.current_key
                elif hasattr(glitch_option, 'value'):
                    # Map numeric value to string
                    value = glitch_option.value
                    mode_map = {
                        0: 'no_glitches',
                        1: 'minor_glitches',
                        2: 'overworld_glitches',
                        3: 'hybrid_major_glitches',
                        4: 'no_logic',
                    }
                    self._glitch_mode = mode_map.get(value, 'no_glitches')
                else:
                    self._glitch_mode = str(glitch_option)
                logger.debug(f"ALttP glitch mode: {self._glitch_mode}")
        except Exception as e:
            logger.debug(f"Could not determine glitch mode: {e}")
            self._glitch_mode = None

        return self._glitch_mode

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """Override location access rule for superbunny accessible locations that don't need Mirror.

        In glitch modes (minor_glitches, overworld_glitches, hybrid_major_glitches, no_logic),
        certain locations can be accessed in superbunny state without Moon Pearl.

        However, most superbunny accessible locations still require Magic Mirror to superbunny into.
        Only locations in Superbunny Cave (entered via the bottom) can be accessed without Mirror.

        The complex bunny rule analysis in set_bunny_rules can miss some valid access paths
        when there are multiple entrances to a region, so we export True_ for locations that
        truly don't need any additional requirements beyond reaching the region.

        Returns:
            Dict with True_ rule if location is superbunny accessible without Mirror,
            None to use default analysis.
        """
        location_name = getattr(location, 'name', None)
        if not location_name:
            return None

        # Check if in a glitch mode that allows superbunny access
        glitch_mode = self._get_glitch_mode(world)
        if glitch_mode not in GLITCH_MODES_WITH_SUPERBUNNY:
            return None

        # Only locations that can be accessed without Mirror get True_ rules
        # Other superbunny accessible locations still need the complex bunny rule
        if location_name in SUPERBUNNY_NO_MIRROR_LOCATIONS:
            logger.debug(f"Superbunny location (no mirror) '{location_name}' in {glitch_mode} mode - using True_ rule")
            return {'rule': 'True_'}

        return None

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
