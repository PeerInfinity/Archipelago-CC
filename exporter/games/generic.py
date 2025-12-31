"""Generic fallback helper expander.

This is the recommended base class for new game export handlers.

GenericGameExportHandler extends BaseGameExportHandler with:
- Intelligent rule analysis that attempts to infer meaning from patterns
- Recognition of common helper naming patterns (has_*, can_*, defeat_*, etc.)
- Special handling for __analyzed_func__ and other edge cases
- LogicMixin pattern expansion (_*_has_item, _*_has_region, etc.)
- AUTO_EXPORT_DISCOVERED_HELPERS enabled by default

To create a new game handler, simply inherit from GenericGameExportHandler
and add a GAME_NAME class attribute:

    class MyGameExportHandler(GenericGameExportHandler):
        GAME_NAME = 'My Game Name'

        # Override methods only when you need custom behavior:
        # def expand_rule(self, rule):
        #     # Custom rule handling
        #     return super().expand_rule(rule)

The handler will be automatically discovered and registered.
"""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
from exporter.constants import MAX_RULE_EXPANSION_DEPTH
import re
import logging

logger = logging.getLogger(__name__)

class GenericGameExportHandler(BaseGameExportHandler):
    """Fallback expander that intelligently handles game-specific rules.

    This is the recommended base class for new game export handlers.
    Provides intelligent defaults for rule analysis, item discovery, and helper expansion.

    By default, AUTO_EXPORT_DISCOVERED_HELPERS is enabled. Override with False
    if your game has complex helpers that can't be automatically exported.
    """

    # Enable automatic helper export by default for GenericGameExportHandler
    # Most games benefit from this. Override with False if needed.
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    def expand_helper(self, helper_name: str, args: List[Any] = None):
        # Let base class handle CONSTANT_HELPER_EXPANSIONS first
        base_result = super().expand_helper(helper_name, args)
        if base_result is not None:
            return base_result
        return None  # Preserve helper nodes as-is
        
    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand rule functions with intelligent analysis."""
        if _depth > MAX_RULE_EXPANSION_DEPTH:
            logging.error(f"GenericGameExportHandler.expand_rule: Max depth ({MAX_RULE_EXPANSION_DEPTH}) exceeded. "
                         f"Rule type: {rule.get('type') if rule else 'None'}")
            return {'type': 'error', 'message': f'Max expansion depth ({MAX_RULE_EXPANSION_DEPTH}) exceeded'}

        if not rule:
            return rule

        # Special handling for __analyzed_func__ - try to extract meaningful information
        if rule.get('type') == 'state_method' and rule.get('method') == '__analyzed_func__':
            # Try to extract more detailed information from original rule if available
            if 'original' in rule:
                return self._analyze_original_rule(rule['original'])

            # Attempt to infer rule type from any available information
            return self._infer_rule_type(rule)

        # Special handling for helper nodes with common pattern names
        # Skip expansion if the helper should be preserved (game explicitly wants it as a helper call)
        # Also skip if the helper was auto-preserved due to HELPER_INLINE_THRESHOLD
        if rule.get('type') == 'helper':
            helper_name = rule.get('name', '')
            # Check if helper was auto-preserved or explicitly preserved
            is_auto_preserved = (hasattr(self, 'is_auto_preserved_helper') and
                                 self.is_auto_preserved_helper(helper_name))
            if not is_auto_preserved and not self.should_preserve_as_helper(helper_name) and self._is_common_helper_pattern(helper_name):
                return self._expand_common_helper(helper_name, rule.get('args', []))

        # Standard processing from base class
        rule_type = rule.get('type')
        if rule_type == 'helper':
            expanded = self.expand_helper(rule['name'], rule.get('args', []))
            if expanded:
                # Recursively expand the result in case it contains nested helper calls
                return self.expand_rule(expanded, _depth + 1)
            return rule

        # Handle helper type in RB format: {'rule': 'helper_name', '_original_ast_type': 'helper', 'args': [...]}
        if rule.get('_original_ast_type') == 'helper':
            helper_name = rule.get('rule', '')
            if helper_name:
                expanded = self.expand_helper(helper_name, rule.get('args', []))
                if expanded:
                    return self.expand_rule(expanded, _depth + 1)

        # Use base class for compound rules and other transformations
        # (f-string resolution, name remapping, settings conversion, etc.)
        return self._recursively_expand_rule_children(rule, _depth)
    
    def _analyze_original_rule(self, original_rule):
        """
        Attempt to analyze the original rule structure before it became __analyzed_func__.
        This can sometimes extract more information.
        """
        # Look for state method calls in the original rule
        if original_rule.get('type') == 'state_method':
            method = original_rule.get('method', '')
            args = original_rule.get('args', [])
            
            # Handle 'has' method for item requirements
            if method == 'has' and len(args) >= 1:
                return {
                    'type': 'item_check',
                    'item': args[0]
                }
                
            # Handle other known state methods
            if method in ['can_reach', 'has_group', 'has_any']:
                return {
                    'type': 'game_specific_check',
                    'method': method,
                    'args': args,
                    'description': f"Requires {method}({', '.join(str(a) for a in args)})"
                }
        
        return {
            'type': 'generic_rule',
            'description': 'Game-specific rule',
            'details': 'This rule could not be fully analyzed due to game-specific implementation'
        }
    
    def _infer_rule_type(self, rule):
        """
        Attempt to infer rule type based on context clues.
        Handles cases where original rule data is not available.
        """
        args = rule.get('args', [])
        
        # Look for keywords in rule name or source code if available
        rule_str = str(rule)
        
        # Item check patterns
        if 'has(' in rule_str.lower() or 'state.has' in rule_str.lower():
            item_match = re.search(r"has\(['\"](.*?)['\"]\s*,", rule_str)
            if item_match:
                return {
                    'type': 'item_check',
                    'item': item_match.group(1),
                    'inferred': True
                }
        
        # Location access patterns
        if 'can_reach' in rule_str.lower():
            return {
                'type': 'can_reach',
                'inferred': True,
                'description': 'Requires reaching a specific location'
            }
        
        # Return a more descriptive generic rule
        return {
            'type': 'generic_rule',
            'description': 'Game-specific rule',
            'details': 'This rule could not be fully analyzed but may involve item requirements'
        }
    
    def _is_common_helper_pattern(self, helper_name):
        """
        Check if a helper name matches common naming patterns across games.
        """
        common_patterns = [
            # Item access patterns
            r'^has_.*',
            r'^can_use_.*',
            r'^can_access_.*',
            r'^can_reach_.*',
            r'^has_access_to_.*',
            # General capability patterns
            r'^can_.*',
            r'^is_.*',
            # Game-specific but common
            r'^slay_.*',
            r'^defeat_.*',
            r'^open_.*',
            r'^unlock_.*',
        ]
        
        for pattern in common_patterns:
            if re.match(pattern, helper_name):
                return True
        return False
    
    def _expand_common_helper(self, helper_name, args):
        """
        Expand common helper functions based on naming convention.
        """
        # Extract the object of the helper (what it applies to)
        parts = helper_name.split('_')
        action = parts[0] if parts else ''
        subject = '_'.join(parts[1:]) if len(parts) > 1 else ''
        
        if not subject:
            return None
            
        # Create appropriate rule based on helper type
        if action == 'has':
            return {
                'type': 'item_check',
                'item': subject.title(),
                'inferred': True,
                'description': f"Requires having {subject.replace('_', ' ').title()}"
            }
        elif action == 'can':
            return {
                'type': 'capability',
                'capability': subject,
                'inferred': True,
                'description': f"Requires ability to {subject.replace('_', ' ')}"
            }
        elif action in ['defeat', 'slay']:
            return {
                'type': 'enemy_requirement',
                'enemy': subject,
                'inferred': True,
                'description': f"Requires defeating {subject.replace('_', ' ').title()}"
            }
            
        # Generic helper description when we can't infer more
        return {
            'type': 'generic_helper',
            'name': helper_name,
            'args': args,
            'description': f"Requires {helper_name.replace('_', ' ')}"
        }

    def _expand_logic_mixin_patterns(self, method_name: str, args: List[Any]) -> Dict[str, Any]:
        """Expand LogicMixin naming patterns to rule structures.

        Many games define wrapper methods like _game_has_item(player, item) that
        delegate to state.has(). We expand these inline to their underlying rule types.

        Args:
            method_name: The state method name (e.g., '_kh2_has_item')
            args: The method arguments

        Returns:
            A rule dictionary if the pattern was matched, None otherwise
        """
        # Pattern: _*_has_item(player, item) -> item_check
        if method_name.endswith('_has_item') and len(args) >= 1:
            item = args[0]
            item_name = item.get('value') if isinstance(item, dict) else item
            logger.debug(f"Expanding LogicMixin {method_name} to item_check for '{item_name}'")
            return {'type': 'item_check', 'item': item_name}

        # Pattern: _*_has_region(player, region) -> can_reach
        if method_name.endswith('_has_region') and len(args) >= 1:
            region = args[0]
            region_name = region.get('value') if isinstance(region, dict) else region
            logger.debug(f"Expanding LogicMixin {method_name} to can_reach for '{region_name}'")
            return {'type': 'can_reach', 'region': region_name}

        # Pattern: _*_has_item_and_region(player, item, region) -> and(item_check, can_reach)
        if method_name.endswith('_has_item_and_region') and len(args) >= 2:
            item = args[0]
            region = args[1]
            item_name = item.get('value') if isinstance(item, dict) else item
            region_name = region.get('value') if isinstance(region, dict) else region
            logger.debug(f"Expanding LogicMixin {method_name} to and(item_check, can_reach)")
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'item_check', 'item': item_name},
                    {'type': 'can_reach', 'region': region_name}
                ]
            }

        return None