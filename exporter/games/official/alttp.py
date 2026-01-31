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

Note: The complex bunny rule for Superbunny Cave locations uses the default AST
analysis. Previous True_ overrides caused logic mismatches in certain entrance
shuffle configurations. The AST analysis may produce incomplete entrance path
rules for multi-hop paths, but this is preferable to the permissive True_ rule.

ALttP-specific analyzer configuration:
- Bunny rules (from set_bunny_rules) are detected as unanalyzable patterns
- In glitch modes, unanalyzable rules return True (permissive)
- In non-glitch modes, unanalyzable rules fall back to Moon Pearl requirement
- Bytecode analysis recognizes ALttP-specific items
- has_sword() pattern expands to check all four sword tiers
- _lttp_has_key method handles universal key mode
"""

from typing import Dict, Any, Set, Optional, List, Callable
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

    # ==========================================================================
    # ALttP-specific analyzer configuration
    # ==========================================================================

    # Known ALttP items for bytecode-based rule analysis
    # When the analyzer falls back to bytecode analysis, it recognizes these items
    KNOWN_ITEMS_FOR_BYTECODE_ANALYSIS: Set[str] = {
        'Moon Pearl', 'Magic Mirror', 'Pegasus Boots', 'Flippers',
        'Hammer', 'Fire Rod', 'Lamp', 'Hookshot', 'Bow', 'Cane of Somaria',
        'Cane of Byrna', 'Cape', 'Bottle', 'Bombos', 'Ether', 'Quake',
        'Book of Mudora', 'Shovel', 'Flute', 'Bug Catching Net',
    }

    # Bytecode helper expansions for ALttP
    # When these helpers are seen in bytecode, expand to HasAny(items=...)
    BYTECODE_HELPER_EXPANSIONS: Dict[str, List[str]] = {
        'has_sword': ['Fighter Sword', 'Master Sword', 'Tempered Sword', 'Golden Sword'],
    }

    # Fallback item for unanalyzable bunny rules (non-glitch modes)
    UNANALYZABLE_RULE_FALLBACK_ITEM: Optional[str] = 'Moon Pearl'

    # Glitch mode configuration
    GLITCH_MODE_OPTION_NAME: Optional[str] = 'glitches_required'
    GLITCH_MODE_OPTION_VALUES: List[str] = [
        'minor_glitches', 'overworld_glitches', 'hybrid_major_glitches', 'no_logic'
    ]

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
        logger.info("ALttP exporter initialized")

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

    # ==========================================================================
    # ALttP-specific analyzer hooks
    # ==========================================================================

    def is_unanalyzable_rule_pattern(self, func: Callable) -> bool:
        """Check if a function is an ALttP bunny rule pattern.

        ALttP's set_bunny_rules() creates complex lambda functions that
        cannot be fully analyzed by the standard analyzer. These are
        identified by their __qualname__ containing 'set_bunny_rules'.

        Args:
            func: The function object to check

        Returns:
            True if this is a bunny rule that needs fallback handling
        """
        if not callable(func):
            return False

        qualname = getattr(func, '__qualname__', '')
        return 'set_bunny_rules' in qualname

    def handle_game_specific_state_method(
        self,
        method_name: str,
        args: List[Any],
        world: Any
    ) -> Optional[Dict[str, Any]]:
        """Handle ALttP-specific state methods.

        Handles:
        - _lttp_has_key: Converts to can_buy_unlimited for universal key mode

        Args:
            method_name: The name of the state method
            args: The processed arguments to the method
            world: The world object for option access

        Returns:
            Rule dict if this method should be handled specially, None otherwise
        """
        if method_name == '_lttp_has_key' and len(args) >= 1:
            # Extract item name from first argument
            item_arg = args[0]
            if isinstance(item_arg, dict) and item_arg.get('type') == 'constant':
                item_value = item_arg.get('value')
            elif isinstance(item_arg, str):
                item_value = item_arg
            else:
                item_value = item_arg

            # Get count from second argument (defaults to 1)
            count = args[1] if len(args) >= 2 else {'type': 'constant', 'value': 1}

            # Check for universal key mode
            small_key_shuffle = None
            if world and hasattr(world, 'options') and hasattr(world.options, 'small_key_shuffle'):
                small_key_shuffle = str(world.options.small_key_shuffle.current_key)

            if small_key_shuffle == 'universal':
                # When universal keys are enabled, use can_buy_unlimited helper
                logger.debug("_lttp_has_key with universal keys -> can_buy_unlimited helper")
                return {
                    'type': 'helper',
                    'name': 'can_buy_unlimited',
                    'args': [{'type': 'constant', 'value': 'Small Key (Universal)'}]
                }
            else:
                # Standard key check
                return {'type': 'count_check', 'item': item_value, 'count': count}

        return None  # Let default handling proceed

    # ==========================================================================
    # Superbunny-accessible location overrides for OWG mode
    # ==========================================================================

    # Locations in Kakariko Well (top) region that are superbunny-accessible.
    # In OWG mode, these locations don't require Moon Pearl because they can be
    # accessed via superbunny state (a glitch that allows picking up items in bunny form).
    #
    # The bunny rule logic in ALttP Rules.py (lines 1739-1741) handles this:
    #   if location.name in OverworldGlitchRules.get_superbunny_accessible_locations():
    #       if region.name == 'Kakariko Well (top)':
    #           possible_options.append(lambda state: path_to_access_rule(new_path, entrance)(state))
    #
    # However, the analyzer produces an incomplete rule because:
    # 1. The bunny rule uses options_to_access_rule() which combines multiple path options
    # 2. Each path option is a nested lambda: lambda state: path_to_access_rule(new_path, entrance)(state)
    # 3. The AST analyzer can analyze the outer lambda but doesn't fully trace through
    #    the nested function factory call with the captured closure variables
    # 4. The result includes Moon Pearl (base option) and one path (via entrance rules),
    #    but misses the simpler superbunny path that requires no additional items
    #
    # This post-processing override correctly represents the original game logic:
    # in OWG mode, superbunny-accessible locations in Kakariko Well (top) need only
    # the ability to reach the region - no Moon Pearl or other items required.
    KAKARIKO_WELL_SUPERBUNNY_LOCATIONS: Set[str] = {
        'Kakariko Well - Left',
        'Kakariko Well - Middle',
        'Kakariko Well - Right',
        'Kakariko Well - Bottom',
    }

    def post_process_location_data(self, location_data: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """Post-process location data to fix superbunny-accessible locations in OWG mode."""
        # Check if we're in a glitch mode that supports superbunny access
        if not self._is_glitch_mode_enabled():
            return location_data

        # Check if this is a Kakariko Well superbunny-accessible location
        if location_name not in self.KAKARIKO_WELL_SUPERBUNNY_LOCATIONS:
            return location_data

        # Override the access rule to True_ (no additional item requirements)
        # The region access rule will still apply, but no Moon Pearl is needed
        logger.info(f"Overriding access rule for superbunny location '{location_name}' to True_ (OWG mode)")
        location_data['access_rule'] = {'rule': 'True_'}

        return location_data

    def _is_glitch_mode_enabled(self) -> bool:
        """Check if the current world is in a glitch mode that supports superbunny access."""
        if not self.world:
            return False

        if not hasattr(self.world, 'options'):
            return False

        if not hasattr(self.world.options, 'glitches_required'):
            return False

        try:
            current_value = str(self.world.options.glitches_required.current_key)
            return current_value in self.GLITCH_MODE_OPTION_VALUES
        except (AttributeError, KeyError):
            return False
