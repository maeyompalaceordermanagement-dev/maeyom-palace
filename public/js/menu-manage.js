// ============================================================
// menu-manage.js - จัดการเมนู: เพิ่ม/แก้ไข/ลบ + อัปโหลดรูป + หมวดหมู่
// ============================================================

let allCategories = [];
let allItems = [];
let currentCatId = 'all';
let editingItemId = null;
let pendingImageFile = null;
let currentImageUrl = null;

const STORAGE_BUCKET = 'menu-images';

document.addEventListener('DOMContentLoaded', async () => {
  if (!initSupabase()) return;
  await loadCategories();
  await loadItems();

  // Realtime
  supabase.channel('menu-mgmt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => loadItems())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => loadCategories())
    .subscribe();
});

// ============================================================
// Categories
// ============================================================
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) { console.error(error); return; }
  allCategories = data || [];
  renderCatBar();
  fillCategoryDropdown();
}

function renderCatBar() {
  const bar = document.getElementById('catBar');
  let html = `<div class="cat-chip ${currentCatId==='all'?'active':''}" onclick="filterByCat('all')">📋 ทั้งหมด</div>`;
  html += allCategories.map(c => `
    <div class="cat-chip ${currentCatId===c.id?'active':''}" onclick="filterByCat('${c.id}')">
      ${c.icon || ''} ${escapeHtml(c.name)}
      <span class="x" onclick="event.stopPropagation();deleteCategory('${c.id}','${escapeHtml(c.name)}')" title="ลบหมวดหมู่">×</span>
    </div>`).join('');
  bar.innerHTML = html;
}

function filterByCat(id) {
  currentCatId = id;
  renderCatBar();
  renderItems();
}

function fillCategoryDropdown() {
  const sel = document.getElementById('inpCategory');
  sel.innerHTML = allCategories.map(c => `<option value="${c.id}">${c.icon || ''} ${escapeHtml(c.name)}</option>`).join('');
}

function openCategoryModal() {
  document.getElementById('inpCatName').value = '';
  document.getElementById('inpCatIcon').value = '';
  document.getElementById('inpCatOrder').value = (allCategories.length + 1) * 10;
  document.getElementById('categoryModal').style.display = 'flex';
}
function closeCategoryModal() { document.getElementById('categoryModal').style.display = 'none'; }

async function saveCategory() {
  const name = document.getElementById('inpCatName').value.trim();
  const icon = document.getElementById('inpCatIcon').value.trim();
  const order = parseInt(document.getElementById('inpCatOrder').value) || 99;
  if (!name) { notifier.showToast('กรุณาใส่ชื่อหมวดหมู่', 'error'); return; }

  const { error } = await supabase.from('categories').insert([{ name, icon, display_order: order }]);
  if (error) { notifier.showToast('บันทึกล้มเหลว: ' + error.message, 'error'); return; }
  notifier.showToast('เพิ่มหมวดหมู่สำเร็จ', 'success');
  closeCategoryModal();
  await loadCategories();
}

async function deleteCategory(id, name) {
  const inUse = allItems.filter(i => i.category_id === id).length;
  let msg = `ลบหมวดหมู่ "${name}"?`;
  if (inUse > 0) msg += `\n\n⚠️ มีเมนู ${inUse} รายการในหมวดนี้ — เมนูจะไม่ถูกลบ แต่จะไม่อยู่ในหมวดใดๆ`;
  if (!confirm(msg)) return;
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) { notifier.showToast('ลบล้มเหลว: ' + error.message, 'error'); return; }
  notifier.showToast('ลบหมวดหมู่สำเร็จ', 'success');
  if (currentCatId === id) currentCatId = 'all';
  await loadCategories();
}

// ============================================================
// Menu Items
// ============================================================
async function loadItems() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  allItems = data || [];
  renderItems();
}

function renderItems() {
  const grid = document.getElementById('menuGrid');
  let items = currentCatId === 'all' ? allItems : allItems.filter(i => i.category_id === currentCatId);

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="ico">🍽️</div>
        <h3 style="font-family:'Cormorant Garamond',serif;color:var(--color-emerald);">ยังไม่มีเมนูในหมวดนี้</h3>
        <p>คลิก "+ เพิ่มเมนู" เพื่อเริ่มต้น</p>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const cat = allCategories.find(c => c.id === item.category_id);
    return `
      <div class="menu-card ${item.is_available ? '' : 'unavailable'}">
        <div class="img ${item.image_url ? '' : 'empty'}" ${item.image_url ? `style="background-image:url('${item.image_url}')"` : ''}>
          ${item.image_url ? '' : '🍽️'}
          <div class="badges">
            ${item.is_recommended ? '<span class="badge-chip rec">⭐ แนะนำ</span>' : ''}
            ${item.is_spicy ? '<span class="badge-chip spicy">🌶️ เผ็ด</span>' : ''}
            ${!item.is_available ? '<span class="badge-chip off">ปิดขาย</span>' : ''}
          </div>
        </div>
        <div class="body">
          <div class="name">${escapeHtml(item.name)}</div>
          <div class="desc">${escapeHtml(item.description || '')}${cat ? ` • ${cat.icon || ''} ${escapeHtml(cat.name)}` : ''}</div>
          <div class="price">฿${formatPrice(item.price)}</div>
          <div class="row-btns">
            <button class="btn btn-ghost" onclick="toggleAvailable('${item.id}', ${item.is_available})">${item.is_available ? 'ปิดขาย' : 'เปิดขาย'}</button>
            <button class="btn btn-ghost" onclick="openEditMenu('${item.id}')">แก้ไข</button>
            <button class="btn btn-ghost" onclick="deleteItem('${item.id}','${escapeHtml(item.name)}')" style="color:#c33;">ลบ</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function openMenuModal() {
  if (allCategories.length === 0) {
    notifier.showToast('กรุณาเพิ่มหมวดหมู่ก่อน', 'error');
    return;
  }
  editingItemId = null;
  pendingImageFile = null;
  currentImageUrl = null;
  document.getElementById('menuModalTitle').textContent = 'เพิ่มเมนูใหม่';
  document.getElementById('inpName').value = '';
  document.getElementById('inpDesc').value = '';
  document.getElementById('inpPrice').value = '';
  document.getElementById('inpCategory').value = currentCatId !== 'all' ? currentCatId : (allCategories[0]?.id || '');
  document.getElementById('inpAvailable').checked = true;
  document.getElementById('inpRecommended').checked = false;
  document.getElementById('inpSpicy').checked = false;
  document.getElementById('inpImage').value = '';
  document.getElementById('imgPreview').style.backgroundImage = '';
  document.getElementById('imgPreview').textContent = '📷 ยังไม่มีรูป';
  document.getElementById('menuModal').style.display = 'flex';
}

function openEditMenu(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  editingItemId = id;
  pendingImageFile = null;
  currentImageUrl = item.image_url;
  document.getElementById('menuModalTitle').textContent = 'แก้ไขเมนู';
  document.getElementById('inpName').value = item.name;
  document.getElementById('inpDesc').value = item.description || '';
  document.getElementById('inpPrice').value = item.price;
  document.getElementById('inpCategory').value = item.category_id || '';
  document.getElementById('inpAvailable').checked = item.is_available;
  document.getElementById('inpRecommended').checked = !!item.is_recommended;
  document.getElementById('inpSpicy').checked = !!item.is_spicy;
  document.getElementById('inpImage').value = '';
  const prev = document.getElementById('imgPreview');
  if (item.image_url) {
    prev.style.backgroundImage = `url('${item.image_url}')`;
    prev.textContent = '';
  } else {
    prev.style.backgroundImage = '';
    prev.textContent = '📷 ยังไม่มีรูป';
  }
  document.getElementById('menuModal').style.display = 'flex';
}

function closeMenuModal() {
  document.getElementById('menuModal').style.display = 'none';
  editingItemId = null;
  pendingImageFile = null;
}

function onImagePick(e) {
  const f = e.target.files[0];
  if (!f) return;
  pendingImageFile = f;
  const url = URL.createObjectURL(f);
  const prev = document.getElementById('imgPreview');
  prev.style.backgroundImage = `url('${url}')`;
  prev.textContent = '';
}

async function uploadImage(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

async function saveMenu() {
  const name = document.getElementById('inpName').value.trim();
  const desc = document.getElementById('inpDesc').value.trim();
  const price = parseFloat(document.getElementById('inpPrice').value);
  const cat = document.getElementById('inpCategory').value;
  const avail = document.getElementById('inpAvailable').checked;
  const rec = document.getElementById('inpRecommended').checked;
  const spicy = document.getElementById('inpSpicy').checked;

  if (!name || isNaN(price) || price < 0 || !cat) {
    notifier.showToast('กรุณากรอกข้อมูลให้ครบ', 'error');
    return;
  }

  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

  try {
    let imageUrl = currentImageUrl;
    if (pendingImageFile) {
      btn.textContent = 'อัปโหลดรูป...';
      try { imageUrl = await uploadImage(pendingImageFile); }
      catch (e) {
        console.error(e);
        notifier.showToast('อัปโหลดรูปล้มเหลว — บันทึกเมนูโดยไม่มีรูป', 'error');
      }
    }

    const payload = {
      name, description: desc || null, price,
      category_id: cat,
      is_available: avail,
      is_recommended: rec,
      is_spicy: spicy,
      image_url: imageUrl
    };

    let res;
    if (editingItemId) {
      res = await supabase.from('menu_items').update(payload).eq('id', editingItemId);
    } else {
      res = await supabase.from('menu_items').insert([payload]);
    }
    if (res.error) throw res.error;

    notifier.showToast(editingItemId ? 'แก้ไขเมนูสำเร็จ' : 'เพิ่มเมนูสำเร็จ', 'success');
    notifier.playSuccessSound();
    closeMenuModal();
    await loadItems();
  } catch (e) {
    console.error(e);
    notifier.showToast('บันทึกล้มเหลว: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'บันทึก';
  }
}

async function toggleAvailable(id, currentVal) {
  const { error } = await supabase.from('menu_items').update({ is_available: !currentVal }).eq('id', id);
  if (error) { notifier.showToast('อัปเดตล้มเหลว', 'error'); return; }
  notifier.showToast(currentVal ? 'ปิดขายแล้ว' : 'เปิดขายแล้ว', 'success');
  await loadItems();
}

async function deleteItem(id, name) {
  if (!confirm(`ลบเมนู "${name}"?`)) return;
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) { notifier.showToast('ลบล้มเหลว: ' + error.message, 'error'); return; }
  notifier.showToast('ลบเมนูสำเร็จ', 'success');
  await loadItems();
}

// ============================================================
// Helpers
// ============================================================
function formatPrice(n) { return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function escapeHtml(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
