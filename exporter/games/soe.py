"""Secret of Evermore game-specific export handler."""

from typing import Any, Dict, List, Optional
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)

class SoEGameExportHandler(BaseGameExportHandler):
    """Export handler for Secret of Evermore.

    Secret of Evermore uses pyevermizer for logic. Unlike most games,
    SOE locations don't have Python lambda rules. Instead, the pyevermizer
    C++ library provides requirements/provides data that we need to convert
    to helper calls.
    """
    GAME_NAME = 'Secret of Evermore'

    def __init__(self):
        super().__init__()
        print(f"[SOE] Initializing SOE exporter")
        # Import pyevermizer to get progress constants
        try:
            import pyevermizer
            self.pyevermizer = pyevermizer
            # Map progress IDs to names
            self.progress_id_to_name = self._build_progress_map()
            # Get location mapping
            self.location_id_to_raw = self._get_location_mapping()
            print(f"[SOE] SOE exporter initialized with {len(self.location_id_to_raw)} evermizer locations")
            logger.info(f"SOE exporter initialized with {len(self.location_id_to_raw)} evermizer locations")
        except ImportError:
            logger.warning("Could not import pyevermizer - SOE export may be incomplete")
            self.pyevermizer = None
            self.progress_id_to_name = {}
            self.location_id_to_raw = {}

    def _build_progress_map(self) -> Dict[int, str]:
        """Build a mapping from progress ID to name."""
        import inspect
        progress_map = {}
        for name, val in inspect.getmembers(self.pyevermizer):
            if name.startswith('P_') and isinstance(val, int):
                progress_map[val] = name
        return progress_map

    def _get_location_mapping(self) -> Dict[str, Any]:
        """Get pyevermizer locations mapped by name."""
        import itertools

        _id_base = 64000
        _id_offset = {
            self.pyevermizer.CHECK_ALCHEMY: _id_base + 0,
            self.pyevermizer.CHECK_BOSS: _id_base + 50,
            self.pyevermizer.CHECK_GOURD: _id_base + 100,
            self.pyevermizer.CHECK_NPC: _id_base + 400,
            self.pyevermizer.CHECK_EXTRA: _id_base + 800,
            self.pyevermizer.CHECK_TRAP: _id_base + 900,
            self.pyevermizer.CHECK_SNIFF: _id_base + 1000
        }

        _locations = self.pyevermizer.get_locations()
        _sniff_locations = self.pyevermizer.get_sniff_locations()

        loc_map = {}
        for loc in itertools.chain(_locations, _sniff_locations):
            ap_id = _id_offset[loc.type] + loc.index
            # Use the AP location name format (with # for gourds)
            loc_name = f"{loc.name} #{loc.index}" if loc.type == self.pyevermizer.CHECK_GOURD else loc.name
            if loc.type == self.pyevermizer.CHECK_SNIFF:
                loc_name = f"{loc.name} Sniff #{loc.index}"
            loc_map[loc_name] = loc

        return loc_map

    def transform_pyevermizer_requirements(self, requires: List[tuple]) -> Optional[Dict[str, Any]]:
        """
        Transform pyevermizer requirements to rule format.

        Args:
            requires: List of (count, progress_id) tuples

        Returns:
            Rule dict or None if no requirements
        """
        if not requires:
            return None

        conditions = []
        for count, progress_id in requires:
            progress_name = self.progress_id_to_name.get(progress_id, f"UNKNOWN_{progress_id}")

            # Create a helper call for this requirement
            # The frontend will need to implement these helpers
            conditions.append({
                'type': 'helper',
                'name': 'has',
                'args': [
                    {'type': 'constant', 'value': progress_id},
                    {'type': 'constant', 'value': count}
                ],
                'comment': f"Requires {count}x {progress_name}"
            })

        if len(conditions) == 1:
            return conditions[0]
        elif len(conditions) > 1:
            return {
                'type': 'and',
                'conditions': conditions
            }

        return None

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """
        Override to add pyevermizer requirements to locations that don't have Python rules.
        """
        try:
            location_name = getattr(location, 'name', None)
            print(f"[SOE] get_location_attributes called for location {location_name}")
            attrs = super().get_location_attributes(location, world)
            print(f"[SOE] super() returned attrs: {list(attrs.keys()) if attrs else 'empty'}")

            # Only add rules if the location doesn't already have one from Python
            if hasattr(location, 'access_rule') and location.access_rule:
                print(f"[SOE] Location {location_name} already has Python access_rule, skipping")
                return attrs

            # Try to get evermizer requirements from the raw location data
            in_map = location_name in self.location_id_to_raw if location_name else False
            print(f"[SOE] Location: {location_name}, in map: {in_map}")
            if location_name and in_map:
                evermizer_loc = self.location_id_to_raw[location_name]
                print(f"[SOE] Found evermizer loc, requires: {evermizer_loc.requires}")
                if evermizer_loc.requires:
                    # Convert pyevermizer requirements to rule format
                    rule = self.transform_pyevermizer_requirements(evermizer_loc.requires)
                    if rule:
                        attrs['access_rule'] = rule
                        print(f"[SOE] Added helper rule to {location_name}")
                else:
                    # Explicitly set to True for locations with no requirements
                    attrs['access_rule'] = {'type': 'constant', 'value': True}
                    print(f"[SOE] Added constant True rule to {location_name}")
            else:
                print(f"[SOE] Location {location_name} not in mapping")

            return attrs
        except Exception as e:
            print(f"[SOE] ERROR in get_location_attributes: {e}")
            import traceback
            traceback.print_exc()
            return {}
