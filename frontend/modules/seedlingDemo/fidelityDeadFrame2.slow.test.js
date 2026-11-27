/**
 * ⛓ SEEDLING FIDELITY DEADFRAME2 (wave 69), the slow half: EVERY committed tape (`fixtures/tapes/*.json` and
 * `fixtures/**\/*.tape.json`) ON vs OFF, with `freezeFramesStepResponders`, `pulserDeadFrameUpdate` and
 * `blockPressesFallRockButtonSameFrame` ON — alone, and with the base's last OFF keys ON beside them (the D3 measurement,
 * `tape-deadframe2.mjs`). The movers are exactly the seven a Pulser in a dead span moves (L38's and L39's, through a seal
 * piece, a rope's rock and a pickup's lump); a new one is a dead span the census did not see: explain it or STOP on it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures');
const VANILLA = atlasLevelSource();
const OFF = { freezeFramesStepResponders: false, pulserDeadFrameUpdate: false, blockPressesFallRockButtonSameFrame: false };
const ON = { freezeFramesStepResponders: true, pulserDeadFrameUpdate: true, blockPressesFallRockButtonSameFrame: true };
const LAST_OFF = { chestCoverFencepost: true, presserRecursionHang: true, publishedButtonRoomSetter: true, responderStepAfterReaders: true,
    deadFrameResponderStep: true, enemyPressesFallRockButton: true, wandShotTrapBodies: true, wandShotEnemyBodies: true, plainPickupInFreeze: true };
const MOVERS = ['hammer-d-ghostwall-witness/hammer-d-l39-ghostwall.tape.json', 'tapes/prox-l38-chest.json', 'tapes/prox-l38-reach-l39.json',
    'tapes/r5-shaft-control.json', 'tapes/r5-shaft.json', 'tapes/r5-totem-entrance-control.json', 'tapes/r5-totem-entrance.json'];
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const FILES = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const play = (tape, over) => withContactFidelity(over, () => {
    try { return { ok: runTape(tape, { levelSource: VANILLA }) }; } catch (e) { return { throw: `${e?.name}: ${e?.message}` }; }
});

describe('DEADFRAME2 — every committed tape, ON vs OFF', () => {
    for (const [arm, base] of [['alone', {}], ['beside the last OFF keys', LAST_OFF]]) {
        it(`only the Pulser's movers move, and only in its ledgers (${arm})`, () => {
            const movers = [];
            let n = 0;
            for (const p of FILES) {
                let tape;
                try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
                if (!tape?.inputs || !tape?.boot) continue;
                n += 1;
                const a = play(tape, { ...base, ...OFF });
                const b = play(tape, { ...base, ...ON });
                if (a.throw || b.throw) { if (a.throw !== b.throw) movers.push([relative(FIX, p), 'THROW']); continue; }
                const moved = Object.keys(a.ok).filter((k) => JSON.stringify(a.ok[k]) !== JSON.stringify(b.ok[k]));
                if (moved.length) movers.push([relative(FIX, p), moved.filter((k) => k !== 'pulserHits' && k !== 'spinnerWrites')]);
            }
            expect(n).toBeGreaterThan(300);
            expect(movers).toEqual(MOVERS.map((m) => [m, []]));
        }, 600000);
    }
});
