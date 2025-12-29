"""Dark Souls III game-specific exporter.

Transforms _can_get and _can_go_to helper calls into standard rule types
(location_check and can_reach) that the frontend can evaluate natively.
"""

from typing import Any, Dict, List
from .generic import GenericGameExportHandler


class DarkSouls3GameExportHandler(GenericGameExportHandler):
    """Dark Souls III-specific export handler.

    Uses expand_helper to transform Dark Souls III wrapper methods:
    - _can_get(location) -> location_check
    - _can_go_to(region) -> can_reach
    """

    def expand_helper(self, helper_name: str, args: List[Any] = None) -> Dict[str, Any]:
        """Expand Dark Souls III helper functions to standard rule types."""
        if not args:
            return None

        if helper_name == '_can_get':
            location_arg = args[0]
            location_value = location_arg.get('value') if isinstance(location_arg, dict) else location_arg
            return {
                'type': 'location_check',
                'location': {'type': 'constant', 'value': location_value}
            }
        elif helper_name == '_can_go_to':
            region_arg = args[0]
            region_value = region_arg.get('value') if isinstance(region_arg, dict) else region_arg
            return {
                'type': 'can_reach',
                'region': {'type': 'constant', 'value': region_value}
            }

        return None
