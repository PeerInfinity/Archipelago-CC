"""
Post-output hook registry for Archipelago seed generation.

Allows worlds to register callbacks that run after output files are generated,
enabling extensibility without modifying Main.py directly.
"""

import logging
from typing import Callable, List, TYPE_CHECKING

if TYPE_CHECKING:
    from BaseClasses import MultiWorld

logger = logging.getLogger(__name__)

PostOutputHook = Callable[["MultiWorld", str, str], None]

_post_output_hooks: List[PostOutputHook] = []


def register_post_output_hook(hook: PostOutputHook) -> None:
    """Register a hook to be called after output generation."""
    _post_output_hooks.append(hook)


def call_post_output_hooks(multiworld: "MultiWorld", output_dir: str, filename_base: str) -> None:
    """Call all registered post-output hooks."""
    for hook in _post_output_hooks:
        try:
            hook(multiworld, output_dir, filename_base)
        except Exception:
            logger.exception(f"Post-output hook {hook.__name__} failed")
