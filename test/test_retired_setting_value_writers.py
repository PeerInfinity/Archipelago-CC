"""rules S7 follow-up (rules-retire-setting-value): no writer or reader of the
retired setting nodes is left.

F4 retired the AST `setting_value` node and migrated its exporter writers.
What remained was the AST -> Rule Builder converter's fallbacks for raw
`options.X` / `self.options.X` / `options.X.to_bool()` (they wrote RB
`SettingValue` / `AST_setting_value`), world_generator's readers of those two
(its internal `setting_value` IR was built only from them), and the JS-only
`setting_check` reader that no exporter ever wrote. A trace of all 111 template
exports through the converter hit none of those fallbacks, and no committed
document carries any of the four shapes (test_schema_validation refuses them).

The fallbacks now write `OptionValue` (the name is under `options` by
construction, F4's rule), and every reader is gone; the census row pins that.
"""

import re
import unittest
from pathlib import Path

from exporter.converter.ast_to_rule_builder import convert_ast_to_rule_builder


ROOT = Path(__file__).resolve().parent.parent
RETIRED = ("setting_value", "SettingValue", "AST_setting_value", "setting_check")
OPTIONS = {"type": "name", "name": "options"}
SELF_OPTIONS = {"type": "attribute", "object": {"type": "name", "name": "self"}, "attr": "options"}


def _walk_rule_names(node):
    if isinstance(node, dict):
        for key in ("rule", "type"):
            if isinstance(node.get(key), str):
                yield node[key]
        for value in node.values():
            yield from _walk_rule_names(value)
    elif isinstance(node, list):
        for value in node:
            yield from _walk_rule_names(value)


class TestConverterWritesOptionValue(unittest.TestCase):
    def _convert(self, ast_rule):
        rule, warnings = convert_ast_to_rule_builder(ast_rule)
        self.assertEqual(warnings, [])
        self.assertFalse(set(_walk_rule_names(rule)) & set(RETIRED), rule)
        return rule

    def test_option_attribute_shapes_write_option_value(self):
        for label, ast_rule in (
            ("options.X", {"type": "attribute", "object": OPTIONS, "attr": "goal"}),
            ("self.options.X", {"type": "attribute", "object": SELF_OPTIONS, "attr": "goal"}),
            ("option_value.value", {"type": "attribute", "object": {"type": "option_value", "option": "goal"},
                                    "attr": "value"}),
        ):
            with self.subTest(shape=label):
                self.assertEqual(self._convert(ast_rule), {"rule": "OptionValue", "args": {"option": "goal"}})

    def test_to_bool_wraps_option_value(self):
        for label, obj in (("options.X", OPTIONS), ("self.options.X", SELF_OPTIONS)):
            with self.subTest(shape=label):
                rule = self._convert({"type": "function_call", "args": [], "function": {
                    "type": "attribute", "attr": "to_bool",
                    "object": {"type": "attribute", "object": obj, "attr": "open_pyramid"}}})
                self.assertEqual(rule["rule"], "bool")
                self.assertEqual(rule["args"], [{"rule": "OptionValue", "args": {"option": "open_pyramid"}}])


class TestNoRetiredSettingNodeCode(unittest.TestCase):
    """Census: no writer/reader names a retired node as a string literal."""

    TREES = ("exporter", "world_generator", "rule_builder", "frontend/modules/shared/ruleEngine",
             "frontend/modules/commonUI", "frontend/modules/pathAnalyzer", "scripts/test/compare_rules_json.py",
             "scripts/docs")
    LITERAL = re.compile(r"""['"](%s)['"]""" % "|".join(RETIRED))

    def test_no_retired_literal(self):
        files = []
        for tree in self.TREES:
            path = ROOT / tree
            files += [path] if path.is_file() else [p for p in path.rglob("*")
                                                   if p.suffix in (".py", ".js", ".mjs") and p.is_file()]
        self.assertGreater(len(files), 50)
        hits = [f"{p.relative_to(ROOT)}:{n}: {line.strip()}"
                for p in files
                for n, line in enumerate(p.read_text(encoding="utf-8", errors="replace").splitlines(), 1)
                if self.LITERAL.search(line)]
        self.assertEqual(hits, [])


if __name__ == "__main__":
    unittest.main()
