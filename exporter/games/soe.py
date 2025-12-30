"""Secret of Evermore game-specific export handler.

SOE uses pyevermizer for logic. Unlike most games, SOE locations don't have
Python lambda rules. Instead, pyevermizer provides requirements/provides data
that we convert to helper calls.
"""

from typing import Any, Dict, List, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class SoEGameExportHandler(GenericGameExportHandler):
    """Export handler for Secret of Evermore."""

    # SOE uses resolved_items instead of base_items for sphere inventory
    USE_RESOLVED_ITEMS = True

    def __init__(self, world=None):
        super().__init__(world)
        self._pyevermizer = None
        self._progress_id_to_name = None
        self._location_name_to_raw = None

    @property
    def pyevermizer(self):
        """Lazy-load pyevermizer module."""
        if self._pyevermizer is None:
            try:
                import pyevermizer
                self._pyevermizer = pyevermizer
            except ImportError:
                logger.warning("Could not import pyevermizer")
                self._pyevermizer = False  # Mark as failed
        return self._pyevermizer if self._pyevermizer else None

    @property
    def progress_id_to_name(self) -> Dict[int, str]:
        """Lazy-build progress ID to name mapping."""
        if self._progress_id_to_name is None:
            self._progress_id_to_name = {}
            if self.pyevermizer:
                import inspect
                for name, val in inspect.getmembers(self.pyevermizer):
                    if name.startswith('P_') and isinstance(val, int):
                        self._progress_id_to_name[val] = name
        return self._progress_id_to_name

    @property
    def location_name_to_raw(self) -> Dict[str, Any]:
        """Lazy-build location name to raw pyevermizer location mapping."""
        if self._location_name_to_raw is None:
            self._location_name_to_raw = {}
            if self.pyevermizer:
                import itertools
                for loc in itertools.chain(
                    self.pyevermizer.get_locations(),
                    self.pyevermizer.get_sniff_locations()
                ):
                    # Use the AP location name format
                    if loc.type == self.pyevermizer.CHECK_GOURD:
                        loc_name = f"{loc.name} #{loc.index}"
                    elif loc.type == self.pyevermizer.CHECK_SNIFF:
                        loc_name = f"{loc.name} Sniff #{loc.index}"
                    else:
                        loc_name = loc.name
                    self._location_name_to_raw[loc_name] = loc
        return self._location_name_to_raw

    def _create_has_helper(self, progress_id: int, count: int = 1) -> Dict[str, Any]:
        """Create a helper call rule for checking progress."""
        progress_name = self.progress_id_to_name.get(progress_id, f"P_{progress_id}")
        return {
            'type': 'helper',
            'name': 'has',
            'args': [
                {'type': 'constant', 'value': progress_id},
                {'type': 'constant', 'value': count}
            ],
            'comment': f"Requires {count}x {progress_name}"
        }

    def _transform_requirements(self, requires: List[tuple]) -> Optional[Dict[str, Any]]:
        """Transform pyevermizer requirements to rule format."""
        if not requires:
            return None
        conditions = [self._create_has_helper(pid, count) for count, pid in requires]
        if len(conditions) == 1:
            return conditions[0]
        return {'type': 'and', 'conditions': conditions}

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return SOE item data including pyevermizer provides information."""
        # Get base item data from GenericGameExportHandler
        item_data = super().get_item_data(world)

        if not self.pyevermizer:
            return item_data

        import itertools

        # Extend with pyevermizer provides information
        for item in itertools.chain(
            self.pyevermizer.get_items(),
            self.pyevermizer.get_extra_items(),
            self.pyevermizer.get_sniff_items()
        ):
            if item.name in item_data and item.provides:
                item_data[item.name]['provides'] = [
                    {
                        'count': count,
                        'progress_id': pid,
                        'progress_name': self.progress_id_to_name.get(pid, f"P_{pid}")
                    }
                    for count, pid in item.provides
                ]

        # Add logic rules that provide progress when requirements are met
        logic_rules = [
            {
                'requires': [{'count': c, 'progress_id': p} for c, p in rule.requires],
                'provides': [{'count': c, 'progress_id': p} for c, p in rule.provides]
            }
            for rule in self.pyevermizer.get_logic()
            if rule.provides
        ]
        if logic_rules:
            item_data['__soe_logic_rules__'] = {'name': '__soe_logic_rules__', 'rules': logic_rules}

        return item_data

    def postprocess_rule(self, rule) -> Optional[Dict[str, Any]]:
        """Skip Python rule analysis - get all rules from pyevermizer."""
        return None

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """Get location access rules from pyevermizer."""
        location_name = getattr(location, 'name', None)
        if not location_name:
            return {}

        # "Done" event location needs P_FINAL_BOSS
        if location_name == 'Done':
            if self.pyevermizer:
                return {'access_rule': self._create_has_helper(self.pyevermizer.P_FINAL_BOSS)}
            return {}

        # Get rules from pyevermizer for regular locations
        evermizer_loc = self.location_name_to_raw.get(location_name)
        if evermizer_loc:
            if evermizer_loc.requires:
                rule = self._transform_requirements(evermizer_loc.requires)
                if rule:
                    return {'access_rule': rule}
            return {'access_rule': {'type': 'constant', 'value': True}}

        return {}
