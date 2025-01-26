"""Analyzes rule functions to generate structured rule data."""

import ast
import inspect
import re
from typing import Any, Dict, Optional, Set

class RuleAnalyzer(ast.NodeVisitor):
    def __init__(self, closure_vars=None, seen_funcs=None):
        self.closure_vars = closure_vars or {}
        self.seen_funcs = seen_funcs or set()
        self.current_result = None

    def visit_Lambda(self, node):
        self.visit(node.body)
        
    def visit_Call(self, node):
        if isinstance(node.func, ast.Attribute):
            self._handle_method_call(node)
        elif isinstance(node.func, ast.Name):
            self._handle_function_call(node)
            
    def visit_BoolOp(self, node):
        conditions = []
        for value in node.values:
            self.visit(value)
            if self.current_result:
                conditions.append(self.current_result)
                
        if conditions:
            self.current_result = {
                'type': 'and' if isinstance(node.op, ast.And) else 'or',
                'conditions': conditions
            }

    def _handle_method_call(self, node):
        if isinstance(node.func.attr, str):
            method_name = node.func.attr
            
            if method_name == '_lttp_has_key':
                key_name = self._extract_string_arg(node.args[1])
                count = self._extract_number_arg(node.args[2])
                if key_name and count is not None:
                    self.current_result = {
                        'type': 'count_check',
                        'item': key_name,
                        'count': count
                    }
                    
            elif method_name == 'has':
                item_name = self._extract_string_arg(node.args[0])
                if item_name:
                    self.current_result = {
                        'type': 'item_check',
                        'item': item_name
                    }
                    
            elif method_name == 'has_group':
                group_name = self._extract_string_arg(node.args[0])
                if group_name:
                    self.current_result = {
                        'type': 'group_check',
                        'group': group_name
                    }

    def _handle_function_call(self, node):
        func_name = node.func.id
        
        # Skip built-in functions
        if func_name in {'min', 'max', 'len', 'sum'}:
            return
            
        # Check closure variables
        if func_name in self.closure_vars:
            closure_func = self.closure_vars[func_name]
            if closure_func not in self.seen_funcs:
                self.seen_funcs.add(closure_func)
                closure_result = analyze_rule(closure_func, self.closure_vars, self.seen_funcs)
                if closure_result:
                    self.current_result = closure_result
                    return
                    
        # Create helper node
        self.current_result = {
            'type': 'helper',
            'name': func_name
        }

    def _extract_string_arg(self, node):
        if isinstance(node, (ast.Str, ast.Constant)) and isinstance(getattr(node, 'value', None), str):
            return node.value if isinstance(node, ast.Constant) else node.s
        return None

    def _extract_number_arg(self, node):
        if isinstance(node, (ast.Num, ast.Constant)) and isinstance(getattr(node, 'value', None), (int, float)):
            return node.value if isinstance(node, ast.Constant) else node.n
        return None

def analyze_rule(rule_func, closure_vars=None, seen_funcs=None) -> Optional[Dict[str, Any]]:
    """
    Analyzes a rule function to produce a structured representation.
    Handles lambda functions, method calls, and boolean operations.
    """
    if not rule_func or not hasattr(rule_func, '__code__'):
        return None
        
    try:
        source = inspect.getsource(rule_func)
        source = _clean_source(source)
        tree = ast.parse(source)
        
        analyzer = RuleAnalyzer(closure_vars, seen_funcs)
        analyzer.visit(tree)
        
        if analyzer.current_result:
            return analyzer.current_result
            
        # Return helper node for named functions
        if (hasattr(rule_func, '__name__') and 
            not rule_func.__name__.startswith('<lambda>')):
            return {
                'type': 'helper',
                'name': rule_func.__name__
            }
            
    except Exception as e:
        return {
            'type': 'error',
            'error': f'Rule analysis failed: {str(e)}'
        }
        
    return None

def _clean_source(source: str) -> str:
    source = source.strip()
    
    lambda_start = source.find('lambda')
    if lambda_start >= 0:
        # Extract just the lambda portion
        remaining = source[lambda_start:]
        
        # Keep track of parentheses to find true end
        paren_count = 0
        colon_pos = remaining.index(':')
        end_pos = colon_pos + 1
        
        for i, char in enumerate(remaining[colon_pos+1:], colon_pos+1):
            if char == '(':
                paren_count += 1
            elif char == ')':
                if paren_count == 0:
                    end_pos = i
                    break
                paren_count -= 1
            end_pos = i + 1
            
        args = remaining[6:colon_pos].strip()
        body = remaining[colon_pos + 1:end_pos].strip()
        source = f"def __analyzed_func__({args}):\n    return {body}"
        
    return source