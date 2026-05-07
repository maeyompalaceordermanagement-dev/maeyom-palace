// ============================================================
// Customer Order System - หน้าสั่งอาหารของลูกค้า
// ============================================================

// State
const state = {
    tableNumber: null,
    tableId: null,
    orderType: null,
    customer: { name: '', phone: '' },
    categories: [],
    menuItems: [],
    cart: [], // [{menu_item, quantity, notes}]
    currentItem: null,
    currentQty: 1,
};

// Init
window.addEventListener('DOMContentLoaded', async () => {
    initSupabase();
    if (!supabase) return;
    
    parseUrlParams();
    await loadTableInfo();
    setupEventListeners();
    
    // ถ้ามี order type จาก URL ให้ skip step 1
    const params = new URLSearchParams(window.location.search);
    const presetType = params.get('type');
    if (presetType === 'takeaway' || presetType === 'dine_in') {
        selectOrderType(presetType);
    }
});

function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    state.tableNumber = params.get('table');
    
    // โหลดข้อมูลลูกค้าจาก localStorage (ถ้าเคยกรอกมาก่อน)
    const saved = localStorage.getItem('maeyom_customer');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            state.customer = data;
            document.getElementById('customer-name').value = data.name || '';
            document.getElementById('customer-phone').value = data.phone || '';
        } catch (e) {}
    }
}

async function loadTableInfo() {
    const display = document.getElementById('table-display');
    
    if (state.tableNumber) {
        const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('table_number', parseInt(state.tableNumber))
            .single();
        
        if (data) {
            state.tableId = data.id;
            display.innerHTML = `🪑 ${data.table_name || `โต๊ะ ${data.table_number}`}`;
        } else {
            display.innerHTML = `⚠️ โต๊ะ ${state.tableNumber}`;
            notifier.showToast('ไม่พบข้อมูลโต๊ะนี้ในระบบ', 'warning');
        }
    } else {
        display.innerHTML = '🥡 สั่งกลับบ้าน';
    }
}

function setupEventListeners() {
    // Order type selection
    document.querySelectorAll('.order-type-card').forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.type;
            // ถ้าเลือกกินที่นี่ ต้องมีเลขโต๊ะ
            if (type === 'dine_in' && !state.tableNumber) {
                const t = prompt('กรุณากรอกเลขโต๊ะ:');
                if (!t || isNaN(t)) return;
                state.tableNumber = t;
                loadTableInfo();
            }
            selectOrderType(type);
        });
    });
    
    // Customer info form
    document.getElementById('btn-confirm-info').addEventListener('click', confirmCustomerInfo);
    
    // Search
    document.getElementById('search-menu').addEventListener('input', (e) => {
        renderMenu(e.target.value, getActiveCategory());
    });
    
    // Cart bar
    document.getElementById('btn-view-cart').addEventListener('click', openCart);
}

function selectOrderType(type) {
    state.orderType = type;
    document.querySelectorAll('.order-type-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.type === type);
    });
    
    setTimeout(() => {
        document.getElementById('step-order-type').classList.add('hidden');
        document.getElementById('step-customer-info').classList.remove('hidden');
        document.getElementById('step-customer-info').classList.add('animate-fade-in-up');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 300);
}

function confirmCustomerInfo() {
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    
    if (!name) {
        notifier.showToast('กรุณากรอกชื่อ', 'warning');
        document.getElementById('customer-name').focus();
        return;
    }
    if (!phone || phone.length < 9) {
        notifier.showToast('กรุณากรอกเบอร์โทรให้ถูกต้อง', 'warning');
        document.getElementById('customer-phone').focus();
        return;
    }
    
    state.customer = { name, phone };
    localStorage.setItem('maeyom_customer', JSON.stringify(state.customer));
    
    document.getElementById('step-customer-info').classList.add('hidden');
    document.getElementById('step-menu').classList.remove('hidden');
    document.getElementById('step-menu').classList.add('animate-fade-in-up');
    
    loadMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadMenu() {
    // โหลด categories
    const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
    
    state.categories = cats || [];
    renderCategoryTabs();
    
    // โหลด menu items
    const { data: items } = await supabase
        .from('menu_items')
        .select('*, categories(name, name_en, icon)')
        .order('sort_order');
    
    state.menuItems = items || [];
    renderMenu();
}

function renderCategoryTabs() {
    const container = document.getElementById('category-tabs');
    container.innerHTML = '<button class="category-tab active" data-category="all">ทั้งหมด</button>' +
        state.categories.map(c => 
            `<button class="category-tab" data-category="${c.id}">${c.icon || ''} ${c.name}</button>`
        ).join('');
    
    container.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderMenu(document.getElementById('search-menu').value, tab.dataset.category);
        });
    });
}

function getActiveCategory() {
    const active = document.querySelector('.category-tab.active');
    return active ? active.dataset.category : 'all';
}

function renderMenu(search = '', category = 'all') {
    const grid = document.getElementById('menu-grid');
    let items = state.menuItems;
    
    if (category !== 'all') {
        items = items.filter(i => i.category_id === category);
    }
    
    if (search) {
        const s = search.toLowerCase();
        items = items.filter(i => 
            (i.name && i.name.toLowerCase().includes(s)) ||
            (i.name_en && i.name_en.toLowerCase().includes(s)) ||
            (i.description && i.description.toLowerCase().includes(s))
        );
    }
    
    if (items.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🍽️</div>
                <p style="color: var(--color-stone);">ไม่พบเมนูที่ค้นหา</p>
            </div>`;
        return;
    }
    
    grid.innerHTML = items.map(item => {
        const tags = [];
        if (item.is_recommended) tags.push('<span class="menu-item-tag recommended">⭐ แนะนำ</span>');
        if (item.is_spicy) tags.push('<span class="menu-item-tag spicy">🌶️ เผ็ด</span>');
        
        const imgContent = item.image_url 
            ? `<img src="${item.image_url}" alt="${item.name}" loading="lazy">`
            : '🍽️';
        
        return `
            <div class="menu-item ${!item.is_available ? 'menu-item-unavailable' : ''}" 
                 onclick='openItemModal(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
                <div class="menu-item-image">
                    ${imgContent}
                    ${tags.length ? `<div class="menu-item-tags">${tags.join('')}</div>` : ''}
                </div>
                <div class="menu-item-content">
                    <div class="menu-item-name">${item.name}</div>
                    <div class="menu-item-desc">${item.description || ''}</div>
                    <div class="menu-item-footer">
                        <div class="menu-item-price">฿${Number(item.price).toLocaleString()}</div>
                        <button class="menu-item-add">+</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// ============================================================
// Item Modal
// ============================================================
function openItemModal(item) {
    state.currentItem = item;
    state.currentQty = 1;
    
    const modal = document.getElementById('item-modal');
    document.getElementById('item-modal-name').textContent = item.name;
    document.getElementById('item-modal-desc').textContent = item.description || '';
    document.getElementById('item-modal-price').textContent = `฿${Number(item.price).toLocaleString()}`;
    document.getElementById('item-quantity').textContent = '1';
    document.getElementById('item-notes').value = '';
    
    const imgContainer = document.getElementById('item-image-container');
    if (item.image_url) {
        imgContainer.innerHTML = `<img src="${item.image_url}" alt="${item.name}">`;
    } else {
        imgContainer.innerHTML = '🍽️';
    }
    
    modal.classList.remove('hidden');
}

function closeItemModal() {
    document.getElementById('item-modal').classList.add('hidden');
    state.currentItem = null;
}

function changeItemQty(delta) {
    state.currentQty = Math.max(1, state.currentQty + delta);
    document.getElementById('item-quantity').textContent = state.currentQty;
}

function addItemToCart() {
    if (!state.currentItem) return;
    
    const notes = document.getElementById('item-notes').value.trim();
    
    state.cart.push({
        menu_item: state.currentItem,
        quantity: state.currentQty,
        notes: notes
    });
    
    notifier.playSuccessSound();
    notifier.showToast(`เพิ่ม "${state.currentItem.name}" x${state.currentQty} แล้ว`, 'success', 2000);
    
    closeItemModal();
    updateCartBar();
}

// ============================================================
// Cart
// ============================================================
function updateCartBar() {
    const bar = document.getElementById('cart-bar');
    const count = state.cart.reduce((s, i) => s + i.quantity, 0);
    const total = state.cart.reduce((s, i) => s + (i.menu_item.price * i.quantity), 0);
    
    document.getElementById('cart-count').textContent = count;
    document.getElementById('cart-total').textContent = `฿${total.toLocaleString()}`;
    
    if (count > 0) {
        bar.classList.remove('hidden');
    } else {
        bar.classList.add('hidden');
    }
}

function openCart() {
    if (state.cart.length === 0) return;
    renderCartItems();
    document.getElementById('cart-modal').classList.remove('hidden');
}

function closeCart() {
    document.getElementById('cart-modal').classList.add('hidden');
}

function renderCartItems() {
    const container = document.getElementById('cart-items');
    
    container.innerHTML = state.cart.map((item, idx) => {
        const subtotal = item.menu_item.price * item.quantity;
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.menu_item.name}</div>
                    <div class="cart-item-price">฿${Number(item.menu_item.price).toLocaleString()}</div>
                    ${item.notes ? `<div class="cart-item-notes">📝 ${item.notes}</div>` : ''}
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="changeCartQty(${idx}, -1)">−</button>
                    <span style="font-weight: 700; min-width: 24px; text-align: center;">${item.quantity}</span>
                    <button class="qty-btn" onclick="changeCartQty(${idx}, 1)">+</button>
                </div>
                <div style="font-family: var(--font-display); font-weight: 700; color: var(--color-gold-dark); min-width: 80px; text-align: right;">
                    ฿${subtotal.toLocaleString()}
                </div>
                <button class="btn btn-ghost btn-icon btn-sm" onclick="removeCartItem(${idx})" title="ลบ">🗑️</button>
            </div>`;
    }).join('');
    
    const subtotal = state.cart.reduce((s, i) => s + (i.menu_item.price * i.quantity), 0);
    document.getElementById('cart-subtotal').textContent = `฿${subtotal.toLocaleString()}`;
    document.getElementById('cart-final').textContent = `฿${subtotal.toLocaleString()}`;
}

function changeCartQty(idx, delta) {
    const item = state.cart[idx];
    if (!item) return;
    item.quantity = Math.max(1, item.quantity + delta);
    renderCartItems();
    updateCartBar();
}

function removeCartItem(idx) {
    state.cart.splice(idx, 1);
    if (state.cart.length === 0) {
        closeCart();
    } else {
        renderCartItems();
    }
    updateCartBar();
}

// ============================================================
// Submit Order
// ============================================================
async function submitOrder() {
    if (state.cart.length === 0) return;
    
    const btn = document.getElementById('btn-submit-order');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> กำลังส่ง...';
    
    const totalAmount = state.cart.reduce((s, i) => s + (i.menu_item.price * i.quantity), 0);
    const notes = document.getElementById('order-notes').value.trim();
    
    try {
        // 1. สร้าง order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                table_id: state.tableId,
                table_number: state.tableNumber ? parseInt(state.tableNumber) : null,
                customer_name: state.customer.name,
                customer_phone: state.customer.phone,
                order_type: state.orderType,
                status: 'pending',
                total_amount: totalAmount,
                notes: notes || null
            })
            .select()
            .single();
        
        if (orderError) throw orderError;
        
        // 2. สร้าง order_items
        const items = state.cart.map(item => ({
            order_id: order.id,
            menu_item_id: item.menu_item.id,
            menu_name: item.menu_item.name,
            menu_price: item.menu_item.price,
            quantity: item.quantity,
            subtotal: item.menu_item.price * item.quantity,
            notes: item.notes || null
        }));
        
        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(items);
        
        if (itemsError) throw itemsError;
        
        // เซฟ order id ลง localStorage เพื่อให้ดูสถานะได้
        const myOrders = JSON.parse(localStorage.getItem('maeyom_my_orders') || '[]');
        myOrders.unshift(order.id);
        localStorage.setItem('maeyom_my_orders', JSON.stringify(myOrders.slice(0, 50)));
        
        // ส่งแจ้งเตือน LINE (ถ้ามี)
        await notifier.sendLineNotify(
            `🔔 ออเดอร์ใหม่!\n` +
            `เลขที่: ${order.order_number}\n` +
            `${state.tableNumber ? `โต๊ะ: ${state.tableNumber}` : 'กลับบ้าน'}\n` +
            `ลูกค้า: ${state.customer.name}\n` +
            `เบอร์: ${state.customer.phone}\n` +
            `รวม: ฿${totalAmount.toLocaleString()}`
        );
        
        // success
        notifier.playSuccessSound();
        notifier.showToast('สั่งสำเร็จ! กำลังพาไปหน้าสถานะ', 'success');
        
        setTimeout(() => {
            window.location.href = `status.html?id=${order.id}`;
        }, 1500);
        
    } catch (error) {
        console.error('Order error:', error);
        notifier.showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '🛍️ ยืนยันสั่ง';
    }
}

// Expose to global
window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.changeItemQty = changeItemQty;
window.addItemToCart = addItemToCart;
window.closeCart = closeCart;
window.changeCartQty = changeCartQty;
window.removeCartItem = removeCartItem;
window.submitOrder = submitOrder;
