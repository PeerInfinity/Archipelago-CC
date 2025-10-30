"""
Legacy import shim for backward compatibility.

This file has been refactored into a package at exporter/analyzer/
All imports should continue to work as before.
"""

from exporter.analyzer.analysis import analyze_rule
from exporter.analyzer.utils import make_json_serializable
from exporter.analyzer.cache import (
    file_content_cache,
    ast_cache,
    clear_caches
)

__all__ = [
    'analyze_rule',
    'make_json_serializable',
    'file_content_cache',
    'ast_cache',
    'clear_caches'
]
