"""Timespinner game-specific export handler."""

from .generic import GenericGameExportHandler
from typing import Any, Dict


class TimespinnerGameExportHandler(GenericGameExportHandler):
    """Export handler for Timespinner.

    Exports helper function definitions from TimespinnerLogic class.
    All helpers are automatically exported and evaluated by the frontend.
    """


    # Module containing helper functions
    HELPER_MODULES = ['worlds.timespinner.LogicExtensions']

    def replace_name(self, name: str) -> str:
        """Replace variable names with their world equivalents."""
        # 'flooded' is a local variable that references precalculated_weights
        if name == 'flooded':
            return 'precalculated_weights'
        # Keep 'self' as-is so frontend can resolve self.flag_* to settings
        return name

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export Timespinner-specific settings including option flags and warp unlocks."""
        # Get base settings (this also loads _worldgen_settings.json for worldgen worlds)
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Export option flags needed by helper functions
        # Use flag_ prefix to match TimespinnerLogic attribute names (e.g., self.flag_specific_keycards)
        # For worldgen worlds, these flags are already loaded from _worldgen_settings.json by the base handler
        if hasattr(world, 'options'):
            options = world.options
            # Only set flags if the options exist (original Timespinner world)
            # Worldgen worlds have different options and get their flags from _worldgen_settings.json
            if hasattr(options, 'specific_keycards'):
                settings_dict['flag_specific_keycards'] = bool(getattr(options.specific_keycards, 'value', False))
            if hasattr(options, 'eye_spy'):
                settings_dict['flag_eye_spy'] = bool(getattr(options.eye_spy, 'value', False))
            if hasattr(options, 'unchained_keys'):
                settings_dict['flag_unchained_keys'] = bool(getattr(options.unchained_keys, 'value', False))
            if hasattr(options, 'prism_break'):
                settings_dict['flag_prism_break'] = bool(getattr(options.prism_break, 'value', False))

        # Export precalculated weights (warp gate unlocks)
        if hasattr(world, 'precalculated_weights'):
            weights = world.precalculated_weights
            settings_dict['pyramid_keys_unlock'] = getattr(weights, 'pyramid_keys_unlock', None)
            settings_dict['present_keys_unlock'] = getattr(weights, 'present_key_unlock', None)
            settings_dict['past_keys_unlock'] = getattr(weights, 'past_key_unlock', None)
            settings_dict['time_keys_unlock'] = getattr(weights, 'time_key_unlock', None)

        return settings_dict

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand Timespinner-specific rules with variable name replacements."""
        if not rule:
            return rule

        # Handle name nodes - replace special variable names
        if rule.get('type') == 'name':
            original_name = rule.get('name')
            if original_name:
                new_name = self.replace_name(original_name)
                if new_name != original_name:
                    rule['name'] = new_name

        # Handle attribute nodes - replace names in object references
        if rule.get('type') == 'attribute':
            obj = rule.get('object')
            if isinstance(obj, dict) and obj.get('type') == 'name':
                original_name = obj.get('name')
                if original_name:
                    new_name = self.replace_name(original_name)
                    if new_name != original_name:
                        obj['name'] = new_name

        # Recursively process helper arguments
        if rule.get('type') == 'helper':
            args = rule.get('args', [])
            if args:
                rule['args'] = [self.expand_rule(arg, _depth + 1) if isinstance(arg, dict) else arg for arg in args]
            return rule

        # Recursively check nested conditions
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [
                self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', []) if cond
            ]

        if rule.get('type') == 'not':
            cond = rule.get('condition')
            if cond:
                rule['condition'] = self.expand_rule(cond, _depth + 1)

        return rule
