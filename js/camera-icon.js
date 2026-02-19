/**
 * Camera Icon — Triangle representing camera field of view
 * Wide base = front (filming direction), apex = back (camera position)
 * Group layout: [0]=triangle, [1]=label
 */

import { getCanvas } from './canvas-manager.js';

const DEFAULT_FOV = 45;
const DEFAULT_CONE_LENGTH = 80;
const PRESET_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
  '#e67e22', '#9b59b6', '#1abc9c', '#e91e63',
];

export function createCameraIcon(x, y, options = {}) {
  const color = options.color || '#3498db';
  const fov = options.fov || DEFAULT_FOV;
  const coneLength = options.coneLength || DEFAULT_CONE_LENGTH;
  const label = options.label || '';

  const triangle = buildTriangle(fov, coneLength, color);

  const labelText = new fabric.FabricText(label, {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: '-apple-system, sans-serif',
    fill: '#fff',
    originX: 'center',
    originY: 'center',
    top: coneLength * 0.2,
    left: 0,
    visible: label.length > 0,
  });

  const group = new fabric.Group([triangle, labelText], {
    left: x,
    top: y,
    originX: 'center',
    originY: 'center',
    hasControls: true,
    hasBorders: true,
    lockScalingX: true,
    lockScalingY: true,
    objectType: 'camera',
    cameraColor: color,
    cameraFov: fov,
    cameraConeLength: coneLength,
    cameraLabel: label,
  });

  group.setControlsVisibility({
    tl: false, tr: false, bl: false, br: false,
    ml: false, mr: false, mt: false, mb: false,
    mtr: true,
  });

  return group;
}

function buildTriangle(fov, length, color) {
  const halfAngle = (fov / 2) * (Math.PI / 180);
  const halfWidth = Math.tan(halfAngle) * length;

  // Apex at bottom (camera position / back), wide base at top (filming direction / front)
  const triangle = new fabric.Polygon([
    { x: 0, y: length / 2 },
    { x: -halfWidth, y: -length / 2 },
    { x: halfWidth, y: -length / 2 },
  ], {
    fill: hexToRgba(color, 0.25),
    stroke: color,
    strokeWidth: 1.5,
    originX: 'center',
    originY: 'center',
  });

  return triangle;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function updateCameraColor(camera, newColor) {
  if (!camera || camera.objectType !== 'camera') return;
  const objects = camera.getObjects();
  // [0]=triangle, [1]=label
  objects[0].set({
    fill: hexToRgba(newColor, 0.25),
    stroke: newColor,
  });
  camera.cameraColor = newColor;
  camera.dirty = true;
  getCanvas().requestRenderAll();
}

export function updateCameraFov(camera, newFov) {
  if (!camera || camera.objectType !== 'camera') return;
  camera.cameraFov = newFov;

  const objects = camera.getObjects();
  const oldTriangle = objects[0];
  const newTriangle = buildTriangle(newFov, camera.cameraConeLength, camera.cameraColor);
  camera.remove(oldTriangle);
  camera.insertAt(0, newTriangle);
  camera.dirty = true;
  getCanvas().requestRenderAll();
}

export function updateCameraConeLength(camera, newLength) {
  if (!camera || camera.objectType !== 'camera') return;
  camera.cameraConeLength = newLength;

  const objects = camera.getObjects();
  const oldTriangle = objects[0];
  const newTriangle = buildTriangle(camera.cameraFov, newLength, camera.cameraColor);
  camera.remove(oldTriangle);
  camera.insertAt(0, newTriangle);
  camera.dirty = true;
  getCanvas().requestRenderAll();
}

export function updateCameraLabel(camera, newLabel) {
  if (!camera || camera.objectType !== 'camera') return;
  const objects = camera.getObjects();
  // [1] = label
  objects[1].set({ text: newLabel, visible: newLabel.length > 0 });
  camera.cameraLabel = newLabel;
  camera.dirty = true;
  getCanvas().requestRenderAll();
}

export function getCameraPresetColors() {
  return PRESET_COLORS;
}

export function renderCameraProperties(camera) {
  const container = document.getElementById('panel-content');

  container.innerHTML = `
    <div class="prop-group">
      <label class="prop-label">Label</label>
      <input type="text" class="prop-input" id="cam-label" value="${camera.cameraLabel}" maxlength="4" placeholder="CAM1">
    </div>
    <div class="prop-group">
      <label class="prop-label">FOV: <span id="fov-val">${camera.cameraFov}</span>&deg;</label>
      <input type="range" class="prop-range" id="cam-fov" min="10" max="120" value="${camera.cameraFov}">
    </div>
    <div class="prop-group">
      <label class="prop-label">Cone Length: <span id="cone-val">${camera.cameraConeLength}</span></label>
      <input type="range" class="prop-range" id="cam-cone" min="30" max="300" value="${camera.cameraConeLength}">
    </div>
  `;

  document.getElementById('cam-label').addEventListener('input', (e) => {
    updateCameraLabel(camera, e.target.value);
  });

  document.getElementById('cam-fov').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('fov-val').textContent = val;
    updateCameraFov(camera, val);
  });

  document.getElementById('cam-cone').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('cone-val').textContent = val;
    updateCameraConeLength(camera, val);
  });
}
