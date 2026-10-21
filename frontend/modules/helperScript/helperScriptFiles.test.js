import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  MANIFEST_PATH,
  REPO_ROOT,
  manifestText,
  trackedPackageFiles,
} from '../../../scripts/build/helper-script-files.mjs';

describe('helperScriptFiles.json', () => {
  it('is the tracked exporter subset (regenerate: node scripts/build/helper-script-files.mjs --write)', () => {
    const committed = fs.readFileSync(path.join(REPO_ROOT, MANIFEST_PATH), 'utf8');
    expect(committed).toBe(manifestText(trackedPackageFiles()));
  });

  it('carries the entry point and leaves out the world-importing handler dirs', () => {
    const files = trackedPackageFiles();
    expect(files).toContain('script_api.py');
    expect(files).toContain('analyzer/analysis.py');
    expect(files.some(f => f.startsWith('games/official/') || f.startsWith('games/unofficial/'))).toBe(false);
    expect(files).not.toContain('exporter.py');
  });
});
