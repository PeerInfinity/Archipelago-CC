#!/usr/bin/env node
/**
 * audit-seedling-r6-boss-rooms — R6 slice 0's geometry half: the three
 * boss rooms priced with the SHIPPED planner geometry, before any window
 * is planned. Brief: `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §4
 * slice 0 ("boss-room floods and stance audits with the shipped
 * geometry"), §2.2/§2.4/§2.5 for the mechanics it is pricing.
 *
 * ⚠ THIS IS A MEASUREMENT, NOT A BUILD — the `probe-seedling-r5-l43-boss-wake`
 * precedent. Nothing here is wired into `levelRun`. It reads the committed
 * atlas through the committed `buildLevelWorld`, so what it reports is what
 * the SHIPPED planner would see, not what a second geometry layer thinks.
 * Instruments propose; the shipped planner confirms.
 *
 * ── What it answers, room by room ─────────────────────────────────────
 *
 * L43 (BossTotem) — the clamp TRACKS the boss (`p.y = y + 44`), so the
 * arena's floor DESCENDS 180 -> 352 as he walks and snaps back at his
 * jump. The audit prints the clamp's whole travel against the room's
 * solid geometry, and the kill stance's real constraint: `Enemy.dieEffects`
 * spawns `Explosion(x, y, ["Player","Enemy"], max(w,h)=80, 1)` whose hit
 * test is a SQUARE PREFILTER plus `FP.distance(x, y, c.x, c.y) <= 52` —
 * an ORIGIN-TO-ORIGIN circle, not a rect overlap. Standing "outside the
 * box" is not standing outside the blast.
 *
 * L19 (ShieldBoss) — the body is `(oel + 24, oel + 32)` with a 48x48
 * hitbox and `"ShieldBoss"` is in `Mobile.solids`, so it is a hard wall
 * containing `bosskey@96,64`. The only vulnerable window opens after 120
 * CONSECUTIVE ticks with the player inside `hitPlayer`'s own rect,
 * `(x - 24, y + 24, 48, 16)`. The audit prints that band, its tile
 * support, and whether the key's cell is reachable once the wall goes.
 *
 * L112 (the Owl) — the fight is a SHOVE onto lava, so the question is
 * geometric: where the lava tiles actually are, and which pod-to-pod
 * lines cross them. The audit prints the lava block, the four pod
 * positions as the AS3 has them (`podPositions`, which are the .oel
 * points + (8,8)), and the crossing test per leg.
 *
 * Usage:
 *   node scripts/procgen/audit-seedling-r6-boss-rooms.mjs [--only=43,19,112]
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { BOSS_TOTEM } = await import(join(MODULE, 'bossTotem.js'));

const source = atlasLevelSource();
const ONLY = new Set((process.argv.find((a) => a.startsWith('--only=')) ?? '')
    .slice('--only='.length).split(',').filter(Boolean).map(Number));
const want = (lv) => ONLY.size === 0 || ONLY.has(lv);

const T = TILE_SIZE;
const line = (s = '') => console.log(s);
const hdr = (s) => { line(); line('='.repeat(72)); line(s); line('='.repeat(72)); };

/**
 * The committed world, built the way a route would build it — and when the
 * shipped builder REFUSES the level, the refusal is reported BY NAME and
 * the read falls back to `roles: ['blocking']`.
 *
 * ⛔ A refusal is a FINDING, not an inconvenience: `feedback_refused_arm_hides_bad_geometry`
 * cost this arc twice. Reporting the refusal and then measuring geometry
 * under a weaker role set keeps the two claims separate — "the planner will
 * not route here yet" and "here is what the room looks like".
 */
function world(level) {
    try {
        return { w: buildLevelWorld(source(level), { roles: ROLES }), refusals: [] };
    } catch (e) {
        const refusals = [e.message];
        // Peel the roles back one at a time so every refusal is named, not
        // just the first one the builder happened to reach.
        for (const roles of [ROLES.filter((r) => r !== 'proximity-hazard'),
            ['blocking', 'trigger', 'pickup'], ['blocking']]) {
            try {
                return { w: buildLevelWorld(source(level), { roles }), refusals, roles };
            } catch (e2) {
                if (!refusals.includes(e2.message)) refusals.push(e2.message);
            }
        }
        throw e;
    }
}

/** Every tile of a given type, as the world's own tile records. */
function tilesOfType(w, pred) {
    return w.tiles.filter((c) => pred(c.t));
}

/** The world's tile type at a cell, or null outside the room. */
function tileAt(w, tx, ty) {
    const c = w.tiles.find((r) => r.tx === tx && r.ty === ty);
    return c ? c.t : null;
}

/** Contiguous rectangles over a cell set, printed as ranges per row-run. */
function describeCells(cells) {
    if (!cells.length) return '(none)';
    const xs = cells.map((c) => c.tx); const ys = cells.map((c) => c.ty);
    return `${cells.length} cell(s), tx ${Math.min(...xs)}..${Math.max(...xs)}, `
        + `ty ${Math.min(...ys)}..${Math.max(...ys)} `
        + `= px x[${Math.min(...xs) * T},${(Math.max(...xs) + 1) * T}) `
        + `y[${Math.min(...ys) * T},${(Math.max(...ys) + 1) * T})`;
}

// ─────────────────────────────────────────────────────────────────────
if (want(43)) {
    hdr('L43 — BossTotem: the clamp TRACKS, and the blast is a CIRCLE');
    const { w, refusals } = world(43);
    line(`room ${w.width}x${w.height} tiles = ${w.width * T}x${w.height * T} px`);
    for (const r of refusals) line(`⛔ SHIPPED-BUILDER REFUSAL: ${r}`);

    const boss = source(43).entities.find((e) => e.type === 'bosstotem');
    // `Game.as` adds BossTotem at the OEL point (no half-tile offset — the
    // ctor is `super(_x, _y, …)`), which is why the census carries dx/dy 0.
    const bx = boss.x; const by0 = boss.y;
    const { w: bw, h: bh, ox, oy } = BOSS_TOTEM.hitbox;
    line(`bosstotem@${bx},${by0} tag=${boss.attrs.tag}  hitbox ${bw}x${bh} origin (${ox},${oy})`);
    line(`  pre-wake SOLID box: x[${bx - ox},${bx - ox + bw}) y[${by0 - oy},${by0 - oy + bh})`);
    line(`  = arena columns ${(bx - ox) / T}..${(bx - ox + bw) / T - 1} of ${w.width}`);

    line();
    line('THE CLAMP, over the walk (`p.y = y - originY + height` = y + 44):');
    line(`  spawn      y=${by0}  clamp floor ${by0 - oy + bh}`);
    line(`  jump gate  y+44 >= maxYPosition(352)  =>  y >= ${352 - 44}`);
    line(`  at y=308   clamp floor 352  (the descent's END)`);
    line(`  jump ends  y <= startY-32 = ${by0 - 32}  =>  clamp floor ${by0 - 32 + 44}`);
    line(`  => the floor sweeps ${by0 - 32 + 44} -> 352 and snaps back, FOREVER.`);
    line('  ⛔ 212 is the SPAWN value only. A stance priced against a static 212');
    line('     is priced against one tick of a cycle.');

    line();
    line('THE DEATH BLAST — `Enemy.dieEffects("Wand")`:');
    const r = Math.floor(Math.max(bw, bh) * 0.65);
    line(`  Explosion(x, y, ["Player","Enemy"], max(w,h)=${Math.max(bw, bh)}, 1)`);
    line(`  radius := ${Math.max(bw, bh)} * 0.65 = ${r} (int)`);
    line(`  hit test = collideRectInto(type, x-${r}, y-${r}, ${r * 2}, ${r * 2})`);
    line(`             THEN FP.distance(x, y, c.x, c.y) <= ${r}`);
    line('  ⛔ ORIGIN TO ORIGIN, not rect overlap. The safe set is the OUTSIDE of a');
    line(`     circle of radius ${r} about the boss ENTITY POINT at the death tick,`);
    line('     and the death tick\'s y is wherever the descent had got to.');
    line(`  ⇒ a stance is safe iff |player - (${bx}, y_death)| > ${r}, y_death in [${by0 - 32},308].`);
    line(`     Worst case (y_death = 308): the unsafe disc reaches y ${308 - r}..${308 + r},`);
    line(`     x ${bx - r}..${bx + r} — i.e. columns ${Math.floor((bx - r) / T)}..${Math.floor((bx + r) / T)}.`);

    line();
    line('THE NORTH EXIT, entity by entity:');
    for (const e of source(43).entities.filter((x) => x.y <= 232)) {
        line(`  ${e.type.padEnd(13)} @${e.x},${e.y}  ${JSON.stringify(e.attrs)}`);
    }
    line('  ⛓ AND L43 HOLDS A `watcher@200,280` WITH EMPTY text/text1 — §2 never named it.');
    line('     `Watcher.hit()` guards on `text != ""`, so it can never be hit; `check()` is');
    line('     overridden EMPTY so it never despawns; `visible = Player.hasShield` so it is');
    line('     invisible on this rung\'s path. type "Watcher" is in no `solids` list.');
}

// ─────────────────────────────────────────────────────────────────────
if (want(19)) {
    hdr('L19 — ShieldBoss: the wall, the band, and the key inside the body');
    const { w, refusals } = world(19);
    line(`room ${w.width}x${w.height} tiles = ${w.width * T}x${w.height * T} px`);
    for (const r of refusals) line(`⛔ SHIPPED-BUILDER REFUSAL: ${r}`);

    const oel = source(19).entities.find((e) => e.type === 'shieldboss');
    // `ShieldBoss(_x, _y)` calls `super(_x + Tile.w*1.5, _y + Tile.h*2, …)`.
    const bx = oel.x + T * 1.5; const by = oel.y + T * 2;
    line(`shieldboss@${oel.x},${oel.y} (oel)  ->  BODY at (${bx},${by})  [ctor: +Tile.w*1.5, +Tile.h*2]`);
    line(`  setHitbox(48,48,24,24) => solid box x[${bx - 24},${bx + 24}) y[${by - 24},${by + 24})`);
    line(`  overlaps cells tx ${Math.floor((bx - 24) / T)}..${Math.ceil((bx + 24) / T) - 1}, `
        + `ty ${Math.floor((by - 24) / T)}..${Math.ceil((by + 24) / T) - 1} `
        + `(NOT tile-aligned in y: the ctor's +Tile.h*2 lands the 48px box at y 40)`);
    line('  ⛓ "ShieldBoss" IS IN `Mobile.solids` (Mobile.as:17) — a hard wall to every mover.');

    const key = source(19).entities.find((e) => e.type === 'bosskey');
    // `BossKey` ctor offset is the census `pickup(...)` dx/dy 8,8.
    const kx = key.x + 8; const ky = key.y + 8;
    line();
    line(`bosskey@${key.x},${key.y} keyType=${key.attrs.keyType} -> entity (${kx},${ky})`);
    const inside = kx >= bx - 24 && kx < bx + 24 && ky >= by - 24 && ky < by + 24;
    line(`  inside the body? ${inside ? 'YES — untakeable while he lives' : 'NO'}`);

    line();
    line('THE ONLY VULNERABLE WINDOW — `ShieldBoss.hitPlayer()`\'s own rect:');
    line(`  collideRect("Player", x-originX, y-originY+height, width, Tile.h)`);
    line(`  = (${bx - 24}, ${by - 24 + 48}, 48, ${T})  => x[${bx - 24},${bx + 24}) y[${by + 24},${by + 24 + T})`);
    line(`  overlaps cells tx ${Math.floor((bx - 24) / T)}..${Math.ceil((bx + 24) / T) - 1}, `
        + `ty ${Math.floor((by + 24) / T)}..${Math.ceil((by + 24 + T) / T) - 1}`);
    line('  120 CONSECUTIVE ticks in that band while `currentAnim == "sit"` -> startStab(false)');
    line('  -> moveShield -> movedShield -> stab. `movedShield` is the ONLY anim `super.hit`');
    line('  lands in.');
    line();
    line('  DERIVED AT `FP.elapsed = 0.0333` (never 60 fps frame math):');
    line('    moveShield  [0,1]  @15  -> callback at update  5');
    line('    movedShield [2]    @ 2  -> callback at update 16   <- THE WINDOW IS 16 TICKS');
    line('    stab        [3..8] @15  -> callback at update 13   (damaging on frames 5..8)');
    line('    die         [9..19]@15  -> callback at update 23   <- NOT the "~44" of §2.4');
    line('    sit         [0]    @ 0  -> step 0, NEVER wraps');

    line();
    line('THE BAND\'S TILE SUPPORT (can the player stand there at all?):');
    const bandTop = by + 24; const bandBot = by + 24 + T;
    for (let ty = Math.floor(bandTop / T); ty < Math.ceil(bandBot / T); ty++)
    for (let tx = Math.floor((bx - 24) / T); tx < Math.ceil((bx + 24) / T); tx++) {
        const bandTy = ty;
        const t = tileAt(w, tx, bandTy);
        const rec = w.tiles.find((r) => r.tx === tx && r.ty === bandTy);
        const walkable = w.walkableTiles.some((r) => r.tx === tx && r.ty === bandTy);
        line(`  (${tx},${bandTy}) t=${t} ${rec ? rec.name : '(no record)'}`
            + `  walkable=${walkable}`);
    }

    line();
    line('L19 / L20 ENTITIES (the shield chain):');
    for (const lv of [19, 20]) {
        line(`  L${lv}:`);
        for (const e of source(lv).entities) {
            line(`    ${e.type.padEnd(15)} @${String(e.x).padStart(3)},${String(e.y).padStart(3)} `
                + JSON.stringify(e.attrs));
        }
    }
}

// ─────────────────────────────────────────────────────────────────────
if (want(112)) {
    hdr('L112 — the Owl: the lava block, and which pod legs cross it');
    const { w, refusals, roles } = world(112);
    line(`room ${w.width}x${w.height} tiles = ${w.width * T}x${w.height * T} px`);
    for (const r of refusals) line(`⛔ SHIPPED-BUILDER REFUSAL: ${r}`);
    if (roles) line(`   (geometry read under the weaker role set ${JSON.stringify(roles)})`);

    const lava = tilesOfType(w, (t) => t === 17);
    line(`LAVA (tile t=17): ${describeCells(lava)}`);
    const pit = tilesOfType(w, (t) => t === 6);
    line(`PIT  (tile t=6):  ${describeCells(pit)}`);
    const water = tilesOfType(w, (t) => t === 1);
    line(`WATER(tile t=1):  ${describeCells(water)}`);

    // `FinalBoss.podPositions`, verbatim from the AS3.
    const pods = [[120, 56], [48, 128], [120, 200], [192, 128]];
    const oelPods = source(112).entities.filter((e) => e.type === 'pod')
        .map((e) => [e.x, e.y]);
    line();
    line(`AS3 podPositions: ${JSON.stringify(pods)}`);
    line(`atlas pod@ points: ${JSON.stringify(oelPods)}  (+8,+8 => `
        + `${JSON.stringify(oelPods.map(([x, y]) => [x + 8, y + 8]))})`);

    const owl = source(112).entities.find((e) => e.type === 'finalboss');
    line(`finalboss@${owl.x},${owl.y} -> body (${owl.x + 8},${owl.y + 8}) `
        + `[ctor +Tile.w/2,+Tile.h/2], hitbox 12x12 origin (6,6)`);

    // ⛔⛔⛔ THE LEG TEST MUST USE THE HITBOX, NOT THE POINT.
    // `FinalBoss.update` does `collide("Tile", x, y)`, and FlashPunk's
    // `Entity.collide` moves the entity's BOX to (x,y) and tests overlap —
    // so the question is whether the 12x12 box (origin 6,6) touches a lava
    // cell, never whether the centre does. A point test here reads 11.31 px
    // of clearance where the real figure is 3.
    const lavaRects = lava.map((c) => c.rect);
    const boxHits = (x, y) => lavaRects.some(
        (r) => x - 6 < r.right && x + 6 > r.x && y - 6 < r.bottom && y + 6 > r.y);

    line();
    line('THE LAVA, CELL BY CELL — it is an OCTAGON, not a 4x4 square:');
    const lavaSet = new Set(lava.map((c) => `${c.tx},${c.ty}`));
    {
        const xs = lava.map((c) => c.tx); const ys = lava.map((c) => c.ty);
        let head = '      ';
        for (let tx = Math.min(...xs) - 1; tx <= Math.max(...xs) + 1; tx++) head += String(tx).padStart(3);
        line(head);
        for (let ty = Math.min(...ys) - 1; ty <= Math.max(...ys) + 1; ty++) {
            let row = String(ty).padStart(5) + ' ';
            for (let tx = Math.min(...xs) - 1; tx <= Math.max(...xs) + 1; tx++) {
                row += lavaSet.has(`${tx},${ty}`) ? '  #' : '  .';
            }
            line(row);
        }
        line('  ⛔ THE CORNERS ARE CUT, and that is the whole fight: the pod legs run at');
        line('     45 degrees through exactly the cells the designer removed.');
    }

    line();
    line('THE LEGS, walked with the 12x12 hitbox at moveSpeed 1 px/tick:');
    const owlBody = [owl.x + 8, owl.y + 8];
    const legs = [[owlBody, pods[0], 'SPAWN -> pod0']];
    for (let i = 0; i < pods.length; i++) {
        legs.push([pods[i], pods[(i + 1) % pods.length], `pod${i} -> pod${(i + 1) % pods.length}`]);
    }
    for (const [a, b, name] of legs) {
        const dx = b[0] - a[0]; const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        let hits = 0; let first = null;
        for (let s = 0; s <= len; s += 1) {
            const x = a[0] + dx * (s / len); const y = a[1] + dy * (s / len);
            if (boxHits(x, y)) { hits++; if (first === null) first = s; }
        }
        // The minimum PERPENDICULAR displacement that puts the box in lava.
        const nx = -dy / len; const ny = dx / len;
        let best = Infinity; let bestS = null; let bestSign = null;
        for (let s = 0; s <= len; s += 0.5) {
            for (const sgn of [1, -1]) {
                for (let d = 0; d <= 60; d += 0.25) {
                    const x = a[0] + dx * (s / len) + nx * d * sgn;
                    const y = a[1] + dy * (s / len) + ny * d * sgn;
                    if (boxHits(x, y)) {
                        if (d < best) { best = d; bestS = s; bestSign = sgn; }
                        break;
                    }
                }
            }
        }
        line(`  ${name.padEnd(16)} ${len.toFixed(1)}px  lava ticks ${hits}`
            + `${first !== null ? ` (first at s=${first})` : ''}`
            + `  ${hits ? '*** SELF-HITS UNSHOVED ***' : 'MISSES'}`
            + `  | min shove ${best.toFixed(2)}px ${bestSign > 0 ? '(+n)' : '(-n)'} at s=${bestS}`);
    }
    line();
    line('  ⛔⛔⛔ §2.5 SAYS "the 4x4 lava block sits dead centre ON the pod-to-pod lines".');
    line('     IT DOES NOT. Every leg — including the Owl\'s opening walk from his spawn —');
    line('     clears the lava, and by the SAME 3.00 px on all five. The cut corners are');
    line('     shaped so the 45-degree walk never touches it. ⇒ all three lava hits are');
    line('     SHOVES; the Owl never self-hits on his own path. `hitThisSequence` limits');
    line('     the fight to ONE shove per pod cycle, so the fight is at least three cycles.');
    line();
    line('  ⛔ AND `maxForce` IS UNCLAMPED UNTIL THE FIRST LAVA HIT. `FinalBoss.update`');
    line('     sets `maxForce = 2` only AFTER the self-hit line, and the ctor never sets');
    line('     it — so the Enemy default -1 (no clamp) is in force for shove #1 and 2 is');
    line('     in force for #2 and #3. §2.5\'s "clamped to maxForce = 2" is true of two');
    line('     shoves out of three.');

    line();
    line('THE ROOM\'S ENTITIES:');
    for (const e of source(112).entities) {
        line(`  ${e.type.padEnd(12)} @${String(e.x).padStart(3)},${String(e.y).padStart(3)} `
            + JSON.stringify(e.attrs));
    }
}
