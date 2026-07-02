// Vanilla JS port of GMTK Platformer Toolkit core movement/jump physics.
// Source: characterMovement.cs, characterJump.cs, characterGround.cs,
//         characterJuice.cs (squash + tilt only — no particles/sound/animator),
//         PresetObject.cs + the .asset preset YAMLs (MIT, GMTK 2022).
// Faithful to the C# logic; comments mark which function maps to which.

const UNIT = 32;          // px per Unity unit (rendering scale)
const GRAVITY = -9.81;    // matches Unity's default Physics2D.gravity.y
const FIXED_DT = 1 / 50;  // Unity FixedUpdate default tick
const MAX_STEPS = 5;      // accumulator clamp — avoid spiral of death after a hitch

// Tunable parameters (mirror C# [SerializeField] fields).
// Defaults match the C# script defaults; fields the C# left at 0 (which would be
// broken at runtime) get sensible starting values so the demo works out of the box.
const params = {
  // characterMovement
  maxSpeed: 10,
  maxAcceleration: 52,
  maxDecceleration: 52,
  maxTurnSpeed: 80,
  maxAirAcceleration: 30,
  maxAirDeceleration: 30,
  maxAirTurnSpeed: 80,
  friction: 0,
  useAcceleration: true,

  // characterJump
  jumpHeight: 5,
  timeToJumpApex: 0.4,
  upwardMovementMultiplier: 1,
  downwardMovementMultiplier: 6.17,
  maxAirJumps: 0,
  variablejumpHeight: true,
  jumpCutOff: 3,
  speedLimit: 30,
  coyoteTime: 0.15,
  jumpBuffer: 0.15,

  // characterJuice (squash & tilt only)
  maxTilt: 8,
  tiltSpeed: 360,
  jumpSqueeze: 1.2,
  landSqueeze: 1.3,
  squashRecoverTime: 0.2,
};
const defaults = { ...params };

// Presets pulled verbatim from the .asset YAMLs in the unitypackage.
// Fields not present in a preset (coyoteTime, jumpBuffer, juice settings, etc.)
// are left untouched — same behaviour as CharacterMovementDataController.cs.
const presets = {
  celeste: {
    maxAcceleration: 79,   maxSpeed: 9.01, maxDecceleration: 76,    maxTurnSpeed: 76,
    jumpHeight: 2.25,      timeToJumpApex: 0.38,                    downwardMovementMultiplier: 5.23,
    maxAirAcceleration: 80, maxAirTurnSpeed: 80,                    maxAirDeceleration: 80,
    variablejumpHeight: true, jumpCutOff: 5.23,                     maxAirJumps: 0,
  },
  nsmbu: {
    maxAcceleration: 13.3, maxSpeed: 6.6,  maxDecceleration: 13.3,  maxTurnSpeed: 13.3,
    jumpHeight: 2.88,      timeToJumpApex: 0.46,                    downwardMovementMultiplier: 1.37,
    maxAirAcceleration: 13.3, maxAirTurnSpeed: 13.3,                maxAirDeceleration: 3,
    variablejumpHeight: true, jumpCutOff: 1.37,                     maxAirJumps: 0,
  },
  sonic: {
    maxAcceleration: 7.4,  maxSpeed: 16.9, maxDecceleration: 26.1,  maxTurnSpeed: 26.1,
    jumpHeight: 3.4,       timeToJumpApex: 0.46,                    downwardMovementMultiplier: 1,
    maxAirAcceleration: 11.79, maxAirTurnSpeed: 11.79,              maxAirDeceleration: 24.1,
    variablejumpHeight: true, jumpCutOff: 1,                        maxAirJumps: 0,
  },
  meatboy: {
    maxAcceleration: 30.5, maxSpeed: 17,   maxDecceleration: 80,    maxTurnSpeed: 80,
    jumpHeight: 5.5,       timeToJumpApex: 0.65,                    downwardMovementMultiplier: 2.9,
    maxAirAcceleration: 43.6, maxAirTurnSpeed: 43.6,                maxAirDeceleration: 9.6,
    variablejumpHeight: true, jumpCutOff: 2.9,                      maxAirJumps: 0,
  },
};

// Slider definitions: ranges match the C# [Range(min, max)] attributes.
// jumpHeight max bumped to 8 because the C# default of 7.3 sat above its own Range(2,5.5).
const sliderDefs = [
  { group: 'Movement', key: 'maxSpeed',                   min: 0,   max: 20,   step: 0.1 },
  { group: 'Movement', key: 'maxAcceleration',            min: 0,   max: 100,  step: 1 },
  { group: 'Movement', key: 'maxDecceleration',           min: 0,   max: 100,  step: 1 },
  { group: 'Movement', key: 'maxTurnSpeed',               min: 0,   max: 100,  step: 1 },
  { group: 'Movement', key: 'maxAirAcceleration',         min: 0,   max: 100,  step: 1 },
  { group: 'Movement', key: 'maxAirDeceleration',         min: 0,   max: 100,  step: 1 },
  { group: 'Movement', key: 'maxAirTurnSpeed',            min: 0,   max: 100,  step: 1 },
  { group: 'Movement', key: 'useAcceleration',            type: 'bool' },

  { group: 'Jump', key: 'jumpHeight',                 min: 2,   max: 8,    step: 0.05 },
  { group: 'Jump', key: 'timeToJumpApex',             min: 0.2, max: 1.25, step: 0.01 },
  { group: 'Jump', key: 'upwardMovementMultiplier',   min: 0,   max: 5,    step: 0.05 },
  { group: 'Jump', key: 'downwardMovementMultiplier', min: 1,   max: 10,   step: 0.05 },
  { group: 'Jump', key: 'maxAirJumps',                min: 0,   max: 1,    step: 1 },
  { group: 'Jump', key: 'variablejumpHeight',         type: 'bool' },
  { group: 'Jump', key: 'jumpCutOff',                 min: 1,   max: 10,   step: 0.05 },
  { group: 'Jump', key: 'speedLimit',                 min: 5,   max: 60,   step: 0.5 },
  { group: 'Jump', key: 'coyoteTime',                 min: 0,   max: 0.3,  step: 0.005 },
  { group: 'Jump', key: 'jumpBuffer',                 min: 0,   max: 0.3,  step: 0.005 },

  { group: 'Juice', key: 'maxTilt',           min: 0,    max: 20,  step: 0.5 },
  { group: 'Juice', key: 'tiltSpeed',         min: 0,    max: 720, step: 10 },
  { group: 'Juice', key: 'jumpSqueeze',       min: 1,    max: 2,   step: 0.01 },
  { group: 'Juice', key: 'landSqueeze',       min: 1,    max: 2,   step: 0.01 },
  { group: 'Juice', key: 'squashRecoverTime', min: 0.05, max: 0.5, step: 0.01 },
];

// ---- World (Unity-style coordinates: +y is up, origin bottom-left) ----
// Canvas is 960×540 px = 30×16.875 units at UNIT=32.
const platforms = [
  { x: 0,  y: 0, w: 30, h: 1   },  // floor
  { x: 5,  y: 3, w: 4,  h: 0.5 },
  { x: 12, y: 5, w: 4,  h: 0.5 },
  { x: 19, y: 7, w: 4,  h: 0.5 },
  { x: 24, y: 4, w: 3,  h: 0.5 },
  { x: 2,  y: 6, w: 2,  h: 0.5 },
];

const PLAYER_W = 0.75;
const PLAYER_H = 1.125;
const SPAWN_X = 2;
const SPAWN_Y = 2;

const character = {
  x: SPAWN_X, y: SPAWN_Y,
  vx: 0, vy: 0,
  facing: 1,
  // characterMovement state
  directionX: 0,
  pressingKey: false,
  // characterJump state
  desiredJump: false,
  pressingJump: false,
  jumpBufferCounter: 0,
  coyoteTimeCounter: 0,
  currentlyJumping: false,
  canJumpAgain: false,
  gravityScale: 1,
  gravMultiplier: 1,
  onGround: false,
};

function resetCharacter() {
  character.x = SPAWN_X;
  character.y = SPAWN_Y;
  character.vx = 0;
  character.vy = 0;
  character.directionX = 0;
  character.pressingKey = false;
  character.desiredJump = false;
  character.pressingJump = false;
  character.jumpBufferCounter = 0;
  character.coyoteTimeCounter = 0;
  character.currentlyJumping = false;
  character.canJumpAgain = false;
  character.gravMultiplier = 1;
}

// ---- Input ----
const keys = { left: false, right: false };
const JUMP_CODES = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyJ']);

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.left = true; e.preventDefault(); return; }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = true; e.preventDefault(); return; }
  if (JUMP_CODES.has(e.code)) {
    // Mirrors OnJump(context.started) — fires once per press.
    character.desiredJump = true;
    character.pressingJump = true;
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyR') resetCharacter();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  else if (JUMP_CODES.has(e.code)) character.pressingJump = false;
});

// ---- Juice state — squash + tilt only (port of characterJuice.cs minus particles/sound/animator) ----
const juice = {
  squashScaleX: 1, squashScaleY: 1,
  squashTargetX: 1, squashTargetY: 1,
  squashElapsed: 0, squashDuration: 0,
  squashActive: false,
  tiltCurrent: 0,
};

// JumpSqueeze() coroutine collapsed: snap to target then lerp back to (1,1).
// The C# compress phase was 0.01s — undetectable at 50 Hz, so we skip it.
function triggerSquash(targetX, targetY) {
  juice.squashTargetX = targetX;
  juice.squashTargetY = targetY;
  juice.squashScaleX = targetX;
  juice.squashScaleY = targetY;
  juice.squashElapsed = 0;
  juice.squashDuration = params.squashRecoverTime;
  juice.squashActive = true;
}

function updateSquash(dt) {
  if (!juice.squashActive) return;
  juice.squashElapsed += dt;
  const t = Math.min(1, juice.squashElapsed / Math.max(juice.squashDuration, 1e-6));
  juice.squashScaleX = juice.squashTargetX + (1 - juice.squashTargetX) * t;
  juice.squashScaleY = juice.squashTargetY + (1 - juice.squashTargetY) * t;
  if (t >= 1) {
    juice.squashScaleX = 1;
    juice.squashScaleY = 1;
    juice.squashActive = false;
  }
}

// characterJuice.cs tiltCharacter() — lean in the direction of movement.
function updateTilt(dt) {
  const dir = character.vx > 0 ? 1 : character.vx < 0 ? -1 : 0;
  const target = dir * params.maxTilt;
  const diff = target - juice.tiltCurrent;
  const maxDelta = params.tiltSpeed * dt;
  if (Math.abs(diff) <= maxDelta) {
    juice.tiltCurrent = target;
  } else {
    juice.tiltCurrent += Math.sign(diff) * maxDelta;
  }
}

// ---- Helpers (mirrors of UnityEngine.Mathf) ----
const sign = (v) => v > 0 ? 1 : v < 0 ? -1 : 0;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}
function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ---- Physics ----

// characterGround.cs — pair of downward raycasts from the feet.
function checkOnGround() {
  const probeDepth = 0.08;
  const feetY = character.y;
  for (const dx of [0.05, PLAYER_W - 0.05]) {
    const fx = character.x + dx;
    for (const p of platforms) {
      const top = p.y + p.h;
      if (fx >= p.x && fx <= p.x + p.w &&
          feetY <= top + 0.001 && feetY >= top - probeDepth) {
        return true;
      }
    }
  }
  return false;
}

// characterJump.cs Update() — jump-buffer + coyote-time bookkeeping.
function updateCounters(dt) {
  if (params.jumpBuffer > 0 && character.desiredJump) {
    character.jumpBufferCounter += dt;
    if (character.jumpBufferCounter > params.jumpBuffer) {
      character.desiredJump = false;
      character.jumpBufferCounter = 0;
    }
  }
  if (!character.currentlyJumping && !character.onGround) {
    character.coyoteTimeCounter += dt;
  } else {
    character.coyoteTimeCounter = 0;
  }
}

// characterJump.cs setPhysics() — derive gravityScale from jumpHeight + apex time.
function setPhysics() {
  const newGravityY = (-2 * params.jumpHeight) / (params.timeToJumpApex * params.timeToJumpApex);
  character.gravityScale = (newGravityY / GRAVITY) * character.gravMultiplier;
}

// characterJump.cs DoAJump().
function doAJump() {
  const canCoyote = character.coyoteTimeCounter > 0.03 && character.coyoteTimeCounter < params.coyoteTime;
  if (character.onGround || canCoyote || character.canJumpAgain) {
    character.desiredJump = false;
    character.jumpBufferCounter = 0;
    character.coyoteTimeCounter = 0;
    character.canJumpAgain = (params.maxAirJumps === 1 && !character.canJumpAgain);

    // Recompute gravityScale against the natural (gravMultiplier=1) gravity before
    // sizing the launch velocity. Without this, a jump triggered while falling reads
    // gravityScale set for downwardMovementMultiplier (~6×), then the next step's
    // calculateGravity flips back to upwardMovementMultiplier and you overshoot
    // jumpHeight by several times. Inherited bug from the C# original.
    character.gravMultiplier = 1;
    setPhysics();

    let jumpSpeed = Math.sqrt(-2 * GRAVITY * character.gravityScale * params.jumpHeight);
    if (character.vy > 0) jumpSpeed = Math.max(jumpSpeed - character.vy, 0);
    else if (character.vy < 0) jumpSpeed += Math.abs(character.vy);
    character.vy += jumpSpeed;
    character.currentlyJumping = true;

    // characterJump.cs DoAJump() also fires juice.jumpEffects() on success.
    if (params.jumpSqueeze > 1) triggerSquash(1 / params.jumpSqueeze, params.jumpSqueeze);
  }
  if (params.jumpBuffer === 0) character.desiredJump = false;
}

// characterJump.cs calculateGravity() — pick gravMultiplier for next step + clamp fall speed.
function calculateGravity() {
  if (character.vy > 0.01) {
    if (character.onGround) {
      character.gravMultiplier = 1;
    } else if (params.variablejumpHeight) {
      character.gravMultiplier = (character.pressingJump && character.currentlyJumping)
        ? params.upwardMovementMultiplier
        : params.jumpCutOff;
    } else {
      character.gravMultiplier = params.upwardMovementMultiplier;
    }
  } else if (character.vy < -0.01) {
    character.gravMultiplier = character.onGround ? 1 : params.downwardMovementMultiplier;
  } else {
    if (character.onGround) character.currentlyJumping = false;
    character.gravMultiplier = 1;
  }
  character.vy = clamp(character.vy, -params.speedLimit, 100);
}

// characterMovement.cs runWithAcceleration().
function runWithAcceleration(dt) {
  const accel = character.onGround ? params.maxAcceleration : params.maxAirAcceleration;
  const decel = character.onGround ? params.maxDecceleration : params.maxAirDeceleration;
  const turn  = character.onGround ? params.maxTurnSpeed     : params.maxAirTurnSpeed;
  const desiredVx = character.directionX * Math.max(params.maxSpeed - params.friction, 0);

  let maxSpeedChange;
  if (character.pressingKey) {
    maxSpeedChange = (sign(character.directionX) !== sign(character.vx) ? turn : accel) * dt;
  } else {
    maxSpeedChange = decel * dt;
  }
  character.vx = moveTowards(character.vx, desiredVx, maxSpeedChange);
}

function applyHorizontalMovement(dt) {
  if (params.useAcceleration) {
    runWithAcceleration(dt);
  } else if (character.onGround) {
    character.vx = character.directionX * Math.max(params.maxSpeed - params.friction, 0);
  } else {
    runWithAcceleration(dt);
  }
}

// AABB collision against platforms — resolve X then Y. Returns nothing; mutates character.
function moveAndCollide(dt) {
  character.x += character.vx * dt;
  for (const p of platforms) {
    if (aabb(character.x, character.y, PLAYER_W, PLAYER_H, p.x, p.y, p.w, p.h)) {
      if (character.vx > 0) character.x = p.x - PLAYER_W;
      else if (character.vx < 0) character.x = p.x + p.w;
      character.vx = 0;
    }
  }
  character.y += character.vy * dt;
  for (const p of platforms) {
    if (aabb(character.x, character.y, PLAYER_W, PLAYER_H, p.x, p.y, p.w, p.h)) {
      if (character.vy < 0) {
        character.y = p.y + p.h;
        character.vy = 0;
      } else if (character.vy > 0) {
        character.y = p.y - PLAYER_H;
        character.vy = 0;
      }
    }
  }
}

function physicsStep(dt) {
  // OnMovement equivalent — resolve directionX from current key state.
  character.directionX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (character.directionX !== 0) {
    character.facing = character.directionX > 0 ? 1 : -1;
    character.pressingKey = true;
  } else {
    character.pressingKey = false;
  }

  character.onGround = checkOnGround();
  updateCounters(dt);
  setPhysics();

  // Unity integrates gravity automatically before FixedUpdate; do the same here.
  character.vy += GRAVITY * character.gravityScale * dt;

  if (character.desiredJump) {
    doAJump();
    // Skip calculateGravity (mirrors C# `return`) so currentlyJumping survives this frame.
  } else {
    calculateGravity();
  }

  applyHorizontalMovement(dt);

  if (character.onGround && character.vy <= 0) character.canJumpAgain = false;

  const startedAirborne = !character.onGround;
  moveAndCollide(dt);
  character.onGround = checkOnGround();
  // characterJuice.cs checkForLanding() — triggers a squash on the airborne→grounded edge.
  if (character.onGround && startedAirborne && params.landSqueeze > 1) {
    triggerSquash(params.landSqueeze, 1 / params.landSqueeze);
  }

  updateSquash(dt);
  updateTilt(dt);

  // Recover if you fall off the world.
  if (character.y < -5) resetCharacter();
}

// ---- Render ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function render() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#4a5568';
  for (const p of platforms) {
    ctx.fillRect(
      p.x * UNIT,
      canvas.height - (p.y + p.h) * UNIT,
      p.w * UNIT,
      p.h * UNIT
    );
  }

  const px = character.x * UNIT;
  const py = canvas.height - (character.y + PLAYER_H) * UNIT;
  const w = PLAYER_W * UNIT;
  const h = PLAYER_H * UNIT;

  // Pivot at the feet center so squash extends upward and tilt rotates around contact.
  ctx.save();
  ctx.translate(px + w / 2, py + h);
  ctx.rotate(juice.tiltCurrent * Math.PI / 180);
  ctx.scale(juice.squashScaleX, juice.squashScaleY);

  ctx.fillStyle = character.onGround ? '#ed8936' : '#f6ad55';
  ctx.fillRect(-w / 2, -h, w, h);

  ctx.fillStyle = '#1a1a2e';
  const eyeX = character.facing * 0.18 * w;
  ctx.fillRect(eyeX - 2, -h * 0.78 - 2, 4, 4);
  ctx.restore();

  ctx.fillStyle = '#a0aec0';
  ctx.font = '12px ui-monospace, monospace';
  const hud = `vx ${character.vx.toFixed(2).padStart(6)}  vy ${character.vy.toFixed(2).padStart(6)}  ground ${character.onGround ? 'Y' : 'N'}`;
  ctx.fillText(hud, 10, 18);
}

// ---- Game loop with fixed-timestep accumulator ----
let lastTime = 0;
let accumulator = 0;

function frame(t) {
  if (lastTime === 0) lastTime = t;
  let elapsed = (t - lastTime) / 1000;
  if (elapsed > 0.25) elapsed = 0.25;
  lastTime = t;

  accumulator += elapsed;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
    physicsStep(FIXED_DT);
    accumulator -= FIXED_DT;
    steps++;
  }
  render();
  requestAnimationFrame(frame);
}

// ---- UI ----
function formatVal(v, step) {
  const decimals = (String(step).split('.')[1] || '').length;
  return v.toFixed(decimals);
}

function makeControl(def) {
  const wrap = document.createElement('div');
  wrap.className = 'control' + (def.type === 'bool' ? ' bool' : '');
  const inputId = 'input-' + def.key;
  const markCustom = () => { const sel = document.getElementById('preset'); if (sel) sel.value = ''; };

  if (def.type === 'bool') {
    const label = document.createElement('label');
    label.htmlFor = inputId;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = inputId;
    input.checked = params[def.key];
    input.addEventListener('change', () => { params[def.key] = input.checked; markCustom(); });
    label.appendChild(input);
    label.appendChild(document.createTextNode(' ' + def.key));
    wrap.appendChild(label);
  } else {
    const valId = 'val-' + def.key;
    const label = document.createElement('label');
    label.htmlFor = inputId;
    label.innerHTML = `<span>${def.key}</span><span class="val" id="${valId}">${formatVal(params[def.key], def.step)}</span>`;
    const input = document.createElement('input');
    input.type = 'range';
    input.id = inputId;
    input.min = def.min;
    input.max = def.max;
    input.step = def.step;
    input.value = params[def.key];
    input.addEventListener('input', () => {
      params[def.key] = +input.value;
      document.getElementById(valId).textContent = formatVal(params[def.key], def.step);
      markCustom();
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
  }
  return wrap;
}

function refreshUI() {
  for (const def of sliderDefs) {
    const input = document.getElementById('input-' + def.key);
    if (!input) continue;
    if (def.type === 'bool') {
      input.checked = params[def.key];
    } else {
      input.value = params[def.key];
      const valEl = document.getElementById('val-' + def.key);
      if (valEl) valEl.textContent = formatVal(params[def.key], def.step);
    }
  }
}

function applyPreset(name) {
  const p = presets[name];
  if (!p) return;
  Object.assign(params, p);
  refreshUI();
}

function buildUI() {
  const hosts = {
    Movement: document.getElementById('movement-controls'),
    Jump: document.getElementById('jump-controls'),
    Juice: document.getElementById('juice-controls'),
  };
  for (const def of sliderDefs) {
    hosts[def.group].appendChild(makeControl(def));
  }
  document.getElementById('reset-btn').addEventListener('click', () => {
    resetCharacter();
    canvas.focus();
  });
  document.getElementById('reset-params-btn').addEventListener('click', () => {
    Object.assign(params, defaults);
    refreshUI();
    document.getElementById('preset').value = '';
    canvas.focus();
  });
  document.getElementById('preset').addEventListener('change', (e) => {
    if (e.target.value) applyPreset(e.target.value);
    canvas.focus();
  });
  canvas.focus();
}

buildUI();
requestAnimationFrame(frame);
