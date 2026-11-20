// Keyboard and mouse input. Held keys give movement and driving; one-shot presses
// (confirm, pause, enter car, punch, interact) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// The mouse aims (on foot) and fires with a click; the pointer position is reported
// in canvas pixels and converted to world coordinates by the renderer's raycast.
// In the 3D edition the listeners sit on the #game WebGL canvas, under the
// transparent #hud overlay, which never takes pointer events.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_INTERACT = 16;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyE' && !event.repeat) actions |= ACTION_ENTER;
    else if (event.code === 'KeyF' && !event.repeat) actions |= ACTION_PUNCH;
    else if (event.code === 'KeyM' && !event.repeat) actions |= ACTION_INTERACT;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    }
    keys.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    mouseClicked = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  function axis(neg, pos) {
    return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
  }

  return {
    /** -1/0/1 on each axis from WASD or the arrow keys. */
    moveX() {
      return axis('KeyA', 'KeyD') || axis('ArrowLeft', 'ArrowRight');
    },
    moveY() {
      return axis('KeyW', 'KeyS') || axis('ArrowUp', 'ArrowDown');
    },
    running() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
