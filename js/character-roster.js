/**
 * Character Roster — Persistent character presets with localStorage
 * Supports both actors and cameras.
 */

const STORAGE_KEY = 'shotdesigner_characters';
const PRESET_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f',
  '#e67e22', '#9b59b6', '#1abc9c', '#e91e63',
];

let characters = [];
let onSelectCallback = null;
let activeCharacterId = null;
let formType = 'actor'; // current toggle state in the add form

// ── Data Layer ──

function loadCharacters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCharactersToStorage(chars) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
  } catch {
    // Storage full or unavailable
  }
}

export function getCharacters() {
  return characters;
}

export function addCharacter({ name, label, color, type }) {
  const char = {
    id: 'char_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    label: (label || name.charAt(0)).toUpperCase().slice(0, 4),
    color: color || PRESET_COLORS[0],
    type: type || 'actor',
  };
  characters.push(char);
  saveCharactersToStorage(characters);
  renderRoster();
  return char;
}

export function deleteCharacter(id) {
  characters = characters.filter(c => c.id !== id);
  saveCharactersToStorage(characters);
  if (activeCharacterId === id) {
    activeCharacterId = null;
  }
  renderRoster();
}

// ── UI Layer ──

export function initRoster(onCharacterSelect) {
  onSelectCallback = onCharacterSelect;
  characters = loadCharacters();

  setupAddButton();
  setupForm();
  renderRoster();
}

function setupAddButton() {
  document.getElementById('btn-add-character').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleForm(true);
  });
}

function setupForm() {
  const form = document.getElementById('roster-form');
  const nameInput = document.getElementById('roster-name');
  const labelInput = document.getElementById('roster-label');

  // Type toggle
  document.querySelectorAll('#roster-type-toggle .roster-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#roster-type-toggle .roster-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formType = btn.dataset.type;
    });
  });

  // Render color swatches
  const swatchContainer = document.getElementById('roster-colors');
  swatchContainer.innerHTML = PRESET_COLORS.map((c, i) =>
    `<div class="popover-swatch ${i === 0 ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>`
  ).join('');

  // Color swatch selection
  swatchContainer.addEventListener('click', (e) => {
    const swatch = e.target.closest('.popover-swatch');
    if (!swatch) return;
    swatchContainer.querySelectorAll('.popover-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
  });

  // Auto-generate label from name
  nameInput.addEventListener('input', () => {
    if (!labelInput.dataset.manuallyEdited) {
      const words = nameInput.value.trim().split(/\s+/);
      if (words.length >= 2) {
        labelInput.value = (words[0][0] + words[1][0]).toUpperCase();
      } else if (words[0]) {
        labelInput.value = words[0].slice(0, 2).toUpperCase();
      } else {
        labelInput.value = '';
      }
    }
  });

  labelInput.addEventListener('input', () => {
    labelInput.dataset.manuallyEdited = 'true';
  });

  // Save button
  document.getElementById('roster-save').addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    const selectedSwatch = swatchContainer.querySelector('.popover-swatch.selected');
    const color = selectedSwatch ? selectedSwatch.dataset.color : PRESET_COLORS[0];
    const label = labelInput.value.trim() || name.charAt(0).toUpperCase();

    addCharacter({ name, label, color, type: formType });
    toggleForm(false);
    resetForm();
  });

  // Cancel button
  document.getElementById('roster-cancel').addEventListener('click', () => {
    toggleForm(false);
    resetForm();
  });

  // Prevent clicks inside form from propagating
  form.addEventListener('click', (e) => e.stopPropagation());
}

function toggleForm(show) {
  const form = document.getElementById('roster-form');
  form.classList.toggle('hidden', !show);
  if (show) {
    setTimeout(() => document.getElementById('roster-name').focus(), 50);
  }
}

function resetForm() {
  document.getElementById('roster-name').value = '';
  document.getElementById('roster-label').value = '';
  delete document.getElementById('roster-label').dataset.manuallyEdited;
  formType = 'actor';
  document.querySelectorAll('#roster-type-toggle .roster-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === 'actor');
  });
  const swatchContainer = document.getElementById('roster-colors');
  swatchContainer.querySelectorAll('.popover-swatch').forEach((s, i) => {
    s.classList.toggle('selected', i === 0);
  });
}

export function renderRoster() {
  const listEl = document.getElementById('roster-list');
  const emptyEl = document.getElementById('roster-empty');

  if (characters.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  listEl.innerHTML = characters.map(char => {
    const isCamera = char.type === 'camera';
    const iconContent = isCamera
      ? `<svg width="16" height="14" viewBox="0 0 26 20" fill="${char.color}" stroke="none"><rect width="18" height="16" rx="2" /><polygon points="18,3 26,0 26,16 18,13"/></svg>`
      : escapeHtml(char.label);

    return `
      <div class="roster-item ${char.id === activeCharacterId ? 'active' : ''}"
           data-id="${char.id}" style="--char-color: ${char.color}">
        <div class="roster-item-icon ${isCamera ? 'roster-item-icon-camera' : ''}">${iconContent}</div>
        <span class="roster-item-name">${escapeHtml(char.name)}</span>
        <button class="roster-item-delete" data-id="${char.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Attach event listeners
  listEl.querySelectorAll('.roster-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.roster-item-delete')) return;

      const id = item.dataset.id;
      const char = characters.find(c => c.id === id);
      if (char && onSelectCallback) {
        activeCharacterId = id;
        renderRoster();
        onSelectCallback(char);
      }
    });
  });

  listEl.querySelectorAll('.roster-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deleteCharacter(id);
    });
  });
}

export function setActiveCharacter(id) {
  activeCharacterId = id;
  renderRoster();
}

export function clearActiveCharacter() {
  activeCharacterId = null;
  renderRoster();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
