/**
 * App — Bootstrap, state management, toolbar logic
 */

import { initCanvas, getCanvas, fitToScreen, rotatePlan, getZoom } from './canvas-manager.js';
import { initTouchHandler } from './touch-handler.js';
import { initPdfLoader, goToPage, getCurrentPage, getTotalPages, isPdf } from './pdf-loader.js';
import { createActorIcon, renderActorProperties } from './actor-icon.js';
import { createCameraIcon, renderCameraProperties } from './camera-icon.js';
import { renderArrowProperties } from './movement-arrow.js';
import { initTrailManager, selectTrailControlPoint, removeTrail } from './trail-manager.js';
import { placeText, renderTextProperties } from './text-tool.js';
import { exportPNG, exportPDF } from './export-manager.js';
import { initHistory, undo, redo, saveState } from './history-manager.js';

// ── State ──
let currentTool = 'select';
let actorConfig = { color: '#e74c3c', label: 'A' };
let cameraConfig = { label: '' };
let textConfig = { color: '#ffffff' };

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  const canvas = initCanvas();

  initTouchHandler({
    onLongPress: handleLongPress,
  });

  initPdfLoader(handlePageChange);

  initHistory(handleHistoryState);

  initTrailManager();

  setupToolbar();
  setupActorPopover();
  setupCameraPopover();
  setupTextPopover();
  setupTopBar();
  setupStatusBar();
  setupCanvasEvents(canvas);
  setupKeyboard();

  setStatus('Ready — load a floor plan to begin');
});

// ── Toolbar ──
function setupToolbar() {
  // Tool buttons
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      setTool(btn.dataset.tool);
    });
  });

  // Load plan button
  document.getElementById('btn-load-plan').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  // Delete button
  document.getElementById('btn-delete').addEventListener('click', deleteSelected);
}

function setTool(tool) {
  currentTool = tool;

  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });

  // Show/hide popovers
  const actorPopover = document.getElementById('actor-popover');
  const cameraPopover = document.getElementById('camera-popover');
  const textPopover = document.getElementById('text-popover');

  actorPopover.classList.toggle('hidden', tool !== 'actor');
  cameraPopover.classList.toggle('hidden', tool !== 'camera');
  textPopover.classList.toggle('hidden', tool !== 'text');

  const canvas = getCanvas();
  if (tool === 'select') {
    canvas.selection = true;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
    setInteractive(true);
  } else {
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';
    setInteractive(false);
  }

  setStatus(getToolStatus(tool));
}

function setInteractive(enabled) {
  const canvas = getCanvas();
  canvas.forEachObject(o => {
    // Always keep these interactive
    if (o.objectType === 'controlPoint' || o.objectType === 'startPoint' || o.objectType === 'endPoint') return;
    if (o.objectType === 'trailControlPoint') return;

    // Trail ghosts and arrowheads are never interactive
    if (o.objectType === 'trailGhost' || o.objectType === 'trailArrowHead') return;

    o.selectable = enabled;
    o.evented = enabled;
  });
}

function getToolStatus(tool) {
  switch (tool) {
    case 'select': return 'Select mode — drag actors/cameras to create movement trails';
    case 'actor': return 'Actor mode — pick color/label, then tap to place';
    case 'camera': return 'Camera mode — tap to place camera';
    case 'text': return 'Text mode — tap to place text';
    default: return '';
  }
}

// ── Actor Popover ──
function setupActorPopover() {
  // Label input
  const labelInput = document.getElementById('actor-config-label');
  labelInput.addEventListener('input', () => {
    actorConfig.label = labelInput.value || 'A';
  });

  // Prevent popover clicks from propagating to toolbar
  document.getElementById('actor-popover').addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Color swatches
  document.querySelectorAll('#actor-config-colors .popover-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('#actor-config-colors .popover-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      actorConfig.color = swatch.dataset.color;
    });
  });
}

// ── Camera Popover ──
function setupCameraPopover() {
  const labelInput = document.getElementById('camera-config-label');
  labelInput.addEventListener('input', () => {
    cameraConfig.label = labelInput.value || '';
  });

  document.getElementById('camera-popover').addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// ── Text Popover ──
function setupTextPopover() {
  const colorSwatches = document.querySelectorAll('#text-config-colors .popover-swatch');
  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      textConfig.color = swatch.dataset.color;
    });
  });

  document.getElementById('text-popover').addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// ── Top Bar ──
function setupTopBar() {
  // Undo/Redo
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  // Export dropdown
  const dropdown = document.getElementById('export-dropdown');
  document.getElementById('btn-export').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });

  document.getElementById('export-png').addEventListener('click', () => {
    dropdown.classList.remove('open');
    exportPNG();
  });

  document.getElementById('export-pdf').addEventListener('click', () => {
    dropdown.classList.remove('open');
    exportPDF();
  });

  // Properties panel close
  document.getElementById('btn-close-panel').addEventListener('click', () => {
    closePropertiesPanel();
  });
}

// ── Status Bar ──
function setupStatusBar() {
  document.getElementById('btn-fit').addEventListener('click', fitToScreen);
  document.getElementById('btn-rotate').addEventListener('click', rotatePlan);

  document.getElementById('btn-prev-page').addEventListener('click', () => {
    const page = getCurrentPage();
    if (page > 1) goToPage(page - 1, handlePageChange);
  });

  document.getElementById('btn-next-page').addEventListener('click', () => {
    const page = getCurrentPage();
    const total = getTotalPages();
    if (page < total) goToPage(page + 1, handlePageChange);
  });
}

function handlePageChange(current, total) {
  const indicator = document.getElementById('page-indicator');
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');

  if (total > 1) {
    indicator.classList.remove('hidden');
    prevBtn.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
    document.getElementById('page-current').textContent = current;
    document.getElementById('page-total').textContent = total;
  } else {
    indicator.classList.remove('hidden');
    prevBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');
    document.getElementById('page-current').textContent = '1';
    document.getElementById('page-total').textContent = '1';
  }
}

// ── Canvas Events ──
function setupCanvasEvents(canvas) {
  // Click/tap on canvas (for placing objects)
  canvas.on('mouse:down', (opt) => {
    // In select mode: clicking a trail line selects its control point for dragging
    if (currentTool === 'select' && opt.target && opt.target.objectType === 'trailLine') {
      selectTrailControlPoint(opt.target);
      return;
    }

    // Ignore if clicking an existing object in placement modes
    if (opt.target) return;

    const pointer = canvas.getPointer(opt.e);

    switch (currentTool) {
      case 'actor':
        placeActor(pointer.x, pointer.y);
        break;
      case 'camera':
        placeCamera(pointer.x, pointer.y);
        break;
      case 'text':
        placeText(pointer.x, pointer.y, { color: textConfig.color });
        setTool('select');
        break;
    }
  });

  // Selection change
  canvas.on('selection:created', handleSelection);
  canvas.on('selection:updated', handleSelection);
  canvas.on('selection:cleared', handleSelectionCleared);

  // Double-tap to open properties
  let lastTapTime = 0;
  canvas.on('mouse:down', (opt) => {
    const now = Date.now();
    if (now - lastTapTime < 350 && opt.target) {
      openProperties(opt.target);
    }
    lastTapTime = now;
  });
}

// ── Object Placement ──
function placeActor(x, y) {
  const canvas = getCanvas();
  const actor = createActorIcon(x, y, {
    color: actorConfig.color,
    label: actorConfig.label,
  });
  canvas.add(actor);
  canvas.requestRenderAll();
  saveState();
  setStatus('Actor placed');
}

function placeCamera(x, y) {
  const canvas = getCanvas();
  const camera = createCameraIcon(x, y, {
    label: cameraConfig.label,
  });
  canvas.add(camera);
  canvas.requestRenderAll();
  saveState();
  setStatus('Camera placed');
}

// ── Selection & Properties ──
function handleSelection(opt) {
  const obj = opt.selected ? opt.selected[0] : null;
  if (!obj) return;
}

function handleSelectionCleared() {
  closePropertiesPanel();
}

function openProperties(obj) {
  if (!obj || !obj.objectType) return;

  const panel = document.getElementById('properties-panel');
  panel.classList.remove('hidden');

  if (obj.objectType === 'actor') {
    renderActorProperties(obj);
  } else if (obj.objectType === 'camera') {
    renderCameraProperties(obj);
  } else if (obj.objectType === 'movementArrow') {
    renderArrowProperties(obj);
  } else if (obj.objectType === 'text') {
    renderTextProperties(obj);
  }
}

function closePropertiesPanel() {
  document.getElementById('properties-panel').classList.add('hidden');
  document.getElementById('panel-content').innerHTML = '';
}

// ── Delete ──
function deleteSelected() {
  const canvas = getCanvas();
  const active = canvas.getActiveObject();
  if (!active) return;

  // Trail-connected objects: delete entire trail chain
  if (active.trailId && (
    active.objectType === 'trailLine' ||
    active.objectType === 'trailGhost' ||
    active.objectType === 'trailArrowHead' ||
    active.objectType === 'trailControlPoint'
  )) {
    removeTrail(active.trailId);
  } else if ((active.objectType === 'actor' || active.objectType === 'camera') && active.trailId) {
    // Actor/camera with trails: remove trails too
    removeTrail(active.trailId);
    canvas.remove(active);
  } else {
    canvas.remove(active);
  }

  canvas.discardActiveObject();
  closePropertiesPanel();
  canvas.requestRenderAll();
  saveState();
  setStatus('Object deleted');
}

// ── History State ──
function handleHistoryState(canUndoFlag, canRedoFlag) {
  document.getElementById('btn-undo').disabled = !canUndoFlag;
  document.getElementById('btn-redo').disabled = !canRedoFlag;
}

// ── Long Press ──
function handleLongPress(clientX, clientY) {
  const canvas = getCanvas();
  const wrapper = document.getElementById('canvas-wrapper');
  const rect = wrapper.getBoundingClientRect();
  const pointer = canvas.getPointer({ clientX, clientY });

  // Find object at pointer
  const target = canvas.findTarget({ clientX, clientY }, false);
  if (!target) return;

  // Show context menu
  showContextMenu(clientX, clientY, target);
}

function showContextMenu(x, y, target) {
  removeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const propsBtn = document.createElement('button');
  propsBtn.textContent = 'Properties';
  propsBtn.addEventListener('click', () => {
    removeContextMenu();
    openProperties(target);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    removeContextMenu();
    const canvas = getCanvas();
    canvas.setActiveObject(target);
    deleteSelected();
  });

  menu.appendChild(propsBtn);
  menu.appendChild(deleteBtn);
  document.body.appendChild(menu);

  // Close on next tap
  setTimeout(() => {
    document.addEventListener('click', removeContextMenu, { once: true });
  }, 10);
}

function removeContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.remove();
}

// ── Keyboard Shortcuts ──
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ignore when typing in input fields or IText
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Also ignore when editing IText on canvas
    const canvas = getCanvas();
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.isEditing) return;

    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
    }

    // Tool shortcuts
    if (e.key === 'v' || e.key === 'V') setTool('select');
    if (e.key === 'a' || e.key === 'A') setTool('actor');
    if (e.key === 'c' || e.key === 'C') setTool('camera');
    if (e.key === 't' || e.key === 'T') setTool('text');
    if (e.key === 'Escape') {
      setTool('select');
      removeContextMenu();
    }
  });
}

// ── Status ──
function setStatus(msg) {
  document.getElementById('status-message').textContent = msg;
}

// ── PWA Service Worker Registration ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Service worker registration failed — app still works
  });
}
