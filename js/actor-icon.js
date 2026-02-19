/**
 * Actor Icon — Custom Fabric.js group: split circle with label
 * Uses Path objects for half-circles since fabric.Circle doesn't support startAngle/endAngle
 */

import { getCanvas } from './canvas-manager.js';

const ACTOR_RADIUS = 20;
const PRESET_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
  '#e67e22', '#9b59b6', '#1abc9c', '#e91e63',
  '#ffffff', '#808080', '#1a3a5c', '#1e5631',
  '#8b4513', '#d4b896',
];

function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.8;
}

function makeHalfCirclePath(r, side) {
  // Left half: arc from top to bottom on the left side
  // Right half: arc from bottom to top on the right side
  if (side === 'left') {
    // Start at top (0, -r), arc to bottom (0, r) via left
    return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} Z`;
  } else {
    // Start at top (0, -r), arc to bottom (0, r) via right
    return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} Z`;
  }
}

export function createActorIcon(x, y, options = {}) {
  const color = options.color || PRESET_COLORS[0];
  const label = options.label ?? 'A';
  const borderColor = isLightColor(color) ? '#333333' : color;
  const r = ACTOR_RADIUS;

  // Left half (colored) — semicircle path
  const leftHalf = new fabric.Path(makeHalfCirclePath(r, 'left'), {
    fill: color,
    stroke: null,
    originX: 'center',
    originY: 'center',
  });

  // Right half (white) — semicircle path
  const rightHalf = new fabric.Path(makeHalfCirclePath(r, 'right'), {
    fill: '#ffffff',
    stroke: null,
    originX: 'center',
    originY: 'center',
  });

  // Border circle
  const border = new fabric.Circle({
    radius: r,
    fill: 'transparent',
    stroke: borderColor,
    strokeWidth: 2.5,
    originX: 'center',
    originY: 'center',
  });

  // Label text
  const text = new fabric.FabricText(label, {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: '-apple-system, sans-serif',
    fill: '#333',
    originX: 'center',
    originY: 'center',
    left: 0,
    top: 0,
  });

  const group = new fabric.Group([leftHalf, rightHalf, border, text], {
    left: x,
    top: y,
    originX: 'center',
    originY: 'center',
    hasControls: false,
    hasBorders: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    subTargetCheck: false,
    // Custom data
    objectType: 'actor',
    actorColor: color,
    actorLabel: label,
  });

  return group;
}

export function updateActorColor(actor, newColor) {
  if (!actor || actor.objectType !== 'actor') return;
  const objects = actor.getObjects();
  // objects[0] = left half path, objects[2] = border circle
  const borderColor = isLightColor(newColor) ? '#333333' : newColor;
  objects[0].set('fill', newColor);
  objects[2].set('stroke', borderColor);
  actor.actorColor = newColor;
  actor.dirty = true;
  getCanvas().requestRenderAll();
}

export function updateActorLabel(actor, newLabel) {
  if (!actor || actor.objectType !== 'actor') return;
  const objects = actor.getObjects();
  // objects[3] = text
  objects[3].set('text', newLabel);
  actor.actorLabel = newLabel;
  actor.dirty = true;
  getCanvas().requestRenderAll();
}

export function getPresetColors() {
  return PRESET_COLORS;
}

export function renderActorProperties(actor) {
  const container = document.getElementById('panel-content');

  container.innerHTML = `
    <div class="prop-group">
      <label class="prop-label">Label</label>
      <input type="text" class="prop-input" id="actor-label" value="${actor.actorLabel}" maxlength="4">
    </div>
    <div class="prop-group">
      <label class="prop-label">Color</label>
      <div class="color-swatches" id="actor-colors">
        ${PRESET_COLORS.map(c => `
          <div class="color-swatch ${c === actor.actorColor ? 'selected' : ''}"
               style="background:${c}${c === '#ffffff' ? ';border:1px solid #666' : ''}" data-color="${c}"></div>
        `).join('')}
      </div>
    </div>
  `;

  // Label input
  const labelInput = document.getElementById('actor-label');
  labelInput.addEventListener('input', () => {
    updateActorLabel(actor, labelInput.value || 'A');
  });

  // Color swatches
  document.querySelectorAll('#actor-colors .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('#actor-colors .color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      updateActorColor(actor, swatch.dataset.color);
    });
  });
}
