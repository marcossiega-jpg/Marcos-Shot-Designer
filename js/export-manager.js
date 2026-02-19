/**
 * Export Manager — PNG, PDF export and Scriptation sharing
 * Uses blob URLs and Web Share API for iPad PWA compatibility
 */

import { getCanvas } from './canvas-manager.js';

export function exportPNG() {
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

  // Convert data URL to blob for reliable cross-platform download
  const blob = dataUrlToBlob(dataUrl);
  openOrDownloadBlob(blob, 'shot-design.png');
}

export async function shareToScriptation() {
  try {
    const pdfBlob = generatePdfBlob();
    const pdfFile = new File([pdfBlob], 'shot-design.pdf', { type: 'application/pdf' });

    // Try Web Share API first (opens iOS share sheet → pick Scriptation)
    if (navigator.share) {
      try {
        await navigator.share({ files: [pdfFile], title: 'Shot Design' });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        // Share failed or not supported for files, fall through
      }
    }

    // Fallback: open PDF in new tab (user can share from there)
    openOrDownloadBlob(pdfBlob, 'shot-design.pdf');
  } catch (err) {
    console.error('Share to Scriptation failed:', err);
    alert('Export failed. Please try again.');
  }
}

export function exportPDF() {
  try {
    const pdfBlob = generatePdfBlob();
    openOrDownloadBlob(pdfBlob, 'shot-design.pdf');
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('PDF export failed. Please try again.');
  }
}

function generatePdfBlob() {
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

  const isLandscape = bounds.width > bounds.height;
  const orientation = isLandscape ? 'landscape' : 'portrait';

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [bounds.width, bounds.height],
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, bounds.width, bounds.height);
  return pdf.output('blob');
}

function prepareForExport(canvas) {
  canvas.discardActiveObject();

  canvas.getObjects().forEach(o => {
    if (o.arrowId && (o.objectType === 'controlPoint' || o.objectType === 'startPoint' || o.objectType === 'endPoint')) {
      o.set({ visible: false });
    }
  });

  canvas.requestRenderAll();
}

function restoreAfterExport(canvas) {
  canvas.getObjects().forEach(o => {
    if (o.arrowId && (o.objectType === 'controlPoint' || o.objectType === 'startPoint' || o.objectType === 'endPoint')) {
      o.set({ visible: true });
    }
  });
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

  return {
    left: 0,
    top: 0,
    width: canvas.getWidth(),
    height: canvas.getHeight(),
  };
}

function openOrDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  // On iOS/iPad, window.open works reliably for blobs in PWA mode
  // On desktop, try download link first
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    window.open(url, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}
