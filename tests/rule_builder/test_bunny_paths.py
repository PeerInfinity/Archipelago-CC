"""
Tests for BunnyPaths rule type.

This module tests the BunnyPaths rule class which handles pre-computed
bunny access paths for ALttP superbunny-accessible locations in glitch modes.
"""

import pytest
from typing import Dict, Any, List, Set
from unittest.mock import MagicMock, patch

from rule_builder import BunnyPaths, And, Or, Has
from rule_builder import is_ast_format, parse_ast_rule


# Mock world class for tests
class MockWorldClass:
    """Mock world class for testing parse_ast_rule."""
    game = "Test Game"

    @classmethod
    def get_rule_cls(cls, name):
        """Return default rule class lookup."""
        from rule_builder.rules import CustomRuleRegister
        return CustomRuleRegister.get_rule_cls(cls.game, name)


class MockEntrance:
    """Mock entrance for instantiation tests."""
    def __init__(self, name: str, parent_region_name: str = None):
        self.name = name
        self.parent_region = MagicMock()
        self.parent_region.name = parent_region_name


class MockWorld:
    """Mock world for instantiation tests."""
    def __init__(self, entrances: Dict[str, MockEntrance] = None):
        self.player = 1
        self.rule_caching_enabled = False
        self._entrances = entrances or {}

    def get_entrance(self, name: str) -> MockEntrance:
        if name in self._entrances:
            return self._entrances[name]
        raise KeyError(f"Entrance {name} not found")


class MockState:
    """Mock state for evaluation tests."""
    def __init__(self, items: Dict[str, int] = None, reachable_entrances: Set[str] = None):
        self.items = items or {}
        self.reachable_entrances = reachable_entrances or set()

    def has(self, item: str, player: int, count: int = 1) -> bool:
        return self.items.get(item, 0) >= count

    def can_reach_entrance(self, entrance_name: str, player: int) -> bool:
        return entrance_name in self.reachable_entrances


class TestBunnyPathsSerialization:
    """Tests for BunnyPaths serialization."""

    def test_to_dict_empty_options(self):
        """Test serializing BunnyPaths with no options."""
        rule = BunnyPaths(path_options=[])
        result = rule.to_dict()

        assert result.get("rule") == "BunnyPaths"
        assert result.get("args", {}).get("path_options") == []

    def test_to_dict_direct_option(self):
        """Test serializing BunnyPaths with direct option."""
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']}
        ])
        result = rule.to_dict()

        assert result.get("rule") == "BunnyPaths"
        options = result.get("args", {}).get("path_options", [])
        assert len(options) == 1
        assert options[0]['type'] == 'direct'
        assert options[0]['requires'] == ['Moon Pearl']

    def test_to_dict_path_option(self):
        """Test serializing BunnyPaths with path option."""
        rule = BunnyPaths(path_options=[
            {
                'type': 'path',
                'via_entrance': 'Test Entrance',
                'via_region': 'Test Region',
                'requires': ['Magic Mirror'],
                'is_superbunny': True
            }
        ])
        result = rule.to_dict()

        assert result.get("rule") == "BunnyPaths"
        options = result.get("args", {}).get("path_options", [])
        assert len(options) == 1
        assert options[0]['type'] == 'path'
        assert options[0]['via_entrance'] == 'Test Entrance'
        assert options[0]['requires'] == ['Magic Mirror']

    def test_to_dict_multiple_options(self):
        """Test serializing BunnyPaths with multiple options."""
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'path', 'via_entrance': 'Entrance A', 'requires': ['Magic Mirror']},
            {'type': 'path', 'via_entrance': 'Entrance B', 'requires': ['Magic Mirror', 'Pegasus Boots']},
        ])
        result = rule.to_dict()

        options = result.get("args", {}).get("path_options", [])
        assert len(options) == 3


class TestBunnyPathsDeserialization:
    """Tests for BunnyPaths deserialization."""

    def test_from_dict_with_options_key(self):
        """Test deserializing with 'options' key (legacy format)."""
        data = {
            "rule": "BunnyPaths",
            "options": [
                {'type': 'direct', 'requires': ['Moon Pearl']}
            ]
        }
        rule = BunnyPaths.from_dict(data, None)

        assert isinstance(rule, BunnyPaths)
        assert len(rule.path_options) == 1
        assert rule.path_options[0]['type'] == 'direct'

    def test_from_dict_with_args_options(self):
        """Test deserializing with 'args.options' key."""
        data = {
            "rule": "BunnyPaths",
            "args": {
                "options": [
                    {'type': 'path', 'via_entrance': 'Test', 'requires': ['Magic Mirror']}
                ]
            }
        }
        rule = BunnyPaths.from_dict(data, None)

        assert isinstance(rule, BunnyPaths)
        assert len(rule.path_options) == 1
        assert rule.path_options[0]['type'] == 'path'

    def test_from_dict_empty(self):
        """Test deserializing with no options."""
        data = {"rule": "BunnyPaths"}
        rule = BunnyPaths.from_dict(data, None)

        assert isinstance(rule, BunnyPaths)
        assert len(rule.path_options) == 0


class TestBunnyPathsAstFormat:
    """Tests for parsing BunnyPaths from AST format."""

    def test_parse_bunny_paths_ast(self):
        """Test parsing bunny_paths type from AST format."""
        data = {
            "type": "bunny_paths",
            "options": [
                {'type': 'direct', 'requires': ['Moon Pearl']},
                {'type': 'path', 'via_entrance': 'Test Entrance', 'requires': ['Magic Mirror']}
            ]
        }
        rule = parse_ast_rule(data, MockWorldClass)

        assert isinstance(rule, BunnyPaths)
        assert len(rule.path_options) == 2

    def test_is_ast_format_bunny_paths(self):
        """Test that bunny_paths is detected as AST format."""
        data = {"type": "bunny_paths", "options": []}
        assert is_ast_format(data) is True


class TestBunnyPathsInstantiation:
    """Tests for BunnyPaths instantiation with a world."""

    def test_instantiate_with_existing_entrance(self):
        """Test instantiation resolves existing entrances."""
        world = MockWorld(entrances={
            'Test Entrance': MockEntrance('Test Entrance', 'Test Region')
        })

        rule = BunnyPaths(path_options=[
            {'type': 'path', 'via_entrance': 'Test Entrance', 'requires': ['Magic Mirror']}
        ])

        resolved = rule._instantiate(world)

        assert resolved.path_options[0].get('_entrance_exists') is True
        assert resolved.path_options[0].get('_parent_region') == 'Test Region'

    def test_instantiate_with_missing_entrance(self):
        """Test instantiation marks missing entrances."""
        world = MockWorld(entrances={})

        rule = BunnyPaths(path_options=[
            {'type': 'path', 'via_entrance': 'Missing Entrance', 'requires': ['Magic Mirror']}
        ])

        resolved = rule._instantiate(world)

        assert resolved.path_options[0].get('_entrance_exists') is False

    def test_instantiate_direct_option(self):
        """Test instantiation of direct options (no entrance lookup)."""
        world = MockWorld()

        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']}
        ])

        resolved = rule._instantiate(world)

        # Direct options shouldn't have entrance fields
        assert '_entrance_exists' not in resolved.path_options[0]


class TestBunnyPathsEvaluation:
    """Tests for BunnyPaths rule evaluation."""

    def test_evaluate_direct_option_with_item(self):
        """Test evaluation of direct option when player has required item."""
        world = MockWorld()
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']}
        ])
        resolved = rule._instantiate(world)

        state = MockState(items={'Moon Pearl': 1})
        assert resolved._evaluate(state) is True

    def test_evaluate_direct_option_without_item(self):
        """Test evaluation of direct option when player lacks required item."""
        world = MockWorld()
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']}
        ])
        resolved = rule._instantiate(world)

        state = MockState(items={})
        assert resolved._evaluate(state) is False

    def test_evaluate_path_option_success(self):
        """Test evaluation of path option with items and reachable entrance."""
        world = MockWorld(entrances={
            'Test Entrance': MockEntrance('Test Entrance', 'Test Region')
        })
        rule = BunnyPaths(path_options=[
            {'type': 'path', 'via_entrance': 'Test Entrance', 'requires': ['Magic Mirror']}
        ])
        resolved = rule._instantiate(world)

        state = MockState(
            items={'Magic Mirror': 1},
            reachable_entrances={'Test Entrance'}
        )
        assert resolved._evaluate(state) is True

    def test_evaluate_path_option_missing_item(self):
        """Test evaluation of path option when missing required item."""
        world = MockWorld(entrances={
            'Test Entrance': MockEntrance('Test Entrance', 'Test Region')
        })
        rule = BunnyPaths(path_options=[
            {'type': 'path', 'via_entrance': 'Test Entrance', 'requires': ['Magic Mirror']}
        ])
        resolved = rule._instantiate(world)

        state = MockState(
            items={},
            reachable_entrances={'Test Entrance'}
        )
        assert resolved._evaluate(state) is False

    def test_evaluate_path_option_unreachable_entrance(self):
        """Test evaluation of path option when entrance is unreachable."""
        world = MockWorld(entrances={
            'Test Entrance': MockEntrance('Test Entrance', 'Test Region')
        })
        rule = BunnyPaths(path_options=[
            {'type': 'path', 'via_entrance': 'Test Entrance', 'requires': ['Magic Mirror']}
        ])
        resolved = rule._instantiate(world)

        state = MockState(
            items={'Magic Mirror': 1},
            reachable_entrances=set()  # Entrance not reachable
        )
        assert resolved._evaluate(state) is False

    def test_evaluate_path_option_nonexistent_entrance(self):
        """Test evaluation of path option when entrance doesn't exist."""
        world = MockWorld(entrances={})  # No entrances
        rule = BunnyPaths(path_options=[
            {'type': 'path', 'via_entrance': 'Missing Entrance', 'requires': ['Magic Mirror']}
        ])
        resolved = rule._instantiate(world)

        state = MockState(items={'Magic Mirror': 1})
        # Should return False because entrance doesn't exist
        assert resolved._evaluate(state) is False

    def test_evaluate_multiple_options_first_succeeds(self):
        """Test that evaluation returns True if first option succeeds."""
        world = MockWorld()
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'direct', 'requires': ['Magic Mirror']},
        ])
        resolved = rule._instantiate(world)

        state = MockState(items={'Moon Pearl': 1})
        assert resolved._evaluate(state) is True

    def test_evaluate_multiple_options_second_succeeds(self):
        """Test that evaluation returns True if second option succeeds."""
        world = MockWorld()
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'direct', 'requires': ['Magic Mirror']},
        ])
        resolved = rule._instantiate(world)

        state = MockState(items={'Magic Mirror': 1})
        assert resolved._evaluate(state) is True

    def test_evaluate_multiple_options_none_succeed(self):
        """Test that evaluation returns False if no options succeed."""
        world = MockWorld()
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'direct', 'requires': ['Magic Mirror']},
        ])
        resolved = rule._instantiate(world)

        state = MockState(items={})
        assert resolved._evaluate(state) is False

    def test_evaluate_multiple_required_items(self):
        """Test evaluation with multiple required items."""
        world = MockWorld()
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Magic Mirror', 'Pegasus Boots']},
        ])
        resolved = rule._instantiate(world)

        # Has only one item
        state = MockState(items={'Magic Mirror': 1})
        assert resolved._evaluate(state) is False

        # Has both items
        state = MockState(items={'Magic Mirror': 1, 'Pegasus Boots': 1})
        assert resolved._evaluate(state) is True


class TestBunnyPathsDependencies:
    """Tests for BunnyPaths dependency tracking."""

    def test_item_dependencies(self):
        """Test that item dependencies are correctly reported."""
        world = MockWorld()
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'path', 'via_entrance': 'Test', 'requires': ['Magic Mirror', 'Pegasus Boots']},
        ])
        resolved = rule._instantiate(world)

        deps = resolved.item_dependencies()

        assert 'Moon Pearl' in deps
        assert 'Magic Mirror' in deps
        assert 'Pegasus Boots' in deps

    def test_entrance_dependencies(self):
        """Test that entrance dependencies are correctly reported."""
        world = MockWorld(entrances={
            'Entrance A': MockEntrance('Entrance A'),
            'Entrance B': MockEntrance('Entrance B'),
        })
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'path', 'via_entrance': 'Entrance A', 'requires': ['Magic Mirror']},
            {'type': 'path', 'via_entrance': 'Entrance B', 'requires': ['Pegasus Boots']},
        ])
        resolved = rule._instantiate(world)

        deps = resolved.entrance_dependencies()

        assert 'Entrance A' in deps
        assert 'Entrance B' in deps
        # Direct option shouldn't add entrance dependency
        assert len(deps) == 2


class TestBunnyPathsStringRepresentation:
    """Tests for BunnyPaths string representation."""

    def test_str_direct_option(self):
        """Test string representation of direct option."""
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']}
        ])

        result = str(rule)
        assert 'BunnyPaths' in result
        assert 'direct' in result
        assert 'Moon Pearl' in result

    def test_str_path_option(self):
        """Test string representation of path option."""
        rule = BunnyPaths(path_options=[
            {'type': 'path', 'via_entrance': 'Test Entrance', 'requires': ['Magic Mirror']}
        ])

        result = str(rule)
        assert 'BunnyPaths' in result
        assert 'path' in result
        assert 'Test Entrance' in result

    def test_str_multiple_options(self):
        """Test string representation with multiple options."""
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'path', 'via_entrance': 'Test', 'requires': ['Magic Mirror']},
        ])

        result = str(rule)
        assert 'OR' in result


class TestBunnyPathsOperators:
    """Tests for BunnyPaths with boolean operators."""

    def test_and_operator(self):
        """Test combining BunnyPaths with & operator."""
        bunny = BunnyPaths(path_options=[{'type': 'direct', 'requires': ['Moon Pearl']}])
        has = Has(item_name="Sword")

        combined = bunny & has
        assert isinstance(combined, And)

    def test_or_operator(self):
        """Test combining BunnyPaths with | operator."""
        bunny = BunnyPaths(path_options=[{'type': 'direct', 'requires': ['Moon Pearl']}])
        has = Has(item_name="Sword")

        combined = bunny | has
        assert isinstance(combined, Or)


class TestBunnyPathsALttPLibrary:
    """Tests for BunnyPaths with ALttP Library-specific cases.

    The Library location in ALttP has a bunny rule that combines:
    - Original rule: Pegasus Boots required
    - Bunny options: Moon Pearl OR superbunny path (via entrance + Magic Mirror)

    The correct structure should be:
        Or(Moon Pearl, And(superbunny_path, Pegasus Boots))
    NOT:
        And(Or(Moon Pearl, superbunny_path), Pegasus Boots)

    These tests verify BunnyPaths evaluation works correctly for this case.
    """

    def test_library_bunny_paths_exact_rule(self):
        """Test the exact BunnyPaths rule generated for Library.

        From ALttP fuzzer output, the rule should be:
        BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'path', 'requires': ['Pegasus Boots', 'Magic Mirror'],
             'via_entrance': 'Bumper Cave (Bottom)', ...}
        ])
        """
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'path', 'requires': ['Pegasus Boots', 'Magic Mirror'],
             'via_entrance': 'Bumper Cave (Bottom)', 'via_region': 'Bumper Cave Entrance',
             'connected_region': 'Library', 'is_superbunny': True}
        ])

        world = MockWorld(entrances={
            'Bumper Cave (Bottom)': MockEntrance('Bumper Cave (Bottom)', 'Bumper Cave Entrance')
        })

        resolved = rule._instantiate(world)

        # Test with Moon Pearl only (should pass via direct option)
        state = MockState(items={'Moon Pearl': 1})
        assert resolved._evaluate(state) is True

    def test_library_direct_option_only(self):
        """Test just the direct option to isolate evaluation."""
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']}
        ])

        world = MockWorld()
        resolved = rule._instantiate(world)

        state = MockState(items={'Moon Pearl': 1})
        assert resolved._evaluate(state) is True

    def test_library_path_option_with_boots(self):
        """Test path option requires both entrance and items."""
        rule = BunnyPaths(path_options=[
            {'type': 'direct', 'requires': ['Moon Pearl']},
            {'type': 'path', 'requires': ['Pegasus Boots', 'Magic Mirror'],
             'via_entrance': 'Bumper Cave (Bottom)'}
        ])

        world = MockWorld(entrances={
            'Bumper Cave (Bottom)': MockEntrance('Bumper Cave (Bottom)', 'Bumper Cave Entrance')
        })
        resolved = rule._instantiate(world)

        # Has boots and mirror but no entrance access - should fail
        state = MockState(
            items={'Pegasus Boots': 1, 'Magic Mirror': 1},
            reachable_entrances=set()
        )
        assert resolved._evaluate(state) is False

        # Has boots, mirror, AND entrance access - should pass
        state = MockState(
            items={'Pegasus Boots': 1, 'Magic Mirror': 1},
            reachable_entrances={'Bumper Cave (Bottom)'}
        )
        assert resolved._evaluate(state) is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
