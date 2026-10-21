import importlib.util
import os
import unittest


def _load_writer():
    path = os.path.join("scripts", "rules", "rule_kind_vocab.py")
    spec = importlib.util.spec_from_file_location("rule_kind_vocab", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestRuleKindVocab(unittest.TestCase):
    """The Python layers' rule-kind snapshot read by the JS census (scripts/rules/ruleKindCensus.test.js)
    must match the code: a kind added to the exporter, a converter, rule_builder or world_generator
    reaches the census only through a regenerated snapshot."""

    def test_snapshot_is_fresh(self):
        writer = _load_writer()
        expected = writer.render(writer.snapshot())
        with open(writer.OUT, encoding="utf-8") as f:
            committed = f.read()
        self.assertEqual(committed, expected,
                         "frontend/schema/rule-kinds.python-vocab.json is STALE: "
                         "run python scripts/rules/rule_kind_vocab.py --write")
