/**
 * Trail Manager — Drag-to-move trails for actors & cameras
 *
 * When an actor/camera is dragged in select mode, a ghost copy stays at
 * the start position and a trail line connects start → end.
 * Actor trails: dotted line in actor's color.
 * Camera trails: solid black line with directional arrowhead.
 * Trails are chainable — dragging again extends the chain.
 * Each trail segment gets an auto-placed control point at the midpoint
 * that you can drag to bend the path around obstacles.
 */

import { getCanvas } from './canvas-manager.js';
import { saveState } from './history-manager.js';

// Store pre-drag position: object reference → { left, top, angle }
const dragStartPositions = new Map();

// ── Init ──

export function initTrailManager() {
  const canvas = getCanvas();

  // Capture position when user clicks on an actor (before drag starts)
  // Cameras use the separate camera-arrow tool instead
  canvas.on('mouse:down', (opt) => {
    if (!opt.target) return;
    const target = opt.target;
    if (target.objectType !== 'actor') return;

    // Store current position — we'll check if it moved on mouse:up / object:modified
    dragStartPositions.set(target, {
      left: target.left,
      top: target.top,
      angle: target.angle || 0,
    });
  });

  // After drag completes, create trail if position changed
  canvas.on('object:modified', (opt) => {
    const target = opt.target;
    if (!target) return;
    if (target.objectType !== 'actor') return;

    const startPos = dragStartPositions.get(target);
    if (!startPos) return;
    dragStartPositions.delete(target);

    // Only create trail if moved more than 5px (ignore accidental taps)
    const dx = target.left - startPos.left;
    const dy = target.top - startPos.top;
    if (Math.sqrt(dx * dx + dy * dy) < 5) return;

    // Create the trail (async for clone, but we don't need to await here)
    createTrailSegment(target, startPos);
  });

  // Also clear stored position if user just clicks without dragging
  canvas.on('mouse:up', (opt) => {
    // Clean up after a short delay — if object:modified didn't fire, it was just a click
    setTimeout(() => {
      // Only clear entries where position hasn't changed
      for (const [obj, pos] of dragStartPositions) {
        const dx = obj.left - pos.left;
        const dy = obj.top - pos.top;
        if (Math.sqrt(dx * dx + dy * dy) < 5) {
          dragStartPositions.delete(obj);
        }
      }
    }, 100);
  });

  // Rebuild Bezier curves when trail control points are dragged
  canvas.on('object:moving', (e) => {
    const obj = e.target;
    if (!obj || obj.objectType !== 'trailControlPoint') return;

    const trailLine = canvas.getObjects().find(
      o => o.trailId === obj.trailId
        && o.objectType === 'trailLine'
        && o.trailSegmentIndex === obj.trailSegmentIndex
    );
    if (!trailLine) return;

    const data = trailLine.trailSegmentData;
    data.cpX = obj.left;
    data.cpY = obj.top;

    rebuildTrailSegment(data);
  });
}

// ── Create Trail Segment ──

async function createTrailSegment(target, startPos) {
  const canvas = getCanvas();

  // Assign or reuse trailId for chaining
  const trailId = target.trailId ||
    ('trail_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  target.trailId = trailId;

  // Count existing segments for index
  const existingSegments = canvas.getObjects().filter(
    o => o.trailId === trailId && o.objectType === 'trailLine'
  );
  const segmentIndex = existingSegments.length;

  const sourceType = target.objectType; // 'actor' or 'camera'
  const color = sourceType === 'actor' ? (target.actorColor || '#e74c3c') : '#000000';

  // Clone the object → ghost at start position
  let ghost;
  try {
    ghost = await target.clone();
  } catch (err) {
    console.warn('Trail: clone failed, creating simple ghost', err);
    // Fallback: create a simple circle as ghost
    ghost = new fabric.Circle({
      left: startPos.left,
      top: startPos.top,
      radius: 14,
      fill: color,
      opacity: 0.35,
      originX: 'center',
      originY: 'center',
    });
  }

  ghost.set({
    left: startPos.left,
    top: startPos.top,
    angle: startPos.angle,
    opacity: 0.35,
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false,
    objectType: 'trailGhost',
    trailId: trailId,
    trailSegmentIndex: segmentIndex,
  });

  // Auto-place control point at midpoint so user can immediately bend the path
  const midX = (startPos.left + target.left) / 2;
  const midY = (startPos.top + target.top) / 2;

  // Build trail line as a Bezier curve from the start
  const segmentData = {
    trailId,
    segmentIndex,
    startX: startPos.left,
    startY: startPos.top,
    endX: target.left,
    endY: target.top,
    cpX: midX,
    cpY: midY,
    sourceType,
    color,
  };

  const trailLine = buildTrailLine(segmentData);

  // For cameras, add arrowhead
  let trailArrow = null;
  if (sourceType === 'camera') {
    trailArrow = buildTrailArrowHead(segmentData);
  }

  // Create the draggable control point handle at midpoint
  const controlPoint = buildControlPoint(trailId, segmentIndex, midX, midY);

  // Add to canvas — ghost and line behind, control point on top
  canvas.add(ghost);
  canvas.sendObjectToBack(ghost);
  canvas.add(trailLine);
  canvas.sendObjectToBack(trailLine);
  if (trailArrow) {
    canvas.add(trailArrow);
    canvas.sendObjectToBack(trailArrow);
  }
  canvas.add(controlPoint); // on top so it's easy to grab

  canvas.requestRenderAll();
  saveState();
}

// ── Build Trail Line ──

function buildTrailLine(segmentData) {
  const { trailId, segmentIndex, startX, startY, endX, endY, cpX, cpY, sourceType, color } = segmentData;

  let pathStr;
  if (cpX !== null && cpY !== null) {
    pathStr = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;
  } else {
    pathStr = `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const isActor = sourceType === 'actor';

  return new fabric.Path(pathStr, {
    fill: null,
    stroke: color,
    strokeWidth: isActor ? 2 : 2.5,
    strokeDashArray: isActor ? [6, 4] : null,
    strokeLineCap: 'round',
    objectCaching: false,
    selectable: true,
    evented: true,
    hasControls: false,
    hasBorders: true,
    lockMovementX: true,
    lockMovementY: true,
    perPixelTargetFind: true,
    padding: 8,
    objectType: 'trailLine',
    trailId: trailId,
    trailSegmentIndex: segmentIndex,
    trailSegmentData: { ...segmentData },
  });
}

// ── Build Trail Arrowhead (cameras only) ──

function buildTrailArrowHead(segmentData) {
  const { trailId, segmentIndex, startX, startY, endX, endY, cpX, cpY, color } = segmentData;

  // Calculate tangent angle at endpoint
  let tangentX, tangentY;
  if (cpX !== null && cpY !== null) {
    tangentX = 2 * (endX - cpX);
    tangentY = 2 * (endY - cpY);
  } else {
    tangentX = endX - startX;
    tangentY = endY - startY;
  }
  const angle = Math.atan2(tangentY, tangentX);

  const size = 10;
  const p1x = endX;
  const p1y = endY;
  const p2x = endX - size * Math.cos(angle - Math.PI / 6);
  const p2y = endY - size * Math.sin(angle - Math.PI / 6);
  const p3x = endX - size * Math.cos(angle + Math.PI / 6);
  const p3y = endY - size * Math.sin(angle + Math.PI / 6);

  return new fabric.Polygon([
    { x: p1x, y: p1y },
    { x: p2x, y: p2y },
    { x: p3x, y: p3y },
  ], {
    fill: color,
    stroke: null,
    objectCaching: false,
    selectable: false,
    evented: false,
    objectType: 'trailArrowHead',
    trailId: trailId,
    trailSegmentIndex: segmentIndex,
  });
}

// ── Build Control Point Handle ──

function buildControlPoint(trailId, segmentIndex, x, y) {
  return new fabric.Circle({
    left: x,
    top: y,
    radius: 7,
    fill: '#0d6efd',
    stroke: '#fff',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
    hasControls: false,
    hasBorders: false,
    padding: 14,
    objectType: 'trailControlPoint',
    trailId: trailId,
    trailSegmentIndex: segmentIndex,
    evented: true,
    selectable: true,
  });
}

// ── Click trail line → select its control point ──

export function selectTrailControlPoint(trailLine) {
  const canvas = getCanvas();
  const data = trailLine.trailSegmentData;

  const cp = canvas.getObjects().find(
    o => o.trailId === data.trailId
      && o.objectType === 'trailControlPoint'
      && o.trailSegmentIndex === data.segmentIndex
  );

  if (cp) {
    canvas.setActiveObject(cp);
    canvas.requestRenderAll();
  }
}

// ── Rebuild Trail Segment (after control point move) ──

function rebuildTrailSegment(segmentData) {
  const canvas = getCanvas();
  const { trailId, segmentIndex } = segmentData;

  // Find and remove old line and arrowhead
  const oldLine = canvas.getObjects().find(
    o => o.trailId === trailId && o.objectType === 'trailLine' && o.trailSegmentIndex === segmentIndex
  );
  const oldArrow = canvas.getObjects().find(
    o => o.trailId === trailId && o.objectType === 'trailArrowHead' && o.trailSegmentIndex === segmentIndex
  );

  if (oldLine) canvas.remove(oldLine);
  if (oldArrow) canvas.remove(oldArrow);

  // Build replacements
  const newLine = buildTrailLine(segmentData);
  canvas.add(newLine);
  canvas.sendObjectToBack(newLine);

  if (segmentData.sourceType === 'camera') {
    const newArrow = buildTrailArrowHead(segmentData);
    canvas.add(newArrow);
    canvas.sendObjectToBack(newArrow);
  }

  canvas.requestRenderAll();
}

// ── Remove Trail ──

export function removeTrail(trailId) {
  const canvas = getCanvas();
  const toRemove = canvas.getObjects().filter(o => o.trailId === trailId);
  toRemove.forEach(o => canvas.remove(o));
  canvas.requestRenderAll();
}

// ── Export Helpers (hide/show control points) ──

export function hideTrailControlPoints() {
  const canvas = getCanvas();
  canvas.getObjects().forEach(o => {
    if (o.objectType === 'trailControlPoint') {
      o.set({ visible: false });
    }
  });
}

export function showTrailControlPoints() {
  const canvas = getCanvas();
  canvas.getObjects().forEach(o => {
    if (o.objectType === 'trailControlPoint') {
      o.set({ visible: true });
    }
  });
}
