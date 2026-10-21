"""world_generator: a rule kind with no codegen path fails LOUDLY, by name (⚖ D3, rule-kind R2a).

It used to become an always-true placeholder (``True_()`` / ``'True'``) silently. Lossy mode
(``--lossy`` / ``WorldGenerator(lossy=True)``) keeps the placeholder and records each one. Also pins
the kinds R2a gave codegen paths: HasAnyCount, CountFromList, MinValue/MaxValue,
EntranceAccessRuleCall, group_count, (AST_)weighted_count_true, HasGroup(Unique) in helper bodies.
"""
import unittest

from world_generator._helper_codegen import HelperCodeGenerator
from world_generator._unknown_kind import UnknownRuleKindError, lossy_codegen
from world_generator.rule_codegen import RuleCodeGenerator

UNKNOWN_RB = {'rule': 'NoSuchKind_r2a'}
UNKNOWN_AST = {'type': 'no_such_kind_r2a'}


class TestStrictByDefault(unittest.TestCase):
    def test_rule_codegen_raises_naming_the_kind(self) -> None:
        for rule in (UNKNOWN_RB, UNKNOWN_AST):
            with self.assertRaisesRegex(UnknownRuleKindError, 'no_such_kind_r2a|NoSuchKind_r2a'):
                RuleCodeGenerator('Test')._convert_rule(rule)

    def test_helper_codegen_raises_naming_the_kind(self) -> None:
        with self.assertRaisesRegex(UnknownRuleKindError, 'no_such_kind_r2a'):
            HelperCodeGenerator('Test')._generate_expression(UNKNOWN_AST)


class TestLossyOptIn(unittest.TestCase):
    def test_lossy_keeps_the_placeholder_and_records_it(self) -> None:
        with lossy_codegen() as record:
            self.assertEqual(RuleCodeGenerator('Test')._convert_rule(UNKNOWN_AST), 'True_()')
            self.assertEqual(HelperCodeGenerator('Test')._generate_expression(UNKNOWN_AST), 'True')
        self.assertEqual(record, {'rule dispatch:no_such_kind_r2a': 1, 'helper body:no_such_kind_r2a': 1})

    def test_lossy_off_inside_lossy_is_strict(self) -> None:
        with lossy_codegen(), lossy_codegen(False):
            with self.assertRaises(UnknownRuleKindError):
                RuleCodeGenerator('Test')._convert_rule(UNKNOWN_AST)


class TestKindsGivenCodegen(unittest.TestCase):
    def convert(self, rule):
        return RuleCodeGenerator('Test')._convert_rule(rule)

    def test_rule_builder_kinds(self) -> None:
        count_item = lambda name: {'rule': 'CountItem', 'args': {'item_name': name}}  # noqa: E731
        cases = {
            'HasAnyCount({\'A\': 2, \'B\': 1})': {'rule': 'HasAnyCount', 'args': {'item_counts': {'A': 2, 'B': 1}}},
            'CountFromList(\'A\', \'B\')': {'rule': 'CountFromList', 'args': {'item_names': ['A', 'B']}},
            'EntranceAccessRuleCall(\'Gate\', fake_pearl=False)':
                {'rule': 'EntranceAccessRuleCall', 'args': {'entrance_name': 'Gate'}},
            'CountGroup(\'Relics\')': {'rule': 'group_count', 'args': {'group': 'Relics'}},
        }
        for expected, rule in cases.items():
            self.assertEqual(self.convert(rule), expected, rule['rule'])
        for name in ('MinValue', 'MaxValue'):
            code = self.convert({'rule': name, 'args': {'left': count_item('A'), 'right': count_item('B')}})
            self.assertTrue(code.startswith(f'{name}(CountItem('), code)

    def test_weighted_count_true_is_atleast_over_repeated_children(self) -> None:
        a = {'type': 'item_check', 'item': 'A'}
        b = {'type': 'item_check', 'item': 'B'}
        weighted = {'count': 3, 'weighted_conditions': [[a, 2], [b, 1]]}
        rb = self.convert({'rule': 'AST_weighted_count_true', 'args': weighted})
        ast = self.convert({'type': 'weighted_count_true', **weighted})
        self.assertEqual(rb, ast)
        self.assertTrue(rb.startswith('AtLeast(3, '), rb)
        self.assertEqual(rb.count('Has("A")'), 2, rb)
        with self.assertRaises(UnknownRuleKindError):
            self.convert({'type': 'weighted_count_true', 'count': 1, 'weighted_conditions': [[a, 0.5]]})

    def test_helper_body_kinds(self) -> None:
        gen = HelperCodeGenerator('Test')
        self.assertEqual(
            gen._generate_expression({'rule': 'HasGroupUnique', 'args': {'item_name_group': 'Relics', 'count': 6}}),
            "state.has_group_unique('Relics', player, 6)")
        self.assertEqual(gen._generate_expression({'rule': 'HasGroup', 'args': {'item_name_group': 'Relics'}}),
                         "state.has_group('Relics', player)")
        code = gen._generate_expression({'type': 'weighted_count_true', 'count': 2, 'weighted_conditions': [
            [{'type': 'item_check', 'item': 'A'}, 1], [{'type': 'constant', 'value': True}, 2]]})
        self.assertEqual(code, "(((1 if (state.has('A', player)) else 0) + (2 if (True) else 0)) >= 2)")


if __name__ == '__main__':
    unittest.main()
