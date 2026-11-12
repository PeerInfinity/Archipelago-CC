"""register-preset.py writes the row `seed` that `?seed=` selects.

The page's `findRulesFileFromGameSeed` (frontend/app/mode/modeDataLoader.js) picks a
preset folder by `String(row.seed) === String(?seed=)`. A short folder id (AP_1) is the
seed the page is asked for, so its row must carry that id even when the rules were
generated with another seed; a 20-digit Archipelago folder keeps its generation seed.
content-r3 found meta_trial (folder AP_1, generation seed 8) written as `seed: 8`, so
`?game=meta_trial&seed=1` silently loaded the default preset.

Nothing here writes to the tree: the end-to-end case runs the script into tmp_path.
"""

import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "utils" / "register-preset.py"
PRESETS = ROOT / "frontend" / "presets"


def _load_script():
    spec = importlib.util.spec_from_file_location("register_preset", SCRIPT)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


register_preset = _load_script()


def _find_rules_file_from_game_seed(preset_files, game, seed):
    """Python mirror of the page's folder match (first folder whose seed matches)."""
    for folder, data in preset_files[game]["folders"].items():
        if data.get("seed") and str(data["seed"]) == str(seed):
            return folder
    return None


@pytest.mark.parametrize("gen_seed", [1, 3])
def test_long_archipelago_id_keeps_generation_seed(gen_seed):
    assert register_preset.row_seed("14089154938208861744", gen_seed) == gen_seed


def test_short_id_with_other_generation_seed_gets_folder_id():
    assert register_preset.row_seed("1", 8) == 1


def test_non_numeric_id_unchanged():
    assert register_preset.row_seed("test", 5) == 5
    assert register_preset.row_seed("test", None) == "test"


def test_end_to_end_short_id_row_resolves_seed_param(tmp_path):
    rules = tmp_path / "src" / "AP_1_rules.json"
    rules.parent.mkdir()
    rules.write_text(json.dumps({"game_name": "Meta Trial", "generation_seed": 8}))
    preset_files = tmp_path / "preset_files.json"
    out = subprocess.run(
        [sys.executable, str(SCRIPT), str(rules), "--game-id", "meta_trial",
         "--seed-id", "1", "--presets-dir", str(tmp_path / "presets"),
         "--preset-files", str(preset_files)],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(preset_files.read_text())
    assert data["meta_trial"]["folders"]["AP_1"]["seed"] == 1
    assert _find_rules_file_from_game_seed(data, "meta_trial", 1) == "AP_1"
    assert "NOTE: seed field = 1 (folder id); rules generation_seed = 8" in out
    assert (tmp_path / "presets" / "meta_trial" / "AP_1" / "AP_1_rules.json").is_file()


def test_committed_meta_trial_row_resolves_seed_1():
    data = json.loads((PRESETS / "preset_files.json").read_text(encoding="utf-8"))
    assert _find_rules_file_from_game_seed(data, "meta_trial", 1) == "AP_1"


GEN_SEED = re.compile(rb'"generation_seed"\s*:\s*(-?\d+|null)')


def test_rule_reproduces_every_committed_row():
    """Byte-identity of the rule: for every committed row, row_seed(folder id, the
    rules' generation_seed) is exactly the committed `seed`."""
    data = json.loads((PRESETS / "preset_files.json").read_text(encoding="utf-8"))
    checked = 0
    mismatches = []
    for game, entry in data.items():
        for folder, row in (entry.get("folders") or {}).items():
            m = re.match(r"AP_(.+)$", folder)
            rules = PRESETS / game / folder / f"{folder}_rules.json"
            if not m or not rules.is_file():
                continue
            with open(rules, "rb") as f:
                head = f.read(65536)
            g = GEN_SEED.search(head)
            if not g:
                continue
            gen = None if g.group(1) == b"null" else int(g.group(1))
            want = register_preset.row_seed(m.group(1), gen)
            checked += 1
            if want != row["seed"] or type(want) is not type(row["seed"]):
                mismatches.append((game, folder, row["seed"], want))
    assert checked > 100, checked
    assert mismatches == []
