/**
 * ⛓ QUICK LAUNCH P8 — **THE GATES' PANEL CONSTANTS ARE THE MODULES' OWN
 * `componentType`s.** A gate finds a tab through `seedlingRoomPlay.js`'s
 * `findPanelTab` / `clickPanelTab` by componentType (trap 1433: a display
 * title is a gate key). A constant that drifts from its module's
 * `moduleInfo.componentType` finds no tab, and every gate using it reds on the
 * box only — so each one is read back off the module's source here. Text, not
 * an import: the module index files pull in the whole frontend.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as hands from './seedlingRoomPlay.js';

const REPO = join(import.meta.dirname, '..', '..');

const PANELS = {
    FLASH_PANEL: 'flashPanel',
    MAZE_ROOM_PANEL: 'mazeRoom',
    PROCGEN_PIPELINE_PANEL: 'procgenPipeline',
    PRESETS_PANEL: 'presets',
    REGION_MARKING_TOOL_PANEL: 'regionMarkingTool',
    APWORLD_EDITOR_PANEL: 'apworldEditor',
};

/** The module's componentType: a string literal, or a same-file `export const NAME = '…'`. */
function componentTypeOf(dir) {
    const src = readFileSync(join(REPO, 'frontend/modules', dir, 'index.js'), 'utf8');
    const m = src.match(/^\s*componentType:\s*(?:'([^']+)'|([A-Z_][A-Z0-9_]*))\s*,/m);
    if (!m) throw new Error(`${dir}/index.js: no moduleInfo componentType`);
    if (m[1]) return m[1];
    const c = src.match(new RegExp(`^export const ${m[2]} = '([^']+)';`, 'm'));
    if (!c) throw new Error(`${dir}/index.js: componentType ${m[2]} is not a same-file string constant`);
    return c[1];
}

describe('seedlingRoomPlay panel constants', () => {
    it.each(Object.entries(PANELS))('%s is %s\'s moduleInfo.componentType', (name, dir) => {
        expect(hands[name]).toBe(componentTypeOf(dir));
    });

    it('every exported *_PANEL constant is pinned above', () => {
        const exported = Object.keys(hands).filter((k) => /_PANEL$/.test(k)).sort();
        expect(exported).toEqual(Object.keys(PANELS).sort());
    });
});
