/**
 * Export Manager — PNG, PDF export and Scriptation sharing
 * Uses Web Share API on iOS, blob URLs as fallback
 */

import { getCanvas } from './canvas-manager.js';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function exportPNG() {
  try {
    const canvas = getCanvas();
    prepareForExport(canvas);

    const bounds = getContentBounds(canvas);

    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });

    restoreAfterExport(canvas);

    const blob = dataUrlToBlob(dataUrl);

    // On iOS, use share sheet so user can Save/AirDrop/open in app
    if (isIOS() && navigator.share) {
      const file = new File([blob], 'shot-design.png', { type: 'image/png' });
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Desktop fallback
    downloadBlob(blob, 'shot-design.png');
  } catch (err) {
    console.error('PNG export error:', err);
    alert('PNG export error: ' + err.message);
  }
}

export async function shareToScriptation() {
  try {
    const pdfBlob = generatePdfBlob();
    const pdfFile = new File([pdfBlob], 'shot-design.pdf', { type: 'application/pdf' });

    // Use share sheet (user picks Scriptation or any other app)
    if (navigator.share) {
      try {
        await navigator.share({ files: [pdfFile] });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        // Fall through to blob URL
      }
    }

    // Fallback: open in browser
    openBlob(pdfBlob);
  } catch (err) {
    console.error('Scriptation share error:', err);
    alert('Share error: ' + err.message);
  }
}

export async function exportPDF() {
  try {
    const pdfBlob = generatePdfBlob();

    // On iOS, use share sheet
    if (isIOS() && navigator.share) {
      const pdfFile = new File([pdfBlob], 'shot-design.pdf', { type: 'application/pdf' });
      try {
        await navigator.share({ files: [pdfFile] });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Desktop fallback
    downloadBlob(pdfBlob, 'shot-design.pdf');
  } catch (err) {
    console.error('PDF export error:', err);
    alert('PDF export error: ' + err.message);
  }
}

function generatePdfBlob() {
  const canvas = getCanvas();
  prepareForExport(canvas);

  const bounds = getContentBounds(canvas);

  const dataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier: 2,
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  });

  restoreAfterExport(canvas);

  if (!window.jspdf) {
    throw new Error('PDF library not loaded. Please reload the app.');
  }

  const isLandscape = bounds.width > bounds.height;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function openBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
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
