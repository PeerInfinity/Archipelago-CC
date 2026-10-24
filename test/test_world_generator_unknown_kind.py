"""world_generator: a rule kind with no codegen path fails LOUDLY, by name (⚖ D3, rule-kind R2a).

It used to become an always-true placeholder (``True_()`` / ``'True'``) silently. Lossy mode
(``--lossy`` / ``WorldGenerator(lossy=True)``) keeps the placeholder and records each one. Also pins
the kinds R2a gave codegen paths: HasAnyCount, CountFromList, MinValue/MaxValue,
EntranceAccessRuleCall, group_count, (AST_)weighted_count_true, HasGroup(Unique) in helper bodies.
"""
import unittest

from world_generator._helper_codegen import HelperCodeGenerator
from world_generator._unknown_kind import UnknownHelperNameError, UnknownRuleKindError, lossy_codegen
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


class TestR2bHelperBodies(unittest.TestCase):
    """rule-kind R2b: the last two committed presets that needed --lossy in the helper body (kh1, kh2)."""

    def test_a_body_that_is_one_statement_is_a_block(self) -> None:
        # kh1 has_x_worlds: the body's root is `if ...: return True else: ...`, not a block
        body = {'type': 'if_statement',
                'test': {'type': 'compare', 'left': {'type': 'name', 'name': 'x'}, 'op': '>=',
                         'right': {'type': 'constant', 'value': 15}},
                'body': [{'type': 'return', 'value': {'type': 'constant', 'value': True}}],
                'orelse': [{'type': 'return', 'value': {'type': 'constant', 'value': False}}]}
        self.assertEqual(HelperCodeGenerator('Test')._generate_body(body),
                         'if (x >= 15):\n    return True\nelse:\n    return False')

    def test_statement_types_are_the_registrys_statement_kinds(self) -> None:
        import json
        import pathlib
        registry = json.loads((pathlib.Path(__file__).resolve().parents[1]
                               / 'frontend/schema/rule-kinds.json').read_text(encoding='utf-8'))
        statements = set()

        def collect(node) -> None:
            if isinstance(node, dict):
                for key, value in node.items():
                    if isinstance(value, dict) and value.get('statement') is True:
                        statements.add(key)
                    collect(value)
        collect(registry)
        self.assertEqual(set(HelperCodeGenerator._STATEMENT_TYPES), statements)

    def test_a_wrapped_ast_node_generates_as_its_ast_type(self) -> None:
        # kh2: the AST→RB converter's AST_comparison inside an RB Conditional's test
        wrapped = {'rule': 'AST_comparison', 'args': {
            'op': '!=', 'left': {'type': 'name', 'name': 'logic'}, 'right': {'type': 'constant', 'value': 0},
            '_original_ast_type': 'comparison'}, '_converted_from_ast': True}
        self.assertEqual(HelperCodeGenerator('Test')._generate_expression(wrapped), '(logic != 0)')

    def test_a_wrapped_ast_type_with_no_codegen_still_fails_by_its_own_name(self) -> None:
        wrapped = {'rule': 'AST_no_such_kind_r2b', 'args': {'_original_ast_type': 'no_such_kind_r2b'}}
        with self.assertRaisesRegex(UnknownRuleKindError, 'no_such_kind_r2b'):
            HelperCodeGenerator('Test')._generate_expression(wrapped)


def _world_rules(exit_rule, dungeons=None) -> dict:
    """A two-region rules file: Menu -> Room through ``exit_rule``, one location in Room."""
    rules = {
        'schema_version': 3, 'game_name': 'F1 Fixture', 'game_directory': 'f1_fixture',
        'archipelago_version': '0.0.0', 'generation_seed': 1, 'seed_name': 'AP_1',
        'player_names': {'1': 'Player1'},
        'regions': {'1': {
            'Menu': {'name': 'Menu', 'locations': [],
                     'exits': [{'name': 'Go', 'connected_region': 'Room', 'access_rule': exit_rule}]},
            'Room': {'name': 'Room', 'exits': [], 'locations': [
                {'name': 'Prize', 'id': 1, 'access_rule': {'rule': 'True_'}}]}}},
        'start_regions': {'1': {'default': ['Menu'], 'available': []}},
        'items': {'1': {'Key': {'name': 'Key', 'id': 1, 'groups': [], 'classification': 'progression',
                                'type': None, 'max_count': 1}}},
        'item_groups': {'1': []}, 'itempool_counts': {'1': {'Key': 1}},
        'world': {'1': {'game': 'F1 Fixture'}}, 'helpers': {},
        'game_info': {'1': {'completion_condition': {'type': 'constant', 'value': True}}},
    }
    if dungeons is not None:
        rules['dungeons'] = {'1': dungeons}
    return rules


class TestUnknownHelperName(unittest.TestCase):
    """rule-node F1: a helper NAME with no definition is loud too, through the same --lossy switch.

    It used to become ``True_()`` / ``'True'`` with only a stderr print, so a strict run exited 0
    with a silently wrong world (9 committed presets: their helper bodies live in JS only).
    """

    UNKNOWN_RB_HELPER = {'rule': 'no_such_helper_f1', '_original_ast_type': 'helper', 'args': []}
    UNKNOWN_AST_HELPER = {'type': 'helper', 'name': 'no_such_helper_f1', 'args': []}

    def test_every_site_raises_naming_the_helper(self) -> None:
        sites = {
            'rule helper': lambda: RuleCodeGenerator('Test')._convert_rule(self.UNKNOWN_AST_HELPER),
            'rule_builder helper': lambda: RuleCodeGenerator('Test')._convert_rule(self.UNKNOWN_RB_HELPER),
            'helper body': lambda: HelperCodeGenerator('Test')._generate_expression(self.UNKNOWN_AST_HELPER),
            'helper lambda': lambda: HelperCodeGenerator('Test')._generate_expression(self.UNKNOWN_RB_HELPER),
        }
        for site, convert in sites.items():
            with self.assertRaisesRegex(UnknownHelperNameError, "'no_such_helper_f1'") as caught:
                convert()
            self.assertEqual((caught.exception.site, caught.exception.name), (site, 'no_such_helper_f1'))
            self.assertIsInstance(caught.exception, UnknownRuleKindError)  # one except covers both

    def test_lossy_keeps_the_placeholder_and_lists_it_with_the_kinds(self) -> None:
        with lossy_codegen() as record:
            self.assertEqual(RuleCodeGenerator('Test')._convert_rule(self.UNKNOWN_RB_HELPER), 'True_()')
            self.assertEqual(HelperCodeGenerator('Test')._generate_expression(self.UNKNOWN_AST_HELPER), 'True')
            RuleCodeGenerator('Test')._convert_rule(UNKNOWN_AST)
        self.assertEqual(record, {'rule_builder helper:helper no_such_helper_f1': 1,
                                  'helper body:helper no_such_helper_f1': 1,
                                  'rule dispatch:no_such_kind_r2a': 1})

    def _generate(self, rules: dict, lossy: bool):
        import json
        import tempfile
        from pathlib import Path

        from world_generator.generator import WorldGenerator
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(__import__('shutil').rmtree, tmp, True)
        path = tmp / 'rules.json'
        path.write_text(json.dumps(rules), encoding='utf-8')
        out = tmp / ('lossy' if lossy else 'strict')
        generator = WorldGenerator(str(path), output_dir=str(out), force=True, lossy=lossy)
        generator.generate()
        files = {p.relative_to(out).as_posix(): p.read_bytes()
                 for p in sorted(out.rglob('*')) if p.is_file() and '__pycache__' not in p.parts}
        return generator, files

    def test_a_world_fails_strict_naming_the_game_and_lists_it_lossy(self) -> None:
        rules = _world_rules(self.UNKNOWN_RB_HELPER)
        with self.assertRaisesRegex(UnknownHelperNameError, "'no_such_helper_f1'.*game 'F1 Fixture'"):
            self._generate(rules, lossy=False)
        generator, files = self._generate(rules, lossy=True)
        self.assertEqual(generator.lossy_placeholders, {'rule_builder helper:helper no_such_helper_f1': 1})
        self.assertIn(b'True_()', files['Rules.py'])

    def test_a_boss_defeat_rule_no_longer_falls_back_to_true_silently(self) -> None:
        # _template_rules caught every exception there and wrote `return True`
        dungeons = {'Keep': {'name': 'Keep', 'regions': ['Room'], 'medallion_check': None,
                             'bosses': {'None': {'name': 'Ogre', 'defeat_rule': self.UNKNOWN_AST_HELPER}}}}
        rules = _world_rules({'rule': 'True_'}, dungeons=dungeons)
        with self.assertRaisesRegex(UnknownHelperNameError, "'no_such_helper_f1'"):
            self._generate(rules, lossy=False)
        generator, _ = self._generate(rules, lossy=True)
        self.assertEqual(generator.lossy_placeholders, {'helper body:helper no_such_helper_f1': 1})

    def test_a_world_with_no_unknown_name_generates_the_same_bytes_strict_and_lossy(self) -> None:
        rules = _world_rules({'rule': 'Has', 'args': {'item_name': 'Key'}})
        strict_gen, strict = self._generate(rules, lossy=False)
        lossy_gen, lossy = self._generate(rules, lossy=True)
        self.assertEqual(lossy_gen.lossy_placeholders, {})
        self.assertEqual(sorted(strict), sorted(lossy))
        for name in strict:
            self.assertEqual(strict[name], lossy[name], name)
        self.assertIn(b"Has('Key', 1)", strict['Rules.py'])


class TestSpeculativeHelperExpansionRecordsOnlyWhatIsEmitted(unittest.TestCase):
    """rule-node R2c: the body_rule expansion of a helper call is speculative (it is thrown away when
    it converts to a bare ``True_()`` or raises), so its lossy placeholders count only when kept.

    The old code recorded them anyway: a lossy record listing a placeholder the output never had.
    """

    UNKNOWN = {'rule': 'helper', 'args': {'name': 'no_such_helper_r2c'}}  # convertible, then a placeholder
    CALL = {'type': 'helper', 'name': 'outer', 'args': []}

    def _generator(self, body):
        generator = RuleCodeGenerator('Test')
        generator.set_helpers({'outer'}, {'outer': body})
        return generator

    def test_a_discarded_expansion_records_nothing(self) -> None:
        with lossy_codegen() as record:
            code = self._generator(self.UNKNOWN)._convert_rule(self.CALL)
        self.assertEqual(code, 'HelperCall(helper_func=outer, helper_name="outer")')
        self.assertEqual(record, {})

    def test_a_kept_expansion_records_its_placeholder(self) -> None:
        body = {'rule': 'And', 'children': [{'rule': 'Has', 'args': {'item_name': 'Key'}}, self.UNKNOWN]}
        with lossy_codegen() as record:
            code = self._generator(body)._convert_rule(self.CALL)
        self.assertIn('body_rule=And(True_(), ', code)
        self.assertEqual(record, {'rule dispatch:helper': 1})

    def test_an_expansion_that_raises_after_recording_records_nothing(self) -> None:
        from world_generator._unknown_kind import unknown_kind
        generator = self._generator({'rule': 'Has', 'args': {'item_name': 'Key'}})

        def record_then_raise(rule):
            unknown_kind('rule dispatch', 'r2c_probe', 'True_()')
            raise RuntimeError('after recording')
        generator._convert_rule = record_then_raise
        with lossy_codegen() as record:
            self.assertIsNone(generator._try_convert_helper_body_to_rule('outer', []))
        self.assertEqual(record, {})

    def test_every_registered_record_is_scratched(self) -> None:
        import contextvars

        from world_generator import _unknown_kind
        other: contextvars.ContextVar = contextvars.ContextVar('r2c_probe_record', default=None)
        _unknown_kind.SPECULATIVE_RECORDS.append(other)
        self.addCleanup(_unknown_kind.SPECULATIVE_RECORDS.remove, other)
        outer = __import__('collections').Counter()
        token = other.set(outer)
        self.addCleanup(other.reset, token)
        for keep in (False, True):
            with _unknown_kind.speculative_record() as attempt:
                other.get()['x'] += 1
                if keep:
                    attempt.keep()
            self.assertIs(other.get(), outer)
        self.assertEqual(outer, {'x': 1})

    def test_the_unobtainable_record_is_registered(self) -> None:
        from world_generator import _unknown_kind
        self.assertIn(_unknown_kind._unobtainable_record, _unknown_kind.SPECULATIVE_RECORDS)
        self.assertIn(_unknown_kind._lossy_record, _unknown_kind.SPECULATIVE_RECORDS)

    def test_strict_is_unchanged_the_attempt_is_dropped(self) -> None:
        code = self._generator(self.UNKNOWN)._convert_rule(self.CALL)
        self.assertEqual(code, 'HelperCall(helper_func=outer, helper_name="outer")')


class TestCountTrueAboveTheExpansionLimit(unittest.TestCase):
    """rule-kind F2: a mixed count_true with C(n, count) > 120 used to sink to True_() with a warning.

    It is now the Rule Builder's AtLeast (its count_true twin); <= 120 still expands to Or-of-Ands.
    """
    ITEMS = [{'type': 'item_check', 'item': f'I{i}'} for i in range(5)]
    REGIONS = [{'type': 'can_reach', 'region': f'R{i}'} for i in range(5)]

    def convert(self, count, conditions):
        return RuleCodeGenerator('Test')._convert_rule({'type': 'count_true', 'count': count, 'conditions': conditions})

    def test_above_the_limit_is_atleast_in_both_shapes(self) -> None:
        conditions = self.ITEMS + self.REGIONS  # C(10, 5) = 252
        expected = ('AtLeast(5, Has("I0"), Has("I1"), Has("I2"), Has("I3"), Has("I4"), CanReachRegion("R0"), '
                    'CanReachRegion("R1"), CanReachRegion("R2"), CanReachRegion("R3"), CanReachRegion("R4"))')
        gen = RuleCodeGenerator('Test')
        self.assertEqual(gen._convert_rule({'type': 'count_true', 'count': 5, 'conditions': conditions}), expected)
        self.assertIn('AtLeast', gen.required_imports)
        self.assertNotIn('True_', gen.required_imports)
        rb = {'rule': 'AST_count_true', 'args': {'count': 5, 'conditions': conditions}}
        self.assertEqual(RuleCodeGenerator('Test')._convert_rule(rb), expected)

    def test_at_the_limit_still_expands_unchanged(self) -> None:
        self.assertEqual(self.convert(2, self.ITEMS[3:] + self.REGIONS[:1]),
                         '((Has("I3")) & (Has("I4"))) | ((Has("I3")) & (CanReachRegion("R0"))) | '
                         '((Has("I4")) & (CanReachRegion("R0")))')
        # C(10, 3) = 120: the largest expansion, still an Or of Ands
        code = self.convert(3, self.ITEMS + self.REGIONS)
        self.assertEqual(code.count(') | ('), 119, code[:200])
        self.assertNotIn('AtLeast', code)

    def test_atleast_evaluates_at_k_minus_1_k_k_plus_1(self) -> None:
        from collections import Counter
        import rule_builder

        class World:
            player = 1
            rule_caching_enabled = False

        class State:
            def __init__(self, have):
                self.have = have
                self.prog_items = {1: Counter({name: 1 for name in have if name.startswith('I')})}

            def can_reach_region(self, region, player):
                return region in self.have

        rule = eval(self.convert(5, self.ITEMS + self.REGIONS), vars(rule_builder)).resolve(World())
        names = ['I0', 'R0', 'I1', 'R1', 'I2', 'R2']  # mixes both condition kinds
        self.assertEqual([rule(State(set(names[:k]))) for k in (4, 5, 6)], [False, True, True])


class TestCountTrueWithANonIntegerCount(unittest.TestCase):
    """rule-node R2c: a count_true whose count is not a number (e.g. an expression dict) crashed
    with a TypeError (``dict <= int``). It is now loud by name, the F1 way: strict raises naming
    the rule, lossy keeps ``True_()`` and records it. 0 corpus hits (F2's measure).
    """
    CONDITIONS = [{'type': 'item_check', 'item': 'A'}, {'type': 'item_check', 'item': 'B'}]
    COUNT = {'type': 'attribute', 'object': {'type': 'name', 'name': 'options'}, 'attr': 'needed'}

    def shapes(self):
        return ({'type': 'count_true', 'count': self.COUNT, 'conditions': self.CONDITIONS},
                {'rule': 'AST_count_true', 'args': {'count': self.COUNT, 'conditions': self.CONDITIONS}})

    def test_strict_raises_naming_the_rule_in_both_shapes(self) -> None:
        for rule in self.shapes():
            with self.assertRaisesRegex(UnknownRuleKindError, 'count_true with non-integer count') as caught:
                RuleCodeGenerator('Test')._convert_rule(rule)
            self.assertEqual(caught.exception.site, 'count_true')

    def test_lossy_keeps_true_and_records_it(self) -> None:
        with lossy_codegen() as record:
            for rule in self.shapes():
                gen = RuleCodeGenerator('Test')
                self.assertEqual(gen._convert_rule(rule), 'True_()')
                self.assertIn('True_', gen.required_imports)
        self.assertEqual(sum(record.values()), 2)
        self.assertTrue(all(key.startswith('count_true:count_true with non-integer count') for key in record), record)

    def test_an_integral_float_count_is_its_integer(self) -> None:
        rule = {'type': 'count_true', 'count': 2.0, 'conditions': self.CONDITIONS}
        self.assertEqual(RuleCodeGenerator('Test')._convert_rule(rule),
                         RuleCodeGenerator('Test')._convert_rule({**rule, 'count': 2}))


class TestUnobtainableItemIsANamedRecord(unittest.TestCase):
    """rule-node R2c: a Has on an item the rules file never creates (no item definition, pool entry,
    placement or starting item) becomes False_(), which is EXACT (the generated world can never
    hold it), so it is not a lossy placeholder and never raises. It used to be a stderr print only;
    it is now recorded by name in both modes (``WorldGenerator.unobtainable_items``).
    Corpus: 3 presets, all 'Progressive Swim' (seedling_atlas 8, seedling_atlas_maze 8,
    seedling_playthrough_maze 4).
    """
    PHANTOM = {'rule': 'Has', 'args': {'item_name': 'Phantom', 'count': 1}}

    def _generate(self, rules, lossy):
        return TestUnknownHelperName._generate(self, rules, lossy)

    def test_the_converter_records_it_and_emits_false(self) -> None:
        from world_generator._unknown_kind import unobtainable_record
        gen = RuleCodeGenerator('Test')
        gen.set_obtainable_items({'Key'})
        with unobtainable_record() as record:
            self.assertEqual(gen._convert_rule(self.PHANTOM), 'False_()')
            self.assertEqual(gen._convert_rule({'rule': 'Has', 'args': {'item_name': 'Key', 'count': 1}}),
                             "Has('Key', 1)")
        self.assertEqual(record, {'Has:Phantom': 1})

    def test_a_world_records_it_in_both_modes_with_the_same_bytes(self) -> None:
        rules = _world_rules(self.PHANTOM)
        strict_gen, strict = self._generate(rules, lossy=False)
        lossy_gen, lossy = self._generate(rules, lossy=True)
        for generator in (strict_gen, lossy_gen):
            self.assertEqual(generator.unobtainable_items, {'Has:Phantom': 1})
            self.assertEqual(generator.lossy_placeholders, {})
        self.assertEqual(strict, lossy)
        self.assertIn(b'False_()', strict['Rules.py'])
        self.assertNotIn(b"Has('Phantom'", strict['Rules.py'])
