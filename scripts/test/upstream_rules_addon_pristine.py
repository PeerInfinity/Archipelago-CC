#!/usr/bin/env python3
"""The Upstream Rules Add-on on a PRISTINE upstream Archipelago: generate rooms with the packed apworld in
``custom_worlds/`` and check what each slot's slot_data carries.

usage (cwd anywhere; the upstream tree's requirements installed):
  python scripts/test/upstream_rules_addon_pristine.py --upstream <upstream AP tree> [--apworld <packed>]
      [--out <dir>] [--only <scenario> ...]

Exit 0 when every scenario holds; 1 otherwise (the report names each failed check). CI runs it from
.github/workflows/upstream-rules-addon.yml at a pinned upstream ref. Every scenario also requires that generation
EXITS 0: the add-on never fails generation.

Scenarios (ChecksFinder and TUNIC: no ROM, quick to export):
  present    ChecksFinder s1 + TUNIC s2: both get an envelope; strips, IDs and the per-player cut hold
  er         TUNIC with entrance_rando on: the doc is sent (Robert, 2026-11-16: "Send them")
  race       the present room with --race: still sent (Robert, 2026-11-16: "send in race")
  over_cap   max_kb 1: both slots get worldgen_rules_omitted reason over_cap
  disabled   enabled false: nothing is added
  excluded   exclude_games [ChecksFinder]: only TUNIC is sent
  editor     strip_level editor: both sent, the unused fields kept (item classification), placements still gone
  absent     no add-on: nothing is added
  broken     the vendored exporter raises on import: every slot gets export_failed
  no_handlers  the vendored handler modules removed: export_failed ("0 game handlers")
  degraded   the vendored exporter logs one "Failed to analyze" warning for ChecksFinder's Tile 1: that slot gets
             export_degraded with unanalysed_rules 1, TUNIC still gets its doc
The last three run a modified copy of the packed apworld; they are the gate's paths on the real pipeline.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PACKED = REPO / "apworlds" / "upstream_rules_addon.apworld"
NAME = "upstream_rules_addon"
SEED = "4801"
SEED_KEYS = ("canonical_placements", "is_canonical", "generation_seed", "seed_name", "player_names", "provenance",
             "sphere_log", "itempool_counts")

ROOM = {"1-ChecksFinder.yaml": "name: CF1\ngame: ChecksFinder\nChecksFinder: {}\n",
        "2-TUNIC.yaml": "name: Tunic2\ngame: TUNIC\nTUNIC: {}\n"}
ER = {"1-TUNIC.yaml": "name: TunicER\ngame: TUNIC\nTUNIC:\n  entrance_rando: 'true'\n"}

#: name → (yamls, extra Generate.py args, host.yaml section overrides, apworld variant or None for absent)
SCENARIOS = {
    "present": (ROOM, [], {}, "packed"),
    "er": (ER, [], {}, "packed"),
    "race": (ROOM, ["--race"], {}, "packed"),
    "over_cap": (ROOM, [], {"max_kb": "1"}, "packed"),
    "disabled": (ROOM, [], {"enabled": "false"}, "packed"),
    "excluded": (ROOM, [], {"exclude_games": '["ChecksFinder"]'}, "packed"),
    "editor": (ROOM, [], {"strip_level": "editor"}, "packed"),
    "absent": (ROOM, [], {}, None),
    "broken": (ROOM, [], {}, "broken"),
    "no_handlers": (ROOM, [], {}, "no_handlers"),
    "degraded": (ROOM, [], {}, "degraded"),
}


# ------------------------------------------------------------------------------------------- variants
def make_variant(packed: Path, variant: str, out: Path) -> Path:
    """A copy of the packed apworld with one part of the vendored exporter changed."""
    target = out / f"{NAME}.apworld"
    with zipfile.ZipFile(packed) as src, zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            name, data = info.filename, src.read(info.filename)
            if variant == "broken" and name == f"{NAME}/_vendor/exporter/exporter.py":
                data = b'raise RuntimeError("broken on purpose (upstream_rules_addon_pristine)")\n'
            if variant == "no_handlers" and re.match(rf"{NAME}/_vendor/exporter/games/(official|unofficial)/[^_][^/]*\.py$", name):
                continue
            if variant == "degraded" and name == f"{NAME}/_vendor/exporter/exporter.py":
                text = data.decode("utf-8")
                anchor = '    # Determine whether to export rules.json based on settings mode.\n'
                assert text.count(anchor) == 1, "the degraded variant's anchor moved"
                text = text.replace(anchor, "    logger.warning(\"Failed to analyze or expand rule for Location 'Tile 1' "
                                            "using runtime analysis.\")\n" + anchor)
                data = text.encode("utf-8")
            dst.writestr(info, data)
    return target


# ---------------------------------------------------------------------------------------- host.yaml
def set_section(host_yaml: Path, overrides: dict) -> None:
    """Rewrite the add-on's host.yaml section to its defaults plus the overrides (AP wrote it on first load)."""
    values = {"enabled": "true", "max_kb": "1024", "exclude_games": '["APCalc", "DepGraph", "Metamath"]',
              "strip_level": "play", **overrides}
    section = "upstream_rules_addon:\n" + "".join(f"  {k}: {v}\n" for k, v in values.items())
    text = host_yaml.read_text(encoding="utf-8") if host_yaml.exists() else ""
    text = re.sub(r"^upstream_rules_addon:\n(?:[ #].*\n|\n)*", "", text, flags=re.M)
    host_yaml.write_text(text.rstrip("\n") + "\n" + section, encoding="utf-8")


# ---------------------------------------------------------------------------------------- generation
def generate(upstream: Path, yamls: dict, extra: list, work: Path) -> tuple:
    players = work / "players"
    out = work / "output"
    players.mkdir(parents=True)
    out.mkdir()
    for name, text in yamls.items():
        (players / name).write_text(text, encoding="utf-8")
    env = dict(os.environ, SKIP_REQUIREMENTS_UPDATE="1")
    done = subprocess.run([sys.executable, "Generate.py", "--player_files_path", str(players), "--seed", SEED,
                           "--outputpath", str(out), *extra], cwd=upstream, env=env, capture_output=True,
                          text=True, timeout=1200, stdin=subprocess.DEVNULL)
    (work / "gen.log").write_text(done.stdout + done.stderr, encoding="utf-8")
    zips = sorted(out.glob("AP_*.zip"))
    return done.returncode, (zips[0] if zips else None), done.stdout + done.stderr


def read_multidata(upstream: Path, archive: Path) -> dict:
    """Unpickle in a child whose cwd/sys.path is the upstream tree (the pickle names its classes), as JSON."""
    code = ("import json,pickle,sys,zipfile,zlib;sys.path.insert(0,'.');z=zipfile.ZipFile(sys.argv[1]);"
            "n=next(x for x in z.namelist() if x.endswith('.archipelago'));m=pickle.loads(zlib.decompress(z.read(n)[1:]));"
            "print(json.dumps({'race_mode':m.get('race_mode'),'slot_data':{str(k):v for k,v in m['slot_data'].items()},"
            "'games':{str(k):v.game for k,v in m['slot_info'].items()},"
            "'datapackage':{g:{'items':sorted(d['item_name_to_id'].values()),'locations':sorted(d['location_name_to_id'].values())} "
            "for g,d in m['datapackage'].items()}},default=list))")
    done = subprocess.run([sys.executable, "-c", code, str(archive)], cwd=upstream, capture_output=True, text=True,
                          timeout=300, check=True)
    return json.loads(done.stdout)


# -------------------------------------------------------------------------------------------- checks
def unused_fields(packed: Path) -> dict:
    with zipfile.ZipFile(packed) as z:
        source = z.read(f"{NAME}/_unused_fields.py").decode("utf-8")
    namespace: dict = {}
    exec(compile(source, "_unused_fields.py", "exec"), namespace)  # noqa: S102 - our own packed source
    return {k: namespace[k] for k in ("TOP", "WORLD", "ITEM", "LOCATION")}


def check_envelope(slot: str, game: str, envelope: dict, md: dict, unused: dict, fail, editor: bool = False) -> None:
    """``editor``: strip_level editor, so the unused fields are expected to be there (not checked as stripped)."""
    if editor:
        unused = {k: () for k in unused}
    where = f"slot {slot} ({game})"
    if envelope.get("format") != 1 or envelope.get("player") != slot or envelope.get("source") != NAME:
        fail(f"{where}: envelope header {({k: envelope.get(k) for k in ('format', 'player', 'source')})}")
    doc = envelope.get("doc") or {}
    if not isinstance((doc.get("world") or {}).get(slot), dict):
        fail(f"{where}: no world[{slot}]")
        return
    for key in SEED_KEYS + tuple(unused["TOP"]):
        if key in doc:
            fail(f"{where}: top-level {key} was not stripped")
    for key in unused["WORLD"]:
        if key in doc["world"][slot]:
            fail(f"{where}: world.{key} was not stripped")
    for key, value in doc.items():
        if isinstance(value, dict) and value and all(str(k).isdigit() for k in value) and list(value) != [slot]:
            fail(f"{where}: per-player map {key} holds {sorted(value)}")
    package = md["datapackage"].get(game) or {}
    item_ids = set(package.get("items") or ())
    location_ids = set(package.get("locations") or ())
    items = (doc.get("items") or {}).get(slot) or {}
    foreign = [n for n, it in items.items() if it.get("id") is not None
               and (not isinstance(it["id"], int) or it["id"] not in item_ids)]
    if foreign:
        fail(f"{where}: {len(foreign)} item id(s) not in the game's DataPackage, e.g. {foreign[:3]}")
    leftover = [n for n, it in items.items() if any(k in it for k in unused["ITEM"])]
    if leftover:
        fail(f"{where}: unused item fields left on {leftover[:3]}")
    located = 0
    regions = (doc.get("regions") or {}).get(slot) or {}
    for region in (regions.values() if isinstance(regions, dict) else regions):
        for location in region.get("locations") or ():
            if location.get("id") is None:
                continue
            located += 1
            if "item" in location:
                fail(f"{where}: location {location.get('name')} still names its item (a placement)")
            if location["id"] not in location_ids:
                fail(f"{where}: location id {location['id']} not in the game's DataPackage")
            if any(k in location for k in unused["LOCATION"]):
                fail(f"{where}: unused location fields left on {location.get('name')}")
    if not located:
        fail(f"{where}: the doc has no ID-bearing location")


def expect(name: str, md: dict, packed: Path, fail) -> None:
    sd, games = md["slot_data"], md["games"]
    unused = unused_fields(packed)
    rules = {s: d["worldgen_rules"] or {} for s, d in sd.items() if isinstance(d, dict) and "worldgen_rules" in d}
    omitted = {s: d["worldgen_rules_omitted"] or {} for s, d in sd.items()
               if isinstance(d, dict) and "worldgen_rules_omitted" in d}
    for slot, envelope in rules.items():
        check_envelope(slot, games[slot], envelope, md, unused, fail, editor=name == "editor")

    def want(sent, reasons=None):
        if sorted(rules) != sorted(sent):
            fail(f"{name}: worldgen_rules on slots {sorted(rules)}, expected {sorted(sent)}")
        got = {s: o.get("reason") for s, o in omitted.items()}
        if got != (reasons or {}):
            fail(f"{name}: worldgen_rules_omitted {omitted}, expected reasons {reasons or {}}")

    if name in ("present", "er", "race", "editor"):
        want(list(games))
        if name == "editor":
            for slot, envelope in rules.items():
                items = envelope["doc"]["items"][slot]
                if not any("classification" in it for it in items.values()):
                    fail(f"editor: slot {slot}'s items carry no classification (the editor level should keep it)")
        if name == "race" and md.get("race_mode") != 1:
            fail(f"race: race_mode {md.get('race_mode')}")
        if name == "er":
            options = rules["1"]["doc"]["world"]["1"].get("options") or {}
            if options.get("entrance_rando") in (None, 0, False, "false", "off"):
                fail(f"er: the doc's entrance_rando option reads {options.get('entrance_rando')!r}")
    elif name == "over_cap":
        want([], {s: "over_cap" for s in games})
        for slot, note in omitted.items():
            if note.get("cap_kb") != 1 or not note.get("size_kb"):
                fail(f"over_cap: slot {slot} note {note}")
    elif name in ("disabled", "absent"):
        want([])
    elif name == "excluded":
        want([s for s, g in games.items() if g != "ChecksFinder"])
    elif name in ("broken", "no_handlers"):
        want([], {s: "export_failed" for s in games})
        expected = "broken on purpose" if name == "broken" else "0 game handlers"
        for slot, note in omitted.items():
            if expected not in (note.get("error") or ""):
                fail(f"{name}: slot {slot} error {note.get('error')!r} lacks {expected!r}")
    elif name == "degraded":
        cf = next(s for s, g in games.items() if g == "ChecksFinder")
        want([s for s in games if s != cf], {cf: "export_degraded"})
        if omitted.get(cf, {}).get("unanalysed_rules") != 1:
            fail(f"degraded: {omitted.get(cf)}")


# ---------------------------------------------------------------------------------------------- main
def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--upstream", type=Path, required=True)
    parser.add_argument("--apworld", type=Path, default=PACKED)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--only", nargs="*")
    args = parser.parse_args(argv)
    upstream = args.upstream.resolve()
    out = (args.out or Path(tempfile.mkdtemp(prefix="upstream-rules-addon-"))).resolve()
    out.mkdir(parents=True, exist_ok=True)
    custom = upstream / "custom_worlds"
    custom.mkdir(exist_ok=True)
    installed = custom / f"{NAME}.apworld"
    host_yaml = upstream / "host.yaml"
    saved_host = host_yaml.read_bytes() if host_yaml.exists() else None
    report, failures = {}, []
    try:
        for name, (yamls, extra, overrides, variant) in SCENARIOS.items():
            if args.only and name not in args.only:
                continue
            work = out / name
            shutil.rmtree(work, ignore_errors=True)
            work.mkdir(parents=True)
            installed.unlink(missing_ok=True)
            if variant == "packed":
                shutil.copyfile(args.apworld, installed)
            elif variant:
                shutil.copyfile(make_variant(args.apworld, variant, work), installed)
            set_section(host_yaml, overrides)
            mine = []

            def fail(message, _mine=mine):
                _mine.append(message)
            rc, archive, log = generate(upstream, yamls, extra, work)
            if rc != 0 or archive is None:
                fail(f"{name}: generation exited {rc} (see {work / 'gen.log'})")
            else:
                md = read_multidata(upstream, archive)
                expect(name, md, args.apworld, fail)
                summary = [line for line in log.splitlines() if "Upstream Rules Add-on:" in line]
                if variant and not summary:
                    fail(f"{name}: the add-on logged no summary line")
                report[name] = {"slots": {s: (("rules %.1f KB" % (len(json.dumps(d["worldgen_rules"])) / 1024))
                                              if "worldgen_rules" in d else d.get("worldgen_rules_omitted"))
                                          for s, d in md["slot_data"].items() if isinstance(d, dict)},
                                "race_mode": md.get("race_mode"), "summary": summary[:2]}
            report.setdefault(name, {})["failures"] = mine
            failures += mine
            print(f"{'PASS' if not mine else 'FAIL'} {name}: {json.dumps(report[name])}", flush=True)
    finally:
        installed.unlink(missing_ok=True)
        if saved_host is None:
            host_yaml.unlink(missing_ok=True)
        else:
            host_yaml.write_bytes(saved_host)
    (out / "report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(f"{len(report)} scenario(s), {len(failures)} failure(s); report {out / 'report.json'}")
    for message in failures:
        print("  FAIL", message)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
