/**
 * Camera Icon — Custom Fabric.js group: camera body + lens + direction cone
 */

import { getCanvas } from './canvas-manager.js';

const DEFAULT_FOV = 45;
const DEFAULT_CONE_LENGTH = 100;
const PRESET_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
  '#e67e22', '#9b59b6', '#1abc9c', '#e91e63',
];

export function createCameraIcon(x, y, options = {}) {
  const color = options.color || '#3498db';
  const fov = options.fov || DEFAULT_FOV;
  const coneLength = options.coneLength || DEFAULT_CONE_LENGTH;
  const label = options.label || '';

  const cone = buildCone(fov, coneLength, color);

  // Camera body (rectangle)
  const body = new fabric.Rect({
    width: 24,
    height: 18,
    fill: color,
    rx: 3,
    ry: 3,
    originX: 'center',
    originY: 'center',
    left: 0,
    top: 0,
  });

  // Lens circle
  const lens = new fabric.Circle({
    radius: 5,
    fill: '#222',
    stroke: '#fff',
    strokeWidth: 1.5,
    originX: 'center',
    originY: 'center',
    left: 0,
    top: 0,
  });

  // Optional label (up to 4 chars, e.g. CAM1)
  const labelText = new fabric.FabricText(label, {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: '-apple-system, sans-serif',
    fill: '#fff',
    originX: 'center',
    originY: 'top',
    top: 13,
    left: 0,
    visible: label.length > 0,
  });

  const group = new fabric.Group([cone, body, lens, labelText], {
    left: x,
    top: y,
    originX: 'center',
    originY: 'center',
    // Only rotation control
    hasControls: true,
    hasBorders: true,
    lockScalingX: true,
    lockScalingY: true,
    // Custom data
    objectType: 'camera',
    cameraColor: color,
    cameraFov: fov,
    cameraConeLength: coneLength,
    cameraLabel: label,
  });

  // Only show rotation control
  group.setControlsVisibility({
    tl: false, tr: false, bl: false, br: false,
    ml: false, mr: false, mt: false, mb: false,
    mtr: true,
  });

  return group;
}

function buildCone(fov, length, color) {
  const halfAngle = (fov / 2) * (Math.PI / 180);
  const tipX = 0;
  const tipY = 0;
  const leftX = -Math.sin(halfAngle) * length;
  const leftY = -length * Math.cos(halfAngle);
  const rightX = Math.sin(halfAngle) * length;
  const rightY = -length * Math.cos(halfAngle);

  // Convert color to rgba with opacity
  const rgbaColor = hexToRgba(color, 0.2);
  const strokeColor = hexToRgba(color, 0.5);

  const cone = new fabric.Triangle({
    width: Math.abs(leftX - rightX),
    height: length,
    fill: rgbaColor,
    stroke: strokeColor,
    strokeWidth: 1,
    originX: 'center',
    originY: 'bottom',
    left: 0,
    top: -length / 2 + 2,
    angle: 180,
  });

  return cone;
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
  // [0]=cone, [1]=body, [2]=lens, [3]=label
  objects[0].set({
    fill: hexToRgba(newColor, 0.2),
    stroke: hexToRgba(newColor, 0.5),
  });
  objects[1].set('fill', newColor);
  camera.cameraColor = newColor;
  camera.dirty = true;
  getCanvas().requestRenderAll();
}

export function updateCameraFov(camera, newFov) {
  if (!camera || camera.objectType !== 'camera') return;
  camera.cameraFov = newFov;

  // Rebuild cone
  const objects = camera.getObjects();
  const oldCone = objects[0];
  const newCone = buildCone(newFov, camera.cameraConeLength, camera.cameraColor);
  // Copy position properties
  newCone.set({ left: oldCone.left });
  camera.remove(oldCone);
  camera.insertAt(0, newCone);
  camera.dirty = true;
  getCanvas().requestRenderAll();
}

export function updateCameraConeLength(camera, newLength) {
  if (!camera || camera.objectType !== 'camera') return;
  camera.cameraConeLength = newLength;

  const objects = camera.getObjects();
  const oldCone = objects[0];
  const newCone = buildCone(camera.cameraFov, newLength, camera.cameraColor);
  newCone.set({ left: oldCone.left });
  camera.remove(oldCone);
  camera.insertAt(0, newCone);
  camera.dirty = true;
  getCanvas().requestRenderAll();
}

export function updateCameraLabel(camera, newLabel) {
  if (!camera || camera.objectType !== 'camera') return;
  const objects = camera.getObjects();
  objects[3].set({ text: newLabel, visible: newLabel.length > 0 });
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

  // Label
  document.getElementById('cam-label').addEventListener('input', (e) => {
    updateCameraLabel(camera, e.target.value);
  });

  // FOV slider
  document.getElementById('cam-fov').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('fov-val').textContent = val;
    updateCameraFov(camera, val);
  });

  // Cone length slider
  document.getElementById('cam-cone').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('cone-val').textContent = val;
    updateCameraConeLength(camera, val);
  });
}
