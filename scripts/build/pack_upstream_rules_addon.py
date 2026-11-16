#!/usr/bin/env python3
"""Pack apworlds/upstream_rules_addon.apworld: the add-on's source folder plus a vendored copy of the exporter.

usage: python scripts/build/pack_upstream_rules_addon.py [--output PATH] [--list] [--check]

The archive holds ``upstream_rules_addon/`` = ``worlds/upstream_rules_addon/`` (the World, the hook, the strips)
and ``upstream_rules_addon/_vendor/``, which is BUILT here and never tracked:

- ``exporter/`` from this tree (no tests, no web UI or CLI), with its imports rewritten to live under
  ``worlds.upstream_rules_addon._vendor``, so it never collides with an ``exporter`` the host might have and needs
  nothing on ``sys.path``;
- the fork-only modules it imports, vendored beside it: ``rule_builder/_ast_utils.py`` (the fork's extended Rule
  Builder; upstream's ``rule_builder/`` lacks it), ``world_generator/_embedded_rules.py`` (``strip_placements``, the
  embed recipe's) and ``world_generator/_sanitization.py``;
- ``_recipe_settings.py`` in place of ``worlds.json_tools_installer.json_tools_settings``: the minimal-spoilers
  recipe's values (``scripts/setup/update_host_settings.py``), fixed, so the document does not depend on a
  ``json_tools`` section the host may have (a host running json_tools_installer's romless patches has one);
- ``VENDORED.json``: each vendored source's path and sha256.

``game_directory`` needs nothing: the exporter reads it off the world's module (sdc-addon-u1-exporter-fixes), and
the fork-only ``world-mapping.json`` it would fall back to is absent, which ``get_world_directory_name`` handles.

The archive is deterministic (sorted entries, fixed timestamps), and a test holds the committed file equal to a
fresh pack (test/test_upstream_rules_addon.py). Every import left in the vendored tree is checked here: an import
of a fork-only module that was not rewritten fails the pack.
"""
import argparse
import ast
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from typing import Dict, List, Tuple

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
from world_generator.apworld import stamp_container_version  # noqa: E402

NAME = "upstream_rules_addon"
SOURCE_DIR = REPO / "worlds" / NAME
OUTPUT = REPO / "apworlds" / f"{NAME}.apworld"
VENDOR = f"worlds.{NAME}._vendor"
DATE_TIME = (1980, 1, 1, 0, 0, 0)

#: exporter/ paths (relative, posix) left out of the vendored copy.
EXCLUDE_DIRS = {"__pycache__", "test", "tests", "web"}
#: converter/cli.py stays: converter/__init__ imports it (without it the export silently falls back to AST format).
#: script_api.py is the Pyodide analyzer entry and imports world_generator.
EXCLUDE_FILES = {"converter/__main__.py", "script_api.py"}

#: Fork-only modules the exporter imports, and what they become.
REWRITES: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"^(\s*from\s+)exporter(?=[\s.])", re.M), rf"\1{VENDOR}.exporter"),
    (re.compile(r"^(\s*import\s+)exporter(?=\.)", re.M), rf"\1{VENDOR}.exporter"),
    (re.compile(r"^(\s*from\s+)rule_builder\._ast_utils(?=\s)", re.M), rf"\1{VENDOR}._rule_builder_ast_utils"),
    (re.compile(r"^(\s*from\s+)worlds\.json_tools_installer\.json_tools_settings(?=\s)", re.M),
     rf"\1{VENDOR}._recipe_settings"),
    (re.compile(r"^(\s*from\s+)world_generator\._sanitization(?=\s)", re.M), rf"\1{VENDOR}._sanitization"),
]
#: Top-level modules that must not survive in the vendored tree (they are the fork's, not upstream's).
FORK_ONLY = ("exporter", "world_generator", "scripts", "worlds.json_tools_installer", "rule_builder._ast_utils")

#: Vendored single files: (source in this tree, name under _vendor/).
SINGLE_FILES = [("rule_builder/_ast_utils.py", "_rule_builder_ast_utils.py"),
                ("world_generator/_embedded_rules.py", "_embedded_rules.py"),
                ("world_generator/_sanitization.py", "_sanitization.py")]

#: The recipe's values that do not shape the rules document, set off: the add-on writes no presets, sphere logs or
#: pickles, only the rules it reads back.
RECIPE_OFF = ("save_sphere_log", "update_frontend_presets", "save_tracker_pickle", "skip_required_files")


def _recipe_values() -> Dict[str, object]:
    """JSONToolsSettings' declared defaults, then the minimal-spoilers preset over them, then RECIPE_OFF."""
    tree = ast.parse(_read(REPO / "worlds/json_tools_installer/json_tools_settings.py").decode("utf-8"))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "JSONToolsSettings")
    values = {n.target.id: ast.literal_eval(n.value) for n in cls.body
              if isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name) and n.value is not None}
    tree = ast.parse((REPO / "scripts/setup/update_host_settings.py").read_text(encoding="utf-8"))
    presets = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign)
                   and any(isinstance(t, ast.Name) and t.id == "PRESETS" for t in n.targets))
    values.update(presets["minimal-spoilers"])
    for key in RECIPE_OFF:
        values[key] = False
    return dict(sorted(values.items()))


def _recipe_settings_source() -> bytes:
    lines = ['"""GENERATED by scripts/build/pack_upstream_rules_addon.py: the settings the vendored exporter reads in',
             'place of worlds.json_tools_installer.json_tools_settings (the minimal-spoilers recipe, fixed)."""', '',
             '', 'class JSONToolsSettings:']
    lines += [f"    {key} = {value!r}" for key, value in _recipe_values().items()]
    lines += ['', '', 'def get_json_tools_settings() -> JSONToolsSettings:', '    return JSONToolsSettings()', '']
    return "\n".join(lines).encode("utf-8")


def _rewrite(source: str) -> str:
    for pattern, replacement in REWRITES:
        source = pattern.sub(replacement, source)
    return source


def _fork_only_imports(rel: str, source: str) -> List[str]:
    found = []
    for node in ast.walk(ast.parse(source, rel)):
        names = []
        if isinstance(node, ast.Import):
            names = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            names = [node.module]
        for name in names:
            if any(name == m or name.startswith(m + ".") for m in FORK_ONLY):
                found.append(f"{rel}:{getattr(node, 'lineno', 0)}: {name}")
    return found


def _exporter_files() -> List[Path]:
    root = REPO / "exporter"
    out = []
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root).as_posix()
        if not path.is_file() or set(path.relative_to(root).parts[:-1]) & EXCLUDE_DIRS:
            continue
        if rel in EXCLUDE_FILES or path.suffix in (".pyc", ".md"):
            continue
        if path.name.startswith("test_") or path.name.endswith("_test.py"):
            continue
        out.append(path)
    return out


def _read(path: Path) -> bytes:
    """A source file's bytes, text with LF line endings: a CRLF checkout (Windows) packs the same archive."""
    data = path.read_bytes()
    return data.replace(b"\r\n", b"\n") if path.suffix in TEXT_SUFFIXES or path.name == "LICENSE" else data


TEXT_SUFFIXES = {".py", ".json", ".txt", ".md", ".yaml"}


def build_entries() -> Dict[str, bytes]:
    """{archive path: bytes} of the whole apworld."""
    entries: Dict[str, bytes] = {}
    for path in sorted(SOURCE_DIR.rglob("*")):
        rel = path.relative_to(SOURCE_DIR)
        if not path.is_file() or "__pycache__" in rel.parts or path.suffix == ".pyc" or rel.parts[0] == "_vendor":
            continue
        data = _read(path)
        if rel.as_posix() == "archipelago.json":
            data = stamp_container_version(data)
        entries[f"{NAME}/{rel.as_posix()}"] = data

    vendored: Dict[str, str] = {}
    problems: List[str] = []
    prefix = f"{NAME}/_vendor"
    entries[f"{prefix}/__init__.py"] = (b'"""GENERATED by scripts/build/pack_upstream_rules_addon.py: the vendored '
                                        b'exporter and the fork-only modules it imports."""\n')
    for path in _exporter_files():
        rel = path.relative_to(REPO).as_posix()
        data = _read(path)
        vendored[rel] = hashlib.sha256(data).hexdigest()
        if path.suffix == ".py":
            text = _rewrite(data.decode("utf-8"))
            problems += _fork_only_imports(rel, text)
            data = text.encode("utf-8")
        entries[f"{prefix}/{rel}"] = data
    for source, target in SINGLE_FILES:
        data = _read(REPO / source)
        vendored[source] = hashlib.sha256(data).hexdigest()
        problems += _fork_only_imports(source, data.decode("utf-8"))
        entries[f"{prefix}/{target}"] = data
    entries[f"{prefix}/_recipe_settings.py"] = _recipe_settings_source()
    entries[f"{prefix}/VENDORED.json"] = (json.dumps({"sources": dict(sorted(vendored.items()))}, indent=1)
                                          + "\n").encode("utf-8")
    if problems:
        raise SystemExit("fork-only imports left in the vendored exporter (add a REWRITES row):\n  "
                         + "\n  ".join(problems))
    return dict(sorted(entries.items()))


def write_zip(entries: Dict[str, bytes], output) -> None:
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for name, data in entries.items():
            info = zipfile.ZipInfo(name, DATE_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, data)


def pack(output: Path = OUTPUT) -> Path:
    buffer = io.BytesIO()
    write_zip(build_entries(), buffer)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(buffer.getvalue())
    return output


def stale_entries(packed: Path = OUTPUT) -> List[str]:
    """Entries of the committed apworld that differ from a fresh pack (by name and content; the deflate bytes may
    differ between zlib builds, so the archive's bytes are not compared)."""
    fresh = build_entries()
    with zipfile.ZipFile(packed) as zf:
        committed = {name: zf.read(name) for name in zf.namelist()}
    return sorted(name for name in set(fresh) | set(committed) if fresh.get(name) != committed.get(name))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--list", action="store_true", help="print the archive's entries and sizes")
    parser.add_argument("--check", action="store_true",
                        help="write nothing; exit 1 when the committed apworld differs from a fresh pack")
    args = parser.parse_args(argv)
    if args.check:
        stale = stale_entries(args.output)
        for name in stale:
            print(f"stale: {name}")
        print("apworld is fresh" if not stale else
              f"{len(stale)} stale entr(ies): re-pack with python scripts/build/pack_upstream_rules_addon.py")
        return 1 if stale else 0
    out = pack(args.output)
    if args.list:
        with zipfile.ZipFile(out) as zf:
            for info in zf.infolist():
                print(f"{info.file_size:9d}  {info.filename}")
    with zipfile.ZipFile(out) as zf:
        count = len(zf.namelist())
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} KB, {count} entries)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
