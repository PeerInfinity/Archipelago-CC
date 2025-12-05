#!/usr/bin/env python3
"""
Test script for CC format native parsing in Rule Builder.

This script loads a rules.json file (in CC format) and tests that the
Rule Builder can parse the rules directly without conversion.
"""

import json
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from rule_builder import (
    RuleWorldMixin, is_cc_format, parse_cc_rule,
    Has, HasAll, HasAny, And, Or, True_, False_,
    CanReachRegion, CanReachLocation, CanReachEntrance,
    HasGroup, HasGroupUnique,
)


def test_basic_cc_parsing():
    """Test basic CC format rule parsing."""
    print("Testing basic CC format parsing...")

    # Test constant rules
    true_rule = parse_cc_rule({"type": "constant", "value": True}, RuleWorldMixin)
    assert isinstance(true_rule, True_), f"Expected True_, got {type(true_rule)}"
    print("  ✓ constant (true)")

    false_rule = parse_cc_rule({"type": "constant", "value": False}, RuleWorldMixin)
    assert isinstance(false_rule, False_), f"Expected False_, got {type(false_rule)}"
    print("  ✓ constant (false)")

    # Test item_check
    item_rule = parse_cc_rule({"type": "item_check", "item": "Sword"}, RuleWorldMixin)
    assert isinstance(item_rule, Has), f"Expected Has, got {type(item_rule)}"
    assert item_rule.item_name == "Sword", f"Expected 'Sword', got '{item_rule.item_name}'"
    assert item_rule.count == 1, f"Expected count=1, got count={item_rule.count}"
    print("  ✓ item_check")

    # Test item_check with count
    item_rule2 = parse_cc_rule({"type": "item_check", "item": "Arrow", "count": 10}, RuleWorldMixin)
    assert isinstance(item_rule2, Has), f"Expected Has, got {type(item_rule2)}"
    assert item_rule2.count == 10, f"Expected count=10, got count={item_rule2.count}"
    print("  ✓ item_check with count")

    # Test item_check with nested constant count (used by some games like Bumper Stickers)
    item_rule3 = parse_cc_rule({
        "type": "item_check",
        "item": "Booster Bumper",
        "count": {"type": "constant", "value": 5}
    }, RuleWorldMixin)
    assert isinstance(item_rule3, Has), f"Expected Has, got {type(item_rule3)}"
    assert item_rule3.count == 5, f"Expected count=5, got count={item_rule3.count}"
    print("  ✓ item_check with nested constant count")

    # Test group_check
    group_rule = parse_cc_rule({"type": "group_check", "group": "Keys", "count": 3}, RuleWorldMixin)
    assert isinstance(group_rule, HasGroup), f"Expected HasGroup, got {type(group_rule)}"
    assert group_rule.item_name_group == "Keys", f"Expected 'Keys', got '{group_rule.item_name_group}'"
    print("  ✓ group_check")

    # Test can_reach
    reach_rule = parse_cc_rule({"type": "can_reach", "region": "Castle"}, RuleWorldMixin)
    assert isinstance(reach_rule, CanReachRegion), f"Expected CanReachRegion, got {type(reach_rule)}"
    assert reach_rule.region_name == "Castle", f"Expected 'Castle', got '{reach_rule.region_name}'"
    print("  ✓ can_reach")

    # Test location_check
    loc_rule = parse_cc_rule({"type": "location_check", "location": "Chest1"}, RuleWorldMixin)
    assert isinstance(loc_rule, CanReachLocation), f"Expected CanReachLocation, got {type(loc_rule)}"
    print("  ✓ location_check")

    # Test can_reach_entrance
    ent_rule = parse_cc_rule({"type": "can_reach_entrance", "entrance": "Door1"}, RuleWorldMixin)
    assert isinstance(ent_rule, CanReachEntrance), f"Expected CanReachEntrance, got {type(ent_rule)}"
    print("  ✓ can_reach_entrance")

    print("Basic CC parsing tests passed!\n")


def test_composite_rules():
    """Test composite rule parsing (and/or)."""
    print("Testing composite rule parsing...")

    # Test AND
    and_rule = parse_cc_rule({
        "type": "and",
        "conditions": [
            {"type": "item_check", "item": "Sword"},
            {"type": "item_check", "item": "Shield"}
        ]
    }, RuleWorldMixin)
    assert isinstance(and_rule, And), f"Expected And, got {type(and_rule)}"
    assert len(and_rule.children) == 2, f"Expected 2 children, got {len(and_rule.children)}"
    print("  ✓ and rule")

    # Test OR
    or_rule = parse_cc_rule({
        "type": "or",
        "conditions": [
            {"type": "item_check", "item": "Sword"},
            {"type": "item_check", "item": "Axe"}
        ]
    }, RuleWorldMixin)
    assert isinstance(or_rule, Or), f"Expected Or, got {type(or_rule)}"
    assert len(or_rule.children) == 2, f"Expected 2 children, got {len(or_rule.children)}"
    print("  ✓ or rule")

    # Test nested
    nested_rule = parse_cc_rule({
        "type": "and",
        "conditions": [
            {"type": "item_check", "item": "Key"},
            {
                "type": "or",
                "conditions": [
                    {"type": "item_check", "item": "Sword"},
                    {"type": "item_check", "item": "Bow"}
                ]
            }
        ]
    }, RuleWorldMixin)
    assert isinstance(nested_rule, And), f"Expected And, got {type(nested_rule)}"
    assert isinstance(nested_rule.children[1], Or), f"Expected nested Or, got {type(nested_rule.children[1])}"
    print("  ✓ nested rules")

    print("Composite rule tests passed!\n")


def test_state_methods():
    """Test state_method rule parsing."""
    print("Testing state_method parsing...")

    # Test has_all
    has_all_rule = parse_cc_rule({
        "type": "state_method",
        "method": "has_all",
        "args": [{"type": "constant", "value": ["Key1", "Key2", "Key3"]}]
    }, RuleWorldMixin)
    assert isinstance(has_all_rule, HasAll), f"Expected HasAll, got {type(has_all_rule)}"
    print("  ✓ has_all")

    # Test has_any
    has_any_rule = parse_cc_rule({
        "type": "state_method",
        "method": "has_any",
        "args": [{"type": "constant", "value": ["Sword", "Axe"]}]
    }, RuleWorldMixin)
    assert isinstance(has_any_rule, HasAny), f"Expected HasAny, got {type(has_any_rule)}"
    print("  ✓ has_any")

    print("State method tests passed!\n")


def test_rules_json_file(rules_json_path: Path):
    """Test parsing a real rules.json file."""
    print(f"Testing rules.json file: {rules_json_path}")

    with open(rules_json_path) as f:
        data = json.load(f)

    game_name = data.get('game_name', 'Unknown')
    print(f"  Game: {game_name}")

    # Count rules parsed
    total_rules = 0
    successful_rules = 0
    failed_rules = []

    # Parse all access_rules in regions
    regions = data.get('regions', {})
    for player_id, player_regions in regions.items():
        for region_name, region_data in player_regions.items():
            # Parse exit rules
            for exit_data in region_data.get('exits', []):
                access_rule = exit_data.get('access_rule')
                if access_rule:
                    total_rules += 1
                    try:
                        rule = parse_cc_rule(access_rule, RuleWorldMixin)
                        successful_rules += 1
                    except Exception as e:
                        failed_rules.append({
                            'type': 'exit',
                            'name': exit_data.get('name', 'unknown'),
                            'rule': access_rule,
                            'error': str(e)
                        })

            # Parse location rules
            for loc_data in region_data.get('locations', []):
                access_rule = loc_data.get('access_rule')
                if access_rule:
                    total_rules += 1
                    try:
                        rule = parse_cc_rule(access_rule, RuleWorldMixin)
                        successful_rules += 1
                    except Exception as e:
                        failed_rules.append({
                            'type': 'location',
                            'name': loc_data.get('name', 'unknown'),
                            'rule': access_rule,
                            'error': str(e)
                        })

    print(f"  Total rules: {total_rules}")
    print(f"  Successfully parsed: {successful_rules}")
    print(f"  Failed: {len(failed_rules)}")

    if failed_rules:
        print("\n  Failed rules:")
        for failure in failed_rules[:5]:  # Show first 5 failures
            print(f"    - {failure['type']} '{failure['name']}': {failure['error']}")
        if len(failed_rules) > 5:
            print(f"    ... and {len(failed_rules) - 5} more")

    success_rate = (successful_rules / total_rules * 100) if total_rules > 0 else 100
    print(f"\n  Success rate: {success_rate:.1f}%")

    return successful_rules == total_rules


def test_rule_from_dict_integration():
    """Test that RuleWorldMixin.rule_from_dict handles CC format."""
    print("Testing RuleWorldMixin.rule_from_dict integration...")

    # Test CC format
    cc_rule = RuleWorldMixin.rule_from_dict({"type": "item_check", "item": "Sword"})
    assert isinstance(cc_rule, Has), f"Expected Has, got {type(cc_rule)}"
    print("  ✓ CC format parsed via rule_from_dict")

    # Note: RB format requires a world subclass with 'game' attribute
    # This is tested via the actual world classes (e.g., Adventure)
    # For direct parsing, use the Rule classes directly:
    rb_rule = Has.from_dict({
        "rule": "Has",
        "options": [],
        "args": {"item_name": "Sword", "count": 1}
    }, RuleWorldMixin)
    assert isinstance(rb_rule, Has), f"Expected Has, got {type(rb_rule)}"
    print("  ✓ RB format works via Has.from_dict")

    print("Integration tests passed!\n")


def main():
    """Run all tests."""
    print("=" * 60)
    print("CC Format Native Parsing Tests")
    print("=" * 60 + "\n")

    # Run basic tests
    test_basic_cc_parsing()
    test_composite_rules()
    test_state_methods()
    test_rule_from_dict_integration()

    # Test with game rules.json files if available
    games_to_test = [
        ("adventure", "Adventure"),
        ("bumpstik", "Bumper Stickers"),
        ("shorthike", "A Short Hike"),
        ("inscryption", "Inscryption"),
    ]

    for game_dir, game_name in games_to_test:
        rules_file = project_root / "frontend" / "presets" / game_dir / "AP_14089154938208861744" / "AP_14089154938208861744_rules.json"
        if rules_file.exists():
            success = test_rules_json_file(rules_file)
            if success:
                print(f"\n✓ All {game_name} rules parsed successfully!")
            else:
                print(f"\n✗ Some {game_name} rules failed to parse")
                return 1
        else:
            print(f"\nNote: {game_name} rules.json not found at {rules_file}")

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
