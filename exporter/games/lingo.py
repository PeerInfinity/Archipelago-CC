"""Game-specific export handler for Lingo."""

import re
import logging
from typing import Dict, Any
from .generic import GenericGameExportHandler

logger = logging.getLogger(__name__)


class LingoGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Lingo'
    """Export handler for Lingo that handles AccessRequirements string sorting and door variable resolution."""

    def expand_rule(self, analyzed_rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Expand analyzed rule, with special handling for AccessRequirements string representations
        and door variable resolution.

        Lingo's AccessRequirements objects contain sets that have unpredictable string ordering.
        This method sorts the set contents when they appear in constant values.

        Additionally, it resolves the 'door' variable in lingo_can_use_entrance calls to actual values.
        """
        rule = super().expand_rule(analyzed_rule)

        # Resolve door variables in helper calls
        rule = self._resolve_door_variables(rule)

        # Recursively fix AccessRequirements in the rule
        return self._fix_access_requirements(rule)

    def _resolve_door_variables(self, obj: Any) -> Any:
        """
        Recursively resolve 'door' variable references in lingo_can_use_entrance helper calls.

        The door variable is a RoomAndDoor NamedTuple or None. When it's None,
        the helper function returns True, so we can simplify the rule.
        """
        if isinstance(obj, dict):
            # Check if this is a lingo_can_use_entrance helper call
            if obj.get('type') == 'helper' and obj.get('name') == 'lingo_can_use_entrance':
                args = obj.get('args', [])
                if len(args) >= 2:
                    # The second argument should be the door parameter
                    door_arg = args[1]
                    # Check if it's a name reference that needs resolution
                    if isinstance(door_arg, dict) and door_arg.get('type') == 'name' and door_arg.get('name') == 'door':
                        # Leave as-is for frontend helper to handle
                        logger.debug(f"Found lingo_can_use_entrance with unresolved door variable")
                    # Check if it's a constant null/None value
                    elif isinstance(door_arg, dict) and door_arg.get('type') == 'constant' and door_arg.get('value') is None:
                        # door is None, so lingo_can_use_entrance returns True
                        # Replace the entire helper call with a constant True
                        logger.debug(f"Simplified lingo_can_use_entrance with door=None to constant True")
                        return {'type': 'constant', 'value': True}

            # Recursively process dict values
            return {k: self._resolve_door_variables(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._resolve_door_variables(item) for item in obj]
        else:
            return obj

    def _fix_access_requirements(self, obj: Any) -> Any:
        """Recursively sort sets within AccessRequirements string representations."""
        if isinstance(obj, dict):
            # Recursively process dict values
            return {k: self._fix_access_requirements(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            # Process list items, with special handling for constant values containing AccessRequirements
            result = []
            for item in obj:
                if isinstance(item, str) and 'AccessRequirements(' in item:
                    # Parse and sort the sets in the AccessRequirements string
                    result.append(self._sort_access_requirements_string(item))
                else:
                    result.append(self._fix_access_requirements(item))
            return result
        else:
            return obj

    def _sort_access_requirements_string(self, s: str) -> str:
        """Sort sets within an AccessRequirements string representation."""
        # Pattern to match set literals like {'item1', 'item2', 'item3'}
        def sort_set(match):
            # Extract the set contents
            set_contents = match.group(1)
            if not set_contents.strip():
                return "{}"
            # Split by comma, strip whitespace and quotes, sort, then rebuild
            items = [item.strip().strip("'\"") for item in set_contents.split(',')]
            sorted_items = sorted(items)
            return "{" + ", ".join(f"'{item}'" for item in sorted_items) + "}"

        # Replace all set literals with sorted versions
        result = re.sub(r'\{([^{}]*)\}', sort_set, s)
        return result
