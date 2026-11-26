// The pin between the two halves of the mystery integration:
//   - the game's page, in the submodule frontend/modules/mystery-clue-game (another repository), and
//   - the committed mystery world(s), generated from one commit of that repository.
// The page refuses a world of another version of its case (`mystery:refused`, `other-version`), so
// the two must be the same version. This test reads every committed preset that carries a
// `slot_data.mystery` block and holds the block equal to the one in the submodule's own export of
// that case (`<case>/rules.json`). Moving the submodule past a change of a case is therefore a
// world rebuild in the same commit, never a pointer bump alone.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_SUBMODULE_PATH } from './mysteryPage.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const GAME = path.join(REPO, GAME_SUBMODULE_PATH);
const PRESETS = path.join(REPO, 'frontend/presets');
// An absent submodule (a checkout made without it) cannot be measured. CI checks submodules out,
// so there an absent one is a failure, not a skip.
const gameIsCheckedOut = fs.existsSync(path.join(GAME, 'index.html'));

const mysteryBlockOf = (rules) => {
  for (const world of Object.values(rules?.world ?? {})) {
    if (world?.slot_data?.mystery) return world.slot_data.mystery;
  }
  return null;
};

/** Every preset listed in preset_files.json whose rules carry a mystery block: found by the data, not by name. */
let cached = null;
function mysteryPresets() {
  if (cached) return cached;
  const index = JSON.parse(fs.readFileSync(path.join(PRESETS, 'preset_files.json'), 'utf8'));
  const found = [];
  for (const [game, entry] of Object.entries(index)) {
    for (const [folderName, folder] of Object.entries(entry?.folders ?? {})) {
      for (const file of folder?.files ?? []) {
        if (!String(file).endsWith('_rules.json')) continue;
        const full = path.join(PRESETS, game, folderName, file);
        if (!fs.existsSync(full)) continue;
        const text = fs.readFileSync(full, 'utf8');
        if (!text.includes('"mystery"')) continue;
        const block = mysteryBlockOf(JSON.parse(text));
        if (block) found.push({ file: path.relative(REPO, full), block });
      }
    }
  }
  cached = found;
  return found;
}

describe('the mystery game submodule and the committed mystery world are one version', () => {
  it('in CI the submodule is checked out', () => {
    if (process.env.CI) expect(gameIsCheckedOut, `${GAME_SUBMODULE_PATH} is not checked out`).toBe(true);
  });

  it('at least one committed preset is a mystery world', () => {
    expect(mysteryPresets().length).toBeGreaterThan(0);
  });

  it.skipIf(!gameIsCheckedOut)('each mystery preset\'s block equals the block the pinned game exports for that case', () => {
    for (const { file, block } of mysteryPresets()) {
      const caseDir = block.case ?? `cases/${block.story}`;
      const exported = path.join(GAME, caseDir, 'rules.json');
      expect(fs.existsSync(exported), `${file}: the pinned game has no ${caseDir}/rules.json`).toBe(true);
      const theirs = mysteryBlockOf(JSON.parse(fs.readFileSync(exported, 'utf8')));
      expect(block, `${file} against ${GAME_SUBMODULE_PATH}/${caseDir}/rules.json`).toEqual(theirs);
    }
  });

  it.skipIf(!gameIsCheckedOut)('the page the panel frames by default is in the pinned game', () => {
    expect(fs.existsSync(path.join(GAME, 'index.html'))).toBe(true);
  });
});
