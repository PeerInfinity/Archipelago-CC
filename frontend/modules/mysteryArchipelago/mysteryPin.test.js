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

  // A case is exported one of two ways (the page reads its version the same way): a case with visits in the present
  // as `<case>/visits.json` (scripts/export-visits.mjs: the visits, the papers, the goal; an ActionNodes world is
  // made from it), any other as `<case>/rules.json` (a whole mystery world's rules, whose block is the world's).
  const exportOf = (block) => {
    const caseDir = block.case ?? `cases/${block.story}`;
    const visits = path.join(GAME, caseDir, 'visits.json');
    if (fs.existsSync(visits)) return { kind: 'visits', caseDir, file: visits };
    return { kind: 'rules', caseDir, file: path.join(GAME, caseDir, 'rules.json') };
  };

  it.skipIf(!gameIsCheckedOut)('each mystery preset\'s block equals the block the pinned game exports for that case', () => {
    for (const { file, block } of mysteryPresets().filter((p) => exportOf(p.block).kind === 'rules')) {
      const { caseDir, file: exported } = exportOf(block);
      expect(fs.existsSync(exported), `${file}: the pinned game has no ${caseDir}/rules.json nor visits.json`).toBe(true);
      const theirs = mysteryBlockOf(JSON.parse(fs.readFileSync(exported, 'utf8')));
      expect(block, `${file} against ${GAME_SUBMODULE_PATH}/${caseDir}/rules.json`).toEqual(theirs);
    }
  });

  // ⛓ The PAIR: the page at the pin refuses a slot of another version, so a gitlink move past a change of a visit
  // case and the world's `slot_data.mystery.version` move together, or this is red.
  it.skipIf(!gameIsCheckedOut)('each preset made from a visit case carries that case\'s story, case, version, goal and papers at the pin', () => {
    const visitPresets = mysteryPresets().filter((p) => exportOf(p.block).kind === 'visits');
    expect(visitPresets.length, 'no committed preset is made from a visit case').toBeGreaterThan(0);
    for (const { file, block } of visitPresets) {
      const { caseDir, file: exported } = exportOf(block);
      const theirs = JSON.parse(fs.readFileSync(exported, 'utf8'));
      const where = `${file} against ${GAME_SUBMODULE_PATH}/${caseDir}/visits.json`;
      expect({ story: block.story, case: block.case, version: block.version }, where)
        .toEqual({ story: theirs.story, case: theirs.case, version: theirs.version });
      expect(block.goal, where).toBe(theirs.goal.question);
      // Every paper the world maps is one of the case's, and every paper of the case is mapped.
      const casePapers = theirs.visits.map((v) => v.paper.id).sort();
      expect(Object.values(block.items).sort(), where).toEqual(casePapers);
      // Every question the world maps is one of the case's.
      const caseQuestions = new Set([theirs.goal.question, ...(theirs.questions ?? []).map((q) => q.id)]);
      for (const q of Object.values(block.locations)) expect(caseQuestions.has(q), `${where}: question ${q}`).toBe(true);
    }
  });

  it.skipIf(!gameIsCheckedOut)('the page the panel frames by default is in the pinned game', () => {
    expect(fs.existsSync(path.join(GAME, 'index.html'))).toBe(true);
  });
});
