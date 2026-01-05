"""
Caching infrastructure for AST and file content.

This module provides module-level caches to avoid repeated file I/O
and AST parsing during rule analysis.
"""

import ast
from typing import Dict, Tuple, Optional, Any

# Module-level caches
file_content_cache: Dict[str, str] = {}  # Raw file content as strings
ast_cache: Dict[str, ast.AST] = {}  # Parsed AST objects

# Cache for cleaned source code: (filename, lineno) -> cleaned source string
# This avoids re-extracting and cleaning source for the same function
clean_source_cache: Dict[Tuple[str, int], Optional[str]] = {}

# Cache for unparsed lambda source: (filename, lineno) -> unparsed source string
# This avoids re-finding and unparsing lambdas in the AST
unparsed_lambda_cache: Dict[Tuple[str, int], Optional[str]] = {}

# Cache for parameterless function analysis results
# Key: (filename, lineno) for functions that only take state/player/world
# This avoids re-analyzing the same helper function multiple times
parameterless_func_cache: Dict[Tuple[str, int], Dict[str, Any]] = {}


def clear_caches():
    """
    Clear all caches (useful for testing or memory management).

    Call this between generations or when you want to free memory.
    """
    file_content_cache.clear()
    ast_cache.clear()
    clean_source_cache.clear()
    unparsed_lambda_cache.clear()
    parameterless_func_cache.clear()


def get_file_content_cache_size() -> int:
    """Return the number of cached file contents."""
    return len(file_content_cache)


def get_ast_cache_size() -> int:
    """Return the number of cached AST trees."""
    return len(ast_cache)


def get_clean_source_cache_size() -> int:
    """Return the number of cached cleaned source strings."""
    return len(clean_source_cache)


def get_unparsed_lambda_cache_size() -> int:
    """Return the number of cached unparsed lambda strings."""
    return len(unparsed_lambda_cache)


def get_parameterless_func_cache_size() -> int:
    """Return the number of cached parameterless function analyses."""
    return len(parameterless_func_cache)
