# Cloud Environment Setup Guide

This guide provides instructions for setting up the Archipelago JSON Export Tools development environment in the Claude Code cloud interface.

## Overview

When working in the Claude Code cloud interface, you'll be setting up your development environment from scratch in a fresh container. This guide walks you through the complete setup process needed before you can begin working on game implementations or debugging.

## Prerequisites

The cloud environment comes pre-installed with:
- **Git**: Already configured
- **Python 3.11+**: Available system-wide
- **Node.js v22+**: Available system-wide
- **npm 10+**: Available system-wide

## Setup Steps

Follow these steps in order to set up your development environment. The entire setup process takes approximately 5-10 minutes.

### Step 1: Create Python Virtual Environment

Create an isolated Python environment to manage dependencies:

```bash
python -m venv .venv
```

This creates a `.venv` directory containing the isolated Python environment.

### Step 2: Install Python Requirements

Activate the virtual environment and install the required Python packages:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

**Note:** You'll see some warnings about pip cache permissions and compilation warnings for `_speedups.c` - these are normal and don't affect functionality.

### Step 3: Install Game-Specific Dependencies

Install additional Python packages required by specific game worlds:

```bash
source .venv/bin/activate
python ModuleUpdate.py --yes
```

This command installs game-specific packages like:
- `pyevermizer` for Secret of Evermore
- `zilliandomizer` for Zillion
- `factorio-rcon-py` for Factorio
- Various other game-specific libraries

### Step 4: Generate Template Files

Generate template YAML files for all supported games:

```bash
source .venv/bin/activate
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"
```

This creates a `Players/Templates/` directory with 80+ template files (one for each supported game).

**Note:** You may see a warning about creating a new `host.yaml` file - this is expected.

### Step 5: Configure Host Settings

Create and configure the `host.yaml` file for testing:

```bash
source .venv/bin/activate
python Launcher.py --update_settings
python scripts/setup/update_host_settings.py minimal-spoilers
```

The `minimal-spoilers` configuration enables:
- Rules JSON export (`save_rules_json: true`)
- Sphere log generation (`save_sphere_log: true`)
- Frontend preset updates (`update_frontend_presets: true`)

### Step 6: Install Node.js Dependencies

Install the JavaScript/TypeScript packages needed for frontend testing:

```bash
npm install
```

This installs Playwright and other testing dependencies defined in `package.json`.

### Step 7: Playwright Browser Setup

The cloud environment typically has cached Playwright browsers from previous sessions. The project uses Playwright 1.56.0 which requires browser build 1194.

**Check for cached browsers first:**

```bash
ls ~/.cache/ms-playwright/
```

If you see `chromium-1194` in the output, the browser is already cached and you can skip the download step.

**If cached browsers exist but tests fail:**

If tests fail with "Executable doesn't exist" errors, the Playwright version may not match the cached browser. Check the required browser build:

```bash
npx playwright install --dry-run chromium 2>&1 | head -3
```

This shows the browser build number Playwright expects (e.g., `chromium-1194`). If it doesn't match the cached version, you have two options:

1. **Match Playwright to cached browser** (recommended for cloud environments):
   ```bash
   # Find your cached browser version
   ls ~/.cache/ms-playwright/ | grep chromium

   # If you have chromium-1194, ensure Playwright 1.56.0 is installed
   npm install @playwright/test@1.56.0 --save-dev
   ```

2. **Download new browser** (may be blocked in cloud environments):
   ```bash
   PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium
   ```

**Common Playwright version to browser build mappings:**

| Playwright Version | Browser Build |
|-------------------|---------------|
| 1.56.0            | 1194          |
| 1.55.0            | 1187          |
| 1.53.0            | 1178          |
| 1.52.0            | 1169          |
| 1.49.0            | 1148          |

**Note:** Browser downloads may be blocked in cloud environments with 403 "Host not allowed" errors. Using cached browsers with matching Playwright version is the recommended approach.

## Verification

After completing the setup, verify everything is configured correctly:

```bash
# Check Python environment
source .venv/bin/activate
python -c "import websockets, yaml, jinja2; print('Python packages: OK')"

# Check templates were created
ls Players/Templates/*.yaml | wc -l  # Should show 80+ files

# Check host.yaml exists
test -f host.yaml && echo "host.yaml: OK"

# Check Node modules
test -d node_modules && echo "Node.js packages: OK"

# Check Playwright
test -f node_modules/.bin/playwright && echo "Playwright: OK"
```

## Common Setup Issues

### Issue: Virtual Environment Activation Fails

If `source .venv/bin/activate` doesn't work, ensure the virtual environment was created successfully:

```bash
ls -la .venv/bin/activate
```

If the file doesn't exist, recreate the virtual environment:

```bash
rm -rf .venv
python -m venv .venv
```

### Issue: ModuleUpdate.py Fails

If `ModuleUpdate.py` fails with import errors, ensure you've activated the virtual environment first:

```bash
source .venv/bin/activate
python ModuleUpdate.py --yes
```

### Issue: Template Generation Warnings

You may see compiler warnings about `_speedups.c` during template generation. These are normal and can be safely ignored - the templates will still generate correctly.

### Issue: Playwright Browser Download Blocked

In cloud environments, browser downloads may fail with 403 "Host not allowed" errors:

```
Error: Download failed: server returned code 403 body 'Host not allowed'
```

**Solution:** Use cached browsers instead. Check what's available:

```bash
ls ~/.cache/ms-playwright/ | grep chromium
```

Then install a matching Playwright version. For example, if you have `chromium-1194`:

```bash
npm install @playwright/test@1.56.0 --save-dev
```

### Issue: Playwright "Executable doesn't exist" Error

If tests fail with errors like:

```
Error: browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium-1200/...
```

This means the installed Playwright version expects a different browser build than what's cached.

**Solution:** Either:
1. Install a Playwright version matching your cached browser (see version mapping table in Step 7)
2. Or try downloading the required browser: `PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium`

### Issue: Playwright Installation Hangs

If Playwright browser installation appears to hang, it may be downloading large binary files. Give it 2-3 minutes to complete. The installation happens automatically on first use if you skip this step.

## Cloud Environment Considerations

### Session Persistence

The cloud environment is temporary. If your session ends:
1. You'll need to re-run the complete setup process in a new session
2. All local files and changes will be lost unless committed and pushed to git
3. Always commit and push your work before ending a session

### Virtual Environment

The virtual environment (`.venv/`) is local to your session:
- It's listed in `.gitignore` and won't be committed
- You must recreate it in each new cloud session
- Activation is session-specific - run `source .venv/bin/activate` in each new terminal

### Parallel Sessions

When multiple Claude Code instances run in parallel:
- Each instance has its own isolated environment
- Each instance works on its own git branch (e.g., `claude/task-name-SESSION_ID`)
- Setup must be completed independently in each instance
- Branches are merged later after work is complete

## Working with the Virtual Environment

After setup, you'll need to activate the virtual environment whenever you:
- Run Python scripts that import Archipelago code
- Use `Generate.py` to create game data
- Run any Python-based tools in the project

**To activate:**
```bash
source .venv/bin/activate
```

**To deactivate:**
```bash
deactivate
```

## Next Steps

Once setup is complete, proceed to the task-specific documentation:

- **For game debugging work**: See `CC/game-debugging-CC.md`
- **For general development**: See `docs/json/developer/getting-started.md`
- **For testing pipeline**: See `docs/json/developer/guides/testing-pipeline.md`

## Quick Setup Script

For convenience, you can run all setup steps at once:

```bash
#!/bin/bash
# Quick setup script for cloud environment

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
python ModuleUpdate.py --yes

# Generate templates and configure host
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"
python Launcher.py --update_settings
python scripts/setup/update_host_settings.py minimal-spoilers

# Install Node.js dependencies
npm install

# Check for cached Playwright browser
if [ -d ~/.cache/ms-playwright/chromium-1194 ]; then
    echo "Found cached Playwright browser (chromium-1194)"
else
    echo "No cached browser found, attempting download..."
    PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium || \
        echo "Browser download may have failed - check for cached versions"
fi

echo "Setup complete! Virtual environment is activated."
echo "Run 'source .venv/bin/activate' in new terminal sessions."
```

Save this as `CC/scripts/cloud-setup.sh` and run with:

```bash
bash CC/scripts/cloud-setup.sh
```

## Troubleshooting

If you encounter issues during setup:

1. **Check Python version**: Ensure Python 3.11+ is available
   ```bash
   python --version
   ```

2. **Check Node.js version**: Ensure Node.js v22+ is available
   ```bash
   node --version
   ```

3. **Review error messages**: Most errors include helpful suggestions
4. **Recreate virtual environment**: If packages fail to install, recreate `.venv`
5. **Check disk space**: Ensure sufficient space for all dependencies (~500MB total)

For additional help, consult the main developer guide at `docs/json/developer/getting-started.md`.
