/**
 * Movement Arrow — Smooth curve with arrowhead and multiple draggable control points
 * Uses Catmull-Rom spline converted to cubic Bezier segments.
 * Long-press on the curve to add new control points for finer control.
 */

import { getCanvas } from './canvas-manager.js';

const ARROW_HEAD_SIZE = 10;
const CONTROL_POINT_RADIUS = 6;
const CONTROL_POINT_HIT_PADDING = 12;
const CATMULL_ROM_TENSION = 6;
const MIN_CP_DISTANCE = 20; // Minimum distance between control points

const PRESET_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
  '#e67e22', '#9b59b6', '#1abc9c', '#e91e63',
  '#ffffff', '#808080', '#1a3a5c', '#1e5631',
  '#8b4513', '#d4b896',
];

// ── Curve Math ──

function getAllPoints(data) {
  return [
    { x: data.startX, y: data.startY },
    ...data.controlPoints,
    { x: data.endX, y: data.endY },
  ];
}

function buildCatmullRomPath(points) {
  if (points.length < 2) return { pathStr: '', lastCP2: null };

  if (points.length === 2) {
    return {
      pathStr: `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`,
      lastCP2: points[0],
    };
  }

  let pathStr = `M ${points[0].x} ${points[0].y}`;
  let lastCP2 = null;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / CATMULL_ROM_TENSION;
    const cp1y = p1.y + (p2.y - p0.y) / CATMULL_ROM_TENSION;
    const cp2x = p2.x - (p3.x - p1.x) / CATMULL_ROM_TENSION;
    const cp2y = p2.y - (p3.y - p1.y) / CATMULL_ROM_TENSION;

    pathStr += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
    lastCP2 = { x: cp2x, y: cp2y };
  }

  return { pathStr, lastCP2 };
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

// ── Object Builders ──

function buildPathObject(pathStr, data) {
  const pathOpts = {
    fill: null,
    stroke: data.color,
    strokeWidth: data.lineWidth,
    strokeLineCap: 'round',
    objectCaching: false,
  };
  if (data.strokeDashArray) pathOpts.strokeDashArray = data.strokeDashArray;

  const path = new fabric.Path(pathStr, pathOpts);
  path.objectType = 'movementArrow';
  path.arrowColor = data.color;
  path.arrowData = data;
  path.selectable = true;
  path.evented = true;
  path.hasControls = false;
  path.hasBorders = true;
  path.lockMovementX = true;
  path.lockMovementY = true;

  return path;
}

function buildArrowHead(x, y, angle, color) {
  const size = ARROW_HEAD_SIZE;
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

  triangle.objectType = 'arrowHead';
  triangle.selectable = false;
  triangle.evented = false;

  return triangle;
}

function buildControlPointCircle(x, y, cpIndex) {
  const circle = new fabric.Circle({
    left: x,
    top: y,
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
  circle.cpIndex = cpIndex;
  return circle;
}

function buildEndpointCircle(x, y, objectType) {
  return new fabric.Circle({
    left: x,
    top: y,
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
    objectType: objectType,
    evented: true,
  });
}

// ── Arrow Parts Helper ──

function getArrowParts(arrowId) {
  const canvas = getCanvas();
  const objects = canvas.getObjects();
  return {
    path: objects.find(o => o.arrowId === arrowId && o.objectType === 'movementArrow'),
    arrowHead: objects.find(o => o.arrowId === arrowId && o.objectType === 'arrowHead'),
    controlPoints: objects
      .filter(o => o.arrowId === arrowId && o.objectType === 'controlPoint')
      .sort((a, b) => a.cpIndex - b.cpIndex),
    startPoint: objects.find(o => o.arrowId === arrowId && o.objectType === 'startPoint'),
    endPoint: objects.find(o => o.arrowId === arrowId && o.objectType === 'endPoint'),
  };
}

// ── Arrow Creation ──

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

  let offsetX = midX;
  let offsetY = midY;
  if (len > 0) {
    offsetX = midX + (-dy / len) * len * 0.2;
    offsetY = midY + (dx / len) * len * 0.2;
  }

  const arrowData = {
    startX, startY,
    endX, endY,
    controlPoints: [{ x: offsetX, y: offsetY }],
    color,
    lineWidth,
    strokeDashArray,
  };

  // Build path and arrowhead
  const allPoints = getAllPoints(arrowData);
  const { pathStr, lastCP2 } = buildCatmullRomPath(allPoints);

  const path = buildPathObject(pathStr, arrowData);

  // Arrowhead
  const endPt = allPoints[allPoints.length - 1];
  const tangentX = endPt.x - lastCP2.x;
  const tangentY = endPt.y - lastCP2.y;
  const angle = Math.atan2(tangentY, tangentX);
  const arrowHead = buildArrowHead(endPt.x, endPt.y, angle, color);

  // Control point circles
  const controlCircles = arrowData.controlPoints.map((cp, i) =>
    buildControlPointCircle(cp.x, cp.y, i)
  );

  // Start/end handles
  const startPoint = buildEndpointCircle(startX, startY, 'startPoint');
  const endPoint = buildEndpointCircle(endX, endY, 'endPoint');

  // Link all objects with arrowId
  const arrowId = 'arrow_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  [path, arrowHead, ...controlCircles, startPoint, endPoint].forEach(o => {
    o.arrowId = arrowId;
  });

  const canvas = getCanvas();
  canvas.add(path, arrowHead, ...controlCircles, startPoint, endPoint);

  // Wire up dragging
  setupControlPointDrag(arrowId);

  return { path, arrowHead, controlCircles, startPoint, endPoint, arrowId };
}

// ── Control Point Dragging ──

function setupControlPointDrag(arrowId) {
  const canvas = getCanvas();

  const onMoving = (e) => {
    const obj = e.target;
    if (obj.arrowId !== arrowId) return;

    const parts = getArrowParts(arrowId);
    if (!parts.path) return;

    const data = parts.path.arrowData;

    if (obj.objectType === 'controlPoint') {
      data.controlPoints[obj.cpIndex].x = obj.left;
      data.controlPoints[obj.cpIndex].y = obj.top;
    } else if (obj.objectType === 'startPoint') {
      data.startX = obj.left;
      data.startY = obj.top;
    } else if (obj.objectType === 'endPoint') {
      data.endX = obj.left;
      data.endY = obj.top;
    } else {
      return;
    }

    rebuildArrow(arrowId);
  };

  canvas.on('object:moving', onMoving);

  // Store cleanup ref on path
  setTimeout(() => {
    const parts = getArrowParts(arrowId);
    if (parts.path) {
      parts.path._cleanupMoving = () => canvas.off('object:moving', onMoving);
    }
  }, 0);
}

// ── Rebuild Arrow (path + arrowhead only, control circles stay) ──

function rebuildArrow(arrowId) {
  const canvas = getCanvas();
  const parts = getArrowParts(arrowId);
  if (!parts.path) return;

  const data = parts.path.arrowData;
  const oldCleanup = parts.path._cleanupMoving;

  // Remove old path and arrowhead
  canvas.remove(parts.path);
  canvas.remove(parts.arrowHead);

  // Build new path
  const allPoints = getAllPoints(data);
  const { pathStr, lastCP2 } = buildCatmullRomPath(allPoints);

  const newPath = buildPathObject(pathStr, data);
  newPath.arrowId = arrowId;
  newPath._cleanupMoving = oldCleanup;

  // Build new arrowhead
  const endPt = allPoints[allPoints.length - 1];
  const tangentX = endPt.x - lastCP2.x;
  const tangentY = endPt.y - lastCP2.y;
  const angle = Math.atan2(tangentY, tangentX);
  const newArrowHead = buildArrowHead(endPt.x, endPt.y, angle, data.color);
  newArrowHead.arrowId = arrowId;

  // Insert behind control points
  canvas.add(newPath, newArrowHead);
  canvas.sendObjectToBack(newArrowHead);
  canvas.sendObjectToBack(newPath);

  canvas.requestRenderAll();
}

// ── Add Control Point (long-press on curve) ──

export function addControlPointToArrow(arrowId, x, y) {
  const parts = getArrowParts(arrowId);
  if (!parts.path) return;

  const data = parts.path.arrowData;
  const allPoints = getAllPoints(data);

  // Check minimum distance from existing points
  for (const pt of allPoints) {
    const d = Math.sqrt((x - pt.x) ** 2 + (y - pt.y) ** 2);
    if (d < MIN_CP_DISTANCE) return;
  }

  // Find which segment the new point is closest to
  let bestDist = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < allPoints.length - 1; i++) {
    const d = distToSegment(x, y,
      allPoints[i].x, allPoints[i].y,
      allPoints[i + 1].x, allPoints[i + 1].y
    );
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }

  // Insert the new control point in the data array
  // bestIndex in allPoints maps to insertion index in controlPoints
  data.controlPoints.splice(bestIndex, 0, { x, y });

  // Remove all old control point circles and recreate with correct indices
  const canvas = getCanvas();
  parts.controlPoints.forEach(cp => canvas.remove(cp));

  const newCircles = data.controlPoints.map((cp, i) => {
    const circle = buildControlPointCircle(cp.x, cp.y, i);
    circle.arrowId = arrowId;
    return circle;
  });

  newCircles.forEach(c => canvas.add(c));

  // Rebuild the arrow path
  rebuildArrow(arrowId);
}

// ── Show/hide control handles ──

export function showArrowHandles(arrowId, visible) {
  const canvas = getCanvas();
  canvas.getObjects().forEach(o => {
    if (o.arrowId === arrowId && (o.objectType === 'controlPoint' || o.objectType === 'startPoint' || o.objectType === 'endPoint')) {
      o.set({ visible, evented: visible });
    }
  });
  canvas.requestRenderAll();
}

// ── Remove all objects belonging to an arrow ──

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
