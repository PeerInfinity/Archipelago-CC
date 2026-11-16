#!/usr/bin/env python3
"""The standing spoiler-test row for the Upstream Rules Add-on's stripped documents.

usage: python scripts/test/upstream_rules_addon_spoiler_row.py [--only <id> ...] [--out <dir>] [--port N]
       (a static server for this tree must be up on --port, default 8000; `npm ci` and Playwright's chromium
       installed)

For each roster preset, three kinds of run, each one `npm test -- --mode=test-spoilers --rules=<copy>`:
- C (control): the preset re-serialised, nothing removed. A red control means the game's own spoiler test is red;
  the row stops there for that preset and the job fails (nothing else about it can be read).
- ADDON: the preset after the add-on's OWN strips (worlds/upstream_rules_addon/_addon.py ``strip``, which runs
  ``strip_room`` and ``_unused_fields.strip_unused``), with placements KEPT: this measures whether the logic the
  client builds from the stripped document is the same, not the overlay. It must pass.
- NEG (one preset): every location's access_rule removed. It must FAIL, or the row cannot see a broken document.

With an override, the spoiler test reads the sphere log from the override's own folder
(spoilerTest/fileLoader.js deriveSphereLogPath), so each copy gets its preset's .jsonl beside it.

The roster is the strip sweep's proposal (sdc-strip-spoiler-sweep, 2026-11-16): games whose UNSTRIPPED spoiler
test passes and which cover every reader the sweep found: kh2 (option_definitions via use_current_key), sm (item
type), alttp (top-level dungeons), sc2 and soe (JS-helper games), tunic, a multiworld --player row, apquest, and
one embedded-log procgen preset. None is on the template main_test_exclude_list.
"""
import argparse
import importlib.util
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import types
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PRESETS = REPO / "frontend" / "presets"
ADDON_DIR = REPO / "worlds" / "upstream_rules_addon"
RESULTS = REPO / "test-results" / "in-app-tests"
#: The app resolves --rules from frontend/ (as its presets: ./presets/...), so the copies live under frontend/. The
#: folder is removed before and after every run.
WORK = "upstream-rules-addon-row"
RUN_TIMEOUT = int(os.environ.get("UPSTREAM_RULES_ADDON_ROW_TIMEOUT", "480"))

#: (game folder, preset folder, rules file, --player or None)
ROSTER = [
    ("kh2", "AP_14089154938208861744", "AP_14089154938208861744_rules.json", None),
    ("sm", "AP_14089154938208861744", "AP_14089154938208861744_rules.json", None),
    ("alttp", "AP_14089154938208861744", "AP_14089154938208861744_rules.json", None),
    ("sc2", "AP_14089154938208861744", "AP_14089154938208861744_rules.json", None),
    ("soe", "AP_14089154938208861744", "AP_14089154938208861744_rules.json", None),
    ("tunic", "AP_14089154938208861744", "AP_14089154938208861744_rules.json", None),
    ("multiworld", "AP_14089154938208861744", "AP_14089154938208861744_P2_rules.json", 2),
    ("apquest", "AP_14089154938208861744", "AP_14089154938208861744_rules.json", None),
    ("procgen_maze", "AP_2", "AP_2_rules.json", None),
]
NEG_ROW = "alttp"


def load_addon_strip():
    """The add-on's ``_addon.strip`` without running its ``__init__`` (which needs Archipelago): a bare package
    whose path is the add-on's folder, then its stdlib-only ``_addon`` module."""
    name = "_upstream_rules_addon_source"
    package = types.ModuleType(name)
    package.__path__ = [str(ADDON_DIR)]
    sys.modules[name] = package
    spec = importlib.util.spec_from_file_location(f"{name}._addon", ADDON_DIR / "_addon.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return lambda doc: module.strip(doc, lambda d: d)


def drop_location_rules(doc):
    for regions in (doc.get("regions") or {}).values():
        for region in (regions.values() if isinstance(regions, dict) else regions):
            for location in region.get("locations") or ():
                location.pop("access_rule", None)
    return doc


def seed_of(game, folder):
    files = json.loads((PRESETS / "preset_files.json").read_text(encoding="utf-8"))
    entry = ((files.get(game) or {}).get("folders") or {}).get(folder)
    if entry is None:
        raise SystemExit(f"{game}/{folder} is not listed in preset_files.json (an unlisted game false-passes)")
    return entry.get("seed")


def write_copy(kind, game, folder, file, doc):
    """<WORK>/<kind>/<game>/<folder>/<file>, with the preset's sphere log beside it (when it has a .jsonl)."""
    target_dir = REPO / "frontend" / WORK / kind / game / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / file).write_text(json.dumps(doc), encoding="utf-8")
    base = re.match(r"^(.*?)(?:_P\d+)?_rules\.json$", file).group(1)
    log = PRESETS / game / folder / f"{base}_sphere_log.jsonl"
    if log.is_file():
        shutil.copyfile(log, target_dir / log.name)
    return f"./{WORK}/{kind}/{game}/{folder}/{file}"


def newest_result():
    if not RESULTS.is_dir():
        return None
    files = sorted(p.name for p in RESULTS.glob("test-results-*.json"))
    return files[-1] if files else None


def run(kind, game, rules, seed, player, port, out_dir):
    cmd = ["npm", "test", "--", "--mode=test-spoilers", f"--game={game}", f"--rules={rules}", f"--port={port}"]
    if seed is not None:
        cmd.append(f"--seed={seed}")
    if player:
        cmd.append(f"--player={player}")
    before = newest_result()
    started = time.time()
    proc = subprocess.Popen(cmd, cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        out, _ = proc.communicate(timeout=RUN_TIMEOUT)
        timed_out = False
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        out, _ = proc.communicate()
        timed_out = True
    record = {"kind": kind, "game": game, "rules": rules, "exit": proc.returncode, "timed_out": timed_out,
              "secs": round(time.time() - started, 1)}
    after = newest_result()
    if after and after != before:
        data = json.loads((RESULTS / after).read_text(encoding="utf-8"))
        test = (data.get("testDetails") or [{}])[0]
        for line in test.get("logs", []):
            found = re.search(r"DEBUG detailedResults: (\{.*\})", line.get("message", ""))
            if found:
                try:
                    detail = json.loads(found.group(1))
                except ValueError:
                    continue
                record.update({k: detail.get(k) for k in ("passed", "processedEvents", "totalEvents", "testLogPath")})
        shutil.move(str(RESULTS / after), str(out_dir / f"{kind}__{game}.json"))
    # A run that tested some other file (the override did not load, and the app fell back to a default preset) is a
    # FAIL whatever it says: measured on the first CI run, every row read ./presets/action_nodes_example.
    record["read_our_copy"] = str(record.get("testLogPath") or "").startswith(rules.rsplit("/", 1)[0])
    record["verdict"] = ("PASS" if proc.returncode == 0 and record.get("passed") is True and record["read_our_copy"]
                         else "FAIL")
    if record["verdict"] == "FAIL":
        (out_dir / f"{kind}__{game}.log").write_text(out.decode("utf-8", "replace")[-200000:], encoding="utf-8")
    return record


def main(argv=None):
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--only", nargs="*", help="roster game folders to run (default: all)")
    parser.add_argument("--out", type=Path, default=REPO / "test-results" / "upstream-rules-addon-row-out")
    parser.add_argument("--port", type=int, default=int(os.environ.get("TEST_PORT", "8000")))
    args = parser.parse_args(argv)
    strip = load_addon_strip()
    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(REPO / "frontend" / WORK, ignore_errors=True)
    records, problems = [], []
    try:
        run_roster(args, strip, out_dir, records, problems)
    finally:
        shutil.rmtree(REPO / "frontend" / WORK, ignore_errors=True)
    (out_dir / "results.json").write_text(json.dumps(records, indent=1), encoding="utf-8")
    print(f"{len(records)} run(s), {len(problems)} problem(s)")
    for problem in problems:
        print("  FAIL", problem)
    return 1 if problems else 0


def run_roster(args, strip, out_dir, records, problems):
    for game, folder, file, player in ROSTER:
        if args.only and game not in args.only:
            continue
        seed = seed_of(game, folder)
        original = json.loads((PRESETS / game / folder / file).read_text(encoding="utf-8"))
        kinds = [("C", json.loads(json.dumps(original))), ("ADDON", strip(json.loads(json.dumps(original))))]
        if game == NEG_ROW:
            kinds.append(("NEG", drop_location_rules(json.loads(json.dumps(original)))))
        for kind, doc in kinds:
            record = run(kind, game, write_copy(kind, game, folder, file, doc), seed, player, args.port, out_dir)
            records.append(record)
            print(f"{kind:5s} {record['verdict']} {record.get('processedEvents')}/{record.get('totalEvents')} "
                  f"{record['secs']}s {game}/{folder}/{file}", flush=True)
            if kind == "C" and record["verdict"] != "PASS":
                problems.append(f"{game}: the UNSTRIPPED control is red, so this preset's own spoiler test fails")
                break
            if kind == "ADDON" and record["verdict"] != "PASS":
                problems.append(f"{game}: the add-on's stripped document fails the spoiler test where the full one "
                                f"passes; a field in worlds/upstream_rules_addon/_unused_fields.py is read")
            if kind == "NEG" and (record.get("passed") is not False or not record["read_our_copy"]):
                problems.append(f"{game}: the negative control (location rules removed) PASSED; the row cannot see "
                                f"a broken document")


if __name__ == "__main__":
    sys.exit(main())
