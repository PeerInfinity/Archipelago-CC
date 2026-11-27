// wave 65 (RESPONDERORDER) D1: the owed witnesses, staged as wave 64's `stage.mjs` stages (the vanilla L38 stripped to
// its teleporters and `lightalpha`, the shape's entities added; level data through `botLoadLevels`, its own `set_id`).
// Re-uses wave 64's `shapeTape`, `stagedRecord` and `replay`; only the shapes are new.
//   w-latch        a ButtonRoom latch (room -1, flip 0) pressed MID-tape: the player boots beside it and walks on.
//                  Does L open at on + 101 (OFF) or on + 102 (the Button's +1; ON)?
//   w-latch-boot   control: the player boots ON the latch (the boot press: both readings open L at 102).
//   w-block        a PushableBlock pushed onto a Button (group 5 → L), held there, then pushed off (wave 64: the model
//                  is right for a block; ON must not move it).
//   w-cover-<r>    (B) with a Cover: wave 64's B1 room with L replaced by `cover@144,224` (group 5); the player holds
//                  the Button and leaves it at `release` (`Cover.hitables` has no Enemy: the read alone should do).
//   w-leave-<s>    the player stands on L's Button `s` ticks (L opens), then walks down off it into L38's south
//                  teleporter: does the game run the old level's responder step of the transition tick (the close)?
//   w-spin-button  a Spinner crossing a Button (`Button.hitables` holds "Enemy"): `button@144,208` (group 6) above
//                  `cover@144,224` (group 6) in the B1 corridor, nothing else pressing. A pressed button opens the
//                  cover in 10 updates and the spinner's path through the cover cell shows it.
const S = await import(new URL('../../seedling-fidelity-readerorder-evidence/tools/stage.mjs', import.meta.url).pathname);
export const { LEVEL, L_TAG, stagedRecord, shapeTape, replay } = S;
const lock = (x, y, t, tag) => ({ type: 'lock', x, y, attrs: { tset: String(t), tag: String(tag) } });
const latch = (x, y, t, tag) => ({ type: 'buttonroom', x, y, attrs: { tset: String(t), tag: String(tag), flip: '0', room: '-1' } });
const button = (x, y, t) => ({ type: 'button', x, y, attrs: { tset: String(t) } });
const cover = (x, y, t) => ({ type: 'cover', x, y, attrs: { tset: String(t) } });
const spinner = (x, y) => ({ type: 'spinner', x, y, attrs: { tag: '-1' } });
export const RESP_ID = (s) => `${s.base.resp.tag}@${s.base.resp.x},${s.base.resp.y}`;

const LATCH = { resp: { tag: 'lock', x: 112, y: 48 }, boot: { x: 64, y: 48 }, entities: [latch(32, 48, 5, 21), lock(112, 48, 5, L_TAG)] };
const BLOCK = { resp: { tag: 'lock', x: 192, y: 48 }, boot: { x: 32, y: 48 },
    entities: [{ type: 'pushableblock', x: 64, y: 48 }, button(96, 48, 5), lock(192, 48, 5, L_TAG)] };
const COVER = { resp: { tag: 'cover', x: 144, y: 224 }, boot: { x: 64, y: 272 },
    entities: [lock(144, 128, 9, -1), spinner(144, 160), cover(144, 224, 5), button(64, 272, 5)] };
const LEAVE = { resp: { tag: 'lock', x: 64, y: 224 }, boot: { x: 144, y: 288 }, entities: [lock(64, 224, 5, L_TAG), button(144, 288, 5)] };
const SPINB = { resp: { tag: 'cover', x: 144, y: 224 }, boot: { x: 144, y: 240 },
    entities: [lock(144, 128, 9, -1), spinner(144, 160), button(144, 176, 6), cover(144, 224, 6)] };
export const SHAPES = [
    { name: 'w-latch', base: LATCH, defaults: { walk: 30, stand: 160 }, steps: (p) => [[['left'], p.walk], [[], p.stand]] },
    { name: 'w-latch-boot', base: { ...LATCH, boot: { x: 32, y: 48 } }, defaults: { stand: 150 }, steps: (p) => [[[], p.stand]] },
    { name: 'w-block', base: BLOCK, defaults: { push: 50, hold: 130, off: 60 },
        steps: (p) => [[['right'], p.push], [[], p.hold], [['right'], p.off]] },
    ...[100, 104, 108, 112, 116, 120, 124, 128].map((release) => ({ name: `w-cover-${release}`, base: COVER, defaults: { release, after: 50 },
        steps: (p) => [[[], p.release], [['left'], p.after]] })),
    // a level change on the tick a responder resets: the player holds L's Button (above the south teleporter) until L
    // is open, then walks down off it into the teleporter (to L37): the model's re-close lands on the transition tick.
    ...[110, 108, 112].map((stand) => ({ name: `w-leave-${stand}`, base: LEAVE, defaults: { stand, down: 40 }, steps: (p) => [[[], p.stand], [['down'], p.down]] })),
    { name: 'w-spin-button', base: SPINB, defaults: { stand: 300 }, steps: (p) => [[['up'], p.stand]] },
];
export const shape = (name) => SHAPES.find((s) => s.name === name) ?? (() => { throw new Error(`no shape ${name}`); })();
