"""Old School Runescape game-specific export handler.

Handles OSRS-specific rule patterns including:
- Lambda default parameter resolution (region_required, item_req, location_row)
- Quest points helper function
- Skill requirement helpers
"""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
from exporter.analyzer import analyze_rule
import logging

logger = logging.getLogger(__name__)


class OSRSGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Old School Runescape'

    def __init__(self):
        super().__init__()

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None):
        """
        Override rule analysis for OSRS to handle closure variables containing Region objects.

        OSRS uses lambdas like:
            lambda state, region_required=region_required: state.can_reach(region_required, "Region", player)

        The closure contains Region objects, which can't be serialized. We need to convert
        them to their string names before analysis.
        """
        try:
            # Extract closure variables
            closure_vars = {}

            if hasattr(rule_func, '__closure__') and rule_func.__closure__:
                if hasattr(rule_func, '__code__'):
                    freevars = rule_func.__code__.co_freevars
                    for i, var_name in enumerate(freevars):
                        if i < len(rule_func.__closure__):
                            cell = rule_func.__closure__[i]
                            try:
                                value = cell.cell_contents

                                # Special handling for different object types
                                if hasattr(value, 'name') and hasattr(value, 'player'):
                                    # This is likely a Region or Location object
                                    # Extract the name string
                                    closure_vars[var_name] = value.name
                                    logger.debug(f"Converted {var_name} from object to name: {value.name}")
                                elif hasattr(value, '__class__') and value.__class__.__name__ == 'LocationRow':
                                    # This is a LocationRow object - keep it as is for now
                                    # We'll handle attribute access in expand_rule
                                    closure_vars[var_name] = value
                                    logger.debug(f"Kept {var_name} as LocationRow object")
                                else:
                                    # Regular value (string, int, etc.)
                                    closure_vars[var_name] = value

                            except ValueError:
                                # Cell is empty
                                pass

            # Analyze the rule with the preprocessed closure variables
            analysis_result = analyze_rule(
                rule_func=rule_func,
                closure_vars=closure_vars,
                game_handler=self,
                player_context=None
            )

            return analysis_result

        except Exception as e:
            logger.warning(f"Failed to override rule analysis for {rule_target_name}: {e}")
            return None  # Fall back to default analysis

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively expand and resolve OSRS-specific rule patterns.

        Handles:
        1. Quest points method calls
        2. Location row attribute access
        3. Other OSRS-specific patterns
        """
        if not rule:
            return rule

        rule_type = rule.get('type')

        # Handle attribute access on location_row (e.g., location_row.qp)
        if rule_type == 'attribute':
            obj = rule.get('object', {})
            attr = rule.get('attr')

            if obj.get('type') == 'name' and obj.get('name') == 'location_row':
                # Try to resolve from closure if available
                # This should have been handled in override_rule_analysis
                logger.warning(f"Unresolved location_row.{attr} in expand_rule")
                return rule

        # Handle function calls (e.g., self.quest_points())
        if rule_type == 'function_call':
            function = rule.get('function', {})

            # Check if this is a method call on self (self.quest_points)
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                method_name = function.get('attr')

                if obj.get('type') == 'name' and obj.get('name') == 'self':
                    if method_name == 'quest_points':
                        # Convert to a helper function call
                        logger.debug("Converting self.quest_points() to helper function")
                        return {
                            'type': 'helper',
                            'name': 'quest_points',
                            'args': []
                        }

        # Handle 'and' and 'or' conditions recursively
        if rule_type in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule.get('conditions', [])]

        # Handle 'compare' operations recursively
        if rule_type == 'compare':
            if 'left' in rule:
                rule['left'] = self.expand_rule(rule['left'])
            if 'right' in rule:
                rule['right'] = self.expand_rule(rule['right'])

        # Handle state_method recursively (expand args)
        if rule_type == 'state_method':
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) if isinstance(arg, dict) else arg
                               for arg in rule.get('args', [])]

        # Let the parent class handle other cases
        return super().expand_rule(rule)


# Ensure this handler is registered in exporter/games/__init__.py
