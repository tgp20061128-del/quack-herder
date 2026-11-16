// Keyboard and pointer input. Held keys steer the dog directly; the pointer is a target
// the dog runs toward. One-shot presses (start, bark, pause, mute, restart) are queued as
// bit flags and taken once by the loop, so a press between two frames is never lost and
// never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_BARK = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter']);
const BARK_KEYS = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(canvas) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let actions = 0;
  let target = { x: 0, y: 0, has: false, movedAt: 0 };

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (BARK_KEYS.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BARK;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
  });

  // The pointer steers: the dog runs toward where it is. A click during play is a bark.
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    target.x = event.clientX - rect.left;
    target.y = event.clientY - rect.top;
    target.has = true;
    target.movedAt = performance.now();
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    target.x = event.clientX - rect.left;
    target.y = event.clientY - rect.top;
    target.has = true;
    target.movedAt = performance.now();
    actions |= ACTION_BARK;
  });
  canvas.addEventListener('pointerleave', () => {
    target.has = false;
  });

  return {
    /** -1, 0 or 1 on each axis, from the held keys. */
    keys() {
      return { kx: (right ? 1 : 0) - (left ? 1 : 0), ky: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** The pointer's target in canvas pixels, and whether it moved lately. */
    pointer(scale, offsetX, offsetY) {
      if (!target.has) return { hasTarget: false, tx: 0, ty: 0 };
      return {
        hasTarget: performance.now() - target.movedAt < 1500,
        tx: (target.x - offsetX) / scale,
        ty: (target.y - offsetY) / scale,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
