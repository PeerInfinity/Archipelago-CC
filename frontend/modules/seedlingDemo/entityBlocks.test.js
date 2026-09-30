/**
 * entityBlocks — the P3 labels against the vocabulary, the census, the run's
 * families and the solver's reads (behaviour parameters P3).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BLOCKS } from '../procgenCore/behaviourBlocks.js';
import { ENEMY_CLASSES, PUZZLEMENT_HAZARDS } from './combat.js';
import {
    AGGRO_KIND_BLOCKS, ENTITY_BLOCKS, EntityBlocksError, assertEntityBlocks, entityBlocksOf,
} from './entityBlocks.js';
import {
    FAMILY_ENTRIES, SIM_ENTRY, importClosure, parseSource, staticImports,
} from '../../../scripts/procgen/seedlingSolverSurface.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SELF = 'frontend/modules/seedlingDemo/entityBlocks.js';
const DEMO = 'frontend/modules/seedlingDemo/';
const sorted = (xs) => [...xs].sort();

describe('D1 — ENTITY_BLOCKS: one row per census tag, every id declared', () => {
    it('covers ENEMY_CLASSES and PUZZLEMENT_HAZARDS exactly, one row each', () => {
        const rows = (source) => ENTITY_BLOCKS.filter((r) => r.source === source).map((r) => r.tag);
        expect(sorted(rows('enemy'))).toEqual(sorted(Object.keys(ENEMY_CLASSES)));
        expect(sorted(rows('hazard'))).toEqual(sorted(Object.keys(PUZZLEMENT_HAZARDS)));
        expect(new Set(ENTITY_BLOCKS.map((r) => `${r.source}:${r.tag}`)).size).toBe(ENTITY_BLOCKS.length);
    });

    it('every block id resolves in BLOCKS, and no bespoke name is a declared id', () => {
        for (const r of ENTITY_BLOCKS) {
            for (const id of r.blocks) expect(BLOCKS.has(id), `${r.tag} → ${id}`).toBe(true);
            for (const b of r.bespoke) expect(BLOCKS.has(b), `${r.tag} bespoke ${b}`).toBe(false);
        }
    });

    it('the unique rows are exactly the classes whose aggro word is a script (boss, spawner)', () => {
        const unique = ENTITY_BLOCKS.filter((r) => r.unique).map((r) => r.tag);
        const scripts = Object.entries(ENEMY_CLASSES)
            .filter(([, c]) => AGGRO_KIND_BLOCKS[c.aggro.kind] === null).map(([t]) => t);
        expect(sorted(unique)).toEqual(sorted(scripts));
        for (const r of ENTITY_BLOCKS.filter((x) => x.unique)) expect(r.blocks).toEqual([]);
    });

    it('AGGRO_KIND_BLOCKS is total over the words the census uses and names only movement blocks', () => {
        const words = new Set(Object.values(ENEMY_CLASSES).map((c) => c.aggro.kind));
        expect(sorted(Object.keys(AGGRO_KIND_BLOCKS))).toEqual(sorted(words));
        for (const [w, id] of Object.entries(AGGRO_KIND_BLOCKS)) {
            if (id === null) continue;
            expect(BLOCKS.get(id)?.family, w).toBe('movement');
        }
    });

    it('each enemy row\'s movement block is its aggro word\'s block, or the row says why not', () => {
        for (const [tag, c] of Object.entries(ENEMY_CLASSES)) {
            const r = entityBlocksOf(tag);
            const moves = r.blocks.filter((id) => BLOCKS.get(id).family === 'movement');
            const want = AGGRO_KIND_BLOCKS[c.aggro.kind];
            if (want === null) expect(moves, tag).toEqual([]);
            else expect(moves, tag).toContain(want);
            if (!(want === null ? moves.length === 0 : moves.length === 1)) {
                expect(typeof r.aggroNote, `${tag} needs an aggroNote`).toBe('string');
            }
        }
    });

    it('the rows are frozen', () => {
        expect(Object.isFrozen(ENTITY_BLOCKS)).toBe(true);
        expect(Object.isFrozen(ENTITY_BLOCKS[0])).toBe(true);
        expect(Object.isFrozen(ENTITY_BLOCKS[0].blocks)).toBe(true);
    });

    it('MUTANT (a): a row naming an undeclared block is refused, naming the tag and the id', () => {
        const rows = ENTITY_BLOCKS.map((r) => (r.tag === 'bob' ? { ...r, blocks: [...r.blocks, 'orbit'] } : r));
        expect(() => assertEntityBlocks(rows)).toThrow(EntityBlocksError);
        expect(() => assertEntityBlocks(rows)).toThrow(/row "bob" names the block "orbit"/);
    });

    it('MUTANT (b): AGGRO_KIND_BLOCKS without "static-tongue" is refused, naming the word and the tag', () => {
        const aggro = { ...AGGRO_KIND_BLOCKS };
        delete aggro['static-tongue'];
        expect(() => assertEntityBlocks(ENTITY_BLOCKS, { aggro }))
            .toThrow(/aggro word "static-tongue" \(used by "lavatrap"\) has no AGGRO_KIND_BLOCKS row/);
    });

    it('refuses the other shapes by name', () => {
        const swap = (tag, patch) => ENTITY_BLOCKS.map((r) => (r.tag === tag ? { ...r, ...patch } : r));
        expect(() => assertEntityBlocks(swap('bob', { blocks: ['stationary', 'contact'] })))
            .toThrow(/row "bob" moves by \[stationary\] but its aggro word "chase" denotes "chase"/);
        expect(() => assertEntityBlocks(swap('bob', { bespoke: ['chase'] })))
            .toThrow(/row "bob" files "chase" as bespoke, but BLOCKS declares it/);
        expect(() => assertEntityBlocks(swap('shieldboss', { blocks: ['hp'] })))
            .toThrow(/row "shieldboss" is unique and still names blocks \[hp\]/);
        expect(() => assertEntityBlocks(ENTITY_BLOCKS.filter((r) => r.tag !== 'pull')))
            .toThrow(/the census tag "pull" \(hazard\) has no row/);
        expect(() => assertEntityBlocks([...ENTITY_BLOCKS, { ...ENTITY_BLOCKS[0], tag: 'orbiter' }]))
            .toThrow(/row "orbiter" names a tag ENEMY_CLASSES does not hold/);
    });
});

describe('D1 — the module stays out of the model and the solver', () => {
    it('is in neither the simulation closure nor the solver-family closure', () => {
        expect(importClosure([SIM_ENTRY], read)).not.toContain(SELF);
        expect(importClosure(FAMILY_ENTRIES, read)).not.toContain(SELF);
    });

    it('imports the vocabulary and combat.js, and nothing else', () => {
        const specs = staticImports(parseSource(read(SELF))).map((s) => s.spec);
        expect(sorted(specs)).toEqual(['../procgenCore/behaviourBlocks.js', './combat.js']);
    });

    it('is imported by nothing but its own test', () => {
        const files = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.js', '*.mjs', '*.cjs', '*.html'], { cwd: ROOT, encoding: 'utf8' })
            .stdout.split('\n').filter(Boolean);
        const importers = files.filter((f) => fs.existsSync(path.join(ROOT, f))
            && /(?:from|import)\s*\(?\s*['"][^'"]*\/entityBlocks\.js['"]/.test(read(f)));
        expect(importers).toEqual([`${DEMO}entityBlocks.test.js`]);
    });

    it('loads in isolation', () => {
        const r = spawnSync(process.execPath, ['-e', `import('./${SELF}').then((m) => console.log(m.ENTITY_BLOCKS.length))`],
            { cwd: ROOT, encoding: 'utf8' });
        expect(r.stderr).toBe('');
        expect(r.stdout.trim()).toBe(String(ENTITY_BLOCKS.length));
    });
});
