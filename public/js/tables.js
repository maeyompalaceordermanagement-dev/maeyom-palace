// ============================================================
// tables.js - จัดการโต๊ะ: เพิ่ม/แก้ไข/ลบ/สร้าง QR/ปริ้น QR
// ============================================================

let editingTableId = null;
let currentQrTable = null;
let allTables = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (!initSupabase()) return;
  await loadTables();

  // Realtime: โต๊ะถูกเปลี่ยนจากเครื่องอื่น
  supabase.channel('tables-mgmt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
      loadTables();
    })
    .subscribe();
});

async function loadTables() {
  const { data, error } = await supabase
    .from('tables')
    .select('*')
    .order('table_number', { ascending: true });

  if (error) {
    console.error(error);
    notifier.showToast('โหลดข้อมูลโต๊ะล้มเหลว', 'error');
    return;
  }

  allTables = data || [];
  renderTables();
  renderPrintView();
}

function renderTables() {
  const c = document.getElementById('tablesContainer');
  if (allTables.length === 0) {
    c.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="ico">🪑</div>
        <h3 style="font-family:'Cormorant Garamond',serif;color:var(--color-emerald);">ยังไม่มีโต๊ะ</h3>
        <p>คลิก "+ เพิ่มโต๊ะ" เพื่อเริ่มต้น</p>
      </div>`;
    return;
  }

  c.innerHTML = allTables.map(t => {
    const url = buildTableUrl(t.table_number);
    const off = !t.is_active;
    return `
      <div class="table-card ${off ? 'inactive' : ''}">
        ${off ? '<span class="badge-off">ปิดใช้งาน</span>' : ''}
        <div class="num">${t.table_number}</div>
        ${t.table_name ? `<div class="name">${escapeHtml(t.table_name)}</div>` : '<div class="name">&nbsp;</div>'}
        <div class="seats">${t.seats || 4} ที่นั่ง</div>
        <div class="qr-box" id="qrbox-${t.id}"></div>
        <div class="row-btns">
          <button class="btn btn-ghost" onclick="openQrModal('${t.id}')">ดู QR</button>
          <button class="btn btn-ghost" onclick="openEditModal('${t.id}')">แก้ไข</button>
          <button class="btn btn-ghost" onclick="deleteTable('${t.id}', ${t.table_number})" style="color:#c33;">ลบ</button>
        </div>
      </div>`;
  }).join('');

  // วาด QR ลงในแต่ละการ์ด
  allTables.forEach(t => {
    const url = buildTableUrl(t.table_number);
    const box = document.getElementById(`qrbox-${t.id}`);
    if (box && window.QRCode) {
      QRCode.toCanvas(url, { width: 140, margin: 1, color: { dark: '#0F3B2E', light: '#ffffff' } }, (err, canvas) => {
        if (!err && canvas) { box.innerHTML = ''; box.appendChild(canvas); }
      });
    }
  });
}

function renderPrintView() {
  const v = document.getElementById('printAllView');
  v.innerHTML = `
    <div style="text-align:center;margin-bottom:8mm;">
      <h1 style="font-family:'Cormorant Garamond',serif;color:#0F3B2E;margin:0;">${CONFIG.HOTEL_NAME}</h1>
      <p style="color:#888;margin:4px 0 0;">QR Code สำหรับสั่งอาหารประจำโต๊ะ</p>
    </div>
    <div class="print-grid">
      ${allTables.filter(t=>t.is_active).map(t=>`
        <div class="print-card">
          <h3>${CONFIG.HOTEL_NAME}</h3>
          <div style="font-size:12px;color:#666;">โต๊ะหมายเลข</div>
          <div class="pn">${t.table_number}</div>
          ${t.table_name ? `<div style="color:#C9A861;font-weight:600;">${escapeHtml(t.table_name)}</div>` : ''}
          <div id="pqr-${t.id}" style="display:flex;justify-content:center;margin:8px 0;"></div>
          <div class="scan">📱 สแกนเพื่อสั่งอาหาร</div>
        </div>
      `).join('')}
    </div>`;

  allTables.filter(t=>t.is_active).forEach(t => {
    const url = buildTableUrl(t.table_number);
    const box = document.getElementById(`pqr-${t.id}`);
    if (box && window.QRCode) {
      QRCode.toCanvas(url, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } }, (err, canvas) => {
        if (!err && canvas) box.appendChild(canvas);
      });
    }
  });
}

function buildTableUrl(tableNumber) {
  return `${CONFIG.BASE_URL}/menu.html?table=${tableNumber}`;
}

// ============================================================
// Modal: เพิ่ม/แก้ไข
// ============================================================
function openAddModal() {
  editingTableId = null;
  document.getElementById('modalTitle').textContent = 'เพิ่มโต๊ะใหม่';
  document.getElementById('inpTableNumber').value = nextTableNumber();
  document.getElementById('inpTableName').value = '';
  document.getElementById('inpSeats').value = 4;
  document.getElementById('inpActive').checked = true;
  document.getElementById('inpTableNumber').disabled = false;
  document.getElementById('tableModal').style.display = 'flex';
}

function openEditModal(id) {
  const t = allTables.find(x => x.id === id);
  if (!t) return;
  editingTableId = id;
  document.getElementById('modalTitle').textContent = `แก้ไขโต๊ะ ${t.table_number}`;
  document.getElementById('inpTableNumber').value = t.table_number;
  document.getElementById('inpTableName').value = t.table_name || '';
  document.getElementById('inpSeats').value = t.seats || 4;
  document.getElementById('inpActive').checked = t.is_active;
  document.getElementById('inpTableNumber').disabled = true; // ห้ามเปลี่ยนเลขโต๊ะตอนแก้ไข
  document.getElementById('tableModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('tableModal').style.display = 'none';
  editingTableId = null;
}

function nextTableNumber() {
  if (allTables.length === 0) return 1;
  const max = Math.max(...allTables.map(t => t.table_number));
  return max + 1;
}

async function saveTable() {
  const num = parseInt(document.getElementById('inpTableNumber').value);
  const name = document.getElementById('inpTableName').value.trim();
  const seats = parseInt(document.getElementById('inpSeats').value) || 4;
  const active = document.getElementById('inpActive').checked;

  if (!num || num < 1) {
    notifier.showToast('กรุณาใส่หมายเลขโต๊ะ', 'error');
    return;
  }

  const payload = {
    table_number: num,
    table_name: name || null,
    seats: seats,
    is_active: active
  };

  let res;
  if (editingTableId) {
    res = await supabase.from('tables').update(payload).eq('id', editingTableId);
  } else {
    // เช็คซ้ำ
    if (allTables.some(t => t.table_number === num)) {
      notifier.showToast(`มีโต๊ะหมายเลข ${num} อยู่แล้ว`, 'error');
      return;
    }
    res = await supabase.from('tables').insert([payload]);
  }

  if (res.error) {
    console.error(res.error);
    notifier.showToast('บันทึกล้มเหลว: ' + res.error.message, 'error');
    return;
  }

  notifier.showToast(editingTableId ? 'แก้ไขโต๊ะสำเร็จ' : 'เพิ่มโต๊ะสำเร็จ', 'success');
  notifier.playSuccessSound();
  closeModal();
  await loadTables();
}

async function deleteTable(id, num) {
  if (!confirm(`ยืนยันการลบโต๊ะหมายเลข ${num}?\nออเดอร์เก่าของโต๊ะนี้จะยังอยู่ในระบบ`)) return;
  const { error } = await supabase.from('tables').delete().eq('id', id);
  if (error) {
    notifier.showToast('ลบโต๊ะล้มเหลว: ' + error.message, 'error');
    return;
  }
  notifier.showToast('ลบโต๊ะสำเร็จ', 'success');
  await loadTables();
}

// ============================================================
// QR Modal
// ============================================================
function openQrModal(id) {
  const t = allTables.find(x => x.id === id);
  if (!t) return;
  currentQrTable = t;
  const url = buildTableUrl(t.table_number);
  document.getElementById('qrModalTitle').textContent = `โต๊ะหมายเลข ${t.table_number}`;
  document.getElementById('qrModalSub').textContent = t.table_name || `${t.seats || 4} ที่นั่ง`;
  document.getElementById('qrModalUrl').textContent = url;
  const box = document.getElementById('qrModalCanvas');
  box.innerHTML = '';
  QRCode.toCanvas(url, { width: 280, margin: 2, color: { dark: '#0F3B2E', light: '#ffffff' } }, (err, canvas) => {
    if (!err && canvas) box.appendChild(canvas);
  });
  document.getElementById('qrModal').style.display = 'flex';
}

function closeQrModal() {
  document.getElementById('qrModal').style.display = 'none';
  currentQrTable = null;
}

function downloadQr() {
  if (!currentQrTable) return;
  const canvas = document.querySelector('#qrModalCanvas canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `maeyom-table-${currentQrTable.table_number}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ============================================================
// Helper
// ============================================================
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
