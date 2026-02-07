# Upstream Bugs

This directory documents bugs discovered in the upstream Archipelago repository during development and testing of this fork. These bugs exist in the official Archipelago codebase and may or may not have been reported or fixed upstream.

## Bug Index

### A Link to the Past (ALttP)

| Bug | Status | Description |
|-----|--------|-------------|
| [Bunny Rules](./alttp/bunny-rules.md) | Fixed in fork | Superbunny path rules always evaluate to True due to missing invocation and late binding bugs |

### Landstalker

| Bug | Status | Description |
|-----|--------|-------------|
| [Memory Leak](./landstalker-memory-leak.md) | False alarm | Initially thought to be upstream bug, but was fork-specific (exporter called `fill_slot_data` after cleanup) |
| [Memory Leak Repro](./landstalker-memory-leak-repro.md) | Closed | Reproduction steps for the false alarm |
| [Memory Leak Fix](./landstalker-memory-leak-fix.md) | Applied | Fix documentation for the fork-specific issue |

## Document Types

For each bug, we maintain up to three types of documentation:

| Type | Purpose | Example |
|------|---------|---------|
| **Technical doc** | Detailed analysis for developers | [bunny-rules.md](./alttp/bunny-rules.md) |
| **Bug report** | Formatted for upstream submission | [bunny-rules-bug-report.md](./alttp/bunny-rules-bug-report.md) |
| **Diff file** | Patch to fix the bug | [alttp-bunny-rules.diff](../developer/diffs/alttp-bunny-rules.diff) |

## Related Documentation

- [Diffs from Upstream](../developer/diffs/README.md) - Patch files for all upstream modifications
- [Fuzz Tests](../developer/tests/test-fuzz.md) - Testing methodology that discovered several bugs
- [Repository Changes](../developer/diffs/repository-changes.md) - Complete list of changes from upstream
