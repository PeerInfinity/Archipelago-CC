#!/usr/bin/env python3
"""
Generate a freshness report showing how recently each test result document was generated.

Scans all markdown files in docs/json/developer/test-results/ and extracts:
- Document name (as clickable link)
- Source data date (when the underlying test data was created)
- Document generation date (when the markdown was generated)
- Days since each date
- Command to regenerate the document

Also runs documentation sync scripts and includes their status.

Output: docs/json/developer/test-results/test-results-freshness.md
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Project root (script is at scripts/docs/generate-freshness-report.py)
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
TEST_RESULTS_DIR = PROJECT_ROOT / "docs" / "json" / "developer" / "test-results"
OUTPUT_FILE = TEST_RESULTS_DIR / "test-results-freshness.md"

# Mapping of document name patterns to regeneration commands
# Keys are regex patterns, values are (command, description) tuples
REGENERATION_COMMANDS: Dict[str, Tuple[str, str]] = {
    # Spoiler tests
    r'test-results-spoilers-minimal\.md$': (
        'python scripts/test/test-all-templates.py --minimal-spoilers -p',
        'Run minimal spoiler tests'
    ),
    r'test-results-spoilers-full\.md$': (
        'python scripts/test/test-all-templates.py --full-spoilers -p',
        'Run full spoiler tests'
    ),
    r'test-results-spoilers-minimal-worldgen\.md$': (
        'python scripts/test/test-all-templates.py --minimal-spoilers --worldgen -p',
        'Run minimal spoiler tests (worldgen)'
    ),
    r'test-results-spoilers-full-worldgen\.md$': (
        'python scripts/test/test-all-templates.py --full-spoilers --worldgen -p',
        'Run full spoiler tests (worldgen)'
    ),
    r'test-results-spoilers-minimal-apworld\.md$': (
        'python scripts/test/test-all-templates.py --minimal-spoilers --apworld -p',
        'Run minimal spoiler tests (apworld)'
    ),
    r'test-results-spoilers-full-apworld\.md$': (
        'python scripts/test/test-all-templates.py --full-spoilers --apworld -p',
        'Run full spoiler tests (apworld)'
    ),

    # Multiclient tests
    r'test-results-multiclient\.md$': (
        'python scripts/test/test-all-templates.py --multiclient -p',
        'Run multiclient tests'
    ),
    r'test-results-multiclient-worldgen\.md$': (
        'python scripts/test/test-all-templates.py --multiclient --worldgen -p',
        'Run multiclient tests (worldgen)'
    ),
    r'test-results-multiclient-apworld\.md$': (
        'python scripts/test/test-all-templates.py --multiclient --apworld -p',
        'Run multiclient tests (apworld)'
    ),

    # Multiworld tests
    r'test-results-multiworld\.md$': (
        'python scripts/test/test-all-templates.py --multiworld -p',
        'Run multiworld tests'
    ),
    r'test-results-multiworld-worldgen\.md$': (
        'python scripts/test/test-all-templates.py --multiworld --worldgen -p',
        'Run multiworld tests (worldgen)'
    ),
    r'test-results-multiworld-apworld\.md$': (
        'python scripts/test/test-all-templates.py --multiworld --apworld -p',
        'Run multiworld tests (apworld)'
    ),

    # UT Fuzz tests
    r'test-results-ut-fuzz\.md$': (
        'python scripts/test/test-all-ut-fuzz.py -p',
        'Run UT fuzz tests'
    ),
    r'test-results-multiworld-ut-fuzz\.md$': (
        'python scripts/test/test-multiworld-ut-fuzz.py -p',
        'Run multiworld UT fuzz tests'
    ),

    # Spoiler fuzz tests
    r'test-results-spoiler-fuzz\.md$': (
        'python scripts/test/test-all-spoiler-fuzz.py -p',
        'Run spoiler fuzz tests'
    ),
    r'test-results-spoiler-fuzz-apworlds\.md$': (
        'python scripts/test/test-all-spoiler-fuzz.py --apworld -p',
        'Run spoiler fuzz tests (apworld)'
    ),

    # Fuzz summary
    r'test-results-fuzz-summary\.md$': (
        'python scripts/docs/generate_fuzz_summary_chart.py',
        'Generate fuzz summary chart'
    ),
    r'test-results-fuzz-summary-apworlds\.md$': (
        'python scripts/docs/generate_fuzz_summary_chart.py --apworld',
        'Generate fuzz summary chart (apworld)'
    ),

    # Processing times
    r'test-results-processing-times\.md$': (
        'python scripts/docs/generate-test-chart.py --processing-times',
        'Generate processing times chart'
    ),
    r'test-results-processing-times-worldgen\.md$': (
        'python scripts/docs/generate-test-chart.py --processing-times --worldgen',
        'Generate processing times chart (worldgen)'
    ),
    r'test-results-processing-times-apworld\.md$': (
        'python scripts/docs/generate-test-chart.py --processing-times --apworld',
        'Generate processing times chart (apworld)'
    ),

    # UT fuzz charts
    r'test-results-ut-fuzz-modified\.md$': (
        'python scripts/docs/generate_ut_fuzz_chart.py --modified',
        'Generate UT fuzz chart (modified)'
    ),
    r'test-results-ut-fuzz-original\.md$': (
        'python scripts/docs/generate_ut_fuzz_chart.py --original',
        'Generate UT fuzz chart (original)'
    ),
    r'test-results-ut-fuzz-hybrid\.md$': (
        'python scripts/docs/generate_ut_fuzz_chart.py --hybrid',
        'Generate UT fuzz chart (hybrid)'
    ),
    r'test-results-ut-fuzz-apworlds-modified\.md$': (
        'python scripts/docs/generate_ut_fuzz_chart.py --apworld --modified',
        'Generate UT fuzz chart (apworld modified)'
    ),
    r'test-results-ut-fuzz-apworlds-original\.md$': (
        'python scripts/docs/generate_ut_fuzz_chart.py --apworld --original',
        'Generate UT fuzz chart (apworld original)'
    ),
    r'test-results-ut-fuzz-apworlds-hybrid\.md$': (
        'python scripts/docs/generate_ut_fuzz_chart.py --apworld --hybrid',
        'Generate UT fuzz chart (apworld hybrid)'
    ),

    # UT fuzz comparison charts
    r'test-results-ut-fuzz-comparison-.*\.md$': (
        'python scripts/docs/compare_ut_fuzz_results.py',
        'Generate UT fuzz comparison chart'
    ),
    r'test-results-ut-fuzz-apworlds-comparison-.*\.md$': (
        'python scripts/docs/compare_ut_fuzz_results.py --apworld',
        'Generate UT fuzz comparison chart (apworld)'
    ),

    # Summary charts
    r'test-results-summary\.md$': (
        'python scripts/docs/generate-test-chart.py --summary',
        'Generate test summary chart'
    ),
    r'test-results-summary-worldgen\.md$': (
        'python scripts/docs/generate-test-chart.py --summary --worldgen',
        'Generate test summary chart (worldgen)'
    ),
    r'test-results-summary-apworld\.md$': (
        'python scripts/docs/generate-test-chart.py --summary --apworld',
        'Generate test summary chart (apworld)'
    ),

    # World generator report
    r'test-results-world-generator\.md$': (
        'python scripts/docs/generate-world-generator-report.py',
        'Generate world generator report'
    ),

    # Freshness report itself
    r'test-results-freshness\.md$': (
        'python scripts/docs/generate-freshness-report.py',
        'Generate this freshness report'
    ),
}


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


def get_regeneration_command(filename: str) -> Tuple[Optional[str], Optional[str]]:
    """Get the command to regenerate a document.

    Returns (command, description) or (None, None) if no command is known.
    """
    for pattern, (cmd, desc) in REGENERATION_COMMANDS.items():
        if re.search(pattern, filename):
            return cmd, desc
    return None, None


def run_sync_scripts() -> Dict[str, Dict]:
    """Run the documentation sync scripts and collect their results."""
    sync_results = {}

    sync_scripts = [
        ('Rule Types Documentation', 'scripts/docs/sync-rule-docs.py'),
        ('Rule Types Test Coverage', 'scripts/docs/sync-rule-tests.py'),
        ('Script Documentation', 'scripts/docs/sync-script-docs.py'),
    ]

    for name, script_path in sync_scripts:
        script_full_path = PROJECT_ROOT / script_path
        if not script_full_path.exists():
            sync_results[name] = {'error': f'Script not found: {script_path}'}
            continue

        try:
            result = subprocess.run(
                [sys.executable, str(script_full_path), '--json'],
                capture_output=True,
                text=True,
                cwd=str(PROJECT_ROOT),
                timeout=60
            )

            # Parse JSON output (skip the "Extracting..." lines)
            output_lines = result.stdout.strip().split('\n')
            json_start = None
            for i, line in enumerate(output_lines):
                if line.strip().startswith('{'):
                    json_start = i
                    break

            if json_start is not None:
                json_str = '\n'.join(output_lines[json_start:])
                data = json.loads(json_str)
                sync_results[name] = {
                    'data': data,
                    'script': script_path,
                }
            else:
                sync_results[name] = {'error': 'No JSON output found'}

        except subprocess.TimeoutExpired:
            sync_results[name] = {'error': 'Script timed out'}
        except json.JSONDecodeError as e:
            sync_results[name] = {'error': f'Invalid JSON: {e}'}
        except Exception as e:
            sync_results[name] = {'error': str(e)}

    return sync_results


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

        regen_cmd, regen_desc = get_regeneration_command(md_file.name)

        results.append({
            'filename': md_file.name,
            'source_date': source_date,
            'source_days': source_days,
            'generated_date': generated_date,
            'generated_days': generated_days,
            'regen_command': regen_cmd,
            'regen_description': regen_desc,
        })

    return results


def generate_markdown(results: List[Dict], sync_results: Optional[Dict] = None) -> str:
    """Generate the markdown report content."""
    now = datetime.now()

    md = "# Test Results Freshness Report\n\n"
    md += "This report shows when each test result document was generated, how fresh the underlying data is, "
    md += "and how to regenerate each document.\n\n"
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

    # Documentation sync status
    if sync_results:
        md += "## Documentation Sync Status\n\n"
        md += "Status of documentation coverage across the codebase:\n\n"
        md += "| Check | Coverage | Status | Command |\n"
        md += "|-------|----------|--------|--------|\n"

        for name, result in sync_results.items():
            if 'error' in result:
                md += f"| {name} | N/A | ⚠️ Error: {result['error']} | - |\n"
            else:
                data = result['data']
                script = result['script']

                # Handle different output formats (some have nested 'summary')
                summary = data.get('summary', data)

                # Get counts - different scripts use different field names
                undoc = summary.get('undocumented_count', summary.get('untested_count', 0))
                total = summary.get('total_implemented', summary.get('total_scripts',
                        summary.get('implemented_count', 0)))
                # Some scripts provide the documented/tested count directly
                documented = summary.get('documented_count', summary.get('tested_count', total - undoc))

                # Calculate coverage
                if 'coverage_percent' in data:
                    pct = data['coverage_percent']
                elif total > 0:
                    pct = round(100 * documented / total, 1)
                else:
                    pct = 0

                coverage = f"{pct}% ({documented}/{total})"

                # Determine status emoji
                if undoc == 0:
                    status = "✅ Complete"
                elif undoc <= 10:
                    status = f"🟡 {undoc} gaps"
                else:
                    status = f"🟠 {undoc} gaps"

                cmd = f"`python {script}`"
                md += f"| {name} | {coverage} | {status} | {cmd} |\n"

        md += "\n"

    md += "## Document Freshness\n\n"
    md += "| Status | Document | Source Data | Days Old | How to Update |\n"
    md += "|--------|----------|-------------|----------|---------------|\n"

    for result in results:
        filename = result['filename']
        doc_link = f"[{filename}](./{filename})"

        source_display = format_date(result['source_date'])
        source_days_display = format_days_ago(result['source_days'])

        # Add freshness emoji based on source data date
        freshness_emoji = get_freshness_emoji(result['source_days'])

        # Get regeneration command
        if result['regen_command']:
            regen_display = f"`{result['regen_command']}`"
        else:
            regen_display = "_Unknown_"

        md += f"| {freshness_emoji} | {doc_link} | {source_display} | {source_days_display} | {regen_display} |\n"

    md += "\n## Regeneration Commands\n\n"
    md += "Quick reference for updating stale documents:\n\n"

    # Group by category
    categories = {
        'Spoiler Tests': [],
        'Multiclient Tests': [],
        'Multiworld Tests': [],
        'Fuzz Tests': [],
        'Charts & Reports': [],
    }

    for result in results:
        if not result['regen_command']:
            continue

        filename = result['filename']
        cmd = result['regen_command']
        desc = result['regen_description'] or filename

        if 'spoiler' in filename.lower() and 'fuzz' not in filename.lower():
            categories['Spoiler Tests'].append((desc, cmd))
        elif 'multiclient' in filename.lower():
            categories['Multiclient Tests'].append((desc, cmd))
        elif 'multiworld' in filename.lower():
            categories['Multiworld Tests'].append((desc, cmd))
        elif 'fuzz' in filename.lower():
            categories['Fuzz Tests'].append((desc, cmd))
        else:
            categories['Charts & Reports'].append((desc, cmd))

    for category, items in categories.items():
        if not items:
            continue
        md += f"### {category}\n\n"
        md += "```bash\n"
        for desc, cmd in items:
            md += f"# {desc}\n{cmd}\n\n"
        md += "```\n\n"

    md += "## Freshness Legend\n\n"
    md += "- 🟢 **Fresh:** Source data from today or yesterday\n"
    md += "- 🟡 **Recent:** Source data within the last week\n"
    md += "- 🟠 **Aging:** Source data within the last month\n"
    md += "- 🔴 **Stale:** Source data over a month ago\n"
    md += "- ⚪ **Unknown:** No source data date found in document\n\n"

    md += "## Notes\n\n"
    md += "- **Source Data Date:** When the underlying test results were generated\n"
    md += "- **How to Update:** Command to regenerate this document with fresh data\n"
    md += "- The `-p` flag runs post-processing to generate the markdown charts\n"
    md += "- Documents without regeneration commands may be manually created or use a different workflow\n"

    return md


def main():
    """Main entry point."""
    print("Scanning test result documents...")
    results = scan_test_results()

    if not results:
        print("No test result documents found.")
        return 1

    print(f"Found {len(results)} documents")

    # Run documentation sync scripts
    print("\nRunning documentation sync scripts...")
    sync_results = run_sync_scripts()
    for name, result in sync_results.items():
        if 'error' in result:
            print(f"  {name}: Error - {result['error']}")
        else:
            data = result['data']
            if 'coverage_percent' in data:
                print(f"  {name}: {data['coverage_percent']}% coverage")
            elif 'undocumented_count' in data:
                print(f"  {name}: {data['undocumented_count']} undocumented")

    md_content = generate_markdown(results, sync_results)

    # Ensure output directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Write the report
    OUTPUT_FILE.write_text(md_content, encoding='utf-8')
    print(f"\nFreshness report saved to: {OUTPUT_FILE}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
