'use strict';

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
  '#00bcd4', '#8bc34a', '#ff5722', '#607d8b',
];

const DEFAULT_ENTRIES = ['Pizza', 'Tacos', 'Sushi', 'Burger', 'Pasta', 'Salad'];
const MIN_SPIN_REVOLUTIONS = 6;
const JITTER_FACTOR = 0.5;   // fraction of a segment that the landing point may vary
const SPIN_DURATION_MS = 4500;

let entries = [...DEFAULT_ENTRIES];
let spinning = false;
let currentAngle = -Math.PI / 2; // start so first segment is at top

const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');

function cx() { return canvas.width / 2; }
function cy() { return canvas.height / 2; }
function radius() { return Math.min(cx(), cy()) - 20; }

// ── Drawing ─────────────────────────────────────────────────────────────────

function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const n = entries.length;

  if (n === 0) {
    ctx.beginPath();
    ctx.arc(cx(), cy(), radius(), 0, 2 * Math.PI);
    ctx.fillStyle = '#2c3e50';
    ctx.fill();
    ctx.fillStyle = '#7f8c8d';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Add entries to spin!', cx(), cy());
    return;
  }

  const segAngle = (2 * Math.PI) / n;
  const fontSize = Math.min(16, Math.max(9, Math.floor(140 / n)));

  for (let i = 0; i < n; i++) {
    const startAngle = currentAngle + i * segAngle;
    const endAngle = startAngle + segAngle;

    // Segment fill
    ctx.beginPath();
    ctx.moveTo(cx(), cy());
    ctx.arc(cx(), cy(), radius(), startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.save();
    ctx.translate(cx(), cy());
    ctx.rotate(startAngle + segAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    const maxChars = Math.max(6, Math.floor(30 / Math.max(n, 1)));
    const label = entries[i].length > maxChars
      ? entries[i].slice(0, maxChars) + '…'
      : entries[i];
    ctx.fillText(label, radius() - 12, fontSize / 3);
    ctx.restore();
  }

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx(), cy(), radius(), 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Center hub
  ctx.beginPath();
  ctx.arc(cx(), cy(), 16, 0, 2 * Math.PI);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ── Entry management ─────────────────────────────────────────────────────────

function renderEntryList() {
  const list = document.getElementById('entriesList');
  list.innerHTML = '';

  entries.forEach((entry, i) => {
    const item = document.createElement('div');
    item.className = 'entry-item';

    const dot = document.createElement('span');
    dot.className = 'entry-color';
    dot.style.background = COLORS[i % COLORS.length];

    const label = document.createElement('span');
    label.className = 'entry-label';
    label.textContent = entry;
    label.title = entry;

    const del = document.createElement('button');
    del.className = 'entry-delete';
    del.textContent = '✕';
    del.title = 'Remove';
    del.addEventListener('click', () => removeEntry(i));

    item.appendChild(dot);
    item.appendChild(label);
    item.appendChild(del);
    list.appendChild(item);
  });

  updateRigSelect();
  drawWheel();
}

function addEntry() {
  const input = document.getElementById('newEntry');
  const value = input.value.trim();
  if (!value) return;
  entries.push(value);
  input.value = '';
  renderEntryList();
}

function removeEntry(index) {
  if (entries.length <= 1) return;
  entries.splice(index, 1);
  renderEntryList();
}

// ── Rig controls ─────────────────────────────────────────────────────────────

function updateRigUI() {
  const enabled = document.getElementById('rigEnabled').checked;
  const controls = document.getElementById('rigControls');
  if (enabled) {
    controls.classList.remove('hidden');
  } else {
    controls.classList.add('hidden');
  }
}

function updateRigSelect() {
  const select = document.getElementById('rigSelect');
  const prev = select.value;
  select.innerHTML = '';
  entries.forEach((entry, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = entry;
    select.appendChild(opt);
  });
  // Restore previous selection if still valid
  if (prev !== '' && parseInt(prev) < entries.length) {
    select.value = prev;
  }
}

// ── Spin ─────────────────────────────────────────────────────────────────────

function getWinnerIndex(angle) {
  const n = entries.length;
  if (n === 0) return -1;
  const segAngle = (2 * Math.PI) / n;
  // Pointer is at the top (angle = -PI/2 in canvas coords).
  // Segment i occupies [angle + i*segAngle, angle + (i+1)*segAngle].
  // The segment under the pointer satisfies: angle + i*segAngle <= -PI/2 (mod 2PI)
  // Rearranged: (-PI/2 - angle) mod 2PI lands in [i*segAngle, (i+1)*segAngle)
  const norm = ((-Math.PI / 2 - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return Math.floor(norm / segAngle) % n;
}

function spin() {
  if (spinning || entries.length === 0) return;
  spinning = true;

  document.getElementById('result').textContent = '';
  document.getElementById('spinBtn').disabled = true;

  const n = entries.length;
  const segAngle = (2 * Math.PI) / n;

  const rigEnabled = document.getElementById('rigEnabled').checked;
  const rigSelect = document.getElementById('rigSelect');

  let targetIndex;
  if (rigEnabled && rigSelect.value !== '') {
    targetIndex = parseInt(rigSelect.value, 10);
  } else {
    targetIndex = Math.floor(Math.random() * n);
  }

  // We want: currentAngle + finalRotation puts segment targetIndex under the pointer (-PI/2).
  // The pointer lands on segment i when: (-PI/2 - finalAngle) mod 2PI is in [i*segAngle, (i+1)*segAngle).
  // Choose landing point near the segment's center (with small jitter for visual variety).
  const jitter = (Math.random() - 0.5) * segAngle * JITTER_FACTOR;
  const targetPointerOffset = targetIndex * segAngle + segAngle / 2 + jitter;
  // finalAngle ≡ -PI/2 - targetPointerOffset  (mod 2PI)
  const targetRaw = -Math.PI / 2 - targetPointerOffset;
  const targetNorm = ((targetRaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const currNorm = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  let delta = targetNorm - currNorm;
  if (delta < 0) delta += 2 * Math.PI;

  // Spin at least MIN_SPIN_REVOLUTIONS full revolutions so it looks dramatic
  const finalAngle = currentAngle + delta + MIN_SPIN_REVOLUTIONS * 2 * Math.PI;

  const duration = SPIN_DURATION_MS;
  const startAngle = currentAngle;
  const startTime = performance.now();

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function animate(timestamp) {
    const elapsed = timestamp - startTime;
    const t = Math.min(elapsed / duration, 1);
    currentAngle = startAngle + (finalAngle - startAngle) * easeOut(t);
    drawWheel();

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      currentAngle = finalAngle;
      spinning = false;
      document.getElementById('spinBtn').disabled = false;
      const winner = entries[getWinnerIndex(currentAngle)];
      const resultEl = document.getElementById('result');
      resultEl.textContent = `🎉 ${winner}!`;
      // Re-trigger animation by cloning the element
      const clone = resultEl.cloneNode(true);
      resultEl.replaceWith(clone);
    }
  }

  requestAnimationFrame(animate);
}

// ── Keyboard shortcut ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    spin();
  }
});

document.getElementById('newEntry').addEventListener('keydown', (e) => {
  if (e.code === 'Enter') addEntry();
});

// ── Init ─────────────────────────────────────────────────────────────────────

renderEntryList();
