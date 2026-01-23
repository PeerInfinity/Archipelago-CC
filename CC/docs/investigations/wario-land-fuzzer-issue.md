# Wario Land APWorld UT Fuzzer Investigation

**Date**: 2026-01-23
**Game**: Wario Land (wl.apworld)
**Template**: `Wario Land.yaml`
**APWorld Source**: https://github.com/randomcodegen/Archipelago/releases/download/1.2.6/wl.apworld

## Summary

The Wario Land apworld fails 100% of UT fuzzer tests due to a missing ROM file dependency. This is **not** a logic error or tracking mismatch - it's a fundamental incompatibility with headless testing environments.

## Test Results

- **Total runs**: 10
- **Success**: 0 (0.0%)
- **Failures**: 10
- **Timeouts**: 0
- **Ignored**: 0

## Root Cause

The apworld's `stage_assert_generate` method unconditionally requires a ROM file:

```python
# From wl/__init__.py line 77
@classmethod
def stage_assert_generate(cls, multiworld: MultiWorld):
    rom_file = get_base_rom_path()
    if not os.path.exists(rom_file):
        raise FileNotFoundError(rom_file)
```

The error message:
```
FileNotFoundError: /home/user/Archipelago-CC/Wario Land - Super Mario Land 3 (World).gb
```

## Why This Fails

1. The Wario Land apworld requires the physical ROM file `Wario Land - Super Mario Land 3 (World).gb` to generate any seed
2. The ROM file has MD5 checksum validation: `d9d957771484ef846d4e8d241f6f2815`
3. The apworld does NOT check the `skip_required_files` setting, unlike other ROM-based worlds

### Comparison with ALttP (Working Pattern)

ALttP handles this gracefully by checking `skip_required_files`:

```python
# From worlds/alttp/__init__.py
@classmethod
def stage_assert_generate(cls, multiworld: MultiWorld):
    rom_file = get_base_rom_path()
    from settings import skip_required_files

    if not os.path.exists(rom_file):
        if skip_required_files:
            lttp_logger.warning("ALTTP ROM file not found but skip_required_files is set...")
        else:
            raise FileNotFoundError(rom_file)
```

## Required Fix (APWorld Maintainer)

The apworld maintainer needs to update `stage_assert_generate` to respect `skip_required_files`:

```python
@classmethod
def stage_assert_generate(cls, multiworld: MultiWorld):
    rom_file = get_base_rom_path()
    from settings import skip_required_files

    if not os.path.exists(rom_file):
        if skip_required_files:
            import logging
            logging.getLogger("Wario Land").warning(
                f"ROM file not found at {rom_file} but skip_required_files is set. "
                "ROM generation will be skipped."
            )
        else:
            raise FileNotFoundError(rom_file)
```

Additionally, the `generate_output` method should skip ROM patching when `skip_required_files` is True.

## Recommendations

### Option 1: Report to Maintainer (Recommended)
File an issue at the apworld's repository requesting the `skip_required_files` check be added. This is the proper fix.

**Maintainer Repository**: https://github.com/randomcodegen/Archipelago

### Option 2: Add to Known Incompatible List
If the maintainer is unresponsive, add Wario Land to a list of apworlds that cannot be UT-fuzz tested due to ROM requirements.

### Option 3: Local Workaround (Not Recommended)
We could theoretically create an empty file or mock ROM to pass the existence check, but:
- It would fail MD5 validation when patching
- It doesn't test real functionality
- It masks the real issue

## Files Examined

- `custom_worlds/wl.apworld` - The apworld package
- `wl/__init__.py` - Main world class with `stage_assert_generate`
- `wl/Rom.py` - ROM handling with MD5 validation
- `worlds/alttp/__init__.py` - Reference implementation that handles `skip_required_files`

## APWorld Metadata

- **APWorld ID**: wl
- **Game Name**: Wario Land
- **Status in Spreadsheet**: Stable
- **Template**: `Wario Land.yaml`
- **World Directory**: `wl/`

## Related Data

From `scripts/data/apworld-combined-data.json`:
```json
{
  "apworld_id": "wl",
  "test_results": {
    "generation": {
      "success": false,
      "error_type": "FileNotFoundError"
    }
  },
  "enabled": true
}
```

This shows the issue is already known to cause generation failures.
