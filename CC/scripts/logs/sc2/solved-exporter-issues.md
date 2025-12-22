# Starcraft 2 - Solved Exporter Issues

Last updated: 2025-12-22

## Summary
This document tracks exporter issues that have been resolved.

## Solved Issues

### 1. SC2 Mission Entry Rules Export

**Issue:** SC2 uses complex entry rule patterns (CountMissionsEntryRule, SubRuleEntryRule, BeatMissionsEntryRule) that the generic analyzer couldn't handle.

**Solution:** Implemented `override_rule_analysis()` in `exporter/games/sc2.py` to:
- Handle `count_missions` closures from CountMissionsEntryRule
- Handle `count_rules` closures from SubRuleEntryRule
- Handle lambda patterns from BeatMissionsEntryRule
- Convert these to `count_true` rule type for frontend evaluation

**Files Modified:**
- `exporter/games/sc2.py`

---

### 2. Logic Object Method/Attribute Resolution

**Issue:** SC2 rules reference a "logic" object (e.g., `logic.terran_early_tech()`, `logic.advanced_tactics`) that needed proper resolution.

**Solution:** Implemented `expand_rule()` in SC2 exporter to:
- Convert `logic.method_name()` calls to helper calls
- Resolve `logic.attribute_name` and `self.attribute_name` to settings values
- Handle known helper method names separately from computed settings

**Files Modified:**
- `exporter/games/sc2.py`

---

### 3. Rating Dictionary Export

**Issue:** SC2 defense_rating and power_rating helpers need access to rating dictionaries (tvx_defense_ratings, etc.) at runtime.

**Solution:** Implemented `get_game_info()` to export rating dictionaries:
- Export 13 rating dictionaries to `game_info.rating_tables`
- Export kerrigan item groups to `game_info.kerrigan_groups`

**Files Modified:**
- `exporter/games/sc2.py`

---

### 4. Complex Helper Blacklisting

**Issue:** Some SC2 helpers are too complex for automatic export (loops, closures, external module dependencies).

**Solution:** Added `HELPERS_TO_EXPORT_BLACKLIST` with helpers that:
- Use `get_full_item_list()` or other unavailable methods
- Have complex iteration with break statements
- Call other blacklisted helpers

Blacklisted helpers return `True_` to avoid blocking progression.

**Files Modified:**
- `exporter/games/sc2.py`

---

### 5. Settings Export for Logic Properties

**Issue:** SC2 rules depend on computed logic properties (advanced_tactics, basic_terran_units, etc.) that are derived from world options.

**Solution:** Implemented `get_settings_data()` to export:
- All SC2 options from `world.options`
- Computed logic properties (advanced_tactics, story_tech_granted, etc.)
- Unit lists computed from required_tactics option

**Files Modified:**
- `exporter/games/sc2.py`
