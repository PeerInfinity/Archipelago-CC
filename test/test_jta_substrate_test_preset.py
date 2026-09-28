"""The jta_substrate_test preset is a FIXED POINT of its generator.

`frontend/presets/jta_substrate_test/AP_14089154938208861744/…_rules.json` is
written by `scripts/test/generate-jta-substrate-test-preset.py`, which DERIVES it
from the `jta_vanilla` preset (its regions, items and rules) and adds the
sidecars and `loop_costs`. The source was refreshed to AP 0.6.8 on 2026-06-27
(`6b60ae8e49`) while this preset was last written 2026-05-23 (`a3a3afa007`), so
for four months the tracked file described an older export than its own
generator would write — nothing noticed, because nothing ran the script
(APWORLD SUBSTRATE CHANGE P1a §37.x #4 measured it; P1b′ re-recorded it).

This is `test_jta_mixed_test_preset.py`'s pin, for the second preset of the
family: run into a temp dir with `--out`, compared byte for byte (the tracked
file is never written). A change to either `jta_vanilla` or the script now reds
here until the preset is re-recorded THROUGH the script.
"""

import os
import subprocess
import sys
import tempfile
import unittest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(REPO, 'scripts', 'test', 'generate-jta-substrate-test-preset.py')
TRACKED = os.path.join(
    REPO, 'frontend', 'presets', 'jta_substrate_test', 'AP_14089154938208861744',
    'AP_14089154938208861744_rules.json')


class JtaSubstrateTestPresetFixedPoint(unittest.TestCase):

    def test_the_script_reproduces_the_tracked_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, 'AP_14089154938208861744_rules.json')
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
            'generate-jta-substrate-test-preset.py no longer reproduces the tracked '
            'preset (its source is jta_vanilla): re-record it through the script, '
            'never edit one side alone',
        )


if __name__ == '__main__':
    unittest.main()
