"""Landstalker - The Treasures of King Nole game-specific export handler.

This handler extends GenericGameExportHandler to handle:
- Region object conversion in closure variables (LandstalkerRegion -> string codes)
- all_of iterator expansion for event_visited_ patterns
- _landstalker_has_visited_regions helper expansion
"""

from typing import Dict, Any, List, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class LandstalkerGameExportHandler(GenericGameExportHandler):
    """Export handler for Landstalker - The Treasures of King Nole."""

    # Use resolved_items from sphere log for event item handling
    USE_RESOLVED_ITEMS = True

    def prepare_closure_vars(self, rule_func, closure_vars: Dict[str, Any]) -> Dict[str, Any]:
        """Convert Region objects in closure to their string codes for serialization."""
        if not callable(rule_func):
            return closure_vars

        enhanced_closure = closure_vars.copy()

        # Convert LandstalkerRegion objects to their codes
        if 'required_regions' in enhanced_closure:
            regions = enhanced_closure['required_regions']
            if isinstance(regions, list) and regions and hasattr(regions[0], 'code'):
                enhanced_closure['required_regions'] = [r.code for r in regions]
                logger.debug(f"Converted required_regions to codes: {enhanced_closure['required_regions']}")

        return enhanced_closure

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand rules with Landstalker-specific patterns."""
        if not rule or not isinstance(rule, dict):
            return rule

        # Handle all_of pattern with iterator for region visit checks
        if rule.get('type') == 'all_of':
            expanded = self._expand_all_of_event_visited(rule)
            if expanded:
                return expanded

        # Handle item_check with binary_op for event_visited_ + region.code
        if rule.get('type') == 'item_check':
            item = rule.get('item', {})
            if isinstance(item, dict) and item.get('type') == 'binary_op':
                simplified = self._simplify_event_visited_binary_op(item)
                if simplified:
                    return {"type": "item_check", "item": simplified}

        # Handle _landstalker_has_visited_regions helper call
        if rule.get('type') == 'helper' and rule.get('name') == '_landstalker_has_visited_regions':
            return self._expand_has_visited_regions_helper(rule)

        return super().expand_rule(rule, _depth)

    def _expand_all_of_event_visited(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Expand all_of patterns for event_visited_ checks.

        Converts:
          {type: all_of, iterator_info: {iterator: {type: constant, value: ["region1", ...]}}, ...}
        To:
          {type: and, conditions: [{type: item_check, item: "event_visited_region1"}, ...]}
        """
        iterator_info = rule.get('iterator_info', {})
        iterator = iterator_info.get('iterator', {})
        element_rule = rule.get('element_rule', {})

        # Only handle if it's an event_visited_ pattern
        if not self._is_event_visited_pattern(element_rule):
            return None

        # Get region codes from iterator
        region_codes = None
        if isinstance(iterator, dict):
            if iterator.get('type') == 'constant':
                value = iterator.get('value', [])
                if isinstance(value, list):
                    region_codes = [self._to_region_code(v) for v in value]

        if region_codes is not None:
            return self._build_event_visited_conditions(region_codes)

        return None

    def _expand_has_visited_regions_helper(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Expand _landstalker_has_visited_regions helper to item_check conditions."""
        args = rule.get('args', [])
        if not args:
            return {"type": "constant", "value": True}

        regions_arg = args[0]
        region_names = []

        if isinstance(regions_arg, dict) and regions_arg.get('type') == 'constant':
            value = regions_arg.get('value', [])
            if isinstance(value, list):
                region_names = value
        elif isinstance(regions_arg, list):
            region_names = regions_arg

        if not region_names:
            return {"type": "constant", "value": True}

        region_codes = [self._to_region_code(r) for r in region_names]
        return self._build_event_visited_conditions(region_codes)

    def _is_event_visited_pattern(self, element_rule: Dict[str, Any]) -> bool:
        """Check if element_rule matches event_visited_ + region.code pattern."""
        if element_rule.get('type') != 'item_check':
            return False
        item = element_rule.get('item', {})
        if not isinstance(item, dict) or item.get('type') != 'binary_op':
            return False
        if item.get('op') != '+':
            return False
        left = item.get('left', {})
        return left.get('type') == 'constant' and left.get('value') == 'event_visited_'

    def _simplify_event_visited_binary_op(self, binary_op: Dict[str, Any]) -> Optional[str]:
        """Simplify event_visited_ + region.code binary_op to string."""
        if binary_op.get('op') != '+':
            return None

        left = binary_op.get('left', {})
        right = binary_op.get('right', {})

        if left.get('type') != 'constant' or left.get('value') != 'event_visited_':
            return None

        # Handle attribute access (.code) on a constant value
        if right.get('type') == 'attribute' and right.get('attr') == 'code':
            obj = right.get('object', {})
            if obj.get('type') == 'constant':
                region_value = obj.get('value')
                code = self._to_region_code(region_value)
                return f"event_visited_{code}"

        return None

    def _to_region_code(self, value) -> str:
        """Convert a region value (object or string) to a code string."""
        if hasattr(value, 'code'):
            return value.code
        if isinstance(value, str):
            return value.lower().replace(' ', '_').replace("'", "").replace('-', '_')
        return str(value).lower()

    def _build_event_visited_conditions(self, region_codes: List[str]) -> Dict[str, Any]:
        """Build AND conditions for event_visited_ item checks."""
        if not region_codes:
            return {"type": "constant", "value": True}

        conditions = [{"type": "item_check", "item": f"event_visited_{code}"}
                      for code in region_codes]

        if len(conditions) == 1:
            return conditions[0]
        return {"type": "and", "conditions": conditions}
