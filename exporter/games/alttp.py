"""A Link to the Past game-specific export handler.

This exporter handles ALttP-specific patterns:
- Bunny rules: Complex dynamic rules that check if locations are accessible
  in bunny form (Dark World without Moon Pearl). These rules use lambdas
  that can't be serialized. We detect both function objects (pre-serialization)
  and their string representations (post-serialization) and replace them with
  simplified True rules, indicating the location is potentially accessible.
- Shop price rules: Rules that check if the player has enough resources
  to purchase items from shops.
"""

from typing import Dict, Any, Optional, List, Set
from .generic import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)


# Locations that are accessible in bunny form (from set_bunny_rules in ALttP Rules.py)
# These locations don't require Moon Pearl even in Dark World regions
BUNNY_ACCESSIBLE_LOCATIONS = {
    "Link's Uncle", "Sahasrahla", "Sick Kid", "Lost Woods Hideout", "Lumberjack Tree",
    "Checkerboard Cave", "Potion Shop", "Spectacle Rock Cave", "Pyramid",
    "Hype Cave - Generous Guy", "Peg Cave", "Bumper Cave Ledge", "Dark Blacksmith Ruins",
    "Spectacle Rock", "Bombos Tablet", "Ether Tablet", "Purple Chest", "Blacksmith",
    "Missing Smith", "Master Sword Pedestal", "Bottle Merchant", "Sunken Treasure",
    "Desert Ledge"
}

# Glitch modes that enable superbunny accessibility
GLITCH_MODES_WITH_SUPERBUNNY = {'minor_glitches', 'overworld_glitches', 'hybrid_major_glitches', 'no_logic'}

# Locations with mandatory superbunny paths that work in glitch modes
# These are locations where the superbunny entrance path is always available
# (not shuffled), so they don't require Moon Pearl in glitch modes.
# From Rules.py set_bunny_rules: if new_region.name == 'Superbunny Cave (Bottom)'
# or region.name == 'Kakariko Well (top)', superbunny state works without mirror.
# The 'Superbunny Cave Climb' entrance is in mandatory_connections (EntranceShuffle.py:2617)
MANDATORY_SUPERBUNNY_LOCATIONS = {
    # Superbunny Cave (Top) region - reached via mandatory Superbunny Cave Climb
    "Superbunny Cave - Top",
    "Superbunny Cave - Bottom",
    # Kakariko Well (top) region - accessible in bunny form per Rules.py
    "Kakariko Well - Left",
    "Kakariko Well - Middle",
    "Kakariko Well - Right",
    "Kakariko Well - Bottom",
}

# Other superbunny accessible locations in glitch modes that require Magic Mirror
# (in addition to Moon Pearl as an alternative). These are from
# OverworldGlitchRules.get_superbunny_accessible_locations() minus the mandatory ones.
# For these, the rule is: Moon Pearl OR Magic Mirror
MIRROR_SUPERBUNNY_LOCATIONS = {
    "Blind's Hideout - Far Left",
    "Blind's Hideout - Far Right",
    "Blind's Hideout - Left",
    "Blind's Hideout - Right",
    "Bonk Rock Cave",
    "Brewery",
    "C-Shaped House",
    "Cave 45",
    "Chest Game",
    "Floodgate",
    "Floodgate Chest",
    "Ice Rod Cave",
    "Kakariko Tavern",
    "King's Tomb",
    "Library",
    "Mire Shed - Left",
    "Mire Shed - Right",
    "Pyramid Fairy - Left",
    "Pyramid Fairy - Right",
    "Sahasrahla's Hut - Left",
    "Sahasrahla's Hut - Middle",
    "Sahasrahla's Hut - Right",
    "Secret Passage",
    "Spiral Cave",
    "Waterfall of Wishing - Left",
    "Waterfall of Wishing - Right",
}



# Bunny-impassable caves (from set_bunny_rules in ALttP Rules.py)
# These are regions where bunnies cannot pass through - if you enter as a bunny,
# you cannot exit. In inverted mode, these regions require Moon Pearl to exit
# even if they are mixed regions (both Light World and Dark World accessible).
BUNNY_IMPASSABLE_CAVES = {
    'Bumper Cave', 'Two Brothers House', 'Hookshot Cave', 'Skull Woods First Section (Right)',
    'Skull Woods First Section (Left)', 'Skull Woods First Section (Top)', 'Turtle Rock (Entrance)',
    'Turtle Rock (Second Section)', 'Turtle Rock (Big Chest)', 'Skull Woods Second Section (Drop)',
    'Turtle Rock (Eye Bridge)', 'Sewers', 'Pyramid', 'Spiral Cave (Top)',
    'Desert Palace Main (Inner)', 'Fairy Ascension Cave (Drop)'
}

# Set of dungeon names for small key mapping
DUNGEON_NAMES = {
    'Hyrule Castle', 'Agahnims Tower', 'Eastern Palace', 'Desert Palace',
    'Tower of Hera', 'Palace of Darkness', 'Swamp Palace', 'Skull Woods',
    'Thieves Town', 'Ice Palace', 'Misery Mire', 'Turtle Rock', 'Ganons Tower'
}


class ALttPGameExportHandler(GenericGameExportHandler):
    """Export handler for A Link to the Past."""

    # Pattern to detect serialized bunny rule lambdas
    BUNNY_RULE_PATTERN = re.compile(r'<function set_bunny_rules\.')

    def __init__(self, world=None):
        """Initialize with optional world reference."""
        super().__init__(world)
        self._current_location_context = None
        self._bunny_accessible_locations = self._compute_bunny_accessible_locations(world)
        self._is_glitch_mode = self._check_glitch_mode(world)
        self._is_inverted_mode = self._check_inverted_mode(world)
        self._is_universal_keys = self._check_universal_keys(world)
        self._item_placements: Dict[str, str] = {}

    def _check_glitch_mode(self, world) -> bool:
        """Check if the world is in a glitch mode that enables superbunny accessibility."""
        if world is None or not hasattr(world, 'options'):
            return False
        if not hasattr(world.options, 'glitches_required'):
            return False
        glitches_required = world.options.glitches_required.current_key
        return glitches_required in GLITCH_MODES_WITH_SUPERBUNNY

    def _check_inverted_mode(self, world) -> bool:
        """Check if the world is in inverted mode.

        In inverted mode, the player starts in the Dark World instead of
        the Light World. This affects which rules require Moon Pearl:
        - Light World access requires Moon Pearl (instead of Dark World)
        - Boot clip rules differ between LW and DW
        """
        if world is None or not hasattr(world, 'options'):
            return False
        if not hasattr(world.options, 'mode'):
            return False
        mode = world.options.mode.current_key
        is_inverted = mode == 'inverted'
        if is_inverted:
            logger.debug(f"ALttP: Inverted mode detected (mode={mode})")
        return is_inverted

    def _check_universal_keys(self, world) -> bool:
        """Check if the world uses universal small keys.

        When small_key_shuffle is 'universal', all dungeon-specific small keys
        are replaced with a universal key that can be bought from shops.
        The server's _lttp_has_key method returns True when any shop with
        unlimited universal keys is reachable (can_buy_unlimited).

        For export simplification, we treat universal key checks as always True
        since universal key shops are accessible in normal gameplay.
        """
        if world is None or not hasattr(world, 'options'):
            return False
        if not hasattr(world.options, 'small_key_shuffle'):
            return False
        small_key_value = world.options.small_key_shuffle.current_key
        is_universal = small_key_value == 'universal'
        if is_universal:
            logger.info(f"ALttP: Universal small keys detected (small_key_shuffle={small_key_value})")
        return is_universal

    def _extract_item_placements_from_data(self, data: Dict[str, Any]) -> Dict[str, str]:
        """Extract item placements from the exported data structure.

        The exporter stores item placements in each location's 'item' field:
        location_data['item']['name'] = placed item name

        This allows us to evaluate item_name_in_location_names conditionals
        at post-processing time, resolving them to the correct branch based
        on actual item placements.

        Args:
            data: The export data dict containing regions with location data

        Returns:
            Dict mapping location names to item names (e.g., {"Ice Palace - Spike Room": "Big Key (Ice Palace)"})
        """
        placements: Dict[str, str] = {}

        try:
            regions = data.get('regions', {})
            for player_id, player_regions in regions.items():
                for region_name, region_data in player_regions.items():
                    for location_data in region_data.get('locations', []):
                        location_name = location_data.get('name', '')
                        item_info = location_data.get('item')
                        if item_info and location_name:
                            item_name = item_info.get('name')
                            if item_name:
                                placements[location_name] = item_name
        except Exception as e:
            logger.debug(f"ALttP: Could not extract item placements from data: {e}")

        if placements:
            logger.debug(f"ALttP: Extracted {len(placements)} item placements from export data")

        return placements

    def _evaluate_placement_search(self, item_name: str, player: int, locations: List[Any]) -> bool:
        """Evaluate an item_name_in_location_names check using actual item placements.

        Args:
            item_name: The item to search for (e.g., "Big Key (Ice Palace)")
            player: The player number
            locations: List of location specifications, either as [name, player] pairs or
                      as nested structures

        Returns:
            True if the item is placed in any of the specified locations, False otherwise
        """
        if not self._item_placements:
            # No placements available, return True as fallback (conservative)
            logger.debug(f"ALttP: No item placements available for placement_search evaluation")
            return True

        # Flatten locations list
        location_names = []
        for loc in locations:
            if isinstance(loc, list) and len(loc) >= 1:
                location_names.append(loc[0])  # First element is the location name
            elif isinstance(loc, str):
                location_names.append(loc)

        # Check if the item is placed in any of the locations
        for loc_name in location_names:
            placed_item = self._item_placements.get(loc_name)
            if placed_item == item_name:
                logger.debug(f"ALttP: placement_search found '{item_name}' at '{loc_name}'")
                return True

        logger.debug(f"ALttP: placement_search did not find '{item_name}' in {location_names}")
        return False

    def _evaluate_placement_comparison(self, rule: Dict[str, Any]) -> Optional[bool]:
        """Evaluate a Compare rule that uses AST_placement_lookup.

        Handles patterns like:
        Rule Builder format:
        {
            "rule": "Compare",
            "args": {
                "left": {"rule": "AST_placement_lookup", "args": {"location": "Loc Name"}},
                "op": "in",
                "right": [["Item Name", player], ...]
            }
        }

        AST format:
        {
            "type": "compare",
            "left": {"type": "placement_lookup", "location": "Loc Name"},
            "op": "==",
            "right": {...}
        }

        Returns True/False if the comparison can be evaluated, None otherwise.
        """
        if not isinstance(rule, dict):
            return None

        # Support both AST format ('type') and Rule Builder format ('rule')
        rule_type = rule.get('rule') or rule.get('type')
        if rule_type not in ('Compare', 'compare'):
            return None

        # Rule Builder format has args nested, AST format has them at top level
        if 'args' in rule:
            args = rule.get('args', {})
            left = args.get('left', {})
            op = args.get('op', '')
            right = args.get('right', [])
        else:
            left = rule.get('left', {})
            op = rule.get('op', '')
            right = rule.get('right', [])

        # Check if left is an AST_placement_lookup (Rule Builder), placement_lookup (AST),
        # or a function_call to location_item_name (unconverted AST)
        if not isinstance(left, dict):
            return None
        left_type = left.get('rule') or left.get('type')

        location_name = None

        # Handle function_call to location_item_name (when conversion didn't happen)
        if left_type == 'function_call':
            func = left.get('function', {})
            if func.get('type') == 'name' and func.get('name') == 'location_item_name':
                # location_item_name(state, location_name, player) - extract location_name from args
                func_args = left.get('args', [])
                # Filter out 'state' and 'player' arguments - location is typically the second arg
                for arg in func_args:
                    if isinstance(arg, dict) and arg.get('type') == 'constant':
                        loc = arg.get('value', '')
                        if loc and isinstance(loc, str):
                            location_name = loc
                            break
            if not location_name:
                return None
        elif left_type not in ('AST_placement_lookup', 'placement_lookup'):
            return None
        else:
            # Get location name - Rule Builder has args nested, AST has it at top level
            if 'args' in left:
                location_name = left.get('args', {}).get('location', '')
            else:
                location_name = left.get('location', '')

        # Handle case where location_name is a constant dict
        if isinstance(location_name, dict) and location_name.get('type') == 'constant':
            location_name = location_name.get('value', '')

        if not location_name:
            return None

        # Get the actual item at this location
        actual_item = self._item_placements.get(location_name)
        if actual_item is None:
            return None

        # Helper to extract item name from various formats
        def extract_item_name(item_spec):
            """Extract item name from various AST/Rule Builder formats."""
            if isinstance(item_spec, str):
                return item_spec
            if isinstance(item_spec, list) and len(item_spec) >= 1:
                # Rule Builder format: [item_name, player]
                return item_spec[0] if isinstance(item_spec[0], str) else None
            if isinstance(item_spec, dict):
                # AST format: could be tuple, constant, etc.
                spec_type = item_spec.get('type')
                if spec_type == 'constant':
                    return item_spec.get('value')
                if spec_type == 'tuple':
                    # Handle both 'elements' (some formats) and 'value' (python_to_json converter)
                    elements = item_spec.get('elements', []) or item_spec.get('value', [])
                    if elements:
                        first_elem = elements[0]
                        if isinstance(first_elem, dict) and first_elem.get('type') == 'constant':
                            return first_elem.get('value')
                        if isinstance(first_elem, str):
                            return first_elem
            return None

        # Handle 'in' operator - check if (item_name, player) tuple is in the right list
        if op == 'in':
            right_items = right
            # AST format might have right as a list or another structure
            if isinstance(right, dict) and right.get('type') == 'list':
                # Handle both 'elements' (some formats) and 'value' (python_to_json converter)
                right_items = right.get('elements', []) or right.get('value', [])
            for item_spec in right_items if isinstance(right_items, list) else [right_items]:
                item_name = extract_item_name(item_spec)
                if item_name and actual_item == item_name:
                    logger.debug(f"ALttP: Compare '{location_name}' contains '{item_name}' -> True")
                    return True
            logger.debug(f"ALttP: Compare '{location_name}' (has '{actual_item}') not in expected items -> False")
            return False

        # Handle '==' operator
        if op in ('==', 'Eq'):
            expected_item = extract_item_name(right)
            if expected_item is not None:
                result = actual_item == expected_item
                logger.debug(f"ALttP: Compare '{location_name}' ('{actual_item}') == '{expected_item}' -> {result}")
                return result

        return None

    def _evaluate_placement_test(self, test: Dict[str, Any]) -> Optional[bool]:
        """Evaluate a test expression that may contain placement checks.

        Handles:
        - AST_placement_search / placement_search: Check if item is at any of the listed locations
        - Or/And of Compare rules with AST_placement_lookup

        Supports both AST format (type: "placement_search") and Rule Builder format
        (rule: "AST_placement_search").
        """
        if not isinstance(test, dict):
            return None

        # Support both AST format ('type') and Rule Builder format ('rule')
        rule_type = test.get('rule') or test.get('type')

        # Handle AST_placement_search (Rule Builder) or placement_search (AST)
        if rule_type in ('AST_placement_search', 'placement_search'):
            # Rule Builder format has args nested, AST format has them at top level
            if 'args' in test:
                test_args = test.get('args', {})
                item_name = test_args.get('item', '')
                player = test_args.get('player', 1)
                locations = test_args.get('locations', [])
            else:
                # AST format - item/player/locations are at top level
                item_arg = test.get('item', '')
                # Extract item name - could be string or dict with 'value'
                if isinstance(item_arg, dict):
                    item_name = item_arg.get('value', '')
                else:
                    item_name = str(item_arg)
                # Extract player - could be int or dict with 'value'
                player_arg = test.get('player', {'type': 'constant', 'value': 1})
                if isinstance(player_arg, dict):
                    player = player_arg.get('value', 1)
                else:
                    player = player_arg
                locations = test.get('locations', [])
            return self._evaluate_placement_search(item_name, player, locations)

        # Handle Compare with AST_placement_lookup (both Rule Builder and AST format)
        if rule_type in ('Compare', 'compare'):
            return self._evaluate_placement_comparison(test)

        # Handle Or of placement comparisons (both Rule Builder and AST format)
        if rule_type in ('Or', 'or', 'bool_or'):
            # Rule Builder uses 'children', AST uses 'operands' or 'conditions'
            children = test.get('children', []) or test.get('operands', []) or test.get('conditions', [])
            results = [self._evaluate_placement_comparison(c) for c in children]
            # If all results are known, return the OR of them
            if all(r is not None for r in results):
                return any(results)
            # If any result is True, we know the OR is True
            if any(r is True for r in results):
                return True
            return None

        # Handle And of placement comparisons (both Rule Builder and AST format)
        if rule_type in ('And', 'and', 'bool_and'):
            # Rule Builder uses 'children', AST uses 'operands' or 'conditions'
            children = test.get('children', []) or test.get('operands', []) or test.get('conditions', [])
            results = [self._evaluate_placement_comparison(c) for c in children]
            # If all results are known, return the AND of them
            if all(r is not None for r in results):
                return all(results)
            # If any result is False, we know the AND is False
            if any(r is False for r in results):
                return False
            return None

        return None

    def _resolve_placement_conditionals(self, rule: Dict[str, Any], depth: int = 0) -> Dict[str, Any]:
        """Resolve conditionals with placement-dependent tests to the correct branch.

        When a Conditional has a test that depends on item placements (AST_placement_search
        or Compare with AST_placement_lookup), we can evaluate it at export time since we
        know the actual item placements. This resolves complex key logic rules in dungeons.

        Supports both AST format (type: "conditional") and Rule Builder format
        (rule: "Conditional").

        Args:
            rule: A rule dictionary that may contain conditionals
            depth: Recursion depth for debugging

        Returns:
            The rule with placement conditionals resolved
        """
        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('rule') or rule.get('type')

        # Handle Conditional rules (both Rule Builder and AST format)
        if rule_type in ('Conditional', 'conditional'):
            # Rule Builder format has args nested, AST format has them at top level
            if 'args' in rule:
                args = rule.get('args', {})
                test = args.get('test', {})
                if_true_key = 'if_true'
                if_false_key = 'if_false'
                get_branch = lambda key: args.get(key, {'rule': 'True_'})
            else:
                # AST format - test/if_true/if_false are at top level
                test = rule.get('test', {})
                if_true_key = 'if_true'
                if_false_key = 'if_false'
                get_branch = lambda key: rule.get(key, {'type': 'constant', 'value': True})

            # Try to evaluate the test using placement information
            test_result = self._evaluate_placement_test(test)
            if test_result is not None:
                # Return the appropriate branch
                if test_result:
                    if_true = get_branch(if_true_key)
                    logger.debug(f"ALttP: Resolved Conditional to if_true (test evaluated to True)")
                    return self._resolve_placement_conditionals(if_true, depth + 1)
                else:
                    if_false = get_branch(if_false_key)
                    logger.debug(f"ALttP: Resolved Conditional to if_false (test evaluated to False)")
                    return self._resolve_placement_conditionals(if_false, depth + 1)

        # Recursively process children (Rule Builder format uses 'children')
        if 'children' in rule:
            rule['children'] = [self._resolve_placement_conditionals(c, depth + 1) for c in rule.get('children', [])]
        # AST format uses 'operands' for boolean operators
        if 'operands' in rule:
            rule['operands'] = [self._resolve_placement_conditionals(c, depth + 1) for c in rule.get('operands', [])]
        if 'conditions' in rule:
            rule['conditions'] = [self._resolve_placement_conditionals(c, depth + 1) for c in rule.get('conditions', [])]
        # Rule Builder format nests args
        if 'args' in rule and isinstance(rule['args'], dict):
            for key, value in rule['args'].items():
                if isinstance(value, dict):
                    rule['args'][key] = self._resolve_placement_conditionals(value, depth + 1)
                elif isinstance(value, list):
                    rule['args'][key] = [self._resolve_placement_conditionals(v, depth + 1) if isinstance(v, dict) else v for v in value]
        # AST format has top-level keys like 'test', 'if_true', 'if_false', 'left', 'right'
        for key in ('test', 'if_true', 'if_false', 'left', 'right'):
            if key in rule and isinstance(rule[key], dict):
                rule[key] = self._resolve_placement_conditionals(rule[key], depth + 1)

        return rule

    def _is_dungeon_small_key_check(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule is a dungeon-specific small key check.

        Returns True if the rule checks for 'Small Key (DungeonName)'.
        """
        if not isinstance(rule, dict):
            return False

        # Check count_check type (from _lttp_has_key analysis)
        if rule.get('type') == 'count_check':
            item = rule.get('item', '')
            if isinstance(item, str) and item.startswith('Small Key ('):
                dungeon = item[11:-1]  # Extract dungeon name from 'Small Key (X)'
                return dungeon in DUNGEON_NAMES

        # Check item_check type
        if rule.get('type') == 'item_check':
            item = rule.get('item', '')
            if isinstance(item, str) and item.startswith('Small Key ('):
                dungeon = item[11:-1]
                return dungeon in DUNGEON_NAMES

        # Check Rule Builder Has format
        if rule.get('rule') == 'Has':
            args = rule.get('args', {})
            item_name = args.get('item_name', '')
            if isinstance(item_name, str) and item_name.startswith('Small Key ('):
                dungeon = item_name[11:-1]
                return dungeon in DUNGEON_NAMES

        return False

    def _replace_small_key_checks(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Replace dungeon-specific small key checks with can_buy_unlimited helper.

        When small_key_shuffle is 'universal', the server uses can_buy_unlimited
        which checks if any shop with unlimited universal keys is reachable.
        We emit a helper call so the worldgen can properly evaluate shop reachability.

        Recursively processes the rule tree to replace all small key checks.
        """
        if not isinstance(rule, dict):
            return rule

        # Check if this is a small key check that should be replaced
        if self._is_dungeon_small_key_check(rule):
            # Return a helper call to can_buy_unlimited instead of True_
            # This allows proper evaluation of shop reachability
            return {
                'type': 'helper',
                'name': 'can_buy_unlimited',
                'args': [
                    {'type': 'constant', 'value': 'Small Key (Universal)'}
                ]
            }

        # Handle Or/And conditions - recursively process and simplify
        if rule.get('type') in ('or', 'and'):
            conditions = rule.get('conditions', [])
            processed = [self._replace_small_key_checks(c) for c in conditions]
            # Filter out True_ from And (and True_ and X = X)
            if rule.get('type') == 'and':
                processed = [c for c in processed if not (c.get('rule') == 'True_')]
                if not processed:
                    return {'rule': 'True_'}
                if len(processed) == 1:
                    return processed[0]
            # For Or, if any is True_, the whole thing is True
            if rule.get('type') == 'or':
                if any(c.get('rule') == 'True_' for c in processed):
                    return {'rule': 'True_'}
            return {**rule, 'conditions': processed}

        # Handle Rule Builder Or/And format
        if rule.get('rule') in ('Or', 'And'):
            children = rule.get('children', [])
            processed = [self._replace_small_key_checks(c) for c in children]
            if rule.get('rule') == 'And':
                processed = [c for c in processed if not (c.get('rule') == 'True_')]
                if not processed:
                    return {'rule': 'True_'}
                if len(processed) == 1:
                    return processed[0]
            if rule.get('rule') == 'Or':
                if any(c.get('rule') == 'True_' for c in processed):
                    return {'rule': 'True_'}
            return {**rule, 'children': processed}

        # Handle Conditional rules - if both branches are True_, simplify to True_
        if rule.get('rule') == 'Conditional':
            args = rule.get('args', {})
            processed_args = {}
            for key, value in args.items():
                if isinstance(value, dict):
                    processed_args[key] = self._replace_small_key_checks(value)
                else:
                    processed_args[key] = value
            # If both if_true and if_false are True_, the whole conditional is True_
            if_true = processed_args.get('if_true', {})
            if_false = processed_args.get('if_false', {})
            if if_true.get('rule') == 'True_' and if_false.get('rule') == 'True_':
                return {'rule': 'True_'}
            return {**rule, 'args': processed_args}

        # Handle args dict for nested rules
        if 'args' in rule and isinstance(rule['args'], dict):
            processed_args = {}
            for key, value in rule['args'].items():
                if isinstance(value, dict):
                    processed_args[key] = self._replace_small_key_checks(value)
                else:
                    processed_args[key] = value
            return {**rule, 'args': processed_args}

        return rule

    def _compute_bunny_accessible_locations(self, world) -> Set[str]:
        """Compute the set of bunny-accessible locations based on world options.

        The bunny-accessible list is the set of locations that NEVER require Moon Pearl.
        These are locations that can be accessed in bunny form regardless of game mode
        or glitch settings. From ALttP Rules.py bunny_accessible_locations list.

        Note: Superbunny accessible locations (from OverworldGlitchRules.get_superbunny_accessible_locations)
        are NOT included here because they require EITHER Moon Pearl OR specific superbunny
        entrance paths. Since we can't replicate the path-dependent logic in exports,
        we conservatively require Moon Pearl for those locations.
        """
        # Return only the static bunny-accessible locations
        # These locations can ALWAYS be collected in bunny form, no Moon Pearl needed
        return set(BUNNY_ACCESSIBLE_LOCATIONS)

    def _is_bunny_rule_value(self, value) -> bool:
        """Check if a value is a bunny rule lambda (function object or string).

        Handles both:
        - Actual function objects (before JSON serialization)
        - String representations like '<function set_bunny_rules...>' (after serialization)
        """
        if callable(value):
            # It's a function object - check its qualified name
            func_qualname = getattr(value, '__qualname__', '')
            return 'set_bunny_rules' in func_qualname
        elif isinstance(value, str):
            # It's a string - check with regex pattern
            return bool(self.BUNNY_RULE_PATTERN.search(value))
        return False

    def set_location_context(self, location_name: str) -> None:
        """Set the current location context for rule analysis."""
        self._current_location_context = location_name

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Intercept bunny rules before standard analysis.

        Bunny rules are complex lambdas created by set_bunny_rules() that can't be
        properly analyzed because they contain nested lambdas and dynamic path lookups.
        We detect these by checking the function's qualified name and replace them
        with simpler rules.
        """
        if rule_func is None:
            return None

        # Check if this is a bunny rule lambda by its qualified name
        func_qualname = getattr(rule_func, '__qualname__', '')
        if 'set_bunny_rules' in func_qualname:
            location_name = rule_target_name or self._current_location_context or ''
            logger.debug(f"ALttP: Intercepting bunny rule for '{location_name}'")
            return self._get_bunny_replacement_rule(location_name)

        # Not a bunny rule - let standard analysis handle it
        return None

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """Get helper definitions with mode-dependent helpers resolved.

        For glitch helpers that check the mode option at runtime, we resolve
        them to simpler rules based on the actual mode. This ensures the
        worldgen world has the correct rules without needing the mode option.
        """
        # Get base helper definitions
        helpers = super().get_helper_definitions(world)

        # Helper for creating item check rules (simple format for helper definitions)
        def _item(name: str) -> Dict[str, Any]:
            return {'type': 'item_check', 'item': name}

        def _and(*conditions) -> Dict[str, Any]:
            return {'type': 'and', 'conditions': list(conditions)}

        def _or(*conditions) -> Dict[str, Any]:
            return {'type': 'or', 'conditions': list(conditions)}

        # Resolve mode-dependent glitch helpers
        # can_boots_clip_lw: In inverted mode, requires Boots + Pearl; otherwise just Boots
        if 'can_boots_clip_lw' in helpers:
            if self._is_inverted_mode:
                logger.debug("ALttP: Resolving can_boots_clip_lw helper for inverted mode (Boots + Pearl)")
                helpers['can_boots_clip_lw'] = _and(_item('Pegasus Boots'), _item('Moon Pearl'))
            else:
                logger.debug("ALttP: Resolving can_boots_clip_lw helper for normal mode (Boots only)")
                helpers['can_boots_clip_lw'] = _item('Pegasus Boots')

        # can_boots_clip_dw: In normal mode, requires Boots + Pearl; otherwise just Boots
        if 'can_boots_clip_dw' in helpers:
            if self._is_inverted_mode:
                logger.debug("ALttP: Resolving can_boots_clip_dw helper for inverted mode (Boots only)")
                helpers['can_boots_clip_dw'] = _item('Pegasus Boots')
            else:
                logger.debug("ALttP: Resolving can_boots_clip_dw helper for normal mode (Boots + Pearl)")
                helpers['can_boots_clip_dw'] = _and(_item('Pegasus Boots'), _item('Moon Pearl'))

        # can_get_glitched_speed_dw: Boots + (Hookshot OR Sword); normal mode also needs Pearl
        if 'can_get_glitched_speed_dw' in helpers:
            sword_check = {'type': 'group_check', 'group': 'Swords'}
            base = _and(_item('Pegasus Boots'), _or(_item('Hookshot'), sword_check))
            if self._is_inverted_mode:
                logger.debug("ALttP: Resolving can_get_glitched_speed_dw helper for inverted mode (no Pearl)")
                helpers['can_get_glitched_speed_dw'] = base
            else:
                logger.debug("ALttP: Resolving can_get_glitched_speed_dw helper for normal mode (needs Pearl)")
                helpers['can_get_glitched_speed_dw'] = _and(base, _item('Moon Pearl'))

        return helpers

    def expand_helper(self, helper_name: str, args: List[Any] = None) -> Optional[Dict[str, Any]]:
        """Expand ALttP-specific helper functions to their resolved rules.

        Handles mode-dependent glitch helpers like can_boots_clip_lw/dw which have
        different requirements in inverted vs normal mode. We evaluate these at
        export time based on the current mode option.

        In StateHelpers.py:
        - can_boots_clip_lw: In inverted mode, requires Pegasus Boots + Moon Pearl;
                            otherwise just Pegasus Boots
        - can_boots_clip_dw: In normal mode, requires Pegasus Boots + Moon Pearl;
                            otherwise just Pegasus Boots
        - can_get_glitched_speed_dw: Requires Pegasus Boots + (Hookshot OR Sword);
                                    in normal mode also requires Moon Pearl
        """
        # Check base class expansions first
        base_result = super().expand_helper(helper_name, args)
        if base_result is not None:
            return base_result

        # Handle can_buy_unlimited for universal keys
        # When small_key_shuffle is 'universal', shops with unlimited universal keys
        # are accessible in normal gameplay. We expand this to True for simplicity.
        if helper_name == 'can_buy_unlimited' and self._is_universal_keys:
            logger.debug("ALttP: Expanding can_buy_unlimited to True (universal keys enabled)")
            return {'type': 'constant', 'value': True}

        # Helper for creating item check rules
        def _item(name: str) -> Dict[str, Any]:
            return {'type': 'item_check', 'item': {'type': 'constant', 'value': name}}

        def _and(*conditions) -> Dict[str, Any]:
            return {'type': 'and', 'conditions': list(conditions)}

        def _or(*conditions) -> Dict[str, Any]:
            return {'type': 'or', 'conditions': list(conditions)}

        # Handle can_boots_clip_lw
        # In inverted mode: Pegasus Boots + Moon Pearl
        # In normal mode: just Pegasus Boots
        if helper_name == 'can_boots_clip_lw':
            if self._is_inverted_mode:
                logger.debug("ALttP: Expanding can_boots_clip_lw for inverted mode (Boots + Pearl)")
                return _and(_item('Pegasus Boots'), _item('Moon Pearl'))
            else:
                logger.debug("ALttP: Expanding can_boots_clip_lw for normal mode (Boots only)")
                return _item('Pegasus Boots')

        # Handle can_boots_clip_dw
        # In normal mode: Pegasus Boots + Moon Pearl
        # In inverted mode: just Pegasus Boots
        if helper_name == 'can_boots_clip_dw':
            if self._is_inverted_mode:
                logger.debug("ALttP: Expanding can_boots_clip_dw for inverted mode (Boots only)")
                return _item('Pegasus Boots')
            else:
                logger.debug("ALttP: Expanding can_boots_clip_dw for normal mode (Boots + Pearl)")
                return _and(_item('Pegasus Boots'), _item('Moon Pearl'))

        # Handle can_get_glitched_speed_dw
        # Requires Pegasus Boots + (Hookshot OR Sword)
        # In normal mode, also requires Moon Pearl
        if helper_name == 'can_get_glitched_speed_dw':
            # Base requirement: Boots + (Hookshot OR Sword)
            # has_sword expands to any sword
            sword_check = {'type': 'group_check', 'group': 'Swords'}
            base_requirements = _and(
                _item('Pegasus Boots'),
                _or(_item('Hookshot'), sword_check)
            )
            if self._is_inverted_mode:
                logger.debug("ALttP: Expanding can_get_glitched_speed_dw for inverted mode (no Pearl)")
                return base_requirements
            else:
                logger.debug("ALttP: Expanding can_get_glitched_speed_dw for normal mode (needs Pearl)")
                return _and(base_requirements, _item('Moon Pearl'))

        return None

    def post_process_location_data(self, location_data: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """Post-process location data to handle bunny rule lambdas.

        When bunny rules are serialized, they appear as strings like:
        "<function set_bunny_rules.<locals>.get_rule_to_add.<locals>.<lambda>>"

        We convert these to simpler rules:
        - If the location is bunny-accessible, the bunny rule part is always True
        - Otherwise, require Moon Pearl

        Note: Most bunny rules are now intercepted earlier by override_rule_analysis,
        but this handles any that slip through in serialized form.
        """
        if 'access_rule' in location_data and location_data['access_rule']:
            location_data['access_rule'] = self._process_bunny_rules(
                location_data['access_rule'], location_name
            )
        return location_data

    def _process_bunny_rules(self, rule: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """Recursively process a rule tree to replace bunny rule lambdas."""
        if not isinstance(rule, dict):
            return rule


        # Check if this is a constant with a list of bunny rule lambdas
        # This handles the AST_any_of iterator case
        if rule.get('type') == 'constant':
            value = rule.get('value')
            if isinstance(value, list) and any(
                self._is_bunny_rule_value(v)
                for v in value
            ):
                # Replace entire constant with bunny replacement rule
                return self._get_bunny_replacement_rule(location_name)

        # Check if this is an item_check with a bunny rule lambda
        if rule.get('type') == 'item_check':
            item = rule.get('item', '')
            if self._is_bunny_rule_value(item):
                return self._get_bunny_replacement_rule(location_name)

        # Check Rule Builder format Has with bunny rule lambda
        if rule.get('rule') == 'Has':
            args = rule.get('args', {})
            item_name = args.get('item_name', '')
            if self._is_bunny_rule_value(item_name):
                return self._get_bunny_replacement_rule(location_name)

        # Check for AST_any_of with bunny rules in iterator
        if rule.get('rule') == 'AST_any_of' or rule.get('type') == 'any_of':
            args = rule.get('args', {})
            iterator_info = args.get('iterator_info', rule.get('iterator_info', {}))
            iterator = iterator_info.get('iterator', {})
            if iterator.get('type') == 'constant':
                value = iterator.get('value', [])
                has_bunny = isinstance(value, list) and any(
                    self._is_bunny_rule_value(v)
                    for v in value
                )
                if has_bunny:
                    # This entire any_of is a bunny rule - replace it
                    return self._get_bunny_replacement_rule(location_name)
            # Also check nested element_rule
            element_rule = args.get('element_rule', rule.get('element_rule', {}))
            if element_rule:
                processed_element = self._process_bunny_rules(element_rule, location_name)
                if processed_element != element_rule:
                    # If we replaced something in element_rule, check if it's now a simple rule
                    # Handle both AST format (type) and Rule Builder format (rule)
                    if processed_element.get('type') in ('constant', 'item_check'):
                        return processed_element
                    # Also handle Rule Builder format replacements (e.g., Has, True_)
                    if processed_element.get('rule') in ('Has', 'True_', 'False_'):
                        return processed_element
                    if 'args' in rule:
                        args = {**args, 'element_rule': processed_element}
                        return {**rule, 'args': args}
                    else:
                        return {**rule, 'element_rule': processed_element}

        # Check for Or/And with bunny rules in children
        if rule.get('type') in ('or', 'and'):
            conditions = rule.get('conditions', [])
            processed = [self._process_bunny_rules(c, location_name) for c in conditions]
            # If all conditions simplified to True, return True
            if all(c.get('type') == 'constant' and c.get('value') == True for c in processed):
                return {'type': 'constant', 'value': True}
            return {**rule, 'conditions': processed}

        # Check Rule Builder format Or/And
        if rule.get('rule') in ('Or', 'And'):
            children = rule.get('children', [])
            processed = [self._process_bunny_rules(c, location_name) for c in children]
            # If all children simplified to True_, return True_
            if all(c.get('rule') == 'True_' or (c.get('type') == 'constant' and c.get('value') == True)
                   for c in processed):
                return {'rule': 'True_'}
            return {**rule, 'children': processed}

        # Check args dict for nested rules (different from args list)
        if 'args' in rule and isinstance(rule['args'], dict):
            processed_args = {}
            for key, value in rule['args'].items():
                if isinstance(value, dict):
                    processed_args[key] = self._process_bunny_rules(value, location_name)
                else:
                    processed_args[key] = value
            return {**rule, 'args': processed_args}

        # Check args list for nested rules
        if 'args' in rule and isinstance(rule['args'], list):
            processed_args = [self._process_bunny_rules(a, location_name) if isinstance(a, dict) else a
                            for a in rule['args']]
            return {**rule, 'args': processed_args}

        return rule

    def _get_bunny_replacement_rule(self, location_name: str, region_name: str = None) -> Dict[str, Any]:
        """Get the replacement rule for a bunny rule lambda.

        Bunny rules check if a location is accessible when in bunny form (Dark World
        without Moon Pearl in standard mode). The rules evaluate dynamically based on
        available entrance paths.

        Since we can't replicate the dynamic path evaluation, we use this approximation:
        - Locations in BUNNY_ACCESSIBLE_LOCATIONS are always accessible in bunny form
        - In glitch modes, locations in MANDATORY_SUPERBUNNY_LOCATIONS are also accessible
          without Moon Pearl (their superbunny entrance paths are mandatory connections)
        - For other Dark World locations, require Moon Pearl since the player needs it
          to not be a bunny and interact with most objects/NPCs
        """
        # Always-accessible locations (bunny can collect in any mode)
        if location_name in self._bunny_accessible_locations:
            logger.debug(f"ALttP: Location '{location_name}' is in bunny-accessible list")
            return {'rule': 'True_'}

        # In glitch modes, certain locations have mandatory superbunny paths
        # that are never shuffled, so they don't require Moon Pearl
        if self._is_glitch_mode and location_name in MANDATORY_SUPERBUNNY_LOCATIONS:
            logger.debug(f"ALttP: Location '{location_name}' has mandatory superbunny path in glitch mode")
            return {'rule': 'True_'}

        # In glitch modes, other superbunny locations can be accessed with Mirror
        # The rule is: Moon Pearl OR Magic Mirror (for superbunny revival)
        if self._is_glitch_mode and location_name in MIRROR_SUPERBUNNY_LOCATIONS:
            logger.debug(f"ALttP: Location '{location_name}' can use superbunny with mirror in glitch mode")
            return {
                'rule': 'Or',
                'children': [
                    {'rule': 'Has', 'args': {'item_name': 'Moon Pearl'}},
                    {'rule': 'Has', 'args': {'item_name': 'Magic Mirror'}}
                ]
            }

        # For other locations with bunny rules, require Moon Pearl.
        # The bunny rule's existence means the location is in a Dark World region
        # and the player needs Moon Pearl to not be a bunny.
        logger.debug(f"ALttP: Replacing bunny rule for '{location_name}' with Moon Pearl requirement")
        return {'rule': 'Has', 'args': {'item_name': 'Moon Pearl'}}

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process entire export data to handle bunny rules and universal keys.

        Handles:
        1. Exit/entrance rules with bunny rule lambdas
        2. Location rules in mixed regions (both Light World and Dark World)
        3. Universal small key conversion when small_key_shuffle is 'universal'
        4. Placement-dependent conditional resolution (item_name_in_location_names)

        For mixed regions, the Moon Pearl requirement added by _get_bunny_replacement_rule
        is removed since there are Light World paths available. Only pure Dark World
        regions require Moon Pearl.

        For universal keys, all dungeon-specific small key checks are replaced with
        can_buy_unlimited helper calls to properly evaluate shop reachability.

        For placement conditionals, rules that check where items are placed are
        resolved using the actual item placements from the export data.
        """
        # Extract item placements from the export data for resolving placement conditionals
        self._item_placements = self._extract_item_placements_from_data(data)

        # Process regions to handle entrance/exit rules and fix mixed region locations
        regions = data.get('regions', {})
        for player_id, player_regions in regions.items():
            for region_name, region_data in player_regions.items():
                is_dark_world = region_data.get('is_dark_world', False)
                is_light_world = region_data.get('is_light_world', False)
                is_mixed_region = is_dark_world and is_light_world

                # Process locations
                for location_data in region_data.get('locations', []):
                    location_name = location_data.get('name', '')
                    access_rule = location_data.get('access_rule', {})

                    # Resolve placement search conditionals first
                    if access_rule and self._item_placements:
                        location_data['access_rule'] = self._resolve_placement_conditionals(access_rule)
                        access_rule = location_data.get('access_rule', {})

                    # For mixed regions, remove Moon Pearl requirement from compound rules
                    # (since Light World paths are available, Moon Pearl isn't required)
                    if is_mixed_region and access_rule and location_name not in self._bunny_accessible_locations:
                        location_data['access_rule'] = self._remove_moon_pearl_from_rule(
                            access_rule, location_name
                        )
                        access_rule = location_data.get('access_rule', {})

                                # Replace dungeon small key checks when universal keys are enabled
                    if self._is_universal_keys and access_rule:
                        location_data['access_rule'] = self._replace_small_key_checks(access_rule)

                # Process exits
                # Check if this is a bunny-impassable cave - these need Moon Pearl
                # to exit even in mixed regions (inverted mode specific)
                is_bunny_impassable = region_name in BUNNY_IMPASSABLE_CAVES

                for exit_data in region_data.get('exits', []):
                    exit_name = exit_data.get('name', region_name)
                    if 'access_rule' in exit_data and exit_data['access_rule']:
                        # Resolve placement search conditionals first
                        if self._item_placements:
                            exit_data['access_rule'] = self._resolve_placement_conditionals(
                                exit_data['access_rule']
                            )
                        exit_data['access_rule'] = self._process_bunny_rules(
                            exit_data['access_rule'], exit_name
                        )
                        # For exits from mixed regions, remove Moon Pearl requirement
                        # since there are Light World paths available.
                        # BUT: Don't remove Moon Pearl from bunny-impassable caves -
                        # these require Moon Pearl to exit even in mixed regions.
                        if is_mixed_region and not is_bunny_impassable:
                            exit_data['access_rule'] = self._remove_moon_pearl_from_rule(
                                exit_data['access_rule'], exit_name
                            )
                        # Replace dungeon small key checks when universal keys are enabled
                        if self._is_universal_keys:
                            exit_data['access_rule'] = self._replace_small_key_checks(
                                exit_data['access_rule']
                            )

                # Process entrances
                for entrance_data in region_data.get('entrances', []):
                    entrance_name = entrance_data.get('name', region_name)
                    if 'access_rule' in entrance_data and entrance_data['access_rule']:
                        # Resolve placement search conditionals first
                        if self._item_placements:
                            entrance_data['access_rule'] = self._resolve_placement_conditionals(
                                entrance_data['access_rule']
                            )
                        entrance_data['access_rule'] = self._process_bunny_rules(
                            entrance_data['access_rule'], entrance_name
                        )
                        # Replace dungeon small key checks when universal keys are enabled
                        if self._is_universal_keys:
                            entrance_data['access_rule'] = self._replace_small_key_checks(
                                entrance_data['access_rule']
                            )

        return data

    def get_game_info(self, world) -> Dict[str, Any]:
        """Get ALttP-specific game information for the frontend.

        Exports bunny rule metadata that enables path-based bunny evaluation
        in the Universal Tracker. This allows proper handling of the complex
        path-dependent bunny rules in ALttP.

        Metadata exported:
        - bunny_impassable_caves: Regions where bunnies cannot pass through
        - bunny_accessible_locations: Locations accessible in bunny form
        - mandatory_superbunny_locations: Locations with mandatory superbunny paths (glitch modes)
        - mirror_superbunny_locations: Locations with mirror superbunny paths (glitch modes)
        """
        game_info = super().get_game_info(world)

        # Add bunny rule metadata for path-based evaluation
        game_info['bunny_rules'] = {
            'bunny_impassable_caves': sorted(BUNNY_IMPASSABLE_CAVES),
            'bunny_accessible_locations': sorted(BUNNY_ACCESSIBLE_LOCATIONS),
            'mandatory_superbunny_locations': sorted(MANDATORY_SUPERBUNNY_LOCATIONS),
            'mirror_superbunny_locations': sorted(MIRROR_SUPERBUNNY_LOCATIONS),
        }

        return game_info

    def _is_bunny_moon_pearl_rule(self, rule: Dict[str, Any], location_name: str) -> bool:
        """Check if this is a Moon Pearl rule added by bunny rule replacement.

        Returns True if the entire rule is ONLY about Moon Pearl requirements
        (either a simple Has(Moon Pearl) or a compound AND of Moon Pearl requirements).
        This handles cases where multiple bunny rules were added to the same location.

        Only applies to locations NOT in the bunny-accessible list.
        """
        if location_name in self._bunny_accessible_locations:
            return False

        if not isinstance(rule, dict):
            return False

        return self._is_pure_moon_pearl_rule(rule)

    def _is_pure_moon_pearl_rule(self, rule: Dict[str, Any]) -> bool:
        """Recursively check if a rule is purely about Moon Pearl.

        Returns True if the rule is:
        - Has(Moon Pearl)
        - AND of pure Moon Pearl rules
        - Nested structure that only contains Moon Pearl requirements
        """
        if not isinstance(rule, dict):
            return False

        # Check for Has(Moon Pearl) - Rule Builder format
        if rule.get('rule') == 'Has':
            args = rule.get('args', {})
            return args.get('item_name') == 'Moon Pearl'

        # Check for item_check(Moon Pearl) - AST format
        if rule.get('type') == 'item_check':
            return rule.get('item') == 'Moon Pearl'

        # Check for AND rule - all conditions must be Moon Pearl
        if rule.get('type') == 'and':
            conditions = rule.get('conditions', [])
            if not conditions:
                return False
            return all(self._is_pure_moon_pearl_rule(c) for c in conditions)

        # Check for Rule Builder And
        if rule.get('rule') == 'And':
            children = rule.get('children', [])
            if not children:
                return False
            return all(self._is_pure_moon_pearl_rule(c) for c in children)

        return False

    def _remove_moon_pearl_from_rule(self, rule: Dict[str, Any], rule_name: str) -> Dict[str, Any]:
        """Remove Moon Pearl requirements from a rule, keeping other requirements.

        For mixed regions (both Light World and Dark World accessible), the bunny
        rule system adds Moon Pearl requirements. But since there are Light World
        paths available, Moon Pearl isn't actually required.

        This handles:
        - Pure Moon Pearl rules: Replace with True_
        - AND rules with Moon Pearl: Remove Moon Pearl children, keep others
        - Nested structures: Recursively process

        Args:
            rule: The rule dict to process
            rule_name: Name of the rule (for logging)

        Returns:
            The rule with Moon Pearl requirements removed
        """
        if not isinstance(rule, dict):
            return rule

        # If this is a pure Moon Pearl rule, replace with True_
        if self._is_pure_moon_pearl_rule(rule):
            logger.debug(f"ALttP: Removed Moon Pearl from mixed region exit '{rule_name}'")
            return {'rule': 'True_'}

        # Handle Rule Builder And - filter out Moon Pearl children
        if rule.get('rule') == 'And':
            children = rule.get('children', [])
            # Remove children that are pure Moon Pearl rules
            filtered_children = [
                child for child in children
                if not self._is_pure_moon_pearl_rule(child)
            ]
            if len(filtered_children) != len(children):
                logger.debug(f"ALttP: Removed Moon Pearl from AND rule for exit '{rule_name}'")

            if not filtered_children:
                return {'rule': 'True_'}
            elif len(filtered_children) == 1:
                return filtered_children[0]
            else:
                return {'rule': 'And', 'children': filtered_children}

        # Handle AST-style 'and' rules
        if rule.get('type') == 'and':
            conditions = rule.get('conditions', [])
            # Remove conditions that are pure Moon Pearl rules
            filtered_conditions = [
                cond for cond in conditions
                if not self._is_pure_moon_pearl_rule(cond)
            ]
            if len(filtered_conditions) != len(conditions):
                logger.debug(f"ALttP: Removed Moon Pearl from AND rule for exit '{rule_name}'")

            if not filtered_conditions:
                return {'rule': 'True_'}
            elif len(filtered_conditions) == 1:
                return filtered_conditions[0]
            else:
                return {'type': 'and', 'conditions': filtered_conditions}

        # Handle Rule Builder HasAll - filter out Moon Pearl from items list
        if rule.get('rule') == 'HasAll':
            args = rule.get('args', {})
            items = args.get('items', [])
            if 'Moon Pearl' in items:
                filtered_items = [item for item in items if item != 'Moon Pearl']
                logger.debug(f"ALttP: Removed Moon Pearl from HasAll rule for '{rule_name}'")
                if not filtered_items:
                    return {'rule': 'True_'}
                elif len(filtered_items) == 1:
                    return {'rule': 'Has', 'args': {'item_name': filtered_items[0]}}
                else:
                    return {'rule': 'HasAll', 'args': {'items': filtered_items}}

        # Handle Rule Builder HasAny - filter out Moon Pearl from items list
        if rule.get('rule') == 'HasAny':
            args = rule.get('args', {})
            items = args.get('items', [])
            if 'Moon Pearl' in items:
                filtered_items = [item for item in items if item != 'Moon Pearl']
                logger.debug(f"ALttP: Removed Moon Pearl from HasAny rule for '{rule_name}'")
                if not filtered_items:
                    # If only Moon Pearl was in HasAny, that means Moon Pearl was the only option
                    # In a mixed region, this becomes True_
                    return {'rule': 'True_'}
                else:
                    # Keep the rest of the items as valid options (the original HasAny becomes simpler)
                    return {'rule': 'HasAny', 'args': {'items': filtered_items}}

        # No changes needed
        return rule
