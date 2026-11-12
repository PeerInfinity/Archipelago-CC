// ⛓ R-A5 — EVERY `Has` NAME IN A COMMITTED SEEDLING AP_1 RESOLVES to an item or a minted event. A rule naming an item that does
// not exist is silently STRICTER than the game (nothing can ever satisfy it), and before this pin nothing refused one: R-A5's
// predict arm wrote three (`pressCondition` named a multi-target press's event after the ruled lock, while the press mints ONE
// event named after its first lock). The check is `validateRules` (`apworldEditor/rulesUtils.js`), whose "references unknown
// item" issue covers exits, locations and every nested rule.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRules } from '../../frontend/modules/apworldEditor/rulesUtils.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRESETS = ['seedling_playthrough', 'seedling_playthrough_maze', 'seedling_er'];
const load = (p) => JSON.parse(readFileSync(join(REPO, 'frontend/presets', p, 'AP_1', 'AP_1_rules.json'), 'utf8'));
const unknownItems = (doc) => validateRules(doc, '1').filter((i) => /unknown item/.test(i.message)).map((i) => i.message);

describe('R-A5: every Has name in a Seedling AP_1 resolves', () => {
    for (const p of PRESETS) {
        it(`${p}: 0 "unknown item" references`, () => {
            expect(unknownItems(load(p))).toEqual([]);
        });
    }

    it('MUTANT: the predict arm\'s dangling spelling (a press event named after its SECOND lock) is caught by name', () => {
        const doc = load('seedling_playthrough');
        const exit = doc.regions['1'].level_40__r4c4.exits.find((e) => e.connected_region === 'level_40__r0c53');
        exit.access_rule = { rule: 'Or', children: [exit.access_rule, { rule: 'Has', args: { item_name: 'L40 flag 1: wandlock@176,208 cleared' } }] };
        expect(unknownItems(doc)).toEqual([
            'Exit "level_40__r4c4 -> level_40__r0c53" in "level_40__r4c4" references unknown item "L40 flag 1: wandlock@176,208 cleared".',
        ]);
    });
});
