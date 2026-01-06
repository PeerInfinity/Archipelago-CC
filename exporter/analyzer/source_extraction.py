"""
Extract source code from lambda functions and regular functions.

This module handles the complex task of extracting source code from lambda
functions, including multiline lambdas, using AST parsing and caching.
"""

import ast
import inspect
import re
import logging
import textwrap
import zipfile
from typing import Optional, Callable
import astunparse

from .cache import file_content_cache, ast_cache, clean_source_cache, unparsed_lambda_cache


def _read_source_from_path(filename: str) -> Optional[str]:
    """
    Read source code from a file path, handling both regular files and
    files inside .apworld zip archives.

    Args:
        filename: The file path, which may be inside an apworld zip
                  (e.g., '/path/to/game.apworld/game/Rules.py')

    Returns:
        The file content as a string, or None if reading failed
    """
    # Check if this is a path inside an apworld zip file
    if '.apworld' in filename:
        # Split the path at .apworld to get the zip path and internal path
        # e.g., '/path/to/game.apworld/game/Rules.py' ->
        #       zip_path = '/path/to/game.apworld'
        #       internal_path = 'game/Rules.py'
        parts = filename.split('.apworld')
        if len(parts) >= 2:
            zip_path = parts[0] + '.apworld'
            # Remove leading slash from internal path
            internal_path = parts[1].lstrip('/')

            try:
                with zipfile.ZipFile(zip_path, 'r') as zf:
                    content = zf.read(internal_path).decode('utf-8')
                    logging.debug(f"Read source from apworld: {zip_path}!{internal_path}")
                    return content
            except Exception as e:
                logging.error(f"Failed to read from apworld {zip_path}!{internal_path}: {e}")
                return None

    # Regular file - read from disk
    try:
        with open(filename, 'r', encoding='utf-8-sig') as f:
            return f.read()
    except Exception as e:
        logging.error(f"Failed to read source file {filename}: {e}")
        return None


class LambdaLineFinder(ast.NodeVisitor):
    """An AST visitor to find a lambda function at a specific line number."""

    def __init__(self, target_line: int):
        """
        Initialize the LambdaLineFinder.

        Args:
            target_line: The line number where the lambda is defined
        """
        self.target_line = target_line
        self.found_node = None

    def visit_Lambda(self, node: ast.Lambda):
        """Visit Lambda nodes and check if they're on the target line."""
        if self.found_node is None and hasattr(node, 'lineno') and node.lineno == self.target_line:
            self.found_node = node
        # No need to visit children of the lambda itself

    def visit(self, node: ast.AST):
        """Override visit to stop searching once the node is found."""
        if self.found_node:
            return
        super().visit(node)


def get_multiline_lambda_source(func: Callable) -> Optional[str]:
    """
    Robustly gets the full source code of a lambda function using full-file AST parsing.
    Includes caching for both file content, parsed AST, and unparsed lambda source.

    Args:
        func: The lambda function to extract source from

    Returns:
        The source code as a string, or None if extraction failed
    """
    try:
        filename = inspect.getfile(func)
        start_line = func.__code__.co_firstlineno

        # Check unparsed lambda cache first (fastest path)
        cache_key = (filename, start_line)
        if cache_key in unparsed_lambda_cache:
            logging.debug(f"get_multiline_lambda_source: Cache hit for {filename}:{start_line}")
            return unparsed_lambda_cache[cache_key]

        # 1. Check for a cached AST first (most performant)
        if filename in ast_cache:
            tree = ast_cache[filename]
        else:
            # 2. Check for cached file content
            if filename in file_content_cache:
                source_code = file_content_cache[filename]
            else:
                # 3. Read from disk (or apworld zip) as a last resort
                source_code = _read_source_from_path(filename)
                if source_code is None:
                    return None
                file_content_cache[filename] = source_code

            # 4. Parse the source and populate the AST cache
            tree = ast.parse(source_code, filename=filename)
            ast_cache[filename] = tree

        # Find the lambda node at the target line within the (possibly cached) AST
        finder = LambdaLineFinder(start_line)
        finder.visit(tree)

        lambda_node = finder.found_node

        if lambda_node:
            # "Un-parse" the found AST node back into a source string
            result = astunparse.unparse(lambda_node).strip()
        else:
            result = inspect.getsource(func)  # Fallback

        # Cache the result
        unparsed_lambda_cache[cache_key] = result
        return result

    except Exception as e:
        logging.error(f"Failed to get multiline lambda source for {func}: {e}")
        try:
            return inspect.getsource(func)  # Fallback
        except Exception as fallback_e:
            logging.error(f"Fallback getsource also failed: {fallback_e}")
            return None


def _clean_source(func: Callable) -> Optional[str]:
    """
    A new version of _clean_source that uses the robust lambda finder.

    This function extracts the source code from a lambda or function, cleans it,
    and converts it to a format suitable for AST analysis.

    Results are cached by (filename, lineno) to avoid repeated extraction
    for the same function.

    Args:
        func: The function to extract and clean source from

    Returns:
        Cleaned source code as a string, or None if cleaning failed
    """
    # Check cache first
    try:
        filename = inspect.getfile(func)
        lineno = func.__code__.co_firstlineno
        cache_key = (filename, lineno)

        if cache_key in clean_source_cache:
            logging.debug(f"_clean_source: Cache hit for {filename}:{lineno}")
            return clean_source_cache[cache_key]
    except (TypeError, AttributeError):
        # Can't determine cache key, proceed without caching
        cache_key = None

    result = _clean_source_impl(func)

    # Store in cache if we have a valid cache key
    if cache_key is not None:
        clean_source_cache[cache_key] = result

    return result


def _clean_source_impl(func: Callable) -> Optional[str]:
    """Implementation of _clean_source (separated for caching)."""
    try:
        # Use the robust function to get the full lambda source
        source = get_multiline_lambda_source(func)
        if source is None:
            return None

        # Note: No need to remove comments here - astunparse already strips them
        # since it works from the AST. Removing comments with tokenize would break
        # explicit line continuations (\).
        source = source.strip()
        logging.debug(f"_clean_source: Got source from AST = {repr(source)}")
    except (TypeError, OSError) as e:
        logging.error(f"Unexpected error getting source for {func}: {e}")
        return None

    # Handle @staticmethod decorator syntax (as opposed to staticmethod() call syntax)
    # inspect.getsource() returns decorator + indented method body, causing IndentationError
    # when parsed as standalone code. We strip the decorator and dedent the method.
    if source.startswith('@staticmethod'):
        logging.debug(f"_clean_source: Detected '@staticmethod' decorator in source: {repr(source)}")
        try:
            # Split into lines, remove the decorator line(s), and dedent the rest
            lines = source.split('\n')
            # Find the first line that starts with 'def ' (after stripping leading whitespace)
            def_line_idx = None
            for i, line in enumerate(lines):
                if line.strip().startswith('def '):
                    def_line_idx = i
                    break

            if def_line_idx is not None:
                # Take lines from def onwards and dedent
                method_lines = lines[def_line_idx:]
                method_source = textwrap.dedent('\n'.join(method_lines))
                logging.debug(f"_clean_source: Dedented @staticmethod method: {repr(method_source)}")
                # Return the dedented method source for normal processing
                return method_source
            else:
                logging.warning(f"_clean_source: Could not find 'def' after @staticmethod decorator")
                return None
        except Exception as e:
            logging.error(f"_clean_source: Error handling @staticmethod decorator: {e}", exc_info=True)
            return None

    # More robust staticmethod check using AST (for staticmethod() call syntax)
    if 'staticmethod(' in source:
        logging.debug(f"_clean_source: Detected 'staticmethod(' in source: {repr(source)}")
        try:
            # Parse the source string (could be an assignment)
            tree = ast.parse(source)

            # Expect Module -> Assign/AnnAssign -> Call(Name(id='staticmethod'), args=[Lambda(...)])
            assigned_value = None
            if isinstance(tree, ast.Module) and tree.body:
                first_stmt = tree.body[0]
                if isinstance(first_stmt, (ast.Assign, ast.AnnAssign)):
                    assigned_value = first_stmt.value

            # Check if the assigned value is the staticmethod call
            if (isinstance(assigned_value, ast.Call) and
                    isinstance(assigned_value.func, ast.Name) and
                    assigned_value.func.id == 'staticmethod' and
                    len(assigned_value.args) == 1):

                lambda_node = assigned_value.args[0]
                # Check if the argument is a Lambda returning constant True
                if (isinstance(lambda_node, ast.Lambda) and
                        isinstance(lambda_node.body, ast.Constant) and
                        lambda_node.body.value is True):

                    # Determine appropriate param name if possible (optional enhancement)
                    # For now, default to 'state' as it covers access_rule
                    param_name = 'state'  # Keep it simple for now
                    logging.debug(
                        f"_clean_source: Confirmed staticmethod(lambda {param_name}: True). "
                        f"Returning standard True func."
                    )
                    return f"def __analyzed_func__({param_name}):\n    return True"
                else:
                    logging.warning(
                        f"_clean_source: staticmethod found, but does not wrap a simple 'lambda: True'. "
                        f"Lambda body: {ast.dump(lambda_node) if isinstance(lambda_node, ast.Lambda) else 'Not a Lambda'}"
                    )
            else:
                logging.warning(
                    f"_clean_source: staticmethod found, but AST structure is not the expected assignment pattern. "
                    f"Assigned value: {ast.dump(assigned_value) if assigned_value else 'None'}"
                )

        except SyntaxError as parse_err:
            logging.warning(
                f"_clean_source: SyntaxError parsing staticmethod source: {parse_err}. "
                f"Source: {repr(source)}"
            )
        except Exception as e:
            logging.error(
                f"_clean_source: Error during AST analysis of staticmethod: {e}. "
                f"Source: {repr(source)}",
                exc_info=True
            )

        # If AST analysis fails or doesn't match expected pattern, return None
        logging.warning("_clean_source: Could not robustly confirm staticmethod wraps lambda:True. Returning None.")
        return None

    # The source from astunparse is already a clean, complete lambda expression.
    # We just need to wrap it in a 'def' for the RuleAnalyzer to visit.
    match = re.compile(r'lambda\s+([^:]*):\s*(.*)', re.DOTALL).match(source)
    if match:
        params = match.group(1).strip()
        body = match.group(2).strip()
        logging.debug(f"_clean_source: Final body for lambda = {repr(body)}")
        return f"def __analyzed_func__({params}):\n    return {body}"
    else:
        # If it's not a lambda (e.g., a regular 'def' function), return as is
        return source
