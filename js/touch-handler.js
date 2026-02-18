/**
 * Touch Handler — Pinch-zoom, two-finger pan
 * Attaches to wrapper div to avoid Fabric.js conflicts
 */

import { getCanvas, getZoom, setZoom, panBy } from './canvas-manager.js';

let isPinching = false;
let lastPinchDist = 0;
let lastPinchCenter = null;
let longPressTimer = null;
const LONG_PRESS_MS = 500;

export function initTouchHandler(callbacks = {}) {
  const wrapper = document.getElementById('canvas-wrapper');

  wrapper.addEventListener('touchstart', onTouchStart, { passive: false });
  wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
  wrapper.addEventListener('touchend', onTouchEnd, { passive: false });
  wrapper.addEventListener('touchcancel', onTouchEnd, { passive: false });

  // Mouse wheel zoom for desktop testing
  wrapper.addEventListener('wheel', onWheel, { passive: false });

  // Store callbacks for long press and double tap
  wrapper._touchCallbacks = callbacks;
}

function onTouchStart(e) {
  if (e.touches.length === 2) {
    e.preventDefault();
    isPinching = true;
    clearLongPress();

    const t1 = e.touches[0];
    const t2 = e.touches[1];
    lastPinchDist = getDist(t1, t2);
    lastPinchCenter = getMidpoint(t1, t2);

    // Disable Fabric.js interaction during pinch
    const canvas = getCanvas();
    canvas.selection = false;
    canvas.forEachObject(o => { o.evented = false; });
  } else if (e.touches.length === 1) {
    // Long press detection
    const touch = e.touches[0];
    longPressTimer = setTimeout(() => {
      const callbacks = document.getElementById('canvas-wrapper')._touchCallbacks;
      if (callbacks.onLongPress) {
        callbacks.onLongPress(touch.clientX, touch.clientY);
      }
    }, LONG_PRESS_MS);
  }
}

function onTouchMove(e) {
  if (e.touches.length === 2 && isPinching) {
    e.preventDefault();
    clearLongPress();

    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = getDist(t1, t2);
    const center = getMidpoint(t1, t2);

    // Zoom
    const scaleFactor = dist / lastPinchDist;
    const newZoom = getZoom() * scaleFactor;
    const wrapper = document.getElementById('canvas-wrapper');
    const rect = wrapper.getBoundingClientRect();
    const point = new fabric.Point(center.x - rect.left, center.y - rect.top);
    setZoom(newZoom, point);

    // Pan
    const dx = center.x - lastPinchCenter.x;
    const dy = center.y - lastPinchCenter.y;
    panBy(dx, dy);

    lastPinchDist = dist;
    lastPinchCenter = center;
  } else if (e.touches.length === 1) {
    clearLongPress();
  }
}

function onTouchEnd(e) {
  clearLongPress();

  if (e.touches.length < 2 && isPinching) {
    isPinching = false;
    // Re-enable Fabric.js interaction
    const canvas = getCanvas();
    canvas.selection = true;
    canvas.forEachObject(o => { o.evented = true; });
  }
}

function onWheel(e) {
  e.preventDefault();
  const canvas = getCanvas();
  const wrapper = document.getElementById('canvas-wrapper');
  const rect = wrapper.getBoundingClientRect();

  const delta = e.deltaY;
  let zoom = getZoom();
  zoom *= 0.999 ** delta;

  const point = new fabric.Point(e.clientX - rect.left, e.clientY - rect.top);
  setZoom(zoom, point);
}

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function getDist(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getMidpoint(t1, t2) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}
