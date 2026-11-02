// MEASUREMENT ONLY: fold a slot-latch --keys-out dump onto the latch boot (`fidelityL40Latch.l40LatchTape`) and replay
// it through the model (`createTapeStepper`): the player's hits, the run's Fire press ticks, and the dead corpse's
// tile each time it changes. Usage: node slot-replay-tape.mjs <keys.json> [--arm=lweigh|ta]
import { readFileSync } from 'node:fs';
const ROOT = process.env.SLOT_ROOT ?? '/home/user/Archipelago-CC';
const D = ROOT + '/frontend/modules/seedlingDemo/';
const L = await import(D + 'fidelityL40Latch.js');
const { parseTape } = await import(D + 'tapeFormat.js');
const { createTapeStepper } = await import(D + 'tapeRunner.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { withContactFidelity } = await import(D + 'contactFidelity.js');
const dump = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const arm = (process.argv.find((a) => a.startsWith('--arm=')) ?? '--arm=ta').slice(6);
const over = arm === 'lweigh' ? { turretSnapPricing: false, orbitFreeAim: true, strategyBoundDistinct: true } : {};
const boot = await L.l40LatchBoot();
const tape = await L.l40LatchTape('slot', dump.keys.map((k) => (k ? k.split('+') : [])),
    { equips: [...(boot.equips ?? []), ...(dump.equips ?? [])] });
let run = null;
const st = withContactFidelity(over, () => createTapeStepper(parseTape(JSON.stringify(tape)),
    { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } }));
let err = null;
const tiles = [];
try {
    for (let r = st.next(); !r.done; r = st.next()) {
        const k = run.entities('turrets').get('iceturret@472,400');
        const tile = k ? `${Math.floor(k.x / 16)},${Math.floor(k.y / 16)}` : null;
        if (k?.dead && tiles.at(-1)?.[1] !== tile) tiles.push([run.ticksCompleted, tile, k.y]);
    }
} catch (e) { err = e.message.slice(0, 300); }
const c = run.entities('turrets').get('iceturret@472,400');
const firePresses = [...new Set(run.ledger('presses').filter((p) => p.weapon === 'fire').map((p) => p.t))];
console.log(JSON.stringify({ file: process.argv[2].split('/').pop(), ticks: dump.keys.length, err, t: run.ticksCompleted,
    playerHits: run.ledger('playerHits').map((h) => [h.t, h.id ?? h.source]),
    firePresses, corpseTiles: tiles, corpse: c ? [Math.floor(c.x / 16), Math.floor(c.y / 16), c.dead] : null }));
