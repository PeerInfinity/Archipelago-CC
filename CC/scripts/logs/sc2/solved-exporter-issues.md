# Solved SC2 Exporter Issues

## Issue 1: Computed logic properties not exported to settings

**Status:** ✅ SOLVED

**Symptom:**
- Access rules reference `self.story_tech_granted`, `self.advanced_tactics`, etc.
- These properties exist in the Python `SC2Logic` class but weren't in the exported settings
- Settings only contained raw option values like `grant_story_tech: 0`

**Root Cause:**
The exporter's `get_settings_data` method only exported raw option values, not the computed boolean properties from the `SC2Logic` class.

In Python, the logic class computes these values:
```python
self.story_tech_granted = get_option_value(world, "grant_story_tech") == GrantStoryTech.option_true
self.advanced_tactics = self.logic_level != RequiredTactics.option_standard
self.take_over_ai_allies = get_option_value(world, "take_over_ai_allies") == TakeOverAIAllies.option_true
self.kerrigan_unit_available = ...
```

**Solution:**
Updated `exporter/games/sc2.py` to create an `SC2Logic` instance and export its computed properties:

```python
def get_settings_data(self, world, multiworld, player: int) -> Dict[str, Any]:
    """Extract Starcraft 2 settings for export."""
    settings_dict = super().get_settings_data(world, multiworld, player)

    # Export all SC2 options
    if hasattr(world, 'options'):
        for option_name in dir(world.options):
            # Skip private attributes and methods
            if option_name.startswith('_'):
                continue

            option = getattr(world.options, option_name, None)
            if option is None:
                continue

            # Extract the value from the option
            if hasattr(option, 'value'):
                settings_dict[option_name] = option.value
            elif isinstance(option, (bool, int, str, float)):
                settings_dict[option_name] = option

    # Also export computed logic properties that are used in rules
    try:
        from worlds.sc2.Rules import SC2Logic
        logic = SC2Logic(world)

        # Export computed boolean properties that are referenced in access rules
        logic_properties = [
            'advanced_tactics',
            'story_tech_granted',
            'story_levels_granted',
            'take_over_ai_allies',
            'kerrigan_unit_available'
        ]

        for prop_name in logic_properties:
            if hasattr(logic, prop_name):
                prop_value = getattr(logic, prop_name)
                # Only export simple types
                if isinstance(prop_value, (bool, int, str, float)):
                    settings_dict[prop_name] = prop_value
    except Exception as e:
        logger.warning(f"Could not export SC2 logic properties: {e}")

    return settings_dict
```

**Files Modified:**
- `exporter/games/sc2.py`

**Test Results:**
Settings now include computed properties like `"story_tech_granted": false`, `"story_levels_granted": true`, etc.
