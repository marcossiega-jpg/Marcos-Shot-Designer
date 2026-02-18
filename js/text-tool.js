/**
 * Text Tool — Place editable text on the canvas with character-matching colors
 */

import { getCanvas } from './canvas-manager.js';
import { saveState } from './history-manager.js';

const PRESET_COLORS = [
  '#ffffff', '#e74c3c', '#3498db', '#2ecc71',
  '#f1c40f', '#e67e22', '#9b59b6', '#1abc9c',
  '#e91e63', '#000000',
];

const DEFAULT_TEXT_COLOR = '#ffffff';
const DEFAULT_FONT_SIZE = 24;

export function placeText(x, y, options = {}) {
  const canvas = getCanvas();
  const color = options.color || DEFAULT_TEXT_COLOR;
  const fontSize = options.fontSize || DEFAULT_FONT_SIZE;

  const text = new fabric.IText('Text', {
    left: x,
    top: y,
    originX: 'center',
    originY: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: fontSize,
    fontWeight: 'normal',
    fill: color,
    editable: true,
    objectType: 'text',
    textColor: color,
    textFontSize: fontSize,
    hasControls: true,
    hasBorders: true,
  });

  text.setControlsVisibility({
    tl: true, tr: true, bl: true, br: true,
    ml: false, mr: false, mt: false, mb: false,
    mtr: true,
  });

  canvas.add(text);
  canvas.setActiveObject(text);

  // Enter editing mode so keyboard opens immediately
  text.enterEditing();
  text.selectAll();

  canvas.requestRenderAll();
  saveState();

  return text;
}

export function renderTextProperties(textObj) {
  const container = document.getElementById('panel-content');

  const swatchesHtml = PRESET_COLORS.map(c => {
    const sel = c === textObj.fill ? ' selected' : '';
    const border = c === '#ffffff' ? ';border:1px solid #666' : '';
    return `<div class="color-swatch${sel}" style="background:${c}${border}" data-color="${c}"></div>`;
  }).join('');

  container.innerHTML = `
    <div class="prop-group">
      <label class="prop-label">Font Size: <span id="font-size-val">${textObj.fontSize}</span>px</label>
      <input type="range" class="prop-range" id="text-font-size" min="10" max="120" value="${textObj.fontSize}">
    </div>
    <div class="prop-group">
      <label class="prop-label">Color</label>
      <div class="color-swatches" id="text-colors">
        ${swatchesHtml}
      </div>
    </div>
    <div class="prop-group">
      <label class="prop-label">Style</label>
      <div class="text-style-btns" id="text-styles">
        <button class="style-btn ${textObj.fontWeight === 'bold' ? 'active' : ''}" data-style="bold" title="Bold">B</button>
        <button class="style-btn ${textObj.fontStyle === 'italic' ? 'active' : ''}" data-style="italic" title="Italic"><em>I</em></button>
      </div>
    </div>
  `;

  // Font size slider
  document.getElementById('text-font-size').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('font-size-val').textContent = val;
    textObj.set('fontSize', val);
    textObj.textFontSize = val;
    getCanvas().requestRenderAll();
  });

  // Color swatches
  document.querySelectorAll('#text-colors .color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('#text-colors .color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      const newColor = swatch.dataset.color;
      textObj.set('fill', newColor);
      textObj.textColor = newColor;
      getCanvas().requestRenderAll();
    });
  });

  // Bold / Italic
  document.querySelectorAll('#text-styles .style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const style = btn.dataset.style;
      if (style === 'bold') {
        const isBold = textObj.fontWeight === 'bold';
        textObj.set('fontWeight', isBold ? 'normal' : 'bold');
        btn.classList.toggle('active');
      } else if (style === 'italic') {
        const isItalic = textObj.fontStyle === 'italic';
        textObj.set('fontStyle', isItalic ? '' : 'italic');
        btn.classList.toggle('active');
      }
      getCanvas().requestRenderAll();
    });
  });
}

export function getTextPresetColors() {
  return PRESET_COLORS;
}
