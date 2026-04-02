#!/usr/bin/env python3
"""Sync a module config file to have all modules from a reference config.

Modules already in the target keep their current definition (including enabled state).
Modules missing from the target are added with enabled: false.
Reports any modules in the target that appear out of order relative to the reference.
"""

import argparse
import json


def main():
    parser = argparse.ArgumentParser(
        description="Sync a module config to match a reference config's module list and order."
    )
    parser.add_argument(
        "reference",
        help="Reference module config file (e.g. modules.json)",
    )
    parser.add_argument(
        "target",
        help="Target module config file to update (e.g. modules-vibecoding.json)",
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Print what would change without writing the file",
    )
    args = parser.parse_args()

    with open(args.reference) as f:
        reference = json.load(f)
    with open(args.target) as f:
        target = json.load(f)

    ref_modules = reference["moduleDefinitions"]
    target_modules = target["moduleDefinitions"]
    ref_order = list(ref_modules.keys())

    # Warn about 'requires' in target definitions (should be in moduleInfo, not config JSON)
    for k, v in target_modules.items():
        if 'requires' in v:
            print(f"WARNING: '{k}' in target has 'requires' — this belongs in moduleInfo, not config JSON")

    # Check for modules in target that aren't in reference
    extra = [k for k in target_modules if k not in ref_modules]
    if extra:
        print(f"WARNING: Target has modules not in reference: {extra}")

    # Check ordering of existing target modules relative to reference
    target_keys_in_ref = [k for k in ref_order if k in target_modules]
    target_order = [k for k in target_modules if k in ref_modules]
    if target_order != target_keys_in_ref:
        print("WARNING: Target modules are out of order relative to reference:")
        # Find the specific out-of-order modules
        expected_idx = {k: i for i, k in enumerate(ref_order)}
        prev_ref_idx = -1
        for key in target_order:
            ref_idx = expected_idx[key]
            if ref_idx < prev_ref_idx:
                # Find what it came after in the target
                target_list = list(target_modules.keys())
                pos = target_list.index(key)
                predecessor = target_list[pos - 1] if pos > 0 else "(start)"
                print(f"  - '{key}' appears after '{predecessor}' in target, "
                      f"but should come earlier per reference order")
            prev_ref_idx = max(prev_ref_idx, ref_idx)
    else:
        print("OK: Existing target modules are in correct order.")

    # Build merged module definitions in reference order
    merged = {}
    added = []
    kept = []
    for key in ref_order:
        if key in target_modules:
            merged[key] = target_modules[key]
            kept.append(key)
        else:
            entry = dict(ref_modules[key])
            entry["enabled"] = False
            entry.pop("requires", None)  # requires lives in moduleInfo, not config JSON
            merged[key] = entry
            added.append(key)

    # Append any extra target modules not in reference (at the end)
    for key in extra:
        merged[key] = target_modules[key]

    # Use reference loadPriority, appending any extras
    load_priority = list(reference["loadPriority"])
    for key in extra:
        if key not in load_priority:
            load_priority.append(key)

    result = {
        "moduleDefinitions": merged,
        "loadPriority": load_priority,
    }

    print(f"\nKept {len(kept)} existing modules from target.")
    if added:
        print(f"Added {len(added)} modules (disabled): {added}")
    else:
        print("No modules to add.")

    if args.dry_run:
        print("\n[DRY RUN] Would write:")
        print(json.dumps(result, indent=2))
    else:
        with open(args.target, "w") as f:
            json.dump(result, f, indent=2)
            f.write("\n")
        print(f"\nWrote updated config to {args.target}")


if __name__ == "__main__":
    main()
