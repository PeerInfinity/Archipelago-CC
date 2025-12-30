"""
Operator visitor mixin for AST visitors.

This module contains visitor methods for operator AST nodes
like unary operations, comparisons, and binary operations.
"""

import ast
import logging
from typing import Any, Dict, Optional

from ..utils import is_simple_value, make_json_serializable


class OperatorVisitorMixin:
    """
    Mixin containing visitor methods for operator nodes.

    Required attributes from parent class:
        - expression_resolver: ExpressionResolver instance
        - binary_op_processor: BinaryOpProcessor instance
    """

    def visit_UnaryOp(self, node: ast.UnaryOp):
        """ Handle unary operations (e.g., not). """
        try:
            op_name = type(node.op).__name__.lower()
            logging.debug(f"\n--- visit_UnaryOp: op={op_name} ---")

            operand_result = self.visit(node.operand)
            if operand_result is None:
                logging.error(f"Failed to analyze operand for UnaryOp: {ast.dump(node.operand)}")
                return None

            # Try to resolve the operand if it's an attribute expression
            if operand_result.get('type') == 'attribute':
                resolved_value = self.expression_resolver.resolve_expression(operand_result)
                if resolved_value is not None and is_simple_value(resolved_value):
                    # Handle enum values - extract the numeric/boolean value
                    if hasattr(resolved_value, 'value'):
                        final_value = resolved_value.value
                    else:
                        final_value = resolved_value
                    # Ensure the final value is JSON-serializable
                    final_value = make_json_serializable(final_value)
                    logging.debug(f"Resolved UnaryOp operand attribute to constant: {final_value}")
                    operand_result = {'type': 'constant', 'value': final_value}

            # Handle specific unary operators
            if isinstance(node.op, ast.Not):
                # If operand is a constant, evaluate the not operation now
                if operand_result.get('type') == 'constant':
                    constant_value = operand_result['value']
                    result_value = not constant_value
                    logging.debug(f"Evaluated not {constant_value} = {result_value}")
                    return {'type': 'constant', 'value': result_value}
                else:
                    return {'type': 'not', 'condition': operand_result}
            elif isinstance(node.op, ast.USub):
                # Unary minus (e.g., -1, -x)
                if operand_result.get('type') == 'constant':
                    constant_value = operand_result['value']
                    if isinstance(constant_value, (int, float)):
                        result_value = -constant_value
                        logging.debug(f"Evaluated -{constant_value} = {result_value}")
                        return {'type': 'constant', 'value': result_value}
                # For non-constant operands, return a negation structure
                return {'type': 'negate', 'operand': operand_result}
            elif isinstance(node.op, ast.UAdd):
                # Unary plus (e.g., +1, +x) - essentially a no-op for constants
                if operand_result.get('type') == 'constant':
                    constant_value = operand_result['value']
                    if isinstance(constant_value, (int, float)):
                        logging.debug(f"Evaluated +{constant_value} = {constant_value}")
                        return {'type': 'constant', 'value': constant_value}
                # For non-constant operands, just return the operand as-is
                return operand_result
            else:
                logging.error(f"Unhandled unary operator: {op_name}")
                return None # Or a generic representation

        except Exception as e:
            logging.error("Error in visit_UnaryOp", e)
            return None

    def visit_Compare(self, node: ast.Compare):
        """ Handle comparison operations (e.g., ==, !=, in, not in, is, is not). """
        try:
            logging.debug(f"\n--- visit_Compare ---")
            if len(node.ops) != 1 or len(node.comparators) != 1:
                # For now, only support simple comparisons like `a op b`
                logging.error(f"Unsupported chained comparison: {ast.dump(node)}")
                return None

            left_result = self.visit(node.left)
            op_name = type(node.ops[0]).__name__.lower() # e.g., 'eq', 'in', 'is'
            right_result = self.visit(node.comparators[0])

            if left_result is None or right_result is None:
                logging.error(f"Failed to analyze left or right side of comparison: {ast.dump(node)}")
                return None

            # Map AST operator names to a simpler representation if desired
            op_map = {
                'eq': '==', 'noteq': '!=',
                'lt': '<', 'lte': '<=',
                'gt': '>', 'gte': '>=',
                'is': 'is', 'isnot': 'is not',
                'in': 'in', 'notin': 'not in'
            }
            op_symbol = op_map.get(op_name, op_name) # Use original name if not in map

            # Try constant folding - if both sides are constants, evaluate at export time
            folded_result = self._try_fold_comparison(left_result, op_symbol, right_result)
            if folded_result is not None:
                return folded_result

            return {
                'type': 'compare',
                'left': left_result,
                'op': op_symbol,
                'right': right_result
            }

        except Exception as e:
            logging.error("Error in visit_Compare", e)
            return None

    def _try_fold_comparison(self, left_result, op_symbol, right_result):
        """
        Try to fold a comparison at export time if both sides are constants.

        This handles cases like `early_useful == OPTIONS.buildings_3` where both
        values are known closure variables that can be resolved at export time.

        Args:
            left_result: The left operand result dict
            op_symbol: The comparison operator ('==', '!=', '<', '>', etc.)
            right_result: The right operand result dict

        Returns:
            A constant result dict if folding succeeded, None otherwise
        """
        try:
            # Check if both sides are constants
            if not (left_result and left_result.get('type') == 'constant' and
                    right_result and right_result.get('type') == 'constant'):
                return None

            left_val = left_result.get('value')
            right_val = right_result.get('value')

            # Evaluate the comparison based on the operator
            result = None
            if op_symbol == '==':
                result = left_val == right_val
            elif op_symbol == '!=':
                result = left_val != right_val
            elif op_symbol == '<':
                result = left_val < right_val
            elif op_symbol == '<=':
                result = left_val <= right_val
            elif op_symbol == '>':
                result = left_val > right_val
            elif op_symbol == '>=':
                result = left_val >= right_val
            elif op_symbol == 'in':
                # For 'in' operator, right side should be a collection
                if isinstance(right_val, (list, tuple, set, str)):
                    result = left_val in right_val
            elif op_symbol == 'not in':
                if isinstance(right_val, (list, tuple, set, str)):
                    result = left_val not in right_val
            elif op_symbol == 'is':
                result = left_val is right_val
            elif op_symbol == 'is not':
                result = left_val is not right_val

            if result is not None:
                logging.debug(f"Folded comparison: {left_val!r} {op_symbol} {right_val!r} = {result}")
                return {'type': 'constant', 'value': result}

            return None

        except (TypeError, ValueError) as e:
            # Comparison not possible (e.g., comparing incompatible types)
            logging.debug(f"Could not fold comparison: {e}")
            return None
        except Exception as e:
            logging.warning(f"Error during comparison folding: {e}")
            return None

    def visit_BinOp(self, node: ast.BinOp):
        """ Handle binary operations (e.g., +, -, *, /). """
        try:
            logging.debug(f"\n--- visit_BinOp ---")
            left_result = self.visit(node.left)
            op_name = type(node.op).__name__ # E.g., 'Add', 'Mult'
            right_result = self.visit(node.right)

            if left_result is None or right_result is None:
                logging.error(f"Failed to analyze left or right side of BinOp: {ast.dump(node)}")
                return None

            # Map AST operator names to symbols
            op_map = {
                'Add': '+', 'Sub': '-',
                'Mult': '*', 'Div': '/', 'FloorDiv': '//', 'Mod': '%',
                'Pow': '**',
                'LShift': '<<', 'RShift': '>>',
                'BitOr': '|', 'BitXor': '^', 'BitAnd': '&'
            }
            op_symbol = op_map.get(op_name, op_name) # Use class name if no symbol

            # Try to pre-process certain binary operations during export
            processed_result = self.binary_op_processor.try_preprocess_binary_op(left_result, op_symbol, right_result)
            if processed_result is not None:
                logging.debug(f"Pre-processed binary operation to: {processed_result}")
                return processed_result

            return {
                'type': 'binary_op',
                'left': left_result,
                'op': op_symbol,
                'right': right_result
            }
        except Exception as e:
            logging.error("Error in visit_BinOp", e)
            return None
