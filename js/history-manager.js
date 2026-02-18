/**
 * History Manager — Undo/Redo with snapshot stack
 */

import { getCanvas } from './canvas-manager.js';

const MAX_STATES = 50;
let undoStack = [];
let redoStack = [];
let isRestoring = false;
let debounceTimer = null;
const DEBOUNCE_MS = 300;

let onStateChange = null;

export function initHistory(stateChangeCallback) {
  onStateChange = stateChangeCallback;

  const canvas = getCanvas();

  // Save initial state
  saveState();

  // Listen for modifications
  canvas.on('object:modified', debouncedSave);
  canvas.on('object:added', debouncedSave);
  canvas.on('object:removed', debouncedSave);
}

function debouncedSave() {
  if (isRestoring) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(saveState, DEBOUNCE_MS);
}

export function saveState() {
  if (isRestoring) return;
  const canvas = getCanvas();
  const json = canvas.toJSON([
    'objectType', 'actorColor', 'actorLabel',
    'cameraColor', 'cameraFov', 'cameraConeLength', 'cameraLabel',
    'arrowId', 'arrowColor', 'arrowData',
    'trailId', 'trailSegmentIndex', 'trailSegmentData',
    'textColor', 'textFontSize',
  ]);

  undoStack.push(JSON.stringify(json));

  // Trim stack
  if (undoStack.length > MAX_STATES) {
    undoStack.shift();
  }

  // Clear redo stack on new action
  redoStack = [];

  notifyStateChange();
}

export function undo() {
  if (undoStack.length <= 1) return; // Keep at least the initial state

  const canvas = getCanvas();
  isRestoring = true;

  // Move current state to redo
  const current = undoStack.pop();
  redoStack.push(current);

  // Restore previous state
  const previous = undoStack[undoStack.length - 1];
  canvas.loadFromJSON(JSON.parse(previous)).then(() => {
    canvas.requestRenderAll();
    isRestoring = false;
    notifyStateChange();
  });
}

export function redo() {
  if (redoStack.length === 0) return;

  const canvas = getCanvas();
  isRestoring = true;

  const next = redoStack.pop();
  undoStack.push(next);

  canvas.loadFromJSON(JSON.parse(next)).then(() => {
    canvas.requestRenderAll();
    isRestoring = false;
    notifyStateChange();
  });
}

export function canUndo() {
  return undoStack.length > 1;
}

export function canRedo() {
  return redoStack.length > 0;
}

function notifyStateChange() {
  if (onStateChange) {
    onStateChange(canUndo(), canRedo());
  }
}
