"""Secret of Evermore game-specific export handler."""

from typing import Any, Dict, List, Optional
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)


class SoEGameExportHandler(BaseGameExportHandler):
    """Export handler for Secret of Evermore.

    Secret of Evermore uses pyevermizer for logic. Unlike most games,
    SOE locations don't have Python lambda rules. Instead, the pyevermizer
    C++ library provides requirements/provides data that we convert to
    helper calls.

    Key simplification: We don't analyze Python rules at all. Instead:
    - Regular locations get their rules directly from pyevermizer
    - The "Done" event location gets a hardcoded P_FINAL_BOSS requirement
    """

    # SOE uses resolved_items instead of base_items for sphere inventory
    USE_RESOLVED_ITEMS = True

    # Progress ID constants from pyevermizer
    P_FINAL_BOSS = 11

    def __init__(self):
        super().__init__()
        # Import pyevermizer to get progress constants and location data
        try:
            import pyevermizer
            self.pyevermizer = pyevermizer
            # Map progress IDs to names and vice versa
            self.progress_id_to_name = self._build_progress_map()
            self.name_to_progress_id = {v: k for k, v in self.progress_id_to_name.items()}
            # Get location mapping
            self.location_id_to_raw = self._get_location_mapping()
            logger.info(f"SOE exporter initialized with {len(self.location_id_to_raw)} evermizer locations")
        except ImportError:
            logger.warning("Could not import pyevermizer - SOE export may be incomplete")
            self.pyevermizer = None
            self.progress_id_to_name = {}
            self.name_to_progress_id = {}
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

        _locations = self.pyevermizer.get_locations()
        _sniff_locations = self.pyevermizer.get_sniff_locations()

        loc_map = {}
        for loc in itertools.chain(_locations, _sniff_locations):
            # Use the AP location name format (with # for gourds)
            if loc.type == self.pyevermizer.CHECK_GOURD:
                loc_name = f"{loc.name} #{loc.index}"
            elif loc.type == self.pyevermizer.CHECK_SNIFF:
                loc_name = f"{loc.name} Sniff #{loc.index}"
            else:
                loc_name = loc.name
            loc_map[loc_name] = loc

        return loc_map

    def _create_has_helper(self, progress_id: int, count: int = 1) -> Dict[str, Any]:
        """Create a helper call rule for checking progress.

        Args:
            progress_id: The pyevermizer progress ID to check
            count: Required count (default: 1)

        Returns:
            A helper rule dict
        """
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

    def transform_pyevermizer_requirements(self, requires: List[tuple]) -> Optional[Dict[str, Any]]:
        """Transform pyevermizer requirements to rule format.

        Args:
            requires: List of (count, progress_id) tuples

        Returns:
            Rule dict or None if no requirements
        """
        if not requires:
            return None

        conditions = [self._create_has_helper(progress_id, count) for count, progress_id in requires]

        if len(conditions) == 1:
            return conditions[0]
        return {
            'type': 'and',
            'conditions': conditions
        }

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return SOE item data including pyevermizer provides information."""
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
                provides = []
                if item.provides:
                    for count, progress_id in item.provides:
                        progress_name = self.progress_id_to_name.get(progress_id, f"P_{progress_id}")
                        provides.append({
                            'count': count,
                            'progress_id': progress_id,
                            'progress_name': progress_name
                        })

                item_data[item.name] = {
                    'name': item.name,
                    'provides': provides,
                    'event': False,
                    'type': None,
                    'max_count': 1
                }

        # Add logic rules that provide progress when requirements are met
        logic_rules = []
        for rule in self.pyevermizer.get_logic():
            if rule.provides:
                rule_data = {
                    'requires': [{'count': count, 'progress_id': pid} for count, pid in rule.requires],
                    'provides': [{'count': count, 'progress_id': pid} for count, pid in rule.provides]
                }
                logic_rules.append(rule_data)

        if logic_rules:
            item_data['__soe_logic_rules__'] = {
                'name': '__soe_logic_rules__',
                'rules': logic_rules
            }

        logger.info(f"Exported {len(item_data)} SOE items with provides data")
        return item_data

    def postprocess_rule(self, rule) -> Optional[Dict[str, Any]]:
        """Post-process analyzed rules.

        SOE rules don't need Python analysis - we get all rules from pyevermizer
        directly via get_location_attributes. Return None to signal that the
        analyzed Python rule should be replaced.
        """
        # Return None to let get_location_attributes provide the pyevermizer rule
        return None

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """Get location access rules from pyevermizer.

        This method provides rules for all SOE locations:
        - Regular locations get their rules from pyevermizer
        - The "Done" event location gets a hardcoded P_FINAL_BOSS requirement
        """
        try:
            location_name = getattr(location, 'name', None)
            attrs = {}

            # Special handling for the "Done" event location
            if location_name == 'Done':
                attrs['access_rule'] = self._create_has_helper(self.P_FINAL_BOSS)
                logger.debug(f"Added P_FINAL_BOSS rule to Done location")
                return attrs

            # Get rules from pyevermizer for regular locations
            if location_name and location_name in self.location_id_to_raw:
                evermizer_loc = self.location_id_to_raw[location_name]
                if evermizer_loc.requires:
                    rule = self.transform_pyevermizer_requirements(evermizer_loc.requires)
                    if rule:
                        attrs['access_rule'] = rule
                        logger.debug(f"Added helper rule to {location_name}")
                else:
                    # No requirements - location is always accessible
                    attrs['access_rule'] = {'type': 'constant', 'value': True}
                    logger.debug(f"Added constant True rule to {location_name}")
            else:
                logger.debug(f"Location {location_name} not in evermizer mapping")

            return attrs
        except Exception as e:
            logger.exception(f"Error in get_location_attributes for {getattr(location, 'name', 'Unknown')}")
            return {}
