/**
 * ⛓ DELIVERY DEFERRAL — a continuation boots the spawn pair the host CONTINUES on.
 *
 * `Bot.botStart` builds a new world unless the tape's boot is `Main.playerPositionX/Y` (`atBootPosition`,
 * `Bot.as:1950`), the spawn the current `Game` was built at. L32's `FallRockLarge` rewrites it to (72, 104)
 * mid-visit, so a continuation that booted the room's arrival (64, 112) after the rock fell REBUILT the room:
 * measured on logical-links B (the exit continuation `wasm-continue-exit-32` replaced by a `wasm-hold-32` of the
 * rebuilt room 242 ms later, the exit leg then recorded done in L32). The model keeps the pair (`worldCtor`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bootAtCtor, ctorMismatch } from './wasmPlayback.js';
import { createRunForStaging, runTape, stagingFromTape } from './tapeRunner.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(readJson('frontend/modules/flashPanel/atlases/seedling-map.json')));
// The live arrival into the Bob arena (boot 64,112), walked in until the rock has fallen behind the player.
const ARENA_WALK = readJson('frontend/modules/seedlingDemo/fixtures/tapes/enc-l32-live-arrival.json');

describe('⛓ DELIVERY DEFERRAL — the continuation boot is the shadow\'s spawn pair (`worldCtor`)', () => {
    it('L32: the arrival boots (64,112); after the rock falls the model\'s pair is the respawn (72,104), and that is the boot', () => {
        const staging = stagingFromTape(ARENA_WALK);
        const run = createRunForStaging(staging, SRC);
        expect(run.worldCtor).toEqual({ x: 64, y: 112 });
        runTape(ARENA_WALK, { levelSource: SRC, run });
        expect(run.level).toBe(32);
        expect(run.worldCtor).toEqual({ x: 72, y: 104 });
        const booted = bootAtCtor(staging, run.worldCtor);
        expect(booted.boot).toEqual({ ...staging.boot, x: 72, y: 104 });
        expect(staging.boot).toMatchObject({ x: 64, y: 112 }); // never mutated
    });

    it('a room whose spawn was not rewritten keeps its own staging object (the tape is byte-identical)', () => {
        const staging = stagingFromTape(ARENA_WALK);
        expect(bootAtCtor(staging, { x: staging.boot.x, y: staging.boot.y })).toBe(staging);
        expect(bootAtCtor(staging, null)).toBe(staging);
    });

    it('ctorMismatch: the game\'s `Main.playerPosition` against the shadow\'s pair — equal → null; rewritten in one only → named', () => {
        expect(ctorMismatch({ x: 72, y: 104 }, { playerPositionX: 72, playerPositionY: 104 })).toBeNull();
        expect(ctorMismatch({ x: 64, y: 112 }, { playerPositionX: 72, playerPositionY: 104 }))
            .toEqual({ expected: { x: 64, y: 112 }, got: { x: 72, y: 104 } });
        expect(ctorMismatch(null, {})).toBeNull();
    });
});
