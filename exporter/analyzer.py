# exporter/analyzer.py

"""
Rule Parser Analyzer

This module handles the extraction and analysis of rule functions from Archipelago's Python code.
It converts rule functions into a standardized JSON format for use in frontend implementations.

Key Rule Patterns:
1. Simple boolean returns:
   lambda state: True

2. Item checks:
   lambda state: state.has('Item Name', player)

3. Complex boolean operations:
   lambda state: state.has('A', player) and state.has('B', player)
   lambda state: state.has('A', player) or state.has('B', player)

4. Helper function calls:
   lambda state: can_lift_rocks(state, player)

5. State method calls:
   lambda state: state._lttp_has_key('Small Key (Palace)', player, 3)

6. Conditional expressions:
   lambda state: (a if condition else b)

7. Nested structures with location names:
   lambda state: item_name_in_location_names(state, 'Big Key (Palace)', player, 
                    [('Palace - Room', player)])
"""

import ast
import inspect
import re
from typing import Any, Dict, Optional, Set, Callable
import traceback
import json
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    filename='rule_analysis_debug.log')

# Regex definitions
REGEX_LAMBDA_BODY = re.compile(r'lambda\s+([\w\s,()]*):\s*(.*)', re.DOTALL)
REGEX_METHOD_CALL = re.compile(r'(\w+)\((.*)\)')

# Helper functions
def count_nested_parens(s):
    count = 0
    for char in s:
        if char == '(':
            count += 1
        elif char == ')':
            count -= 1
    return count

def _clean_source(func):
    """Retrieve and clean the source code of a function, handling lambdas."""
    try:
        source = inspect.getsource(func)
        # Remove comments
        source = re.sub(r'#.*$', '', source, flags=re.MULTILINE)
        source = source.strip()
        print(f"_clean_source: Original source = {repr(source)}")
    except (TypeError, OSError) as e:
        print(f"Could not get source for {func}: {e}")
        return None

    # *** ADDED CHECK for staticmethod ***
    if 'staticmethod(' in source:
        print("_clean_source: Detected staticmethod wrapper, skipping analysis.")
        # Treat staticmethod wrapped rules as always True or return None to signal skipping
        # Returning a representation of True is safer for now.
        # Ideally, the caller (process_regions) should handle this case.
        # For now, we let analyze_rule produce a constant True.
        return "def __analyzed_func__(state):\n    return True" 
        # return None # Alternative: Signal to analyze_rule to skip

    # Handle lambda functions specifically
    match = REGEX_LAMBDA_BODY.match(source)
    if match:
        param = match.group(1).strip()
        body = match.group(2).strip()
        
        # Remove trailing comma if present after body extraction
        if body.endswith(','):
            body = body[:-1].rstrip()

        # Remove any potential trailing \n or similar artifacts
        body = ' '.join(body.splitlines()).strip()

        # Ensure parentheses are balanced
        while count_nested_parens(body) > 0:
            if body.endswith(')'):
                body = body[:-1].rstrip()
            else:
                # Likely malformed source extraction, break to avoid infinite loop
                print(f"WARNING: Unbalanced parentheses in lambda body, cannot auto-fix: {repr(body)}")
                break
        
        # Additional check: Handle cases where extraction might grab too much
        # e.g., lambda x: x.has(A) and x.has(B)), ... <- extraneous closing paren
        # This is less robust, but can help some cases
        if count_nested_parens(body) < 0:
             print(f"WARNING: Potentially extraneous closing parentheses detected: {repr(body)}")
             # Attempt simple fix: remove trailing ')' if paren count is negative
             while count_nested_parens(body) < 0 and body.endswith(')'):
                 body = body[:-1].rstrip()

        print(f"_clean_source: Final body for lambda = {repr(body)}")
        return f"def __analyzed_func__({param}):\n    return {body}"
    
    return source

class RuleAnalyzer(ast.NodeVisitor):
    """
    AST Visitor that converts rule functions into a structured format.
    
    Handles:
    - Lambda functions
    - Boolean operations
    - Method calls
    - Helper functions
    - Nested expressions
    """
    def __init__(self, closure_vars=None, seen_funcs=None):
        self.closure_vars = closure_vars or {}  # Helper functions available in closure
        self.seen_funcs = seen_funcs or set()  # Track analyzed helper functions
        self.current_result = None  # Current rule structure being built
        self.debug_log = []
        self.error_log = []

    def log_debug(self, message):
        """Log debug message to both console and log file."""
        logging.debug(message)
        self.debug_log.append(message)
        print(message)  # Also print to console for immediate visibility

    def log_error(self, message, exception=None):
        """Log error message with optional exception details."""
        error_entry = {
            'message': message,
            'trace': traceback.format_exc() if exception else None
        }
        logging.error(message)
        self.error_log.append(error_entry)
        print(f"ERROR: {message}")
        if exception:
            print(traceback.format_exc())

    def visit_Module(self, node):
        try:
            self.log_debug(f"\n--- Starting Module Analysis ---")
            self.log_debug(f"Module body length: {len(node.body)}")
            
            # Detailed module body inspection
            for i, body_node in enumerate(node.body):
                self.log_debug(f"Module body node {i}: {type(body_node).__name__}")
                
            # Visit first node in module body if exists
            if node.body:
                self.visit(node.body[0])
        except Exception as e:
            self.log_error("Error in visit_Module", e)

    def visit_FunctionDef(self, node):
        try:
            self.log_debug(f"\n--- Analyzing Function Definition: {node.name} ---")
            self.log_debug(f"Function args: {[arg.arg for arg in node.args.args]}")
            
            # Detailed function body inspection
            for i, body_node in enumerate(node.body):
                self.log_debug(f"Function body node {i}: {type(body_node).__name__}")
            
            # Visit the first body node if exists
            if node.body:
                self.visit(node.body[0])
        except Exception as e:
            self.log_error(f"Error analyzing function {node.name}", e)

    def visit_Lambda(self, node):
        try:
            self.log_debug("\n--- Analyzing Lambda ---")
            self.log_debug(f"Lambda args: {[arg.arg for arg in node.args.args]}")
            self.log_debug(f"Lambda body type: {type(node.body).__name__}")
            
            self.visit(node.body)
        except Exception as e:
            self.log_error("Error in visit_Lambda", e)

    def visit_Return(self, node):
        try:
            self.log_debug("\n--- Analyzing Return ---")
            self.log_debug(f"Return value type: {type(node.value).__name__}")
            
            if isinstance(node.value, ast.BoolOp):
                self.log_debug(f"BoolOp type: {type(node.value.op).__name__}")
                self.log_debug(f"BoolOp values count: {len(node.value.values)}")
            
            self.visit(node.value)
        except Exception as e:
            self.log_error("Error in visit_Return", e)

    def visit_Call(self, node):
        """
        Updated visit_Call method that properly handles complex arguments.
        """
        print(f"\nvisit_Call called:")
        print(f"Function: {ast.dump(node.func)}")
        print(f"Args: {[ast.dump(arg) for arg in node.args]}")

        # Visit the function node to obtain its details.
        self.visit(node.func)
        func_info = self.current_result
        print(f"Function info after visit: {func_info}")

        args = []
        processed_args = []
        for arg in node.args:
            # Visit each argument, which might now return complex structures
            self.visit(arg)
            if self.current_result is not None:
                args.append(self.current_result)
                
                # For processed_args, still skip names "state" and "player"
                if isinstance(arg, ast.Name) and arg.id in ['state', 'player']:
                    continue
                processed_args.append(self.current_result)

        print(f"Collected args: {args}")
        print(f"Processed args (without state/player): {processed_args}")

        # Special handling: if the function is a Name and its name is in our special list,
        # then retrieve the actual function from closure_vars and recursively analyze it.
        if func_info and func_info.get('type') == 'name':
            func_name = func_info['name']
            print(f"Checking helper: {func_name}")
            print(f"Available closure vars: {list(self.closure_vars.keys())}")
            if func_name in self.closure_vars:
                if func_name in ['rule', 'old_rule']:
                    # Retrieve the actual function object.
                    helper_func = self.closure_vars[func_name]
                    # Check if we've already seen this function to avoid infinite recursion.
                    if id(helper_func) in self.seen_funcs:
                        print(f"Already analyzed {func_name}, returning default constant true")
                        self.current_result = {'type': 'constant', 'value': True}
                        return
                    else:
                        self.seen_funcs.add(id(helper_func))
                        analyzed = analyze_rule(helper_func, closure_vars=self.closure_vars, seen_funcs=self.seen_funcs)
                        self.current_result = analyzed
                        print(f"Inlined helper for {func_name}: {self.current_result}")
                        return
                else:
                    self.current_result = {
                        'type': 'helper',
                        'name': func_name,
                        'args': processed_args
                    }
                    print(f"Created helper: {self.current_result}")
                    return
            else:
                # Create a helper node even if function not in closure vars
                self.current_result = {
                    'type': 'helper',
                    'name': func_name,
                    'args': processed_args
                }
                print(f"Created helper for unknown function: {self.current_result}")
                return
        
        # Handle state methods (e.g. state.has, state._lttp_has_key, etc.)
        if func_info and func_info.get('type') == 'attribute':
            # Check if the base object is state
            if func_info['object'].get('type') == 'name' and func_info['object'].get('name') == 'state':
                method = func_info['attr']
                
                # 1) state.has('Item', player)
                if method == 'has':
                    if len(processed_args) >= 1:
                        self.current_result = {
                            'type': 'item_check',
                            'item': processed_args[0]
                        }
                        return

                # 2) state.has_group('GroupName', player)
                elif method == 'has_group':
                    if len(processed_args) >= 1:
                        self.current_result = {
                            'type': 'group_check',
                            'group': processed_args[0]
                        }
                        return

                # 3) state.has_any([...], player)
                elif method == 'has_any':
                    if len(processed_args) >= 1:
                        items = processed_args[0]
                        if isinstance(items, list):
                            self.current_result = {
                                'type': 'or',
                                'conditions': [
                                    {'type': 'item_check', 'item': item}
                                    for item in items
                                ]
                            }
                            return

                # 4) state._lttp_has_key('Small Key (Swamp)', count, player)
                elif method == '_lttp_has_key':
                    # Example usage: state._lttp_has_key('Small Key (Palace)', 2, player)
                    if len(processed_args) >= 2:
                        self.current_result = {
                            'type': 'count_check',
                            'item': processed_args[0],
                            'count': processed_args[1]
                        }
                        return

                # Any unhandled method on state -> create state_method node
                self.current_result = {
                    'type': 'state_method',
                    'method': method,
                    'args': processed_args
                }
                return
        
        # Fallback case for unrecognized function types
        self.current_result = {
            'type': 'function_call',
            'function': func_info,
            'args': processed_args
        }

    def visit_Attribute(self, node):
        try:
            self.log_debug(f"visit_Attribute: Visiting object {type(node.value).__name__}")
            self.visit(node.value)
            obj_result = self.current_result
            attr_name = node.attr
            self.log_debug(f"visit_Attribute: Object result = {obj_result}, Attribute = {attr_name}")
            
            # Specifically log if we are processing self.player
            if isinstance(node.value, ast.Name) and node.value.id == 'self' and attr_name == 'player':
                 self.log_debug("visit_Attribute: Detected access to self.player")

            if obj_result:
                 self.current_result = {'type': 'attribute', 'object': obj_result, 'attr': attr_name}
                 self.log_debug(f"visit_Attribute: Set result to {self.current_result}")
            else:
                 # Handle case where object visit failed
                 self.log_error(f"visit_Attribute: Failed to get result for object in {ast.dump(node)}")
                 self.current_result = None # Ensure failure propagates

        except Exception as e:
            self.log_error(f"Error in visit_Attribute for {ast.dump(node)}", e)
            self.current_result = None

    def visit_Name(self, node):
        try:
            name = node.id
            self.log_debug(f"visit_Name: Name = {name}")
            # Specifically log 'self'
            if name == 'self':
                self.log_debug("visit_Name: Detected 'self'")

            self.current_result = {'type': 'name', 'name': name}
            self.log_debug(f"visit_Name: Set result to {self.current_result}")
        except Exception as e:
            self.log_error(f"Error in visit_Name for {node.id}", e)
            self.current_result = None

    def visit_Constant(self, node):
        print("\nvisit_Constant called")
        print(f"Constant node: {ast.dump(node)}")
        self.current_result = {
            'type': 'constant',
            'value': node.value
        }
        print(f"Constant result: {self.current_result}")

    def visit_Subscript(self, node):
        """
        Handle subscript expressions like foo[bar]
        """
        print(f"\nvisit_Subscript called:")
        print(f"Value: {ast.dump(node.value)}")
        print(f"Slice: {ast.dump(node.slice)}")
        
        # First visit the value (the object being subscripted)
        self.visit(node.value)
        value_info = self.current_result
        
        # Then visit the slice (the index)
        self.visit(node.slice)
        index_info = self.current_result
        
        # Create a subscript node
        self.current_result = {
            'type': 'subscript',
            'value': value_info,
            'index': index_info
        }
        
        print(f"Subscript result: {self.current_result}")

    def visit_BoolOp(self, node):
        """Handle boolean operations (AND/OR) between conditions"""
        try:
            self.log_debug("\nvisit_BoolOp called:")
            self.log_debug(f"Operator: {type(node.op).__name__}")
            self.log_debug(f"Values: {[ast.dump(val) for val in node.values]}")
            
            # Process each value in the boolean operation
            conditions = []
            for value in node.values:
                self.visit(value)
                if self.current_result:
                    conditions.append(self.current_result)

            # Create appropriate rule structure based on operator type
            if isinstance(node.op, ast.And):
                self.current_result = {
                    'type': 'and',
                    'conditions': conditions
                }
            elif isinstance(node.op, ast.Or):
                self.current_result = {
                    'type': 'or',
                    'conditions': conditions
                }
            else:
                self.log_debug(f"Unknown boolean operator: {type(node.op).__name__}")
                self.current_result = None

            self.log_debug(f"Boolean operation result: {self.current_result}")
            
        except Exception as e:
            self.log_error(f"Error in visit_BoolOp", e)
            self.current_result = None

    def generic_visit(self, node):
        """Override to add detailed logging for unexpected node types."""
        try:
            self.log_debug(f"\n--- Generic Visit: {type(node).__name__} ---")
            self.log_debug(f"Node details: {vars(node)}")
            super().generic_visit(node)
        except Exception as e:
            self.log_error(f"Error in generic_visit for {type(node).__name__}", e)

    def _handle_method_call(self, node):
        """
        Handle method calls, particularly focusing on state methods.
        Returns a structured rule representation of the method call.
        """
        print(f"Handling method call: {ast.dump(node)}")

        if not isinstance(node.func, ast.Attribute):
            self.log("Not an attribute method call")
            return None

        # Extract the object and method names
        if isinstance(node.func.value, ast.Name):
            obj_name = node.func.value.id
            method_name = node.func.attr
        else:
            self.log(f"Unhandled method call object type: {type(node.func.value)}")
            return None

        # Handle state methods
        if obj_name == 'state':
            print(f"Processing state method: {method_name}")
            
            # Extract arguments with proper handling of different arg types
            args = []
            for arg in node.args:
                if isinstance(arg, ast.Constant):
                    args.append(arg.value)
                elif isinstance(arg, ast.Name):
                    args.append(arg.id)
                elif isinstance(arg, ast.Str):
                    args.append(arg.s)
                else:
                    print(f"Complex argument type: {type(arg)}")
                    # For complex arguments, we may need to recursively analyze
                    self.visit(arg)
                    if self.current_result:
                        args.append(self.current_result)
                    else:
                        print(f"Could not analyze argument: {ast.dump(arg)}")
                        return None

            # Create appropriate rule structure based on method
            if method_name == 'has':
                if len(args) >= 2 and args[1] == 'player':
                    return {
                        'type': 'item_check',
                        'item': args[0]
                    }
                
            elif method_name == '_lttp_has_key':
                if len(args) >= 3 and args[2] == 'player':
                    return {
                        'type': 'count_check',
                        'item': args[0],
                        'count': args[1]
                    }
                
            elif method_name == 'has_group':
                if len(args) >= 2 and args[1] == 'player':
                    return {
                        'type': 'group_check',
                        'group': args[0]
                    }
                    
            elif method_name == 'can_reach':
                # Handle can_reach calls which check region/location accessibility
                if len(args) >= 3:
                    return {
                        'type': 'can_reach',
                        'target': args[0],
                        'type': args[1],
                        'player': args[2]
                    }
                    
            elif method_name == 'has_any':
                # Handle has_any which checks for any item in a list
                if len(args) >= 2 and args[1] == 'player':
                    items = args[0]
                    if isinstance(items, list):
                        return {
                            'type': 'or',
                            'conditions': [
                                {'type': 'item_check', 'item': item}
                                for item in items
                            ]
                        }

            # Generic state method handler for unrecognized methods
            return {
                'type': 'state_method',
                'method': method_name,
                'args': args
            }

        # Non-state method calls could be helper functions
        elif obj_name in self.closure_vars:
            helper_func = self.closure_vars[obj_name]
            # Check if it's a known helper function
            if helper_func.__name__ in self.seen_funcs:
                return {
                    'type': 'helper',
                    'name': helper_func.__name__,
                    'args': ['state', 'player']  # Most helpers take these args
                }
            else:
                print(f"Analyzing helper function: {helper_func.__name__}")
                result = self.analyze_helper(helper_func)
                if result:
                    self.seen_funcs.add(helper_func.__name__)
                    return result

        print(f"Unhandled method call: {obj_name}.{method_name}")
        return None

    def analyze_helper(self, func):
        """Analyze a helper function to determine its rule structure."""
        try:
            source = inspect.getsource(func)
            tree = ast.parse(source)
            
            # Create a new analyzer for the helper
            helper_analyzer = RuleAnalyzer(self.closure_vars, self.seen_funcs)
            helper_analyzer.visit(tree)
            
            if helper_analyzer.current_result:
                return helper_analyzer.current_result
            
            # If we couldn't analyze it, register it as a helper
            return {
                'type': 'helper',
                'name': func.__name__,
                'args': ['state', 'player']
            }
        except Exception as e:
            print(f"Error analyzing helper {func.__name__}: {e}")
            print("Error details:", str(e))  # Additional error info
            print("Consider updating helper analysis for this pattern")
            return None
    
    def _handle_function_call(self, node):
        if not hasattr(node.func, 'id'):
            return
        
        func_name = node.func.id
        
        # Skip built-in functions
        if func_name in {'min', 'max', 'len', 'sum'}:
            return

        # Get the actual function if it's a closure variable
        func = None
        if func_name in self.closure_vars:
            func = self.closure_vars[func_name]

        # Extract arguments safely
        args = []
        for arg in node.args:
            try:
                if isinstance(arg, (ast.Constant, ast.Num)):
                    args.append(arg.n if isinstance(arg, ast.Num) else arg.value)
                elif isinstance(arg, ast.Str):
                    args.append(arg.s)
                elif isinstance(arg, ast.Name):
                    args.append(arg.id)
            except:
                pass

        # Create helper node
        self.current_result = {
            'type': 'helper',
            'name': func_name,
            'args': args or None
        }

    def _extract_string_arg(self, node):
        if isinstance(node, (ast.Str, ast.Constant)) and isinstance(getattr(node, 'value', None), str):
            return node.value if isinstance(node, ast.Constant) else node.s
        return None

    def _extract_number_arg(self, node):
        if isinstance(node, (ast.Num, ast.Constant)) and isinstance(getattr(node, 'value', None), (int, float)):
            return node.value if isinstance(node, ast.Constant) else node.n
        return None

# --- AST Visitor to find specific lambda rules ---

class LambdaFinder(ast.NodeVisitor):
    """
    Searches an AST for a call to set_rule for a specific target
    and extracts the lambda function passed as the rule.
    """
    def __init__(self, target_name: str, target_player: Optional[int] = None):
        self.target_name = target_name
        # self.target_player = target_player # Optional: Could add player matching if needed
        self.found_lambda: Optional[ast.Lambda] = None
        self.found = False # Flag to stop searching once found
        print(f"LambdaFinder initialized for target: {target_name}")

    def visit_Call(self, node: ast.Call):
        # Stop visiting if we've already found the lambda
        if self.found:
            return

        # Check if this is a call to 'set_rule'
        func_name = None
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
             # Could be module.set_rule, self.set_rule etc. Just check the attribute name.
             func_name = node.func.attr

        if func_name == 'set_rule':
            print(f"LambdaFinder: Found set_rule call: {ast.dump(node)}")
            if len(node.args) >= 2:
                # --- Analyze the first argument (the target object) ---
                # This needs to identify if the call targets our self.target_name
                # Common patterns:
                # 1. world.get_location("Target Name", player)
                # 2. world.get_entrance("Target Name", player)
                # 3. world.get_region("Target Name", player)
                target_node = node.args[0]
                extracted_target_name = None

                if isinstance(target_node, ast.Call) and isinstance(target_node.func, ast.Attribute):
                    method_name = target_node.func.attr
                    if method_name in ['get_location', 'get_entrance', 'get_region']:
                        # Check the first argument of get_location/get_entrance
                        if len(target_node.args) > 0 and isinstance(target_node.args[0], ast.Constant):
                            extracted_target_name = target_node.args[0].value
                            print(f"LambdaFinder: Extracted target '{extracted_target_name}' from {method_name} call.")

                # --- Check if the target name matches ---
                if extracted_target_name == self.target_name:
                    print(f"LambdaFinder: Target name '{self.target_name}' MATCHED!")
                    # --- Check if the second argument is a Lambda ---
                    rule_node = node.args[1]
                    if isinstance(rule_node, ast.Lambda):
                        print(f"LambdaFinder: Found Lambda node for target '{self.target_name}'!")
                        self.found_lambda = rule_node
                        self.found = True # Stop searching
                        return # Don't visit children of this node further

        # Continue visiting children if not found or not a set_rule call
        if not self.found:
            super().generic_visit(node)


# Main analysis function
def analyze_rule(rule_func: Optional[Callable[[Any], bool]] = None, 
                 closure_vars: Optional[Dict[str, Any]] = None, 
                 seen_funcs: Optional[Set[int]] = None,
                 ast_node: Optional[ast.AST] = None) -> Dict[str, Any]:
    """
    Analyzes a rule function or an AST node representing a rule.

    Args:
        rule_func: The rule function (lambda or regular function) to analyze.
        closure_vars: Dictionary of variables available in the function's closure.
        seen_funcs: Set of function IDs already analyzed to prevent recursion.
        ast_node: An optional pre-parsed AST node (e.g., ast.Lambda) to analyze directly.

    Returns:
        A dictionary representing the structured rule.
    """
    print("\n--- Starting Rule Analysis ---")
    
    # Initialize seen_funcs set if not provided
    seen_funcs = seen_funcs or set()
    
    # Ensure closure_vars is a dictionary
    closure_vars = closure_vars or {}
    
    analyzer = RuleAnalyzer(closure_vars=closure_vars, seen_funcs=seen_funcs)
    
    try:
        # --- Option 1: Analyze a provided AST node directly --- 
        if ast_node:
            print(f"Analyzing provided AST node: {type(ast_node).__name__}")
            if isinstance(ast_node, (ast.Lambda, ast.Call, ast.BoolOp, ast.Compare, ast.Constant, ast.Name)): 
                analyzer.visit(ast_node)
            else:
                # Handle cases where the provided node isn't directly visitable as the root rule
                print(f"WARNING: Provided AST node type {type(ast_node).__name__} might not be a standard rule root. Attempting visit anyway.")
                # We might need more sophisticated handling here if we pass e.g., FunctionDef
                analyzer.visit(ast_node)

        # --- Option 2: Analyze a function object (existing logic) --- 
        elif rule_func:
            print(f"Rule function: {rule_func}")
            # Add rule_func itself to closure_vars if needed? Maybe not necessary.
            
            # Attempt to add function's actual closure variables
            try:
                if hasattr(rule_func, '__closure__') and rule_func.__closure__:
                    closure_cells = rule_func.__closure__
                    free_vars = rule_func.__code__.co_freevars
                    for var_name, cell in zip(free_vars, closure_cells):
                        if var_name not in closure_vars: # Don't overwrite passed vars
                            try:
                                closure_vars[var_name] = cell.cell_contents
                            except ValueError:
                                # Cell is empty, skip
                                pass 
                    print(f"Extracted closure vars: {list(closure_vars.keys())}")
                else:
                    print("No closure variables found for rule function.")
            except Exception as clo_err:
                print(f"Error extracting closure variables: {clo_err}")

            # Add self to closure vars if it's a method
            if hasattr(rule_func, '__self__') and 'self' not in closure_vars:
                 closure_vars['self'] = rule_func.__self__
                 print("Added 'self' to closure vars from method binding.")

            # Clean the source
            cleaned_source = _clean_source(rule_func)
            if cleaned_source is None:
                print("analyze_rule: Failed to clean source, returning error.")
                return {
                    'type': 'error',
                    'message': 'Failed to clean or retrieve source code for rule function.'
                }
            print("Cleaned source:", repr(cleaned_source))
            
            # Create analyzer instance *after* potentially updating closure_vars
            analyzer = RuleAnalyzer(closure_vars=closure_vars, seen_funcs=seen_funcs)
            
            # Comprehensive parse and visit
            try:
                tree = ast.parse(cleaned_source)
                print(f"analyze_rule: Parsed AST = {ast.dump(tree)}")
                print("AST parsed successfully")
                analyzer.visit(tree)
            except SyntaxError as parse_err:
                print(f"analyze_rule: SyntaxError during parse: {parse_err}")
                print(f"Syntax error parsing source: {parse_err}")
                
                # *** ADDED CHECK for incomplete multi-line lambda ***
                if cleaned_source.rstrip().endswith((' and', ' or')):
                    print("analyze_rule: Detected likely truncated multi-line lambda due to SyntaxError.")
                    analyzer.current_result = {
                        'type': 'error',
                        'message': 'Failed to parse likely multi-line lambda; source may be incomplete.',
                        'source_snippet': cleaned_source[-50:] # Show last 50 chars
                    }
                else:
                    # *** Original Fallback Logic (modified slightly) ***
                    # More robust function call extraction
                    method_match = re.search(r'(\w+(?:\.\w+)?)\((.+?)\)', cleaned_source, re.DOTALL)
                    if method_match:
                        method = method_match.group(1)
                        args_str = method_match.group(2).strip()
                        
                        # Careful argument parsing (remains the same)
                        def split_args(arg_str):
                            args = []
                            current_arg = []
                            quote_stack = []
                            paren_stack = []
                            
                            for char in arg_str:
                                if char in ["'", '"']:
                                    if not quote_stack or quote_stack[-1] != char:
                                        quote_stack.append(char)
                                    else:
                                        quote_stack.pop()
                                
                                if char == '(':
                                    paren_stack.append(char)
                                elif char == ')':
                                    if paren_stack:
                                        paren_stack.pop()
                                
                                # Split on comma only if not in quotes or nested parentheses
                                if char == ',' and not quote_stack and not paren_stack:
                                    if current_arg:
                                        args.append(''.join(current_arg).strip())
                                        current_arg = []
                                else:
                                    current_arg.append(char)
                            
                            if current_arg:
                                args.append(''.join(current_arg).strip())
                            
                            return args

                        args = split_args(args_str)
                        
                        print(f"Extracted method: {method}, args: {args}")
                        
                        # Set result based on extracted method (remains mostly the same)
                        # Ensure we don't incorrectly identify __analyzed_func__
                        if method == '__analyzed_func__':
                            analyzer.current_result = {
                                'type': 'error',
                                'message': f'SyntaxError lead to fallback identification of {method}',
                                'args': args
                            }
                        elif method == 'state.has':
                            item = args[0].strip().strip("'\"")
                            analyzer.current_result = {
                                'type': 'item_check',
                                'item': item
                            }
                        # ... other specific method handlers ...
                        else:
                             analyzer.current_result = {
                                'type': 'state_method', # Or potentially 'helper' if needed
                                'method': method,
                                'args': [arg.strip().strip("'\"") for arg in args]
                            }
                    else:
                         # If regex fallback also fails, use error result
                         print("analyze_rule: SyntaxError occurred and regex fallback failed.")
                         analyzer.current_result = None # Ensures error_result is used later

        # Detailed result logging
        if analyzer.error_log:
            print("Errors during analysis:")
            for error in analyzer.error_log:
                print(json.dumps(error, indent=2))
        
        print("Debug log:")
        for log_entry in analyzer.debug_log:
            print(log_entry)
        
        # Return result or error information
        error_result = {
            'type': 'error',
            'debug_log': analyzer.debug_log,
            'error_log': analyzer.error_log
        }
        
        # *** ADDED LOGGING ***
        final_result = analyzer.current_result or error_result
        print(f"analyze_rule: Final result before return = {json.dumps(final_result, indent=2)}")
        # *** END LOGGING ***
        return final_result
    
    except Exception as e:
        print(f"Unexpected error in rule analysis: {e}")
        traceback.print_exc()
        return {
            'type': 'constant',
            'value': True  # Default to always accessible
        }