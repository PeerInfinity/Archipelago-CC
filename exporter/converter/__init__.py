"""
Rule format converters for Archipelago.

This module provides converters between different rule JSON formats:
- Rule Builder format (PR #5048) <-> Archipelago-CC format

Usage:
    from exporter.converter import convert_rule_builder_to_cc

    # Convert a single rule
    cc_rule, warnings = convert_rule_builder_to_cc(rule_builder_json)

    # Convert an entire rules file
    cc_data, warnings = convert_rules_file_to_cc(rule_builder_file_data)
"""

from .rule_builder_to_cc import (
    convert_rule_builder_to_cc,
    convert_rules_file_to_cc,
    RuleBuilderToCC,
)

__all__ = [
    'convert_rule_builder_to_cc',
    'convert_rules_file_to_cc',
    'RuleBuilderToCC',
]
