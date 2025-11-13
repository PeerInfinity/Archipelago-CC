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

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """
        Return SOE item data including pyevermizer provides information.
        """
        if not self.pyevermizer:
            return {}

        import itertools

        item_data = {}

        # Get all items including extra items
        all_items = list(itertools.chain(
            self.pyevermizer.get_items(),
            self.pyevermizer.get_extra_items(),
            self.pyevermizer.get_sniff_items()
        ))

        # Build item data with provides information
        for item in all_items:
            if item.name not in item_data:
                item_data[item.name] = {
                    'name': item.name,
                    'provides': []
                }

            # Add provides information (list of [count, progress_id])
            if item.provides:
                for count, progress_id in item.provides:
                    progress_name = self.progress_id_to_name.get(progress_id, f"P_{progress_id}")
                    item_data[item.name]['provides'].append({
                        'count': count,
                        'progress_id': progress_id,
                        'progress_name': progress_name
                    })

        # Also add logic rules that provide progress when requirements are met
        # These act like "virtual items" that the frontend can check
        rules = self.pyevermizer.get_logic()
        logic_rules = []
        for i, rule in enumerate(rules):
            if rule.provides:
                rule_data = {
                    'requires': [{'count': count, 'progress_id': pid} for count, pid in rule.requires],
                    'provides': [{'count': count, 'progress_id': pid} for count, pid in rule.provides]
                }
                logic_rules.append(rule_data)

        # Store logic rules in a special metadata section
        if logic_rules:
            item_data['__soe_logic_rules__'] = {
                'name': '__soe_logic_rules__',
                'rules': logic_rules
            }

        print(f"[SOE] Exported {len(item_data)} items with provides data")
        logger.info(f"Exported {len(item_data)} SOE items with provides data")

        return item_data

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """
        Override to add pyevermizer requirements to locations that don't have Python rules.
        """
        try:
            location_name = getattr(location, 'name', None)
            print(f"[SOE] get_location_attributes called for location {location_name}")
            attrs = super().get_location_attributes(location, world)
            print(f"[SOE] super() returned attrs: {list(attrs.keys()) if attrs else 'empty'}")

            # Only skip evermizer rules if the base class successfully analyzed the Python rule
            if attrs and 'access_rule' in attrs and attrs['access_rule'] is not None:
                print(f"[SOE] Location {location_name} has analyzed Python access_rule, using it")
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
