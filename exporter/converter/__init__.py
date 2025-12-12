"""
Rule format converters for Archipelago.

This module provides bidirectional converters between:
- Rule Builder format (PR #5048)
- Archipelago-CC format (this repository)

Usage:
    from exporter.converter import (
        convert_rule_builder_to_cc,
        convert_cc_to_rule_builder,
        convert_snippet,
    )

    # Convert Rule Builder -> CC format (single rule)
    cc_rule, warnings = convert_rule_builder_to_cc(rule_builder_json)

    # Convert CC -> Rule Builder format (single rule)
    rb_rule, warnings = convert_cc_to_rule_builder(cc_json)

    # Convert a JSON string snippet (auto-detects format)
    exit_code, output_json = convert_snippet('{"type": "item_check", "item": "Sword"}')

    # Convert entire files
    cc_data, warnings = convert_rules_file_to_cc(rule_builder_file_data)
    rb_data, warnings = convert_rules_file_to_rule_builder(cc_file_data)

Round-trip support:
    Both converters preserve metadata to enable lossless round-trip conversions
    where the formats are compatible.

CLI usage:
    # Convert snippet from command line
    python -m exporter.converter --rule '{"type": "item_check", "item": "Sword"}'

    # Convert snippet from stdin
    echo '{"type": "item_check", "item": "Sword"}' | python -m exporter.converter --stdin

    # Convert full file
    python -m exporter.converter input.json -o output.json
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

from .cli import (
    convert_snippet,
    detect_snippet_format,
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
    # Snippet conversion (CLI and programmatic)
    'convert_snippet',
    'detect_snippet_format',
]
