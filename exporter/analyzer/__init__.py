"""
Rule analysis package for converting Archipelago rules to JSON format.

This package handles the extraction and analysis of rule functions from
Archipelago's Python code, converting them into a standardized JSON format
for use in frontend implementations.

Public API:
    analyze_rule: Main entry point for analyzing rule functions
    make_json_serializable: Convert values to JSON-serializable format
    clear_caches: Clear all internal caches
"""

from .analysis import analyze_rule
from .cache import clear_caches
from .utils import make_json_serializable

__all__ = ['analyze_rule', 'clear_caches', 'make_json_serializable']
