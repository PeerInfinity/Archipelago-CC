"""A Link to the Past game-specific export handler.

Handles ALttP-specific helper patterns and prevents rule explosion when
complex helpers like can_buy_unlimited are used with entrance shuffle.
"""

from typing import Dict, Any, Set, List, Optional
from ..base import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class ALttPGameExportHandler(GenericGameExportHandler):
    """Export handler for A Link to the Past.

    Handles:
    - Complex shop-based helpers (can_buy, can_buy_unlimited) that use
      generator expressions with region.can_reach() calls
    - Prevents rule explosion when entrance shuffle causes complex region
      reachability checks
    - State method replacements for _lttp_has_key and other ALttP-specific
      state extensions
    """

    # Preserve complex helpers that use generator expressions with region reachability.
    # These helpers iterate over shops and check shop.region.can_reach(state), which
    # can cause massive rule expansion when entrance shuffle is enabled because each
    # shop's region reachability needs to be computed with all possible entrance paths.
    HELPERS_TO_PRESERVE: Set[str] = {
        # Shop-based helpers from StateHelpers.py that use generator expressions
        # with shop.region.can_reach(state)
        'can_buy_unlimited',
        'can_buy',
        # Other complex helpers that might cause expansion issues
        'can_shoot_arrows',  # Calls can_buy in retro_bow mode
        # Bunny rule helpers from Rules.py that create deeply nested any_of/all_of
        # structures when analyzing paths through shuffled entrances
        'path_to_access_rule',
        'options_to_access_rule',
        'get_rule_to_add',
    }

    # NOTE: 'rule' and 'old_rule' closures from add_rule combined lambdas should
    # be analyzed recursively - they contain actual callable access rule functions.
    # Do NOT add them to CLOSURE_CONSTANT_REPLACEMENTS as that would lose rule logic.

    # State method replacements for ALttP-specific state extensions
    # These are handled specially in the call_visitor but we can add
    # additional patterns here if needed
    STATE_METHOD_REPLACEMENTS: Dict[str, Dict[str, Any]] = {
        # _lttp_has_key is handled directly in call_visitor.py with special logic
        # for universal key shuffle detection
    }

    def should_preserve_as_helper(self, helper_name: str) -> bool:
        """Check if a helper function should be preserved as a helper reference.

        This is called during rule analysis when the analyzer encounters a
        closure variable that's a callable. Returning True skips recursive
        analysis and creates a simple helper reference instead.

        This is critical for preventing rule explosion in ALttP when:
        - Bunny rules use path_to_access_rule with nested generator expressions
        - Options rules use options_to_access_rule with nested any() patterns

        Note: 'rule' and 'old_rule' closures from add_rule combined lambdas are
        handled by CLOSURE_CONSTANT_REPLACEMENTS (replaced with True) rather than
        preserved as helpers, to avoid undefined reference errors.

        Args:
            helper_name: Name of the helper function

        Returns:
            True if the helper should be preserved without analysis
        """
        if helper_name in self.HELPERS_TO_PRESERVE:
            logger.debug(f"ALttP: Preserving helper '{helper_name}' (in HELPERS_TO_PRESERVE)")
            return True
        return super().should_preserve_as_helper(helper_name) if hasattr(super(), 'should_preserve_as_helper') else False

    def expand_helper(self, helper_name: str, args: Optional[List[Any]] = None) -> Optional[Dict[str, Any]]:
        """Expand ALttP-specific helper patterns.

        For preserved helpers, we don't expand them inline - instead we let
        them remain as helper calls that the frontend will handle via the
        exported helper definitions.

        Args:
            helper_name: Name of the helper function
            args: Arguments passed to the helper

        Returns:
            Expanded rule structure, or None to use default handling
        """
        # Let preserved helpers stay as helper calls
        if helper_name in self.HELPERS_TO_PRESERVE:
            logger.debug(f"Preserving ALttP helper '{helper_name}' as helper call (not expanding)")
            return None

        # Fall back to parent class expansion
        return super().expand_helper(helper_name, args)

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand ALttP rules with special handling for complex bunny rules.

        ALttP bunny rules can create deeply nested any_of/all_of structures
        that exceed the size limit. We flatten these structures and apply
        special simplification for the common patterns.

        The base class now applies lossless simplification (deduplication,
        constant folding, flattening) during expansion. This handler adds:
        1. Additional flattening for any_of/all_of patterns
        2. Lossy simplification as a last resort for very large rules
        """
        import json

        # Check input size before expansion
        try:
            input_size = len(json.dumps(rule, default=str))
            input_size_kb = input_size / 1024

            # For very large rules (>200KB), simplify immediately to Moon Pearl check
            # This prevents further explosion during expansion
            # Threshold raised from 100KB since lossless simplification helps
            if input_size_kb > 200:
                logger.warning(f"LOSSY FALLBACK: ALttP rule too large pre-expansion ({input_size_kb:.1f} KB > 200 KB), "
                             f"simplifying to Moon Pearl check (rule may be more permissive than original)")
                return {'rule': 'Has', 'args': {'item_name': 'Moon Pearl', 'count': 1}}

            if input_size_kb > 50:
                # Log more details about the large rule
                rule_type = rule.get('type', 'unknown')
                rule_name = rule.get('name', rule.get('method', ''))
                rule_str = json.dumps(rule, default=str)
                helper_count = rule_str.count('"type": "helper"')
                item_check_count = rule_str.count('"type": "item_check"')
                or_count = rule_str.count('"type": "or"')
                and_count = rule_str.count('"type": "and"')

                logger.debug(f"ALttP expand_rule input large: {input_size_kb:.1f} KB "
                           f"[type={rule_type}, name={rule_name}, helpers={helper_count}, "
                           f"item_checks={item_check_count}, ors={or_count}, ands={and_count}]")
        except:
            pass

        # Do standard expansion (which now includes lossless simplification)
        result = super().expand_rule(rule, _depth)

        # Then apply ALttP-specific flattening for any_of/all_of patterns
        if result and isinstance(result, dict):
            result = self._flatten_nested_any_of(result)
            # Apply lossless simplification again after flattening
            result = self.simplify_rule_tree(result)
            # Only use lossy simplification as last resort (raised threshold to 100KB)
            result = self._simplify_for_size(result, size_limit_kb=100)

        return result

    def _flatten_nested_any_of(self, rule: Dict[str, Any], max_depth: int = 5) -> Dict[str, Any]:
        """Flatten deeply nested any_of structures.

        Bunny rules can create patterns like any_of(any_of(any_of(...)))
        which don't add semantic value but increase rule size exponentially.
        This flattens them into a single any_of with all conditions combined.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Handle any_of and all_of flattening
        if rule_type in ('any_of', 'or'):
            conditions = []
            needs_flattening = False

            # Get all child conditions, including from nested same-type nodes
            def collect_conditions(node, depth=0):
                nonlocal needs_flattening
                if not isinstance(node, dict):
                    conditions.append(node)
                    return
                node_type = node.get('type')
                # Flatten same-type nodes (any_of can be flattened with or)
                if node_type in ('any_of', 'or') and depth < max_depth:
                    needs_flattening = True
                    for cond in node.get('conditions', []):
                        collect_conditions(cond, depth + 1)
                    # Also check element_rule for generator-style any_of
                    if 'element_rule' in node:
                        collect_conditions(node['element_rule'], depth + 1)
                else:
                    conditions.append(self._flatten_nested_any_of(node, max_depth))

            # Collect from direct conditions
            for cond in rule.get('conditions', []):
                collect_conditions(cond)
            # Also from element_rule (generator pattern)
            if 'element_rule' in rule:
                collect_conditions(rule['element_rule'])

            if needs_flattening and conditions:
                return {'type': 'or', 'conditions': conditions}

        if rule_type in ('all_of', 'and'):
            conditions = []
            needs_flattening = False

            def collect_conditions(node, depth=0):
                nonlocal needs_flattening
                if not isinstance(node, dict):
                    conditions.append(node)
                    return
                node_type = node.get('type')
                if node_type in ('all_of', 'and') and depth < max_depth:
                    needs_flattening = True
                    for cond in node.get('conditions', []):
                        collect_conditions(cond, depth + 1)
                    if 'element_rule' in node:
                        collect_conditions(node['element_rule'], depth + 1)
                else:
                    conditions.append(self._flatten_nested_any_of(node, max_depth))

            for cond in rule.get('conditions', []):
                collect_conditions(cond)
            if 'element_rule' in rule:
                collect_conditions(rule['element_rule'])

            if needs_flattening and conditions:
                return {'type': 'and', 'conditions': conditions}

        # Recursively process other structures
        if 'conditions' in rule:
            rule = dict(rule)
            rule['conditions'] = [self._flatten_nested_any_of(c, max_depth) for c in rule['conditions']]
        if 'element_rule' in rule:
            rule = dict(rule)
            rule['element_rule'] = self._flatten_nested_any_of(rule['element_rule'], max_depth)
        if 'if_true' in rule:
            rule = dict(rule)
            rule['if_true'] = self._flatten_nested_any_of(rule['if_true'], max_depth)
        if 'if_false' in rule:
            rule = dict(rule)
            rule['if_false'] = self._flatten_nested_any_of(rule['if_false'], max_depth)

        return rule

    def _simplify_for_size(self, rule: Dict[str, Any], size_limit_kb: int = 50) -> Dict[str, Any]:
        """Simplify rules that exceed the size limit.

        For ALttP bunny rules, if a rule is too complex to export properly,
        we simplify it to a more permissive version to prevent export failures.
        This trades some accuracy for functionality.
        """
        import json

        try:
            rule_size = len(json.dumps(rule, default=str))
            rule_size_kb = rule_size / 1024

            if rule_size_kb > size_limit_kb:
                logger.warning(f"LOSSY FALLBACK: ALttP rule too large post-expansion ({rule_size_kb:.1f} KB > {size_limit_kb} KB), "
                             f"simplifying to constant True (location will always be considered accessible)")
                # Return permissive rule - location will be considered accessible
                # This is safer than failing completely
                return {'type': 'constant', 'value': True}
        except (TypeError, ValueError):
            pass

        return rule

    def postprocess_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process ALttP rules to simplify or optimize.

        This can be used to:
        - Simplify constant True/False branches
        - Optimize deeply nested structures
        - Handle ALttP-specific rule patterns

        Args:
            rule: The rule structure to post-process

        Returns:
            The post-processed rule structure
        """
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Simplify 'and' with constant True children
        if rule_type == 'and':
            conditions = rule.get('conditions', [])
            filtered = [c for c in conditions if not (
                isinstance(c, dict) and
                c.get('type') == 'constant' and
                c.get('value') is True
            )]
            if len(filtered) == 0:
                return {'type': 'constant', 'value': True}
            elif len(filtered) == 1:
                return self.postprocess_rule(filtered[0])
            elif len(filtered) < len(conditions):
                rule = dict(rule)
                rule['conditions'] = [self.postprocess_rule(c) for c in filtered]
                return rule

        # Simplify 'or' with constant False children
        if rule_type == 'or':
            conditions = rule.get('conditions', [])
            # If any child is True, the whole thing is True
            if any(isinstance(c, dict) and c.get('type') == 'constant' and c.get('value') is True
                   for c in conditions):
                return {'type': 'constant', 'value': True}
            # Remove False children
            filtered = [c for c in conditions if not (
                isinstance(c, dict) and
                c.get('type') == 'constant' and
                c.get('value') is False
            )]
            if len(filtered) == 0:
                return {'type': 'constant', 'value': False}
            elif len(filtered) == 1:
                return self.postprocess_rule(filtered[0])
            elif len(filtered) < len(conditions):
                rule = dict(rule)
                rule['conditions'] = [self.postprocess_rule(c) for c in filtered]
                return rule

        # Recursively process children for 'and' and 'or'
        if rule_type in ('and', 'or') and 'conditions' in rule:
            rule = dict(rule)
            rule['conditions'] = [self.postprocess_rule(c) for c in rule['conditions']]
            return rule

        return rule
