"""Codegen meets a rule kind it has no path for: fail LOUDLY (⚖ D3, rule-node-registry 2026-10-21).

The three codegen sinks (the Rule Builder chain, the rule dispatcher, the helper-body expression
generator) used to emit an always-true placeholder (``True_()`` / ``'True'``) for an unknown kind,
silently making a location free. They now raise :class:`UnknownRuleKindError`, naming the kind.

LOSSY mode is opt-in (``--lossy`` on the CLI, ``WorldGenerator(lossy=True)``,
``build_apworld(lossy=True)``): the old placeholder is kept, and every replacement is recorded by
``<site>:<kind>`` so the caller can list what it replaced. An unknown helper NAME is a different
sink (``LOSSY FALLBACK: Unknown helper``) and is not routed here.
"""

import collections
import contextlib
import contextvars
from typing import Iterator, Optional

# None = strict (raise); a Counter = lossy, recording each placeholder emitted
_lossy_record: contextvars.ContextVar[Optional[collections.Counter]] = contextvars.ContextVar(
    'world_generator_lossy_record', default=None)


class UnknownRuleKindError(ValueError):
    """A rule kind world_generator cannot generate code for."""

    def __init__(self, site: str, kind: str):
        self.site = site
        self.kind = kind
        super().__init__(
            f"world_generator has no codegen for rule kind {kind!r} ({site}). Handle the kind, or "
            f"generate with --lossy to emit an always-true placeholder for it "
            f"(docs/json/developer/reference/rule-kind-registry.md)")


@contextlib.contextmanager
def lossy_codegen(enabled: bool = True) -> Iterator[collections.Counter]:
    """Within the block, unknown kinds get the always-true placeholder; yields the record."""
    record: collections.Counter = collections.Counter()
    token = _lossy_record.set(record if enabled else None)
    try:
        yield record
    finally:
        _lossy_record.reset(token)


def unknown_kind(site: str, kind: str, placeholder: str) -> str:
    """Raise for an unknown kind, or (lossy mode) record it and return ``placeholder``."""
    record = _lossy_record.get()
    if record is None:
        raise UnknownRuleKindError(site, kind)
    record[f'{site}:{kind}'] += 1
    return placeholder
