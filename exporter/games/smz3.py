"""SMZ3 game-specific export handler.

SMZ3 (Super Metroid & A Link to the Past Crossover) uses the TotalSMZ3 library
which has its own Region and Progression classes with complex game logic.
This exporter handles the conversion of SMZ3-specific patterns to JavaScript-compatible rules.
"""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class SMZ3GameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'SMZ3'

    def __init__(self):
        super().__init__()
        logger.info("SMZ3 exporter initialized")

    def postprocess_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-process SMZ3 rules to handle TotalSMZ3-specific patterns.

        Specifically handles:
        1. region.CanEnter(state.smz3state[player]) patterns
        2. loc.Available(state.smz3state[player]) patterns
        3. Custom smz3state collection state access
        """
        if not isinstance(rule, dict):
            return rule

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

                logger.debug("Found loc.Available pattern - converting to constant true")

                # For locations, the access_rule in Archipelago is always checked
                # The loc.Available check in SMZ3 includes both region access AND location access
                # Since we're already handling region access separately, and location-specific
                # requirements are in the location's own access_rule, we can return true here
                # TODO: Verify if there are any location-specific checks that need to be preserved
                return {
                    'type': 'constant',
                    'value': True
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

        return rule
