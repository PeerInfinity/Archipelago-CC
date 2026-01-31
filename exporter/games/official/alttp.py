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
"""

from typing import Dict, Any, Set, Optional, List, Callable
from ..base import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


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

    # ==========================================================================
    # Superbunny location handling
    # ==========================================================================

    def _is_superbunny_mirror_rule(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule is a superbunny path check with Magic Mirror.

        Pattern: Or(And(...path_check..., Has('Magic Mirror')), Has('Moon Pearl'))
        The path_check typically contains CanReachEntrance and additional Has checks.

        The exporter uses two formats:
        1. Rule Builder format: {'rule': 'Or', 'children': [...]}
        2. Internal format: {'type': 'or', 'conditions': [...]}

        This method handles both formats.
        """
        if not isinstance(rule, dict):
            return False

        # Handle both formats
        rule_type = rule.get('rule') or rule.get('type', '')
        if rule_type.lower() != 'or':
            return False

        children = rule.get('children', []) or rule.get('conditions', [])
        if len(children) != 2:
            return False

        # Check for Moon Pearl in one child
        has_moon_pearl = False
        and_with_mirror = None

        for child in children:
            if isinstance(child, dict):
                # Check for Moon Pearl (both formats)
                child_type = child.get('rule') or child.get('type', '')
                if child_type.lower() in ('has', 'item_check'):
                    item = child.get('args', {}).get('item_name', '') or child.get('item', '')
                    if item == 'Moon Pearl':
                        has_moon_pearl = True

                # Check for And with Magic Mirror (both formats)
                if child_type.lower() == 'and':
                    and_children = child.get('children', []) or child.get('conditions', [])
                    for ac in and_children:
                        if isinstance(ac, dict):
                            ac_type = ac.get('rule') or ac.get('type', '')
                            if ac_type.lower() in ('has', 'item_check'):
                                ac_item = ac.get('args', {}).get('item_name', '') or ac.get('item', '')
                                if ac_item == 'Magic Mirror':
                                    and_with_mirror = child
                                    break
                            # Also check for function_call with CanReachEntrance pattern
                            if ac_type.lower() in ('function_call', 'ast_function_call'):
                                # This is a complex path check
                                # Check if the And also contains Magic Mirror
                                for other_ac in and_children:
                                    if isinstance(other_ac, dict):
                                        other_type = other_ac.get('rule') or other_ac.get('type', '')
                                        if other_type.lower() in ('has', 'item_check'):
                                            other_item = other_ac.get('args', {}).get('item_name', '') or other_ac.get('item', '')
                                            if other_item == 'Magic Mirror':
                                                and_with_mirror = child
                                                break

        return has_moon_pearl and and_with_mirror is not None

    def _simplify_superbunny_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Simplify a superbunny rule to just: Moon Pearl OR Magic Mirror.

        This removes overly-restrictive path checks from the bunny rule analysis
        that only capture one specific path when there are multiple valid paths.

        Returns the rule in the internal format (type/conditions) since that's
        what the exporter uses during processing.
        """
        return {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Magic Mirror'},
                {'type': 'item_check', 'item': 'Moon Pearl'}
            ]
        }

    # Locations that should have their superbunny rules simplified.
    # These are locations where the bunny rule analysis captures only ONE specific
    # path that's too restrictive, but there are actually multiple valid paths.
    # Only add locations here after verifying they fail due to over-restrictive rules.
    SUPERBUNNY_LOCATIONS_TO_SIMPLIFY: Set[str] = {
        # Secret Passage fails in inverted mode because the bunny rule analysis
        # only captures the path through Inverted Pyramid Hole (requiring Beat Agahnim 2),
        # but there are other valid paths through Hammer Peg Area or Post Aga Teleporter.
        'Secret Passage',
    }

    def post_process_location_data(self, location_data: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """Post-process location data to fix superbunny rules.

        In inverted mode with minor_glitches (or other glitch modes), superbunny
        locations have complex bunny rules that check for specific paths back to
        link-state regions. The rule analysis may only capture one specific path,
        making the exported rule too restrictive.

        For specific superbunny locations where we've verified this is an issue,
        the rule is simplified to: Moon Pearl OR Magic Mirror.

        This method only applies to locations in SUPERBUNNY_LOCATIONS_TO_SIMPLIFY
        to avoid making rules too permissive for locations where the path check
        is actually necessary.
        """
        # Only simplify for specific locations we've verified need it
        if location_name not in self.SUPERBUNNY_LOCATIONS_TO_SIMPLIFY:
            return location_data

        access_rule = location_data.get('access_rule')
        if access_rule is None:
            return location_data

        # Check if this is an over-restrictive superbunny rule
        if self._is_superbunny_mirror_rule(access_rule):
            logger.info(f"Simplifying superbunny rule for location: {location_name}")
            location_data['access_rule'] = self._simplify_superbunny_rule(access_rule)

        return location_data

