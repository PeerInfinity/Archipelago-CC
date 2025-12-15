"""Civilization VI export handler."""

from typing import Dict, Any, List
import logging

from .generic import GenericGameExportHandler

logger = logging.getLogger(__name__)


class Civ6GameExportHandler(GenericGameExportHandler):
    """Handler for Civilization VI - fixes era region access rules."""

    # AUTO_EXPORT_DISCOVERED_HELPERS is True by default in GenericGameExportHandler
    AUTO_PRESERVE_LARGE_HELPERS = False

    def __init__(self):
        """Initialize the handler with era requirements storage."""
        super().__init__()
        # Store era requirements data for use during post-processing
        self._era_requirements: Dict[str, Any] = {}

    def preprocess_world_data(self, world, export_data: Dict[str, Any], player: int) -> None:
        """
        Capture era requirements data BEFORE regions are processed.

        This is called before process_regions, so the data will be available
        for post_process_data to fix the broken subscripts.
        """
        super().preprocess_world_data(world, export_data, player)

        try:
            # Build era requirements from the world object
            era_non_progressive = {}
            era_progressive_counts = {}

            for era in world.era_required_non_progressive_items:
                era_name = era.value if hasattr(era, 'value') else str(era)
                era_non_progressive[era_name] = list(world.era_required_non_progressive_items[era])

            for era in world.era_required_progressive_items_counts:
                era_name = era.value if hasattr(era, 'value') else str(era)
                era_progressive_counts[era_name] = dict(world.era_required_progressive_items_counts[era])

            # Store for use in post_process_data
            self._era_requirements = {
                'non_progressive': era_non_progressive,
                'progressive_counts': era_progressive_counts
            }

            logger.info(f"Captured era requirements for Civilization VI player {player}")

        except Exception as e:
            logger.warning(f"Could not capture era requirements: {e}")

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract game settings and era requirements for export."""
        settings = super().get_settings_data(world, multiworld, player)

        # Export era requirements data to settings for frontend use
        if self._era_requirements:
            settings['era_non_progressive_items'] = self._era_requirements.get('non_progressive', {})
            settings['era_progressive_item_counts'] = self._era_requirements.get('progressive_counts', {})
            logger.info(f"Exported era requirements to settings for Civilization VI player {player}")

        return settings

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-process exported data to fix era region access rules.

        The analyzer incorrectly exports world.era_required_*[era] subscripts as:
        - subscript with value = list of era names (dict keys)
        - index = era name string

        This fixes those broken subscripts by:
        1. Detecting the pattern (subscript with era names list and era name index)
        2. Replacing with direct constant values from the exported era requirements
        """
        if 'regions' not in data:
            return data

        for player_id, player_regions in data['regions'].items():
            for region_name, region in player_regions.items():
                # Fix exit access rules (era transitions)
                for exit_data in region.get('exits', []):
                    exit_name = exit_data.get('name', '')
                    access_rule = exit_data.get('access_rule')

                    if access_rule and isinstance(access_rule, dict):
                        fixed_rule = self._fix_era_subscripts(access_rule, player_id)
                        if fixed_rule is not access_rule:
                            exit_data['access_rule'] = fixed_rule
                            logger.debug(f"Fixed era subscript in exit '{exit_name}'")

                # Also check location access rules in case they reference era data
                for location in region.get('locations', []):
                    location_name = location.get('name', '')
                    access_rule = location.get('access_rule')

                    if access_rule and isinstance(access_rule, dict):
                        fixed_rule = self._fix_era_subscripts(access_rule, player_id)
                        if fixed_rule != access_rule:
                            location['access_rule'] = fixed_rule
                            logger.debug(f"Fixed era subscript in location '{location_name}'")

        return data

    def _fix_era_subscripts(self, rule: Dict[str, Any], player_id: str) -> Dict[str, Any]:
        """
        Recursively fix era subscript patterns in rules.

        Detects patterns like:
        {
            "type": "state_method",
            "method": "has_all",
            "args": [{
                "type": "subscript",
                "value": {"type": "constant", "value": ["ERA_ANCIENT", ...]},
                "index": {"type": "constant", "value": "ERA_ANCIENT"}
            }]
        }

        And replaces the subscript with the actual resolved value from era requirements.
        """
        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Handle state_method with has_all or has_all_counts
        if rule_type == 'state_method':
            method = rule.get('method')
            if method in ('has_all', 'has_all_counts'):
                args = rule.get('args', [])
                if args and len(args) > 0:
                    fixed_args = []
                    args_changed = False
                    for arg in args:
                        fixed_arg = self._resolve_era_subscript(arg, method, player_id)
                        if fixed_arg is not arg:
                            args_changed = True
                        fixed_args.append(fixed_arg)

                    if args_changed:
                        return {**rule, 'args': fixed_args}

        # Recursively process nested structures
        if rule_type in ('and', 'or'):
            conditions = rule.get('conditions', [])
            fixed_conditions = []
            any_changed = False
            for cond in conditions:
                fixed_cond = self._fix_era_subscripts(cond, player_id)
                if fixed_cond is not cond:
                    any_changed = True
                fixed_conditions.append(fixed_cond)
            if any_changed:
                return {**rule, 'conditions': fixed_conditions}

        if rule_type == 'not':
            condition = rule.get('condition')
            if condition:
                fixed_condition = self._fix_era_subscripts(condition, player_id)
                if fixed_condition is not condition:
                    return {**rule, 'condition': fixed_condition}

        if rule_type == 'conditional':
            any_changed = False
            result = dict(rule)
            for key in ('test', 'if_true', 'if_false'):
                if rule.get(key):
                    fixed = self._fix_era_subscripts(rule[key], player_id)
                    if fixed is not rule[key]:
                        result[key] = fixed
                        any_changed = True
            if any_changed:
                return result

        return rule

    def _resolve_era_subscript(self, arg: Dict[str, Any], method: str, player_id: str) -> Dict[str, Any]:
        """
        Resolve an era subscript pattern to its actual value.

        For has_all: returns the list of non-progressive items for the era
        For has_all_counts: returns the dict of progressive item counts for the era
        """
        if not isinstance(arg, dict):
            return arg

        arg_type = arg.get('type')
        if arg_type != 'subscript':
            return arg

        value = arg.get('value', {})
        index = arg.get('index', {})

        # Check if this is the era subscript pattern
        if value.get('type') != 'constant' or index.get('type') != 'constant':
            return arg

        value_data = value.get('value')
        era_name = index.get('value')

        # Check if value_data is a list of era names (can be strings or EraType enums)
        era_names = ['ERA_ANCIENT', 'ERA_CLASSICAL', 'ERA_MEDIEVAL', 'ERA_RENAISSANCE',
                     'ERA_INDUSTRIAL', 'ERA_MODERN', 'ERA_ATOMIC', 'ERA_INFORMATION', 'ERA_FUTURE']

        if not isinstance(value_data, list):
            return arg

        # Convert era items to strings (may be EraType enums or strings)
        def to_era_string(e):
            if isinstance(e, str):
                return e
            if hasattr(e, 'value'):  # EraType enum
                return e.value
            return str(e)

        value_data_strs = [to_era_string(e) for e in value_data]
        items_are_era_names = all(e in era_names for e in value_data_strs)

        if not items_are_era_names:
            return arg

        # Convert era_name to string if needed
        era_name_str = to_era_string(era_name) if not isinstance(era_name, str) else era_name

        if era_name_str not in era_names:
            return arg

        # This is an era subscript pattern - resolve it
        logger.debug(f"Resolving era subscript for {method} with era {era_name_str}")

        if method == 'has_all':
            # Get non-progressive items for this era
            items = self._era_requirements.get('non_progressive', {}).get(era_name_str, [])
            if items:
                return {'type': 'constant', 'value': items}
            else:
                logger.warning(f"No non-progressive items found for era {era_name}")
                return {'type': 'constant', 'value': []}

        elif method == 'has_all_counts':
            # Get progressive item counts for this era
            counts = self._era_requirements.get('progressive_counts', {}).get(era_name_str, {})
            if counts:
                return {'type': 'constant', 'value': counts}
            else:
                logger.warning(f"No progressive item counts found for era {era_name}")
                return {'type': 'constant', 'value': {}}

        return arg
