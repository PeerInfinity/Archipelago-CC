#!/usr/bin/env python3
"""
Generate a freshness report showing how recently each test result document was generated.

Scans all markdown files in docs/json/developer/test-results/ and extracts:
- Document name (as clickable link)
- Source data date (when the underlying test data was created)
- Document generation date (when the markdown was generated)
- Days since each date

Output: docs/json/developer/test-results/test-results-freshness.md
"""

import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Project root (script is at scripts/docs/generate-freshness-report.py)
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
TEST_RESULTS_DIR = PROJECT_ROOT / "docs" / "json" / "developer" / "test-results"
OUTPUT_FILE = TEST_RESULTS_DIR / "test-results-freshness.md"


def parse_generated_date(content: str) -> Optional[datetime]:
    """Extract the **Generated:** date from markdown content."""
    # Format: **Generated:** 2026-01-30 23:54:13
    match = re.search(r'\*\*Generated:\*\*\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})', content)
    if match:
        try:
            return datetime.strptime(match.group(1), '%Y-%m-%d %H:%M:%S')
        except ValueError:
            pass
    return None


def parse_source_data_date(content: str) -> Optional[datetime]:
    """Extract the **Source Data Last Updated:** or **Source Data Created:** date from markdown content."""
    # Try Last Updated first (preferred)
    # Format can be ISO with T (2026-01-30T23:11:27) or with space (2026-01-30 23:11:27)
    match = re.search(r'\*\*Source Data Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})', content)
    if not match:
        # Fall back to Created
        match = re.search(r'\*\*Source Data Created:\*\*\s*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})', content)

    if match:
        try:
            date_str = match.group(1).replace(' ', 'T')  # Normalize to ISO format
            return datetime.fromisoformat(date_str)
        except ValueError:
            pass
    return None


def calculate_days_ago(dt: Optional[datetime], now: datetime) -> Optional[int]:
    """Calculate the number of days between a datetime and now."""
    if dt is None:
        return None
    delta = now - dt
    return delta.days


def format_date(dt: Optional[datetime]) -> str:
    """Format a datetime for display."""
    if dt is None:
        return "N/A"
    return dt.strftime('%Y-%m-%d %H:%M')


def format_days_ago(days: Optional[int]) -> str:
    """Format days ago with color indicator."""
    if days is None:
        return "N/A"
    if days <= 0:
        return ""
    elif days == 1:
        return "1 day"
    else:
        return f"{days} days"


def get_freshness_emoji(days: Optional[int]) -> str:
    """Return an emoji indicating freshness level."""
    if days is None:
        return "⚪"
    if days <= 1:  # Today, yesterday, or future timestamps (same day)
        return "🟢"  # Fresh (today or yesterday)
    elif days <= 7:
        return "🟡"  # Recent (within a week)
    elif days <= 30:
        return "🟠"  # Aging (within a month)
    else:
        return "🔴"  # Stale (over a month)


def scan_test_results() -> List[Dict]:
    """Scan all markdown files in the test results directory and extract date information."""
    results = []
    now = datetime.now()

    if not TEST_RESULTS_DIR.exists():
        print(f"Warning: Test results directory not found: {TEST_RESULTS_DIR}")
        return results

    for md_file in sorted(TEST_RESULTS_DIR.glob("*.md")):
        # Skip the freshness report itself
        if md_file.name == "test-results-freshness.md":
            continue

        try:
            content = md_file.read_text(encoding='utf-8')
        except Exception as e:
            print(f"Warning: Could not read {md_file.name}: {e}")
            continue

        generated_date = parse_generated_date(content)
        source_date = parse_source_data_date(content)

        generated_days = calculate_days_ago(generated_date, now)
        source_days = calculate_days_ago(source_date, now)

        results.append({
            'filename': md_file.name,
            'source_date': source_date,
            'source_days': source_days,
            'generated_date': generated_date,
            'generated_days': generated_days,
        })

    return results


def generate_markdown(results: List[Dict]) -> str:
    """Generate the markdown report content."""
    now = datetime.now()

    md = "# Test Results Freshness Report\n\n"
    md += "This report shows when each test result document was generated and how fresh the underlying data is.\n\n"
    md += f"**Report Generated:** {now.strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    # Summary statistics (based on source data date)
    total = len(results)
    with_dates = sum(1 for r in results if r['source_date'] is not None)
    fresh_count = sum(1 for r in results if r['source_days'] is not None and r['source_days'] <= 1)
    recent_count = sum(1 for r in results if r['source_days'] is not None and 1 < r['source_days'] <= 7)
    aging_count = sum(1 for r in results if r['source_days'] is not None and 7 < r['source_days'] <= 30)
    stale_count = sum(1 for r in results if r['source_days'] is not None and r['source_days'] > 30)

    md += "## Summary\n\n"
    md += f"- **Total Documents:** {total}\n"
    md += f"- **With Date Info:** {with_dates}\n"
    md += f"- 🟢 **Fresh (0-1 days):** {fresh_count}\n"
    md += f"- 🟡 **Recent (2-7 days):** {recent_count}\n"
    md += f"- 🟠 **Aging (8-30 days):** {aging_count}\n"
    md += f"- 🔴 **Stale (>30 days):** {stale_count}\n\n"

    md += "## Document Freshness\n\n"
    md += "| Document | Source Data Date | Doc Generated | Days Since Source | Days Since Generated |\n"
    md += "|----------|------------------|---------------|-------------------|----------------------|\n"

    for result in results:
        filename = result['filename']
        doc_link = f"[{filename}](./{filename})"

        source_display = format_date(result['source_date'])
        generated_display = format_date(result['generated_date'])

        source_days_display = format_days_ago(result['source_days'])
        generated_days_display = format_days_ago(result['generated_days'])

        # Add freshness emoji based on source data date
        freshness_emoji = get_freshness_emoji(result['source_days'])

        md += f"| {freshness_emoji} {doc_link} | {source_display} | {generated_display} | {source_days_display} | {generated_days_display} |\n"

    md += "\n## Freshness Legend\n\n"
    md += "- 🟢 **Fresh:** Source data from today or yesterday\n"
    md += "- 🟡 **Recent:** Source data within the last week\n"
    md += "- 🟠 **Aging:** Source data within the last month\n"
    md += "- 🔴 **Stale:** Source data over a month ago\n"
    md += "- ⚪ **Unknown:** No source data date found in document\n\n"

    md += "## Notes\n\n"
    md += "- **Source Data Date:** When the underlying test results were generated\n"
    md += "- **Doc Generated:** When the markdown document was created from the test results\n"
    md += "- Documents without date information may use a different format or be manually created\n"

    return md


def main():
    """Main entry point."""
    print("Scanning test result documents...")
    results = scan_test_results()

    if not results:
        print("No test result documents found.")
        return 1

    print(f"Found {len(results)} documents")

    md_content = generate_markdown(results)

    # Ensure output directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Write the report
    OUTPUT_FILE.write_text(md_content, encoding='utf-8')
    print(f"Freshness report saved to: {OUTPUT_FILE}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
