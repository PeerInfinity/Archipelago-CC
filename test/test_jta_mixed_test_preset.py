"""The jta_mixed_test preset is a FIXED POINT of its generator.

`frontend/presets/jta_mixed_test/AP_1/AP_1_rules.json` is hand-authored by
`scripts/test/generate-jta-mixed-test-preset.py`. The preset was once fixed
in place (31d515e2c6: three schema fields) while the script kept the old
values, so re-running the script silently reverted a schema fix — nothing
noticed, because nothing ran the script. The generated `procgen_topdown`
presets have their fixed point checked by regenerating them; this script had
no such row.

Lives in `test/` (the repo-level pytest tree CI collects) rather than beside
the script: `scripts/test/` holds drivers, not collected tests, and the
check is Python running Python.

Two rows:

1. **THE SCRIPT REPRODUCES THE TRACKED BYTES** — run into a temp dir with
   `--out`, compared byte for byte (the tracked file is never written).
2. **`AdventureZone` KEEPS `manaEnabled`** — `check-ta-mana-leg.mjs` and the
   loops mana sync load this preset's text-adventure region as a
   mana-enabled region; a payload re-shape must not drop the flag.
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(REPO, 'scripts', 'test', 'generate-jta-mixed-test-preset.py')
TRACKED = os.path.join(REPO, 'frontend', 'presets', 'jta_mixed_test', 'AP_1', 'AP_1_rules.json')


class JtaMixedTestPresetFixedPoint(unittest.TestCase):

    def test_the_script_reproduces_the_tracked_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, 'AP_1_rules.json')
            result = subprocess.run(
                [sys.executable, SCRIPT, '--out', out],
                cwd=REPO, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            with open(out, 'rb') as handle:
                generated = handle.read()
        with open(TRACKED, 'rb') as handle:
            tracked = handle.read()
        self.assertEqual(
            generated, tracked,
            'generate-jta-mixed-test-preset.py no longer reproduces the tracked '
            'preset: regenerate it through the script (or fold the preset\'s '
            'change into the script), never edit one side alone',
        )

    def test_the_text_adventure_region_keeps_mana_enabled(self):
        with open(TRACKED, encoding='utf-8') as handle:
            rules = json.load(handle)
        sidecars = rules['preset_sidecars']['1']
        text_adventure = [name for name, entry in sidecars.items()
                          if entry.get('substrate') == 'text_adventure']
        self.assertEqual(text_adventure, ['AdventureZone'])
        self.assertIs(sidecars['AdventureZone']['playable_payload'].get('manaEnabled'), True)


if __name__ == '__main__':
    unittest.main()
