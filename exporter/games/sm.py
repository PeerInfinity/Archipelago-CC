"""Super Metroid game-specific export handler."""

from typing import Dict, Any, Optional, Set
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

print("[SM MODULE] Loading Super Metroid exporter handler")

class SMGameExportHandler(GenericGameExportHandler):
    """Export handler for Super Metroid.

    Super Metroid uses a custom SMBoolManager system for its logic.
    The rules are wrapped in self.evalSMBool() calls with helper functions.

    This exporter transforms the Python-specific patterns into JavaScript-friendly
    helper calls that the frontend can execute.
    """
    GAME_NAME = 'Super Metroid'

    def __init__(self, world=None):
        print(f"[SM] SMGameExportHandler initialized for {self.GAME_NAME}")
        super().__init__()  # Base class doesn't take arguments
        self.world = world
        self._simple_accessfrom_locations: Optional[Set[str]] = None
        self._all_accessfrom_info: Optional[Dict[str, Dict[str, str]]] = None
        self._varia_item_types: Optional[Dict[str, str]] = None

    def _get_varia_item_types(self) -> Dict[str, str]:
        """Get mapping of item names to their VARIA types.

        Returns:
            Dict mapping Archipelago item names to VARIA type names
        """
        if self._varia_item_types is None:
            self._varia_item_types = {}
            try:
                from worlds.sm.variaRandomizer.rando.Items import ItemManager
                # ItemManager.Items is a dict of Type -> Item objects
                for item_type, item_obj in ItemManager.Items.items():
                    # item_obj.Name is the Archipelago name, item_obj.Type is the VARIA type
                    if hasattr(item_obj, 'Name') and hasattr(item_obj, 'Type'):
                        self._varia_item_types[item_obj.Name] = item_obj.Type
                logger.info(f"SM: Loaded {len(self._varia_item_types)} VARIA item type mappings")
            except Exception as e:
                logger.error(f"SM: Failed to load VARIA item types: {e}", exc_info=True)

        return self._varia_item_types

    def get_item_type_for_name(self, item_name: str, world) -> Optional[str]:
        """Get VARIA type for an item name.

        Args:
            item_name: The name of the item
            world: The world instance

        Returns:
            The VARIA type name, or None if not found
        """
        varia_types = self._get_varia_item_types()
        varia_type = varia_types.get(item_name)

        if varia_type:
            logger.debug(f"SM: Item '{item_name}' has VARIA type '{varia_type}'")

        return varia_type

    def get_game_info(self, world) -> Dict[str, Any]:
        """Get game-specific information including door color data.

        Returns:
            Dict with game info including door colors for the frontend
        """
        # Start with base game info
        game_info = super().get_game_info(world)

        # Add door color data
        door_data = {}
        try:
            from worlds.sm.variaRandomizer.utils.doorsmanager import DoorsManager
            player_id = world.player if world else 1

            # Get the doors dictionary for this player
            if hasattr(DoorsManager, 'doorsDict') and player_id in DoorsManager.doorsDict:
                doors_dict = DoorsManager.doorsDict[player_id]
                for door_name, door_obj in doors_dict.items():
                    # Get the actual door color (considering hidden status)
                    door_data[door_name] = door_obj.getColor()
                logger.info(f"SM: Exported {len(door_data)} door colors")
            else:
                logger.warning(f"SM: DoorsManager.doorsDict not found or player {player_id} not in doorsDict")

        except Exception as e:
            logger.error(f"SM: Failed to export door data: {e}", exc_info=True)

        # Add doors to game_info if we have any
        if door_data:
            game_info['doors'] = door_data

        return game_info

    def get_item_data(self, world):
        """Get item data from world, adding VARIA type information.

        Overrides the base class to add VARIA Type field to items.
        Follows the same pattern as ALTTP exporter.
        """
        logger.info("SM: get_item_data called")
        # Get base item data from parent class
        item_data = super().get_item_data(world)
        logger.info(f"SM: Got {len(item_data)} items from parent")

        # Add VARIA type information
        try:
            varia_types = self._get_varia_item_types()
            logger.info(f"SM: Retrieved {len(varia_types)} VARIA type mappings")

            type_count = 0
            for item_name, item_info in item_data.items():
                if item_name in varia_types:
                    item_info['type'] = varia_types[item_name]
                    type_count += 1
                    logger.debug(f"SM: Set type='{varia_types[item_name]}' for item '{item_name}'")

            logger.info(f"SM: Added VARIA types to {type_count} items out of {len(item_data)} total")
        except Exception as e:
            logger.error(f"SM: Error adding VARIA types: {e}", exc_info=True)

        return item_data

    def _get_simple_accessfrom_locations(self) -> Set[str]:
        """Get the set of location names with simple AccessFrom (all regions use SMBool(True)).

        This is cached after first call for performance.
        """
        if self._simple_accessfrom_locations is None:
            try:
                from .sm_accessfrom_extractor import get_simple_accessfrom_locations
                self._simple_accessfrom_locations = get_simple_accessfrom_locations(self.world)
                logger.info(f"SM: Loaded {len(self._simple_accessfrom_locations)} locations with simple AccessFrom")
            except Exception as e:
                logger.error(f"SM: Failed to extract simple AccessFrom locations: {e}")
                self._simple_accessfrom_locations = set()

        return self._simple_accessfrom_locations

    def _get_all_accessfrom_info(self) -> Dict[str, Dict[str, str]]:
        """Get ALL AccessFrom information for all locations.

        Returns:
            Dict mapping location_name -> {region_name -> lambda_source}
        """
        if self._all_accessfrom_info is None:
            try:
                from .sm_accessfrom_extractor import extract_all_accessfrom_info
                import worlds.sm
                import os
                world_module_path = os.path.dirname(worlds.sm.__file__)
                self._all_accessfrom_info = extract_all_accessfrom_info(world_module_path)
                logger.info(f"SM: Loaded AccessFrom data for {len(self._all_accessfrom_info)} locations")
            except Exception as e:
                logger.error(f"SM: Failed to extract all AccessFrom info: {e}", exc_info=True)
                self._all_accessfrom_info = {}

        return self._all_accessfrom_info

    def get_custom_location_access_rule(self, location, world):
        """Custom handling for Super Metroid location access rules.

        Super Metroid locations use an AccessFrom + Available pattern:
        - AccessFrom: Dict[region_name -> lambda] defining requirements from each region
        - Available: lambda defining requirements once in the region

        The Python rule is: any(can_reach(region) AND AccessFrom[region](sm) for each region) AND Available(sm)

        We build this by:
        1. Extracting AccessFrom lambdas from source code
        2. Parsing each lambda individually
        3. Building: OR(can_reach(region1) AND lambda1, can_reach(region2) AND lambda2, ...) AND Available

        Returns:
            The custom rule to export, or None to use default handling
        """
        if not hasattr(location, 'access_rule') or not location.access_rule:
            return None

        location_name = location.name

        # Try to analyze the rule to see if it's an AND with accessFrom + Available
        try:
            from ..analyzer import analyze_rule
            analyzed = analyze_rule(location.access_rule)

            # Check if it's an AND rule with two conditions (accessFrom + Available pattern)
            if analyzed and analyzed.get('type') == 'and':
                conditions = analyzed.get('conditions', [])
                if len(conditions) == 2:
                    first = conditions[0]  # accessFrom
                    second = conditions[1]  # Available

                    # Check if first condition is accessFrom (any_of pattern)
                    if first.get('type') == 'any_of':
                        # This is an accessFrom + Available pattern
                        # We need to build the full rule from source data

                        # Get AccessFrom data from source
                        all_accessfrom = self._get_all_accessfrom_info()
                        if location_name not in all_accessfrom:
                            logger.warning(f"SM: Location '{location_name}' not found in AccessFrom data")
                            return None

                        accessfrom_dict = all_accessfrom[location_name]
                        logger.info(f"SM: Building AccessFrom rule for '{location_name}' with {len(accessfrom_dict)} regions")

                        # Parse each AccessFrom lambda and build the OR structure
                        accessfrom_conditions = []
                        for region_name, lambda_source in accessfrom_dict.items():
                            # Parse the lambda to get its body
                            parsed_lambda = self._parse_accessfrom_lambda(lambda_source, region_name, location_name)
                            if parsed_lambda:
                                # Build: can_reach(region) AND parsed_lambda
                                accessfrom_conditions.append({
                                    'type': 'and',
                                    'conditions': [
                                        {'type': 'state_method', 'method': 'can_reach', 'args': [{'type': 'constant', 'value': region_name}]},
                                        parsed_lambda
                                    ]
                                })

                        if not accessfrom_conditions:
                            logger.warning(f"SM: Failed to parse any AccessFrom lambdas for '{location_name}'")
                            return None

                        # Build the OR of all AccessFrom conditions
                        if len(accessfrom_conditions) == 1:
                            accessfrom_rule = accessfrom_conditions[0]
                        else:
                            accessfrom_rule = {
                                'type': 'or',
                                'conditions': accessfrom_conditions
                            }

                        # Get the Available rule (already analyzed)
                        available_rule = second

                        # Build the final rule: AccessFrom AND Available
                        # If Available is SMBool(True), just use AccessFrom
                        if self._is_always_true_smbool(available_rule):
                            logger.info(f"SM: Location '{location_name}' has Available=SMBool(True), using only AccessFrom")
                            return accessfrom_rule
                        else:
                            logger.info(f"SM: Location '{location_name}' has both AccessFrom and Available requirements")
                            return {
                                'type': 'and',
                                'conditions': [accessfrom_rule, available_rule]
                            }

            return None
        except Exception as e:
            logger.error(f"SM: Error building location rule for {location_name}: {e}", exc_info=True)
            return None

    def _parse_accessfrom_lambda(self, lambda_source: str, region_name: str, location_name: str) -> Optional[Dict[str, Any]]:
        """Parse an AccessFrom lambda and return its rule structure.

        Args:
            lambda_source: The lambda source code (e.g., "(lambda sm: sm.canPassTerminatorBombWall())")
            region_name: The region name (for logging)
            location_name: The location name (for logging)

        Returns:
            Parsed rule dict, or None if parsing failed
        """
        try:
            import ast
            from ..analyzer import analyze_rule

            # Remove outer parentheses if present
            lambda_source = lambda_source.strip()
            if lambda_source.startswith('(') and lambda_source.endswith(')'):
                lambda_source = lambda_source[1:-1].strip()

            # Parse the lambda
            lambda_ast = ast.parse(lambda_source, mode='eval').body
            if not isinstance(lambda_ast, ast.Lambda):
                logger.warning(f"SM: AccessFrom for '{location_name}' from '{region_name}' is not a lambda: {lambda_source}")
                return None

            # Analyze the lambda body using analyze_rule with ast_node parameter
            analyzed = analyze_rule(
                ast_node=lambda_ast.body,
                closure_vars={},
                game_handler=self,
                player_context=None,
                context_info=f"AccessFrom {region_name}->{location_name}"
            )
            if not analyzed:
                logger.warning(f"SM: Failed to analyze AccessFrom lambda for '{location_name}' from '{region_name}'")
                return None

            # Expand the analyzed rule
            expanded = self.expand_rule(analyzed)
            logger.debug(f"SM: Parsed AccessFrom lambda for '{location_name}' from '{region_name}': {type(expanded)}")
            return expanded

        except Exception as e:
            logger.error(f"SM: Error parsing AccessFrom lambda for '{location_name}' from '{region_name}': {e}", exc_info=True)
            return None

    def _check_smbool_true_pattern(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule represents SMBool(True) construction."""
        if not rule:
            return False

        rule_type = rule.get('type')

        # Check for function_call type (original pattern)
        if rule_type == 'function_call':
            func = rule.get('function', {})
            if func.get('type') != 'name' or func.get('name') != 'SMBool':
                return False

            args = rule.get('args', [])
            if not args:
                return False

            # Check if first arg is constant True
            first_arg = args[0]
            return (first_arg.get('type') == 'constant' and
                    first_arg.get('value') is True)

        # Check for helper type (analyzer converts to this)
        elif rule_type == 'helper':
            if rule.get('name') != 'SMBool':
                return False

            args = rule.get('args', [])
            if not args:
                return False

            # Check if first arg is constant True
            first_arg = args[0]
            return (first_arg.get('type') == 'constant' and
                    first_arg.get('value') is True)

        return False

    def _is_always_true_smbool(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule is evalSMBool(SMBool(True), ...) which would simplify to True.

        This indicates the location has no item requirements once in the region,
        and the actual requirements are in accessFrom (which we can't export).
        """
        if not rule:
            return False

        rule_type = rule.get('type')

        # Check for evalSMBool(SMBool(True), ...)
        if rule_type == 'helper' and rule.get('name') == 'evalSMBool':
            args = rule.get('args', [])
            if len(args) >= 1:
                first_arg = args[0]
                return self._check_smbool_true_pattern(first_arg)

        # Check for function_call pattern
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                attr = function.get('attr')
                if (obj.get('type') == 'name' and
                    obj.get('name') == 'self' and
                    attr == 'evalSMBool'):
                    args = rule.get('args', [])
                    if len(args) >= 1:
                        return self._check_smbool_true_pattern(args[0])

        return False

    def _try_simplify_evalSMBool(self, args: list) -> Optional[Dict[str, Any]]:
        """Try to simplify evalSMBool calls if possible.

        Super Metroid uses VARIA logic system (sm.wor, sm.canFly, etc.) which
        is complex. We'll try to export the actual logic so the frontend can
        evaluate it properly.

        For now, we DON'T simplify - we let the actual rule structure pass through.
        """
        # Don't simplify - return None to indicate no simplification
        logger.debug("SM: NOT simplifying evalSMBool call - preserving actual logic")
        return None

    _expand_call_count = 0

    def _check_accessFrom_pattern(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule is the problematic accessFrom comprehension pattern.

        The pattern is: any_of with iterator_info that references accessFrom variable.
        These rules hit recursion limits and create corrupted rule structures.
        """
        if not rule or rule.get('type') != 'any_of':
            return False

        # Check for iterator_info
        iterator_info = rule.get('iterator_info', {})
        if not iterator_info:
            return False

        # Check if iterator references accessFrom
        iterator = iterator_info.get('iterator', {})
        if iterator.get('type') == 'function_call':
            func = iterator.get('function', {})
            if func.get('type') == 'attribute':
                obj = func.get('object', {})
                attr = func.get('attr')
                # Pattern: accessFrom.items()
                if (obj.get('type') == 'name' and
                    obj.get('name') == 'accessFrom' and
                    attr == 'items'):
                    return True

        return False

    def _check_deeply_nested_any_of(self, rule: Dict[str, Any], max_depth: int = 5) -> bool:
        """Check if a rule has deeply nested any_of structures (indicating recursion).

        Args:
            rule: The rule to check
            max_depth: Maximum depth before considering it "deeply nested"

        Returns:
            True if the rule has nested any_of at or beyond max_depth
        """
        def count_depth(r, current_depth=0):
            if not r or not isinstance(r, dict):
                return current_depth

            if r.get('type') == 'any_of':
                # Check element_rule for further nesting
                element_rule = r.get('element_rule')
                if element_rule:
                    # Look for nested any_of in the conditions
                    if isinstance(element_rule, dict):
                        if element_rule.get('type') == 'and':
                            conditions = element_rule.get('conditions', [])
                            for cond in conditions:
                                if cond.get('type') == 'helper' and cond.get('name') == 'evalSMBool':
                                    args = cond.get('args', [])
                                    if args and args[0].get('type') == 'any_of':
                                        # Found nested any_of
                                        nested_depth = count_depth(args[0], current_depth + 1)
                                        if nested_depth >= max_depth:
                                            return nested_depth
            return current_depth

        depth = count_depth(rule)
        return depth >= max_depth

    def _is_simple_accessFrom(self, rule: Dict[str, Any]) -> bool:
        """Check if an accessFrom pattern has only SMBool(True) requirements.

        A simple accessFrom is: any(state.can_reach(region) and evalSMBool(SMBool(True), ...))
        This means the location is accessible from the region with no item requirements.

        NOTE: Due to analyzer recursion limits, this check almost never succeeds.
        Most accessFrom patterns become corrupted nested structures even if they're simple.
        """
        if not rule or rule.get('type') != 'any_of':
            return False

        # Check the element_rule
        element_rule = rule.get('element_rule')
        if not element_rule:
            return False

        # Should be an AND of: state.can_reach(...) and evalSMBool(SMBool(True), ...)
        if element_rule.get('type') != 'and':
            return False

        conditions = element_rule.get('conditions', [])
        if len(conditions) != 2:
            return False

        # Second condition should be evalSMBool(SMBool(True), ...)
        second = conditions[1]
        if self._is_always_true_smbool(second):
            logger.info("SM: _is_simple_accessFrom: DETECTED SIMPLE PATTERN (rare!)")
            return True

        return False

    def _contains_complex_helpers(self, rule: Dict[str, Any]) -> bool:
        """Recursively check if a rule contains complex helper calls.

        Simple helpers: SMBool, evalSMBool
        Complex helpers: any VARIA logic methods like canPassTerminatorBombWall, haveItem, etc.

        Returns True if any complex helpers are found.
        """
        if not rule or not isinstance(rule, dict):
            return False

        rule_type = rule.get('type')

        # Check if this is a complex helper call
        if rule_type == 'helper':
            helper_name = rule.get('name', '')
            # These are simple helpers that don't indicate item requirements
            # 'rule' is an artifact from analyzer recursion limits
            simple_helpers = {'SMBool', 'evalSMBool', 'rule'}
            if helper_name not in simple_helpers:
                # Any other helper is complex (haveItem, canPass*, traverse, etc.)
                return True

        # Check if this is a state_method call (also indicates requirements)
        if rule_type == 'state_method':
            method_name = rule.get('method', '')
            # can_reach is fine, but other state methods indicate requirements
            if method_name not in {'can_reach'}:
                return True

        # Recursively check nested structures
        if rule_type in ['and', 'or']:
            for cond in rule.get('conditions', []):
                if self._contains_complex_helpers(cond):
                    return True

        if rule_type == 'not':
            return self._contains_complex_helpers(rule.get('condition'))

        if rule_type == 'helper':
            for arg in rule.get('args', []):
                if self._contains_complex_helpers(arg):
                    return True

        if rule_type == 'function_call':
            # Check if the function being called is a VARIA logic method (sm.method_name)
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                attr = function.get('attr', '')
                # If calling sm.method_name, this is complex VARIA logic
                if obj.get('type') == 'name' and obj.get('name') == 'sm':
                    # Any sm.method_name is complex (wor, wand, canPass*, haveItem, etc.)
                    logger.debug(f"SM: Found complex function_call: sm.{attr}")
                    return True

            # Also check args recursively
            for arg in rule.get('args', []):
                if self._contains_complex_helpers(arg):
                    return True

        if rule_type == 'any_of' or rule_type == 'all_of':
            if self._contains_complex_helpers(rule.get('element_rule')):
                return True

        return False

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand and transform Super Metroid rules.

        Transforms self.evalSMBool() function calls into direct helper calls
        that the JavaScript frontend can execute. Also simplifies common patterns.
        """
        if not rule:
            return rule

        rule_type = rule.get('type')

        # Handle RomPatches.has() calls - resolve to constants since patches are fixed at generation time
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if (function.get('type') == 'attribute' and
                function.get('attr') == 'has' and
                function.get('object', {}).get('type') == 'name' and
                function.get('object', {}).get('name') == 'RomPatches'):
                # This is a RomPatches.has(patch_id) call
                args = rule.get('args', [])
                if len(args) >= 1:
                    # The first arg should be the patch ID (constant)
                    patch_arg = args[0]
                    if patch_arg.get('type') == 'constant':
                        patch_id = patch_arg.get('value')
                        # Check if this patch is active
                        # Import RomPatches to check active patches
                        try:
                            from worlds.sm.variaRandomizer.rom.rom_patches import RomPatches
                            player_id = self.world.player if self.world else 1
                            is_active = patch_id in RomPatches.ActivePatches.get(player_id, [])
                            logger.info(f"SM: Resolved RomPatches.has({patch_id}) to {is_active}")
                            return {'type': 'constant', 'value': is_active}
                        except Exception as e:
                            logger.error(f"SM: Failed to resolve RomPatches.has({patch_id}): {e}")
                            # Conservative fallback: assume patch is not active
                            return {'type': 'constant', 'value': False}

        # Check for AND rules that combine accessFrom and Available
        # The accessFrom comprehension can't be properly exported, so we skip it
        # However, if Available is SMBool(True), we need to export as False instead
        # of preserving it, since the actual requirements are in accessFrom
        if rule_type == 'and':
            conditions = rule.get('conditions', [])
            if len(conditions) == 2:
                first = conditions[0]
                second = conditions[1]
                # If first condition is accessFrom pattern, skip it and use only second
                if self._check_accessFrom_pattern(first) or self._check_deeply_nested_any_of(first):
                    logger.info("SM: Found AND rule with accessFrom, checking Available part")

                    # Recursively expand the second condition (the Available part)
                    expanded = self.expand_rule(second)

                    # Check if the Available part is just evalSMBool(SMBool(True), ...)
                    if self._is_always_true_smbool(expanded):
                        # The Available part has no requirements, so the actual requirements
                        # are in the accessFrom comprehension.

                        # Check if this is a simple accessFrom (just SMBool(True))
                        if self._is_simple_accessFrom(first):
                            # Simple case: accessFrom returns SMBool(True) for all regions
                            # This means the location is accessible from the region with no item requirements
                            logger.info("SM: Simple accessFrom detected (SMBool(True)) - exporting as True")
                            return {'type': 'constant', 'value': True}

                        # Complex accessFrom that we can't properly export
                        # LIMITATION: We cannot reliably distinguish complex accessFrom requirements
                        # (e.g., lambda sm: sm.canPassBombWall()) when analyzer recursion limits
                        # corrupt the structure.
                        #
                        # Conservative approach: Export as False to prevent incorrect accessibility.
                        # TODO: Need a different approach - see CC/scripts/logs/sm/remaining-exporter-issues.md
                        logger.info("SM: Complex accessFrom with SMBool(True) Available - exporting as False (conservative)")
                        return {'type': 'constant', 'value': False}

                    # If Available has actual requirements, use it
                    logger.info("SM: Using Available part with actual requirements")
                    return expanded

        # Check for accessFrom patterns that hit recursion limits
        # These create infinitely nested structures that can't be properly evaluated
        # Conservative: Export as False to prevent incorrect accessibility
        # TODO: Improve detection to distinguish simple vs complex patterns
        if self._check_accessFrom_pattern(rule):
            logger.info("SM: Found accessFrom comprehension pattern, exporting as constant False")
            return {'type': 'constant', 'value': False}

        # Also check for deeply nested any_of structures (result of recursion limits)
        # Conservative: Export as False
        if self._check_deeply_nested_any_of(rule):
            logger.info("SM: Found deeply nested any_of pattern (recursion artifact), exporting as constant False")
            return {'type': 'constant', 'value': False}

        # Handle helper nodes with name='evalSMBool' (analyzer converts self.evalSMBool to helper)
        if rule_type == 'helper' and rule.get('name') == 'evalSMBool':
            # DON'T simplify evalSMBool(SMBool(True), ...) to constant True
            # even though mathematically it's always true, because:
            # 1. For locations with accessFrom, the region access provides the restriction
            # 2. Preserving the structure allows proper frontend evaluation
            # 3. It makes the exported rules more consistent and debuggable

            # Preserve the evalSMBool helper call and expand its arguments
            print("[SM] Preserving evalSMBool helper (will be evaluated by frontend)")
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]
            return rule

        # Transform function_call nodes where function is an attribute access on 'self' or 'sm'
        # (This is kept for compatibility but may not be needed if analyzer converts to helper)
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                attr = function.get('attr')

                # Transform self.evalSMBool(...) into helper call
                if obj.get('type') == 'name' and obj.get('name') == 'self' and attr == 'evalSMBool':
                    # Convert to helper call and expand arguments
                    # Don't simplify SMBool(True) - preserve the structure
                    print("[SM] Converting evalSMBool function_call to helper (preserving structure)")
                    expanded_args = [self.expand_rule(arg) for arg in rule.get('args', [])]
                    return {'type': 'helper', 'name': 'evalSMBool', 'args': expanded_args}

                # Transform sm.methodName(...) into helper calls
                # These are VARIA logic methods like sm.wor, sm.wand, sm.haveItem, etc.
                if obj.get('type') == 'name' and obj.get('name') == 'sm':
                    # Convert to helper call
                    print(f"[SM] Converting sm.{attr}(...) to helper call")
                    expanded_args = [self.expand_rule(arg) for arg in rule.get('args', [])]
                    return {'type': 'helper', 'name': attr, 'args': expanded_args}

        # Recursively process nested structures
        if rule_type == 'and' or rule_type == 'or':
            rule['conditions'] = [self.expand_rule(cond) for cond in rule.get('conditions', [])]

        if rule_type == 'not':
            if 'condition' in rule:
                rule['condition'] = self.expand_rule(rule['condition'])

        # Process helper arguments
        if rule_type == 'helper':
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]

        # Process function_call arguments (for other function calls)
        if rule_type == 'function_call':
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]

        # Process generator expressions
        if rule_type == 'generator_expression':
            if 'element' in rule:
                rule['element'] = self.expand_rule(rule['element'])

        # Process binary operations
        if rule_type == 'binary_op' or rule_type == 'compare':
            if 'left' in rule:
                rule['left'] = self.expand_rule(rule['left'])
            if 'right' in rule:
                rule['right'] = self.expand_rule(rule['right'])

        # Process conditionals
        if rule_type == 'conditional':
            if 'test' in rule:
                rule['test'] = self.expand_rule(rule['test'])
            if 'if_true' in rule and rule['if_true'] is not None:
                rule['if_true'] = self.expand_rule(rule['if_true'])
            if 'if_false' in rule and rule['if_false'] is not None:
                rule['if_false'] = self.expand_rule(rule['if_false'])

        # Process any_of and all_of (list comprehensions)
        if rule_type == 'any_of' or rule_type == 'all_of':
            if 'element_rule' in rule:
                rule['element_rule'] = self.expand_rule(rule['element_rule'])
            # Also expand iterator_info if present
            if 'iterator_info' in rule:
                iterator_info = rule['iterator_info']
                if 'iterator' in iterator_info:
                    iterator_info['iterator'] = self.expand_rule(iterator_info['iterator'])
                if 'target' in iterator_info:
                    iterator_info['target'] = self.expand_rule(iterator_info['target'])

        return rule
