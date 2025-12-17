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

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand rules with era subscript resolution.

        This resolves era subscripts during the initial export pass, eliminating
        the need for post_process_data fixes.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # First apply base class expansion
        rule = super().expand_rule(rule, _depth)

        # Then resolve era subscripts
        return self._resolve_subscripts_in_rule(rule)

    def _resolve_subscripts_in_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively resolve era subscripts in a rule."""
        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Resolve subscripts directly
        if rule_type == 'subscript':
            resolved = self._try_resolve_subscript(rule)
            if resolved is not rule:
                return resolved

        # Handle state_method with has_all or has_all_counts - resolve subscripts in args
        if rule_type == 'state_method':
            method = rule.get('method')
            if method in ('has_all', 'has_all_counts'):
                args = rule.get('args', [])
                if args:
                    fixed_args = [self._resolve_subscripts_in_rule(arg) for arg in args]
                    if fixed_args != args:
                        return {**rule, 'args': fixed_args}

        # Recursively process nested structures
        if rule_type in ('and', 'or'):
            conditions = rule.get('conditions', [])
            fixed_conditions = [self._resolve_subscripts_in_rule(cond) for cond in conditions]
            if fixed_conditions != conditions:
                return {**rule, 'conditions': fixed_conditions}

        if rule_type == 'not':
            condition = rule.get('condition')
            if condition:
                fixed = self._resolve_subscripts_in_rule(condition)
                if fixed is not condition:
                    return {**rule, 'condition': fixed}

        if rule_type == 'conditional':
            result = dict(rule)
            any_changed = False
            for key in ('test', 'if_true', 'if_false'):
                if rule.get(key):
                    fixed = self._resolve_subscripts_in_rule(rule[key])
                    if fixed is not rule[key]:
                        result[key] = fixed
                        any_changed = True
            if any_changed:
                return result

        return rule

    def _try_resolve_subscript(self, subscript: Dict[str, Any]) -> Dict[str, Any]:
        """Try to resolve a subscript to its constant value.

        Handles era subscripts like world.era_required_non_progressive_items[era].
        """
        value = subscript.get('value', {})
        index = subscript.get('index', {})

        # Both value and index must be constants to resolve
        if value.get('type') != 'constant' or index.get('type') != 'constant':
            return subscript

        value_data = value.get('value')
        index_value = index.get('value')

        # Handle dict subscript - look up key
        if isinstance(value_data, dict) and index_value in value_data:
            return {'type': 'constant', 'value': value_data[index_value]}

        # Handle list subscript - look up index
        if isinstance(value_data, list) and isinstance(index_value, int):
            if 0 <= index_value < len(value_data):
                return {'type': 'constant', 'value': value_data[index_value]}

        # Check if this is an era names list pattern (legacy behavior)
        era_names = ['ERA_ANCIENT', 'ERA_CLASSICAL', 'ERA_MEDIEVAL', 'ERA_RENAISSANCE',
                     'ERA_INDUSTRIAL', 'ERA_MODERN', 'ERA_ATOMIC', 'ERA_INFORMATION', 'ERA_FUTURE']

        if isinstance(value_data, list):
            # Convert era items to strings (may be EraType enums or strings)
            def to_era_string(e):
                if isinstance(e, str):
                    return e
                if hasattr(e, 'value'):  # EraType enum
                    return e.value
                return str(e)

            value_data_strs = [to_era_string(e) for e in value_data]
            items_are_era_names = all(e in era_names for e in value_data_strs)

            if items_are_era_names:
                era_name_str = to_era_string(index_value) if not isinstance(index_value, str) else index_value

                if era_name_str in era_names:
                    # This is an era subscript - resolve from captured requirements
                    # For has_all: non-progressive items
                    items = self._era_requirements.get('non_progressive', {}).get(era_name_str, [])
                    if items:
                        return {'type': 'constant', 'value': items}
                    # For has_all_counts: progressive counts
                    counts = self._era_requirements.get('progressive_counts', {}).get(era_name_str, {})
                    if counts:
                        return {'type': 'constant', 'value': counts}

        return subscript

    # NOTE: post_process_data removed - era subscript resolution now happens during
    # the initial export pass via expand_rule() -> _resolve_subscripts_in_rule()
