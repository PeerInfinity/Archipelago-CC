"""A Short Hike game-specific export handler.

This handler exports option-dependent golden feather rules so that the worldgen
world correctly evaluates accessibility based on the golden_feather_progression option.

The A Short Hike world has location-specific feather requirements that differ based on
the golden_feather_progression option:
- easy: Uses minGoldenFeathersEasy values
- normal: Uses minGoldenFeathers values
- hard: No feather requirements

Without this handler, the exporter captures static values based on the generation options,
which causes logic mismatches when fuzzing with different option configurations.
"""

from typing import Dict, Any, Optional, List
from ..base import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


# Location-specific feather requirements from Locations.py
# Format: {location_name: (minGoldenFeathers, minGoldenFeathersEasy, minGoldenFeathersBucket)}
FEATHER_REQUIREMENTS = {
    # Locations with different normal/easy values
    "West River Seashell": (0, 1, 0),
    "West Riverbank Seashell": (0, 1, 0),
    "Stone Tower Riverbank Seashell": (0, 1, 0),
    "Meteor Lake Seashell": (0, 1, 0),
    "Good Creek Path Seashell": (0, 1, 0),
    "Tough Bird Salesman Golden Feather 1": (0, 1, 0),
    "Tough Bird Salesman Golden Feather 2": (0, 1, 0),
    "Tough Bird Salesman Golden Feather 3": (0, 1, 0),
    "Tough Bird Salesman Golden Feather 4": (0, 1, 0),
    "Tough Bird Salesman (400 Coins)": (0, 1, 0),
    "Hawk Peak Bucket Rock": (0, 1, 0),
    "Bill the Walrus Fisherman": (0, 1, 0),
    "Catch All Fish Reward": (7, 9, 7),
    "Permit Guy Bribe": (0, 1, 0),
    "Catch Fish with Permit": (0, 1, 0),
    "Return Camping Permit": (0, 1, 0),
    "Blackwood Trail Lookout Toy Shovel": (0, 1, 0),
    "Blackwood Trail Rock Toy Shovel": (0, 1, 0),
    "Below Lighthouse Walkway Stick": (0, 1, 0),
    "Cliff Overlooking West River Waterfall Stick": (0, 2, 0),
    "Trail to Tough Bird Salesman Stick": (0, 1, 0),
    "Outlook Point Dog Gift": (0, 1, 0),
    "Taylor the Turtle Headband Gift": (0, 1, 0),
    "Sue the Rabbit Shoes Reward": (0, 1, 0),
    "Blackwood Forest Golden Feather": (0, 1, 0),
    "Artist Golden Feather": (0, 1, 0),
    "Visitor Camp Rock Golden Feather": (0, 1, 0),
    "Outlook Cliff Golden Feather": (0, 1, 0),
    "Meteor Lake Cliff Golden Feather": (0, 5, 0),
    "Secret Island Peak": (5, 7, 7),
    "Lighthouse Golden Chest": (2, 3, 0),
    "Outlook Golden Chest": (0, 1, 0),
    "Stone Tower Golden Chest": (0, 1, 0),
    "North Cliff Golden Chest": (3, 10, 10),
    "Blackwood Cliff Chest": (0, 1, 0),
    "Shirley's Point Chest": (1, 2, 2),
    "King Buried Treasure Chest": (0, 1, 0),
    "Good Creek Path Buried Chest": (0, 1, 0),
    "Good Creek Path West Chest": (0, 1, 0),
    "Good Creek Path East Chest": (0, 1, 0),
    "Stone Tower West Cliff Chest": (0, 1, 0),
    "Bucket Path Chest": (0, 1, 0),
    "Bucket Cliff Chest": (3, 5, 5),
    "In Her Shadow Buried Treasure Chest": (0, 1, 0),
    "Meteor Lake Buried Chest": (0, 1, 0),
    "Meteor Lake Chest": (0, 1, 0),
    "West River Waterfall Head Chest": (0, 1, 0),
    "Old Building Chest": (0, 1, 0),
    "Old Building West Chest": (0, 1, 0),
    "Old Building East Chest": (0, 1, 0),
    "Hawk Peak West Chest": (3, 5, 5),
    "Hawk Peak East Buried Chest": (3, 5, 5),
    "Hawk Peak Northeast Chest": (3, 5, 5),
    "Northern East Coast Chest": (0, 2, 0),
    "North Coast Chest": (0, 1, 0),
    "Secret Island Treehouse Chest": (1, 1, 1),
    "Orange Islands North Buried Chest": (1, 1, 0),
    "Orange Islands Ruins Buried Chest": (2, 4, 0),
    "Lighthouse Race Reward": (2, 3, 1),
    "Old Building Race Reward": (1, 5, 0),
    "Hawk Peak Race Reward": (7, 9, 7),
}


class ShortHikeExportHandler(GenericGameExportHandler):
    """Export handler for A Short Hike.

    Handles option-dependent golden feather rules by exporting them as
    Conditional rules that check the golden_feather_progression option.
    """

    GAME_NAME = 'A Short Hike'

    def __init__(self, world=None):
        super().__init__(world)
        self._current_location_name = None
        self._golden_feathers_option = None
        self._buckets_option = None
        self._goal_option = None
        if world:
            self._extract_options(world)

    def _extract_options(self, world) -> None:
        """Extract relevant options from the world."""
        try:
            if hasattr(world, 'options'):
                if hasattr(world.options, 'golden_feathers'):
                    self._golden_feathers_option = int(world.options.golden_feathers.value)
                if hasattr(world.options, 'buckets'):
                    self._buckets_option = int(world.options.buckets.value)
                if hasattr(world.options, 'goal'):
                    self._goal_option = int(world.options.goal.value)
                logger.debug(f"ShortHike options: feathers={self._golden_feathers_option}, "
                           f"buckets={self._buckets_option}, goal={self._goal_option}")
        except Exception as e:
            logger.debug(f"Could not extract options: {e}")

    def set_location_context(self, location_name: str) -> None:
        """Set the current location being processed for context.

        Called by the exporter when processing location rules.
        """
        self._current_location_name = location_name
        logger.debug(f"ShortHike: Processing location '{location_name}'")

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand A Short Hike-specific rules.

        Converts static golden feather rules to option-dependent Conditional rules.
        Recursively processes composite rules (Or, And) to fix nested Golden Feather rules.
        """
        if not isinstance(rule, dict):
            if isinstance(rule, list):
                return [self.expand_rule(r, _depth) for r in rule]
            return rule

        # Check for Golden Feather item checks that need to be made option-dependent
        expanded = self._expand_golden_feather_rule(rule)
        if expanded is not None:
            return expanded

        # Recursively process composite rules to fix nested Golden Feather rules
        rule_type = rule.get('type', '') or rule.get('rule', '')
        if rule_type in ('Or', 'And', 'or', 'and'):
            children = rule.get('children', rule.get('conditions', []))
            if children:
                expanded_children = [self.expand_rule(child, _depth + 1) for child in children]
                result = dict(rule)
                if 'children' in rule:
                    result['children'] = expanded_children
                else:
                    result['conditions'] = expanded_children
                return super().expand_rule(result, _depth)

        # Let parent handle other expansions
        return super().expand_rule(rule, _depth)

    def _expand_golden_feather_rule(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Expand a Golden Feather rule to be option-dependent.

        Detects Has('Golden Feather', N) rules and converts them to Conditional
        rules that check the golden_feather_progression option.
        """
        rule_type = rule.get('type', '') or rule.get('rule', '')

        # Check for item_check or Has rules for Golden Feather
        is_item_check = rule_type == 'item_check'
        is_has = rule_type == 'Has'

        if not (is_item_check or is_has):
            return None

        # Get the item name
        if is_item_check:
            item = rule.get('item', '')
        else:  # is_has
            args = rule.get('args', {})
            item = args.get('item_name', '')

        if item != 'Golden Feather':
            return None

        # Get the current count from the rule
        if is_item_check:
            count_info = rule.get('count', {})
            if isinstance(count_info, dict):
                current_count = count_info.get('value', 1)
            else:
                current_count = count_info if count_info else 1
        else:  # is_has
            args = rule.get('args', {})
            current_count = args.get('count', 1)

        # Look up the location's feather requirements
        if not self._current_location_name:
            logger.debug("ShortHike: No current location context, returning rule as-is")
            return None

        feather_reqs = FEATHER_REQUIREMENTS.get(self._current_location_name)
        if not feather_reqs:
            logger.debug(f"ShortHike: No feather requirements for '{self._current_location_name}'")
            return None

        min_normal, min_easy, min_bucket = feather_reqs

        logger.debug(f"ShortHike: Creating conditional rule for '{self._current_location_name}': "
                    f"normal={min_normal}, easy={min_easy}, bucket={min_bucket}")

        # Build the conditional rule with capping logic.
        # The original game caps min_feathers to golden_feathers when:
        # - min_feathers > golden_feathers (pool size)
        # - AND goal is NOT help_everyone (3) or photo (1)
        #
        # Full logic:
        # if golden_feather_progression == 2 (hard): True_ (no requirement)
        # else:
        #   base_req = easy_count if progression == 0 else normal_count
        #   if goal in {1, 3} (help_everyone, photo): use base_req (no capping)
        #   else: use min(base_req, golden_feathers) (with capping)

        result = self._build_feather_conditional(min_normal, min_easy, min_bucket)

        logger.debug(f"ShortHike: Created conditional rule for '{self._current_location_name}'")
        return result

    def _build_feather_conditional(self, min_normal: int, min_easy: int, min_bucket: int) -> Dict[str, Any]:
        """Build a conditional rule with proper capping logic and bucket alternative.

        The rule checks:
        1. If hard mode: no requirement
        2. If goal is help_everyone or photo: use base requirement (no capping)
        3. Otherwise: use min(base_requirement, golden_feathers)
        4. If buckets > 0 and bucket_count < base_count: add bucket alternative
        """
        def make_has_rule(count: int) -> Dict[str, Any]:
            if count <= 0:
                return {'rule': 'True_'}
            return {
                'rule': 'Has',
                'args': {
                    'item_name': 'Golden Feather',
                    'count': count
                }
            }

        def make_capped_rule(base_count: int) -> Dict[str, Any]:
            """Create a rule that caps the requirement to golden_feathers when needed."""
            if base_count <= 0:
                return {'rule': 'True_'}

            # if base_count > golden_feathers: Has(golden_feathers) else Has(base_count)
            return {
                'rule': 'Conditional',
                'args': {
                    'test': {
                        'rule': 'Compare',
                        'args': {
                            'left': {'type': 'constant', 'value': base_count},
                            'op': '>',
                            'right': {'rule': 'OptionValue', 'args': {'option': 'golden_feathers'}}
                        }
                    },
                    'if_true': {
                        'rule': 'Has',
                        'args': {
                            'item_name': 'Golden Feather',
                            'count': {'rule': 'OptionValue', 'args': {'option': 'golden_feathers'}}
                        }
                    },
                    'if_false': make_has_rule(base_count)
                }
            }

        def make_capped_or_base_rule(base_count: int) -> Dict[str, Any]:
            """Create a rule that applies capping based on goal option."""
            if base_count <= 0:
                return {'rule': 'True_'}

            # if goal in {1, 3} (photo, help_everyone): no capping
            # else: apply capping
            return {
                'rule': 'Conditional',
                'args': {
                    'test': {
                        'rule': 'Or',
                        'children': [
                            {
                                'rule': 'Compare',
                                'args': {
                                    'left': {'rule': 'OptionValue', 'args': {'option': 'goal'}},
                                    'op': '==',
                                    'right': {'type': 'constant', 'value': 1}  # photo
                                }
                            },
                            {
                                'rule': 'Compare',
                                'args': {
                                    'left': {'rule': 'OptionValue', 'args': {'option': 'goal'}},
                                    'op': '==',
                                    'right': {'type': 'constant', 'value': 3}  # help_everyone
                                }
                            }
                        ]
                    },
                    'if_true': make_has_rule(base_count),  # no capping for these goals
                    'if_false': make_capped_rule(base_count)  # apply capping
                }
            }

        def make_with_bucket_alternative(base_count: int, bucket_count: int) -> Dict[str, Any]:
            """Create a rule with bucket alternative if applicable.

            If bucket_count < base_count, adds an Or alternative:
            feather_rule OR (Has(Bucket) AND Has(Golden Feather, bucket_count))

            The bucket alternative only applies when buckets > 0 (runtime check).
            Note: bucket feather count is NOT subject to capping.
            """
            feather_rule = make_capped_or_base_rule(base_count)

            # If bucket_count >= base_count, bucket alternative doesn't help
            if bucket_count >= base_count:
                return feather_rule

            # bucket_count < base_count, so bucket alternative applies when buckets > 0
            bucket_feather_rule = make_has_rule(bucket_count)  # No capping for bucket route

            bucket_alternative = {
                'rule': 'Or',
                'children': [
                    feather_rule,
                    {
                        'rule': 'And',
                        'children': [
                            {'rule': 'Has', 'args': {'item_name': 'Bucket', 'count': 1}},
                            bucket_feather_rule
                        ]
                    }
                ]
            }

            return {
                'rule': 'Conditional',
                'args': {
                    'test': {
                        'rule': 'Compare',
                        'args': {
                            'left': {'rule': 'OptionValue', 'args': {'option': 'buckets'}},
                            'op': '>',
                            'right': {'type': 'constant', 'value': 0}
                        }
                    },
                    'if_true': bucket_alternative,
                    'if_false': feather_rule
                }
            }

        # Main structure:
        # if hard: True_
        # else: check easy/normal and apply capping logic with bucket alternative
        return {
            'rule': 'Conditional',
            'args': {
                'test': {
                    'rule': 'Compare',
                    'args': {
                        'left': {'rule': 'OptionValue', 'args': {'option': 'golden_feather_progression'}},
                        'op': '==',
                        'right': {'type': 'constant', 'value': 2}  # hard
                    }
                },
                'if_true': {'rule': 'True_'},  # hard mode: no feather requirement
                'if_false': {
                    'rule': 'Conditional',
                    'args': {
                        'test': {
                            'rule': 'Compare',
                            'args': {
                                'left': {'rule': 'OptionValue', 'args': {'option': 'golden_feather_progression'}},
                                'op': '==',
                                'right': {'type': 'constant', 'value': 0}  # easy
                            }
                        },
                        'if_true': make_with_bucket_alternative(min_easy, min_bucket),
                        'if_false': make_with_bucket_alternative(min_normal, min_bucket)  # normal mode
                    }
                }
            }
        }
