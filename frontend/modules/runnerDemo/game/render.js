/**
 * Canvas renderer for the Runner game page. Pure draw + render-only
 * juice: reads the session (level, state, abilities, collected) and
 * paints one frame. Suppression decisions come from the SAME
 * suppression module the physics uses — a locked platform renders as
 * a translucent ghost, exactly the set the physics ignores.
 *
 * Coordinates: physics is in toolkit Unity units with +y UP; the
 * renderer scales by UNIT px/unit and flips y at draw time ONLY
 * (physics.js header — the gotcha-class difference from bounce).
 * The camera follows the player along the horizontal strip.
 *
 * Juice (squash + tilt) is the toolkit's characterJuice port, moved
 * RENDER-SIDE (plan §4.1 — dropped from the pure core): triggers ride
 * the state the physics already reports (landedOn for landings, the
 * currentlyJumping rising edge for launches), so the juice observes
 * physics without touching it.
 */

import { isPlatformActive, effectiveParams } from '../suppression.js';

const UNIT = 32; // px per Unity unit (the toolkit's rendering scale)

const PLATFORM_COLORS = {
    ground: '#4a5568', blue: '#5b9bd5', spring: '#e8843c', oneway: '#b08d57',
    glider: '#5bc8af',
};
const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };
const ABILITY_HUD = [['doubleJump', 'DJ'], ['blue', 'B'], ['spring', 'S'], ['glide', 'G'],
    ['shield', 'SH']];

// characterJuice.cs values (vendored original's Juice param group)
const JUICE = {
    maxTilt: 8,
    tiltSpeed: 360,
    jumpSqueeze: 1.2,
    landSqueeze: 1.3,
    squashRecoverTime: 0.2,
};

/** Render-side juice state machine. Feed it every LOGIC tick. */
export function createJuice() {
    const j = {
        squashScaleX: 1, squashScaleY: 1,
        squashTargetX: 1, squashTargetY: 1,
        squashElapsed: 0, squashDuration: 0,
        squashActive: false,
        tiltCurrent: 0,
    };

    // JumpSqueeze() coroutine collapsed: snap to target then lerp back
    // (the C# compress phase was 0.01s — undetectable at 50 Hz).
    const trigger = (targetX, targetY) => {
        j.squashTargetX = targetX;
        j.squashTargetY = targetY;
        j.squashScaleX = targetX;
        j.squashScaleY = targetY;
        j.squashElapsed = 0;
        j.squashDuration = JUICE.squashRecoverTime;
        j.squashActive = true;
    };

    return {
        get squash() { return { x: j.squashScaleX, y: j.squashScaleY }; },
        get tilt() { return j.tiltCurrent; },
        update(prevState, state, dt) {
            // launch: currentlyJumping rising edge (jumpEffects()),
            // and the spring bounce (same stretch, bigger cause)
            if ((state.sprungOn
                    || (state.currentlyJumping && !prevState?.currentlyJumping))
                    && JUICE.jumpSqueeze > 1) {
                trigger(1 / JUICE.jumpSqueeze, JUICE.jumpSqueeze);
            }
            // landing tick (checkForLanding())
            if (state.landedOn && JUICE.landSqueeze > 1) {
                trigger(JUICE.landSqueeze, 1 / JUICE.landSqueeze);
            }
            if (j.squashActive) {
                j.squashElapsed += dt;
                const t = Math.min(1, j.squashElapsed / Math.max(j.squashDuration, 1e-6));
                j.squashScaleX = j.squashTargetX + (1 - j.squashTargetX) * t;
                j.squashScaleY = j.squashTargetY + (1 - j.squashTargetY) * t;
                if (t >= 1) {
                    j.squashScaleX = 1;
                    j.squashScaleY = 1;
                    j.squashActive = false;
                }
            }
            // tiltCharacter() — lean in the direction of movement
            const dir = state.vx > 0 ? 1 : state.vx < 0 ? -1 : 0;
            const target = dir * JUICE.maxTilt;
            const diff = target - j.tiltCurrent;
            const maxDelta = JUICE.tiltSpeed * dt;
            j.tiltCurrent = Math.abs(diff) <= maxDelta
                ? target
                : j.tiltCurrent + Math.sign(diff) * maxDelta;
        },
    };
}

export function renderFrame(ctx, session, ui = {}) {
    const { level, state, abilities, collected } = session;
    const C = session.constants;
    const gateStates = session.gateStates ?? { portals: {}, pickups: {} };
    const isLocked = (kind, id) => gateStates[kind]?.[id] === false;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const viewW = W / UNIT;
    const viewH = H / UNIT;
    const camX = Math.max(0, Math.min(level.size.width - viewW, state.x - viewW * 0.35));
    const camY = Math.max(0, Math.min(Math.max(0, level.size.height - viewH),
        state.y - viewH * 0.4));
    const sx = (x) => (x - camX) * UNIT;
    const sy = (y) => H - (y - camY) * UNIT; // +y up -> y-flip at draw time

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // kill-floor hint along the bottom of the level
    if (camY <= 0.5) {
        const g = ctx.createLinearGradient(0, sy(0) , 0, sy(-1.2));
        g.addColorStop(0, 'rgba(200,60,60,0)');
        g.addColorStop(1, 'rgba(200,60,60,0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(0, sy(0), W, sy(-1.2) - sy(0));
    }

    // platforms (ghosted when suppressed — same answer the physics gets)
    for (const p of level.platforms) {
        ctx.globalAlpha = isPlatformActive(p, abilities) ? 1 : 0.22;
        ctx.fillStyle = PLATFORM_COLORS[p.type] ?? '#888';
        ctx.fillRect(sx(p.x), sy(p.y + p.h), p.w * UNIT, p.h * UNIT);
        if (p.type !== 'ground') { // one-way: mark the landable top
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(sx(p.x), sy(p.y + p.h), p.w * UNIT, 2);
        }
        if (p.type === 'glider') { // wing chevrons along the top
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 2;
            const step = UNIT * 0.6;
            for (let cx = sx(p.x) + step / 2; cx < sx(p.x + p.w) - 4; cx += step) {
                ctx.beginPath();
                ctx.moveTo(cx - 4, sy(p.y + p.h) + 8);
                ctx.lineTo(cx, sy(p.y + p.h) + 4);
                ctx.lineTo(cx + 4, sy(p.y + p.h) + 8);
                ctx.stroke();
            }
        }
        if (p.type === 'spring') { // coil glyphs along the top
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 2;
            const step = UNIT * 0.5;
            for (let cx = sx(p.x) + step / 2; cx < sx(p.x + p.w) - 2; cx += step) {
                ctx.beginPath();
                ctx.arc(cx, sy(p.y + p.h) + 6, 4, Math.PI, 0);
                ctx.stroke();
            }
        }
    }
    ctx.globalAlpha = 1;

    // hazards: saw blades hang from lane undersides (§8.4), ceiling
    // slabs carry downward teeth along their bottom edge (§8.7 step
    // 3), spike BEDS (§4.10 — the budgeted hit volume) draw as a
    // translucent danger field with teeth at the top edge, anything
    // else draws as jagged spike teeth rising from its base
    for (const hz of level.hazards ?? []) {
        const x0 = sx(hz.x);
        const yTop = sy(hz.y + hz.h);
        const yBase = sy(hz.y);
        if (hz.type === 'bed') {
            ctx.fillStyle = 'rgba(212,86,106,0.28)';
            ctx.fillRect(x0, yTop, hz.w * UNIT, yBase - yTop);
            ctx.fillStyle = '#d4566a';
            ctx.beginPath();
            const teeth = Math.max(2, Math.round(hz.w * 2));
            const tw = (hz.w * UNIT) / teeth;
            const toothH = UNIT * 0.4;
            ctx.moveTo(x0, yTop + toothH);
            for (let i = 0; i < teeth; i++) {
                ctx.lineTo(x0 + tw * (i + 0.5), yTop); // tip points UP
                ctx.lineTo(x0 + tw * (i + 1), yTop + toothH);
            }
            ctx.closePath();
            ctx.fill();
            continue;
        }
        if (hz.type === 'ceiling') {
            const toothH = Math.min(UNIT * 0.45, (yBase - yTop) * 0.25);
            ctx.fillStyle = '#4a5568';
            ctx.fillRect(x0, yTop, hz.w * UNIT, yBase - yTop - toothH);
            ctx.fillStyle = '#c0392b';
            ctx.beginPath();
            const teeth = Math.max(2, Math.round(hz.w * 2));
            const tw = (hz.w * UNIT) / teeth;
            ctx.moveTo(x0, yBase - toothH);
            for (let i = 0; i < teeth; i++) {
                ctx.lineTo(x0 + tw * (i + 0.5), yBase); // tip points DOWN
                ctx.lineTo(x0 + tw * (i + 1), yBase - toothH);
            }
            ctx.closePath();
            ctx.fill();
            continue;
        }
        if (hz.type === 'saw') {
            const cx = x0 + (hz.w * UNIT) / 2;
            const cy = (yTop + yBase) / 2;
            const r = Math.min(hz.w, hz.h) * UNIT * 0.5;
            ctx.fillStyle = '#aab4bd';
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) { // static blade teeth
                const a = (i / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45);
                ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
                ctx.stroke();
            }
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
            ctx.fill();
            continue;
        }
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        const teeth = Math.max(2, Math.round(hz.w * 2));
        const tw = (hz.w * UNIT) / teeth;
        ctx.moveTo(x0, yBase);
        for (let i = 0; i < teeth; i++) {
            ctx.lineTo(x0 + tw * (i + 0.5), yTop);
            ctx.lineTo(x0 + tw * (i + 1), yBase);
        }
        ctx.closePath();
        ctx.fill();
    }

    // pickups: squares (outline once collected, padlock while gated)
    for (const pk of level.pickups ?? []) {
        const x = sx(pk.x);
        const y = sy(pk.y);
        if (collected.has(pk.id)) {
            ctx.strokeStyle = '#666';
            ctx.strokeRect(x - 9, y - 9, 18, 18);
        } else if (isLocked('pickups', pk.id)) {
            ctx.fillStyle = '#7a7a7a';
            ctx.fillRect(x - 9, y - 9, 18, 18);
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('🔒', x, y + 4);
        } else {
            ctx.fillStyle = '#d8d8d8';
            ctx.fillRect(x - 9, y - 9, 18, 18);
            ctx.fillStyle = '#222';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('?', x, y + 4);
        }
    }

    // portals: circles with arrows (padlock while gated)
    for (const pt of level.portals ?? []) {
        const x = sx(pt.x);
        const y = sy(pt.y);
        const locked = isLocked('portals', pt.id);
        ctx.strokeStyle = locked ? '#777' : '#b08ae0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        if (locked) {
            ctx.fillText('🔒', x, y + 5);
        } else {
            ctx.fillStyle = '#b08ae0';
            ctx.fillText(ARROWS[pt.arrow] ?? '→', x, y + 5);
        }
    }

    // spawn marker
    ctx.fillStyle = 'rgba(143,209,79,0.5)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▼', sx(level.spawn.x + C.PLAYER_W / 2), sy(level.spawn.y + 1.6));

    // player — squash pivots at the feet center, tilt rotates around
    // contact (the vendored original's draw transform)
    const juice = ui.juice;
    const px = sx(state.x);
    const py = sy(state.y + C.PLAYER_H);
    const w = C.PLAYER_W * UNIT;
    const h = C.PLAYER_H * UNIT;
    // gliding this tick? (physics.js glide branch: a held non-jump
    // fall off a pad rides the cap) — a sustained wide-flat stretch
    // plus wing ticks sell the hover
    const gliding = !state.onGround && state.pressingJump && !state.currentlyJumping
        && !state.springFlight && state.lastSupportType === 'glider'
        && Math.abs(state.vy + C.GLIDE_FALL_CAP) < 1e-6;
    ctx.save();
    ctx.translate(px + w / 2, py + h);
    if (juice) {
        ctx.rotate((juice.tilt * Math.PI) / 180);
        ctx.scale(juice.squash.x, juice.squash.y);
    }
    if (gliding) ctx.scale(1.25, 0.8);
    ctx.fillStyle = state.onGround ? '#ed8936' : '#f6ad55';
    ctx.fillRect(-w / 2, -h, w, h);
    if (gliding) { // wing ticks
        ctx.strokeStyle = '#5bc8af';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-w * 0.95, -h * 0.75);
        ctx.lineTo(-w / 2, -h * 0.55);
        ctx.moveTo(w * 0.95, -h * 0.75);
        ctx.lineTo(w / 2, -h * 0.55);
        ctx.stroke();
    }
    ctx.fillStyle = '#1a1a2e';
    const eyeX = state.facing * 0.18 * w;
    ctx.fillRect(eyeX - 2, -h * 0.78 - 2, 4, 4);
    ctx.restore();

    // HUD: abilities + message
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    let hx = 8;
    for (const [ability, glyph] of ABILITY_HUD) {
        ctx.fillStyle = abilities[ability] ? '#8fd14f' : '#444';
        ctx.fillText(glyph, hx, 18);
        hx += ctx.measureText(glyph).width + 10;
    }
    // hit-budget pips (§4.10): one per collected Shield (MAX_HITS =
    // the count, via the same effectiveParams the physics runs on);
    // filled = hits still available this attempt, hollow = spent.
    // Absent entirely at budget 0 — the v1 HUD is unchanged.
    const maxHits = effectiveParams(C, abilities).MAX_HITS;
    for (let i = 0; i < maxHits; i++) {
        const cx2 = hx + 6 + i * 16;
        ctx.beginPath();
        ctx.arc(cx2, 13, 5, 0, Math.PI * 2);
        if (i < maxHits - state.hits) {
            ctx.fillStyle = '#d4566a';
            ctx.fill();
        } else {
            ctx.strokeStyle = '#d4566a';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }
    if (ui.message) {
        ctx.fillStyle = '#e6c84a';
        ctx.textAlign = 'center';
        ctx.fillText(ui.message, W / 2, 40);
    }
}
