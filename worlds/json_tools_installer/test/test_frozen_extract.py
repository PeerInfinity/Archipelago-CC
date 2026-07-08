"""Extractor routing: frozen_dest redirection, unsupported_frozen skips,
and the source-install regression guard (byte-identical extraction).

All expectations are derived from COMPONENTS metadata, never from literal
directory names.
"""
import pytest

from worlds.json_tools_installer.installer import extractor
from worlds.json_tools_installer.installer.extractor import COMPONENTS

from .sandbox_utils import build_archive, component_entries, entry_for

# Components routed into a subdirectory (e.g. lib/) on frozen installs
FROZEN_DEST_COMPONENTS = sorted(
    name for name, comp in COMPONENTS.items()
    if comp.frozen_dest and comp.source_paths
)
# Components that cannot work on frozen installs at all
UNSUPPORTED_COMPONENTS = sorted(
    name for name, comp in COMPONENTS.items() if comp.unsupported_frozen
)
# Plain components that extract to the root on every install type.
# frontend/presets are excluded (they have interacting special-case logic),
# world_source is excluded (its source_paths exist for detection only).
PLAIN_COMPONENTS = sorted(
    name for name, comp in COMPONENTS.items()
    if comp.source_paths and not comp.frozen_dest and not comp.frozen_apworld
    and not comp.unsupported_frozen
    and name not in ("frontend", "presets", "world_source")
)

ALL_TEST_COMPONENTS = FROZEN_DEST_COMPONENTS + UNSUPPORTED_COMPONENTS + PLAIN_COMPONENTS


def test_component_metadata_expectations():
    """Guard against metadata drift silently making these tests vacuous."""
    assert FROZEN_DEST_COMPONENTS, "no frozen_dest components left to test"
    assert UNSUPPORTED_COMPONENTS, "no unsupported_frozen components left to test"
    assert PLAIN_COMPONENTS, "no plain root components left to test"
    # The extended rule_builder cannot load on frozen installs; if this ever
    # changes, revisit the frozen scenarios that assert its skip warning.
    assert "rule_builder" in UNSUPPORTED_COMPONENTS


@pytest.fixture
def extracted(tmp_path):
    """Build the synthetic archive and a fresh dest dir."""
    archive = tmp_path / "archive.zip"
    entries = component_entries(ALL_TEST_COMPONENTS)
    build_archive(archive, entries)
    dest = tmp_path / "dest"
    dest.mkdir()
    return archive, entries, dest


def test_source_install_byte_identical(extracted, frozen):
    """Source installs extract every file to its archive-relative path,
    byte-identical — the regression guard for the pre-frozen-support path."""
    frozen(False)
    archive, entries, dest = extracted
    result = extractor.extract_tools(archive, ALL_TEST_COMPONENTS, dest_root=dest)

    assert result.success, result.errors
    assert result.warnings == []
    assert result.skipped_files == []
    for rel, data in entries.items():
        assert (dest / rel).read_bytes() == data, rel
    assert sorted(result.extracted_files) == sorted(entries)
    # Nothing was redirected into any frozen_dest subdirectory
    for name in FROZEN_DEST_COMPONENTS:
        comp = COMPONENTS[name]
        for source_path in comp.source_paths:
            assert not (dest / comp.frozen_dest / entry_for(source_path)).exists()


def test_frozen_dest_routing(extracted, frozen):
    """Frozen installs redirect frozen_dest components under their subdir
    and keep plain components at the root."""
    frozen(True)
    archive, entries, dest = extracted
    result = extractor.extract_tools(archive, ALL_TEST_COMPONENTS, dest_root=dest)

    assert result.success, result.errors
    for name in FROZEN_DEST_COMPONENTS:
        comp = COMPONENTS[name]
        for source_path in comp.source_paths:
            rel = entry_for(source_path)
            assert (dest / comp.frozen_dest / rel).read_bytes() == entries[rel], rel
            assert not (dest / rel).exists(), rel
    for name in PLAIN_COMPONENTS:
        for source_path in COMPONENTS[name].source_paths:
            rel = entry_for(source_path)
            assert (dest / rel).read_bytes() == entries[rel], rel


def test_frozen_skips_unsupported_components(extracted, frozen):
    """unsupported_frozen components extract nothing and produce exactly one
    warning each, carrying the component name and its reason."""
    frozen(True)
    archive, _entries, dest = extracted
    result = extractor.extract_tools(archive, ALL_TEST_COMPONENTS, dest_root=dest)

    assert result.success, result.errors
    for name in UNSUPPORTED_COMPONENTS:
        comp = COMPONENTS[name]
        assert comp.unsupported_frozen is not None
        for source_path in comp.source_paths:
            rel = entry_for(source_path)
            assert not (dest / rel).exists(), rel
            if comp.frozen_dest:
                assert not (dest / comp.frozen_dest / rel).exists(), rel
        matching = [w for w in result.warnings if f"'{name}'" in w]
        assert len(matching) == 1, (name, result.warnings)
        assert comp.unsupported_frozen in matching[0]
    assert len(result.warnings) == len(UNSUPPORTED_COMPONENTS), result.warnings
