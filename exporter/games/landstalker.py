"""Landstalker - The Treasures of King Nole game-specific export handler."""

from typing import Dict, Any, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class LandstalkerGameExportHandler(GenericGameExportHandler):
    """Export handler for Landstalker - The Treasures of King Nole.

    This handler extends GenericGameExportHandler to provide custom handling
    for Landstalker-specific rule patterns, particularly:
    - Complex nested has_all(set(...)) patterns from path requirements
    - Shop item rules with duplicate checking
    - Region visit tracking
    """

    GAME_NAME = 'Landstalker - The Treasures of King Nole'

    def __init__(self):
        super().__init__()
        logger.info(f"Initialized {self.__class__.__name__} for {self.GAME_NAME}")

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand rule functions with Landstalker-specific handling.

        This method handles the complex pattern from make_path_requirement_lambda:
        state.has_all(set(required_items), player) and _landstalker_has_visited_regions(...)

        Which exports as:
        {
          "type": "state_method",
          "method": "has_all",
          "args": [{"type": "helper", "name": "set", "args": [...]}]
        }
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Handle state_method: has_all with helper: set pattern
        # This comes from: state.has_all(set(required_items), player)
        if rule.get('type') == 'state_method' and rule.get('method') == 'has_all':
            return self._simplify_has_all(rule)

        # Let parent handle standard cases
        return super().expand_rule(rule)

    def _simplify_has_all(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Simplify state.has_all(set([items]), player) patterns.

        Converts:
          state.has_all(set(["Safety Pass"]), player)
        To:
          {"type": "item_check", "item": "Safety Pass"}

        Or for multiple items:
          state.has_all(set(["Item1", "Item2"]), player)
        To:
          {"type": "and", "conditions": [
            {"type": "item_check", "item": "Item1"},
            {"type": "item_check", "item": "Item2"}
          ]}
        """
        args = rule.get('args', [])

        # Look for the pattern: args[0] is {"type": "helper", "name": "set", ...}
        if not args or len(args) == 0:
            logger.warning("has_all with no args, keeping as-is")
            return rule

        first_arg = args[0]

        # Check if first arg is a set() helper call
        if isinstance(first_arg, dict) and first_arg.get('type') == 'helper' and first_arg.get('name') == 'set':
            # Extract the items from set(items)
            set_args = first_arg.get('args', [])
            if set_args and len(set_args) > 0:
                items_arg = set_args[0]

                # Extract the actual list of item names
                items = self._extract_items_from_constant(items_arg)

                if items:
                    # Convert to item checks
                    if len(items) == 0:
                        # Empty set, always true
                        return {"type": "constant", "value": True}
                    elif len(items) == 1:
                        # Single item, simple item_check
                        return {"type": "item_check", "item": items[0]}
                    else:
                        # Multiple items, AND them together
                        return {
                            "type": "and",
                            "conditions": [
                                {"type": "item_check", "item": item}
                                for item in items
                            ]
                        }

        # Couldn't simplify, log and return original
        logger.warning(f"Could not simplify has_all pattern: {rule}")
        return rule

    def _extract_items_from_constant(self, arg: Any) -> List[str]:
        """Extract list of item names from a constant value argument.

        Handles patterns like:
          {"type": "constant", "value": ["Safety Pass"]}
          {"type": "constant", "value": ["Item1", "Item2"]}
        """
        if isinstance(arg, dict) and arg.get('type') == 'constant':
            value = arg.get('value')
            if isinstance(value, list):
                # Filter to only string items (item names)
                return [item for item in value if isinstance(item, str)]

        return []
