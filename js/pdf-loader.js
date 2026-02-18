/**
 * PDF Loader — Load PDF/image files as canvas background
 */

import { getCanvas, fitToScreen } from './canvas-manager.js';

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let currentFileType = null;

// PDF.js worker setup
let pdfjsLib = null;

async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib;

  // Dynamic import of PDF.js
  pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  return pdfjsLib;
}

export function initPdfLoader(onPageChange) {
  const fileInput = document.getElementById('file-input');

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'pdf') {
      currentFileType = 'pdf';
      await loadPdf(file, onPageChange);
    } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
      currentFileType = 'image';
      pdfDoc = null;
      totalPages = 1;
      currentPage = 1;
      await loadImage(file);
      if (onPageChange) onPageChange(1, 1);
    }

    // Reset input so same file can be reloaded
    fileInput.value = '';
  });
}

async function loadPdf(file, onPageChange) {
  const lib = await ensurePdfJs();
  const arrayBuffer = await file.arrayBuffer();
  pdfDoc = await lib.getDocument({ data: arrayBuffer }).promise;
  totalPages = pdfDoc.numPages;
  currentPage = 1;

  await renderPdfPage(currentPage);

  if (onPageChange) onPageChange(currentPage, totalPages);
}

async function renderPdfPage(pageNum) {
  if (!pdfDoc) return;

  const page = await pdfDoc.getPage(pageNum);
  const scale = 2; // Render at 2x for sharpness
  const viewport = page.getViewport({ scale });

  // Offscreen canvas
  const offCanvas = document.createElement('canvas');
  offCanvas.width = viewport.width;
  offCanvas.height = viewport.height;
  const ctx = offCanvas.getContext('2d');

  await page.render({
    canvasContext: ctx,
    viewport: viewport,
  }).promise;

  const dataUrl = offCanvas.toDataURL('image/png');
  await setBackgroundFromDataUrl(dataUrl);
}

async function loadImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      await setBackgroundFromDataUrl(e.target.result);
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

async function setBackgroundFromDataUrl(dataUrl) {
  const canvas = getCanvas();
  const img = await fabric.FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
  canvas.backgroundImage = img;
  fitToScreen();
  canvas.requestRenderAll();
}

export async function goToPage(pageNum, onPageChange) {
  if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return;
  currentPage = pageNum;
  await renderPdfPage(currentPage);
  if (onPageChange) onPageChange(currentPage, totalPages);
}

export function getCurrentPage() { return currentPage; }
export function getTotalPages() { return totalPages; }
export function isPdf() { return currentFileType === 'pdf'; }
