"""EDITOR v3 slice E1c — the MINIFY knob on the Python side.

`json_tools.rules_json_indent` is the Python mirror of the frontend's
`rulesJson.indent`. Three things are pinned here:

1. **`indent=0` REALLY MINIFIES.** ``json.dumps(obj, indent=0)`` is *not*
   minified in Python — it still emits a newline before every element — while
   JavaScript's ``JSON.stringify(obj, null, 0)`` is. The exporter therefore maps
   0 to ``separators=(',', ':')``, and this row is the reason that mapping
   exists rather than being an unexplained special case.

2. **THE DEFAULT DOES NOT MOVE.** The setting's default is 2 in both the
   settings Group and the installer's mirror, and a change to either goes
   red here. (⛔ This paragraph used to say the committed presets were
   "byte pinned". W1 measured that nothing pins them — see
   ``test_rules_json_writer_agreement.py``. The default stays 2 because it
   is the frontend's default and the committed corpus is indented at 2.)

3. **MINIFYING CHANGES NO DATA** — the round trip is object-equal.
"""

import json
import os
import re
import sys
import unittest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _exporter_source() -> str:
    with open(os.path.join(REPO, 'exporter', 'exporter.py'), encoding='utf-8') as handle:
        return handle.read()


def _load_dump_helpers():
    """Exec just the two writer helpers out of exporter.py.

    ⛔ Importing `exporter.exporter` pulls the whole Archipelago world
    registry in; these two functions are pure and self-contained, so the
    row reads them out of the real file (never a copy) instead.
    """
    src = _exporter_source()
    start = src.index('def _json_dumps_at_indent')
    body = src.index('def _dump_with_compact_sidecar_tiles')
    match = re.search(r'\n(?=def |class )', src[body + 10:])
    assert match is not None, 'exporter.py: no top-level def after the dump helper'
    segment = src[start:body + 10 + match.start()]
    namespace = {'json': json, 'Any': object, 'List': list}
    exec(compile(segment, 'exporter.py-extract', 'exec'), namespace)  # noqa: S102
    return namespace


HELPERS = _load_dump_helpers()
dump_at_indent = HELPERS['_json_dumps_at_indent']
dump_rules = HELPERS['_dump_with_compact_sidecar_tiles']

SAMPLE = {
    'schema_version': 3,
    'game_name': 'Probe',
    'regions': {'Menu': {'exits': {'Start': {'rule': None}}}},
    'preset_sidecars': {
        'Menu': {
            'Start': {'playable_payload': {'width': 2, 'height': 2, 'tiles': [0, 1, 2, 3]}},
        },
    },
}


class TestRulesJsonIndent(unittest.TestCase):
    def test_python_indent_zero_is_not_minified_on_its_own(self):
        """The measurement the mapping exists for."""
        naive = json.dumps(SAMPLE, indent=0)
        self.assertIn('\n', naive, 'json.dumps(indent=0) is expected to keep newlines')

    def test_indent_zero_minifies_through_the_exporter_helper(self):
        minified = dump_at_indent(SAMPLE, 0)
        self.assertNotIn('\n', minified)
        self.assertNotIn(', ', minified)
        self.assertEqual(json.loads(minified), SAMPLE)

    def test_indent_two_is_unchanged_by_the_seam(self):
        self.assertEqual(dump_at_indent(SAMPLE, 2), json.dumps(SAMPLE, indent=2))

    def test_rules_dump_minifies_and_round_trips(self):
        two = dump_rules(SAMPLE, indent=2)
        zero = dump_rules(SAMPLE, indent=0)
        self.assertNotIn('\n', zero)
        self.assertEqual(json.loads(zero), json.loads(two))
        self.assertLess(len(zero), len(two))

    def test_a_document_without_sidecars_takes_the_same_seam(self):
        plain = {'schema_version': 3, 'regions': {}}
        self.assertNotIn('\n', dump_rules(plain, indent=0))
        self.assertEqual(dump_rules(plain, indent=2), json.dumps(plain, indent=2))

    def test_a_non_ascii_document_diverges_from_a_default_json_dumps(self):
        """EDITOR v3 W1. The row above is ASCII, so it reads the same whether
        or not `ensure_ascii` is set — it cannot see the escaping fix at all.
        This is its non-ASCII twin: the seam must now DIVERGE from a default
        `json.dumps` and agree with it once `ensure_ascii=False` is asked for.
        `JSON.stringify` writes the character itself; that is what is matched.
        """
        sectioned = {'schema_version': 3, 'note': 'R6 \u00a719.7'}
        written = dump_rules(sectioned, indent=2)
        self.assertIn('\u00a7', written)
        self.assertNotIn('\\u00a7', written)
        self.assertNotEqual(written, json.dumps(sectioned, indent=2))
        self.assertEqual(written, json.dumps(sectioned, indent=2, ensure_ascii=False))
        self.assertEqual(json.loads(written), sectioned)

        # ⛔ AND THE MINIFIED PATH TOO. `_json_dumps_at_indent` has two
        # branches and they are separate lines; a row that only ever asks for
        # indent 2 leaves the indent-0 branch free to escape what the indented
        # one does not. (Measured: a mutant reverting `ensure_ascii` on the
        # minified branch alone passed every other row in this file and in
        # test_rules_json_writer_agreement.py.) `JSON.stringify(obj, null, 0)`
        # is compact AND raw UTF-8; both branches must be.
        minified = dump_rules(sectioned, indent=0)
        self.assertIn('\u00a7', minified)
        self.assertNotIn('\\u00a7', minified)
        self.assertNotIn('\n', minified)
        self.assertEqual(json.loads(minified), sectioned)

    def test_the_default_is_two_in_both_declarations(self):
        sys.path.insert(0, REPO)
        from worlds.json_tools_installer.json_tools_settings import JSONToolsSettings
        from worlds.json_tools_installer.config import ExportSettings
        self.assertEqual(JSONToolsSettings.rules_json_indent, 2)
        self.assertEqual(ExportSettings().rules_json_indent, 2)

    def test_the_write_site_reads_the_setting_and_does_not_hardcode_two(self):
        """⛔ A literal `indent=2` at the write site would silently ignore the
        setting — the failure mode this whole slice is about."""
        src = _exporter_source()
        self.assertIn('_dump_with_compact_sidecar_tiles(\n                    filtered_data, '
                      'indent=_rules_json_indent())', src)


if __name__ == '__main__':
    unittest.main()
