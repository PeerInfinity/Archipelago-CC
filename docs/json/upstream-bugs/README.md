# Upstream Bugs

This directory documents bugs discovered in the upstream Archipelago repository during development and testing of this fork. These bugs exist in the official Archipelago codebase and may or may not have been reported or fixed upstream.

## Bug Index

### A Link to the Past (ALttP)

| Bug | Status | Description |
|-----|--------|-------------|
| [Bunny Rules](./alttp/bunny-rules.md) | Fixed in fork | Superbunny path rules always evaluate to True due to missing invocation and late binding bugs |

### Satisfactory

| Bug | Status | Description |
|-----|--------|-------------|
| [Belt Speed Dead Code](./satisfactory/belt-speed-dead-code.md) | Workaround in fork | Belt speed rule callable never invoked with `(state)`, always evaluates truthy |

### APWorld Manager

| Bug | Status | Description |
|-----|--------|-------------|
| [flake8 F821 Errors](./apworld-manager/flake8.md) | Upstream | `md_app.py` references Kivy classes without importing them |

### Landstalker

| Bug | Status | Description |
|-----|--------|-------------|
| [Non-Deterministic Hints](./landstalker/nondeterministic-hints.md) | Fixed in fork | `list(set(hint_texts))` before the seeded shuffle gives unstable ordering, so the same seed assigns different hints to NPCs |
| [Memory Leak](./landstalker-memory-leak.md) | False alarm | Initially thought to be upstream bug, but was fork-specific (exporter called `fill_slot_data` after cleanup) |

### Lufia II Ancient Cave

| Bug | Status | Description |
|-----|--------|-------------|
| [Non-Deterministic Boss Groups](./lufia2ac/nondeterministic-boss-groups.md) | Fixed in fork | `Boss.extra_options` built from a `set`, so `enumerate()` assigns unstable integer keys to random-group names → non-deterministic JSON export |

### shapez

| Bug | Status | Description |
|-----|--------|-------------|
| [UT Balancer Accuracy](./shapez/ut-balancer-accuracy.md) | Fixed in fork | UT regen force-cleared `early_balancer_tunnel_and_trash`, making UT region logic more permissive than the server |

## Document Types

For each bug, we maintain up to three types of documentation:

| Type | Purpose | Example |
|------|---------|---------|
| **Technical doc** | Detailed analysis for developers | [bunny-rules.md](./alttp/bunny-rules.md) |
| **Bug report** | Formatted for upstream submission | [bunny-rules-bug-report.md](./alttp/bunny-rules-bug-report.md) |
| **Diff file** | Patch to fix the bug | [alttp-bunny-rules.diff](../developer/diffs/diff-files/alttp-bunny-rules.diff) |

## Related Documentation

- [Diffs from Upstream](../developer/diffs/README.md) - Patch files for all upstream modifications
- [Fuzz Tests](../developer/tests/test-fuzz.md) - Testing methodology that discovered several bugs
- [Repository Changes](../developer/diffs/repository-changes.md) - Complete list of changes from upstream
