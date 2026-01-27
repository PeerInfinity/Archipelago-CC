"""Final Fantasy Mystic Quest game-specific export handler.

FFMQ uses weapon groups (Swords, Axes, Claws, Bombs) to check for weapon
requirements. The rules use patterns like:

    state.has_any(item_groups[w + "s"], spot.player)

Where `w` is a weapon type like 'Sword', and `item_groups['Swords']` returns
the list of all sword items.

FFMQ's process_rules function uses add_rule to combine multiple rules,
creating nested lambdas that are difficult to analyze. This handler
provides override_rule_analysis to extract and properly format these rules.
"""

from typing import Dict, Any, Optional, Callable, List
from ..base import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class FFMQGameExportHandler(GenericGameExportHandler):
    """FFMQ-specific expander that handles Final Fantasy Mystic Quest rules."""

    # Module-level variables to inject into closure_vars for helper analysis
    # item_groups maps group names (e.g., 'Swords') to lists of item names
    CLOSURE_VAR_IMPORTS = {
        'worlds.ffmq.Items': ['item_groups', 'yaml_item'],
    }

    # Item name modules for automatic item constant resolution
    ITEM_NAME_MODULES = ['worlds.ffmq.Items']

    def __init__(self, world=None):
        super().__init__(world)
        # Cache item_groups for rule resolution
        try:
            from worlds.ffmq.Items import item_groups
            self._item_groups = item_groups
        except ImportError:
            self._item_groups = {}

    def override_rule_analysis(self, rule_func: Callable, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Override rule analysis for FFMQ's combined lambda patterns.

        FFMQ uses add_rule to combine rules, creating nested lambdas like:
            lambda state: rule(state) and old_rule(state)

        This method extracts the component rules and returns a properly
        formatted Rule Builder structure.
        """
        if rule_func is None:
            return None

        try:
            # Check if this is a combined rule from add_rule
            # These have source at worlds/generic/Rules.py and freevars ('old_rule', 'rule')
            code = getattr(rule_func, '__code__', None)
            if code is None:
                return None

            # Check for add_rule combined lambda pattern
            freevars = code.co_freevars
            if freevars == ('old_rule', 'rule') and 'Rules.py' in code.co_filename:
                return self._analyze_combined_rule(rule_func)

            # Check for single FFMQ rule (weapon check or has_all)
            if 'Regions.py' in code.co_filename or '<stdin>' in code.co_filename:
                return self._analyze_single_ffmq_rule(rule_func)

        except Exception as e:
            logger.debug(f"FFMQ override_rule_analysis failed for '{rule_target_name}': {e}")

        return None

    def _analyze_combined_rule(self, rule_func: Callable) -> Optional[Dict[str, Any]]:
        """Analyze a combined rule from add_rule (and/or pattern)."""
        try:
            closure = rule_func.__closure__
            if not closure or len(closure) < 2:
                return None

            freevars = rule_func.__code__.co_freevars

            # Extract old_rule and rule from closure
            old_rule = None
            new_rule = None
            for i, var_name in enumerate(freevars):
                if i < len(closure):
                    try:
                        val = closure[i].cell_contents
                        if var_name == 'old_rule':
                            old_rule = val
                        elif var_name == 'rule':
                            new_rule = val
                    except ValueError:
                        pass

            if old_rule is None or new_rule is None:
                return None

            # Recursively analyze both rules
            old_result = self._analyze_rule_component(old_rule)
            new_result = self._analyze_rule_component(new_rule)

            # Combine results - the structure is: new_rule AND old_rule
            # But we need to check for True_ results and simplify
            conditions = []

            if old_result and not self._is_always_true(old_result):
                conditions.append(old_result)
            if new_result and not self._is_always_true(new_result):
                conditions.append(new_result)

            if not conditions:
                return {'rule': 'True_'}
            elif len(conditions) == 1:
                return conditions[0]
            else:
                return {'rule': 'And', 'args': {'rules': conditions}}

        except Exception as e:
            logger.debug(f"FFMQ _analyze_combined_rule failed: {e}")
            return None

    def _analyze_rule_component(self, rule_func: Callable) -> Optional[Dict[str, Any]]:
        """Analyze a single rule component (may be another combined rule)."""
        if rule_func is None:
            return None

        try:
            code = getattr(rule_func, '__code__', None)
            if code is None:
                return None

            freevars = code.co_freevars

            # Check for combined rule
            if freevars == ('old_rule', 'rule') and 'Rules.py' in code.co_filename:
                return self._analyze_combined_rule(rule_func)

            # Check for single FFMQ rule
            return self._analyze_single_ffmq_rule(rule_func)

        except Exception as e:
            logger.debug(f"FFMQ _analyze_rule_component failed: {e}")
            return None

    def _analyze_single_ffmq_rule(self, rule_func: Callable) -> Optional[Dict[str, Any]]:
        """Analyze a single FFMQ rule (weapon check or has_all)."""
        try:
            code = rule_func.__code__
            closure = getattr(rule_func, '__closure__', None)
            defaults = getattr(rule_func, '__defaults__', None)

            # Check for weapon rule: lambda state, w=weapon: state.has_any(item_groups[w + "s"], spot.player)
            # This has defaults like ('Sword',) and freevars like ('spot',)
            if defaults and len(defaults) == 1 and isinstance(defaults[0], str):
                weapon = defaults[0]
                if weapon in ('Sword', 'Axe', 'Claw', 'Bomb'):
                    group_name = weapon + 's'
                    items = self._item_groups.get(group_name, [])
                    if items:
                        return {'rule': 'HasAny', 'args': {'items': items}}
                    else:
                        logger.warning(f"FFMQ: Unknown weapon group '{group_name}'")
                        return {'rule': 'True_'}  # Unknown weapon, assume accessible

            # Check for has_all rule: lambda state: state.has_all(access, spot.player)
            # This has freevars like ('access_filtered', 'spot') or ('spot',)
            freevars = code.co_freevars
            if closure:
                access_items = None
                for i, var_name in enumerate(freevars):
                    if i < len(closure) and var_name in ('access', 'access_filtered'):
                        try:
                            access_items = closure[i].cell_contents
                        except ValueError:
                            pass

                if access_items is not None:
                    if isinstance(access_items, (list, tuple)):
                        if not access_items:  # Empty list = always true
                            return {'rule': 'True_'}
                        else:
                            return {'rule': 'HasAll', 'args': {'items': list(access_items)}}

            # Check for simple constant return lambdas (lambda state: True or lambda state: False)
            # These have no closure and no defaults, and just return a constant
            # Use bytecode analysis to determine the return value
            if not closure and not defaults:
                result = self._analyze_constant_return_lambda(rule_func)
                if result is not None:
                    return result

        except Exception as e:
            logger.debug(f"FFMQ _analyze_single_ffmq_rule failed: {e}")

        return None

    def _analyze_constant_return_lambda(self, rule_func: Callable) -> Optional[Dict[str, Any]]:
        """Analyze a lambda that returns a constant True or False.

        FFMQ uses:
        - lambda state: True (always accessible)
        - lambda state: False (blocked crest warps in non-expert logic)

        Uses bytecode analysis to reliably detect the return value.
        """
        try:
            code = rule_func.__code__

            # Check the bytecode for constant return pattern
            # For lambda state: False, the bytecode contains LOAD_CONST with False
            # For lambda state: True, the bytecode contains LOAD_CONST with True
            co_consts = code.co_consts

            # Simple lambdas like "lambda state: False" have bytecode:
            # RESUME, LOAD_CONST (False), RETURN_VALUE
            # The constant False or True will be in co_consts

            # Check if False is in constants (indicates lambda state: False)
            if False in co_consts:
                return {'rule': 'False_'}

            # Check if True is in constants (indicates lambda state: True)
            if True in co_consts:
                return {'rule': 'True_'}

            # Fallback: try to execute the lambda with a mock state to determine value
            # This is safe because FFMQ's constant lambdas don't use the state
            try:
                result = rule_func(None)
                if result is False:
                    return {'rule': 'False_'}
                elif result is True:
                    return {'rule': 'True_'}
            except:
                pass

            # Default to True if we can't determine
            logger.debug(f"FFMQ: Could not determine constant return value, defaulting to True_")
            return {'rule': 'True_'}

        except Exception as e:
            logger.debug(f"FFMQ _analyze_constant_return_lambda failed: {e}")
            return None

    def _is_always_true(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule always evaluates to True."""
        if not rule:
            return True
        rule_type = rule.get('rule')
        if rule_type == 'True_':
            return True
        if rule_type == 'HasAll':
            items = rule.get('args', {}).get('items', [])
            return not items  # Empty items list = always true
        return False
