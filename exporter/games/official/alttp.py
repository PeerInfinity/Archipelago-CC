"""A Link to the Past game-specific export handler.

This exporter handles ALttP-specific patterns:
- Bunny rules: Complex dynamic rules that check if locations are accessible
  in bunny form (Dark World without Moon Pearl). The main analyzer handles
  these via factory function execution, producing any_of rules with Moon Pearl
  and Light World path alternatives. For entrance shuffle modes, this exporter
  also adds Moon Pearl requirements to exits where the shuffled connectivity
  differs from the vanilla paths that the original rules assumed.
- Shop price rules: Rules that check if the player has enough resources
  to purchase items from shops. The analyzer handles these by resolving
  enum comparisons and control flow to produce the correct item requirements.
"""

from typing import Dict, Any, Optional, List, Set, Callable
from ..base import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)

# --- Dynamic imports from original ALttP code ---
# These functions allow us to stay in sync with the original code rather than
# maintaining duplicate hardcoded lists.

def _get_invalid_bunny_revival_dungeons() -> Set[str]:
    """Get the set of invalid bunny revival dungeons from original ALttP code."""
    try:
        from worlds.alttp import OverworldGlitchRules
        return set(OverworldGlitchRules.get_invalid_bunny_revival_dungeons())
    except ImportError:
        logger.warning("Could not import ALttP OverworldGlitchRules, using fallback list")
        # Fallback list if import fails
        return {'Tower of Hera (Bottom)', 'Swamp Palace (Entrance)', 'Turtle Rock (Entrance)', 'Sanctuary'}


def _get_superbunny_accessible_locations() -> Set[str]:
    """Get the set of superbunny accessible locations from original ALttP code."""
    try:
        from worlds.alttp import OverworldGlitchRules
        return set(OverworldGlitchRules.get_superbunny_accessible_locations())
    except ImportError:
        logger.warning("Could not import ALttP OverworldGlitchRules, using fallback list")
        # Fallback - this is from get_superbunny_accessible_locations()
        return {
            'Waterfall of Wishing - Left', 'Waterfall of Wishing - Right', "King's Tomb",
            'Floodgate', 'Floodgate Chest', 'Cave 45', 'Bonk Rock Cave', 'Brewery',
            'C-Shaped House', 'Chest Game', 'Mire Shed - Left', 'Mire Shed - Right',
            'Secret Passage', 'Ice Rod Cave', 'Pyramid Fairy - Left', 'Pyramid Fairy - Right',
            'Superbunny Cave - Top', 'Superbunny Cave - Bottom', "Blind's Hideout - Left",
            "Blind's Hideout - Right", "Blind's Hideout - Far Left", "Blind's Hideout - Far Right",
            'Kakariko Well - Left', 'Kakariko Well - Middle', 'Kakariko Well - Right',
            'Kakariko Well - Bottom', 'Kakariko Tavern', 'Library', 'Spiral Cave',
            "Sahasrahla's Hut - Left", "Sahasrahla's Hut - Middle", "Sahasrahla's Hut - Right",
        }


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
# Derived dynamically from GlitchesRequired options - all modes except no_glitches
def _get_glitch_modes_with_superbunny() -> Set[str]:
    """Get the set of glitch modes that enable superbunny accessibility.

    Derives this dynamically from the GlitchesRequired class in Options.py.
    All glitch modes except 'no_glitches' enable superbunny accessibility.
    """
    try:
        from worlds.alttp.Options import GlitchesRequired
        # Get all option_* attributes and extract mode names (excluding no_glitches)
        return {
            key.replace('option_', '') for key, value in vars(GlitchesRequired).items()
            if key.startswith('option_') and key != 'option_no_glitches'
        }
    except ImportError:
        logger.warning("Could not import ALttP Options, using fallback glitch modes list")
        return {'minor_glitches', 'overworld_glitches', 'hybrid_major_glitches', 'no_logic'}


GLITCH_MODES_WITH_SUPERBUNNY = _get_glitch_modes_with_superbunny()

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


# --- Special case bunny revival rules ---
# These are hardcoded because they represent special logic in Rules.py get_rule_to_add()
# that cannot be extracted from generator functions. See Rules.py lines ~1694-1699.
#
# The full list from get_invalid_bunny_revival_dungeons() includes:
#   Tower of Hera (Bottom), Swamp Palace (Entrance), Turtle Rock (Entrance), Sanctuary
#
# However, Rules.py applies different rules to each:
#   1. Swamp Palace (Entrance): Moon Pearl ONLY (0hp revive not in logic)
#   2. Tower of Hera (Bottom): (Magic Mirror AND sword) OR Moon Pearl (must hit crystal)
#   3. Others (Turtle Rock, Sanctuary): Magic Mirror OR Moon Pearl

# Swamp Palace requires 0hp revival which is not in logic, so only Moon Pearl works
SWAMP_PALACE_ENTRANCE = 'Swamp Palace (Entrance)'

# Tower of Hera requires hitting a crystal switch, so needs (Mirror AND sword) OR Moon Pearl
TOWER_OF_HERA_BOTTOM = 'Tower of Hera (Bottom)'

# These are the dungeons that get the standard Magic Mirror OR Moon Pearl rule
# (all invalid bunny revival dungeons except Swamp Palace and Tower of Hera)
STANDARD_MIRROR_REVIVAL_DUNGEONS = {
    'Turtle Rock (Entrance)',
    'Sanctuary',
}

# Other superbunny accessible locations in glitch modes that require Magic Mirror
# (in addition to Moon Pearl as an alternative). Computed dynamically from
# OverworldGlitchRules.get_superbunny_accessible_locations() minus the mandatory ones.
# For these, the rule is: Moon Pearl OR Magic Mirror
MIRROR_SUPERBUNNY_LOCATIONS = _get_superbunny_accessible_locations() - MANDATORY_SUPERBUNNY_LOCATIONS

# Regions that contain ONLY superbunny-accessible locations.
# In glitch modes, exits to these regions should not require Moon Pearl.
# These regions are specifically accessible via superbunny state.
MANDATORY_SUPERBUNNY_REGIONS = {
    'Superbunny Cave (Top)',      # Contains: Superbunny Cave - Top, Superbunny Cave - Bottom
    'Kakariko Well (top)',        # Contains: Kakariko Well - Left/Middle/Right/Bottom
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

# Fallback set of dungeon names for small key mapping (used if world.dungeons unavailable)
_FALLBACK_DUNGEON_NAMES = {
    'Hyrule Castle', 'Agahnims Tower', 'Eastern Palace', 'Desert Palace',
    'Tower of Hera', 'Palace of Darkness', 'Swamp Palace', 'Skull Woods',
    'Thieves Town', 'Ice Palace', 'Misery Mire', 'Turtle Rock', 'Ganons Tower'
}


def _get_dungeon_names(world) -> Set[str]:
    """Get the set of dungeon names from the world object.

    Reads dungeon names dynamically from world.dungeons when available,
    falling back to a hardcoded list if the world is not available.
    """
    if world is not None and hasattr(world, 'dungeons') and world.dungeons:
        return set(world.dungeons.keys())
    return _FALLBACK_DUNGEON_NAMES


class ALttPGameExportHandler(GenericGameExportHandler):
    """Export handler for A Link to the Past."""

    # Pattern to detect serialized bunny rule lambdas
    BUNNY_RULE_PATTERN = re.compile(r'<function set_bunny_rules\.')

    # World attributes that need to be exported for rule evaluation
    # These values are computed at runtime based on item_pool option
    WORLD_ATTRIBUTES = {
        'logical_heart_containers': lambda w, m, p: getattr(w, 'logical_heart_containers', 10),
        'logical_heart_pieces': lambda w, m, p: getattr(w, 'logical_heart_pieces', 36),
    }

    def __init__(self, world=None):
        """Initialize with optional world reference."""
        super().__init__(world)
        self._current_location_context = None
        self._is_glitch_mode = self._check_glitch_mode(world)
        self._is_inverted_mode = self._check_inverted_mode(world)
        self._is_universal_keys = self._check_universal_keys(world)
        self._entrance_shuffle_mode = self._check_entrance_shuffle_mode(world)
        self._is_no_logic_single_player = self._check_no_logic_single_player(world)
        self._item_placements: Dict[str, str] = {}
        # Dungeon names for small key validation - read from world.dungeons when available
        self._dungeon_names = _get_dungeon_names(world)

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

    def _check_entrance_shuffle_mode(self, world) -> str:
        """Check the entrance shuffle mode.

        Returns the entrance_shuffle option value, or 'vanilla' if not set.
        Used to detect modes that trigger complex glitch rules.

        Entrance shuffle modes:
        - vanilla: No shuffle
        - dungeons_simple, simple, restricted: Basic shuffles with simpler rules
        - dungeons_full, full: Complex rules with dungeon_entrance.access_rule
        - dungeons_crossed, crossed, insanity: Complex rules with fix_fake_world
        """
        if world is None or not hasattr(world, 'options'):
            return 'vanilla'
        if not hasattr(world.options, 'entrance_shuffle'):
            return 'vanilla'
        mode = world.options.entrance_shuffle.current_key
        if mode in ('full', 'dungeons_full'):
            logger.info(f"ALttP: Entrance shuffle mode '{mode}' detected - will intercept glitch rules")
        return mode

    def _check_no_logic_single_player(self, world) -> bool:
        """Check if the world is in no_logic single-player mode.

        In no_logic single-player mode, ALttP's set_rules() returns early
        without setting any rules at all. This means:
        - All locations are accessible without items
        - All exits are passable without items
        - No bunny rules, no key rules, nothing

        We need to detect this to avoid exporting rules that don't exist
        in the original world. When this returns True, all rules should
        be trivially True (no access requirements).
        """
        if world is None:
            return False
        if not hasattr(world, 'options') or not hasattr(world.options, 'glitches_required'):
            return False
        if world.options.glitches_required.current_key != 'no_logic':
            return False
        # Check if this is a single-player world
        if not hasattr(world, 'multiworld'):
            return False
        if world.multiworld.players != 1:
            return False
        logger.info("ALttP: Detected no_logic single-player mode - all rules will be trivial")
        return True
    def _get_option_value(self, option_name: str) -> Any:
        """Get the value of an option from the world.

        Returns the numeric value for Choice options (for comparison with int values).
        Returns None if the option doesn't exist.
        """
        if self.world is None or not hasattr(self.world, 'options'):
            return None
        if not hasattr(self.world.options, option_name):
            return None
        option = getattr(self.world.options, option_name)
        # Return the numeric value for proper comparison
        return getattr(option, 'value', option)

    def _resolve_option_comparison(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Resolve a Compare rule that uses OptionValue to True/False.

        Evaluates comparisons like:
            Compare(OptionValue(mode), ==, 0)
            Compare(OptionValue(small_key_shuffle), ==, 5)

        Uses the actual option values from self.world.options to evaluate
        the comparison at export time.

        Args:
            rule: A rule dict that may be a Compare with OptionValue

        Returns:
            {'rule': 'True_'} or {'rule': 'False_'} if resolved,
            None if not an OptionValue comparison
        """
        if not isinstance(rule, dict):
            return None

        rule_type = rule.get('rule') or rule.get('type')
        if rule_type not in ('Compare', 'compare'):
            return None

        # Get args - Rule Builder format has args nested
        if 'args' in rule:
            args = rule.get('args', {})
            left = args.get('left', {})
            op = args.get('op', '')
            right = args.get('right')
        else:
            left = rule.get('left', {})
            op = rule.get('op', '')
            right = rule.get('right')

        # Check if left is an OptionValue
        left_option = None
        if isinstance(left, dict):
            left_rule = left.get('rule') or left.get('type')
            if left_rule in ('OptionValue', 'option_value'):
                left_args = left.get('args', {}) if 'args' in left else left
                left_option = left_args.get('option', '')

        # Check if right is an OptionValue
        right_option = None
        if isinstance(right, dict):
            right_rule = right.get('rule') or right.get('type')
            if right_rule in ('OptionValue', 'option_value'):
                right_args = right.get('args', {}) if 'args' in right else right
                right_option = right_args.get('option', '')

        # Need at least one OptionValue to resolve
        if not left_option and not right_option:
            return None

        # Get values
        if left_option:
            left_value = self._get_option_value(left_option)
            if left_value is None:
                return None
        else:
            left_value = right if not isinstance(right, dict) else None
            if left_value is None:
                return None

        if right_option:
            right_value = self._get_option_value(right_option)
            if right_value is None:
                return None
        else:
            right_value = right if not isinstance(right, dict) else None
            if right_value is None:
                return None

        # Swap if right was the option
        if right_option and not left_option:
            left_value, right_value = right_value, left_value
            # Swap the operator for non-symmetric comparisons
            if op in ('<', '<=', '>', '>='):
                op = {'<': '>', '>': '<', '<=': '>=', '>=': '<='}[op]

        # Evaluate the comparison
        try:
            if op == '==' or op == 'Eq':
                result = left_value == right_value
            elif op == '!=' or op == 'NotEq':
                result = left_value != right_value
            elif op == '<' or op == 'Lt':
                result = left_value < right_value
            elif op == '<=' or op == 'LtE':
                result = left_value <= right_value
            elif op == '>' or op == 'Gt':
                result = left_value > right_value
            elif op == '>=' or op == 'GtE':
                result = left_value >= right_value
            elif op == 'in' or op == 'In':
                result = left_value in right_value if hasattr(right_value, '__contains__') else False
            elif op == 'not in' or op == 'NotIn':
                result = left_value not in right_value if hasattr(right_value, '__contains__') else True
            else:
                logger.debug(f"ALttP: Unknown comparison operator '{op}' in OptionValue comparison")
                return None

            logger.debug(f"ALttP: Resolved OptionValue comparison: {left_option or right_option} ({left_value}) {op} {right_value} = {result}")
            return {'rule': 'True_'} if result else {'rule': 'False_'}
        except Exception as e:
            logger.debug(f"ALttP: Failed to evaluate OptionValue comparison: {e}")
            return None

    def _resolve_option_comparisons_in_rule(self, rule: Dict[str, Any], depth: int = 0) -> Dict[str, Any]:
        """Recursively resolve OptionValue comparisons in a rule tree.

        Walks through the rule tree and resolves any Compare rules that
        use OptionValue to True_/False_ based on actual option values.

        Args:
            rule: A rule dict to process
            depth: Recursion depth (for debugging)

        Returns:
            The rule with OptionValue comparisons resolved
        """
        if not isinstance(rule, dict):
            return rule

        # Try to resolve this rule if it's an OptionValue comparison
        resolved = self._resolve_option_comparison(rule)
        if resolved is not None:
            return resolved

        rule_type = rule.get('rule') or rule.get('type')

        # Handle And/Or - recursively process children and simplify
        if rule_type in ('And', 'and', 'bool_and'):
            children = rule.get('children', []) or rule.get('operands', []) or rule.get('conditions', [])
            processed = [self._resolve_option_comparisons_in_rule(c, depth + 1) for c in children]

            # Filter out True_ from And (True AND X = X)
            filtered = [c for c in processed if not (isinstance(c, dict) and c.get('rule') == 'True_')]
            # If any is False_, the whole And is False_
            if any(isinstance(c, dict) and c.get('rule') == 'False_' for c in processed):
                return {'rule': 'False_'}

            if not filtered:
                return {'rule': 'True_'}
            if len(filtered) == 1:
                return filtered[0]

            # Update the appropriate key
            if 'children' in rule:
                return {**rule, 'children': filtered}
            elif 'operands' in rule:
                return {**rule, 'operands': filtered}
            elif 'conditions' in rule:
                return {**rule, 'conditions': filtered}
            return {**rule, 'children': filtered}

        if rule_type in ('Or', 'or', 'bool_or'):
            children = rule.get('children', []) or rule.get('operands', []) or rule.get('conditions', [])
            processed = [self._resolve_option_comparisons_in_rule(c, depth + 1) for c in children]

            # If any is True_, the whole Or is True_
            if any(isinstance(c, dict) and c.get('rule') == 'True_' for c in processed):
                return {'rule': 'True_'}
            # Filter out False_ from Or (False OR X = X)
            filtered = [c for c in processed if not (isinstance(c, dict) and c.get('rule') == 'False_')]

            if not filtered:
                return {'rule': 'False_'}
            if len(filtered) == 1:
                return filtered[0]

            if 'children' in rule:
                return {**rule, 'children': filtered}
            elif 'operands' in rule:
                return {**rule, 'operands': filtered}
            elif 'conditions' in rule:
                return {**rule, 'conditions': filtered}
            return {**rule, 'children': filtered}

        # Handle Conditional - process test and branches
        if rule_type in ('Conditional', 'conditional'):
            if 'args' in rule:
                args = rule.get('args', {})
                test = self._resolve_option_comparisons_in_rule(args.get('test', {}), depth + 1)
                if_true = self._resolve_option_comparisons_in_rule(args.get('if_true', {}), depth + 1)
                if_false = self._resolve_option_comparisons_in_rule(args.get('if_false', {}), depth + 1)

                # If test resolved to a constant, return the appropriate branch
                if isinstance(test, dict) and test.get('rule') == 'True_':
                    return if_true
                if isinstance(test, dict) and test.get('rule') == 'False_':
                    return if_false

                return {**rule, 'args': {**args, 'test': test, 'if_true': if_true, 'if_false': if_false}}
            else:
                test = self._resolve_option_comparisons_in_rule(rule.get('test', {}), depth + 1)
                if_true = self._resolve_option_comparisons_in_rule(rule.get('if_true', {}), depth + 1)
                if_false = self._resolve_option_comparisons_in_rule(rule.get('if_false', {}), depth + 1)

                if isinstance(test, dict) and test.get('rule') == 'True_':
                    return if_true
                if isinstance(test, dict) and test.get('rule') == 'False_':
                    return if_false

                return {**rule, 'test': test, 'if_true': if_true, 'if_false': if_false}

        # Recursively process nested rules in args
        if 'args' in rule and isinstance(rule['args'], dict):
            processed_args = {}
            for key, value in rule['args'].items():
                if isinstance(value, dict):
                    processed_args[key] = self._resolve_option_comparisons_in_rule(value, depth + 1)
                elif isinstance(value, list):
                    processed_args[key] = [
                        self._resolve_option_comparisons_in_rule(v, depth + 1) if isinstance(v, dict) else v
                        for v in value
                    ]
                else:
                    processed_args[key] = value
            return {**rule, 'args': processed_args}

        return rule

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

        # Flatten locations list - handle multiple formats:
        # 1. Simple list: ["Location Name", player] or just "Location Name"
        # 2. Tuple format: {"type": "tuple", "elements": [{"type": "constant", "value": "Location Name"}, ...]}
        # 3. Direct dict: {"type": "constant", "value": "Location Name"}
        location_names = []
        for loc in locations:
            if isinstance(loc, dict):
                # Handle tuple format: {"type": "tuple", "elements": [...]}
                if loc.get('type') == 'tuple':
                    elements = loc.get('elements', [])
                    if elements:
                        first_elem = elements[0]
                        if isinstance(first_elem, dict) and first_elem.get('type') == 'constant':
                            location_names.append(first_elem.get('value', ''))
                        elif isinstance(first_elem, str):
                            location_names.append(first_elem)
                # Handle constant format: {"type": "constant", "value": "Location Name"}
                elif loc.get('type') == 'constant':
                    location_names.append(loc.get('value', ''))
            elif isinstance(loc, list) and len(loc) >= 1:
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
                # Extract locations - could be a list or a dict with 'type': 'list' and 'value'
                locations_arg = test.get('locations', [])
                if isinstance(locations_arg, dict) and locations_arg.get('type') == 'list':
                    locations = locations_arg.get('value', [])
                else:
                    locations = locations_arg
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
                return dungeon in self._dungeon_names

        # Check item_check type
        if rule.get('type') == 'item_check':
            item = rule.get('item', '')
            if isinstance(item, str) and item.startswith('Small Key ('):
                dungeon = item[11:-1]
                return dungeon in self._dungeon_names

        # Check Rule Builder Has format
        if rule.get('rule') == 'Has':
            args = rule.get('args', {})
            item_name = args.get('item_name', '')
            if isinstance(item_name, str) and item_name.startswith('Small Key ('):
                dungeon = item_name[11:-1]
                return dungeon in self._dungeon_names

        return False

    def _replace_small_key_checks(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Replace dungeon-specific small key checks with True when universal keys enabled.

        When small_key_shuffle is 'universal', the server uses can_buy_unlimited
        which checks if any shop with unlimited universal keys is reachable.
        Since universal key shops are accessible in normal gameplay and this method
        is only called when universal keys are enabled, we expand directly to True.

        Recursively processes the rule tree to replace all small key checks.
        """
        if not isinstance(rule, dict):
            return rule

        # Check if this is a small key check that should be replaced
        if self._is_dungeon_small_key_check(rule):
            # With universal keys enabled, replace dungeon small key checks with
            # can_buy_unlimited('Small Key (Universal)') - this requires actually
            # reaching a shop that sells unlimited universal keys.
            # Note: This method is only called when self._is_universal_keys is True
            # (checked at call sites in post_process_data).
            return {
                'rule': 'can_buy_unlimited',
                '_original_ast_type': 'helper',
                '_converted_from_ast': True,
                'args': [
                    {
                        'rule': 'Constant',
                        'args': {'value': 'Small Key (Universal)'},
                        '_converted_from_ast': True
                    }
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

        # Handle basement_key_rule helper - this internally checks for Hyrule Castle keys
        # With universal keys, replace with can_buy_unlimited helper
        # Check multiple formats:
        # 1. Rule Builder format: {'rule': 'basement_key_rule'}
        # 2. AST converted format: {'_original_ast_type': 'helper', 'rule': 'basement_key_rule'}
        # 3. Helper format: {'type': 'helper', 'name': 'basement_key_rule'}
        is_basement_key_rule = (
            rule.get('rule') == 'basement_key_rule' or
            (rule.get('_original_ast_type') == 'helper' and rule.get('rule') == 'basement_key_rule') or
            (rule.get('type') == 'helper' and rule.get('name') == 'basement_key_rule')
        )
        if is_basement_key_rule:
            return {
                'type': 'helper',
                'name': 'can_buy_unlimited',
                'args': [
                    {'type': 'constant', 'value': 'Small Key (Universal)'}
                ]
            }

        return rule

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
        """Intercept complex rules before standard analysis.

        Currently returns None for all rules, letting the main analyzer handle them
        via factory function execution. The analyzer produces proper any_of rules
        for bunny rules with Moon Pearl and path alternatives.
        """
        # All rules are handled by the generic analyzer
        return None

    def postprocess_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process rules to handle dungeon_entrance closure variable references.

        The UnderworldGlitchRules.py module creates rules that reference a closure
        variable `dungeon_entrance` which is an entrance object captured at runtime.
        These rules are emitted as-is by the analyzer but can't be evaluated in the
        worldgen context because the closure variable doesn't exist.

        Pattern detected:
        - AST_function_call with function.object.name == "dungeon_entrance"
        - Function calls to dungeon_entrance.access_rule(...)
        - can_reach calls on dungeon_entrance

        These are replaced with True_ since:
        1. They depend on entrance shuffle configuration (runtime data)
        2. Without entrance shuffle data, we can't determine actual requirements
        3. True_ is conservative - it allows access when unsure

        Returns:
            Processed rule dict with dungeon_entrance references replaced
        """
        if not isinstance(rule, dict):
            return rule

        # Check if this rule contains dungeon_entrance references
        if self._contains_dungeon_entrance_ref(rule):
            logger.debug(f"ALttP: Replacing dungeon_entrance rule with True_")
            return {'rule': 'True_'}

        # Recursively process child rules
        return self._postprocess_rule_recursive(rule)

    def _contains_dungeon_entrance_ref(self, rule: Any) -> bool:
        """Check if a rule tree contains references to dungeon_entrance closure variable.

        Detects patterns like:
        - {"type": "name", "name": "dungeon_entrance"}
        - {"rule": "Name", "args": {"name": "dungeon_entrance"}}
        """
        if not isinstance(rule, dict):
            return False

        # Check for AST format name reference
        if rule.get('type') == 'name' and rule.get('name') == 'dungeon_entrance':
            return True

        # Check for Rule Builder format Name reference
        if rule.get('rule') == 'Name':
            args = rule.get('args', {})
            if args.get('name') == 'dungeon_entrance':
                return True

        # Recursively check all values in the dict
        for value in rule.values():
            if isinstance(value, dict):
                if self._contains_dungeon_entrance_ref(value):
                    return True
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict) and self._contains_dungeon_entrance_ref(item):
                        return True

        return False

    def _postprocess_rule_recursive(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively post-process a rule, replacing dungeon_entrance references.

        Checks each child rule for dungeon_entrance references and replaces them
        with True_.
        """
        if not isinstance(rule, dict):
            return rule

        # Make a copy to avoid modifying the original
        result = dict(rule)

        # Process Rule Builder format And/Or children
        if result.get('rule') in ('And', 'Or'):
            children = result.get('children', [])
            new_children = []
            for child in children:
                if isinstance(child, dict):
                    if self._contains_dungeon_entrance_ref(child):
                        new_children.append({'rule': 'True_'})
                    else:
                        new_children.append(self._postprocess_rule_recursive(child))
                else:
                    new_children.append(child)
            result['children'] = new_children

        # Process AST format and/or conditions
        if result.get('type') in ('and', 'or'):
            conditions = result.get('conditions', [])
            new_conditions = []
            for cond in conditions:
                if isinstance(cond, dict):
                    if self._contains_dungeon_entrance_ref(cond):
                        new_conditions.append({'type': 'constant', 'value': True})
                    else:
                        new_conditions.append(self._postprocess_rule_recursive(cond))
                else:
                    new_conditions.append(cond)
            result['conditions'] = new_conditions

        # Process args if present (for Rule Builder format)
        if 'args' in result:
            args = result['args']
            if isinstance(args, dict):
                new_args = {}
                for key, value in args.items():
                    if isinstance(value, dict):
                        if self._contains_dungeon_entrance_ref(value):
                            new_args[key] = {'rule': 'True_'}
                        else:
                            new_args[key] = self._postprocess_rule_recursive(value)
                    elif isinstance(value, list):
                        new_args[key] = [
                            ({'rule': 'True_'} if isinstance(item, dict) and self._contains_dungeon_entrance_ref(item)
                             else self._postprocess_rule_recursive(item) if isinstance(item, dict)
                             else item)
                            for item in value
                        ]
                    else:
                        new_args[key] = value
                result['args'] = new_args
            elif isinstance(args, list):
                new_args = []
                for item in args:
                    if isinstance(item, dict):
                        if self._contains_dungeon_entrance_ref(item):
                            new_args.append({'rule': 'True_'})
                        else:
                            new_args.append(self._postprocess_rule_recursive(item))
                    else:
                        new_args.append(item)
                result['args'] = new_args

        return result

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

        # Note: can_buy_unlimited is NOT expanded to True anymore.
        # When small_key_shuffle is 'universal', rules that check for dungeon small keys
        # are replaced with can_buy_unlimited('Small Key (Universal)'), which requires
        # actually reaching a shop that sells unlimited universal keys.
        # The can_buy_unlimited helper is exported to the worldgen world's Rules.py
        # and evaluates shop reachability at runtime.

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

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """Get ALttP-specific location attributes including shop price info.

        For shop locations, exports shop_price and shop_price_type which are used
        to generate access rules based on the price type (Hearts, Bombs, Arrows).
        """
        attributes = super().get_location_attributes(location, world)

        # Export shop price information if present
        shop_price_type = getattr(location, 'shop_price_type', None)
        shop_price = getattr(location, 'shop_price', 0)

        if shop_price_type is not None:
            # Convert enum to int if needed
            price_type_value = int(shop_price_type) if hasattr(shop_price_type, 'value') else shop_price_type
            attributes['shop_price_type'] = price_type_value
            attributes['shop_price'] = shop_price
            logger.debug(f"ALttP: Exported shop price info for '{location.name}': type={price_type_value}, price={shop_price}")

        return attributes

    def post_process_location_data(self, location_data: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """Post-process location data to handle bunny rule lambdas and shop price rules.

        When bunny rules are serialized, they appear as strings like:
        "<function set_bunny_rules.<locals>.get_rule_to_add.<locals>.<lambda>>"

        We convert these to simpler rules:
        - If the location is bunny-accessible, the bunny rule part is always True
        - Otherwise, require Moon Pearl

        For shop locations with randomized cost types, generates access rules:
        - Hearts (type 1): has_hearts helper with count = (price // 8) + 1
        - Bombs (type 3): can_use_bombs helper with count = price
        - Arrows (type 4): can_hold_arrows helper with count = price

        Note: Most bunny rules are now intercepted earlier by override_rule_analysis,
        but this handles any that slip through in serialized form.
        """
        if 'access_rule' in location_data and location_data['access_rule']:
            location_data['access_rule'] = self._process_bunny_rules(
                location_data['access_rule'], location_name
            )

        # Shop price rules are now fully handled by the analyzer:
        # - Hearts/Bombs/Arrows types: Inlined to has_hearts/can_use_bombs/can_hold_arrows
        # - Rupees (type 0): Returns True (no access rule needed)

        return location_data

    def _generate_shop_price_rule(self, location_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Generate an access rule for shop price requirements.

        Based on ALttP shop_price_rules in Shops.py:
        - Hearts (type 1): has_hearts(player, (price // 8) + 1)
        - Bombs (type 3): can_use_bombs(player, price)
        - Arrows (type 4): can_hold_arrows(player, price)

        Returns None for other price types (Rupees, etc.) which have no requirements.

        Note: Shop price rules are added in create_shops() via add_rule(), not in
        set_rules(). This means they ARE enforced even in no_logic mode, since
        the no_logic early return in set_rules() doesn't affect rules added elsewhere.
        """
        shop_price_type = location_data.get('shop_price_type')
        shop_price = location_data.get('shop_price', 0)

        if shop_price_type is None:
            return None

        # Helper to create a constant argument in the correct Rule Builder format
        def _constant_arg(value):
            return {
                'rule': 'Constant',
                'args': {'value': value},
                '_converted_from_ast': True
            }

        # ShopPriceType values from ALttP Shops.py:
        # Hearts = 1, Bombs = 3, Arrows = 4
        if shop_price_type == 1:  # Hearts
            heart_count = (shop_price // 8) + 1
            return {
                'rule': 'has_hearts',
                '_original_ast_type': 'helper',
                '_converted_from_ast': True,
                'args': [_constant_arg(heart_count)]
            }
        elif shop_price_type == 3:  # Bombs
            return {
                'rule': 'can_use_bombs',
                '_original_ast_type': 'helper',
                '_converted_from_ast': True,
                'args': [_constant_arg(shop_price)]
            }
        elif shop_price_type == 4:  # Arrows
            return {
                'rule': 'can_hold_arrows',
                '_original_ast_type': 'helper',
                '_converted_from_ast': True,
                'args': [_constant_arg(shop_price)]
            }

        # No rule needed for Rupees, Magic, etc.
        return None

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

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process entire export data to handle bunny rules and universal keys.

        Handles:
        1. Exit/entrance rules with bunny rule lambdas
        2. Location rules in mixed regions (both Light World and Dark World)
        3. Universal small key conversion when small_key_shuffle is 'universal'
        4. Placement-dependent conditional resolution (item_name_in_location_names)
        5. OptionValue comparison resolution for option-dependent rules

        For mixed regions, the Moon Pearl requirement added by _get_bunny_replacement_rule
        is removed since there are Light World paths available. Only pure Dark World
        regions require Moon Pearl.

        For universal keys, all dungeon-specific small key checks are replaced with
        can_buy_unlimited helper calls to properly evaluate shop reachability.

        For placement conditionals, rules that check where items are placed are
        resolved using the actual item placements from the export data.
        """
        logger.debug("ALttP: Starting post_process_data")
        # Extract item placements from the export data for resolving placement conditionals
        self._item_placements = self._extract_item_placements_from_data(data)

        # Process regions to handle entrance/exit rules and fix mixed region locations
        regions = data.get('regions', {})
        for player_id, player_regions in regions.items():
            # Identify starting regions (directly connected from Menu with no item requirements)
            # These regions are accessible in "Link state" at the start of the game
            starting_regions = set()
            menu_data = player_regions.get('Menu', {})
            for exit_data in menu_data.get('exits', []):
                rule = exit_data.get('access_rule', {})
                # Consider a region "starting" if Menu connects to it with True_ rule
                # or no special item requirements (just reachability checks like CanReachLocation)
                # Handle both Rule Builder format (rule: True_) and AST format (type: constant, value: True)
                is_true_rule = (
                    not rule or
                    rule.get('rule') == 'True_' or
                    (rule.get('type') == 'constant' and rule.get('value') == True) or
                    rule.get('rule') == 'CanReachLocation' or
                    rule.get('type') == 'state_method'  # can_reach checks are also passable
                )
                if is_true_rule:
                    connected = exit_data.get('connected_region')
                    if connected:
                        starting_regions.add(connected)
            logger.debug(f"ALttP: Identified starting regions for player {player_id}: {starting_regions}")

            for region_name, region_data in player_regions.items():
                is_dark_world = region_data.get('is_dark_world', False)
                is_light_world = region_data.get('is_light_world', False)
                is_mixed_region = is_dark_world and is_light_world
                # Region types: 1=LightWorld, 2=DarkWorld, 3=Cave, 4=Dungeon
                region_type = region_data.get('type', 0)

                # Process locations
                for location_data in region_data.get('locations', []):
                    location_name = location_data.get('name', '')
                    access_rule = location_data.get('access_rule', {})

                    # In no_logic single-player mode, all locations should be trivially accessible
                    # EXCEPT for shop price rules, which are enforced even in no_logic mode.
                    # Shop price rules are added in create_shops() via add_rule(), not in
                    # set_rules(), so the no_logic early return doesn't affect them.
                    if self._is_no_logic_single_player:
                        # Check if this location has shop price requirements
                        # ShopPriceType: 1=Hearts, 3=Bombs, 4=Arrows (0=Rupees, 2=Magic need no rule)
                        shop_price_type = location_data.get('shop_price_type')
                        if shop_price_type in (1, 3, 4):
                            # Regenerate the shop price rule to ensure it's preserved
                            shop_rule = self._generate_shop_price_rule(location_data)
                            location_data['access_rule'] = shop_rule if shop_rule else {}
                        else:
                            location_data['access_rule'] = {}
                        continue

                    # Resolve OptionValue comparisons first (e.g., mode checks, small_key_shuffle checks)
                    if access_rule:
                        location_data['access_rule'] = self._resolve_option_comparisons_in_rule(access_rule)
                        access_rule = location_data.get('access_rule', {})

                    # Resolve placement search conditionals
                    if access_rule and self._item_placements:
                        location_data['access_rule'] = self._resolve_placement_conditionals(access_rule)
                        access_rule = location_data.get('access_rule', {})

                    # Replace dungeon small key checks when universal keys are enabled
                    if self._is_universal_keys and access_rule:
                        location_data['access_rule'] = self._replace_small_key_checks(access_rule)

                # Process exits
                for exit_data in region_data.get('exits', []):
                    exit_name = exit_data.get('name', region_name)
                    # In no_logic single-player mode, all exits should be trivially passable
                    # since set_rules() returns early without setting any rules
                    if self._is_no_logic_single_player:
                        exit_data['access_rule'] = {'rule': 'True_'}
                        continue
                    if 'access_rule' in exit_data and exit_data['access_rule']:
                        # Resolve OptionValue comparisons first
                        exit_data['access_rule'] = self._resolve_option_comparisons_in_rule(
                            exit_data['access_rule']
                        )
                        # Resolve placement search conditionals
                        if self._item_placements:
                            exit_data['access_rule'] = self._resolve_placement_conditionals(
                                exit_data['access_rule']
                            )
                        exit_data['access_rule'] = self._process_bunny_rules(
                            exit_data['access_rule'], exit_name
                        )
                        connected_region_name = exit_data.get('connected_region', '')

                        # In glitch modes, exits to certain invalid bunny revival dungeons
                        # can use Magic Mirror for bunny revival instead of Moon Pearl.
                        # Note: Swamp Palace is NOT included - 0hp revival isn't in logic,
                        # so only Moon Pearl works there.
                        # Note: Tower of Hera (Bottom) has a special case requiring sword.
                        # Skip in no_logic single-player mode where no rules are set.
                        if (not self._is_no_logic_single_player and
                            self._is_glitch_mode and connected_region_name in STANDARD_MIRROR_REVIVAL_DUNGEONS):
                            exit_data['access_rule'] = self._add_mirror_alternative_to_moon_pearl(
                                exit_data['access_rule'], exit_name
                            )
                        # Tower of Hera (Bottom) has a special case - requires hitting a crystal switch.
                        # Rule is: (Magic Mirror AND sword) OR Moon Pearl
                        # Skip in no_logic single-player mode where no rules are set.
                        if (not self._is_no_logic_single_player and
                            self._is_glitch_mode and connected_region_name == TOWER_OF_HERA_BOTTOM):
                            exit_data['access_rule'] = self._add_hera_bottom_alternative_to_moon_pearl(
                                exit_data['access_rule'], exit_name
                            )
                        # In glitch modes, exits FROM dungeon-type regions don't require
                        # Moon Pearl for bunny revival. The original ALttP code returns
                        # `lambda state: True` for dungeon regions in glitch mode
                        # (see Rules.py get_rule_to_add() line ~1700-1701).
                        # This allows Magic Mirror bunny revival inside dungeons.
                        if self._is_glitch_mode and region_type == 4:  # 4 = Dungeon
                            exit_data['access_rule'] = self._remove_moon_pearl_from_rule(
                                exit_data['access_rule'], exit_name
                            )
                        # In glitch modes, exits TO mandatory superbunny regions don't require
                        # Moon Pearl. The superbunny entrances to these regions are mandatory
                        # connections that are never shuffled, allowing access in bunny form.
                        if self._is_glitch_mode and connected_region_name in MANDATORY_SUPERBUNNY_REGIONS:
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
                    connected_region = entrance_data.get('connected_region', '')
                    # In no_logic single-player mode, all entrances should be trivially passable
                    if self._is_no_logic_single_player:
                        entrance_data['access_rule'] = {'rule': 'True_'}
                        continue
                    if 'access_rule' in entrance_data and entrance_data['access_rule']:
                        # Resolve OptionValue comparisons first
                        entrance_data['access_rule'] = self._resolve_option_comparisons_in_rule(
                            entrance_data['access_rule']
                        )
                        # Resolve placement search conditionals
                        if self._item_placements:
                            entrance_data['access_rule'] = self._resolve_placement_conditionals(
                                entrance_data['access_rule']
                            )
                        entrance_data['access_rule'] = self._process_bunny_rules(
                            entrance_data['access_rule'], entrance_name
                        )
                        # In glitch modes, entrances to certain invalid bunny revival dungeons
                        # can use Magic Mirror for bunny revival instead of Moon Pearl.
                        # Note: Swamp Palace is NOT included - 0hp revival isn't in logic.
                        # Note: Tower of Hera (Bottom) has a special case requiring sword.
                        if self._is_glitch_mode and connected_region in STANDARD_MIRROR_REVIVAL_DUNGEONS:
                            entrance_data['access_rule'] = self._add_mirror_alternative_to_moon_pearl(
                                entrance_data['access_rule'], entrance_name
                            )
                        # Tower of Hera (Bottom) has a special case - requires hitting a crystal switch.
                        # Rule is: (Magic Mirror AND sword) OR Moon Pearl
                        if self._is_glitch_mode and connected_region == TOWER_OF_HERA_BOTTOM:
                            entrance_data['access_rule'] = self._add_hera_bottom_alternative_to_moon_pearl(
                                entrance_data['access_rule'], entrance_name
                            )
                        # Replace dungeon small key checks when universal keys are enabled
                        if self._is_universal_keys:
                            entrance_data['access_rule'] = self._replace_small_key_checks(
                                entrance_data['access_rule']
                            )

        # Process dungeons to resolve OptionValue comparisons in boss rules
        dungeons = data.get('dungeons', {})
        for player_id, player_dungeons in dungeons.items():
            for dungeon_name, dungeon_data in player_dungeons.items():
                # Process boss defeat rules
                bosses = dungeon_data.get('bosses', {})
                for boss_name, boss_data in bosses.items():
                    if 'defeat_rule' in boss_data and boss_data['defeat_rule']:
                        boss_data['defeat_rule'] = self._resolve_option_comparisons_in_rule(
                            boss_data['defeat_rule']
                        )

        # Process helpers to resolve placement conditionals and OptionValue comparisons
        helpers = data.get('helpers', {})
        for player_id, player_helpers in helpers.items():
            for helper_name, helper_def in list(player_helpers.items()):
                if helper_def and isinstance(helper_def, dict):
                    # Resolve OptionValue comparisons
                    player_helpers[helper_name] = self._resolve_option_comparisons_in_rule(helper_def)
                    # Resolve placement conditionals
                    if self._item_placements:
                        player_helpers[helper_name] = self._resolve_placement_conditionals(
                            player_helpers[helper_name]
                        )

        # Add implicit exits for single-entrance caves with entrance shuffle
        # In ALttP with entrance shuffle, single-entrance caves (caves with no defined exits)
        # have an implicit exit back to the entrance's parent region. When entrance shuffle
        # remaps these connections, we need to create explicit exit data for the UT to
        # properly evaluate reachability.
        if self._entrance_shuffle_mode != 'vanilla':
            logger.debug(f"ALttP: Processing single-entrance cave exits for entrance_shuffle={self._entrance_shuffle_mode}")
            for player_id, player_regions in regions.items():
                for region_name, region_data in player_regions.items():
                    entrances = region_data.get('entrances', [])
                    exits = region_data.get('exits', [])

                    # Check if this is a single-entrance cave (has entrances but no exits)
                    # Type 3 = Cave, Type 4 = Dungeon (don't process dungeons)
                    region_type = region_data.get('type', 0)
                    if entrances and not exits and region_type == 3:
                        # Create an implicit exit for each entrance
                        for entrance_data in entrances:
                            parent_region = entrance_data.get('parent_region')
                            entrance_name = entrance_data.get('name', 'Unknown')
                            if parent_region:
                                # Create exit going back to entrance's parent region
                                exit_name = f"{region_name} Exit"
                                implicit_exit = {
                                    'name': exit_name,
                                    'connected_region': parent_region,
                                    'access_rule': {'rule': 'True_'},  # No requirements to exit
                                }
                                region_data['exits'].append(implicit_exit)
                                logger.debug(
                                    f"ALttP: Added implicit exit '{exit_name}' from '{region_name}' "
                                    f"to '{parent_region}' (via entrance '{entrance_name}')"
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

        # Export glitches_required mode for worldgen handling
        # no_logic mode requires special handling - everything is accessible
        if hasattr(world, 'options') and hasattr(world.options, 'glitches_required'):
            game_info['glitches_required'] = world.options.glitches_required.current_key

        # Add bunny rule metadata for path-based evaluation
        game_info['bunny_rules'] = {
            'bunny_impassable_caves': sorted(BUNNY_IMPASSABLE_CAVES),
            'bunny_accessible_locations': sorted(BUNNY_ACCESSIBLE_LOCATIONS),
            'mandatory_superbunny_locations': sorted(MANDATORY_SUPERBUNNY_LOCATIONS),
            'mirror_superbunny_locations': sorted(MIRROR_SUPERBUNNY_LOCATIONS),
        }

        # Export shop data for can_buy_unlimited helper
        # This captures which shops sell unlimited items and their region locations
        if hasattr(world, 'shops') and world.shops:
            shops_data = []
            for shop in world.shops:
                # Get the region name for this shop
                region_name = shop.region.name if hasattr(shop, 'region') and shop.region else None
                if not region_name:
                    continue

                # Collect unlimited items from this shop's inventory
                unlimited_items = []
                for inv in shop.inventory:
                    if inv is None:
                        continue
                    # An item is unlimited if:
                    # 1. max == 0 (truly unlimited) - the 'item' is unlimited
                    # 2. max > 0 with a 'replacement' - the replacement becomes available after max purchases
                    if inv.get('max', 0) == 0:
                        # Truly unlimited item
                        item_name = inv.get('item')
                        if item_name:
                            unlimited_items.append(item_name)
                    elif inv.get('replacement'):
                        # Has a replacement that becomes available after max purchases
                        unlimited_items.append(inv.get('replacement'))

                if unlimited_items:
                    shops_data.append({
                        'region': region_name,
                        'unlimited_items': unlimited_items,
                    })

            if shops_data:
                game_info['shops'] = shops_data
                logger.debug(f"ALttP: Exported {len(shops_data)} shops with unlimited items")

        return game_info

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

    def _rule_contains_moon_pearl(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule contains Moon Pearl anywhere in its structure.

        Returns True if Moon Pearl is required anywhere in the rule,
        even if combined with other requirements.
        """
        if not rule or not isinstance(rule, dict):
            return False

        # True_ has no requirements
        if rule.get('rule') == 'True_':
            return False

        # Check Has(Moon Pearl)
        if rule.get('rule') == 'Has':
            args = rule.get('args', {})
            return args.get('item_name') == 'Moon Pearl'

        # Check HasAll/HasAny containing Moon Pearl
        if rule.get('rule') in ('HasAll', 'HasAny'):
            args = rule.get('args', {})
            items = args.get('items', [])
            return 'Moon Pearl' in items

        # Recursively check And/Or children
        if rule.get('rule') in ('And', 'Or'):
            children = rule.get('children', [])
            return any(self._rule_contains_moon_pearl(c) for c in children)

        # Check AST format
        if rule.get('type') == 'item_check':
            return rule.get('item') == 'Moon Pearl'

        if rule.get('type') in ('and', 'or'):
            conditions = rule.get('conditions', [])
            return any(self._rule_contains_moon_pearl(c) for c in conditions)

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

        # Handle Rule Builder And - recursively process children and filter out Moon Pearl
        if rule.get('rule') == 'And':
            children = rule.get('children', [])
            # First, recursively process each child to remove Moon Pearl from nested rules
            processed_children = [
                self._remove_moon_pearl_from_rule(child, rule_name)
                for child in children
            ]
            # Then filter out children that became True_ (pure Moon Pearl rules)
            filtered_children = [
                child for child in processed_children
                if child != {'rule': 'True_'} and not self._is_pure_moon_pearl_rule(child)
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
            # First, recursively process each condition to remove Moon Pearl from nested rules
            processed_conditions = [
                self._remove_moon_pearl_from_rule(cond, rule_name)
                for cond in conditions
            ]
            # Then filter out conditions that became True_ (pure Moon Pearl rules)
            filtered_conditions = [
                cond for cond in processed_conditions
                if cond != {'rule': 'True_'} and not self._is_pure_moon_pearl_rule(cond)
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
        # NOTE: This function is now only called for EXIT rules, not location rules.
        # For exits, HasAny(Moon Pearl, Magic Mirror) means either satisfies the bunny requirement.
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

        # Handle Rule Builder Or - recursively process children and filter out pure Moon Pearl rules
        # This is used for dungeon exits where _add_mirror_alternative_to_moon_pearl creates
        # Or(Moon Pearl, Magic Mirror), and then dungeon exit processing should remove Moon Pearl.
        # NOTE: This function is now only called for EXIT rules, not location rules.
        # Location rules have Moon Pearl alternatives as game logic and are not processed here.
        if rule.get('rule') == 'Or':
            children = rule.get('children', [])
            # First, recursively process each child
            processed_children = [
                self._remove_moon_pearl_from_rule(child, rule_name)
                for child in children
            ]
            # Filter out children that became True_ (pure Moon Pearl rules)
            filtered_children = [
                child for child in processed_children
                if child != {'rule': 'True_'} and not self._is_pure_moon_pearl_rule(child)
            ]
            if len(filtered_children) != len(children):
                logger.debug(f"ALttP: Removed Moon Pearl from OR rule for exit '{rule_name}'")

            if not filtered_children:
                # All children were Moon Pearl - return True_ (no restriction)
                return {'rule': 'True_'}
            elif len(filtered_children) == 1:
                # Single child remains - unwrap the Or
                return filtered_children[0]
            else:
                return {'rule': 'Or', 'children': filtered_children}

        # Handle AST-style 'or' rules
        if rule.get('type') == 'or':
            conditions = rule.get('conditions', [])
            # First, recursively process each condition
            processed_conditions = [
                self._remove_moon_pearl_from_rule(cond, rule_name)
                for cond in conditions
            ]
            # Filter out conditions that became True_ (pure Moon Pearl rules)
            filtered_conditions = [
                cond for cond in processed_conditions
                if cond != {'rule': 'True_'} and not self._is_pure_moon_pearl_rule(cond)
            ]
            if len(filtered_conditions) != len(conditions):
                logger.debug(f"ALttP: Removed Moon Pearl from OR rule for exit '{rule_name}'")

            if not filtered_conditions:
                # All conditions were Moon Pearl - return True_ (no restriction)
                return {'rule': 'True_'}
            elif len(filtered_conditions) == 1:
                # Single condition remains - unwrap the Or
                return filtered_conditions[0]
            else:
                return {'type': 'or', 'conditions': filtered_conditions}

        # No changes needed
        return rule

    def _add_hera_bottom_alternative_to_moon_pearl(self, rule: Dict[str, Any], rule_name: str) -> Dict[str, Any]:
        """Add (Magic Mirror AND sword) as an alternative to Moon Pearl for Tower of Hera (Bottom).

        Tower of Hera (Bottom) requires hitting a crystal switch for bunny revival,
        so the rule is: (Magic Mirror AND sword) OR Moon Pearl
        This is different from other invalid bunny revival dungeons which only need Magic Mirror.

        See Rules.py get_rule_to_add():
            if region.name == 'Tower of Hera (Bottom)':
                return lambda state: state.has('Magic Mirror', player) and has_sword(state, player) or state.has('Moon Pearl', player)

        Args:
            rule: The rule dict to process
            rule_name: Name of the rule (for logging)

        Returns:
            The rule with (Magic Mirror AND sword) alternative added to Moon Pearl requirements
        """
        if not isinstance(rule, dict):
            return rule

        # Handle pure Moon Pearl rule - add (Magic Mirror AND sword) alternative
        if self._is_pure_moon_pearl_rule(rule):
            logger.debug(f"ALttP: Added (Magic Mirror AND sword) alternative for Tower of Hera (Bottom) '{rule_name}'")
            return {
                'rule': 'Or',
                'children': [
                    {'rule': 'Has', 'args': {'item_name': 'Moon Pearl'}},
                    {
                        'rule': 'And',
                        'children': [
                            {'rule': 'Has', 'args': {'item_name': 'Magic Mirror'}},
                            {'rule': 'HelperCall', 'args': {'helper_name': 'has_sword'}}
                        ]
                    }
                ]
            }

        # Handle Rule Builder And - recursively process children
        if rule.get('rule') == 'And':
            children = rule.get('children', [])
            processed_children = [
                self._add_hera_bottom_alternative_to_moon_pearl(child, rule_name)
                for child in children
            ]
            return {'rule': 'And', 'children': processed_children}

        # Handle Rule Builder Or - recursively process children
        if rule.get('rule') == 'Or':
            children = rule.get('children', [])
            processed_children = [
                self._add_hera_bottom_alternative_to_moon_pearl(child, rule_name)
                for child in children
            ]
            return {'rule': 'Or', 'children': processed_children}

        # No changes needed
        return rule

    def _add_mirror_alternative_to_moon_pearl(self, rule: Dict[str, Any], rule_name: str) -> Dict[str, Any]:
        """Add Magic Mirror as an alternative to Moon Pearl requirements.

        For entrances to invalid bunny revival dungeons in glitch modes, the player
        can use Magic Mirror for bunny revival instead of needing Moon Pearl.
        This transforms Has("Moon Pearl") into Or(Has("Moon Pearl"), Has("Magic Mirror")).

        Args:
            rule: The rule dict to process
            rule_name: Name of the rule (for logging)

        Returns:
            The rule with Magic Mirror alternatives added to Moon Pearl requirements
        """
        if not isinstance(rule, dict):
            return rule

        # Handle pure Moon Pearl rule - add Magic Mirror alternative
        if self._is_pure_moon_pearl_rule(rule):
            logger.debug(f"ALttP: Added Magic Mirror alternative for '{rule_name}'")
            return {
                'rule': 'Or',
                'children': [
                    {'rule': 'Has', 'args': {'item_name': 'Moon Pearl'}},
                    {'rule': 'Has', 'args': {'item_name': 'Magic Mirror'}}
                ]
            }

        # Handle Rule Builder And - recursively process children
        if rule.get('rule') == 'And':
            children = rule.get('children', [])
            processed_children = [
                self._add_mirror_alternative_to_moon_pearl(child, rule_name)
                for child in children
            ]
            return {'rule': 'And', 'children': processed_children}

        # Handle AST-style 'and' rules
        if rule.get('type') == 'and':
            conditions = rule.get('conditions', [])
            processed_conditions = [
                self._add_mirror_alternative_to_moon_pearl(cond, rule_name)
                for cond in conditions
            ]
            return {'type': 'and', 'conditions': processed_conditions}

        # Handle Rule Builder Or - recursively process children
        if rule.get('rule') == 'Or':
            children = rule.get('children', [])
            processed_children = [
                self._add_mirror_alternative_to_moon_pearl(child, rule_name)
                for child in children
            ]
            return {'rule': 'Or', 'children': processed_children}

        # Handle AST-style 'or' rules
        if rule.get('type') == 'or':
            conditions = rule.get('conditions', [])
            processed_conditions = [
                self._add_mirror_alternative_to_moon_pearl(cond, rule_name)
                for cond in conditions
            ]
            return {'type': 'or', 'conditions': processed_conditions}

        # Handle Rule Builder HasAll - if Moon Pearl is in the items, this is complex
        # For now, just add the alternative at this level since Moon Pearl is ANDed with others
        if rule.get('rule') == 'HasAll':
            args = rule.get('args', {})
            items = args.get('items', [])
            if 'Moon Pearl' in items:
                # Transform HasAll([Moon Pearl, X, Y]) into
                # And(Or(Moon Pearl, Magic Mirror), HasAll([X, Y]))
                other_items = [item for item in items if item != 'Moon Pearl']
                mirror_alt = {
                    'rule': 'Or',
                    'children': [
                        {'rule': 'Has', 'args': {'item_name': 'Moon Pearl'}},
                        {'rule': 'Has', 'args': {'item_name': 'Magic Mirror'}}
                    ]
                }
                if not other_items:
                    return mirror_alt
                elif len(other_items) == 1:
                    return {
                        'rule': 'And',
                        'children': [
                            mirror_alt,
                            {'rule': 'Has', 'args': {'item_name': other_items[0]}}
                        ]
                    }
                else:
                    return {
                        'rule': 'And',
                        'children': [
                            mirror_alt,
                            {'rule': 'HasAll', 'args': {'items': other_items}}
                        ]
                    }

        # No changes needed
        return rule
