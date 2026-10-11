import glob
import json
import os
import unittest

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False


@unittest.skipUnless(HAS_JSONSCHEMA, "jsonschema package not installed")
class TestSchemaValidation(unittest.TestCase):
    """Validate exported rules.json files against the JSON Schema."""

    schema = None
    schema_path = os.path.join("frontend", "schema", "rules.schema.json")
    presets_pattern = os.path.join("frontend", "presets", "*", "AP_*", "AP_*_rules.json")

    @classmethod
    def setUpClass(cls):
        with open(cls.schema_path) as f:
            cls.schema = json.load(f)

    def test_schema_is_valid(self):
        """The schema itself should be valid JSON Schema draft-07."""
        jsonschema.Draft7Validator.check_schema(self.schema)

    def test_rules_json_validates_against_schema(self):
        """All existing rules.json files should validate against the schema."""
        files = sorted(glob.glob(self.presets_pattern))
        self.assertGreater(len(files), 0, "No rules.json files found in frontend/presets/")

        for path in files:
            with self.subTest(path=path):
                with open(path) as f:
                    data = json.load(f)
                jsonschema.validate(instance=data, schema=self.schema)

    def test_no_retired_setting_value_node(self):
        """rules S7 (user 2026-10-03): the `setting_value` rule node is retired.

        The schema's astRule refuses it where it validates a rule, but AST
        nodes nested in a Rule Builder rule's free-form `args` (kh2's
        Compare/Conditional operands) are not descended into, so this walks
        every node of every committed preset and names the first one found.
        Writers emit `option_value` (option) or `world_attribute` (attribute).
        """
        def first_retired(node, pointer):
            if isinstance(node, dict):
                if node.get("type") == "setting_value":
                    return pointer
                children = node.items()
            elif isinstance(node, list):
                children = enumerate(node)
            else:
                return None
            for key, value in children:
                found = first_retired(value, f"{pointer}/{key}")
                if found:
                    return found
            return None

        for path in sorted(glob.glob(self.presets_pattern)):
            with self.subTest(path=path):
                with open(path) as f:
                    found = first_retired(json.load(f), "")
                self.assertIsNone(found, f"{path}: retired `setting_value` node at {found} "
                                         "(write option_value / world_attribute)")
