"""Starcraft 2 game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class SC2GameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Starcraft 2'
    """Export handler for Starcraft 2 game-specific rules and items."""

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively expand rule functions with SC2-specific logic pattern recognition.

        SC2 uses a logic object with helper methods (e.g., logic.terran_early_tech())
        and attributes (e.g., logic.take_over_ai_allies, logic.advanced_tactics).
        These need to be converted to helper calls or settings access.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Check for the pattern: function_call with function being attribute access on "logic"
        # This pattern looks like:
        # {
        #   "type": "function_call",
        #   "function": {
        #     "type": "attribute",
        #     "object": {"type": "name", "name": "logic"},
        #     "attr": "method_name"
        #   },
        #   "args": [...]
        # }
        if rule.get('type') == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                if obj.get('type') == 'name' and obj.get('name') == 'logic':
                    # This is a logic.method_name() call - convert to helper
                    method_name = function.get('attr')
                    # Recursively process args first
                    args = [self.expand_rule(arg) for arg in rule.get('args', [])]

                    logger.debug(f"[SC2] Converting logic.{method_name}() to helper call")

                    # Convert to helper format
                    converted_rule = {
                        'type': 'helper',
                        'name': method_name,
                        'args': args
                    }

                    # Continue expanding the converted rule
                    return super().expand_rule(converted_rule)

            # For other function_calls, recursively process args
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]

        # Check for the pattern: attribute access on "logic" (not a function call)
        # This pattern looks like:
        # {
        #   "type": "attribute",
        #   "object": {"type": "name", "name": "logic"},
        #   "attr": "attribute_name"
        # }
        # These are SC2Logic instance attributes that map to world settings
        if rule.get('type') == 'attribute':
            obj = rule.get('object', {})
            if obj.get('type') == 'name' and obj.get('name') == 'logic':
                # This is a logic.attribute_name access - convert to self.attribute_name
                # The rule engine knows how to resolve self.attribute from settings
                attr_name = rule.get('attr')

                logger.debug(f"[SC2] Converting logic.{attr_name} to self.{attr_name} (settings access)")

                # Convert to self attribute access which the rule engine resolves from settings
                converted_rule = {
                    'type': 'attribute',
                    'object': {'type': 'name', 'name': 'self'},
                    'attr': attr_name
                }

                # Continue expanding
                return super().expand_rule(converted_rule)

        # Handle compare operations - recursively process left and right operands
        if rule.get('type') == 'compare':
            if 'left' in rule:
                rule['left'] = self.expand_rule(rule['left'])
            if 'right' in rule:
                rule['right'] = self.expand_rule(rule['right'])

        # For all other rule types, use the parent class's expand_rule
        return super().expand_rule(rule)

    def expand_helper(self, helper_name: str):
        """Expand Starcraft 2-specific helper functions."""
        # For now, just use the generic implementation
        # We'll add specific helper expansions as needed during testing
        # Most helpers will be implemented in the JavaScript helper file
        return super().expand_helper(helper_name)

    def get_settings_data(self, world, multiworld, player: int) -> Dict[str, Any]:
        """Extract Starcraft 2 settings for export."""
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Export all SC2 options
        if hasattr(world, 'options'):
            for option_name in dir(world.options):
                # Skip private attributes and methods
                if option_name.startswith('_'):
                    continue

                option = getattr(world.options, option_name, None)
                if option is None:
                    continue

                # Extract the value from the option
                # Options typically have a 'value' attribute
                if hasattr(option, 'value'):
                    settings_dict[option_name] = option.value
                elif isinstance(option, (bool, int, str, float)):
                    settings_dict[option_name] = option

        return settings_dict
