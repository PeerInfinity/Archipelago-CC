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
import { ACTIVATOR_RESPONDERS, PUSHABLE_FAMILIES } from './levelWorld.js';
import { ENTITY_FAMILY_NAMES } from './levelRun.js';
import { OBSTACLE_STRATEGIES } from './solverBot.js';
import {
    AGGRO_KIND_BLOCKS, ENTITY_BLOCKS, FAMILY_BLOCKS, EntityBlocksError, assertEntityBlocks,
    blocksNoFamilyModels, blocksOnlyAvoided, blocksTheSolverModels, certifiableBlocks,
    entityBlocksOf, modellingFamilies,
} from './entityBlocks.js';
import {
    FAMILY_ENTRIES, SIM_ENTRY, importClosure, parseSource, staticImports,
} from '../../../scripts/procgen/seedlingSolverSurface.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SELF = 'frontend/modules/seedlingDemo/entityBlocks.js';
const DEMO = 'frontend/modules/seedlingDemo/';
const SURFACE = JSON.parse(read('scripts/procgen/seedling-solver-surface.json'));
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

describe('D2 — FAMILY_BLOCKS: the run\'s families and the hazard volumes', () => {
    const entityRows = FAMILY_BLOCKS.filter((f) => f.kind === 'entities');
    const volumeRows = FAMILY_BLOCKS.filter((f) => f.kind === 'volume');
    const familyFiles = SURFACE.family;

    it('one row per ENTITY_FAMILY_NAMES entry, in its order, and nothing else', () => {
        expect(entityRows.map((f) => f.family)).toEqual([...ENTITY_FAMILY_NAMES]);
        expect(SURFACE.folded.entities).toEqual([...ENTITY_FAMILY_NAMES]);
    });

    it('one row per hazardVolume arm, and the arms are PUZZLEMENT_HAZARDS', () => {
        const src = read(`${DEMO}hazards.js`);
        const body = src.slice(src.indexOf('export function hazardVolume('), src.indexOf('export function volumeHitsBox('));
        const arms = [...body.matchAll(/case '([a-z]+)':/g)].map((m) => m[1]);
        expect(volumeRows.map((f) => f.family)).toEqual(arms.map((t) => `volume:${t}`));
        expect(sorted(arms)).toEqual(sorted(Object.keys(PUZZLEMENT_HAZARDS)));
    });

    it('an entity family\'s solverReads is the surface table\'s `families` column', () => {
        const col = SURFACE.rows.find((r) => r.surface === 'run' && r.name === 'entities').families;
        for (const f of entityRows) {
            expect(f.solverReads, f.family).toEqual(sorted(Object.keys(col[f.family] ?? {}).map((x) => x.replace(/\.js$/, ''))));
        }
    });

    it('…and a grep of `entities(\'<family>\')` over the family files finds the same files', () => {
        for (const f of entityRows) {
            const re = new RegExp(`entities\\(\\s*'${f.family}'\\s*\\)`);
            const hits = familyFiles.filter((file) => re.test(read(`${DEMO}${file}`))).map((x) => x.replace(/\.js$/, ''));
            expect(sorted(hits), f.family).toEqual(f.solverReads);
        }
    });

    it('a volume\'s solverReads is the family files that call hazardVolume, minus dangerMap where it prices the tag live', () => {
        const callers = familyFiles.filter((file) => file !== 'hazards.js' && read(`${DEMO}${file}`).includes('hazardVolume('))
            .map((x) => x.replace(/\.js$/, ''));
        expect(callers).toEqual(['dangerMap', 'encounters']);
        const dm = read(`${DEMO}dangerMap.js`);
        const liveBlock = dm.slice(dm.indexOf('export const HAZARDS_PRICED_LIVE'), dm.indexOf('export function hazardDanger('));
        const live = [...liveBlock.matchAll(/^ {4}([a-z]+): Object\.freeze\(/gm)].map((m) => m[1]);
        expect(sorted(live)).toEqual(['arrowtrap', 'crusher']);
        for (const f of volumeRows) {
            const tag = f.family.slice('volume:'.length);
            expect(f.solverReads, f.family).toEqual(callers.filter((c) => !(c === 'dangerMap' && live.includes(tag))));
        }
    });

    it('strategies are the OBSTACLE_STRATEGIES verbs of the tags each family holds', () => {
        const tagsOf = {
            openActivators: [...ACTIVATOR_RESPONDERS],
            pushables: Object.keys(PUSHABLE_FAMILIES),
            openChests: ['chest'],
            brokenRocks: ['breakablerock', 'breakablerockghost'],
        };
        for (const f of FAMILY_BLOCKS) {
            const tags = tagsOf[f.family] ?? [];
            const verbs = new Set(tags.flatMap((t) => [OBSTACLE_STRATEGIES[`solid:${t}`], OBSTACLE_STRATEGIES[`proximity-hazard:${t}`]])
                .filter(Boolean));
            expect(f.strategies, f.family).toEqual(sorted(verbs));
        }
    });

    it('every family block id is declared, and every row says why', () => {
        for (const f of FAMILY_BLOCKS) {
            for (const id of f.blocks) expect(BLOCKS.has(id), `${f.family} → ${id}`).toBe(true);
            expect(f.why.length, f.family).toBeGreaterThan(0);
        }
    });

    it('a family realises only blocks some census class it holds realises', () => {
        const holds = {
            armedArrowTraps: ['arrowtrap'], crushers: ['crusher'], crushersParked: ['crusher'],
            strikeBodies: ['bob'], chasers: ['bob'], spinnerBodies: ['spinner'], armedPulsers: ['pulser'],
            turrets: ['iceturret'], turretDamage: ['iceturret'], turretsSettled: ['iceturret'],
            arrowsInFlight: ['arrowtrap'], arrowFlights: ['arrowtrap'], bosses: ['bosstotem'],
        };
        for (const f of FAMILY_BLOCKS) {
            const tags = f.kind === 'volume' ? [f.family.slice('volume:'.length)] : holds[f.family];
            if (!tags) continue;
            const union = new Set(tags.flatMap((t) => entityBlocksOf(t).blocks));
            for (const id of f.blocks) expect(union.has(id), `${f.family} → ${id} (holds ${tags})`).toBe(true);
        }
    });

    it('the derived lists partition BLOCKS; avoided-only is a subset of unmodelled', () => {
        const modelled = blocksTheSolverModels();
        const none = blocksNoFamilyModels();
        expect(sorted([...modelled, ...none])).toEqual(sorted(BLOCKS.ids()));
        expect(modelled.filter((id) => none.includes(id))).toEqual([]);
        for (const id of blocksOnlyAvoided()) expect(none).toContain(id);
        for (const [id, fams] of modellingFamilies()) {
            for (const fam of fams) expect(FAMILY_BLOCKS.find((f) => f.family === fam).kind, `${id} via ${fam}`).toBe('entities');
        }
    });
});

describe('D3 — certifiability as a lookup', () => {
    it('a realisation whose blocks are all modelled', () => {
        expect(certifiableBlocks({ chase: { speed: 0.5 }, contact: { damage: 1 } }))
            .toEqual({ modelled: ['chase', 'contact'], unmodelled: [], avoidedOnly: [] });
    });

    it('an unmodelled block — tether is priced only as an avoid volume', () => {
        expect(certifiableBlocks({ tether: { length: 3 } }))
            .toEqual({ modelled: [], unmodelled: ['tether'], avoidedOnly: ['tether'] });
    });

    it('rebound is modelled, through spinnerBodies', () => {
        expect(certifiableBlocks({ rebound: {} }).modelled).toEqual(['rebound']);
        expect(modellingFamilies().get('rebound')).toEqual(['spinnerBodies']);
    });

    it('a mixed realisation keeps its key order and splits', () => {
        expect(certifiableBlocks({ stomp: {}, hp: {}, beam: {} }))
            .toEqual({ modelled: ['hp'], unmodelled: ['stomp', 'beam'], avoidedOnly: ['beam'] });
    });

    it('refuses an undeclared id and a non-object', () => {
        expect(() => certifiableBlocks({ orbit: {} })).toThrow(/"orbit" is not a block behaviourBlocks.BLOCKS declares/);
        expect(() => certifiableBlocks(['chase'])).toThrow(EntityBlocksError);
        expect(() => certifiableBlocks(null)).toThrow(EntityBlocksError);
    });
});

describe('D4 — the doc section is pinned to the tables', () => {
    const doc = read('docs/json/developer/procgen/seedling-solver-surface.md');
    const start = doc.indexOf('## Which blocks the solver models');
    const section = doc.slice(start, doc.indexOf('\n## ', start + 1));
    const ticks = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const para = (label) => section.slice(section.indexOf(`**${label}.**`)).split('\n')[0];
    const withFamilies = (text) => new Map([...text.matchAll(/`([a-z-]+)` \(([^)]*)\)/gi)]
        .map((m) => [m[1], ticks(m[2])]));

    it('the section exists', () => {
        expect(start).toBeGreaterThan(0);
    });

    it('its family table is FAMILY_BLOCKS, row for row', () => {
        const rows = section.split('\n').filter((l) => /^\| `/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
        expect(rows.map((r) => ticks(r[0])[0])).toEqual(FAMILY_BLOCKS.map((f) => f.family));
        for (const [i, f] of FAMILY_BLOCKS.entries()) {
            expect(ticks(rows[i][1]), f.family).toEqual(f.blocks);
            expect(ticks(rows[i][2]), f.family).toEqual(f.solverReads);
        }
    });

    it('its three lists are the derived lists, with the families behind each', () => {
        expect(withFamilies(para('Modelled'))).toEqual(new Map(blocksTheSolverModels().map((id) => [id, modellingFamilies().get(id)])));
        const avoid = modellingFamilies({ depth: 'avoid' });
        expect(withFamilies(para('Only avoided'))).toEqual(new Map(blocksOnlyAvoided().map((id) => [id, avoid.get(id)])));
        const notModelled = para('Not modelled');
        expect(ticks(notModelled.slice(notModelled.lastIndexOf(':'))))
            .toEqual(blocksNoFamilyModels().filter((id) => !blocksOnlyAvoided().includes(id)));
    });
});
