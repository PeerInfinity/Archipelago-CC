"""Dark Souls III game-specific exporter.

Transforms _can_get and _can_go_to helper calls into standard rule types
(location_check and can_reach) that the frontend can evaluate natively.
"""

from typing import Any, Dict
from .generic import GenericGameExportHandler


class DarkSouls3GameExportHandler(GenericGameExportHandler):
    """Dark Souls III-specific export handler.

    Uses HELPER_TO_RULE_MAPPINGS to transform Dark Souls III wrapper methods:
    - _can_get(location) -> location_check
    - _can_go_to(region) -> can_reach
    """

    HELPER_TO_RULE_MAPPINGS: Dict[str, Dict[str, Any]] = {
        '_can_get': {'type': 'location_check', 'field': 'location'},
        '_can_go_to': {'type': 'can_reach', 'field': 'region'},
    }
