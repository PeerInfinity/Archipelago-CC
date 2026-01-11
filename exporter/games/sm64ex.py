"""Super Mario 64 EX game-specific exporter handler.

SM64EX uses a custom RuleFactory that converts string expressions into lambda functions.
This exporter parses the Rules.py file directly to extract rule expressions before they're
converted to lambdas, then converts them to JSON format.
"""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
from ..analyzer.source_extraction import _read_source_from_path
import inspect
import logging
import os
import re

logger = logging.getLogger(__name__)


class SM64EXGameExportHandler(GenericGameExportHandler):
    # SM64 uses simple locations without custom attributes
    AUTO_DISCOVER_LOCATION_ATTRIBUTES = False

    # Cap tokens are always collectible items, not affected by enable_move_rando
    # All other tokens in the RuleFactory.token_table are movement abilities
    CAP_TOKENS = {"WC", "MC", "VC"}

    def __init__(self, world=None):
        super().__init__(world=world)
        self._rule_expressions = {}  # Cache for parsed location/subregion rules
        self._entrance_rules = {}  # Cache for parsed entrance rules (keyed by destination key)
        self._token_table = {}  # Token -> item name mapping from RuleFactory

        # Maps destination keys to actual region names after randomization
        self._destination_mapping = {}

        # Parse rules file if world is available
        if world:
            self.parse_rules_file(world)
            self._load_token_table()
            self._build_destination_mapping(world)

    def parse_rules_file(self, world):
        """Parse the SM64 Rules.py file to extract rule expressions."""
        try:
            # Get path to worlds/sm64ex/Rules.py
            world_module = inspect.getmodule(world.__class__)
            if not world_module:
                logger.error("Could not get world module")
                return

            module_file = inspect.getfile(world_module)
            rules_file = os.path.join(os.path.dirname(module_file), 'Rules.py')

            # Read from disk or apworld zip archive
            content = _read_source_from_path(rules_file)
            if content is None:
                logger.error(f"Rules.py not found at {rules_file}")
                return

            # Pattern: rf.assign_rule("location/region name", "rule expression")
            pattern = r'rf\.assign_rule\(\s*["\']([^"\']+)["\']\s*,\s*["\']([^"\']+)["\']\s*\)'
            matches = re.findall(pattern, content)

            for location_name, rule_expr in matches:
                self._rule_expressions[location_name] = rule_expr

            logger.info(f"Parsed {len(self._rule_expressions)} rule expressions from Rules.py")

            # Also parse connect_regions calls with rf.build_rule()
            # There are two patterns:
            # 1. Fixed source: connect_regions(world, player, "Fixed Region", randomized_entrances_s["dest"], rf.build_rule("expr"))
            # 2. Both randomized: connect_regions(world, player, randomized_entrances_s["src"], randomized_entrances_s["dest"], rf.build_rule("expr"))

            # Pattern for both source and destination randomized
            both_rando_pattern = r'connect_regions\([^,]+,\s*[^,]+,\s*randomized_entrances_s\[["\']([^"\']+)["\']\]\s*,\s*randomized_entrances_s\[["\']([^"\']+)["\']\]\s*,\s*rf\.build_rule\(\s*["\']([^"\']+)["\']\s*\)'
            both_matches = re.findall(both_rando_pattern, content)

            for src_key, dest_key, rule_expr in both_matches:
                # Store with both keys so we can match by both source and destination
                self._entrance_rules[(src_key, dest_key)] = rule_expr
                logger.debug(f"Parsed entrance rule ({src_key} -> {dest_key}): {rule_expr}")

            # Pattern for fixed source, randomized destination
            fixed_src_pattern = r'connect_regions\([^,]+,\s*[^,]+,\s*["\']([^"\']+)["\']\s*,\s*randomized_entrances_s\[["\']([^"\']+)["\']\]\s*,\s*rf\.build_rule\(\s*["\']([^"\']+)["\']\s*\)'
            fixed_matches = re.findall(fixed_src_pattern, content)

            for src_region, dest_key, rule_expr in fixed_matches:
                # Fixed source uses region name directly, destination is randomized
                self._entrance_rules[(src_region, dest_key)] = rule_expr
                logger.debug(f"Parsed entrance rule ({src_region} -> {dest_key}): {rule_expr}")

            logger.info(f"Parsed {len(self._entrance_rules)} entrance rules from Rules.py")

        except Exception as e:
            logger.error(f"Error parsing Rules.py: {e}", exc_info=True)

    def _load_token_table(self):
        """Load token table from the world's RuleFactory."""
        from worlds.sm64ex.Rules import RuleFactory
        self._token_table = RuleFactory.token_table.copy()
        logger.debug(f"Loaded {len(self._token_table)} tokens from RuleFactory")

    def _build_destination_mapping(self, world):
        """Build mapping from entrance keys to actual region names.

        SM64 uses area_connections to store the randomized entrance mappings.
        We need to map entrance keys (str) to actual region names (str).

        The _entrance_rules dict now uses tuple keys (src_key, dest_key) where:
        - src_key is either a fixed region name or an entrance key
        - dest_key is an entrance key

        We build _destination_mapping as entrance_key -> actual_region_name.
        """
        try:
            from worlds.sm64ex.Regions import sm64_level_to_entrances, sm64_entrances_to_level

            # Get area_connections from the world object (set during set_rules)
            area_connections = getattr(world, 'area_connections', {})

            if area_connections:
                # area_connections maps entrance_level_int -> destination_level_int
                # We need to map entrance_key (str) -> actual_region_name (str)

                # Reverse the sm64_level_to_entrances to get int -> name
                level_int_to_name = {int(level): name for level, name in sm64_level_to_entrances.items()}

                # Collect all unique entrance keys from the tuple keys
                entrance_keys = set()
                for key in self._entrance_rules.keys():
                    if isinstance(key, tuple):
                        src_key, dest_key = key
                        # Only add if it's an entrance key (not a fixed region name)
                        if src_key in sm64_entrances_to_level:
                            entrance_keys.add(src_key)
                        entrance_keys.add(dest_key)
                    else:
                        entrance_keys.add(key)

                # Build mapping for each entrance key
                for entrance_key in entrance_keys:
                    if entrance_key in sm64_entrances_to_level:
                        entrance_level = int(sm64_entrances_to_level[entrance_key])
                        if entrance_level in area_connections:
                            dest_level = area_connections[entrance_level]
                            if dest_level in level_int_to_name:
                                self._destination_mapping[entrance_key] = level_int_to_name[dest_level]
                                logger.debug(f"Mapped {entrance_key} -> {level_int_to_name[dest_level]}")
                        else:
                            # Entrance not randomized, use default
                            self._destination_mapping[entrance_key] = entrance_key
                    else:
                        # Not an entrance key (fixed region name), use as-is
                        self._destination_mapping[entrance_key] = entrance_key

                logger.info(f"Built destination mapping with {len(self._destination_mapping)} entries")
            else:
                # No area connections (area_rando disabled), use default mapping
                for key in self._entrance_rules.keys():
                    if isinstance(key, tuple):
                        src_key, dest_key = key
                        self._destination_mapping[src_key] = src_key
                        self._destination_mapping[dest_key] = dest_key
                    else:
                        self._destination_mapping[key] = key
                logger.info(f"No area_connections found, using default mapping for {len(self._destination_mapping)} entries")

        except Exception as e:
            logger.warning(f"Could not build destination mapping: {e}")
            # Fallback: use keys as actual names (works when not randomized)
            for key in self._entrance_rules.keys():
                if isinstance(key, tuple):
                    src_key, dest_key = key
                    self._destination_mapping[src_key] = src_key
                    self._destination_mapping[dest_key] = dest_key
                else:
                    self._destination_mapping[key] = key

    def _get_option(self, option_name: str, default=None):
        """Get an option value from the world, with fallback to default."""
        if not self.world or not hasattr(self.world, 'options'):
            return default
        option = getattr(self.world.options, option_name, None)
        if option is None:
            return default
        return option.value

    def parse_rule_expression(self, rule_expr: str, cannon_area: Optional[str] = None) -> Dict[str, Any]:
        """Parse a SM64 rule expression string into JSON rule format.

        Rule expression syntax:
        - | for OR
        - & for AND
        - / for OR (alternative, used within tokens)
        - + for AND with has_all (used within tokens)
        - {region} for region reachability
        - {{location}} for location reachability
        - MOVELESS, CAPLESS, CANNLESS - special flags
        - CANN - cannon for specific area
        - NAR - area randomizer flag
        - Other tokens: TJ, LJ, BF, SF, WK, DV, GP, KK, CL, LG, WC, MC, VC
        """

        # Handle | (OR) at top level
        or_parts = [part.strip() for part in rule_expr.split(' | ')]

        if len(or_parts) > 1:
            # Multiple OR clauses
            conditions = [self.parse_and_expression(part, cannon_area) for part in or_parts]

            # Check if any condition is True (OR short-circuits to True)
            for cond in conditions:
                if cond.get('type') == 'constant' and cond.get('value') == True:
                    return {'type': 'constant', 'value': True}

            # Filter out False conditions (they don't affect OR)
            conditions = [c for c in conditions if c.get('type') != 'constant' or c.get('value') != False]

            if not conditions:
                return {'type': 'constant', 'value': False}
            if len(conditions) == 1:
                return conditions[0]
            return {
                'type': 'or',
                'conditions': conditions
            }
        else:
            # Single expression
            return self.parse_and_expression(or_parts[0], cannon_area)

    def parse_and_expression(self, expr: str, cannon_area: Optional[str] = None) -> Dict[str, Any]:
        """Parse AND expression (tokens separated by &)."""
        and_parts = [part.strip() for part in expr.split(' & ')]

        if len(and_parts) > 1:
            # Multiple AND clauses
            conditions = [self.parse_token_expression(part, cannon_area) for part in and_parts]

            # Check if any condition is False (AND short-circuits to False)
            for cond in conditions:
                if cond.get('type') == 'constant' and cond.get('value') == False:
                    return {'type': 'constant', 'value': False}

            # Filter out True conditions (they don't affect AND)
            conditions = [c for c in conditions if c.get('type') != 'constant' or c.get('value') != True]

            if not conditions:
                return {'type': 'constant', 'value': True}
            if len(conditions) == 1:
                return conditions[0]
            return {
                'type': 'and',
                'conditions': conditions
            }
        else:
            # Single token
            return self.parse_token_expression(and_parts[0], cannon_area)

    def parse_token_expression(self, token_expr: str, cannon_area: Optional[str] = None) -> Dict[str, Any]:
        """Parse a single token or token group."""
        token_expr = token_expr.strip()

        # Handle region reachability: {region name} or {{location name}}
        if token_expr.startswith('{{') and token_expr.endswith('}}'):
            # Location reachability
            location_name = token_expr[2:-2].strip()
            return {'type': 'location_check', 'location': location_name}
        elif token_expr.startswith('{') and token_expr.endswith('}'):
            # Region reachability
            region_name = token_expr[1:-1].strip()
            return {'type': 'can_reach', 'region': region_name}

        # Handle + (has_all) - items required together
        if '+' in token_expr:
            tokens = [t.strip() for t in token_expr.split('+')]
            items = []
            for token in tokens:
                item_name = self.resolve_token(token, cannon_area)
                if item_name == False:
                    # Short-circuit: AND with False = False
                    return {'type': 'constant', 'value': False}
                if item_name and item_name != True:
                    items.append(item_name)

            if not items:
                return {'type': 'constant', 'value': True}
            if len(items) == 1:
                return {'type': 'item_check', 'item': items[0]}
            return {
                'type': 'state_method',
                'method': 'has_all',
                'args': [{'type': 'constant', 'value': items}]
            }

        # Handle / (has_any) - any one of these items
        if '/' in token_expr:
            tokens = [t.strip() for t in token_expr.split('/')]
            items = []
            for token in tokens:
                item_name = self.resolve_token(token, cannon_area)
                if item_name == True:
                    # Short-circuit: OR with True = True
                    return {'type': 'constant', 'value': True}
                if item_name and item_name != False:
                    items.append(item_name)

            if not items:
                return {'type': 'constant', 'value': False}
            if len(items) == 1:
                return {'type': 'item_check', 'item': items[0]}
            return {
                'type': 'state_method',
                'method': 'has_any',
                'args': [{'type': 'constant', 'value': items}]
            }

        # Single token
        item_name = self.resolve_token(token_expr, cannon_area)
        if item_name == True:
            return {'type': 'constant', 'value': True}
        if item_name == False:
            return {'type': 'constant', 'value': False}
        if item_name:
            return {'type': 'item_check', 'item': item_name}

        # Unknown token - preserve as helper
        return {
            'type': 'helper',
            'name': f'sm64_token_{token_expr.lower()}',
            'args': []
        }

    def resolve_token(self, token: str, cannon_area: Optional[str] = None):
        """Resolve a single token to an item name or boolean."""
        token = token.strip()

        # Handle special tokens - these resolve to True/False based on options
        if token == 'MOVELESS':
            return not bool(self._get_option('strict_move_requirements', True))
        if token == 'CAPLESS':
            return not bool(self._get_option('strict_cap_requirements', True))
        if token == 'CANNLESS':
            return not bool(self._get_option('strict_cannon_requirements', True))
        if token == 'NAR':
            # NAR = "No Area Randomization" - True when area rando is OFF
            return int(self._get_option('area_rando', 0)) == 0
        if token == 'CANN':
            # Cannon for specific area
            if cannon_area:
                return f"Cannon Unlock {cannon_area}"
            return "Cannon"  # Generic cannon item

        # Check if it's a known token from the RuleFactory
        if token in self._token_table:
            item_name = self._token_table[token]

            # Cap tokens are always collectible items
            if token in self.CAP_TOKENS:
                return item_name

            # Movement ability tokens depend on move_rando_bitvec
            # If the specific move's bit is not set, the move is always available
            if not self._is_move_randomized(item_name):
                return True  # Move is always available
            return item_name

        # Unknown token
        logger.warning(f"Unknown SM64 token: {token}")
        return None

    def _is_move_randomized(self, item_name: str) -> bool:
        """Check if a specific move is randomized using the move_rando_bitvec.

        The bitvec has a bit set for each move that IS randomized.
        If the bit is 0, the move is always available.
        """
        if not self.world:
            return False

        # Get move_rando_bitvec from the world
        move_rando_bitvec = getattr(self.world, 'move_rando_bitvec', 0)

        if move_rando_bitvec == 0:
            # No moves are randomized
            return False

        # Get the action item data to determine the bitvec offset
        try:
            from worlds.sm64ex.Items import action_item_data_table

            if item_name not in action_item_data_table:
                return False

            double_jump_bitvec_offset = action_item_data_table['Double Jump'].code
            item_offset = action_item_data_table[item_name].code - double_jump_bitvec_offset

            # Check if this move's bit is set in the bitvec
            return (move_rando_bitvec & (1 << item_offset)) != 0

        except Exception as e:
            logger.warning(f"Could not check move randomization for {item_name}: {e}")
            return False

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Override rule analysis for locations with known rule expressions.

        This is called by the exporter before analyzing the rule function.
        If we have the original expression for this location, we parse it
        and return the parsed rule, bypassing the normal analysis.
        """
        # Skip override for locations that have additional rules applied via add_rule
        # These locations need the full lambda analysis
        locations_with_additional_rules = [
            "MIPS 1", "MIPS 2",
            "Toad (Basement)", "Toad (Second Floor)", "Toad (Third Floor)"
        ]
        if rule_target_name in locations_with_additional_rules:
            logger.debug(f"Skipping override for {rule_target_name} - using generic analysis for additional rules")
            return None

        # Check if we have the original expression for this location
        if rule_target_name and rule_target_name in self._rule_expressions:
            rule_expr = self._rule_expressions[rule_target_name]

            # Extract cannon area from location name (e.g., "WF: Location" -> "WF")
            cannon_area = None
            if ':' in rule_target_name:
                cannon_area = rule_target_name.split(':')[0].strip()

            try:
                logger.debug(f"Overriding rule analysis for {rule_target_name}: {rule_expr}")
                return self.parse_rule_expression(rule_expr, cannon_area)
            except Exception as e:
                logger.error(f"Error parsing rule for {rule_target_name}: {rule_expr} - {e}", exc_info=True)
                # Return None to fall back to normal analysis
                return None

        # Return None to use normal analysis
        return None

    def handle_complex_exit_rule(self, exit_name: str, rule_func) -> Optional[Dict[str, Any]]:
        """Handle complex exit rules created by connect_regions with rf.build_rule().

        SM64 uses rf.build_rule() for entrances that have complex rule expressions.
        These create nested lambda functions that the generic analyzer can't handle.
        We detect these by matching both source and destination regions to our known
        entrance rules.

        Args:
            exit_name: The exit name in format "SourceRegion -> DestRegion"
            rule_func: The lambda function to analyze (unused, we use our parsed rules)

        Returns:
            Parsed rule dict if we have a known rule for this exit, None otherwise.
        """
        if not exit_name or ' -> ' not in exit_name:
            return None

        # Extract source and destination regions from exit name
        source_region, connected_region = exit_name.split(' -> ', 1)

        # Check if this exit matches any of our known entrance connections
        for key, rule_expr in self._entrance_rules.items():
            if not isinstance(key, tuple):
                continue

            src_key, dest_key = key

            # Get the actual region names for source and destination
            actual_src = self._destination_mapping.get(src_key, src_key)
            actual_dest = self._destination_mapping.get(dest_key, dest_key)

            # Match BOTH source and destination to avoid applying the wrong rule
            if source_region == actual_src and connected_region == actual_dest:
                logger.info(f"Handling entrance rule for {exit_name}: {rule_expr}")
                try:
                    return self.parse_rule_expression(rule_expr)
                except Exception as e:
                    logger.error(f"Error parsing entrance rule for {exit_name}: {e}")
                    return None

        return None
