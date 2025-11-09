"""Game-specific export handler for Lingo."""

import re
from typing import Dict, Any
from .generic import GenericGameExportHandler


class LingoGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Lingo'
    """Export handler for Lingo that handles AccessRequirements string sorting."""

    def expand_rule(self, analyzed_rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Expand analyzed rule, with special handling for AccessRequirements string representations.

        Lingo's AccessRequirements objects contain sets that have unpredictable string ordering.
        This method sorts the set contents when they appear in constant values.
        """
        rule = super().expand_rule(analyzed_rule)

        # Recursively fix AccessRequirements in the rule
        return self._fix_access_requirements(rule)

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
