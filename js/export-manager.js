/**
 * Export Manager — JPEG and PDF export
 * Uses native iOS share sheet for camera roll / app sharing
 */

import { getCanvas } from './canvas-manager.js';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function exportJPEG() {
  try {
    const canvas = getCanvas();
    prepareForExport(canvas);

    const bounds = getContentBounds(canvas);

    // Draw content onto an offscreen canvas with white background, centered
    const multiplier = 2;
    const srcDataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    });

    restoreAfterExport(canvas);

    // Create a JPEG with white background
    const img = await loadImage(srcDataUrl);
    const offscreen = document.createElement('canvas');
    offscreen.width = img.width;
    offscreen.height = img.height;
    const ctx = offscreen.getContext('2d');

    // White background (JPEG has no transparency)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Draw content centered
    ctx.drawImage(img, 0, 0);

    const jpegDataUrl = offscreen.toDataURL('image/jpeg', 0.92);
    const blob = dataUrlToBlob(jpegDataUrl);

    // On iOS, share sheet lets user save to camera roll
    if (isIOS() && navigator.share) {
      const file = new File([blob], 'dosl-export.jpg', { type: 'image/jpeg' });
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Desktop fallback
    downloadBlob(blob, 'dosl-export.jpg');
  } catch (err) {
    console.error('JPEG export error:', err);
    alert('JPEG export error: ' + err.message);
  }
}

export async function exportPDF() {
  try {
    const pdfBlob = generatePdfBlob();

    // On iOS, use native share sheet (save to Files, AirDrop, Scriptation, etc.)
    if (isIOS() && navigator.share) {
      const pdfFile = new File([pdfBlob], 'dosl-export.pdf', { type: 'application/pdf' });
      try {
        await navigator.share({ files: [pdfFile] });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Desktop fallback
    downloadBlob(pdfBlob, 'dosl-export.pdf');
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

  // US Letter page (8.5 x 11 inches = 612 x 792 points)
  const contentAspect = bounds.width / bounds.height;
  const isLandscape = contentAspect > 1;

  const PAGE_W = isLandscape ? 792 : 612;
  const PAGE_H = isLandscape ? 612 : 792;

  // Fit content to fill entire page without cropping
  let fitW, fitH;
  if (contentAspect > PAGE_W / PAGE_H) {
    fitW = PAGE_W;
    fitH = PAGE_W / contentAspect;
  } else {
    fitH = PAGE_H;
    fitW = PAGE_H * contentAspect;
  }

  // Center on page
  const x = (PAGE_W - fitW) / 2;
  const y = (PAGE_H - fitH) / 2;

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  pdf.addImage(dataUrl, 'PNG', x, y, fitW, fitH);
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
