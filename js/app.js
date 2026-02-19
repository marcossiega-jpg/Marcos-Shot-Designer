/**
 * App — Bootstrap, state management, toolbar logic
 */

import { initCanvas, getCanvas, fitToScreen, rotatePlan, getZoom } from './canvas-manager.js';
import { initTouchHandler } from './touch-handler.js';
import { initPdfLoader, goToPage, getCurrentPage, getTotalPages, isPdf } from './pdf-loader.js';
import { createActorIcon, renderActorProperties } from './actor-icon.js';
import { createCameraIcon, renderCameraProperties } from './camera-icon.js';
import { createMovementArrow, removeArrow, renderArrowProperties } from './movement-arrow.js';
import { placeText, renderTextProperties } from './text-tool.js';
import { initRoster, clearActiveCharacter } from './character-roster.js';
import { exportPNG, exportPDF, shareToScriptation } from './export-manager.js';
import { initHistory, undo, redo, saveState, clearHistory } from './history-manager.js';

// ── State ──
let currentTool = 'select';
let arrowStartPoint = null;
let actorConfig = { color: '#ffffff', label: '' };
let cameraConfig = { color: '#ffffff', label: '' };
let textConfig = { color: '#ffffff' };

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  const canvas = initCanvas();

  initTouchHandler({
    onLongPress: handleLongPress,
  });

  initPdfLoader(handlePageChange);

  initHistory(handleHistoryState);

  setupToolbar();
  setupTextPopover();
  initRoster(handleCharacterSelect);
  setupTopBar();
  setupStatusBar();
  setupCanvasEvents(canvas);
  setupKeyboard();
  setupSidebarResize();

  setStatus('Ready — create characters in the sidebar, then place them');
});

// ── Toolbar ──
function setupToolbar() {
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Reset to generic white when using toolbar buttons directly
      if (btn.dataset.tool === 'actor') {
        actorConfig = { color: '#ffffff', label: '' };
        clearActiveCharacter();
      } else if (btn.dataset.tool === 'camera') {
        cameraConfig = { color: '#ffffff', label: '' };
        clearActiveCharacter();
      }
      setTool(btn.dataset.tool);
    });
  });

  document.getElementById('btn-load-plan').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('btn-delete').addEventListener('click', deleteSelected);
}

function setTool(tool) {
  currentTool = tool;
  arrowStartPoint = null;
  removeArrowStartIndicator();
  if (tool !== 'actor' && tool !== 'camera') clearActiveCharacter();

  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });

  // Show/hide text popover
  const textPopover = document.getElementById('text-popover');
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
    if (o.objectType === 'controlPoint' || o.objectType === 'startPoint' || o.objectType === 'endPoint') return;
    o.selectable = enabled;
    o.evented = enabled;
  });
}

function getToolStatus(tool) {
  switch (tool) {
    case 'select': return 'Select mode — tap objects to select';
    case 'actor': return 'Actor mode — double-tap to place';
    case 'actor-arrow': return 'Actor movement — tap start, then tap end';
    case 'camera': return 'Camera mode — double-tap to place';
    case 'camera-arrow': return 'Camera movement — tap start, then tap end';
    case 'text': return 'Text mode — double-tap to place text';
    default: return '';
  }
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

// ── Character Roster Callback ──
function handleCharacterSelect(character) {
  if (character.type === 'camera') {
    cameraConfig.color = character.color;
    cameraConfig.label = character.label;
    setTool('camera');
  } else {
    actorConfig.color = character.color;
    actorConfig.label = character.label;
    setTool('actor');
  }
  setStatus(`Selected "${character.name}" — double-tap to place`);
}

// ── Top Bar ──
function setupTopBar() {
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  const dropdown = document.getElementById('export-dropdown');
  document.getElementById('btn-export').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });

  document.getElementById('export-scriptation').addEventListener('click', () => {
    dropdown.classList.remove('open');
    shareToScriptation();
  });

  document.getElementById('export-png').addEventListener('click', () => {
    dropdown.classList.remove('open');
    exportPNG();
  });

  document.getElementById('export-pdf').addEventListener('click', () => {
    dropdown.classList.remove('open');
    exportPDF();
  });

  document.getElementById('btn-close-panel').addEventListener('click', () => {
    closePropertiesPanel();
  });

  // New Project
  document.getElementById('btn-new-project').addEventListener('click', () => {
    const canvas = getCanvas();
    const hasContent = canvas.getObjects().length > 0 || canvas.backgroundImage;
    if (!hasContent) {
      // Nothing to lose, just reset
      startNewProject();
      return;
    }
    // Show confirmation modal
    document.getElementById('new-project-modal').classList.remove('hidden');
  });

  document.getElementById('modal-export-first').addEventListener('click', async () => {
    document.getElementById('new-project-modal').classList.add('hidden');
    await exportPDF();
    startNewProject();
  });

  document.getElementById('modal-new').addEventListener('click', () => {
    document.getElementById('new-project-modal').classList.add('hidden');
    startNewProject();
  });

  document.getElementById('modal-cancel').addEventListener('click', () => {
    document.getElementById('new-project-modal').classList.add('hidden');
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
  let lastPlaceTapTime = 0;
  let lastPlaceTapPos = null;

  canvas.on('mouse:down', (opt) => {
    const now = Date.now();
    const pointer = canvas.getPointer(opt.e);

    // Double-tap on existing object → open properties
    if (opt.target && now - lastPlaceTapTime < 400) {
      openProperties(opt.target);
      lastPlaceTapTime = 0;
      return;
    }

    // Actor arrow: two-tap (dotted, actor's color)
    if (currentTool === 'actor-arrow' && !opt.target) {
      handleActorArrowTap(pointer.x, pointer.y);
      lastPlaceTapTime = 0;
      return;
    }

    // Camera arrow: two-tap (solid, camera's color)
    if (currentTool === 'camera-arrow' && !opt.target) {
      handleCameraArrowTap(pointer.x, pointer.y);
      lastPlaceTapTime = 0;
      return;
    }

    // Placement modes: require double-tap
    if (!opt.target && (currentTool === 'actor' || currentTool === 'camera' || currentTool === 'text')) {
      if (now - lastPlaceTapTime < 400 && lastPlaceTapPos) {
        const dx = pointer.x - lastPlaceTapPos.x;
        const dy = pointer.y - lastPlaceTapPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 30) {
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
          lastPlaceTapTime = 0;
          lastPlaceTapPos = null;
          return;
        }
      }

      lastPlaceTapTime = now;
      lastPlaceTapPos = { x: pointer.x, y: pointer.y };
      setStatus('Double-tap to place ' + currentTool);
      return;
    }

    lastPlaceTapTime = now;
    lastPlaceTapPos = pointer ? { x: pointer.x, y: pointer.y } : null;
  });

  canvas.on('selection:created', handleSelection);
  canvas.on('selection:updated', handleSelection);
  canvas.on('selection:cleared', handleSelectionCleared);
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
    color: cameraConfig.color,
    label: cameraConfig.label,
  });
  canvas.add(camera);
  canvas.requestRenderAll();
  saveState();
  setStatus('Camera placed');
}

// ── Actor Arrow (two-tap, dotted, actor's color) ──
function handleActorArrowTap(x, y) {
  if (!arrowStartPoint) {
    arrowStartPoint = { x, y };
    showArrowStartIndicator(x, y);
    setStatus('Actor movement: tap end point');
  } else {
    removeArrowStartIndicator();
    createMovementArrow(arrowStartPoint.x, arrowStartPoint.y, x, y, {
      color: actorConfig.color,
      strokeDashArray: [6, 4],
    });
    arrowStartPoint = null;
    saveState();
    setStatus('Actor arrow created — tap to place another');
  }
}

// ── Camera Arrow (two-tap, solid, camera's color) ──
function handleCameraArrowTap(x, y) {
  if (!arrowStartPoint) {
    arrowStartPoint = { x, y };
    showArrowStartIndicator(x, y);
    setStatus('Camera movement: tap end point');
  } else {
    removeArrowStartIndicator();
    createMovementArrow(arrowStartPoint.x, arrowStartPoint.y, x, y, {
      color: cameraConfig.color,
    });
    arrowStartPoint = null;
    saveState();
    setStatus('Camera arrow created — tap to place another');
  }
}

function showArrowStartIndicator(x, y) {
  removeArrowStartIndicator();
  const canvas = getCanvas();
  const wrapper = document.getElementById('canvas-wrapper');
  const vpt = canvas.viewportTransform;
  const zoom = getZoom();

  const screenX = x * zoom + vpt[4];
  const screenY = y * zoom + vpt[5];

  const indicator = document.createElement('div');
  indicator.className = 'arrow-start-indicator';
  indicator.style.left = screenX + 'px';
  indicator.style.top = screenY + 'px';
  indicator.id = 'arrow-start-indicator';
  wrapper.appendChild(indicator);
}

function removeArrowStartIndicator() {
  const el = document.getElementById('arrow-start-indicator');
  if (el) el.remove();
}

// ── Selection & Properties ──
function handleSelection() {
  // Control points are always visible now, no toggling needed
}

function handleSelectionCleared() {
  closePropertiesPanel();
}

function openProperties(obj) {
  if (!obj || !obj.objectType) return;

  const section = document.getElementById('properties-section');
  section.classList.remove('hidden');

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
  document.getElementById('properties-section').classList.add('hidden');
  document.getElementById('panel-content').innerHTML = '';
}

// ── Delete ──
function deleteSelected() {
  const canvas = getCanvas();
  const active = canvas.getActiveObject();
  if (!active) return;

  if (active.objectType === 'movementArrow') {
    removeArrow(active.arrowId);
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
  const target = canvas.findTarget({ clientX, clientY }, false);
  if (!target) return;
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

  if (target.objectType === 'actor' || target.objectType === 'camera') {
    const rotateBtn = document.createElement('button');
    rotateBtn.textContent = 'Rotate';
    rotateBtn.addEventListener('click', () => {
      removeContextMenu();
      const canvas = getCanvas();
      target.set({ hasControls: true, lockRotation: false });
      target.setControlsVisibility({
        tl: false, tr: false, bl: false, br: false,
        ml: false, mr: false, mt: false, mb: false,
        mtr: true,
      });
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
      setStatus('Drag the rotation handle to rotate — tap elsewhere when done');
    });
    menu.appendChild(rotateBtn);
  }

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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const canvas = getCanvas();
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.isEditing) return;

    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) { redo(); } else { undo(); }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
    }

    if (e.key === 'v' || e.key === 'V') setTool('select');
    if (e.key === 'a' || e.key === 'A') setTool('actor');
    if (e.key === 'm' || e.key === 'M') setTool('actor-arrow');
    if (e.key === 'c' || e.key === 'C') setTool('camera');
    if (e.key === 'b' || e.key === 'B') setTool('camera-arrow');
    if (e.key === 't' || e.key === 'T') setTool('text');
    if (e.key === 'Escape') {
      setTool('select');
      removeContextMenu();
    }
  });
}

// ── New Project ──
function startNewProject() {
  const canvas = getCanvas();

  // Remove all objects
  canvas.getObjects().slice().forEach(o => canvas.remove(o));

  // Remove background image
  canvas.backgroundImage = null;

  canvas.discardActiveObject();
  canvas.requestRenderAll();

  // Reset history
  clearHistory();

  // Reset page indicators
  document.getElementById('page-indicator').classList.add('hidden');
  document.getElementById('btn-prev-page').classList.add('hidden');
  document.getElementById('btn-next-page').classList.add('hidden');

  // Reset tool
  setTool('select');
  closePropertiesPanel();

  setStatus('New project — create characters in the sidebar, then place them');
}

// ── Sidebar Resize ──
function setupSidebarResize() {
  const handle = document.getElementById('sidebar-resize-handle');
  const sidebar = document.getElementById('right-sidebar');

  // Restore saved width
  const savedWidth = localStorage.getItem('shotdesigner_sidebar_width');
  if (savedWidth) {
    const w = parseInt(savedWidth);
    if (w >= 160 && w <= 400) {
      sidebar.style.width = w + 'px';
    }
  }

  let startX, startWidth;

  const onPointerDown = (e) => {
    e.preventDefault();
    startX = e.clientX ?? e.touches[0].clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    handle.classList.add('dragging');
    document.body.classList.add('sidebar-resizing');

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = (e) => {
    const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : startX);
    // Sidebar is on the right, so dragging left = wider
    const delta = startX - clientX;
    const newWidth = Math.min(400, Math.max(160, startWidth + delta));
    sidebar.style.width = newWidth + 'px';
  };

  const onPointerUp = () => {
    handle.classList.remove('dragging');
    document.body.classList.remove('sidebar-resizing');
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);

    // Save preference
    const currentWidth = sidebar.getBoundingClientRect().width;
    localStorage.setItem('shotdesigner_sidebar_width', Math.round(currentWidth));
  };

  handle.addEventListener('pointerdown', onPointerDown);
}

// ── Status ──
function setStatus(msg) {
  document.getElementById('status-message').textContent = msg;
}

// ── PWA Service Worker Registration ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
