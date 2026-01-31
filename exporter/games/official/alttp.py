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

ALttP-specific analyzer configuration:
- Bunny rules (from set_bunny_rules) use nested call patterns that the analyzer
  handles via module-level function factory detection (see call_visitor.py)
- path_to_access_rule and options_to_access_rule are recognized as function factories
- The analyzer correctly produces Or(Moon Pearl, can_reach_entrance) for superbunny locations
- Bytecode analysis recognizes ALttP-specific items
- has_sword() pattern expands to check all four sword tiers
- _lttp_has_key method handles universal key mode

Post-processing:
- Removes overly-permissive standalone CanReachEntrance options from superbunny location rules
- These should always be combined with Magic Mirror or Moon Pearl
"""

from typing import Dict, Any, Set, Optional, List, Callable
from ..base import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)


# Superbunny-accessible locations from OverworldGlitchRules.get_superbunny_accessible_locations()
# These locations can be accessed in bunny state with specific requirements
SUPERBUNNY_ACCESSIBLE_LOCATIONS = {
    'Waterfall of Wishing - Left',
    'Waterfall of Wishing - Right',
    "King's Tomb",
    'Floodgate',
    'Floodgate Chest',
    'Cave 45',
    'Bonk Rock Cave',
    'Brewery',
    'C-Shaped House',
    'Chest Game',
    'Mire Shed - Left',
    'Mire Shed - Right',
    'Secret Passage',
    'Ice Rod Cave',
    'Pyramid Fairy - Left',
    'Pyramid Fairy - Right',
    'Superbunny Cave - Top',
    'Superbunny Cave - Bottom',
    "Blind's Hideout - Left",
    "Blind's Hideout - Right",
    "Blind's Hideout - Far Left",
    "Blind's Hideout - Far Right",
    'Kakariko Well - Left',
    'Kakariko Well - Middle',
    'Kakariko Well - Right',
    'Kakariko Well - Bottom',
    'Kakariko Tavern',
    'Library',
    'Spiral Cave',
    # Boots-required superbunny mirror locations
    'Paradox Cave Lower - Far Left',
    'Paradox Cave Lower - Left',
    'Paradox Cave Lower - Middle',
    'Paradox Cave Lower - Right',
    'Paradox Cave Lower - Far Right',
    'Paradox Cave Upper - Left',
    'Paradox Cave Upper - Right',
    'Hookshot Cave - Top Right',
    'Hookshot Cave - Top Left',
    'Hookshot Cave - Bottom Left',
    'Hookshot Cave - Bottom Right',
}


def _export_shops(world, multiworld, player) -> List[Dict[str, Any]]:
    """Export shop data for ALttP worldgen.

    The worldgen world needs shop information to implement can_buy_unlimited
    and can_buy helpers. Each shop is exported with:
    - region: The region name where the shop is located
    - unlimited_items: List of items that have unlimited stock
    - inventory: Full inventory data for advanced shop logic
    """
    shops_data = []
    for shop in getattr(world, 'shops', []):
        # Get region name
        region_name = shop.region.name if shop.region else ''

        # Build list of unlimited items
        unlimited_items = []
        for inv in shop.inventory:
            if inv is None:
                continue
            # max=0 means unlimited stock of the base item
            # max>0 means limited stock, but replacement is unlimited after stock runs out
            if inv.get('max', 0) == 0:
                if inv.get('item'):
                    unlimited_items.append(inv['item'])
            else:
                if inv.get('replacement'):
                    unlimited_items.append(inv['replacement'])

        shops_data.append({
            'region': region_name,
            'unlimited_items': unlimited_items,
            'inventory': shop.inventory,
            'room_id': shop.room_id,
            'shopkeeper_config': shop.shopkeeper_config,
            'custom': shop.custom,
            'locked': shop.locked,
            'sram_offset': getattr(shop, 'sram_offset', 0),
        })

    return shops_data


class ALttPGameExportHandler(GenericGameExportHandler):
    """Export handler for A Link to the Past."""

    # The original ALttP world uses explicit_indirect_conditions = False
    # which enables the auto-retry BFS algorithm for entrance rules that
    # check region reachability (like can_buy_unlimited checking shop regions).
    # Without this, the explicit BFS algorithm requires registered indirect
    # conditions which aren't set up by the worldgen.
    USE_AUTO_INDIRECT_CONDITIONS = True

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
        # Event/flag items for bunny rule analysis
        'Beat Agahnim 1', 'Beat Agahnim 2',
    }

    # Bytecode helper expansions for ALttP
    # When these helpers are seen in bytecode, expand to HasAny(items=...)
    BYTECODE_HELPER_EXPANSIONS: Dict[str, List[str]] = {
        'has_sword': ['Fighter Sword', 'Master Sword', 'Tempered Sword', 'Golden Sword'],
    }

    # Fallback item for unanalyzable bunny rules (non-permissive modes)
    UNANALYZABLE_RULE_FALLBACK_ITEM: Optional[str] = 'Moon Pearl'

    # Permissive logic mode configuration
    PERMISSIVE_LOGIC_OPTION_NAME: Optional[str] = 'glitches_required'
    PERMISSIVE_LOGIC_OPTION_VALUES: List[str] = [
        'minor_glitches', 'overworld_glitches', 'hybrid_major_glitches', 'no_logic'
    ]

    # Known option names for bytecode analysis
    # These are recognized when detecting option access patterns in rules
    KNOWN_OPTION_NAMES: Set[str] = {
        'open_pyramid', 'swordless', 'retro_bow', 'retro_caves', 'mode',
        'glitches_required', 'entrance_shuffle', 'bombless_start',
        'shuffle_capacity_upgrades', 'key_drop_shuffle', 'pot_shuffle',
        'randomize_cost_types', 'item_functionality', 'goal',
    }

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

    # Export shop data for can_buy_unlimited and can_buy helpers
    WORLD_ATTRIBUTES: Dict[str, Callable] = {
        'shops': _export_shops,
    }

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

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process ALttP export data to fix bunny rule issues.

        In glitch modes, the bunny rules analyzer sometimes produces overly-permissive
        rules for superbunny-accessible locations. Specifically, it may create Or rules
        with standalone CanReachEntrance options that should have Magic Mirror requirements.

        This method:
        1. Identifies location rules for superbunny-accessible locations
        2. Removes standalone CanReachEntrance options from Or rules
        3. For Superbunny Cave locations, removes ALL CanReachEntrance options

        This ensures the worldgen rules match the more restrictive server logic.
        """
        # Check if we're in a glitch mode that uses bunny rules
        if not self._is_glitch_mode():
            return super().post_process_data(data)

        fixed_count = 0
        # Process each player's regions
        for player_id_str, player_regions in data.get('regions', {}).items():
            for region_name, region_data in player_regions.items():
                # Process location rules
                for loc_data in region_data.get('locations', []):
                    loc_name = loc_data.get('name', '')
                    if loc_name in SUPERBUNNY_ACCESSIBLE_LOCATIONS:
                        access_rule = loc_data.get('access_rule')
                        if access_rule:
                            # Superbunny Cave locations have special path-based logic that doesn't export correctly.
                            # The bunny rule analyzer produces CanReachEntrance-based rules that are too permissive.
                            # Remove ALL CanReachEntrance options for Superbunny Cave, requiring Moon Pearl only.
                            # This trades some false negatives for avoiding false positives from the broken export.
                            is_superbunny_cave = loc_name in ('Superbunny Cave - Top', 'Superbunny Cave - Bottom')
                            fixed_rule = self._fix_superbunny_rule(access_rule, remove_all_canreach=is_superbunny_cave)
                            if fixed_rule != access_rule:
                                logger.debug(f"Fixed superbunny rule for {loc_name}")
                                loc_data['access_rule'] = fixed_rule
                                fixed_count += 1

        if fixed_count > 0:
            logger.debug(f"ALttP post_process_data: fixed {fixed_count} superbunny rules")
        return super().post_process_data(data)

    def _is_glitch_mode(self) -> bool:
        """Check if the current world uses glitch logic that requires bunny rule fixes."""
        if self.world and hasattr(self.world, 'options'):
            option = getattr(self.world.options, 'glitches_required', None)
            if option is not None:
                current_value = str(getattr(option, 'current_key', ''))
                return current_value in self.PERMISSIVE_LOGIC_OPTION_VALUES
        return False

    def _fix_superbunny_rule(self, rule: Dict[str, Any], remove_all_canreach: bool = False) -> Dict[str, Any]:
        """Fix a superbunny location rule by removing overly-permissive options.

        For most superbunny locations:
        - Removes only STANDALONE CanReachEntrance options
        - Keeps And(CanReachEntrance, Mirror) as valid bunny mirror access

        For Superbunny Cave locations (when remove_all_canreach=True):
        - Removes ALL CanReachEntrance-based options (standalone and And with Mirror)
        - These locations have special path-based logic that doesn't export correctly

        Handles both rule formats:
        - JSON schema format: {'rule': 'Or', 'children': [...]}
        - Export format: {'type': 'or', 'conditions': [...]}

        Args:
            rule: The access rule to fix
            remove_all_canreach: If True, remove all CanReachEntrance options (for Superbunny Cave)

        Returns:
            The fixed rule with overly-permissive options removed
        """
        if not isinstance(rule, dict):
            return rule

        # Check for both rule formats
        rule_type = rule.get('rule') or rule.get('type')

        # Only process Or rules
        if rule_type not in ('Or', 'or'):
            return rule

        # Get children (different key names in different formats)
        children = rule.get('children') or rule.get('conditions', [])
        if not children:
            return rule

        fixed_children = []
        removed_count = 0
        for child in children:
            should_remove = False

            if remove_all_canreach:
                # For Superbunny Cave: remove ALL CanReachEntrance-based options
                if self._involves_can_reach_entrance(child):
                    should_remove = True
            else:
                # For other locations: only remove STANDALONE CanReachEntrance
                if self._is_standalone_can_reach_entrance(child):
                    should_remove = True

            if should_remove:
                removed_count += 1
            else:
                fixed_children.append(child)

        # If we removed any children, rebuild the Or
        if removed_count > 0:
            if len(fixed_children) == 0:
                # All options removed - fall back to Moon Pearl requirement
                if 'conditions' in rule:
                    return {'type': 'item_check', 'item': 'Moon Pearl'}
                else:
                    return {'rule': 'Has', 'args': {'item_name': 'Moon Pearl'}}
            elif len(fixed_children) == 1:
                # Only one option left - unwrap the Or
                return fixed_children[0]
            else:
                # Preserve the original format
                if 'conditions' in rule:
                    return {'type': 'or', 'conditions': fixed_children}
                else:
                    return {'rule': 'Or', 'children': fixed_children}

        return rule

    def _involves_can_reach_entrance(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule involves CanReachEntrance in any way (standalone or in And)."""
        if not isinstance(rule, dict):
            return False

        rule_type = rule.get('rule') or rule.get('type')

        # Direct CanReachEntrance or function_call with CanReachEntrance
        if self._is_standalone_can_reach_entrance(rule):
            return True

        # And rule containing CanReachEntrance
        if rule_type in ('And', 'and'):
            and_children = rule.get('children') or rule.get('conditions', [])
            for child in and_children:
                if self._is_standalone_can_reach_entrance(child):
                    return True

        return False

    def _get_entrance_name_from_any(self, rule: Dict[str, Any]) -> Optional[str]:
        """Extract entrance name from any rule that involves CanReachEntrance."""
        if not isinstance(rule, dict):
            return None

        # Try direct extraction
        name = self._get_entrance_name(rule)
        if name:
            return name

        # Check And children
        rule_type = rule.get('rule') or rule.get('type')
        if rule_type in ('And', 'and'):
            and_children = rule.get('children') or rule.get('conditions', [])
            for child in and_children:
                name = self._get_entrance_name(child)
                if name:
                    return name

        return None

    def _is_standalone_can_reach_entrance(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule is a standalone CanReachEntrance without other requirements."""
        if not isinstance(rule, dict):
            return False

        rule_type = rule.get('rule') or rule.get('type')

        # Direct CanReachEntrance (JSON schema format)
        if rule_type == 'CanReachEntrance':
            return True

        # function_call wrapping CanReachEntrance (export format)
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if isinstance(function, dict) and function.get('rule') == 'CanReachEntrance':
                return True

        # AST_function_call wrapping CanReachEntrance
        if rule_type == 'AST_function_call':
            function = rule.get('args', {}).get('function', {})
            if isinstance(function, dict) and function.get('rule') == 'CanReachEntrance':
                return True

        return False

    def _get_entrance_name(self, rule: Dict[str, Any]) -> Optional[str]:
        """Extract entrance name from a CanReachEntrance rule."""
        if not isinstance(rule, dict):
            return None

        rule_type = rule.get('rule') or rule.get('type')

        if rule_type == 'CanReachEntrance':
            return rule.get('args', {}).get('entrance_name')

        # function_call format (export format)
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if isinstance(function, dict) and function.get('rule') == 'CanReachEntrance':
                return function.get('args', {}).get('entrance_name')

        if rule_type == 'AST_function_call':
            function = rule.get('args', {}).get('function', {})
            if isinstance(function, dict) and function.get('rule') == 'CanReachEntrance':
                return function.get('args', {}).get('entrance_name')

        return None

    def _has_mirror_protected_version(self, children: List[Dict[str, Any]], entrance_name: str) -> bool:
        """Check if there's a Mirror-protected version of the entrance check.

        Looks for: And(CanReachEntrance(entrance_name), Has('Magic Mirror'))
        Handles both rule formats.
        """
        for child in children:
            if not isinstance(child, dict):
                continue

            child_type = child.get('rule') or child.get('type')
            if child_type not in ('And', 'and'):
                continue

            and_children = child.get('children') or child.get('conditions', [])
            has_entrance = False
            has_mirror = False

            for and_child in and_children:
                if not isinstance(and_child, dict):
                    continue

                # Check for CanReachEntrance with matching name
                if self._get_entrance_name(and_child) == entrance_name:
                    has_entrance = True

                # Check for Has('Magic Mirror') - JSON schema format
                if and_child.get('rule') == 'Has':
                    item_name = and_child.get('args', {}).get('item_name')
                    if item_name == 'Magic Mirror':
                        has_mirror = True

                # Check for item_check with Magic Mirror - export format
                if and_child.get('type') == 'item_check':
                    item_name = and_child.get('item')
                    if item_name == 'Magic Mirror':
                        has_mirror = True

            if has_entrance and has_mirror:
                return True

        return False

