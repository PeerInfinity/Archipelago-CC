import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    PACKAGE_FILES, WIRING_FILE, firstDifference, pairings, sameJson, wiringCopies,
} from './check-worldgen-package-sidecars.mjs';

const fixtures = [];
afterAll(() => fixtures.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

/** A minimal repo on disk: one package of game `Pkg Game`, one preset of it, the wiring file. */
function fixtureRepo({ packageBlock, presetBlock, wiring, extraPreset }) {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-sidecars-'));
    fixtures.push(repo);
    const write = (rel, value) => {
        fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
        fs.writeFileSync(path.join(repo, rel), JSON.stringify(value));
    };
    write('worlds/pkg/archipelago.json', { game: 'Pkg Game' });
    write('worlds/pkg/_worldgen_flash_panel.json', packageBlock);
    write('frontend/presets/pkg/AP_1/AP_1_rules.json', { flash_panel: { 1: presetBlock } });
    if (extraPreset) write('frontend/presets/other/AP_1/AP_1_rules.json', { flash_panel: { 2: extraPreset } });
    write('frontend/presets/preset_files.json', {
        pkg: { folders: { AP_1: { files: ['AP_1_rules.json'], games: [{ player: 1, game: 'Pkg Game' }] } } },
    });
    write(WIRING_FILE, wiring);
    return repo;
}

const WIRED = { config: 'seedling.json', wasm: 'build_a/game.html' };

describe('check-worldgen-package-sidecars — the packages carry what their presets carry', () => {
    it('sameJson ignores key order, nothing else', () => {
        expect(sameJson({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
        expect(sameJson({ exits: [{ side: 'E' }] }, { exits: [{ side: 'E', x: 4, y: 5 }] })).toBe(false);
        expect(sameJson([1, 2], [2, 1])).toBe(false);
    });

    it('firstDifference names the path — an exit tile the package still carries', () => {
        expect(firstDifference({ r: { exits: [{ side: 'E' }] } }, { r: { exits: [{ side: 'E', x: 4 }] } }))
            .toBe('.r.exits.0.x only in the package');
        expect(firstDifference({ a: 1 }, { a: 1 })).toBeNull();
    });

    it('⛓⛓ the real tree: every package/preset pair is equal, and the pairing finds the multiworld slots', () => {
        const { pairs } = pairings();
        expect(pairs.length).toBeGreaterThanOrEqual(11);
        expect(pairs.filter((p) => !sameJson(p.presetBlock, p.packageBlock)).map((p) => `${p.pkg} ${p.doc} ${p.slot}`))
            .toEqual([]);
        // ⛓ + `seedling_playthrough` since rules-playthrough-blocks (2026-10-14): its seed-1
        //   export now carries the package's sidecars (the handler re-injects by presence,
        //   not by the `_worldgen` suffix); before, it was "not compared".
        expect(new Set(pairs.map((p) => p.pkg))).toEqual(new Set(['bounce_worldgen', 'procgen_maze_worldgen',
            'runner_sphere_worldgen', 'runner_worldgen', 'seedling_playthrough']));
    });

    it('⛓ the real tree: the page-block package files equal their presets\' slot blocks (rules-produced-blocks)', () => {
        for (const { key, file } of PACKAGE_FILES.filter((f) => f.key !== 'preset_sidecars')) {
            const { pairs } = pairings({ key, file });
            expect(pairs.map((p) => `${p.pkg} ${p.doc} ${p.slot}`), file).toEqual([
                'seedling_playthrough frontend/presets/seedling_playthrough/AP_14089154938208861744/'
                + 'AP_14089154938208861744_rules.json 1',
            ]);
            expect(pairs.every((p) => sameJson(p.presetBlock, p.packageBlock)), file).toBe(true);
        }
    });

    it('⛓⛓ the real tree: every Seedling flash_panel copy equals the shared wiring; robotkitty is the one hand-kept block', () => {
        const { copies, handKept, missing } = wiringCopies();
        expect(missing).toEqual([]);
        expect(copies.filter((c) => !sameJson(c.block, c.wiring)).map((c) => c.where)).toEqual([]);
        const where = copies.map((c) => c.where);
        // The exporter-produced seed-1 block, the package copy, and the JS-produced presets.
        expect(where).toContain('frontend/presets/seedling/AP_14089154938208861744/AP_14089154938208861744_rules.json');
        expect(where).toContain('worlds/seedling_playthrough/_worldgen_flash_panel.json');
        expect(where).toContain('frontend/presets/seedling_atlas/AP_1/AP_1_rules.json');
        expect(copies.length).toBeGreaterThanOrEqual(13);
        expect(handKept.map((h) => h.where)).toEqual([
            'frontend/presets/robotkitty_tilemap/AP_14089154938208861744/AP_14089154938208861744_rules.json',
        ]);
    });

    it('mutants: a stale package file, a stale preset copy and a moved wiring are each named', () => {
        const stale = { ...WIRED, wasm: 'build_old/game.html' };
        // the package file lags its preset AND the wiring
        let repo = fixtureRepo({ packageBlock: stale, presetBlock: WIRED, wiring: { seedling: WIRED } });
        let pair = pairings({ repo, key: 'flash_panel', file: '_worldgen_flash_panel.json' }).pairs[0];
        expect(firstDifference(pair.presetBlock, pair.packageBlock)).toBe('.wasm differs');
        let copies = wiringCopies({ repo }).copies;
        expect(copies.filter((c) => !sameJson(c.block, c.wiring)).map((c) => c.where))
            .toEqual(['worlds/pkg/_worldgen_flash_panel.json']);
        // one preset copy (outside any package's game) lags the wiring
        repo = fixtureRepo({ packageBlock: WIRED, presetBlock: WIRED, wiring: { seedling: WIRED }, extraPreset: stale });
        copies = wiringCopies({ repo }).copies;
        expect(copies.filter((c) => !sameJson(c.block, c.wiring)).map((c) => `${c.where} ${c.slot}`))
            .toEqual(['frontend/presets/other/AP_1/AP_1_rules.json 2']);
        // the wiring moved and nothing followed it: every copy is named
        repo = fixtureRepo({ packageBlock: WIRED, presetBlock: WIRED, wiring: { seedling: stale } });
        copies = wiringCopies({ repo }).copies;
        expect(copies.filter((c) => !sameJson(c.block, c.wiring)).length).toBe(2);
        // a wired game with no copy at all is a vacuous pass, so it is reported
        repo = fixtureRepo({ packageBlock: WIRED, presetBlock: WIRED, wiring: { seedling: WIRED, other: { config: 'x.json' } } });
        expect(wiringCopies({ repo }).missing).toEqual(['other']);
    });
});
