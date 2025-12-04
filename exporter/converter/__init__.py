"""
Rule format converters for Archipelago.

This module provides bidirectional converters between:
- Rule Builder format (PR #5048)
- Archipelago-CC format (this repository)

Usage:
    from exporter.converter import (
        convert_rule_builder_to_cc,
        convert_cc_to_rule_builder,
    )

    # Convert Rule Builder -> CC format
    cc_rule, warnings = convert_rule_builder_to_cc(rule_builder_json)

    # Convert CC -> Rule Builder format
    rb_rule, warnings = convert_cc_to_rule_builder(cc_json)

    # Convert entire files
    cc_data, warnings = convert_rules_file_to_cc(rule_builder_file_data)
    rb_data, warnings = convert_rules_file_to_rule_builder(cc_file_data)

Round-trip support:
    Both converters preserve metadata to enable lossless round-trip conversions
    where the formats are compatible.
"""

from .rule_builder_to_cc import (
    convert_rule_builder_to_cc,
    convert_rules_file_to_cc,
    RuleBuilderToCC,
)

from .cc_to_rule_builder import (
    convert_cc_to_rule_builder,
    convert_rules_file_to_rule_builder,
    CCToRuleBuilder,
)

__all__ = [
    # B -> A (Rule Builder -> CC)
    'convert_rule_builder_to_cc',
    'convert_rules_file_to_cc',
    'RuleBuilderToCC',
    # A -> B (CC -> Rule Builder)
    'convert_cc_to_rule_builder',
    'convert_rules_file_to_rule_builder',
    'CCToRuleBuilder',
]
