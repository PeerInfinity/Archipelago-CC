"""Codegen meets a rule kind it has no path for: fail LOUDLY (⚖ D3, rule-node-registry 2026-10-21).

The three codegen sinks (the Rule Builder chain, the rule dispatcher, the helper-body expression
generator) used to emit an always-true placeholder (``True_()`` / ``'True'``) for an unknown kind,
silently making a location free. They now raise :class:`UnknownRuleKindError`, naming the kind.

LOSSY mode is opt-in (``--lossy`` on the CLI, ``WorldGenerator(lossy=True)``,
``build_apworld(lossy=True)``): the old placeholder is kept, and every replacement is recorded by
``<site>:<kind>`` so the caller can list what it replaced.

An unknown helper NAME (a helper call whose body the rules file does not carry, e.g. a game whose
helpers live only in its JS logic module) is the same failure one level down and goes through the
same switch (rule-node F1): :func:`unknown_helper` raises :class:`UnknownHelperNameError` (a
subclass, so one ``except`` covers both) or, lossy, records ``<site>:helper <name>``.

The record counts only placeholders that reach the OUTPUT. A caller that converts a rule
speculatively and may throw the result away runs it under :func:`speculative_record` and keeps
the scratch only when it uses the result (rule-node R2c).
"""

import collections
import contextlib
import contextvars
from typing import Iterator, Optional

# None = strict (raise); a Counter = lossy, recording each placeholder emitted
_lossy_record: contextvars.ContextVar[Optional[collections.Counter]] = contextvars.ContextVar(
    'world_generator_lossy_record', default=None)
# The game being generated, for the error message (set by lossy_codegen's caller)
_codegen_game: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    'world_generator_codegen_game', default=None)


def _for_game() -> str:
    game = _codegen_game.get()
    return f" for game {game!r}" if game else ''


class UnknownRuleKindError(ValueError):
    """A rule kind world_generator cannot generate code for."""

    def __init__(self, site: str, kind: str):
        self.site = site
        self.kind = kind
        self.game = _codegen_game.get()
        super().__init__(
            f"world_generator has no codegen for rule kind {kind!r} ({site}){_for_game()}. Handle the kind, or "
            f"generate with --lossy to emit an always-true placeholder for it "
            f"(docs/json/developer/reference/rule-kind-registry.md)")


class UnknownHelperNameError(UnknownRuleKindError):
    """A helper call whose name has no definition in the rules file's ``helpers`` block."""

    def __init__(self, site: str, name: str):
        ValueError.__init__(
            self,
            f"world_generator has no definition for helper {name!r} ({site}){_for_game()}: the rules "
            f"file's helpers block does not carry its body. Export the body, or generate with --lossy "
            f"to emit an always-true placeholder for it "
            f"(docs/json/developer/reference/rule-kind-registry.md)")
        self.site = site
        self.kind = f'helper {name}'
        self.name = name
        self.game = _codegen_game.get()


@contextlib.contextmanager
def lossy_codegen(enabled: bool = True, game: Optional[str] = None) -> Iterator[collections.Counter]:
    """Within the block, unknown kinds get the always-true placeholder; yields the record."""
    record: collections.Counter = collections.Counter()
    token = _lossy_record.set(record if enabled else None)
    game_token = _codegen_game.set(game) if game is not None else None
    try:
        yield record
    finally:
        _lossy_record.reset(token)
        if game_token is not None:
            _codegen_game.reset(game_token)


# Every per-generation record a speculative conversion must not leak into. A new record
# contextvar (a Counter, None when off) registers here so speculative_record covers it too.
SPECULATIVE_RECORDS: list = [_lossy_record]


class Speculation:
    """The scratch records of one speculative conversion; :meth:`keep` folds them into the real ones."""

    def __init__(self, pairs):
        self._pairs = pairs  # [(outer Counter or None, scratch Counter or None)], one per record

    def keep(self) -> None:
        for outer, scratch in self._pairs:
            if outer is not None and scratch:
                outer.update(scratch)
                scratch.clear()


@contextlib.contextmanager
def speculative_record() -> Iterator[Speculation]:
    """Within the block, every record in ``SPECULATIVE_RECORDS`` writes to a scratch, dropped unless kept.

    A record that is off (None) stays off, so strict mode is unchanged: an unknown kind still
    raises inside the block.
    """
    pairs, tokens = [], []
    for var in SPECULATIVE_RECORDS:
        outer = var.get()
        scratch = collections.Counter() if outer is not None else None
        pairs.append((outer, scratch))
        tokens.append((var, var.set(scratch)))
    try:
        yield Speculation(pairs)
    finally:
        for var, token in reversed(tokens):
            var.reset(token)


def unknown_kind(site: str, kind: str, placeholder: str) -> str:
    """Raise for an unknown kind, or (lossy mode) record it and return ``placeholder``."""
    record = _lossy_record.get()
    if record is None:
        raise UnknownRuleKindError(site, kind)
    record[f'{site}:{kind}'] += 1
    return placeholder


def unknown_helper(site: str, name: str, placeholder: str) -> str:
    """Raise for an undefined helper name, or (lossy mode) record it and return ``placeholder``."""
    record = _lossy_record.get()
    if record is None:
        raise UnknownHelperNameError(site, name)
    record[f'{site}:helper {name}'] += 1
    return placeholder
