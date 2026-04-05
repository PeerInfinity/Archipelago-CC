"""
Monkey patching module for pickle tracker.

Provides a runtime patch for Main.main to export a pickle of the multiworld
after seed generation, without modifying any source files.
"""

from .hooks import install_hooks, auto_install

__all__ = ["install_hooks", "auto_install"]
