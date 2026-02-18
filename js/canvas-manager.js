/**
 * Canvas Manager — Fabric.js canvas init, resize, zoom/pan
 */

let canvas = null;
let zoomLevel = 1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export function initCanvas() {
  const wrapper = document.getElementById('canvas-wrapper');
  const rect = wrapper.getBoundingClientRect();

  canvas = new fabric.Canvas('main-canvas', {
    width: rect.width,
    height: rect.height,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true,
    allowTouchScrolling: false,
    enableRetinaScaling: true,
    stopContextMenu: true,
    fireRightClick: true,
  });

  // Disable default object controls globally — we customize per-type
  fabric.FabricObject.prototype.set({
    transparentCorners: false,
    cornerColor: '#0d6efd',
    cornerStrokeColor: '#0d6efd',
    cornerSize: 10,
    padding: 4,
    borderColor: '#0d6efd',
  });

  handleResize();
  window.addEventListener('resize', handleResize);

  return canvas;
}

export function getCanvas() {
  return canvas;
}

export function getZoom() {
  return zoomLevel;
}

export function setZoom(zoom, point) {
  zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  if (point) {
    canvas.zoomToPoint(point, zoomLevel);
  } else {
    canvas.setZoom(zoomLevel);
  }
  updateZoomDisplay();
  canvas.requestRenderAll();
}

export function panBy(dx, dy) {
  const vpt = canvas.viewportTransform;
  vpt[4] += dx;
  vpt[5] += dy;
  canvas.setViewportTransform(vpt);
  canvas.requestRenderAll();
}

export function fitToScreen() {
  const wrapper = document.getElementById('canvas-wrapper');
  const wrapperW = wrapper.clientWidth;
  const wrapperH = wrapper.clientHeight;

  // If there's a background image, fit to that
  const bg = canvas.backgroundImage;
  if (bg) {
    const rawW = bg.width * (bg.scaleX || 1);
    const rawH = bg.height * (bg.scaleY || 1);

    // Account for rotation — at 90° or 270° width and height swap
    const angle = ((bg.angle || 0) % 360 + 360) % 360;
    const isRotated = (angle === 90 || angle === 270);
    const imgW = isRotated ? rawH : rawW;
    const imgH = isRotated ? rawW : rawH;

    const scaleX = (wrapperW * 0.9) / imgW;
    const scaleY = (wrapperH * 0.9) / imgH;
    const scale = Math.min(scaleX, scaleY);

    zoomLevel = scale;
    canvas.setZoom(scale);

    // Center the view
    const vpt = canvas.viewportTransform;
    vpt[4] = (wrapperW - imgW * scale) / 2;
    vpt[5] = (wrapperH - imgH * scale) / 2;
    canvas.setViewportTransform(vpt);
  } else {
    zoomLevel = 1;
    canvas.setZoom(1);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  }

  updateZoomDisplay();
  canvas.requestRenderAll();
}

export function rotatePlan() {
  const bg = canvas.backgroundImage;
  if (!bg) return;

  // Rotate 90° clockwise
  const currentAngle = bg.angle || 0;
  bg.set({ angle: currentAngle + 90 });

  // After rotation, re-fit to screen
  fitToScreen();
  canvas.requestRenderAll();
}

export function updateZoomDisplay() {
  const el = document.getElementById('zoom-display');
  if (el) {
    el.textContent = Math.round(zoomLevel * 100) + '%';
  }
}

function handleResize() {
  const wrapper = document.getElementById('canvas-wrapper');
  const rect = wrapper.getBoundingClientRect();
  canvas.setWidth(rect.width);
  canvas.setHeight(rect.height);
  canvas.requestRenderAll();
}
