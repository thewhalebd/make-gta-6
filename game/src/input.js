// Keyboard and mouse input.
//
// Held keys give movement and driving. One-shot presses — confirm, pause,
// enter a car, punch, start a mission — are queued as bit flags and taken
// exactly once by the loop, so a press that lands between two frames is
// never lost and never counted twice. The mouse aims (on foot) and fires
// with a click; its position is reported in canvas pixels and turned into
// world coordinates by the renderer's raycast.
//
// The listeners sit on the #game WebGL canvas, under the transparent #hud
// overlay, which never takes pointer events.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_INTERACT = 16;

const CONFIRM_KEYS = new Set(['Space', 'Enter']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const SCROLL_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = false;

  function noteKey(event) {
    if (event.code === 'KeyE' && !event.repeat) queued |= ACTION_ENTER;
    else if (event.code === 'KeyF' && !event.repeat) queued |= ACTION_PUNCH;
    else if (event.code === 'KeyM' && !event.repeat) queued |= ACTION_INTERACT;
    else if (CONFIRM_KEYS.has(event.code)) {
      if (!event.repeat) queued |= ACTION_CONFIRM;
    } else if (PAUSE_KEYS.has(event.code)) {
      if (!event.repeat) queued |= ACTION_PAUSE;
    }
    keys.add(event.code);
    if (SCROLL_KEYS.includes(event.code)) event.preventDefault();
  }

  window.addEventListener('keydown', noteKey);
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    mouseDown = true;
    clicked = true;
    queued |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  // -1, 0 or 1 along one axis from a pair of keys. WASD is tried first;
  // the arrow keys only count when WASD says nothing, so holding W and
  // Down together still walks forward instead of cancelling out.
  function axis(neg, pos) {
    return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
  }

  return {
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
      const wasClicked = clicked;
      clicked = false;
      return wasClicked;
    },
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
