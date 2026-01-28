"""
Caching infrastructure for AST and file content.

This module provides module-level caches to avoid repeated file I/O
and AST parsing during rule analysis.
"""

import ast
import inspect
from typing import Dict, Tuple, Optional, Any, Callable

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

# Cache for callable list item analysis results
# Key: function ID (int) -> analyzed rule dict
# This avoids re-analyzing the same lambda when it appears in multiple path lists
# (common in ALttP bunny rules where entrance access rules are shared)
callable_list_cache: Dict[int, Dict[str, Any]] = {}

# Cache for lambda analysis results keyed by source location + closure fingerprint
# Key: (filename, lineno, closure_fingerprint) -> analyzed rule dict
# This allows caching lambdas at the same source location with equivalent closures,
# even if they are different object instances (different id()).
# Critical for ALttP bunny rules where get_rule_to_add() creates new lambdas per call.
closure_aware_cache: Dict[Tuple[str, int, Tuple], Dict[str, Any]] = {}


def _compute_callable_fingerprint(func: Callable, seen_ids: set) -> Tuple:
    """
    Compute a stable fingerprint for a callable based on source location + closure.

    Uses source location (filename, lineno) instead of id() for better cache hits
    when the same lambda is created multiple times (common in ALttP bunny rules).

    Args:
        func: The callable to fingerprint
        seen_ids: Set of function ids already visited (for cycle detection)

    Returns:
        A hashable tuple representing the callable's identity
    """
    func_id = id(func)

    # Cycle detection
    if func_id in seen_ids:
        return ('cycle', func_id)

    if hasattr(func, '__code__'):
        code = func.__code__
        filename = code.co_filename
        lineno = code.co_firstlineno

        # Recursively compute closure fingerprint for this callable
        seen_ids_copy = seen_ids | {func_id}
        closure_fp = _compute_closure_fingerprint_impl(func, seen_ids_copy)

        return ('lambda', filename, lineno, closure_fp)
    else:
        # No code attribute, fall back to id
        return ('callable_id', func_id)


def _compute_closure_fingerprint_impl(func: Callable, seen_ids: set) -> Optional[Tuple]:
    """
    Implementation of closure fingerprint computation with cycle detection.

    Args:
        func: The function whose closure to fingerprint
        seen_ids: Set of function ids already visited (for cycle detection)

    Returns:
        A hashable tuple representing the closure, or None if not fingerprrintable
    """
    if not hasattr(func, '__closure__') or not func.__closure__:
        return ()  # No closure, empty fingerprint

    if not hasattr(func, '__code__'):
        return None

    try:
        free_vars = func.__code__.co_freevars
        fingerprint_parts = []

        for var_name, cell in zip(free_vars, func.__closure__):
            try:
                value = cell.cell_contents
            except ValueError:
                # Empty cell
                fingerprint_parts.append((var_name, None))
                continue

            # Create a hashable representation of the value
            if value is None or isinstance(value, (int, str, bool, float, bytes)):
                # Primitive types - use directly
                fingerprint_parts.append((var_name, value))
            elif isinstance(value, (tuple, frozenset)):
                # Already hashable collections
                fingerprint_parts.append((var_name, value))
            elif isinstance(value, list):
                # For lists, create tuple of fingerprints
                # For callables, use source location + recursive closure fingerprint
                list_fp = []
                for item in value:
                    if callable(item):
                        # Use stable callable fingerprint instead of id()
                        callable_fp = _compute_callable_fingerprint(item, seen_ids)
                        list_fp.append(callable_fp)
                    elif isinstance(item, (int, str, bool, float, bytes, type(None))):
                        list_fp.append(('value', item))
                    elif hasattr(item, 'name'):
                        # Objects with name attribute (like Entrance, Region)
                        list_fp.append(('named', item.name))
                    else:
                        list_fp.append(('id', id(item)))
                fingerprint_parts.append((var_name, ('list', tuple(list_fp))))
            elif callable(value):
                # Use stable callable fingerprint instead of id()
                callable_fp = _compute_callable_fingerprint(value, seen_ids)
                fingerprint_parts.append((var_name, callable_fp))
            elif hasattr(value, 'name'):
                # Objects with name attribute (Entrance, Region, Location, etc.)
                fingerprint_parts.append((var_name, ('named', type(value).__name__, value.name)))
            elif hasattr(value, '__dict__'):
                # For other objects, use id as fallback
                fingerprint_parts.append((var_name, ('obj', id(value))))
            else:
                # Try to use the value directly if hashable
                try:
                    hash(value)
                    fingerprint_parts.append((var_name, value))
                except TypeError:
                    fingerprint_parts.append((var_name, ('unhashable', id(value))))

        return tuple(fingerprint_parts)
    except Exception:
        return None


def _compute_closure_fingerprint(func: Callable) -> Optional[Tuple]:
    """
    Compute a hashable fingerprint of a function's closure variables.

    This allows caching analysis results for lambdas at the same source location
    that have equivalent closure values, even if they're different object instances.

    For callables in closures, uses source location + recursive closure fingerprint
    instead of id() to enable cache hits when the same lambda is created multiple
    times (common pattern in ALttP bunny rules with get_rule_to_add()).

    Returns None if the closure cannot be fingerprinted (unhashable values).
    """
    return _compute_closure_fingerprint_impl(func, set())


def get_closure_aware_cache_key(func: Callable) -> Optional[Tuple[str, int, Tuple]]:
    """
    Get a cache key for a function based on its source location and closure fingerprint.

    Returns (filename, lineno, closure_fingerprint) if cacheable, None otherwise.
    """
    if not hasattr(func, '__code__'):
        return None

    try:
        code = func.__code__
        filename = inspect.getfile(func)
        lineno = code.co_firstlineno

        fingerprint = _compute_closure_fingerprint(func)
        if fingerprint is None:
            return None

        return (filename, lineno, fingerprint)
    except (TypeError, OSError):
        return None


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
    callable_list_cache.clear()
    closure_aware_cache.clear()
