/**
 * Movement Arrow — Quadratic Bezier curve with arrowhead and draggable control point
 */

import { getCanvas } from './canvas-manager.js';

const ARROW_HEAD_SIZE = 10;
const CONTROL_POINT_RADIUS = 6;
const CONTROL_POINT_HIT_PADDING = 12;

const PRESET_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
  '#e67e22', '#9b59b6', '#1abc9c', '#e91e63',
  '#ffffff', '#808080', '#1a3a5c', '#1e5631',
  '#8b4513', '#d4b896',
];

/**
 * Create a movement arrow from start to end with a Bezier control point
 */
export function createMovementArrow(startX, startY, endX, endY, options = {}) {
  const color = options.color || '#e74c3c';
  const lineWidth = options.lineWidth || 2.5;
  const strokeDashArray = options.strokeDashArray || null;

  // Initial control point: midpoint, offset perpendicular to line
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Offset perpendicular by 20% of length
  const offsetX = midX + (-dy / len) * len * 0.2;
  const offsetY = midY + (dx / len) * len * 0.2;

  const arrowData = {
    startX, startY,
    endX, endY,
    cpX: offsetX,
    cpY: offsetY,
    color,
    lineWidth,
    strokeDashArray,
  };

  // Build the path and arrowhead
  const { path, arrowHead } = buildArrowObjects(arrowData);

  // Control point circle (always visible, black)
  const controlPoint = new fabric.Circle({
    left: arrowData.cpX,
    top: arrowData.cpY,
    radius: CONTROL_POINT_RADIUS,
    fill: '#000000',
    stroke: '#fff',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
    hasControls: false,
    hasBorders: false,
    padding: CONTROL_POINT_HIT_PADDING,
    visible: true,
    objectType: 'controlPoint',
    evented: true,
  });

  // Start point handle
  const startPoint = new fabric.Circle({
    left: arrowData.startX,
    top: arrowData.startY,
    radius: 5,
    fill: '#000000',
    stroke: '#fff',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
    hasControls: false,
    hasBorders: false,
    padding: CONTROL_POINT_HIT_PADDING,
    visible: true,
    objectType: 'startPoint',
    evented: true,
  });

  // End point handle
  const endPoint = new fabric.Circle({
    left: arrowData.endX,
    top: arrowData.endY,
    radius: 5,
    fill: '#000000',
    stroke: '#fff',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
    hasControls: false,
    hasBorders: false,
    padding: CONTROL_POINT_HIT_PADDING,
    visible: true,
    objectType: 'endPoint',
    evented: true,
  });

  // We store everything as separate objects but link them
  const arrowId = 'arrow_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  path.arrowId = arrowId;
  path.objectType = 'movementArrow';
  path.arrowColor = color;
  path.arrowData = arrowData;
  path.selectable = true;
  path.evented = true;
  path.hasControls = false;
  path.hasBorders = true;
  path.lockMovementX = true;
  path.lockMovementY = true;

  arrowHead.arrowId = arrowId;
  arrowHead.objectType = 'arrowHead';
  arrowHead.selectable = false;
  arrowHead.evented = false;

  controlPoint.arrowId = arrowId;
  startPoint.arrowId = arrowId;
  endPoint.arrowId = arrowId;

  const canvas = getCanvas();
  canvas.add(path, arrowHead, controlPoint, startPoint, endPoint);

  // Wire up control point dragging
  setupControlPointDrag(arrowId);

  return { path, arrowHead, controlPoint, startPoint, endPoint, arrowId };
}

function buildArrowObjects(data) {
  const { startX, startY, endX, endY, cpX, cpY, color, lineWidth, strokeDashArray } = data;

  // Quadratic Bezier path
  const pathStr = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
  const pathOpts = {
    fill: null,
    stroke: color,
    strokeWidth: lineWidth,
    strokeLineCap: 'round',
    objectCaching: false,
  };
  if (strokeDashArray) pathOpts.strokeDashArray = strokeDashArray;
  const path = new fabric.Path(pathStr, pathOpts);

  // Arrowhead: calculate tangent at endpoint
  // Derivative of Q(t) at t=1: 2(1-t)(P1-P0) + 2t(P2-P1) at t=1 → 2(P2-P1)
  const tangentX = 2 * (endX - cpX);
  const tangentY = 2 * (endY - cpY);
  const angle = Math.atan2(tangentY, tangentX);

  const arrowHead = buildArrowHead(endX, endY, angle, color);

  return { path, arrowHead };
}

function buildArrowHead(x, y, angle, color) {
  const size = ARROW_HEAD_SIZE;
  // Triangle pointing in the direction of angle
  const p1x = x;
  const p1y = y;
  const p2x = x - size * Math.cos(angle - Math.PI / 6);
  const p2y = y - size * Math.sin(angle - Math.PI / 6);
  const p3x = x - size * Math.cos(angle + Math.PI / 6);
  const p3y = y - size * Math.sin(angle + Math.PI / 6);

  const triangle = new fabric.Polygon([
    { x: p1x, y: p1y },
    { x: p2x, y: p2y },
    { x: p3x, y: p3y },
  ], {
    fill: color,
    stroke: null,
    objectCaching: false,
  });

  return triangle;
}

function setupControlPointDrag(arrowId) {
  const canvas = getCanvas();

  const getArrowParts = () => {
    const objects = canvas.getObjects();
    return {
      path: objects.find(o => o.arrowId === arrowId && o.objectType === 'movementArrow'),
      arrowHead: objects.find(o => o.arrowId === arrowId && o.objectType === 'arrowHead'),
      controlPoint: objects.find(o => o.arrowId === arrowId && o.objectType === 'controlPoint'),
      startPoint: objects.find(o => o.arrowId === arrowId && o.objectType === 'startPoint'),
      endPoint: objects.find(o => o.arrowId === arrowId && o.objectType === 'endPoint'),
    };
  };

  // Redraw arrow when any handle is moved
  const onMoving = (e) => {
    const obj = e.target;
    if (obj.arrowId !== arrowId) return;

    const parts = getArrowParts();
    if (!parts.path) return;

    const data = parts.path.arrowData;

    if (obj.objectType === 'controlPoint') {
      data.cpX = obj.left;
      data.cpY = obj.top;
    } else if (obj.objectType === 'startPoint') {
      data.startX = obj.left;
      data.startY = obj.top;
    } else if (obj.objectType === 'endPoint') {
      data.endX = obj.left;
      data.endY = obj.top;
    } else {
      return;
    }

    rebuildArrow(parts, data);
  };

  canvas.on('object:moving', onMoving);

  // Store cleanup ref on path
  setTimeout(() => {
    const parts = getArrowParts();
    if (parts.path) {
      parts.path._cleanupMoving = () => canvas.off('object:moving', onMoving);
    }
  }, 0);
}

function rebuildArrow(parts, data) {
  const canvas = getCanvas();
  const { startX, startY, endX, endY, cpX, cpY, color, lineWidth, strokeDashArray } = data;

  // Remove old path and arrowhead, replace with new ones
  const arrowId = parts.path.arrowId;
  const oldCleanup = parts.path._cleanupMoving;

  canvas.remove(parts.path);
  canvas.remove(parts.arrowHead);

  // Build new path
  const pathStr = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
  const pathOpts = {
    fill: null,
    stroke: color,
    strokeWidth: lineWidth,
    strokeLineCap: 'round',
    objectCaching: false,
  };
  if (strokeDashArray) pathOpts.strokeDashArray = strokeDashArray;
  const newPath = new fabric.Path(pathStr, pathOpts);
  newPath.arrowId = arrowId;
  newPath.objectType = 'movementArrow';
  newPath.arrowColor = color;
  newPath.arrowData = data;
  newPath.selectable = true;
  newPath.evented = true;
  newPath.hasControls = false;
  newPath.hasBorders = true;
  newPath.lockMovementX = true;
  newPath.lockMovementY = true;
  newPath._cleanupMoving = oldCleanup;

  // Build new arrowhead
  const tangentX = 2 * (endX - cpX);
  const tangentY = 2 * (endY - cpY);
  const angle = Math.atan2(tangentY, tangentX);
  const newArrowHead = buildArrowHead(endX, endY, angle, color);
  newArrowHead.arrowId = arrowId;
  newArrowHead.objectType = 'arrowHead';
  newArrowHead.selectable = false;
  newArrowHead.evented = false;

  // Insert behind control points
  canvas.add(newPath, newArrowHead);
  // Move to back (behind control handles)
  canvas.sendObjectToBack(newArrowHead);
  canvas.sendObjectToBack(newPath);

  canvas.requestRenderAll();
}

/**
 * Show/hide control handles for an arrow
 */
export function showArrowHandles(arrowId, visible) {
  const canvas = getCanvas();
  canvas.getObjects().forEach(o => {
    if (o.arrowId === arrowId && (o.objectType === 'controlPoint' || o.objectType === 'startPoint' || o.objectType === 'endPoint')) {
      o.set({ visible, evented: visible });
    }
  });
  canvas.requestRenderAll();
}

/**
 * Remove all objects belonging to an arrow
 */
export function removeArrow(arrowId) {
  const canvas = getCanvas();
  const toRemove = canvas.getObjects().filter(o => o.arrowId === arrowId);
  const path = toRemove.find(o => o.objectType === 'movementArrow');
  if (path && path._cleanupMoving) path._cleanupMoving();
  toRemove.forEach(o => canvas.remove(o));
  canvas.requestRenderAll();
}

export function updateArrowColor(arrowId, newColor) {
  const canvas = getCanvas();
  canvas.getObjects().forEach(o => {
    if (o.arrowId !== arrowId) return;
    if (o.objectType === 'movementArrow') {
      o.set('stroke', newColor);
      o.arrowColor = newColor;
      o.arrowData.color = newColor;
    } else if (o.objectType === 'arrowHead') {
      o.set('fill', newColor);
    }
  });
  canvas.requestRenderAll();
}

export function getArrowPresetColors() {
  return PRESET_COLORS;
}

export function renderArrowProperties(path) {
  const container = document.getElementById('panel-content');

  container.innerHTML = `
    <div class="prop-group">
      <label class="prop-label">Color</label>
      <div class="color-swatches" id="arrow-colors">
        ${PRESET_COLORS.map(c => `
          <div class="color-swatch ${c === path.arrowColor ? 'selected' : ''}"
               style="background:${c}" data-color="${c}"></div>
        `).join('')}
      </div>
    </div>
  `;

  document.querySelectorAll('#arrow-colors .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('#arrow-colors .color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      updateArrowColor(path.arrowId, swatch.dataset.color);
    });
  });
}
