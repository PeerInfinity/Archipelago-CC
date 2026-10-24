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

A ``Has`` on an item the rules file never creates (no item definition, pool entry, placement or
starting item) is NOT a placeholder: the generated world can never hold that item, so ``False_()``
is the exact answer. It is recorded by name in BOTH modes (:func:`unobtainable_item`), never raised.
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


# '<site>:<item>' -> count of Has rules on an item the world never creates, emitted as False_()
_unobtainable_record: contextvars.ContextVar[Optional[collections.Counter]] = contextvars.ContextVar(
    'world_generator_unobtainable_record', default=None)


@contextlib.contextmanager
def unobtainable_record() -> Iterator[collections.Counter]:
    """Within the block, record each Has on an item the world never creates; yields the record."""
    record: collections.Counter = collections.Counter()
    token = _unobtainable_record.set(record)
    try:
        yield record
    finally:
        _unobtainable_record.reset(token)


def unobtainable_item(site: str, item: str, placeholder: str) -> str:
    """Record (strict and lossy alike) a Has on an item the world never creates; return ``placeholder``."""
    record = _unobtainable_record.get()
    if record is not None:
        record[f'{site}:{item}'] += 1
    return placeholder
