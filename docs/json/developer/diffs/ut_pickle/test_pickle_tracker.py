#!/usr/bin/env python3
"""
Test script for the pickle tracker apworld.

Tests the full pickle export/load cycle:
1. Generate a seed for a simple game (ChecksFinder)
2. Verify pickle file was exported by the monkey-patched Main.main
3. Load the pickle and verify the multiworld structure
4. Do a basic logic check (collect items, verify reachability changes)

Usage:
    cd ~/CC/Archipelago-vanilla
    source .venv/bin/activate
    python scripts/test_pickle_tracker.py
"""

import json
import os
import sys
import tempfile
import shutil

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_pickle_export():
    """Test that generating a seed produces a pickle file."""
    print("=" * 60)
    print("TEST 1: Pickle export during seed generation")
    print("=" * 60)

    from Utils import output_path

    # Create a minimal YAML for ChecksFinder
    yaml_content = """\
name: TestPlayer
game: ChecksFinder
ChecksFinder: {}
"""

    with tempfile.TemporaryDirectory() as tmpdir:
        # Write the YAML
        yaml_path = os.path.join(tmpdir, "TestPlayer.yaml")
        with open(yaml_path, 'w') as f:
            f.write(yaml_content)

        # Clean output directory of any previous test files
        out_dir = output_path()

        # Run generation: Generate.main produces (args, seed),
        # then Main.main runs the actual generation (and our pickle hook)
        import Main
        from Generate import main as generate_main, mystery_argparse

        sys.argv = sys.argv[:1]  # Strip CLI args
        args = mystery_argparse()
        args.player_files_path = tmpdir
        args.seed = 1
        args.multi = 0
        args.skip_output = True  # Skip .archipelago output, we only want the pickle

        print(f"  Generating seed with ChecksFinder...")
        erargs, seed = generate_main(args)
        multiworld = Main.main(erargs, seed)

        assert multiworld is not None, "Main.main returned None!"
        seed_name = multiworld.seed_name
        print(f"  Seed name: {seed_name}")
        print(f"  Game: {multiworld.worlds[1].game}")

        # Check for pickle file
        pickle_filename = f"AP_{seed_name}.pkl.gz"
        metadata_filename = f"AP_{seed_name}_pickle_meta.json"
        pickle_path = os.path.join(out_dir, pickle_filename)
        metadata_path = os.path.join(out_dir, metadata_filename)

        assert os.path.exists(pickle_path), f"Pickle file not found: {pickle_path}"
        pickle_size = os.path.getsize(pickle_path)
        print(f"  Pickle file created: {pickle_path} ({pickle_size:,} bytes)")

        assert os.path.exists(metadata_path), f"Metadata file not found: {metadata_path}"
        with open(metadata_path) as f:
            metadata = json.load(f)
        print(f"  Metadata: {json.dumps(metadata, indent=2)}")

        assert metadata['seed_name'] == seed_name
        assert '1' in metadata['players']
        assert metadata['players']['1']['game'] == 'ChecksFinder'

        print("  PASSED!")
        return pickle_path, seed_name


def test_pickle_load(pickle_path):
    """Test loading a pickle and verifying the multiworld."""
    print()
    print("=" * 60)
    print("TEST 2: Pickle load and multiworld verification")
    print("=" * 60)

    from worlds.ut_pickle.pickle_exporter import load_multiworld_pickle

    multiworld = load_multiworld_pickle(pickle_path)
    assert multiworld is not None, "Failed to load multiworld from pickle"

    # Verify basic structure
    print(f"  Players: {list(multiworld.player_ids)}")
    print(f"  Game: {multiworld.worlds[1].game}")

    world = multiworld.worlds[1]
    regions = list(multiworld.regions.region_cache.get(1, {}).keys())
    locations = list(multiworld.get_locations(1))
    items = list(multiworld.itempool)

    print(f"  Regions: {len(regions)}")
    print(f"  Locations: {len(locations)}")
    print(f"  Items in pool: {len(items)}")

    assert len(regions) > 0, "No regions found in pickle"
    assert len(locations) > 0, "No locations found in pickle"
    assert len(items) > 0, "No items in pool"

    print("  PASSED!")
    return multiworld


def test_pickle_tracking(pickle_path):
    """Test the pickle tracking initialization flow."""
    print()
    print("=" * 60)
    print("TEST 3: Pickle tracking initialization")
    print("=" * 60)

    import logging
    from worlds.ut_pickle.pickle_mixin import PickleMixin

    # Create a minimal tracker-like object that uses PickleMixin
    class MinimalTracker(PickleMixin):
        def __init__(self):
            self.logger = logging.getLogger("test")
            self.multiworld = None
            self.player_id = None
            self._init_pickle_mixin()

    tracker = MinimalTracker()

    # Load pickle
    result = tracker.load_multiworld_from_pickle(pickle_path)
    assert result, "Failed to load multiworld from pickle"
    print(f"  Pickle loaded successfully")

    # Initialize tracking
    result = tracker.initialize_tracking_from_pickle()
    assert result, "Failed to initialize tracking from pickle"
    assert tracker.multiworld is not None
    assert tracker.player_id == 1
    assert tracker._tracking_from_pickle
    print(f"  Tracking initialized from pickle")

    print("  PASSED!")
    return tracker


def test_logic_check(tracker):
    """Test basic logic checking with the pickled multiworld."""
    print()
    print("=" * 60)
    print("TEST 4: Basic logic check")
    print("=" * 60)

    from BaseClasses import CollectionState

    multiworld = tracker.multiworld
    player_id = tracker.player_id

    # Create empty state
    state = CollectionState(multiworld)

    # Check initial reachability (no items)
    initial_reachable = [
        loc for loc in multiworld.get_reachable_locations(state, player_id)
        if loc.address is not None
    ]
    print(f"  Reachable locations with no items: {len(initial_reachable)}")

    # Collect all progression items
    prog_items = [
        item for item in multiworld.itempool
        if item.advancement
    ]
    print(f"  Progression items: {len(prog_items)}")

    for item in prog_items:
        state.collect(item, True)

    # Sweep for events
    state.sweep_for_advancements(
        locations=[loc for loc in multiworld.get_locations(player_id) if not loc.address]
    )

    # Check reachability with all items
    all_reachable = [
        loc for loc in multiworld.get_reachable_locations(state, player_id)
        if loc.address is not None
    ]
    print(f"  Reachable locations with all items: {len(all_reachable)}")

    total_locations = [
        loc for loc in multiworld.get_locations(player_id)
        if loc.address is not None
    ]
    print(f"  Total non-event locations: {len(total_locations)}")

    # With all progression items, we should reach all or nearly all locations
    assert len(all_reachable) >= len(initial_reachable), \
        "Collecting items should not reduce reachable locations"
    assert len(all_reachable) > 0, "Should be able to reach some locations with all items"

    reach_pct = len(all_reachable) / len(total_locations) * 100 if total_locations else 0
    print(f"  Reachability: {reach_pct:.0f}%")

    print("  PASSED!")


def test_auto_discover(seed_name):
    """Test auto-discovery of pickle files."""
    print()
    print("=" * 60)
    print("TEST 5: Auto-discovery of pickle files")
    print("=" * 60)

    import logging
    from worlds.ut_pickle.pickle_mixin import PickleMixin

    class MinimalTracker(PickleMixin):
        def __init__(self):
            self.logger = logging.getLogger("test")
            self.multiworld = None
            self.player_id = None
            self.game = "ChecksFinder"
            self.seed_name = seed_name
            self._init_pickle_mixin()

    tracker = MinimalTracker()
    result = tracker.auto_discover_pickle()
    assert result, f"Auto-discover failed for seed {seed_name}"
    assert tracker.pickle_path is not None
    print(f"  Auto-discovered pickle at: {tracker.pickle_path}")

    print("  PASSED!")


def test_monkey_patch_installed():
    """Verify the monkey patch was installed on Main.main."""
    print("=" * 60)
    print("TEST 0: Monkey patch verification")
    print("=" * 60)

    import Main
    # The patched function should have __wrapped__ from functools.wraps
    main_func = Main.main
    is_wrapped = hasattr(main_func, '__wrapped__')
    print(f"  Main.main is wrapped: {is_wrapped}")
    print(f"  Main.main: {main_func}")
    assert is_wrapped, "Main.main was not monkey-patched! The pickle export hook is not installed."
    print("  PASSED!")


def main():
    print()
    print("Pickle Tracker Test Suite")
    print("=" * 60)
    print()

    # Ensure worlds are loaded (triggers monkey patch install)
    import worlds  # noqa: F401

    test_monkey_patch_installed()
    print()

    pickle_path, seed_name = test_pickle_export()
    test_pickle_load(pickle_path)
    tracker = test_pickle_tracking(pickle_path)
    test_logic_check(tracker)
    test_auto_discover(seed_name)

    print()
    print("=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    main()
