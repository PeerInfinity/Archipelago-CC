"""
Caching infrastructure for AST and file content.

This module provides module-level caches to avoid repeated file I/O
and AST parsing during rule analysis.
"""

import ast
from typing import Dict

# Module-level caches
file_content_cache: Dict[str, str] = {}  # Raw file content as strings
ast_cache: Dict[str, ast.AST] = {}  # Parsed AST objects


def clear_caches():
    """
    Clear all caches (useful for testing or memory management).

    Call this between generations or when you want to free memory.
    """
    file_content_cache.clear()
    ast_cache.clear()


def get_file_content_cache_size() -> int:
    """Return the number of cached file contents."""
    return len(file_content_cache)


def get_ast_cache_size() -> int:
    """Return the number of cached AST trees."""
    return len(ast_cache)
