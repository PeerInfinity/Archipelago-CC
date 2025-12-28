"""The Legend of Zelda game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class TLoZGameExportHandler(GenericGameExportHandler):
    """Export handler for The Legend of Zelda.

    Handles the Boss Status location pattern where lambda default parameters
    reference related boss locations (e.g., "Level 1 Boss Status" references "Level 1 Boss").
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._current_location_name = None  # Track current location being processed

    def set_context(self, location_name: str):
        """Set the current location context for rule expansion."""
        self._current_location_name = location_name

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand rules with special handling for Boss Status can_reach patterns.

        Handles: state.can_reach(b, "Location", player) where b is a lambda default
        parameter pointing to a boss location. For "Level X Boss Status" locations,
        resolves the unresolved variable to "Level X Boss".
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Handle can_reach state methods for Boss Status locations
        if (rule.get('type') == 'state_method' and
            rule.get('method') == 'can_reach' and
            self._current_location_name and
            ' Boss Status' in self._current_location_name):

            args = rule.get('args', [])
            if (len(args) >= 2 and
                args[0].get('type') == 'name' and
                args[1].get('type') == 'constant' and
                args[1].get('value') == 'Location'):
                # Resolve the boss location name by removing " Status"
                boss_location_name = self._current_location_name.replace(' Status', '')
                logger.debug(f"Resolving can_reach for {self._current_location_name} -> {boss_location_name}")
                args[0] = {'type': 'constant', 'value': boss_location_name}
                rule['args'] = args

        # Call parent for recursive processing and f_string resolution
        return super().expand_rule(rule, _depth)
