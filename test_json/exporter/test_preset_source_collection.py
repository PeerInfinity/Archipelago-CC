"""The preset copy takes THIS generation's artifacts from the shared output
directory by exact name — never by seed-name prefix.

Seed names collide across generations: a 4-player multiworld at --seed 1 and
every single-player --seed 1 preset share AP_14089154938208861744. The 2026-08-30
baseline generate-presets run swept the multiworld's stale AP_<seed>_P1..P4
rules files into 148 single-player preset dirs because the collector matched
``startswith(seed) and endswith(suffix)``. These tests pin the by-name rule.
"""
import os

import pytest

from exporter.exporter import _collect_preset_source_files, _preset_artifact_names

SEED = "AP_14089154938208861744"


def _touch(directory, *names):
    for name in names:
        with open(os.path.join(directory, name), "w", encoding="utf-8") as f:
            f.write("{}")


@pytest.fixture
def output_dir(tmp_path):
    out = tmp_path / "output"
    out.mkdir()
    # This generation's own artifacts.
    _touch(out, f"{SEED}_rules.json", f"{SEED}_rules-ast.json", f"{SEED}_sphere_log.jsonl")
    # Stale per-player artifacts from an EARLIER multiworld generation of the
    # same seed name — exactly the leak.
    _touch(out, f"{SEED}_P1_rules.json", f"{SEED}_P2_rules.json", f"{SEED}_P3_rules.json",
           f"{SEED}_P4_rules.json", f"{SEED}_P1_rules-ast.json")
    # Another seed entirely, and non-preset files of this seed.
    _touch(out, "AP_01043188731678011336_rules.json", f"{SEED}.zip", f"{SEED}_Spoiler.txt")
    return out


def _names(paths):
    return sorted(os.path.basename(p) for p in paths)


def test_single_player_takes_only_its_own_three_artifacts(output_dir):
    got = _names(_collect_preset_source_files(str(output_dir), None, SEED, [1]))
    assert got == [f"{SEED}_rules-ast.json", f"{SEED}_rules.json", f"{SEED}_sphere_log.jsonl"]


def test_single_player_default_player_ids_is_single(output_dir):
    """Callers that predate the player_ids argument behave as single-player."""
    got = _names(_collect_preset_source_files(str(output_dir), None, SEED))
    assert not [n for n in got if "_P" in n]


def test_multiworld_takes_exactly_its_players_files(output_dir):
    got = _names(_collect_preset_source_files(str(output_dir), None, SEED, [1, 2]))
    assert got == [
        f"{SEED}_P1_rules-ast.json", f"{SEED}_P1_rules.json", f"{SEED}_P2_rules.json",
        f"{SEED}_rules-ast.json", f"{SEED}_rules.json", f"{SEED}_sphere_log.jsonl",
    ]
    # P3/P4 belong to a different generation of the same seed name.
    assert not any("_P3_" in n or "_P4_" in n for n in got)


def test_other_seeds_and_non_artifacts_never_taken(output_dir):
    got = _names(_collect_preset_source_files(str(output_dir), None, SEED, [1, 2, 3, 4]))
    assert "AP_01043188731678011336_rules.json" not in got
    assert f"{SEED}.zip" not in got and f"{SEED}_Spoiler.txt" not in got


def test_staging_dir_is_still_mirrored_whole(output_dir, tmp_path):
    staging = tmp_path / "staging"
    staging.mkdir()
    _touch(staging, f"{SEED}.archipelago", f"{SEED}_Spoiler.txt", f"{SEED}_P1_Player1.apadvn")
    got = _names(_collect_preset_source_files(str(output_dir), str(staging), SEED, [1]))
    assert {f"{SEED}.archipelago", f"{SEED}_Spoiler.txt", f"{SEED}_P1_Player1.apadvn"} <= set(got)
    assert f"{SEED}_P1_rules.json" not in got


def test_artifact_names_single_vs_multi():
    assert _preset_artifact_names(SEED) == [
        f"{SEED}_rules.json", f"{SEED}_rules-ast.json", f"{SEED}_sphere_log.jsonl"]
    multi = _preset_artifact_names(SEED, [1, 2])
    assert f"{SEED}_P1_rules.json" in multi and f"{SEED}_P2_rules-ast.json" in multi
    assert f"{SEED}_P3_rules.json" not in multi
    # One player is not a multiworld: no per-player files expected.
    assert _preset_artifact_names(SEED, [1]) == _preset_artifact_names(SEED)
