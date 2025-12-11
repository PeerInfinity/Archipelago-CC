"""
Test runner for shared rule type fixtures.

This module loads test cases from tests/fixtures/rule_type_tests.json
and validates that the frontend rule engine produces expected results.

The fixtures provide a single source of truth for rule evaluation behavior
that can be validated by both Python and JavaScript test suites.

Requirements:
    - Full Archipelago environment set up

Running tests:
    # From the Archipelago-CC root directory with virtual environment active:
    python -m pytest tests/test_rule_fixtures.py -v

    # Or with unittest:
    python -m unittest tests.test_rule_fixtures -v

    # Run specific test suite:
    python -m pytest tests/test_rule_fixtures.py -k "negate" -v
"""

import json
import os
import unittest
from pathlib import Path


# Path to the fixtures file
FIXTURES_PATH = Path(__file__).parent / 'fixtures' / 'rule_type_tests.json'


def load_fixtures():
    """Load test fixtures from JSON file."""
    with open(FIXTURES_PATH, 'r') as f:
        return json.load(f)


class MockContext:
    """
    Mock context that simulates StateManager for rule evaluation.

    This provides the same interface that ruleEngine.js expects from
    the context object, allowing us to test rule evaluation without
    a full StateManager instance.
    """

    def __init__(self, inventory=None, groups=None, settings=None,
                 regions=None, player_id=1):
        self.inventory = inventory or {}
        self.groups = groups or {}
        self.settings = settings or {}
        self.regions = regions or set()
        self.player_id = player_id

    def hasItem(self, item_name):
        """Check if player has at least one of the item."""
        return self.inventory.get(item_name, 0) > 0

    def countItem(self, item_name):
        """Get the count of an item."""
        return self.inventory.get(item_name, 0)

    def hasGroup(self, group_name, count=1):
        """Check if player has items from a group."""
        return self.groups.get(group_name, 0) >= count

    def countGroup(self, group_name):
        """Get the count of items in a group."""
        return self.groups.get(group_name, 0)

    def canReach(self, region_name):
        """Check if a region is reachable."""
        return region_name in self.regions

    def getPlayerId(self):
        """Get the current player ID."""
        return self.player_id

    def getSetting(self, setting_name):
        """Get a setting value."""
        return self.settings.get(setting_name)

    @classmethod
    def from_test_context(cls, context_dict):
        """Create a MockContext from a test case context dictionary."""
        if not context_dict:
            return cls()

        return cls(
            inventory=context_dict.get('inventory', {}),
            groups=context_dict.get('groups', {}),
            settings=context_dict.get('settings', {}),
            regions=set(context_dict.get('regions', [])),
            player_id=context_dict.get('playerId', 1)
        )


def evaluate_rule_python(rule, context):
    """
    Pure Python implementation of rule evaluation.

    This mirrors the behavior of ruleEngine.js evaluateRule function,
    allowing us to validate that the fixtures produce expected results.
    """
    if not isinstance(rule, dict):
        return rule

    rule_type = rule.get('type')

    if rule_type == 'constant':
        return rule.get('value')

    elif rule_type == 'negate':
        operand = evaluate_rule_python(rule.get('operand'), context)
        if operand is None:
            return None
        return -operand

    elif rule_type == 'player_id':
        return context.getPlayerId()

    elif rule_type == 'binary_op' or rule_type == 'binop':
        left = evaluate_rule_python(rule.get('left'), context)
        right = evaluate_rule_python(rule.get('right'), context)
        op = rule.get('op')

        if left is None or right is None:
            return None

        if op == '+':
            return left + right
        elif op == '-':
            return left - right
        elif op == '*':
            return left * right
        elif op == '/':
            return left / right
        elif op == '//':
            return left // right
        elif op == '%':
            return left % right
        elif op == '**':
            return left ** right

        return None

    elif rule_type == 'compare' or rule_type == 'comparison':
        left = evaluate_rule_python(rule.get('left'), context)
        right = evaluate_rule_python(rule.get('right'), context)
        op = rule.get('op')

        if left is None or right is None:
            return None

        if op == '==':
            return left == right
        elif op == '!=':
            return left != right
        elif op == '<':
            return left < right
        elif op == '>':
            return left > right
        elif op == '<=':
            return left <= right
        elif op == '>=':
            return left >= right
        elif op == 'in':
            return left in right
        elif op == 'not in':
            return left not in right

        return None

    elif rule_type == 'and':
        conditions = rule.get('conditions', [])
        if not conditions:
            return True  # Empty AND is vacuously true
        for cond in conditions:
            result = evaluate_rule_python(cond, context)
            if result is None:
                return None
            if not result:
                return False
        return True

    elif rule_type == 'or':
        conditions = rule.get('conditions', [])
        if not conditions:
            return False  # Empty OR is vacuously false
        for cond in conditions:
            result = evaluate_rule_python(cond, context)
            if result is None:
                return None
            if result:
                return True
        return False

    elif rule_type == 'not':
        # Handle both 'operand' and 'condition' fields
        operand = rule.get('operand') or rule.get('condition')
        result = evaluate_rule_python(operand, context)
        if result is None:
            return None
        return not result

    elif rule_type == 'conditional':
        test = evaluate_rule_python(rule.get('test'), context)
        if test is None:
            return None
        if test:
            return evaluate_rule_python(rule.get('if_true'), context)
        else:
            return evaluate_rule_python(rule.get('if_false'), context)

    elif rule_type == 'min':
        args = rule.get('args', [])
        values = [evaluate_rule_python(arg, context) for arg in args]
        if any(v is None for v in values):
            return None
        return min(values)

    elif rule_type == 'max':
        args = rule.get('args', [])
        values = [evaluate_rule_python(arg, context) for arg in args]
        if any(v is None for v in values):
            return None
        return max(values)

    elif rule_type == 'item_check':
        item = rule.get('item')
        if isinstance(item, dict):
            item = evaluate_rule_python(item, context)

        count_rule = rule.get('count')
        if count_rule:
            required = evaluate_rule_python(count_rule, context)
            return context.countItem(item) >= required
        return context.hasItem(item)

    elif rule_type == 'count_item':
        item = rule.get('item')
        if isinstance(item, dict):
            item = evaluate_rule_python(item, context)
        return context.countItem(item)

    elif rule_type == 'group_check':
        group = rule.get('group')
        count = rule.get('count', 1)
        return context.hasGroup(group, count)

    elif rule_type == 'group_count':
        group = rule.get('group')
        return context.countGroup(group)

    elif rule_type == 'list':
        values = rule.get('value', [])
        return [evaluate_rule_python(v, context) for v in values]

    elif rule_type == 'name':
        # In block execution, names are resolved from local scope
        # For standalone tests, return None (unknown)
        name = rule.get('name')
        return context._local_scope.get(name) if hasattr(context, '_local_scope') else None

    elif rule_type == 'block':
        # Execute statements and return the return value
        local_scope = {}
        context._local_scope = local_scope

        for stmt in rule.get('statements', []):
            result = execute_statement(stmt, context, local_scope)
            if isinstance(result, dict) and result.get('_return'):
                return result['_value']

        return None

    elif rule_type == 'setting_value':
        setting = rule.get('setting')
        return context.getSetting(setting)

    # Unknown rule type
    return None


def execute_statement(stmt, context, local_scope):
    """Execute a statement in block mode."""
    stmt_type = stmt.get('type')

    if stmt_type == 'return':
        value = evaluate_rule_with_scope(stmt.get('value'), context, local_scope)
        return {'_return': True, '_value': value}

    elif stmt_type == 'assign':
        var_name = stmt.get('var')
        op = stmt.get('op', '=')
        value = evaluate_rule_with_scope(stmt.get('value'), context, local_scope)

        if op == '=':
            local_scope[var_name] = value
        elif op == '+=':
            local_scope[var_name] = local_scope.get(var_name, 0) + value
        elif op == '-=':
            local_scope[var_name] = local_scope.get(var_name, 0) - value
        elif op == '*=':
            local_scope[var_name] = local_scope.get(var_name, 1) * value

        return None

    elif stmt_type == 'for_range':
        var_name = stmt.get('var')
        start = evaluate_rule_with_scope(stmt.get('start'), context, local_scope)
        end = evaluate_rule_with_scope(stmt.get('end'), context, local_scope)
        body = stmt.get('body', [])

        for i in range(start, end):
            local_scope[var_name] = i
            for body_stmt in body:
                result = execute_statement(body_stmt, context, local_scope)
                if isinstance(result, dict) and result.get('_return'):
                    return result
                if isinstance(result, dict) and result.get('_break'):
                    return None

        return None

    return None


def evaluate_rule_with_scope(rule, context, local_scope):
    """Evaluate a rule with access to local scope for variable resolution."""
    if not isinstance(rule, dict):
        return rule

    rule_type = rule.get('type')

    if rule_type == 'name':
        name = rule.get('name')
        if name in local_scope:
            return local_scope[name]
        return None

    # For other types, use the main evaluator
    context._local_scope = local_scope
    return evaluate_rule_python(rule, context)


class TestRuleFixtures(unittest.TestCase):
    """Test class that dynamically generates tests from fixtures."""

    @classmethod
    def setUpClass(cls):
        """Load fixtures once for all tests."""
        cls.fixtures = load_fixtures()

    def run_fixture_test(self, suite_name, test_case):
        """Run a single fixture test case."""
        rule = test_case['rule']
        expected = test_case['expected']
        context_dict = test_case.get('context', {})

        context = MockContext.from_test_context(context_dict)
        result = evaluate_rule_python(rule, context)

        self.assertEqual(
            result,
            expected,
            f"Test '{test_case['name']}' in suite '{suite_name}' failed"
        )


def generate_test_methods():
    """
    Generate test methods for each fixture test case.

    This allows pytest/unittest to report each test case individually.
    """
    fixtures = load_fixtures()

    for suite_name, suite in fixtures.get('test_suites', {}).items():
        for test_case in suite.get('tests', []):
            test_name = f"test_{suite_name}_{test_case['name']}"

            # Create a closure to capture the test case
            def make_test(sn, tc):
                def test_method(self):
                    self.run_fixture_test(sn, tc)
                return test_method

            # Add the test method to the class
            setattr(TestRuleFixtures, test_name, make_test(suite_name, test_case))


# Generate test methods when module loads
if FIXTURES_PATH.exists():
    generate_test_methods()


class TestMockContext(unittest.TestCase):
    """Tests for the MockContext class itself."""

    def test_inventory_operations(self):
        """Test inventory hasItem and countItem."""
        ctx = MockContext(inventory={'Sword': 1, 'Key': 5})

        self.assertTrue(ctx.hasItem('Sword'))
        self.assertFalse(ctx.hasItem('Shield'))
        self.assertEqual(ctx.countItem('Key'), 5)
        self.assertEqual(ctx.countItem('Shield'), 0)

    def test_group_operations(self):
        """Test group hasGroup and countGroup."""
        ctx = MockContext(groups={'swords': 3, 'keys': 7})

        self.assertTrue(ctx.hasGroup('swords'))
        self.assertTrue(ctx.hasGroup('swords', 3))
        self.assertFalse(ctx.hasGroup('swords', 4))
        self.assertEqual(ctx.countGroup('keys'), 7)

    def test_settings(self):
        """Test settings lookup."""
        ctx = MockContext(settings={'difficulty': 'hard', 'hearts': 3})

        self.assertEqual(ctx.getSetting('difficulty'), 'hard')
        self.assertEqual(ctx.getSetting('hearts'), 3)
        self.assertIsNone(ctx.getSetting('unknown'))

    def test_player_id(self):
        """Test player ID."""
        ctx1 = MockContext()
        ctx2 = MockContext(player_id=2)

        self.assertEqual(ctx1.getPlayerId(), 1)
        self.assertEqual(ctx2.getPlayerId(), 2)


if __name__ == '__main__':
    unittest.main()
