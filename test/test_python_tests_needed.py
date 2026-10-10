"""`scripts/test/python-tests-needed.py` gates `unittests.yml` on pushes: these
rows pin which paths may skip the Python matrix and which must not."""
import importlib.util
import os
import unittest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location(
    'python_tests_needed', os.path.join(REPO, 'scripts', 'test', 'python-tests-needed.py'))
assert _spec is not None and _spec.loader is not None
gate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gate)


class TestPythonTestsNeeded(unittest.TestCase):
    def test_js_only_push_skips(self):
        self.assertFalse(gate.needed([
            'frontend/modules/procgenCore/levelRun.js',
            'scripts/procgen/standing-values.json',
            'scripts/procgen/ci-gates.mjs',
            'test_json/unit/foo.test.js',
            'README.md',
            'CC/docs/plans/x.md',
        ]))

    def test_paths_pytest_reads_run(self):
        for path in (
            'frontend/presets/seedling/AP_1/AP_1_rules.json',
            'frontend/schema/rules.schema.json',
            'scripts/utils/generate-procgen-rules.js',
            'scripts/test/generate-jta-mixed-test-preset.py',
            'scripts/data/template-exclude-list.json',
            'scripts/procgen/some-driver.py',
            'worlds/seedling_playthrough/docs/en_Seedling.md',
            '.gitmodules',
            '.github/workflows/unittests.yml',
            'Main.py',
        ):
            with self.subTest(path=path):
                self.assertTrue(gate.needed(['frontend/x.js', path]))

    def test_empty_list_runs(self):
        self.assertTrue(gate.needed([]))
        self.assertTrue(gate.needed(['', '  ']))


if __name__ == '__main__':
    unittest.main()
