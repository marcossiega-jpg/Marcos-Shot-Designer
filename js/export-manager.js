/**
 * Export Manager — PNG and PDF export
 */

import { getCanvas } from './canvas-manager.js';
import { showArrowHandles } from './movement-arrow.js';
import { hideTrailControlPoints, showTrailControlPoints } from './trail-manager.js';

export function exportPNG() {
  const canvas = getCanvas();
  prepareForExport(canvas);

  // Get bounding box of all content
  const bounds = getContentBounds(canvas);
  const multiplier = 2;

  const dataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier,
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  });

  restoreAfterExport(canvas);
  downloadDataUrl(dataUrl, 'shot-design.png');
}

export function exportPDF() {
  const canvas = getCanvas();
  prepareForExport(canvas);

  const bounds = getContentBounds(canvas);
  const multiplier = 2;

  const dataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier,
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  });

  restoreAfterExport(canvas);

  // Determine orientation
  const isLandscape = bounds.width > bounds.height;
  const orientation = isLandscape ? 'landscape' : 'portrait';

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [bounds.width, bounds.height],
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, bounds.width, bounds.height);
  pdf.save('shot-design.pdf');
}

function prepareForExport(canvas) {
  // Deselect everything
  canvas.discardActiveObject();

  // Hide arrow control points (backward compat)
  canvas.getObjects().forEach(o => {
    if (o.arrowId && (o.objectType === 'controlPoint' || o.objectType === 'startPoint' || o.objectType === 'endPoint')) {
      o.set({ visible: false });
    }
  });

  // Hide trail control points
  hideTrailControlPoints();

  canvas.requestRenderAll();
}

function restoreAfterExport(canvas) {
  showTrailControlPoints();
  canvas.requestRenderAll();
}

function getContentBounds(canvas) {
  const bg = canvas.backgroundImage;
  if (bg) {
    return {
      left: 0,
      top: 0,
      width: bg.width * (bg.scaleX || 1),
      height: bg.height * (bg.scaleY || 1),
    };
  }

  // Fallback: canvas dimensions
  return {
    left: 0,
    top: 0,
    width: canvas.getWidth(),
    height: canvas.getHeight(),
  };
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
