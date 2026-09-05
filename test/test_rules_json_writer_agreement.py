"""EDITOR v3 slice W1 — the Python writer and the JS writer, pinned to AGREE.

`exporter.py`'s `_dump_with_compact_sidecar_tiles` has claimed since it was
written that it *"mirrors stringifyRulesJson … so files written here look the
same as files downloaded from the procgen panel."* E1c measured that the claim
was false of the BYTES (plan §25.11 #1-#2) and W1 fixed it in two lines. This
module is the pin the claim never had: it re-dumps committed presets that the
JS writer actually wrote and asserts BYTE equality.

⛔ **The fixtures are the real corpus, not a synthetic sample** — the whole
point is that the two writers agree on documents nobody wrote for a test.
Both fixture sets are DERIVED by scanning `frontend/presets/`, so a new preset
of either kind joins the pin without an edit here, and an empty scan is itself
a failure rather than a silently vacuous pass.

What each row is about:

1. **THE SPLICED TILES ARRAY IS COMPACT.** The splice at `exporter.py`'s
   `compact = json.dumps(tiles, …)` must use `separators=(',', ':')`; the
   default `', '` put a space after every tile integer and JS's
   `JSON.stringify(array)` does not.
2. **NON-ASCII SURVIVES AS ITSELF.** `json.dumps` escapes `§` to `\\u00a7` by
   default; `JSON.stringify` never escapes it. The write site opens the file
   with `encoding='utf-8'` (`exporter.py`, the `open(filepath, 'w', …)` above
   the dump call), which is what makes `ensure_ascii=False` safe.
3. **THE TRAILING NEWLINE IS THE WRITE SITE'S, NOT THE WRITER'S.** Neither
   `stringifyRulesJson` nor `_dump_with_compact_sidecar_tiles` emits one; the
   node write sites append it explicitly (`scripts/utils/generate-procgen-rules.js`
   writes `text + '\\n'`), and the Python write site does not. Byte equality is
   therefore asserted modulo exactly that one character, and this row is what
   keeps "modulo" honest.

⚠ **W1's FIXTURE SELECTOR WAS A PROXY FOR THE WRITER, AND IT STOPPED
DISCRIMINATING THE DAY W1 SHIPPED** (APWorld hub H4a, 2026-09-05). It selected
"a COMPACT spliced `tiles` array" and called that set JS-written — true at W1,
because the Python splice had written **0** committed files (gotchas.md's
"three formatting lineages" table). W1's own fix is what gave the Python writer
compact tiles, so the first Python-exported preset carrying a maze payload lands
in that set too: H4a's four-player fixture reddened row 3 on three files
(`multiworld/AP_05594871498841892311/…_P1`, `…_P2`, the combined) that have no
trailing newline **and should not have one** — the exporter wrote them.

⇒ the set is named for what it MEASURES (`SPLICED`), and the writer is
identified by a MECHANISM instead: `Generate.py` writes an `AP_*.archipelago`
beside its `rules.json` and the node writer cannot produce one. Measured over
all 210 committed presets: of the **177** with such a sibling, **0** carry a
trailing newline. That makes row 3 stronger than it was — it now drives BOTH
halves of its own sentence over real documents, where before it drove one.
"""

import glob
import importlib.util
import json
import os
import re
import unittest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRESETS = os.path.join(REPO, 'frontend', 'presets')


def _dump_rules():
    """The real `_dump_with_compact_sidecar_tiles`, via the sibling row's extractor.

    ⛔ Re-implementing the extraction here would give this module its own copy
    to drift; `test_rules_json_indent` already reads the two helpers out of the
    real `exporter.py` (never a copy), so this borrows that one loader.
    """
    path = os.path.join(REPO, 'test', 'test_rules_json_indent.py')
    spec = importlib.util.spec_from_file_location('_rules_json_indent_row', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.dump_rules


dump_rules = _dump_rules()

_TILES = re.compile(r'"tiles":\s*(.{0,24})', re.S)


def _preset_texts():
    """Every committed `AP_*_rules.json`, read as text, path-sorted."""
    pattern = os.path.join(PRESETS, '*', 'AP_*', 'AP_*_rules.json')
    for path in sorted(glob.glob(pattern)):
        with open(path, encoding='utf-8') as handle:
            yield path, handle.read()


def _spliced_presets():
    """The presets whose spliced `tiles` array is COMPACT.

    `[0,0,…]` is what BOTH writers emit since W1; `[0, 0, …]` would be Python's DEFAULT
    `json.dumps`; `[\\n    0,` is a document no splice ever ran over. Measured
    2026-08-25 at `956af2029`: 16 compact, 0 Python-spliced, 7 exploded, and 11
    more that carry a `playable_payload` with no `tiles` array at all — and
    re-measured 2026-09-05: **19** compact, of which **3** are Python-spliced
    (the first ever committed). ⛔ This set is therefore about the SPLICE, not
    the writer; see the module docblock and `_exporter_written` below.
    """
    out = []
    for path, text in _preset_texts():
        match = _TILES.search(text)
        if match and re.match(r'\[-?\d+,-?\d', match.group(1)):
            out.append((path, text))
    return out


def _exporter_written(path):
    """Did `Generate.py` write this preset directory?

    ⚓ THE MECHANISM, not a name pattern: the Python export path writes an
    `AP_*.archipelago` beside the `rules.json` (it is the multiworld archive the
    server serves), and `scripts/utils/generate-procgen-rules.js` writes a
    rules.json and nothing else. Measured over all committed presets: of the 177
    with such a sibling, 0 carry a trailing newline.
    """
    return bool(glob.glob(os.path.join(os.path.dirname(path), 'AP_*.archipelago')))


def _non_ascii_presets():
    """The presets that carry a character `json.dumps` would escape."""
    return [(path, text) for path, text in _preset_texts()
            if any(ord(char) > 127 for char in text)]


SPLICED = _spliced_presets()
NON_ASCII = _non_ascii_presets()
# ⛓ Every committed preset, split by the write site that produced it.
EXPORTER_WRITTEN = [(p, t) for p, t in _preset_texts() if _exporter_written(p)]
NODE_SPLICED = [(p, t) for p, t in SPLICED if not _exporter_written(p)]


class TestRulesJsonWriterAgreement(unittest.TestCase):
    def test_the_derived_fixture_sets_are_not_empty(self):
        """⛔ A scan that finds nothing would make every row below vacuous."""
        self.assertTrue(SPLICED, 'no compact-spliced preset found under frontend/presets/')
        self.assertTrue(NON_ASCII, 'no non-ASCII preset found under frontend/presets/')
        # ⛔ Row 3 drives BOTH write sites, so BOTH halves must be non-empty —
        #    a split that collapsed to one side would make its other half vacuous.
        self.assertTrue(NODE_SPLICED, 'no node-written spliced preset found')
        self.assertTrue(EXPORTER_WRITTEN, 'no Generate.py-written preset found')

    def test_a_python_redump_is_byte_equal_to_what_js_wrote(self):
        """The whole claim, on the real corpus: same document in, same bytes out."""
        for path, text in SPLICED:
            with self.subTest(path=os.path.relpath(path, REPO)):
                redump = dump_rules(json.loads(text), indent=2)
                self.assertEqual(redump, text.rstrip('\n'))

    def test_the_spliced_tiles_arrays_are_compact(self):
        """Row 1 alone — the fact the `separators` fix is about."""
        for path, text in SPLICED:
            with self.subTest(path=os.path.relpath(path, REPO)):
                redump = dump_rules(json.loads(text), indent=2)
                self.assertNotIn('"tiles": [0, 0', redump)
                self.assertNotIn('"tiles": [1, 1', redump)
                for line in text.split('\n'):
                    if '"tiles":' in line:
                        self.assertIn(line.strip(), redump)

    def test_non_ascii_round_trips_unescaped(self):
        """Row 2 alone — the fact the `ensure_ascii=False` fix is about."""
        for path, text in NON_ASCII:
            with self.subTest(path=os.path.relpath(path, REPO)):
                redump = dump_rules(json.loads(text), indent=2)
                literal = {char for char in text if ord(char) > 127}
                self.assertTrue(literal)
                for char in sorted(literal):
                    self.assertIn(char, redump)
                    self.assertNotIn('\\u%04x' % ord(char), redump)

    def test_the_trailing_newline_belongs_to_the_write_site(self):
        """Neither writer emits one; the node write site appends it and the
        Python one does not — both halves, over real documents."""
        # (a) THE WRITER never emits one, whoever wrote the file.
        for path, text in SPLICED:
            with self.subTest(path=os.path.relpath(path, REPO)):
                self.assertFalse(dump_rules(json.loads(text), indent=2).endswith('\n'))
        # (b) THE NODE WRITE SITE appends it.
        for path, text in NODE_SPLICED:
            with self.subTest(path=os.path.relpath(path, REPO), site='node'):
                self.assertTrue(text.endswith('\n'))
        with open(os.path.join(REPO, 'scripts', 'utils',
                               'generate-procgen-rules.js'), encoding='utf-8') as handle:
            self.assertIn("text + '\\n'", handle.read())
        # (c) THE PYTHON WRITE SITE does not — which is why `rstrip('\n')` above
        #     is "modulo exactly one character" and not "modulo whitespace".
        for path, text in EXPORTER_WRITTEN:
            with self.subTest(path=os.path.relpath(path, REPO), site='Generate.py'):
                self.assertFalse(text.endswith('\n'))

    def test_the_write_site_opens_utf8_which_is_what_makes_ensure_ascii_safe(self):
        """⛔ `ensure_ascii=False` on a stream opened in the platform encoding
        would raise on `§` under a non-UTF-8 locale. It does not, and this row
        is why the docblock may say so."""
        with open(os.path.join(REPO, 'exporter', 'exporter.py'), encoding='utf-8') as handle:
            source = handle.read()
        anchor = source.index('_dump_with_compact_sidecar_tiles(\n                    filtered_data')
        self.assertIn("open(filepath, 'w', encoding='utf-8')", source[anchor - 400:anchor])


if __name__ == '__main__':
    unittest.main()
