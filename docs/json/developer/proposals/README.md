# Upstream Feature Proposals

This directory contains feature proposals for the upstream Archipelago project that would reduce the modifications needed in this fork.

## Proposals

### 1. [Generation Pipeline Hooks](./generation-hooks-proposal.md)

**Status:** Draft

Proposes adding a hook system to `Main.py` that allows APWorlds to register callbacks for generation events. This would enable:
- Distributing the JSON exporter as an APWorld
- Other post-generation utilities as APWorlds
- Cleaner separation between core Archipelago and extensions

**Impact if accepted:** Eliminates modifications to `Main.py` and `BaseClasses.py` for exporter integration.

### 2. [ROM-less Generation Mode](./skip-required-files-proposal.md)

**Status:** Draft

Proposes adding a `skip_required_files` setting that allows generation to proceed without ROM files. This would enable:
- CI/CD testing without ROM distribution
- Logic development and debugging
- Tool development and analytics

**Impact if accepted:** Eliminates modifications to 11 world `__init__.py` files.

### 3. [APWorld Settings Extension](./settings-extension-proposal.md)

**Status:** Draft (may not require upstream changes)

Analyzes options for APWorlds to define their own settings. Concludes that the existing `settings_key` pattern already supports this for hidden utility worlds - only documentation updates are needed.

**Impact:** Clarifies that no upstream changes are needed for APWorld settings.

## Current Fork Modifications

These proposals aim to eliminate the following modifications from the upstream:

| File | Lines Changed | Proposal |
|------|---------------|----------|
| Main.py | ~25 | Generation Hooks |
| BaseClasses.py | ~12 | Generation Hooks |
| settings.py | ~25 | Both proposals |
| worlds/alttp/\_\_init\_\_.py | ~45 | ROM-less Generation |
| worlds/dkc3/\_\_init\_\_.py | ~35 | ROM-less Generation |
| worlds/smw/\_\_init\_\_.py | ~30 | ROM-less Generation |
| (8 more world files) | ~200 | ROM-less Generation |

**Total:** ~370 lines of modifications could be eliminated if both proposals are accepted.

## Submitting Proposals

Before submitting to the Archipelago project:

1. Review the [Contributing Guide](https://github.com/ArchipelagoMW/Archipelago/blob/main/docs/contributing.md)
2. Check for existing related issues/discussions
3. Consider creating a Discord discussion first
4. Submit as a GitHub Issue with the "enhancement" label

## Notes

- These proposals are designed to be minimal and non-breaking
- Each can be implemented independently
- The Generation Hooks proposal has higher priority for this project
- Both are designed to benefit the broader Archipelago ecosystem
