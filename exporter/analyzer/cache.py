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
