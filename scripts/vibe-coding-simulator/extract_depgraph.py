#!/usr/bin/env python3
"""Extract PLAN_META from SWFRecomp plan documents and produce DepGraph JSON.

Scans plan documents for <!-- PLAN_META ... --> blocks, parses the YAML,
builds a dependency graph where each phase is a node, and outputs a
DepGraph-compatible JSON file.

Usage:
    python extract_depgraph.py [--investigation-dir PATH] [--output PATH] [--validate-only]

Defaults:
    --investigation-dir: ~/CC/SWFRecomp-CC/ruffle-tests/tests/swfs/avm1/_investigation
    --output: depgraph_swfrecomp.json
"""

import argparse
import json
import re
import sys
from pathlib import Path

import yaml


def find_plan_files(investigation_dir: Path) -> list[Path]:
    """Find all .md files in complete/, incomplete/, and blocked/ subdirectories."""
    plan_files = []
    for subdir in ["complete", "incomplete", "blocked"]:
        dirpath = investigation_dir / subdir
        if dirpath.is_dir():
            plan_files.extend(sorted(dirpath.glob("*PLAN*.md")))
    return plan_files


def extract_plan_meta(filepath: Path) -> dict | None:
    """Extract the PLAN_META YAML block from a markdown file."""
    text = filepath.read_text(encoding="utf-8")
    match = re.search(
        r"<!--\s*PLAN_META\s*\n(.*?)\n\s*-->", text, re.DOTALL
    )
    if not match:
        return None
    yaml_text = match.group(1)
    try:
        return yaml.safe_load(yaml_text)
    except yaml.YAMLError as e:
        print(f"  WARNING: YAML parse error in {filepath.name}: {e}", file=sys.stderr)
        return None


def extract_tests(filepath: Path) -> list[str]:
    """Extract the test list from <!-- TESTS: ... --> comment."""
    text = filepath.read_text(encoding="utf-8")
    match = re.search(r"<!--\s*TESTS:\s*(.*?)\s*-->", text)
    if not match:
        return []
    return [t.strip() for t in match.group(1).split(",") if t.strip()]


def make_node_id(plan_id: str, phase_id: str | int) -> str:
    """Create a DepGraph node ID from plan ID and phase ID."""
    return f"{plan_id}.{phase_id}"


def phase_status_label(status: str) -> str:
    """Convert phase status to a short label for the description."""
    return {
        "complete": "DONE",
        "incomplete": "IN PROGRESS",
        "blocked": "BLOCKED",
        "not_started": "TODO",
    }.get(status, status.upper())


def build_depgraph(plan_metas: list[dict], plan_tests: dict[str, list[str]]) -> dict:
    """Build a DepGraph-compatible JSON structure from parsed PLAN_META data.

    Each phase becomes a node. Dependencies:
    - Internal: each phase depends on the previous phase in the same plan
    - External: cross-plan dependencies from the 'dependencies' field
    """
    nodes = {}

    # First pass: create all nodes
    for meta in plan_metas:
        plan_id = meta["id"]
        phases = meta.get("phases", [])
        tests = plan_tests.get(plan_id, [])

        if not phases:
            # Plan with no phases becomes a single node
            node_id = plan_id
            nodes[node_id] = {
                "label": plan_id.replace("_", " ").title(),
                "description": f"Status: {meta.get('status', 'unknown')}",
                "depends_on": [],
                "_plan_id": plan_id,
                "_phase_id": None,
                "_status": meta.get("status", "unknown"),
                "_tests": tests,
            }
            continue

        for i, phase in enumerate(phases):
            phase_id = phase.get("id", i + 1)
            node_id = make_node_id(plan_id, phase_id)
            phase_name = phase.get("name", f"Phase {phase_id}")
            status = phase.get("status", "not_started")

            label = f"{plan_id.replace('_', ' ').title()}: {phase_name}"
            # DepGraph truncates at 60 chars
            if len(label) > 60:
                label = label[:57] + "..."

            description = f"Status: {phase_status_label(status)}"
            if tests and i == len(phases) - 1:
                description += f" | Tests: {', '.join(tests)}"

            depends_on = []

            # Internal dependency: each phase depends on the previous one
            if i > 0:
                prev_phase_id = phases[i - 1].get("id", i)
                depends_on.append(make_node_id(plan_id, prev_phase_id))

            # Per-phase blocked_by dependencies
            for dep in phase.get("blocked_by", []):
                dep_plan = dep.get("plan", "")
                dep_phases = dep.get("phases", [])
                if dep_plan and dep_phases:
                    for dp in dep_phases:
                        depends_on.append(make_node_id(dep_plan, dp))
                elif dep_plan:
                    depends_on.append(dep_plan)

            nodes[node_id] = {
                "label": label,
                "description": description,
                "depends_on": depends_on,
                "_plan_id": plan_id,
                "_phase_id": phase_id,
                "_status": status,
                "_tests": [],
            }

    # Second pass: add cross-plan dependencies
    for meta in plan_metas:
        plan_id = meta["id"]
        phases = meta.get("phases", [])
        dependencies = meta.get("dependencies", [])

        if not dependencies:
            continue

        # Find the first phase of this plan (the entry point)
        if phases:
            first_phase_id = phases[0].get("id", 1)
            target_node = make_node_id(plan_id, first_phase_id)
        else:
            target_node = plan_id

        if target_node not in nodes:
            continue

        for dep in dependencies:
            dep_plan = dep.get("plan", "")
            dep_phases = dep.get("phases", [])
            dep_type = dep.get("type", "requires")

            # Skip "complements" dependencies — they're informational,
            # not hard prerequisites. Including them creates cycles.
            if dep_type == "complements":
                continue

            if dep_phases:
                # Depend on specific phases of the other plan
                for dp in dep_phases:
                    dep_node = make_node_id(dep_plan, dp)
                    if dep_node in nodes:
                        if dep_node not in nodes[target_node]["depends_on"]:
                            nodes[target_node]["depends_on"].append(dep_node)
                    else:
                        print(
                            f"  WARNING: {target_node} depends on {dep_node} which doesn't exist",
                            file=sys.stderr,
                        )
            else:
                # Depend on the last phase of the other plan
                last_phase_node = find_last_phase_node(nodes, dep_plan)
                if last_phase_node:
                    if last_phase_node not in nodes[target_node]["depends_on"]:
                        nodes[target_node]["depends_on"].append(last_phase_node)
                else:
                    print(
                        f"  WARNING: {target_node} depends on plan {dep_plan} which has no phases",
                        file=sys.stderr,
                    )

    return nodes


def find_last_phase_node(nodes: dict, plan_id: str) -> str | None:
    """Find the last phase node for a given plan ID."""
    plan_nodes = [
        nid for nid, n in nodes.items() if n.get("_plan_id") == plan_id
    ]
    if not plan_nodes:
        return None
    return plan_nodes[-1]


def validate_graph(nodes: dict) -> list[str]:
    """Validate the dependency graph: check for missing refs and cycles."""
    errors = []

    # Check all depends_on references exist
    for node_id, node in nodes.items():
        for dep in node["depends_on"]:
            if dep not in nodes:
                errors.append(f"{node_id}: depends on '{dep}' which doesn't exist")

    # Check for cycles using DFS
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {nid: WHITE for nid in nodes}
    cycle_path = []

    def dfs(nid):
        color[nid] = GRAY
        cycle_path.append(nid)
        for dep in nodes[nid]["depends_on"]:
            if dep not in color:
                continue
            if color[dep] == GRAY:
                cycle_start = cycle_path.index(dep)
                cycle = cycle_path[cycle_start:] + [dep]
                errors.append(f"Cycle detected: {' -> '.join(cycle)}")
                return True
            if color[dep] == WHITE:
                if dfs(dep):
                    return True
        cycle_path.pop()
        color[nid] = BLACK
        return False

    for nid in nodes:
        if color[nid] == WHITE:
            dfs(nid)

    return errors


def export_depgraph_json(nodes: dict, title: str) -> dict:
    """Convert internal nodes to DepGraph JSON format (strip internal fields)."""
    output_nodes = {}
    for node_id, node in nodes.items():
        output_nodes[node_id] = {
            "label": node["label"],
            "description": node["description"],
            "depends_on": node["depends_on"],
        }
    return {"title": title, "nodes": output_nodes}


def print_stats(nodes: dict):
    """Print summary statistics."""
    plan_ids = set(n.get("_plan_id") for n in nodes.values())
    statuses = {}
    for n in nodes.values():
        s = n.get("_status", "unknown")
        statuses[s] = statuses.get(s, 0) + 1

    dep_count = sum(len(n["depends_on"]) for n in nodes.values())
    root_count = sum(1 for n in nodes.values() if not n["depends_on"])

    print(f"Plans:        {len(plan_ids)}")
    print(f"Nodes:        {len(nodes)}")
    print(f"Edges:        {dep_count}")
    print(f"Root nodes:   {root_count}")
    print(f"Phase status: {statuses}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--investigation-dir",
        type=Path,
        default=Path.home()
        / "CC/SWFRecomp-CC/ruffle-tests/tests/swfs/avm1/_investigation",
        help="Path to the _investigation directory",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "depgraph_swfrecomp.json",
        help="Output JSON file path",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Only validate, don't write output",
    )
    parser.add_argument(
        "--no-isolated",
        action="store_true",
        help="Exclude isolated nodes (no incoming or outgoing edges)",
    )
    args = parser.parse_args()

    if not args.investigation_dir.is_dir():
        print(f"ERROR: {args.investigation_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    # Find and parse all plan files
    plan_files = find_plan_files(args.investigation_dir)
    print(f"Found {len(plan_files)} plan files")

    plan_metas = []
    plan_tests = {}
    skipped = 0

    for filepath in plan_files:
        meta = extract_plan_meta(filepath)
        if meta is None:
            skipped += 1
            continue
        plan_metas.append(meta)
        tests = extract_tests(filepath)
        plan_tests[meta["id"]] = tests
        phase_count = len(meta.get("phases", []))
        dep_count = len(meta.get("dependencies", []))
        print(f"  {meta['id']}: {phase_count} phases, {dep_count} deps")

    print(f"\nParsed {len(plan_metas)} plans ({skipped} without PLAN_META)")

    # Build the graph
    nodes = build_depgraph(plan_metas, plan_tests)

    # Remove isolated nodes if requested
    if args.no_isolated:
        # A node is isolated if it has no deps AND nothing depends on it
        depended_on = set()
        for n in nodes.values():
            depended_on.update(n["depends_on"])
        isolated = [
            nid for nid, n in nodes.items()
            if not n["depends_on"] and nid not in depended_on
        ]
        for nid in isolated:
            del nodes[nid]
        print(f"Removed {len(isolated)} isolated nodes")

    # Validate
    errors = validate_graph(nodes)
    if errors:
        print(f"\nValidation errors ({len(errors)}):")
        for err in errors:
            print(f"  ERROR: {err}")
    else:
        print("\nValidation: OK (no cycles, no missing references)")

    # Stats
    print()
    print_stats(nodes)

    if args.validate_only:
        sys.exit(1 if errors else 0)

    # Export
    depgraph = export_depgraph_json(nodes, "SWFRecomp AVM1 — Vibe Coding Simulator")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(depgraph, f, indent=2)
    print(f"\nWrote {args.output} ({len(nodes)} nodes)")


if __name__ == "__main__":
    main()
