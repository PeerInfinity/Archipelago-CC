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
        """rules S7 (user 2026-10-03): the `setting_value` rule node is retired,
        and with it its Rule Builder forms `SettingValue` / `AST_setting_value`
        and the writer-less `setting_check` (rules-retire-setting-value).

        The schema refuses them where it validates a rule, but AST nodes nested
        in a Rule Builder rule's free-form `args` (kh2's Compare/Conditional
        operands) are not descended into, so this walks every node of every
        committed preset and names the first one found. Writers emit
        `option_value` / `OptionValue` (option) or `world_attribute` /
        `WorldAttribute` (attribute).
        """
        for path in sorted(glob.glob(self.presets_pattern)):
            with self.subTest(path=path):
                with open(path) as f:
                    found = first_retired_setting_node(json.load(f))
                self.assertIsNone(found, f"{path}: retired node {found} "
                                         "(write option_value / OptionValue or world_attribute / WorldAttribute)")

    def test_retired_setting_node_walker_names_each_shape(self):
        """The walker above finds each retired shape anywhere in a document
        (inside RB args, AST children, lists) and passes the current ones.
        The four shapes are listed here, not read from the walker's table, so
        a shape dropped from that table reds this row."""
        for key, name in (("type", "setting_value"), ("type", "setting_check"),
                          ("rule", "SettingValue"), ("rule", "AST_setting_value")):
            with self.subTest(shape=name):
                node = {key: name, "setting": "x"}
                doc = {"regions": {"1": {"R": {"locations": [{"access_rule": {
                    "rule": "Compare", "args": {"left": node, "op": "==", "right": 1}}}]}}}}
                self.assertEqual(first_retired_setting_node(doc),
                                 (f"{key}={name}", "/regions/1/R/locations/0/access_rule/args/left"))
        current = {"rule": "And", "children": [{"rule": "OptionValue", "args": {"option": "x"}},
                                               {"type": "option_value", "option": "x"},
                                               {"rule": "WorldAttribute", "args": {"attribute": "y"}},
                                               {"type": "world_attribute", "attribute": "y"}]}
        self.assertIsNone(first_retired_setting_node(current))

    def test_schema_refuses_each_retired_setting_node(self):
        """Where the schema does validate a rule, it refuses each retired
        shape by name and admits the current ones."""
        validator = jsonschema.Draft7Validator({"$ref": "#/$defs/rule", "$defs": self.schema["$defs"]})
        for node in ({"type": "setting_value", "setting": "x"},
                     {"type": "setting_check", "setting": "x", "value": 1},
                     {"rule": "SettingValue", "args": {"setting": "x"}},
                     {"rule": "AST_setting_value", "args": {"setting": "x"}}):
            with self.subTest(node=node):
                self.assertTrue(list(validator.iter_errors(node)), f"schema admits retired {node}")
        for node in ({"type": "option_value", "option": "x"}, {"type": "world_attribute", "attribute": "x"},
                     {"rule": "OptionValue", "args": {"option": "x"}},
                     {"rule": "WorldAttribute", "args": {"attribute": "x"}}):
            with self.subTest(node=node):
                self.assertEqual(list(validator.iter_errors(node)), [])


# (key, value) pairs naming a retired setting node: rules S7 (user 2026-10-03).
RETIRED_SETTING_NODES = (
    ("type", "setting_value"),
    ("type", "setting_check"),
    ("rule", "SettingValue"),
    ("rule", "AST_setting_value"),
)


def first_retired_setting_node(node, pointer=""):
    """(shape, JSON pointer) of the first retired setting node in `node`, else None."""
    if isinstance(node, dict):
        for key, name in RETIRED_SETTING_NODES:
            if node.get(key) == name:
                return (f"{key}={name}", pointer)
        children = node.items()
    elif isinstance(node, list):
        children = enumerate(node)
    else:
        return None
    for key, value in children:
        found = first_retired_setting_node(value, f"{pointer}/{key}")
        if found:
            return found
    return None
