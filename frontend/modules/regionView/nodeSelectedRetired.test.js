/**
 * ⛓ CA-S5: `regionGraph:nodeSelected` and `regionMap:nodeSelected` are RETIRED (nothing in the app heard them; the
 * census is in `CC/docs/region-map/click-actions-s5.md`). The maps' only click events are `regionView:regionClicked`
 * / `regionView:locationClicked`. This source scan keeps the publishers, their registrations, their constants and
 * `regionActions.publishNodeSelected` from coming back in the map modules' APP files (the frozen `*.testkit.js`
 * oracles and the tests keep the base's name on purpose: they measure the retired channel).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['regionGraph', 'regionMap', 'regionView'];
const appFiles = DIRS.flatMap((d) => fs.readdirSync(path.join(MODULES, d))
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && !f.endsWith('.testkit.js'))
    .map((f) => path.join(d, f)));

describe('CA-S5: the maps publish no *:nodeSelected', () => {
    it('scans a real file set', () => {
        expect(appFiles).toEqual(expect.arrayContaining(['regionGraph/graphInteractionManager.js', 'regionGraph/index.js',
            'regionMap/regionMapClickActions.js', 'regionMap/index.js', 'regionView/regionActions.js']));
    });

    for (const f of appFiles) {
        it(f, () => {
            const src = fs.readFileSync(path.join(MODULES, f), 'utf8');
            expect(src).not.toMatch(/registerEventBusPublisher\(\s*['"`][^'"`]*:nodeSelected/);
            expect(src).not.toMatch(/publish\(\s*['"`][^'"`]*:nodeSelected/);
            expect(src).not.toMatch(/NODE_SELECTED/); // the constant, and a registration or publish through it
            expect(src).not.toMatch(/function publishNodeSelected|publishNodeSelected\(/);
        });
    }
});
