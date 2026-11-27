// wave 69 (DEADFRAME2) D1: the owed witnesses, staged as waves 64-66 stage (the vanilla L38 stripped to its teleporters
// and `lightalpha`, the shape's entities added; level data through `botLoadLevels`, its own `set_id`). Re-uses wave
// 64's `shapeTape`, `stagedRecord` and `replay`. L = `lock` tag 20: `persistence_cleared` ∋ (38,20) is its type
// ("" = open). A FallRock writes (38,22) on `fall()`. A fire block's position is on every `botMobiles` row.
//   p-key       (b) a Pulser (`pulser@112,48`) latched from the boot (group 5) cycles through a TEXT-LESS pickup lump:
//               the player boots on the latch, walks right onto a `bosskey keyType 1` (150 dead frames) and on into
//               the Pulser's ring (out of its reach until then: no dead-frame hit reaches a target). The tick of the
//               player's first pulse hit (`hits`, and the knockback in the stream) is the Pulser's phase.
//   p-health    the same with a TEXTED pickup (`health`: 149 dead frames, then the dialogue's frozen ticks).
//   p-ctl       control: no pickup (the phase with no dead frames).
//   p-span      (b) the same Pulser through a BUTTON-DROPPED rock's span (`button@64,48` → `fallrock@192,32`, group 7).
//   s-seal      (a) a seal piece's ceremony: the player boots on a latch (`buttonroom@64,48`, group 5) whose L
//               (`lock@112,48`) is open on frame 102, and walks up into `chest@64,32` (`Chest.update` opens on the
//               line under it); its SealPiece meets the player (150 + 181 dead frames).
//   b-rock      (d) a block on a FallRock's Button: the player pushes `pushableblock@64,48` right onto `button@96,48`
//               (group 7) of `fallrock@192,32`. The frame the rock falls, the game against the model.
const S = await import(new URL('../../seedling-fidelity-readerorder-evidence/tools/stage.mjs', import.meta.url).pathname);
export const { LEVEL, L_TAG, stagedRecord, shapeTape, replay } = S;
export const ROCK_TAG = 22;
const lock = (x, y, t, tag) => ({ type: 'lock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const latch = (x, y, t, tag) => ({ type: 'buttonroom', x, y, attrs: { tset: String(t), tag: String(tag), flip: '0', room: '-1' } });
const button = (x, y, t) => ({ type: 'button', x, y, attrs: { tset: String(t) } });
const rock = (x, y, t, tag) => ({ type: 'fallrock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const pulser = (x, y, t) => ({ type: 'pulser', x, y, attrs: { tset: String(t) } });
export const RESP_ID = (s) => (s.base.resp ? `${s.base.resp.tag}@${s.base.resp.x},${s.base.resp.y}` : null);
const PULSE = [latch(32, 48, 5, 21), pulser(112, 48, 5)];
const PKEY = { boot: { x: 32, y: 48 }, entities: [...PULSE, { type: 'bosskey', x: 64, y: 48, attrs: { keyType: '1' } }] };
const PHEALTH = { boot: { x: 32, y: 48 }, entities: [...PULSE, { type: 'health', x: 64, y: 48, attrs: { tag: '23' } }] };
const PCTL = { boot: { x: 32, y: 48 }, entities: [...PULSE] };
const PSPAN = { boot: { x: 32, y: 48 }, entities: [...PULSE, button(64, 48, 7), rock(192, 32, 7, ROCK_TAG)] };
const SEAL = { resp: { tag: 'lock', x: 112, y: 48 }, boot: { x: 64, y: 48 },
    entities: [latch(64, 48, 5, 21), lock(112, 48, 5, L_TAG), { type: 'chest', x: 64, y: 32, attrs: { tag: '24' } }] };
const BROCK = { boot: { x: 32, y: 48 }, entities: [{ type: 'pushableblock', x: 64, y: 48 }, button(96, 48, 7), rock(192, 32, 7, ROCK_TAG)] };
export const SHAPES = [
    { name: 'p-key', base: PKEY, defaults: { walk: 140, stand: 160 }, steps: (p) => [[['right'], p.walk], [[], p.stand]] },
    { name: 'p-health', base: PHEALTH, defaults: { walk: 140, stand: 160 }, steps: (p) => [[['right'], p.walk], [[], p.stand]] },
    // p-health-x: the texted pickup's dialogue dismissed by the tape (primary presses) so the player walks on into the ring after
    // it: the dialogue's frozen ticks are live tape ticks on which the game's Pulser runs too.
    { name: 'p-health-x', base: PHEALTH, defaults: { walk: 30, x: 200, walk2: 120, stand: 60 },
        steps: (p) => [[['right'], p.walk], [['primary'], 1], [[], 1], [['primary'], 1], [[], 1], [['primary'], 1], [[], 1], [['primary'], 1], [[], 1], [['primary'], 1], [[], p.x], [['right'], p.walk2], [[], p.stand]] },
    { name: 'p-ctl', base: PCTL, defaults: { walk: 140, stand: 160 }, steps: (p) => [[['right'], p.walk], [[], p.stand]] },
    { name: 'p-span', base: PSPAN, defaults: { walk: 140, stand: 160 }, steps: (p) => [[['right'], p.walk], [[], p.stand]] },
    { name: 's-seal', base: SEAL, defaults: { wait: 0, walk: 20, stand: 240 }, steps: (p) => [[[], p.wait], [['up'], p.walk], [[], p.stand]] },
    { name: 'b-rock', base: BROCK, defaults: { walk: 120, stand: 120 }, steps: (p) => [[['right'], p.walk], [[], p.stand]] },
];
export const shape = (name) => SHAPES.find((s) => s.name === name) ?? (() => { throw new Error(`no shape ${name}`); })();
