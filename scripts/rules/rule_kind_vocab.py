"""Snapshot the rule-node KIND vocabulary of every Python layer (rule-node-registry R1).

Writes ``frontend/schema/rule-kinds.python-vocab.json``: for each Python layer that
produces or consumes rules.json rule nodes, the sorted list of kind names it emits
or handles. The JavaScript census (``scripts/rules/ruleKindCensus.test.js``) reads
this file together with the hand-edited registry ``frontend/schema/rule-kinds.json``
and the JS engine's live vocabulary, and fails by name on a cross-layer gap.

Why a snapshot: the vitest runner's bare ``python3`` cannot import the exporter or
rule_builder (they need the Archipelago requirements), and the pytest job has no
submodules, so no single job sees both languages. pytest
(``test/general/test_rule_kind_vocab.py``) keeps this snapshot FRESH; vitest
evaluates it.

Facts only: no policy here. Which emitted ``type`` keys are not rule nodes, which
gaps are known, and what each kind needs from its context live in the registry.

Usage (from the repo root, with the Archipelago venv):
    python scripts/rules/rule_kind_vocab.py            # print the snapshot
    python scripts/rules/rule_kind_vocab.py --write    # rewrite the committed file
    python scripts/rules/rule_kind_vocab.py --check    # exit 1 if it is stale
"""
import ast
import inspect
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'frontend' / 'schema' / 'rule-kinds.python-vocab.json'


def _parse(rel):
    return ast.parse((ROOT / rel).read_text(encoding='utf-8'), filename=rel)


def _function(tree, name):
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    raise LookupError(f'function {name} not found')


def _str_keys_of_dict_assigned_to(scope, target):
    """Keys of the dict literal assigned to ``target`` (a name or ``self.attr``) inside ``scope``."""
    for node in ast.walk(scope):
        if isinstance(node, ast.Assign):
            targets, value = node.targets, node.value
        elif isinstance(node, ast.AnnAssign):
            targets, value = [node.target], node.value
        else:
            continue
        if not isinstance(value, ast.Dict):
            continue
        for t in targets:
            name = t.id if isinstance(t, ast.Name) else t.attr if isinstance(t, ast.Attribute) else None
            if name == target:
                return {k.value for k in value.keys if isinstance(k, ast.Constant) and isinstance(k.value, str)}
    raise LookupError(f'dict {target} not found')


def _names_compared_with(node, var, whole_test_only=False):
    """String literals that ``var`` is compared with (``var == 'X'`` / ``var in ('X', ...)``).

    With ``whole_test_only``, only comparisons that ARE an ``if`` test count, so a guarded
    ``if var == 'X' and <more>:`` (accepted only conditionally) is left out.
    """
    if whole_test_only:
        tests = [n.test for n in ast.walk(node) if isinstance(n, ast.If)]
    else:
        tests = [n for n in ast.walk(node) if isinstance(n, ast.Compare)]
    out = set()
    for t in tests:
        if not (isinstance(t, ast.Compare) and isinstance(t.left, ast.Name) and t.left.id == var and len(t.ops) == 1):
            continue
        right = t.comparators[0]
        if isinstance(t.ops[0], ast.Eq) and isinstance(right, ast.Constant) and isinstance(right.value, str):
            out.add(right.value)
        elif isinstance(t.ops[0], ast.In) and isinstance(right, (ast.Tuple, ast.List, ast.Set)):
            out |= {e.value for e in right.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)}
    return out


def _dict_literal_values(tree, key):
    """Every string value of ``key`` in a dict literal (``{'type': 'x', ...}``)."""
    out = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Dict):
            for k, v in zip(node.keys, node.values):
                if (isinstance(k, ast.Constant) and k.value == key
                        and isinstance(v, ast.Constant) and isinstance(v.value, str)):
                    out.add(v.value)
    return out


def _source_files(*rels):
    for rel in rels:
        p = ROOT / rel
        for f in ([p] if p.is_file() else sorted(p.rglob('*.py'))):
            if not f.name.startswith('test_') and 'tests' not in f.parts:
                yield f.relative_to(ROOT).as_posix()


def exporter_layers():
    emits_ast, emits_rb = set(), set()
    for rel in _source_files('exporter/analyzer', 'exporter/games', 'exporter/script_api.py'):
        tree = _parse(rel)
        emits_ast |= _dict_literal_values(tree, 'type')
        if rel.startswith('exporter/games/'):
            emits_rb |= _dict_literal_values(tree, 'rule')
    foreign = _str_keys_of_dict_assigned_to(_parse('exporter/foreign_rule_builder.py'), '_BASE_RULE_ARGS')
    return {
        'exporter.emits_ast': emits_ast,
        'exporter.games_emit_rb': emits_rb,
        'exporter.foreign_rb': foreign,
    }


def converter_layers():
    from exporter.converter.ast_to_rule_builder import ASTToRuleBuilder
    from exporter.converter.rule_builder_to_ast import RuleBuilderToAST
    tree = _parse('exporter/converter/ast_to_rule_builder.py')
    made = set()
    for node in ast.walk(tree):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr in ('_make_rule', '_make_composite_rule', '_make_custom_rule')
                and node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str)):
            made.add(node.args[0].value)
    return {
        'converter.ast_to_rb.converts': set(ASTToRuleBuilder().TYPE_CONVERTERS),
        # what it can WRITE; an unconverted AST type becomes `AST_<type>` (`_convert_unknown`)
        'converter.ast_to_rb.emits_rb': made | _dict_literal_values(tree, 'rule'),
        'converter.rb_to_ast.converts': set(RuleBuilderToAST().RULE_CONVERTERS),
    }


def rule_builder_layers():
    from rule_builder.rules import DEFAULT_RULES
    serialises = set()
    for name, cls in DEFAULT_RULES.items():
        resolved = getattr(cls, 'Resolved', None)
        emitted = name
        for klass in (resolved, cls):
            if klass is None or 'to_dict' not in klass.__dict__:
                continue
            src = inspect.getsource(klass.__dict__['to_dict'])
            fn = ast.parse(inspect.cleandoc('\n' + src)).body[0]
            # ast.walk is breadth-first: the first `'rule'` key is the outermost dict's,
            # not a nested child's (`weighted_sum` nests `Constant` operands)
            rule_values = [v for node in ast.walk(fn) if isinstance(node, ast.Dict)
                           for k, v in zip(node.keys, node.values)
                           if isinstance(k, ast.Constant) and k.value == 'rule']
            if rule_values and isinstance(rule_values[0], ast.Constant):
                emitted = rule_values[0].value
            elif rule_values and isinstance(rule_values[0], ast.Attribute) and rule_values[0].attr == 'helper_name':
                emitted = None  # serialises as the helper's own name
            break
        if emitted:
            serialises.add(emitted)
    parse_ast = _names_compared_with(_function(_parse('rule_builder/ast_format.py'), 'parse_ast_rule'), 'rule_type')
    return {
        'rule_builder.default_rules': set(DEFAULT_RULES),
        'rule_builder.serialises': serialises,
        'rule_builder.parse_ast': parse_ast,
    }


def world_generator_layers():
    codegen = _parse('world_generator/rule_codegen.py')
    convert_rule = _function(codegen, '_convert_rule')
    rb_map = _str_keys_of_dict_assigned_to(convert_rule, 'rb_to_type')
    chain = _names_compared_with(
        _function(_parse('world_generator/_rule_expressions.py'), '_convert_rule_builder_format'), 'rb_rule')
    # names checked AFTER the map in _convert_rule, each a whole `if rb_rule == 'X':` test
    post_map = _names_compared_with(convert_rule, 'rb_rule', whole_test_only=True)
    helpers = _parse('world_generator/_helper_statements.py')
    gen_expr = _function(helpers, '_generate_expression')
    statements = _names_compared_with(_function(helpers, '_generate_statement'), 'stmt_type')
    return {
        # a map name reaches the chain; a name in neither falls to `True_()`
        'world_generator.rb': (rb_map & chain) | post_map,
        'world_generator.rb_map_without_handler': rb_map - chain - post_map,
        'world_generator.ast': _str_keys_of_dict_assigned_to(convert_rule, 'converters'),
        'world_generator.helper_ast': _str_keys_of_dict_assigned_to(gen_expr, 'handlers') | statements
        | (_names_compared_with(helpers, 'rule_type') & {'block'}),
        'world_generator.helper_rb': _names_compared_with(gen_expr, 'rule_type') - {'block'},
    }


def snapshot():
    sys.path.insert(0, str(ROOT))
    layers = {}
    for part in (exporter_layers, converter_layers, rule_builder_layers, world_generator_layers):
        layers.update(part())
    return {
        '_about': 'GENERATED by scripts/rules/rule_kind_vocab.py --write; do not edit. '
                  'Per Python layer, the rule-node kinds it emits or handles. Read by scripts/rules/ruleKindCensus.test.js.',
        'layers': {k: sorted(v) for k, v in sorted(layers.items())},
    }


def render(data):
    return json.dumps(data, indent=1) + '\n'


def main(argv):
    text = render(snapshot())
    if '--write' in argv:
        OUT.write_text(text, encoding='utf-8')
        print(f'wrote {OUT.relative_to(ROOT)}')
        return 0
    if '--check' in argv:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != text:
            print(f'{OUT.relative_to(ROOT)} is STALE: run python scripts/rules/rule_kind_vocab.py --write')
            return 1
        print(f'{OUT.relative_to(ROOT)} is fresh')
        return 0
    sys.stdout.write(text)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
