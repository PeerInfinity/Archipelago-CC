#!/usr/bin/env python3
"""
Register a rules.json file as a preset directory.

Stages a frontend-emitted rules.json (e.g. from the procgen pipeline's
"Download rules.json" / "Load into frontend" buttons) into the standard
preset directory layout and registers it in
frontend/presets/preset_files.json so the frontend's preset loader can
find it.

Resulting layout:

    frontend/presets/{game_id}/AP_{seed_id}/AP_{seed_id}_rules.json

and a matching preset_files.json entry of the form:

    "{game_id}": {
        "name": "{game_name}",
        "folders": {
            "AP_{seed_id}": {
                "seed": <generation_seed>,
                "games": [{"player": 1, "name": "{player_name}", "game": "{game}"}],
                "files": ["AP_{seed_id}_rules.json"]
            }
        }
    }

Existing entries are updated in place, preserving the file's existing
key order. New entries are appended at the end. Re-running on the same
arguments is idempotent.

Usage examples:

    # Register frontend/downloads/AP_1_rules.json as procgen_maze/AP_1
    scripts/utils/register-preset.py frontend/downloads/AP_1_rules.json \\
        --game-id procgen_maze

    # Override metadata
    scripts/utils/register-preset.py path/to/rules.json \\
        --game-id procgen_maze --game-name "Procgen Maze" --seed-id 1

The script reads game_name, generation_seed, and player_names from the
rules.json itself, so most invocations need only --game-id (and the
file path).
"""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PRESETS_DIR = PROJECT_ROOT / "frontend" / "presets"
DEFAULT_PRESET_FILES = DEFAULT_PRESETS_DIR / "preset_files.json"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("rules_json", help="Path to the rules.json file to register")
    p.add_argument(
        "--game-id",
        required=True,
        help="Preset directory name and preset_files.json key (e.g. 'procgen_maze')",
    )
    p.add_argument(
        "--seed-id",
        default=None,
        help=(
            "Seed id used in the AP_<seed_id> folder/file prefix. "
            "Defaults to the basename's 'AP_<X>' prefix if present, "
            "else 'AP_<generation_seed>' from the rules.json."
        ),
    )
    p.add_argument(
        "--game-name",
        default=None,
        help="Human-readable game name. Defaults to the rules.json's 'game_name'.",
    )
    p.add_argument(
        "--player-name",
        default=None,
        help=(
            "Player 1's display name. Defaults to player_names['1'] from "
            "the rules.json, falling back to 'Player1'."
        ),
    )
    p.add_argument(
        "--game",
        default=None,
        help=(
            "The 'game' string in the per-player entry (often the same as "
            "--game-name). Defaults to --game-name."
        ),
    )
    p.add_argument(
        "--presets-dir",
        default=str(DEFAULT_PRESETS_DIR),
        help=f"Presets directory (default: {DEFAULT_PRESETS_DIR})",
    )
    p.add_argument(
        "--preset-files",
        default=str(DEFAULT_PRESET_FILES),
        help=f"preset_files.json path (default: {DEFAULT_PRESET_FILES})",
    )
    p.add_argument(
        "--move",
        action="store_true",
        help="Move the rules.json instead of copying it.",
    )
    p.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an existing destination file.",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would happen without writing anything.",
    )
    return p.parse_args()


def derive_seed_id(rules_path: Path, rules_data: dict, override: Optional[str]) -> str:
    if override:
        return override.removeprefix("AP_") if override.startswith("AP_") else override
    # Try to lift the seed id from the source filename: "AP_1_rules.json" -> "1".
    m = re.match(r"AP_([^_]+)_rules\.json$", rules_path.name)
    if m:
        return m.group(1)
    seed = rules_data.get("generation_seed")
    if seed is None:
        raise SystemExit(
            f"register-preset: cannot derive seed id from '{rules_path.name}' "
            "and rules.json has no 'generation_seed'. Pass --seed-id."
        )
    return str(seed)


def derive_game_name(rules_data: dict, override: Optional[str]) -> str:
    if override:
        return override
    name = rules_data.get("game_name")
    if not name:
        raise SystemExit(
            "register-preset: rules.json has no 'game_name'. Pass --game-name."
        )
    return name


def derive_player_name(rules_data: dict, override: Optional[str]) -> str:
    if override:
        return override
    return (rules_data.get("player_names") or {}).get("1", "Player1")


def stage_rules_file(
    src: Path, dest: Path, *, move: bool, force: bool, dry_run: bool
) -> None:
    if dest.exists() and not force:
        if dest.resolve() == src.resolve():
            print(f"  (source and destination are the same file: {dest}; nothing to copy)")
            return
        raise SystemExit(
            f"register-preset: destination '{dest}' already exists. "
            "Pass --force to overwrite."
        )
    action = "Move" if move else "Copy"
    print(f"  {action} {src} -> {dest}")
    if dry_run:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    if move:
        shutil.move(str(src), str(dest))
    else:
        shutil.copy2(str(src), str(dest))


def update_preset_files(
    preset_files_path: Path,
    *,
    game_id: str,
    game_name: str,
    seed_id: str,
    seed_int: Optional[int],
    player_name: str,
    game: str,
    has_procgen_data: bool,
    dry_run: bool,
) -> None:
    if preset_files_path.exists():
        with open(preset_files_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {}

    folder_key = f"AP_{seed_id}"
    file_prefix = f"AP_{seed_id}"
    new_folder_entry = {
        "seed": seed_int if seed_int is not None else seed_id,
        "games": [
            {"player": 1, "name": player_name, "game": game},
        ],
        "files": [f"{file_prefix}_rules.json"],
    }
    # Procgen data flag — true when the rules.json carries
    # preset_sidecars. Absent = false. See NewDocs/plans/
    # presets-panel-overhaul.md §"Procgen detection at index time".
    if has_procgen_data:
        new_folder_entry["has_procgen_data"] = True

    game_entry = data.get(game_id)
    if game_entry is None:
        # New top-level entry, appended at the end of the file.
        print(f"  Add new preset_files entry: '{game_id}'")
        data[game_id] = {
            "name": game_name,
            "folders": {folder_key: new_folder_entry},
        }
    else:
        # Update name in place; merge folder.
        if game_entry.get("name") != game_name:
            print(f"  Update '{game_id}'.name: {game_entry.get('name')!r} -> {game_name!r}")
            game_entry["name"] = game_name
        folders = game_entry.setdefault("folders", {})
        if folder_key in folders:
            print(f"  Update folder '{folder_key}' under '{game_id}'")
        else:
            print(f"  Add folder '{folder_key}' under '{game_id}'")
        folders[folder_key] = new_folder_entry

    if dry_run:
        print("  (dry-run: preset_files.json not written)")
        return
    with open(preset_files_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=False)
        f.write("\n")


def main() -> int:
    args = parse_args()

    rules_path = Path(args.rules_json).resolve()
    if not rules_path.is_file():
        print(f"register-preset: not a file: {rules_path}", file=sys.stderr)
        return 1

    with open(rules_path, "r", encoding="utf-8") as f:
        rules_data = json.load(f)

    seed_id = derive_seed_id(rules_path, rules_data, args.seed_id)
    game_name = derive_game_name(rules_data, args.game_name)
    player_name = derive_player_name(rules_data, args.player_name)
    game = args.game or game_name
    seed_int = rules_data.get("generation_seed")
    if not isinstance(seed_int, int):
        seed_int = None

    presets_dir = Path(args.presets_dir).resolve()
    preset_files_path = Path(args.preset_files).resolve()

    folder_name = f"AP_{seed_id}"
    file_basename = f"AP_{seed_id}_rules.json"
    dest_dir = presets_dir / args.game_id / folder_name
    dest_file = dest_dir / file_basename

    print(f"register-preset:")
    print(f"  source        = {rules_path}")
    print(f"  game_id       = {args.game_id}")
    print(f"  game_name     = {game_name}")
    print(f"  game (label)  = {game}")
    print(f"  player_name   = {player_name}")
    print(f"  seed_id       = {seed_id}")
    print(f"  seed (int)    = {seed_int}")
    print(f"  destination   = {dest_file}")

    stage_rules_file(
        rules_path, dest_file,
        move=args.move, force=args.force, dry_run=args.dry_run,
    )
    preset_sidecars = rules_data.get("preset_sidecars")
    has_procgen_data = bool(preset_sidecars) and len(preset_sidecars) > 0
    update_preset_files(
        preset_files_path,
        game_id=args.game_id,
        game_name=game_name,
        seed_id=seed_id,
        seed_int=seed_int,
        player_name=player_name,
        game=game,
        has_procgen_data=has_procgen_data,
        dry_run=args.dry_run,
    )

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
