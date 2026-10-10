#!/usr/bin/env python3
"""Decide whether a push needs the Python test matrix (`unittests.yml`).

Reads changed paths (one per line) on stdin, prints ``true`` or ``false``.

The criterion is the one `unittests_frontend.yml`'s trigger comments use: what
the suite READS, not what it collects. A path can be skipped only if no pytest
test, conftest, or world loaded under pytest reads it. Measured 2026-10-10
(slice ci-workflow-policy-review, finding F1) by grepping `test/`,
`worlds/*/test*` and `conftest.py` for every path they open: pytest reads
`frontend/presets/**` (committed AP_* rules), `frontend/schema/**`
(`test_schema_validation`), `scripts/utils|test|build|data/**`, `.gitmodules`
and every `worlds/**` file (the packed-apworld freshness test). Everything
else under `frontend/`, plus `scripts/procgen/` (non-Python) and
`test_json/`, is read only by the JavaScript suites.

⛔ The list is an ALLOW-TO-SKIP list: anything not matched runs the matrix, an
empty list runs it, and the caller runs it whenever it cannot get the list.
Adding a pattern here needs the same READS check as the trigger comments.
"""
import sys

# A path is skippable when it starts with one of these ...
SKIP_PREFIXES = (
    'frontend/',
    'test_json/',
    'CC/',
    'docs/',
)
# ... unless it starts with one of these (pytest reads them).
KEEP_PREFIXES = (
    'frontend/presets/',
    'frontend/schema/',
)


def skippable(path: str) -> bool:
    if path.startswith(KEEP_PREFIXES):
        return False
    if path.startswith(SKIP_PREFIXES):
        return True
    if path.startswith('scripts/procgen/') and not path.endswith('.py'):
        return True
    # Markdown is prose, except inside a world: a packed apworld embeds its
    # docs, and the freshness test compares the packed bytes.
    if path.endswith('.md') and not path.startswith('worlds/'):
        return True
    return False


def needed(paths) -> bool:
    paths = [p.strip() for p in paths if p.strip()]
    return not paths or not all(skippable(p) for p in paths)


if __name__ == '__main__':
    print('true' if needed(sys.stdin) else 'false')

