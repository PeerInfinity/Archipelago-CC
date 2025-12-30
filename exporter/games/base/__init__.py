"""Base infrastructure for game export handlers.

This package contains the base class and mixins for game-specific export handlers.
Game-specific handlers should inherit from BaseGameExportHandler.
"""

from exporter.games.base.handler import BaseGameExportHandler

__all__ = ['BaseGameExportHandler']
