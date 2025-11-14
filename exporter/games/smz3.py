"""SMZ3 game-specific export handler.

SMZ3 (Super Metroid & A Link to the Past Crossover) uses the TotalSMZ3 library
which has its own Region and Progression classes with complex game logic.
This exporter handles the conversion of SMZ3-specific patterns to JavaScript-compatible rules.
"""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging
import inspect

logger = logging.getLogger(__name__)


class SMZ3GameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'SMZ3'

    def __init__(self):
        super().__init__()
        logger.info("SMZ3 exporter initialized")

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Override rule analysis for SMZ3-specific patterns.

        This method is called before the standard rule analysis. It detects
        SMZ3 location access rules that use loc.Available() and extracts the
        actual item requirements from the TotalSMZ3 Location object.

        Returns None to fall back to standard analysis, or a dict with the analyzed rule.
        """
        # Only handle location access rules (not entrance rules or item rules)
        if not rule_target_name:
            return None

        # Skip entrance rules (contain "->") and item rules (contain "Item Rule")
        if "->" in str(rule_target_name) or "Item Rule" in str(rule_target_name):
            return None

        logger.info(f"Processing location: {rule_target_name}")

        # Try to extract the 'loc' object from default arguments (SMZ3 uses lambda state, loc=loc: ...)
        loc_object = None
        if hasattr(rule_func, '__code__') and hasattr(rule_func, '__defaults__'):
            # Get the parameter names
            arg_names = rule_func.__code__.co_varnames[:rule_func.__code__.co_argcount]
            defaults = rule_func.__defaults__ or ()

            logger.info(f"Function args for {rule_target_name}: {arg_names}, defaults: {len(defaults)}")

            # SMZ3 location rules have signature: lambda state, loc=loc: ...
            # So 'loc' should be the second parameter with a default value
            if len(arg_names) >= 2 and 'loc' in arg_names:
                loc_index = list(arg_names).index('loc')
                # Defaults are aligned to the end of the parameter list
                # If we have 2 params and 1 default, the default is for the last param
                defaults_offset = len(arg_names) - len(defaults)
                if loc_index >= defaults_offset:
                    loc_object = defaults[loc_index - defaults_offset]
                    logger.info(f"Found 'loc' object from defaults: {type(loc_object)}")

        if not loc_object:
            logger.info(f"No 'loc' object found in defaults for {rule_target_name}")
            return None

        # Check if this looks like a TotalSMZ3 Location object
        has_can_access = hasattr(loc_object, 'canAccess')
        has_available = hasattr(loc_object, 'Available')
        logger.info(f"loc_object attributes - canAccess: {has_can_access}, Available: {has_available}, type: {type(loc_object)}")

        if not has_can_access or not has_available:
            logger.info(f"Not a TotalSMZ3 Location object for {rule_target_name}")
            return None

        logger.info(f"Found TotalSMZ3 Location object for '{rule_target_name}', extracting canAccess logic")

        # Now we have the TotalSMZ3 Location object!
        # Extract and analyze its canAccess function
        try:
            can_access_func = loc_object.canAccess

            # Import the analyzer here to avoid circular imports
            from exporter.analyzer import analyze_rule

            # Analyze the canAccess function
            # This function has signature: lambda items: <requirements>
            # where items is a TotalSMZ3 Progression object
            analyzed_rule = analyze_rule(can_access_func)

            if analyzed_rule:
                logger.info(f"Successfully extracted location logic for '{rule_target_name}'")
                return analyzed_rule
            else:
                logger.warning(f"Failed to analyze canAccess for '{rule_target_name}', falling back to default")
                return None

        except Exception as e:
            logger.error(f"Error analyzing TotalSMZ3 location logic for '{rule_target_name}': {e}")
            return None

    def postprocess_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-process SMZ3 rules to handle TotalSMZ3-specific patterns.

        Specifically handles:
        1. region.CanEnter(state.smz3state[player]) patterns
        2. loc.Available(state.smz3state[player]) patterns (if override_rule_analysis didn't handle it)
        3. Custom smz3state collection state access
        4. Convert "items" variable references to proper state lookups
        """
        if not isinstance(rule, dict):
            return rule

        # Handle "items.AttributeName" pattern - convert to item check
        # This handles the TotalSMZ3 Progression object attributes
        if rule.get('type') == 'attribute':
            obj = rule.get('object')
            if isinstance(obj, dict) and obj.get('type') == 'name' and obj.get('name') == 'items':
                item_name = rule.get('attr')
                logger.debug(f"Converting items.{item_name} to item_check")
                return {
                    'type': 'item_check',
                    'item': item_name
                }

        # Handle region.CanEnter() and loc.Available() patterns
        # These appear as: {type: "function_call", function: {type: "attribute", object: {type: "name", name: "region"/"loc"}, attr: "CanEnter"/"Available"}, args: [...]}
        if (rule.get('type') == 'function_call' and
            isinstance(rule.get('function'), dict)):

            func = rule['function']

            # Check if this is region.CanEnter pattern
            if (func.get('type') == 'attribute' and
                func.get('attr') == 'CanEnter' and
                isinstance(func.get('object'), dict) and
                func['object'].get('type') == 'name' and
                func['object'].get('name') == 'region'):

                logger.debug("Found region.CanEnter pattern - converting to helper call")

                # Convert to a helper function call
                # The helper will need access to the region name and the state
                # For now, we'll create a helper that always returns true
                # TODO: Implement proper SMZ3 region logic in JavaScript helpers
                return {
                    'type': 'helper',
                    'name': 'smz3_can_enter_region',
                    'args': []
                }

            # Check if this is loc.Available pattern
            if (func.get('type') == 'attribute' and
                func.get('attr') == 'Available' and
                isinstance(func.get('object'), dict) and
                func['object'].get('type') == 'name' and
                func['object'].get('name') == 'loc'):

                logger.debug("Found loc.Available pattern - this should have been handled by override_rule_analysis")

                # This should have been handled by override_rule_analysis
                # If we get here, something went wrong, so fall back to constant true
                return {
                    'type': 'constant',
                    'value': True
                }

        # Handle method calls on items (e.g., items.CanLiftLight())
        # These should be converted to helper function calls
        if rule.get('type') == 'function_call':
            func = rule.get('function')
            if isinstance(func, dict) and func.get('type') == 'attribute':
                obj = func.get('object')
                if isinstance(obj, dict) and obj.get('type') == 'name' and obj.get('name') == 'items':
                    method_name = func.get('attr')
                    # Convert to a helper call with the same arguments
                    logger.debug(f"Converting items.{method_name}() to helper call")
                    return {
                        'type': 'helper',
                        'name': f'smz3_{method_name}',
                        'args': rule.get('args', [])
                    }

        # Recursively process nested rules
        if rule.get('type') == 'and' and rule.get('conditions'):
            rule['conditions'] = [self.postprocess_rule(cond) for cond in rule['conditions']]
        elif rule.get('type') == 'or' and rule.get('conditions'):
            rule['conditions'] = [self.postprocess_rule(cond) for cond in rule['conditions']]
        elif rule.get('type') == 'not' and rule.get('condition'):
            rule['condition'] = self.postprocess_rule(rule['condition'])
        elif rule.get('type') == 'conditional':
            if rule.get('test'):
                rule['test'] = self.postprocess_rule(rule['test'])
            if rule.get('if_true'):
                rule['if_true'] = self.postprocess_rule(rule['if_true'])
            if rule.get('if_false'):
                rule['if_false'] = self.postprocess_rule(rule['if_false'])
        elif rule.get('type') == 'compare':
            # Process both left and right sides of comparisons
            if rule.get('left'):
                rule['left'] = self.postprocess_rule(rule['left'])
            if rule.get('right'):
                rule['right'] = self.postprocess_rule(rule['right'])

        return rule
