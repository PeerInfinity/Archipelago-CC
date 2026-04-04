#!/usr/bin/env python3
"""Add PLAN_META blocks to completed plan documents.

Reads each completed plan, extracts phase structure from the markdown,
applies dependencies from a curated lookup table, and inserts a
PLAN_META block after the <!-- TESTS: --> header.

Usage:
    python add_plan_meta_to_completed.py [--investigation-dir PATH] [--dry-run]
"""

import argparse
import re
import sys
from pathlib import Path


# Dependency mapping derived from SESSION_NOTES.md, BLOCKER_SUMMARY.md,
# and plan document cross-references.
#
# Format: plan_id -> list of {plan, phases (optional), type, reason}
# "requires" = hard dependency, "complements" = related work
DEPENDENCY_MAP: dict[str, list[dict]] = {
    # Constructor ordering chain
    "REGISTERCLASS": [
        {"plan": "THIS_BINDING", "type": "requires",
         "reason": "registerClass requires constructor call infrastructure via this binding"},
    ],

    # Rendering chain
    "PLAN_03_DRAWING_API": [
        {"plan": "PLAN_01_RUNTIME_TRANSFORMS", "type": "requires",
         "reason": "Drawing API rendering needs GPU transform pipeline"},
    ],
    "PLAN_05_BITMAP_AND_MEDIA": [
        {"plan": "PLAN_03_DRAWING_API", "type": "requires",
         "reason": "Bitmap rendering builds on drawing API infrastructure"},
    ],

    # Text and focus chain
    "PLAN_02_TEXTFIELD_RENDERING": [
        {"plan": "TEXTFIELD", "type": "requires",
         "reason": "TextField rendering depends on TextField property infrastructure"},
    ],
    "EDITTEXT_RESTRICT": [
        {"plan": "TEXTFIELD", "type": "requires",
         "reason": "restrict property depends on TextField infrastructure"},
    ],
    "HTML_TEXT_REMAINING_WORK": [
        {"plan": "TEXTFIELD", "type": "requires",
         "reason": "HTML text serialization depends on TextField infrastructure"},
    ],
    "FOCUS_SYSTEM": [
        {"plan": "TEXTFIELD", "type": "complements",
         "reason": "Focus management interacts with TextField focus behavior"},
    ],
    "TAB_ORDERING": [
        {"plan": "FOCUS_SYSTEM", "type": "requires",
         "reason": "Tab ordering depends on focus management system"},
    ],
    "TAB_ORDERING_PROPERTIES": [
        {"plan": "TAB_ORDERING", "type": "requires",
         "reason": "Tab ordering properties extend tab ordering system"},
    ],
    "SELECTION": [
        {"plan": "TEXTFIELD", "type": "requires",
         "reason": "Selection API depends on TextField infrastructure"},
        {"plan": "FOCUS_SYSTEM", "type": "requires",
         "reason": "Selection tracking depends on focus management"},
    ],
    "EDITTEXT_DRAG_SELECT": [
        {"plan": "SELECTION", "type": "requires",
         "reason": "Drag selection depends on Selection API"},
    ],
    "STYLESHEET": [
        {"plan": "TEXTFIELD", "type": "requires",
         "reason": "StyleSheet applies to TextFields"},
    ],
    "TEXTSNAPSHOT": [
        {"plan": "TEXTFIELD", "type": "requires",
         "reason": "TextSnapshot reads TextField content"},
    ],

    # Cross-SWF version chain
    "SWF_VERSION_SEMANTICS": [
        {"plan": "PER_MOVIE_GLOBAL_ISOLATION", "type": "requires",
         "reason": "Cross-version calls require per-movie global understanding"},
    ],
    "CROSS_VERSION_ISOLATION": [
        {"plan": "SWF_VERSION_SEMANTICS", "type": "requires",
         "reason": "Cross-version isolation extends version semantics"},
    ],
    "CROSS_MOVIE_EXPORT_ISOLATION": [
        {"plan": "LOADMOVIE", "type": "requires",
         "reason": "Cross-movie export isolation requires loadMovie infrastructure"},
    ],

    # LoadMovie chain
    "MOVIECLIPLOADER": [
        {"plan": "LOADMOVIE", "type": "requires",
         "reason": "MCL class wraps core loadMovie functionality"},
    ],
    "LOADVARIABLES": [
        {"plan": "LOADMOVIE", "type": "requires",
         "reason": "loadVariables shares infrastructure with loadMovie"},
    ],
    "ROOT_REPLACEMENT": [
        {"plan": "LOADMOVIE", "type": "requires",
         "reason": "Root replacement depends on loadMovie infrastructure"},
    ],

    # OOP chain
    "OOP_SUPER_EXTENDS": [
        {"plan": "THIS_BINDING", "type": "requires",
         "reason": "super/extends requires correct this binding"},
        {"plan": "CALL_SEMANTICS", "type": "requires",
         "reason": "super calls depend on call/apply semantics"},
    ],
    "PROTOTYPE_OBJECT": [
        {"plan": "OOP_SUPER_EXTENDS", "type": "requires",
         "reason": "Prototype manipulation depends on OOP infrastructure"},
    ],
    "NATIVE_INTROSPECTION": [
        {"plan": "PROTOTYPE_OBJECT", "type": "requires",
         "reason": "Native introspection requires prototype chain setup"},
    ],

    # XML chain
    "XML": [
        {"plan": "PARSING_FUNCTIONS", "type": "complements",
         "reason": "XML parsing shares infrastructure with string parsing"},
    ],

    # MC lifecycle chain
    "MC_REMOVAL_LIFECYCLE": [
        {"plan": "MOVIECLIP", "type": "requires",
         "reason": "Removal depends on MC lifecycle tracking"},
    ],
    "SCRIPT_HALTING": [
        {"plan": "MC_REMOVAL_LIFECYCLE", "type": "requires",
         "reason": "Script halting on removed MCs requires removal tracking"},
    ],
    "UNLOAD": [
        {"plan": "MC_REMOVAL_LIFECYCLE", "type": "requires",
         "reason": "Unload depends on MC removal infrastructure"},
    ],

    # Clone/duplicate
    "CLONE_DUPLICATE": [
        {"plan": "MOVIECLIP", "type": "requires",
         "reason": "Clone/duplicate depends on MC creation infrastructure"},
        {"plan": "TEXTFIELD", "type": "complements",
         "reason": "TextField cloning requires TextField property infrastructure"},
    ],

    # Geometry/BitmapData
    "GEOMETRY_CLASSES": [
        {"plan": "OOP_SUPER_EXTENDS", "type": "requires",
         "reason": "Geometry classes use extends/super infrastructure"},
    ],
    "COLOR_OBJECT": [
        {"plan": "GEOMETRY_CLASSES", "type": "complements",
         "reason": "Color/ColorTransform shares geometry class infrastructure"},
    ],

    # Button and mouse events
    "BUTTON": [
        {"plan": "MOUSE_EVENTS", "type": "requires",
         "reason": "Button behavior depends on mouse event infrastructure"},
    ],
    "MOUSE_EVENTS_ADVANCED": [
        {"plan": "MOUSE_EVENTS", "type": "requires",
         "reason": "Advanced mouse events build on basic mouse event infrastructure"},
    ],
    "DRAG_DROP": [
        {"plan": "MOUSE_EVENTS", "type": "requires",
         "reason": "Drag/drop depends on mouse event tracking"},
    ],

    # Focus rect
    "FOCUS_FOCUSRECT": [
        {"plan": "FOCUS_SYSTEM", "type": "requires",
         "reason": "Focus rect rendering depends on focus management"},
    ],
    "PLAN_04_FOCUS_RECT": [
        {"plan": "FOCUS_SYSTEM", "type": "requires",
         "reason": "Focus rect rendering depends on focus management"},
    ],

    # Date and parsing
    "DATE": [
        {"plan": "PARSING_FUNCTIONS", "type": "complements",
         "reason": "Date parsing shares number parsing infrastructure"},
    ],

    # Array
    "ARRAY_METHODS": [
        {"plan": "CALL_SEMANTICS", "type": "requires",
         "reason": "Array sort comparator depends on call semantics"},
    ],

    # Timer
    "TIMER": [
        {"plan": "FRAME_NAVIGATION", "type": "requires",
         "reason": "Timer processing integrated into frame loop"},
    ],

    # Enumeration
    "ENUMERATION": [
        {"plan": "PROTOTYPE_OBJECT", "type": "requires",
         "reason": "for-in enumeration walks prototype chain"},
    ],

    # External interface
    "EXTERNAL_INTERFACE": [
        {"plan": "XML", "type": "requires",
         "reason": "ExternalInterface uses XML serialization"},
    ],

    # ASBroadcaster
    "ASBROADCASTER": [
        {"plan": "ARRAY_METHODS", "type": "complements",
         "reason": "ASBroadcaster uses array-based listener management"},
    ],

    # Object.watch
    "OBJECT_WATCH": [
        {"plan": "CALL_SEMANTICS", "type": "requires",
         "reason": "Object.watch callbacks depend on call semantics"},
    ],

    # Sound class
    "SOUND_CLASS": [
        {"plan": "MOVIECLIP", "type": "complements",
         "reason": "Sound class attaches to MovieClips"},
    ],

    # Stage
    "STAGE": [
        {"plan": "ASBROADCASTER", "type": "requires",
         "reason": "Stage.addListener uses ASBroadcaster infrastructure"},
    ],

    # EnterFrame dispatch
    "ENTERFRAME_DISPATCH": [
        {"plan": "FRAME_NAVIGATION", "type": "requires",
         "reason": "onEnterFrame dispatch is part of frame loop"},
    ],

    # Morph
    "MORPH_INTERPOLATION": [
        {"plan": "PLAN_01_RUNTIME_TRANSFORMS", "type": "requires",
         "reason": "Morph rendering depends on transform pipeline"},
    ],

    # Lockroot
    "LOCKROOT": [
        {"plan": "LOADMOVIE", "type": "requires",
         "reason": "_lockroot behavior depends on loadMovie infrastructure"},
    ],
}


def extract_plan_id_from_filename(filename: str) -> str:
    """Convert filename to plan ID: SOME_PLAN.md -> SOME, SOME.md -> SOME"""
    name = filename
    if name.endswith("_PLAN.md"):
        name = name[:-len("_PLAN.md")]
    elif name.endswith(".md"):
        name = name[:-len(".md")]
    return name


def extract_tests(text: str) -> list[str]:
    """Extract test list from <!-- TESTS: ... --> comment."""
    match = re.search(r"<!--\s*TESTS:\s*(.*?)\s*-->", text)
    if not match:
        return []
    return [t.strip() for t in match.group(1).split(",") if t.strip()]


def has_plan_meta(text: str) -> bool:
    """Check if file already has a PLAN_META block."""
    return "PLAN_META" in text


def extract_phases(text: str) -> list[dict]:
    """Try to extract phase structure from markdown content.

    Uses multiple regex patterns, deduplicates by phase ID (first match wins),
    and filters out spurious matches.
    """
    phases = []
    seen_ids: set[str] = set()

    def add_phase(phase_id: str, name: str):
        if phase_id in seen_ids:
            return
        name = name.strip().rstrip("—-: ")
        name = re.sub(r"\s*(COMPLETE|DONE|BLOCKED|IN PROGRESS).*$", "", name, flags=re.IGNORECASE)
        name = name.strip()
        # Filter spurious matches (table headers, empty names, etc.)
        if not name or name.startswith("|") or len(name) < 3:
            return
        seen_ids.add(phase_id)
        phases.append({"id": phase_id, "name": name, "status": "complete"})

    # Pattern 1: ## Phase N: or ### Phase N: or ### Phase N —
    for match in re.finditer(
        r"^#{2,3}\s+Phase\s+(\w+)[\s:—-]+(.+?)$", text, re.MULTILINE
    ):
        add_phase(match.group(1), match.group(2))

    if phases:
        return phases

    # Pattern 2: **Phase A/1 (description)**: or **Phase A/1 — description**
    for match in re.finditer(
        r"\*\*Phase\s+(\w+)[\s(—:-]+([^*]+?)\)?\*\*", text
    ):
        add_phase(match.group(1), match.group(2))

    if phases:
        return phases

    # Pattern 3: Numbered headings: "### 1. Feature name"
    for match in re.finditer(
        r"^#{2,3}\s+(\d+)\.\s+(.+?)$", text, re.MULTILINE
    ):
        add_phase(match.group(1), match.group(2))

    if len(phases) >= 2:
        return phases

    return []


def generate_plan_meta(plan_id: str, phases: list[dict], dependencies: list[dict]) -> str:
    """Generate a PLAN_META YAML block."""
    lines = ["<!-- PLAN_META"]
    lines.append(f"id: {plan_id}")
    lines.append("status: complete")

    if phases:
        lines.append("phases:")
        for phase in phases:
            lines.append(f"  - id: {phase['id']}")
            # Quote the name to handle special characters
            name = phase["name"].replace('"', '\\"')
            lines.append(f'    name: "{name}"')
            lines.append(f"    status: {phase['status']}")

    if dependencies:
        lines.append("dependencies:")
        for dep in dependencies:
            lines.append(f"  - plan: {dep['plan']}")
            if "phases" in dep:
                lines.append(f"    phases: {dep['phases']}")
            lines.append(f"    type: {dep['type']}")
            reason = dep["reason"].replace('"', '\\"')
            lines.append(f'    reason: "{reason}"')
    else:
        lines.append("dependencies: []")

    lines.append("blockers: []")
    lines.append("-->")
    return "\n".join(lines)


def insert_plan_meta(text: str, meta_block: str) -> str:
    """Insert PLAN_META block after <!-- TESTS: --> line, or after the title."""
    # Try to insert after <!-- TESTS: --> line
    tests_match = re.search(r"(<!--\s*TESTS:.*?-->)\n", text)
    if tests_match:
        insert_pos = tests_match.end()
        return text[:insert_pos] + "\n" + meta_block + "\n\n" + text[insert_pos:].lstrip("\n")

    # Fall back to after the first heading
    heading_match = re.search(r"^(#.+)\n", text)
    if heading_match:
        insert_pos = heading_match.end()
        return text[:insert_pos] + "\n" + meta_block + "\n\n" + text[insert_pos:].lstrip("\n")

    # Last resort: prepend
    return meta_block + "\n\n" + text


def process_plan(filepath: Path, dry_run: bool) -> dict:
    """Process a single plan file. Returns info dict."""
    text = filepath.read_text(encoding="utf-8")

    if has_plan_meta(text):
        return {"file": filepath.name, "status": "skipped", "reason": "already has PLAN_META"}

    plan_id = extract_plan_id_from_filename(filepath.name)
    tests = extract_tests(text)
    phases = extract_phases(text)
    dependencies = DEPENDENCY_MAP.get(plan_id, [])

    meta_block = generate_plan_meta(plan_id, phases, dependencies)

    if not dry_run:
        new_text = insert_plan_meta(text, meta_block)
        filepath.write_text(new_text, encoding="utf-8")

    return {
        "file": filepath.name,
        "status": "updated",
        "plan_id": plan_id,
        "phases": len(phases),
        "deps": len(dependencies),
        "tests": len(tests),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--investigation-dir",
        type=Path,
        default=Path.home()
        / "CC/SWFRecomp-CC/ruffle-tests/tests/swfs/avm1/_investigation",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    complete_dir = args.investigation_dir / "complete"
    if not complete_dir.is_dir():
        print(f"ERROR: {complete_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    # Skip PLAN_INDEX.md (it's an index, not a plan) and non-plan docs
    skip_files = {"PLAN_INDEX.md"}
    plan_files = sorted(
        f for f in complete_dir.glob("*.md")
        if f.name not in skip_files
    )
    print(f"Found {len(plan_files)} completed plan files")
    if args.dry_run:
        print("DRY RUN — no files will be modified\n")

    updated = 0
    skipped = 0
    with_phases = 0
    with_deps = 0

    for filepath in plan_files:
        result = process_plan(filepath, args.dry_run)
        if result["status"] == "skipped":
            skipped += 1
            continue

        updated += 1
        if result["phases"] > 0:
            with_phases += 1
        if result["deps"] > 0:
            with_deps += 1

        dep_str = f", {result['deps']} deps" if result["deps"] else ""
        phase_str = f"{result['phases']} phases" if result["phases"] else "no phases"
        print(f"  {result['plan_id']}: {phase_str}{dep_str}")

    print(f"\nSummary: {updated} updated, {skipped} skipped")
    print(f"  With phases: {with_phases}/{updated}")
    print(f"  With dependencies: {with_deps}/{updated}")

    # Show plans in DEPENDENCY_MAP that weren't found
    found_ids = {extract_plan_id_from_filename(f.name) for f in plan_files}
    missing = set(DEPENDENCY_MAP.keys()) - found_ids
    if missing:
        print(f"\n  Dependency map entries not matching any plan file: {missing}")
        print("  (These may use different naming or be in incomplete/blocked)")


if __name__ == "__main__":
    main()
