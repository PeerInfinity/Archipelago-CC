#!/usr/bin/env python3
"""Extract Seedling's OGMO PROJECT SCHEMA — what the level editor OFFERS.

EDITOR v3, slice B (`NewDocs/plans/seedling-editor-v3.md` §3.3 Tier A). The
editor arm has to know, for every entity the game's rooms can hold, what
attributes it carries, of what TYPE, with what default and what bounds. That
table exists already and it is not in this repo: `~/CC/seedling/Shrum.oep` is
the Ogmo 1 project file the game's own levels were authored against, and the
144 `<object>` declarations in it ARE the vocabulary.

⛔⛔ SO IT IS DERIVED, NEVER TYPED (⚖ minimize-hardcoding, user 2026-08-21).
A hand-written attribute table would be a second declaration of the same facts,
correct on the day it was typed and silently wrong afterwards — and the failure
would be an editor offering an attribute the game does not read, or refusing a
range the game accepts, with nothing red anywhere.

── ⚠ WHAT THE `.oep` IS AND IS NOT AN ORACLE FOR ─────────────────────────

The `.oep` declares what the EDITOR OFFERS. `Game.loadLevelXML`
(`~/CC/seedling/src/Game.as:1942-2313`) declares what the GAME READS. They are
two statements about one format and this file transcribes only the first.
⛓ Their AGREEMENT is pinned on the JS side, not asserted here: the fixture is
checked against the 116 shipped rooms of the committed atlas — every entity
type in those rooms is declared here, and every attribute those rooms carry is
declared here with a type and a range the value satisfies. That is a check
against the DATA the game actually loads rather than against a second reading
of the AS3.

── ⛔ `--check` IS BYTE IDENTITY, AND THAT IS THE RIGHT GATE HERE ─────────

This producer's OUTPUT is a fingerprint of its INPUT: nothing in it is a
judgement, so a fresh extract that differs from the committed fixture means the
`.oep` moved (or this script did). ⛓ `provenance.oep_sha256` is what says which:
a mismatch there is the fixture telling you the source file changed, and a
match with a body difference is a change in this script.

Usage:
  python3 scripts/procgen/extract-seedling-ogmo-schema.py [--seedling DIR]
  python3 scripts/procgen/extract-seedling-ogmo-schema.py --check
  python3 scripts/procgen/extract-seedling-ogmo-schema.py --stdout
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIXTURE = os.path.join(REPO, "frontend", "modules", "seedlingDemo", "fixtures",
                       "seedling-ogmo-schema.json")

OEP_NAME = "Shrum.oep"

# ⛓ THE FOUR OGMO 1 VALUE TYPES, as the `.oep` spells them. Declared as the
# CLOSED SET this script accepts, so a fifth one arriving in a future project
# file fails loudly instead of being dropped into the fixture untyped. ⚠ Only
# THREE of them occur in Seedling's own project (measured: 132 integer, 27
# string, 7 number, 0 boolean) — the fourth is declared because it is part of
# the format, and the consumer must not learn "there are three types" from data
# that merely happens not to use the fourth.
VALUE_TYPES = ("integer", "number", "string", "boolean")

# ⛓ Ogmo 1 layer element names. `<tiles>` and `<objects>` are the two Seedling
# uses; `<grid>` is the third the format has. Same reason as above: the set is
# the FORMAT's, and an unknown one is refused rather than guessed at.
LAYER_KINDS = ("tiles", "objects", "grid")

# The `<values>` child attributes that are BOUNDS on the parsed value, and are
# therefore emitted as numbers. `default` is deliberately NOT here: an OEL
# attribute is an XML attribute and therefore a STRING (`watchEdit`'s
# "attrs are scalars, and the engine coerces them" law), so the default is
# carried as the exact text a writer would emit.
NUMERIC_VALUE_ATTRS = ("min", "max", "maxChars")


def die(what):
    sys.exit("EXTRACTION FAILED: " + what)


def git_fact(repo, args):
    """One `git` answer, or None when the repo cannot answer."""
    r = subprocess.run(["git", "-C", repo] + args, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def value_of(el, where):
    """One `<integer|number|string|boolean>` declaration."""
    if el.tag not in VALUE_TYPES:
        die(f"{where}: <{el.tag}> is not one of the Ogmo value types "
            f"[{', '.join(VALUE_TYPES)}]")
    name = el.get("name")
    if not name:
        die(f"{where}: a <{el.tag}> value has no name")
    out = {"name": name, "type": el.tag}
    # ⚠ `default` IS OPTIONAL AND THE ABSENCE IS DATA. Three of Seedling's 166
    # declared values have none (`flip` on bonetorch / bonetorch2 / planttorch),
    # and a consumer that filled a missing default with a zero it invented would
    # write an attribute the author never declared a value for. `null` says
    # "this value has no default", which is a different fact from "0".
    out["default"] = el.get("default")
    for attr in NUMERIC_VALUE_ATTRS:
        raw = el.get(attr)
        if raw is None:
            continue
        try:
            out[attr] = int(raw)
        except ValueError:
            die(f"{where}: <{el.tag} name=\"{name}\"> {attr}=\"{raw}\" is not an integer")
    return out


def values_of(obj, where):
    """The `<values>` block, or an empty list when the object declares none.

    ⚠ `obj.find("values") or []` WOULD BE A DEFECT: an ElementTree element is
    FALSY when it has no children, so an object carrying an EMPTY `<values/>`
    and one carrying none at all would take the same arm by accident rather
    than by decision. Explicit `is None`, and the empty block reads as zero
    values because it holds zero values.
    """
    vals = obj.find("values")
    return [] if vals is None else [value_of(v, where) for v in vals]


def extract(seedling):
    oep_path = os.path.join(seedling, OEP_NAME)
    if not os.path.exists(oep_path):
        die(f"no {OEP_NAME} at {oep_path} — pass --seedling")
    raw = open(oep_path, "rb").read()
    root = ET.fromstring(raw.decode("utf-8"))
    if root.tag != "project":
        die(f"{OEP_NAME} root element is <{root.tag}>, expected <project>")

    tilesets = []
    for ts in (root.find("tilesets") if root.find("tilesets") is not None else []):
        tilesets.append({
            "name": ts.get("name"),
            "image": ts.get("image"),
            "tile_width": int(ts.get("tileWidth")),
            "tile_height": int(ts.get("tileHeight")),
        })

    layers = []
    for ly in (root.find("layers") if root.find("layers") is not None else []):
        if ly.tag not in LAYER_KINDS:
            die(f"<layers> holds <{ly.tag}>, not one of [{', '.join(LAYER_KINDS)}]")
        layers.append({
            "name": ly.get("name"),
            "kind": ly.tag,
            "grid_size": int(ly.get("gridSize")),
        })

    entities = {}
    objects = root.find("objects")
    if objects is None:
        die(f"{OEP_NAME} has no <objects> block")
    for folder in objects:
        if folder.tag != "folder":
            die(f"<objects> holds <{folder.tag}>, expected <folder>")
        fname = folder.get("name")
        for obj in folder:
            if obj.tag != "object":
                die(f"<folder name=\"{fname}\"> holds <{obj.tag}>, expected <object>")
            name = obj.get("name")
            if name in entities:
                die(f"entity {name!r} is declared twice — the fixture is keyed by name "
                    f"and the second declaration would silently win")
            where = f"<object name=\"{name}\">"
            entry = {
                "folder": fname,
                "width": int(obj.get("width")),
                "height": int(obj.get("height")),
                "values": values_of(obj, where),
            }
            # ⛓ `<nodes>` IS A CAPABILITY, NOT A VALUE. It says this entity's
            # placements may carry `<node>` children — the thing `parseOelLevel`
            # already reads into `entity.nodes` and `recordToOel` already writes.
            # ONE object in Seedling declares it (`rope`), and the editor's
            # `nodes` op is refused for every type that does not.
            nodes = obj.find("nodes")
            if nodes is not None:
                entry["nodes"] = {
                    "draw_object": nodes.get("drawObject") == "true",
                    "limit": int(nodes.get("limit")) if nodes.get("limit") else None,
                    "line_mode": int(nodes.get("lineMode")) if nodes.get("lineMode") else None,
                }
            entities[name] = entry

    # ⛓ THE COMMIT THAT LAST TOUCHED THE `.oep`, NOT `HEAD`. The seedling fork's
    # HEAD moves for reasons that have nothing to do with this file (the bot arc
    # rebuilds it constantly), and provenance that moved with it would make
    # `--check` go red on a day nobody edited the schema — a gate that fails for
    # the wrong reason. `dirty` is recorded because a working-tree edit makes the
    # commit stale, and silence about that would be the worse answer.
    commit = git_fact(seedling, ["log", "-1", "--format=%H", "--", OEP_NAME])
    status = git_fact(seedling, ["status", "--porcelain", "--", OEP_NAME])

    return {
        "schema_version": 1,
        "provenance": {
            "generator": "scripts/procgen/extract-seedling-ogmo-schema.py",
            "oep_path": OEP_NAME,
            "oep_sha256": hashlib.sha256(raw).hexdigest(),
            "git": {
                "repo": "~/CC/seedling",
                "commit": commit or None,
                "dirty": bool(status),
            },
        },
        "value_types": list(VALUE_TYPES),
        "tilesets": tilesets,
        "layers": layers,
        "entities": entities,
    }


def rendered(schema):
    return json.dumps(schema, indent=1) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seedling", default=os.path.expanduser("~/CC/seedling"),
                    help="the AS3 fork holding Shrum.oep")
    ap.add_argument("--check", action="store_true",
                    help="compare the committed fixture to a fresh extract, byte for byte")
    ap.add_argument("--stdout", action="store_true", help="print instead of writing")
    args = ap.parse_args()

    schema = extract(args.seedling)
    text = rendered(schema)
    counts = (f"{len(schema['entities'])} entities, "
              f"{sum(len(e['values']) for e in schema['entities'].values())} values, "
              f"{sum(1 for e in schema['entities'].values() if 'nodes' in e)} with nodes, "
              f"{len(schema['tilesets'])} tilesets, {len(schema['layers'])} layers")

    if args.check:
        if not os.path.exists(FIXTURE):
            die(f"no committed fixture at {FIXTURE}")
        have = open(FIXTURE, encoding="utf-8").read()
        if have == text:
            print(f"PASS: {os.path.relpath(FIXTURE, REPO)} is a byte-exact extract of "
                  f"{OEP_NAME} ({counts})")
            return
        committed = json.loads(have)
        old = committed.get("provenance", {}).get("oep_sha256")
        new = schema["provenance"]["oep_sha256"]
        moved = ("the .oep MOVED" if old != new
                 else "the .oep is UNCHANGED, so this SCRIPT moved")
        print(f"FAIL: {os.path.relpath(FIXTURE, REPO)} DIFFERS from a fresh extract — {moved}\n"
              f"  committed oep_sha256 {old}\n  extracted oep_sha256 {new}\n"
              f"  re-run without --check to regenerate")
        sys.exit(1)

    if args.stdout:
        sys.stdout.write(text)
        return
    with open(FIXTURE, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"wrote {os.path.relpath(FIXTURE, REPO)} — {counts}")


if __name__ == "__main__":
    main()
